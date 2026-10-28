import { z } from 'zod';
import prisma, { withTransaction } from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';
import {
  calculateStudentTermGrade,
  getGradingPolicy,
  roundHalfUp,
  getPerformanceDescriptor,
  type StudentTermScoreInput,
  type SubjectGroup,
} from '../academic/grading/index.js';

export const ledgerTermSchema = z.object({
  version: z.number().int().optional(),
  wwItems: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    max: z.number().positive().max(1000)
  })).optional().default([]),
  ptItems: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    max: z.number().positive().max(1000)
  })).optional().default([]),
  examItems: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    max: z.number().positive().max(1000),
    weight: z.number().min(0).max(100).optional().default(30)
  })).optional(),
  customWeights: z.object({
    ww: z.number().min(0).max(100).optional(),
    pt: z.number().min(0).max(100).optional(),
    qa: z.number().min(0).max(100).optional(),
    ex: z.number().min(0).max(100).optional(),
  }).optional(),
  st1Max: z.number().positive().max(1000).optional(),
  st2Max: z.number().positive().max(1000).optional(),
  teMax: z.number().positive().max(1000).optional(),
  qaMax: z.number().positive().max(1000).optional(),
  grades: z.record(z.string(), z.record(z.string(), z.string())).optional().default({}),
  deletedColumnIds: z.array(z.string()).optional().default([]),
});

export const ledgerSchema = z.object({
  classId: z.string().min(1),
  terms: z.record(z.enum(['T1','T2','T3','T4']), ledgerTermSchema)
});

/**
 * Resolves SubjectGroup for policy configuration:
 * CORE (Languages, Math, Science, AP, Values Ed) vs TECHNICAL (EPP/TLE, MAPEH).
 */
export function resolveSubjectGroup(subjectCode?: string | null, subjectName?: string | null): SubjectGroup {
  const code = (subjectCode || '').toUpperCase();
  const name = (subjectName || '').toUpperCase();
  if (
    code.includes('TLE') ||
    code.includes('EPP') ||
    code.includes('MAPEH') ||
    name.includes('TECHNOLOGY') ||
    name.includes('LIVELIHOOD') ||
    name.includes('EPP') ||
    name.includes('MAPEH') ||
    name.includes('MUSIC') ||
    name.includes('ARTS') ||
    name.includes('PHYSICAL EDUCATION') ||
    name.includes('HEALTH')
  ) {
    return 'TECHNICAL';
  }
  return 'CORE';
}

