import prisma from '../../config/database.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { generateId } from '../../common/utils/uuid.js';
import { createAuditLog } from '../../audit/audit.service.js';

export const BehaviorService = {
  async getBehaviorLogs() {
    const rawRecords = await prisma.behaviorLog.findMany({
      include: { reporter: true, student: { include: { user: true } } },
      orderBy: { date: 'desc' },
      take: 100
    });
    
    return rawRecords.map(r => ({
      ...r,
      reporter_name: r.reporter ? `${r.reporter.first_name} ${r.reporter.last_name}` : r.reported_by,
      studentName: r.student ? `${r.student.user.first_name} ${r.student.user.last_name}` : r.student_id
    }));
  },

  async getBehaviorLogsByStudentId(studentId: string) {
    const rawRecords = await prisma.behaviorLog.findMany({
      where: { student_id: studentId },
      include: { reporter: true },
      orderBy: { date: 'desc' }
    });
    
    return rawRecords.map(r => ({
      ...r,
      reporter_name: r.reporter ? `${r.reporter.first_name} ${r.reporter.last_name}` : r.reported_by
    }));
  },

  async getBehaviorSummary() {
    const [total, distinctStudentsGroup, statusGroups] = await Promise.all([
      prisma.behaviorLog.count(),
      prisma.behaviorLog.groupBy({ by: ['student_id'] }),
      prisma.behaviorLog.groupBy({ by: ['status'], _count: { id: true } })
    ]);

    const statusCounts: Record<string, number> = {};
    for (const sg of statusGroups) {
      statusCounts[sg.status] = sg._count.id;
    }

    return {
      total,
      studentsCount: distinctStudentsGroup.length,
      statusCounts,
      reported: statusCounts['Reported'] || 0,
      underInvestigation: statusCounts['Under investigation'] || 0,
      parentNotified: statusCounts['Parent notified'] || 0,
      resolved: statusCounts['Resolved'] || 0
    };
  },

  async createBehaviorLog(input: any, actorId: string, correlationId?: string) {
    const record = await prisma.behaviorLog.create({
      data: {
        id: generateId(),
        student_id: input.studentId,
        type: input.type,
        date: new Date(input.date),
        status: input.status || 'Reported',
        note: input.note,
        reported_by: actorId
      }
    });

    await createAuditLog({
      actorUserId: actorId,
      action: 'BEHAVIOR_LOG_CREATED',
      resourceType: 'behavior_log',
      resourceId: record.id,
      newState: { studentId: input.studentId, type: input.type },
      correlationId,
    });

    return record;
  },

  async updateBehaviorLogStatus(recordId: string, status: string, authUserId: string, roles: string[]) {
    const existing = await prisma.behaviorLog.findUnique({ where: { id: recordId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Behavior log not found.');

    const isGlobalViewer = roles.some(r => ['Admin', 'Principal'].includes(r));
    if (!isGlobalViewer && existing.reported_by !== authUserId) {
       throw new AppError(403, 'FORBIDDEN', 'You can only update your own reports.');
    }

    const record = await prisma.behaviorLog.update({
      where: { id: recordId },
      data: { status }
    });

    return record;
  }
};
