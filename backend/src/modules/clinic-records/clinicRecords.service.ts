import prisma from '../../config/database.js';
import { generateId } from '../../common/utils/uuid.js';
import { createAuditLog } from '../../audit/audit.service.js';
import { AppError } from '../../common/middleware/errorHandler.js';

export const parseTime = (timeStr?: string) => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  const hh = parts[0].padStart(2, '0');
  const mm = parts[1].padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  return new Date(`1970-01-01T${hh}:${mm}:${ss}.000Z`);
};

export class ClinicRecordsService {
  static async getRecentRecords() {
    const rawRecords = await prisma.clinicReferral.findMany({
      include: {
        recorder: true,
      },
      orderBy: { date: 'desc' },
      take: 100
    });
    
    return rawRecords.map(r => ({
      ...r,
      studentId: r.student_id,
      date: typeof r.date === 'string' ? r.date : (r.date as Date).toISOString().split('T')[0],
      time: r.time ? (typeof r.time === 'string' ? r.time : (r.time as Date).toISOString().split('T')[1].substring(0,5)) : '',
      recorded_by: r.recorder ? `${r.recorder.first_name} ${r.recorder.last_name}` : r.recorded_by
    }));
  }

  static async getRecordsForStudent(studentId: string, userId: string, userRoles: string[]) {
    // Defense-in-depth: If the user is a Student, they MUST only be able to request their own ID.
    if (userRoles.includes('Student')) {
      const studentProfile = await prisma.student.findUnique({ where: { user_id: userId } });
      if (!studentProfile || studentProfile.id !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own clinic records.');
      }
    }

    const rawRecords = await prisma.clinicReferral.findMany({
      where: { student_id: studentId },
      include: {
        recorder: true,
      },
      orderBy: { date: 'desc' }
    });
    
    return rawRecords.map(r => ({
      ...r,
      studentId: r.student_id,
      date: typeof r.date === 'string' ? r.date : (r.date as Date).toISOString().split('T')[0],
      time: r.time ? (typeof r.time === 'string' ? r.time : (r.time as Date).toISOString().split('T')[1].substring(0,5)) : '',
      recorded_by: r.recorder ? `${r.recorder.first_name} ${r.recorder.last_name}` : r.recorded_by
    }));
  }

  static async createRecord(data: any, actorId: string, correlationId?: string) {
    const record = await prisma.clinicReferral.create({
      data: {
        id: generateId(),
        student_id: data.studentId,
        date: new Date(data.date),
        time: parseTime(data.time),
        symptoms: data.symptoms,
        diagnosis: data.diagnosis,
        medications: data.medications,
        treatments: data.treatments,
        notes: data.notes,
        temperature: data.temperature,
        blood_pressure: data.bloodPressure,
        heart_rate: data.heartRate,
        recorded_by: actorId,
      }
    });

    await createAuditLog({
      actorUserId: actorId,
      action: 'CLINIC_RECORD_CREATED',
      resourceType: 'clinic_record',
      resourceId: record.id,
      newState: { studentId: data.studentId },
      correlationId,
    });

    return record;
  }
}