function parseScore(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export async function getLedger(classId: string, actorId: string) {
  // Fetch the assignment with relations
  const assignment = await prisma.teacherSubjectAssignment.findUnique({
    where: { id: classId },
    include: {
      section: true,
      teacher: true,
      subject: true,
      academic_year: true,
    }
  });

  if (!assignment) {
    throw new AppError(404, 'NOT_FOUND', 'Class assignment not found');
  }

  // Row-level authorization check: Verify the requesting user owns this assignment
  if (assignment.teacher.user_id !== actorId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this class gradebook');
  }

  let rosterData: any[] = [];
  let enrollments: any[] = [];
  if (assignment && assignment.section_id) {
    enrollments = await prisma.enrollment.findMany({
      where: { section_id: assignment.section_id, status: 'Enrolled' },
      include: { student: { include: { user: true } } },
      orderBy: { student: { user: { last_name: 'asc' } } }
    });

    rosterData = enrollments.map(e => ({
      id: e.id,
      studentId: e.student_id,
      surname: e.student.user.last_name,
      first: e.student.user.first_name,
      gender: e.student.gender || 'Unknown',
    }));
  }

  // Resolve grading policy
  const subjectGroup = resolveSubjectGroup(assignment.subject?.code, assignment.subject?.name);
  let policy: any;
  try {
    policy = getGradingPolicy({
      schoolYear: assignment.academic_year?.name || 'SY 2026-2027',
      gradeLevel: assignment.section?.grade_level || 7,
      subjectGroup,
    });
  } catch {
    policy = getGradingPolicy({
      schoolYear: 'SY 2026-2027',
      gradeLevel: 7,
      subjectGroup: 'CORE',
    });
  }

  const termsData: any = {};
  
  for (const t of ['T1', 'T2', 'T3', 'T4']) {
    const gb = await prisma.gradebooks.findFirst({
      where: { assignment_id: classId, term: { key: t as any } }
    });
    if (!gb) {
      termsData[t] = {
        version: 1,
        wwItems: [],
        ptItems: [],
        st1Max: 25,
        st2Max: 25,
        teMax: 50,
        qaMax: 50,
        grades: {},
        computed: {},
      };
      continue;
    }
    
    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook_id: gb.id },
      orderBy: { sort_order: 'asc' }
    });
    
    const entries = await prisma.grade_entries.findMany({
      where: { column_id: { in: cols.map(c => c.id) }, is_superseded: false }
    });

    const wwItems = cols.filter(c => c.type === 'WW').map(c => ({ id: c.id, label: c.label, max: c.max_score }));
    const ptItems = cols.filter(c => c.type === 'PT').map(c => ({ id: c.id, label: c.label, max: c.max_score }));
    const st1Col = cols.find(c => c.type === 'ST1');
    const st2Col = cols.find(c => c.type === 'ST2');
    const teCol  = cols.find(c => c.type === 'TE') || cols.find(c => c.type === 'QA');

    const st1Max = st1Col?.max_score || 25;
    const st2Max = st2Col?.max_score || 25;
    const teMax  = teCol?.max_score || 50;
    const qaMax  = teMax;

    // Parse dynamic exam columns
    const examCols = cols.filter(c => c.type === 'ST1' || c.type === 'ST2' || c.type === 'TE' || c.type === 'QA' || c.type === 'EX');
    const examItems = examCols.map(c => {
      const match = c.label.match(/^(.*?)(?:\s*\[(\d+(?:\.\d+)?)%\])?$/);
      const cleanLabel = match && match[1] ? match[1].trim() : c.label;
      const weight = match && match[2] ? parseFloat(match[2]) : (c.type === 'ST1' ? 30 : c.type === 'ST2' ? 30 : (c.type === 'TE' || c.type === 'QA') ? 40 : 25);
      const virtualId = c.type === 'ST1' ? 'st1' : c.type === 'ST2' ? 'st2' : (c.type === 'TE' || c.type === 'QA') ? 'te' : c.id;
      return {
        id: virtualId,
        columnId: c.id,
        label: cleanLabel,
        max: c.max_score,
        weight,
        type: c.type,
      };
    });

    const fallbackExamItems = examItems.length > 0 ? examItems : [
      { id: 'st1', label: 'ST 1', max: st1Max, weight: 30 },
      { id: 'st2', label: 'ST 2', max: st2Max, weight: 30 },
      { id: 'te',  label: 'TE',   max: teMax,  weight: 40 },
    ];

    const grades: any = {};
    for (const e of entries) {
      if (!grades[e.enrollment_id]) grades[e.enrollment_id] = {};
      
      const originalCol = cols.find(c => c.id === e.column_id);
      if (originalCol) {
        if (originalCol.type === 'ST1') {
          grades[e.enrollment_id]['st1'] = e.score.toString();
        } else if (originalCol.type === 'ST2') {
          grades[e.enrollment_id]['st2'] = e.score.toString();
        } else if (originalCol.type === 'TE' || originalCol.type === 'QA') {
          grades[e.enrollment_id]['te'] = e.score.toString();
          grades[e.enrollment_id]['qa'] = e.score.toString();
        } else {
          grades[e.enrollment_id][originalCol.id] = e.score.toString();
        }
      }
    }

    // Compute live authoritative results for each student
    const computed: Record<string, any> = {};
    for (const enr of enrollments) {
      const studentGrades = grades[enr.id] || {};
      const wwScores = wwItems.map(item => ({
        id: item.id,
        label: item.label,
        score: parseScore(studentGrades[item.id]),
        maxScore: item.max,
      }));
      const ptScores = ptItems.map(item => ({
        id: item.id,
        label: item.label,
        score: parseScore(studentGrades[item.id]),
        maxScore: item.max,
      }));

      const dynamicExams = fallbackExamItems.map(item => ({
        id: item.id,
        label: item.label,
        score: parseScore(studentGrades[item.id]),
        maxScore: item.max,
        weight: item.weight,
      }));

      const st1Score = parseScore(studentGrades['st1']);
      const st2Score = parseScore(studentGrades['st2']);
      const teScore  = parseScore(studentGrades['te'] ?? studentGrades['qa']);

      const input: StudentTermScoreInput = {
        enrollmentId: enr.id,
        wwScores,
        ptScores,
        dynamicExams,
        st1: { score: st1Score, maxScore: st1Max },
        st2: { score: st2Score, maxScore: st2Max },
        te:  { score: teScore,  maxScore: teMax },
      };

      const calc = calculateStudentTermGrade(input, policy);
      computed[enr.id] = {
        initialGrade: calc.initialGrade,
        termGrade: calc.termGrade,
        descriptor: getPerformanceDescriptor(calc.termGrade),
        isComplete: calc.isComplete,
        wwResult: calc.wwResult,
        ptResult: calc.ptResult,
        exResult: calc.exResult,
      };
    }
    
    termsData[t] = {
      version: gb.version,
      wwItems,
      ptItems,
      examItems: fallbackExamItems,
      st1Max,
      st2Max,
      teMax,
      qaMax,
      grades,
      computed,
    };
  }

  return {
    terms: termsData,
    roster: rosterData,
    weights: {
      ww: policy.weights.wwWeight * 100,
      pt: policy.weights.ptWeight * 100,
      qa: policy.weights.exWeight * 100,
    }
  };
}

