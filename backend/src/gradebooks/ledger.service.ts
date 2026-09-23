import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';

export const ledgerSchema = z.object({
  classId: z.string(),
  terms: z.record(z.enum(['T1','T2','T3','T4']), z.object({
    wwItems: z.array(z.object({ id: z.string(), label: z.string(), max: z.number() })),
    ptItems: z.array(z.object({ id: z.string(), label: z.string(), max: z.number() })),
    qaMax: z.number(),
    grades: z.record(z.string(), z.record(z.string(), z.string()))
  }))
});

export async function getLedger(classId: string, actorId: string) {
  const termsData: any = {};
  
  for (const t of ['T1', 'T2', 'T3', 'T4']) {
    const gb = await prisma.gradebooks.findFirst({
      where: { assignment_id: classId, term: { key: t as any } }
    });
    if (!gb) {
      termsData[t] = { wwItems: [], ptItems: [], qaMax: 100, grades: {} };
      continue;
    }
    
    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook_id: gb.id },
      orderBy: { sort_order: 'asc' }
    });
    
    const entries = await prisma.grade_entries.findMany({
      where: { column_id: { in: cols.map(c => c.id) } }
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
    
    termsData[t] = { wwItems, ptItems, qaMax, grades };
  }

  // Fetch the roster (enrollments for the section) and check authorization
  const assignment = await prisma.teacherSubjectAssignment.findUnique({
    where: { id: classId },
    include: { section: true }
  });

  if (!assignment) {
    throw new AppError(404, 'NOT_FOUND', 'Class assignment not found');
  }

  // Row-level authorization check: Verify the requesting user owns this assignment
  // TODO: Principal/Admin/Registrar gradebook read access is not yet
  // implemented. This will need to extend the authorization check when
  // Principal Portal work begins. Currently ONLY the assigned teacher
  // can view this gradebook.
  if (assignment.teacher_id !== actorId) {
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
  // Row-level authorization check
  const assignment = await prisma.teacherSubjectAssignment.findUnique({
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
    const termData = terms[t];
    if (!termData) continue;
    
    let gb = await prisma.gradebooks.findFirst({
      where: { assignment_id: classId, term: { key: t as any } }
    });
    
    if (!gb) {
      // Find the term_id for this assignment
      const assignment = await prisma.teacherSubjectAssignment.findUnique({
        where: { id: classId },
        select: { academic_year_id: true }
      });
      if (!assignment) throw new AppError(404, 'NOT_FOUND', 'Assignment not found');
      const termRecord = await prisma.term.findFirst({
        where: { key: t as any, academic_year_id: assignment.academic_year_id }
      });
      if (!termRecord) throw new AppError(404, 'NOT_FOUND', 'Term not found');

      gb = await prisma.gradebooks.create({
        data: {
          id: generateId(),
          assignment_id: classId,
          term_id: termRecord.id,
          updated_at: new Date()
        }
      });
    }

    await prisma.gradebook_columns.deleteMany({ where: { gradebook_id: gb.id } });
    
    let sort = 0;
    const colIdMap: Record<string, string> = {};
    
    for (const item of termData.wwItems) {
      const nid = item.id;
      colIdMap[item.id] = nid;
      await prisma.gradebook_columns.create({
        data: { id: nid, gradebook_id: gb.id, type: 'WW', label: item.label, max_score: item.max, sort_order: sort++, updated_at: new Date() }
      });
    }
    
    for (const item of termData.ptItems) {
      const nid = item.id;
      colIdMap[item.id] = nid;
      await prisma.gradebook_columns.create({
        data: { id: nid, gradebook_id: gb.id, type: 'PT', label: item.label, max_score: item.max, sort_order: sort++, updated_at: new Date() }
      });
    }

    const qaNid = 'qa-' + gb.id;
    colIdMap['qa'] = qaNid;
    await prisma.gradebook_columns.create({
      data: { id: qaNid, gradebook_id: gb.id, type: 'QA', label: 'Term Assessment', max_score: termData.qaMax || 100, sort_order: sort++, updated_at: new Date() }
    });

    for (const sid of Object.keys(termData.grades)) {
      const studentGrades = termData.grades[sid];
      for (const oldColId of Object.keys(studentGrades)) {
        const score = parseFloat(studentGrades[oldColId]);
        if (isNaN(score)) continue;
        const mappedColId = colIdMap[oldColId];
        if (!mappedColId) continue;
        
        await prisma.grade_entries.create({
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

  await createAuditLog({
    actorUserId: actorId,
    action: 'GRADEBOOK_LEDGER_SAVED',
    resourceType: 'gradebook_ledger',
    resourceId: classId,
    correlationId,
  });
}
