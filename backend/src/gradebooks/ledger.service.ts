import { z } from 'zod';
import prisma, { withTransaction } from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';

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
  qaMax: z.number().positive().max(1000).optional().default(100),
  grades: z.record(z.string(), z.record(z.string(), z.string())).optional().default({}),
  deletedColumnIds: z.array(z.string()).optional().default([]),
});

export const ledgerSchema = z.object({
  classId: z.string().min(1),
  terms: z.record(z.enum(['T1','T2','T3','T4']), ledgerTermSchema)
});

export async function getLedger(classId: string, actorId: string) {
  const termsData: any = {};
  
  for (const t of ['T1', 'T2', 'T3', 'T4']) {
    const gb = await prisma.gradebooks.findFirst({
      where: { assignment_id: classId, term: { key: t as any } }
    });
    if (!gb) {
      termsData[t] = { version: 1, wwItems: [], ptItems: [], qaMax: 100, grades: {} };
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
    let qaMax = cols.find(c => c.type === 'QA')?.max_score || 100;

    const grades: any = {};
    for (const e of entries) {
      if (!grades[e.enrollment_id]) grades[e.enrollment_id] = {};
      
      const originalCol = cols.find(c => c.id === e.column_id);
      if (originalCol) {
        grades[e.enrollment_id][originalCol.type === 'QA' ? 'qa' : originalCol.id] = e.score.toString();
      }
    }
    
    termsData[t] = { version: gb.version, wwItems, ptItems, qaMax, grades };
  }

  // Fetch the roster (enrollments for the section) and check authorization
  const assignment = await prisma.teacherSubjectAssignment.findUnique({
    where: { id: classId },
    include: { section: true, teacher: true }
  });

  if (!assignment) {
    throw new AppError(404, 'NOT_FOUND', 'Class assignment not found');
  }

  // Row-level authorization check: Verify the requesting user owns this assignment
  if (assignment.teacher.user_id !== actorId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this class gradebook');
  }

  let rosterData: any[] = [];
  if (assignment && assignment.section_id) {
    const enrollments = await prisma.enrollment.findMany({
      where: { section_id: assignment.section_id, status: 'Enrolled' },
      include: { student: { include: { user: true } } },
      orderBy: { student: { user: { last_name: 'asc' } } }
    });

    rosterData = enrollments.map(e => ({
      id: e.id,
      surname: e.student.user.last_name,
      first: e.student.user.first_name
    }));
  }

  return { terms: termsData, roster: rosterData };
}

export async function saveLedger(classId: string, terms: any, actorId: string, correlationId?: string) {
  if (!classId || typeof classId !== 'string') {
    throw new AppError(400, 'BAD_REQUEST', 'Missing or invalid classId');
  }
  if (!terms || typeof terms !== 'object') {
    throw new AppError(400, 'BAD_REQUEST', 'Missing or invalid terms');
  }

  return withTransaction(async (tx) => {
    // Row-level authorization check
    const assignment = await tx.teacherSubjectAssignment.findUnique({
      where: { id: classId },
      include: { section: true, teacher: true }
    });

    if (!assignment) {
      throw new AppError(404, 'NOT_FOUND', 'Class assignment not found');
    }

    if (assignment.teacher.user_id !== actorId) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to modify this class gradebook');
    }

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

      // 3. Process QA column
      const existingQA = existingCols.find((c: any) => c.type === 'QA');
      let qaColId: string;
      if (existingQA) {
        qaColId = existingQA.id;
        await tx.gradebook_columns.update({
          where: { id: existingQA.id },
          data: {
            label: 'Term Assessment',
            max_score: termData.qaMax || 100,
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
            label: 'Term Assessment',
            max_score: termData.qaMax || 100,
            sort_order: sort++,
            updated_at: new Date()
          }
        });
      }
      colIdMap['qa'] = qaColId;
      targetColIds.add(qaColId);

      // 4. Safely handle intentionally deleted columns with DATA LOSS PROTECTION
      const omittedCols = existingCols.filter((c: any) => !targetColIds.has(c.id));
      const explicitDeletedSet = new Set(termData.deletedColumnIds || []);

      for (const col of omittedCols) {
        const hasEntries = col.entries.length > 0;
        const isExplicitlyDeleted = explicitDeletedSet.has(col.id);

        if (hasEntries && !isExplicitlyDeleted) {
          // DATA LOSS PROTECTION: Column has recorded scores and was not explicitly requested for deletion.
          // Retain column and its scores!
          targetColIds.add(col.id);
          colIdMap[col.id] = col.id;
          continue;
        }

        await tx.grade_entries.deleteMany({ where: { column_id: col.id } });
        await tx.gradebook_columns.delete({ where: { id: col.id } });
      }

      // 5. Upsert grade entries
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