export async function saveLedger(classId: string, terms: any, actorId: string, correlationId?: string) {
  if (!classId || typeof classId !== 'string') {
    throw new AppError(400, 'BAD_REQUEST', 'Missing or invalid classId');
  }
  if (!terms || typeof terms !== 'object') {
    throw new AppError(400, 'BAD_REQUEST', 'Missing or invalid terms');
  }

  return withTransaction(async (tx) => {
    // Row-level authorization check & fetch details
    const assignment = await tx.teacherSubjectAssignment.findUnique({
      where: { id: classId },
      include: {
        section: true,
        teacher: true,
        subject: true,
        academic_year: true,
      }
    });

    if (!assignment) {
      throw new AppError(404, 'NOT_FOUND', 'Class assignment not found');
    }

    if (assignment.teacher.user_id !== actorId) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to modify this class gradebook');
    }

    // Resolve grading policy for calculation
    const subjectGroup = resolveSubjectGroup(assignment.subject?.code, assignment.subject?.name);
    let policy: any;
    try {
      policy = getGradingPolicy({
        schoolYear: assignment.academic_year?.name || 'SY 2026-2027',
        gradeLevel: assignment.section?.grade_level || 7,
        subjectGroup,
      });
    } catch {
      policy = getGradingPolicy({
        schoolYear: 'SY 2026-2027',
        gradeLevel: 7,
        subjectGroup: 'CORE',
      });
    }

    const activeEnrollments = await tx.enrollment.findMany({
      where: { section_id: assignment.section_id, status: 'Enrolled' },
    });

    for (const t of ['T1', 'T2', 'T3', 'T4']) {
      const rawTermData = terms[t];
      if (!rawTermData) continue;

      // Validate termData structure
      const termData = ledgerTermSchema.parse(rawTermData);

      // Validate duplicate column IDs within the same term
      const seenColIds = new Set<string>();
      for (const item of [...termData.wwItems, ...termData.ptItems]) {
        if (seenColIds.has(item.id)) {
          throw new AppError(422, 'VALIDATION_ERROR', `Duplicate column ID '${item.id}' in gradebook payload`);
        }
        seenColIds.add(item.id);
      }
      
      let gb = await tx.gradebooks.findFirst({
        where: { assignment_id: classId, term: { key: t as any } }
      });
      
      if (!gb) {
        // Find the term_id for this assignment
        const termRecord = await tx.term.findFirst({
          where: { key: t as any, academic_year_id: assignment.academic_year_id }
        });
        if (!termRecord) throw new AppError(404, 'NOT_FOUND', 'Term not found');

        gb = await tx.gradebooks.create({
          data: {
            id: generateId(),
            assignment_id: classId,
            term_id: termRecord.id,
            version: 1,
            updated_at: new Date()
          }
        });
      } else {
        // Optimistic concurrency check: If version is provided, verify it matches
        if (termData.version !== undefined && gb.version !== termData.version) {
          throw new AppError(409, 'CONFLICT', `Gradebook version mismatch. Current version is ${gb.version}, but payload version was ${termData.version}.`);
        }

        // Increment version and take row lock
        gb = await tx.gradebooks.update({
          where: { id: gb.id },
          data: {
            version: { increment: 1 },
            updated_at: new Date()
          }
        });
      }

      // Fetch existing columns and entries for this gradebook
      const existingCols = await tx.gradebook_columns.findMany({
        where: { gradebook_id: gb.id },
        include: { entries: true }
      });

      // Validate against cross-gradebook column references
      for (const item of [...termData.wwItems, ...termData.ptItems]) {
        const belongsToCurrentGb = existingCols.some((c: any) => c.id === item.id);
        if (!belongsToCurrentGb) {
          const foreignCol = await tx.gradebook_columns.findFirst({
            where: { id: item.id, gradebook_id: { not: gb.id } }
          });
          if (foreignCol) {
            throw new AppError(403, 'FORBIDDEN', `Column '${item.id}' belongs to another gradebook`);
          }
        }
      }

      let sort = 0;
      const colIdMap: Record<string, string> = {};
      const targetColIds = new Set<string>();

      // 1. Process WW columns
      for (const item of termData.wwItems) {
        const existingCol = existingCols.find((c: any) => c.id === item.id && c.type === 'WW');
        let colId = item.id;
        if (existingCol) {
          await tx.gradebook_columns.update({
            where: { id: existingCol.id },
            data: {
              label: item.label,
              max_score: item.max,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
          colId = existingCol.id;
        } else {
          const idExists = item.id ? await tx.gradebook_columns.findUnique({ where: { id: item.id } }) : null;
          if (idExists || !item.id) {
            colId = generateId();
          }
          await tx.gradebook_columns.create({
            data: {
              id: colId,
              gradebook_id: gb.id,
              type: 'WW',
              label: item.label,
              max_score: item.max,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
        }
        colIdMap[item.id] = colId;
        targetColIds.add(colId);
      }

      // 2. Process PT columns
      for (const item of termData.ptItems) {
        const existingCol = existingCols.find((c: any) => c.id === item.id && c.type === 'PT');
        let colId = item.id;
        if (existingCol) {
          await tx.gradebook_columns.update({
            where: { id: existingCol.id },
            data: {
              label: item.label,
              max_score: item.max,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
          colId = existingCol.id;
        } else {
          const idExists = item.id ? await tx.gradebook_columns.findUnique({ where: { id: item.id } }) : null;
          if (idExists || !item.id) {
            colId = generateId();
          }
          await tx.gradebook_columns.create({
            data: {
              id: colId,
              gradebook_id: gb.id,
              type: 'PT',
              label: item.label,
              max_score: item.max,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
        }
        colIdMap[item.id] = colId;
        targetColIds.add(colId);
      }

      const hasDynamicExams = termData.examItems && termData.examItems.length > 0;
      const hasExamBreakdown = termData.st1Max !== undefined || termData.st2Max !== undefined ||
        Object.values(termData.grades || {}).some((g: any) => g && (g.st1 !== undefined || g.st2 !== undefined));

      let st1Max = termData.st1Max || 25;
      let st2Max = termData.st2Max || 25;
      let teMax = termData.teMax || termData.qaMax || 50;

      if (hasDynamicExams) {
        for (const item of termData.examItems!) {
          let existingCol: any;
          if (item.id === 'st1') {
            existingCol = existingCols.find((c: any) => c.type === 'ST1');
          } else if (item.id === 'st2') {
            existingCol = existingCols.find((c: any) => c.type === 'ST2');
          } else if (item.id === 'te' || item.id === 'qa') {
            existingCol = existingCols.find((c: any) => c.type === 'TE' || c.type === 'QA');
          } else {
            existingCol = existingCols.find((c: any) => c.id === item.id);
          }

          const colType = item.id === 'st1' ? 'ST1' : item.id === 'st2' ? 'ST2' : (item.id === 'te' || item.id === 'qa') ? 'TE' : 'EX';
          const formattedLabel = `${item.label} [${item.weight}%]`;

          let colId = item.id;
          if (existingCol) {
            colId = existingCol.id;
            await tx.gradebook_columns.update({
              where: { id: existingCol.id },
              data: {
                type: colType,
                label: formattedLabel,
                max_score: item.max,
                sort_order: sort++,
                updated_at: new Date()
              }
            });
          } else {
            const idExists = item.id && !['st1', 'st2', 'te', 'qa'].includes(item.id)
              ? await tx.gradebook_columns.findUnique({ where: { id: item.id } })
              : null;
            colId = (idExists || !item.id || ['st1', 'st2', 'te', 'qa'].includes(item.id)) ? generateId() : item.id;

            await tx.gradebook_columns.create({
              data: {
                id: colId,
                gradebook_id: gb.id,
                type: colType,
                label: formattedLabel,
                max_score: item.max,
                sort_order: sort++,
                updated_at: new Date()
              }
            });
          }
          colIdMap[item.id] = colId;
          targetColIds.add(colId);
          if (item.id === 'te') {
            colIdMap['qa'] = colId;
          }
        }
      } else if (hasExamBreakdown) {
        // 3. Process ST1 column
        const existingST1 = existingCols.find((c: any) => c.type === 'ST1');
        let st1ColId: string;
        if (existingST1) {
          st1ColId = existingST1.id;
          await tx.gradebook_columns.update({
            where: { id: existingST1.id },
            data: {
              label: 'Short Test 1',
              max_score: st1Max,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
        } else {
          st1ColId = generateId();
          await tx.gradebook_columns.create({
            data: {
              id: st1ColId,
              gradebook_id: gb.id,
              type: 'ST1',
              label: 'Short Test 1',
              max_score: st1Max,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
        }
        colIdMap['st1'] = st1ColId;
        targetColIds.add(st1ColId);

        // 4. Process ST2 column
        const existingST2 = existingCols.find((c: any) => c.type === 'ST2');
        let st2ColId: string;
        if (existingST2) {
          st2ColId = existingST2.id;
          await tx.gradebook_columns.update({
            where: { id: existingST2.id },
            data: {
              label: 'Short Test 2',
              max_score: st2Max,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
        } else {
          st2ColId = generateId();
          await tx.gradebook_columns.create({
            data: {
              id: st2ColId,
              gradebook_id: gb.id,
              type: 'ST2',
              label: 'Short Test 2',
              max_score: st2Max,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
        }
        colIdMap['st2'] = st2ColId;
        targetColIds.add(st2ColId);

        // 5. Process TE column
        const existingTE = existingCols.find((c: any) => c.type === 'TE' || c.type === 'QA');
        let teColId: string;
        if (existingTE) {
          teColId = existingTE.id;
          await tx.gradebook_columns.update({
            where: { id: existingTE.id },
            data: {
              type: 'TE',
              label: 'Term Exam',
              max_score: teMax,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
        } else {
          teColId = generateId();
          await tx.gradebook_columns.create({
            data: {
              id: teColId,
              gradebook_id: gb.id,
              type: 'TE',
              label: 'Term Exam',
              max_score: teMax,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
        }
        colIdMap['te'] = teColId;
        colIdMap['qa'] = teColId;
        targetColIds.add(teColId);
      } else {
        // Legacy single assessment column (QA)
        const existingQA = existingCols.find((c: any) => c.type === 'QA' || c.type === 'TE');
        let qaColId: string;
        const qaMax = termData.qaMax || termData.teMax || 100;
        teMax = qaMax;
        if (existingQA) {
          qaColId = existingQA.id;
          await tx.gradebook_columns.update({
            where: { id: existingQA.id },
            data: {
              type: 'QA',
              label: 'Quarterly Assessment',
              max_score: qaMax,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
        } else {
          qaColId = generateId();
          await tx.gradebook_columns.create({
            data: {
              id: qaColId,
              gradebook_id: gb.id,
              type: 'QA',
              label: 'Quarterly Assessment',
              max_score: qaMax,
              sort_order: sort++,
              updated_at: new Date()
            }
          });
        }
        colIdMap['qa'] = qaColId;
        colIdMap['te'] = qaColId;
        targetColIds.add(qaColId);
      }

      // 6. Safely handle intentionally deleted columns with DATA LOSS PROTECTION
      const omittedCols = existingCols.filter((c: any) => !targetColIds.has(c.id));
      const explicitDeletedSet = new Set(termData.deletedColumnIds || []);

      for (const col of omittedCols) {
        const hasEntries = col.entries.length > 0;
        const isExplicitlyDeleted = explicitDeletedSet.has(col.id);

        if (hasEntries && !isExplicitlyDeleted) {
          // DATA LOSS PROTECTION: Column has recorded scores and was not explicitly requested for deletion.
          targetColIds.add(col.id);
          colIdMap[col.id] = col.id;
          continue;
        }

        await tx.grade_entries.deleteMany({ where: { column_id: col.id } });
        await tx.gradebook_columns.delete({ where: { id: col.id } });
      }

      // 7. Upsert grade entries
      if (termData.grades && typeof termData.grades === 'object') {
        const activeColIds = Array.from(targetColIds);
        const currentEntries = await tx.grade_entries.findMany({
          where: { column_id: { in: activeColIds }, is_superseded: false }
        });

        for (const sid of Object.keys(termData.grades)) {
          const studentGrades = termData.grades[sid];
          if (!studentGrades || typeof studentGrades !== 'object') continue;

          for (const oldColId of Object.keys(studentGrades)) {
            const mappedColId = colIdMap[oldColId];
            if (!mappedColId) continue;

            const rawVal = studentGrades[oldColId];
            const existingEntry = currentEntries.find(
              (e: any) => e.column_id === mappedColId && e.enrollment_id === sid
            );

            // Cleared/empty score cell
            if (rawVal === null || rawVal === undefined || rawVal === '') {
              if (existingEntry) {
                await tx.grade_entries.delete({ where: { id: existingEntry.id } });
              }
              continue;
            }

            const score = parseFloat(rawVal);
            if (isNaN(score)) continue;

            if (existingEntry) {
              if (existingEntry.score !== score) {
                await tx.grade_entries.update({
                  where: { id: existingEntry.id },
                  data: {
                    score,
                    created_by: actorId
                  }
                });
              }
            } else {
              await tx.grade_entries.create({
                data: {
                  id: generateId(),
                  column_id: mappedColId,
                  enrollment_id: sid,
                  score,
                  created_by: actorId
                }
              });
            }
          }
        }
      }

      // 8. Authoritative Calculation and Sync to official Grade table
      for (const enr of activeEnrollments) {
        const studentGrades = termData.grades?.[enr.id] ?? {};

        const wwScores = termData.wwItems.map(item => ({
          id: item.id,
          label: item.label,
          score: parseScore(studentGrades[item.id]),
          maxScore: item.max,
        }));

        const ptScores = termData.ptItems.map(item => ({
          id: item.id,
          label: item.label,
          score: parseScore(studentGrades[item.id]),
          maxScore: item.max,
        }));

        const st1Score = parseScore(studentGrades['st1']);
        const st2Score = parseScore(studentGrades['st2']);
        const teScore  = parseScore(studentGrades['te'] ?? studentGrades['qa']);

        const dynamicExams = (termData.examItems && termData.examItems.length > 0)
          ? termData.examItems.map(item => ({
              id: item.id,
              label: item.label,
              score: parseScore(studentGrades[item.id]),
              maxScore: item.max,
              weight: item.weight,
            }))
          : undefined;

        let effectivePolicy = policy;
        if (termData.customWeights) {
          effectivePolicy = {
            ...policy,
            weights: {
              wwWeight: (termData.customWeights.ww ?? 20) / 100,
              ptWeight: (termData.customWeights.pt ?? 50) / 100,
              exWeight: (termData.customWeights.qa ?? termData.customWeights.ex ?? 30) / 100,
            }
          };
        }

        const input: StudentTermScoreInput = {
          enrollmentId: enr.id,
          wwScores,
          ptScores,
          dynamicExams,
          st1: { score: st1Score, maxScore: st1Max },
          st2: { score: st2Score, maxScore: st2Max },
          te:  { score: teScore,  maxScore: teMax },
        };

        const calc = calculateStudentTermGrade(input, effectivePolicy);

        const existingGrade = await tx.grade.findFirst({
          where: {
            student_id: enr.student_id,
            subject_id: assignment.subject_id,
            term: t as any,
            academic_year_id: assignment.academic_year_id,
          },
        });

        const gradePayload = {
          written_work: calc.wwResult ? roundHalfUp(calc.wwResult.weightedScore, 2) : null,
          performance_task: calc.ptResult ? roundHalfUp(calc.ptResult.weightedScore, 2) : null,
          term_assessment: calc.exResult.weightedScore !== null ? roundHalfUp(calc.exResult.weightedScore, 2) : null,
          term_grade: calc.termGrade, // integer 60-100 or null if incomplete
        };

        if (existingGrade) {
          await tx.grade.update({
            where: { id: existingGrade.id },
            data: gradePayload,
          });
        } else if (
          calc.termGrade !== null ||
          calc.wwResult !== null ||
          calc.ptResult !== null ||
          calc.exResult.weightedScore !== null
        ) {
          await tx.grade.create({
            data: {
              id: generateId(),
              student_id: enr.student_id,
              subject_id: assignment.subject_id,
              term: t as any,
              academic_year_id: assignment.academic_year_id,
              ...gradePayload,
            },
          });
        }
      }
    }

    await createAuditLog({
      actorUserId: actorId,
      action: 'GRADEBOOK_LEDGER_SAVED',
      resourceType: 'gradebook_ledger',
      resourceId: classId,
      correlationId,
    }, tx);
  });
}
