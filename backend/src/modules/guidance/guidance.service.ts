import prisma from '../../config/database.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { generateId } from '../../common/utils/uuid.js';
import { createAuditLog } from '../../audit/audit.service.js';

export const GuidanceService = {
  async getGuidanceRecords() {
    const rawRecords = await prisma.guidanceRecord.findMany({
      include: { counselor: true, student: { include: { user: true } } },
      orderBy: { date: 'desc' },
      take: 100
    });
    return rawRecords.map(r => ({
      ...r,
      counselor_name: r.counselor ? `${r.counselor.first_name} ${r.counselor.last_name}` : r.counselor_id,
      studentName: r.student ? `${r.student.user.first_name} ${r.student.user.last_name}` : r.student_id
    }));
  },

  async getGuidanceRecordsByStudentId(studentId: string) {
    const rawRecords = await prisma.guidanceRecord.findMany({
      where: { student_id: studentId },
      include: { counselor: true },
      orderBy: { date: 'desc' }
    });
    return rawRecords.map(r => ({
      ...r,
      counselor_name: r.counselor ? `${r.counselor.first_name} ${r.counselor.last_name}` : r.counselor_id
    }));
  },

  async createGuidanceRecord(input: any, actorId: string, correlationId?: string) {
    const record = await prisma.guidanceRecord.create({
      data: {
        id: generateId(),
        student_id: input.studentId,
        counselor_id: actorId,
        date: new Date(input.date),
        type: input.type,
        reason: input.reason,
        notes: input.notes,
        action_taken: input.actionTaken,
        follow_up_date: input.followUpDate ? new Date(input.followUpDate) : null,
        status: input.status || 'Open'
      }
    });

    await createAuditLog({
      actorUserId: actorId,
      action: 'GUIDANCE_RECORD_CREATED',
      resourceType: 'guidance_record',
      resourceId: record.id,
      newState: { studentId: input.studentId, type: input.type },
      correlationId,
    });

    return record;
  },

  async updateGuidanceRecordStatus(recordId: string, status: string, authUserId: string, roles: string[], correlationId?: string) {
    const existing = await prisma.guidanceRecord.findUnique({ where: { id: recordId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Guidance record not found.');

    const isGlobalViewer = roles.some(r => ['Admin', 'Principal'].includes(r));
    if (!isGlobalViewer && existing.counselor_id !== authUserId) {
       throw new AppError(403, 'FORBIDDEN', 'You can only update your own records.');
    }

    const record = await prisma.guidanceRecord.update({
      where: { id: recordId },
      data: { status }
    });

    await createAuditLog({
      actorUserId: authUserId,
      action: 'GUIDANCE_RECORD_UPDATED',
      resourceType: 'guidance_record',
      resourceId: record.id,
      previousState: { status: existing.status },
      newState: { status: record.status },
      correlationId,
    });

    return record;
  }
};
