import prisma from '../../config/database.js';
import { generateId } from '../../common/utils/uuid.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { createAuditLog } from '../../audit/audit.service.js';
import { getPhilippineCalendarDate, parseCalendarDate, formatManilaTime } from '../../common/utils/dateTime.js';
import { AdminCorrectionInput, QueryFacultyAttendanceInput, FacultyAttendanceStatus } from './facultyAttendance.types.js';

export class FacultyAttendanceService {
  /**
   * Resolves the authenticated Teacher profile from a User ID.
   */
  private async resolveTeacher(userId: string) {
    const teacher = await prisma.teacher.findUnique({
      where: { user_id: userId },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new AppError(403, 'TEACHER_PROFILE_NOT_FOUND', 'Authenticated account does not have an active teacher profile.');
    }

    if (teacher.user.status !== 'active') {
      throw new AppError(403, 'ACCOUNT_INACTIVE', 'Teacher account is not active.');
    }

    return teacher;
  }

  /**
   * Records Teacher self-service Time In for today (Asia/Manila).
   */
  async recordTimeIn(userId: string, remarks?: string) {
    const teacher = await this.resolveTeacher(userId);
    const { dateStr, dateObj } = getPhilippineCalendarDate();

    // Check for existing record
    const existing = await prisma.facultyAttendance.findUnique({
      where: {
        teacher_id_date: {
          teacher_id: teacher.id,
          date: dateObj,
        },
      },
    });

    if (existing && existing.time_in) {
      throw new AppError(409, 'ALREADY_TIMED_IN', 'Time In has already been recorded for today.');
    }

    const now = new Date();

    try {
      let record;
      if (existing) {
        record = await prisma.facultyAttendance.update({
          where: { id: existing.id },
          data: {
            time_in: now,
            capture_source: 'web_teacher',
            override_remarks: remarks || existing.override_remarks,
          },
        });
      } else {
        record = await prisma.facultyAttendance.create({
          data: {
            id: generateId(),
            teacher_id: teacher.id,
            date: dateObj,
            time_in: now,
            capture_source: 'web_teacher',
            override_remarks: remarks || null,
          },
        });
      }

      return {
        ...record,
        date: dateStr,
        timeInFormatted: formatManilaTime(record.time_in),
        timeOutFormatted: formatManilaTime(record.time_out),
        status: (record.time_out ? 'Completed' : 'Time Out Pending') as FacultyAttendanceStatus,
      };
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new AppError(409, 'ALREADY_TIMED_IN', 'Time In has already been recorded for today.');
      }
      throw err;
    }
  }

  /**
   * Records Teacher self-service Time Out for today (Asia/Manila).
   */
  async recordTimeOut(userId: string, remarks?: string) {
    const teacher = await this.resolveTeacher(userId);
    const { dateStr, dateObj } = getPhilippineCalendarDate();

    const existing = await prisma.facultyAttendance.findUnique({
      where: {
        teacher_id_date: {
          teacher_id: teacher.id,
          date: dateObj,
        },
      },
    });

    if (!existing || !existing.time_in) {
      throw new AppError(400, 'TIME_IN_REQUIRED', 'Cannot record Time Out before recording Time In.');
    }

    if (existing.time_out) {
      throw new AppError(409, 'ALREADY_TIMED_OUT', 'Time Out has already been recorded for today.');
    }

    const now = new Date();

    // Atomic conditional update to prevent parallel Time Out race conditions
    const updateResult = await prisma.facultyAttendance.updateMany({
      where: {
        teacher_id: teacher.id,
        date: dateObj,
        time_out: null, // Atomic condition
      },
      data: {
        time_out: now,
        override_remarks: remarks || existing.override_remarks,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError(409, 'ALREADY_TIMED_OUT', 'Time Out has already been recorded for today.');
    }

    const updated = await prisma.facultyAttendance.findUnique({
      where: { id: existing.id },
    });

    return {
      ...updated,
      date: dateStr,
      timeInFormatted: formatManilaTime(updated?.time_in),
      timeOutFormatted: formatManilaTime(updated?.time_out),
      status: 'Completed' as FacultyAttendanceStatus,
    };
  }

  /**
   * Fetches today's attendance punch card status for the authenticated teacher.
   */
  async getTeacherStatusToday(userId: string, queryDateStr?: string) {
    const teacher = await this.resolveTeacher(userId);
    const { dateStr, dateObj } = queryDateStr ? { dateStr: queryDateStr, dateObj: parseCalendarDate(queryDateStr) } : getPhilippineCalendarDate();

    const record = await prisma.facultyAttendance.findUnique({
      where: {
        teacher_id_date: {
          teacher_id: teacher.id,
          date: dateObj,
        },
      },
    });

    // Check approved leave
    const startOfDay = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999));

    const approvedLeave = await prisma.leaveRequest.findFirst({
      where: {
        user_id: teacher.user_id,
        status: 'Approved',
        start_date: { lte: endOfDay },
        end_date: { gte: startOfDay },
      },
    });

    let status: FacultyAttendanceStatus = 'Not Checked In';
    if (record?.override_status) {
      status = record.override_status as FacultyAttendanceStatus;
    } else if (record?.time_in) {
      status = record.time_out ? 'Completed' : 'Time Out Pending';
    } else if (approvedLeave) {
      status = 'On Leave';
    }

    return {
      date: dateStr,
      teacherId: teacher.id,
      name: `${teacher.user.first_name} ${teacher.user.last_name}`,
      employeeId: teacher.employee_id,
      department: teacher.department,
      status,
      hasTimedIn: !!record?.time_in,
      hasTimedOut: !!record?.time_out,
      timeIn: record?.time_in ? record.time_in.toISOString() : null,
      timeOut: record?.time_out ? record.time_out.toISOString() : null,
      timeInFormatted: formatManilaTime(record?.time_in),
      timeOutFormatted: formatManilaTime(record?.time_out),
      leaveType: approvedLeave ? approvedLeave.type : null,
      remarks: record?.override_remarks || null,
    };
  }

  /**
   * Compiles executive faculty attendance summary (PRIN-003).
   */
  async getSummary(queryDateStr?: string) {
    const { dateStr, dateObj } = queryDateStr ? { dateStr: queryDateStr, dateObj: parseCalendarDate(queryDateStr) } : getPhilippineCalendarDate();

    const startOfDay = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999));

    // 1. Fetch all active teachers (the authoritative denominator)
    const activeTeachers = await prisma.teacher.findMany({
      where: {
        user: {
          status: 'active',
        },
      },
      select: {
        id: true,
        user_id: true,
      },
    });

    const totalActiveFaculty = activeTeachers.length;

    // 2. Fetch existing attendance records for the date
    const attendanceRecords = await prisma.facultyAttendance.findMany({
      where: { date: dateObj },
    });
    const recordMap = new Map(attendanceRecords.map(r => [r.teacher_id, r]));

    // 3. Fetch approved leaves covering the date
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'Approved',
        start_date: { lte: endOfDay },
        end_date: { gte: startOfDay },
      },
      select: { user_id: true, type: true },
    });
    const leaveMap = new Map(approvedLeaves.map(l => [l.user_id, l]));

    // 4. Calculate counts following deterministic precedence
    let checkedInCount = 0;
    let completedCount = 0;
    let timeOutPendingCount = 0;
    let onLeaveCount = 0;
    let officialBusinessCount = 0;
    let pendingCheckInCount = 0;

    for (const teacher of activeTeachers) {
      const record = recordMap.get(teacher.id);
      const leave = leaveMap.get(teacher.user_id);

      // Precedence: 1. Override, 2. Actual Attendance, 3. Leave, 4. Pending Check-In
      if (record?.override_status === 'Official Business') {
        officialBusinessCount++;
      } else if (record?.time_in) {
        checkedInCount++;
        if (record.time_out) {
          completedCount++;
        } else {
          timeOutPendingCount++;
        }
      } else if (leave) {
        onLeaveCount++;
      } else {
        pendingCheckInCount++;
      }
    }

    return {
      date: dateStr,
      totalActiveFaculty,
      checkedInCount,
      completedCount,
      timeOutPendingCount,
      onLeaveCount,
      officialBusinessCount,
      pendingCheckInCount,
      policyConfigured: false, // Late/Absent unclassified pre-policy
    };
  }

  /**
   * Compiles full faculty attendance table for all active teachers (PRIN-014).
   */
  async getList(query: QueryFacultyAttendanceInput) {
    const { dateStr, dateObj } = query.date ? { dateStr: query.date, dateObj: parseCalendarDate(query.date) } : getPhilippineCalendarDate();

    const startOfDay = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999));

    // 1. Fetch all active teachers with User profile
    const activeTeachers = await prisma.teacher.findMany({
      where: {
        user: {
          status: 'active',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { user: { last_name: 'asc' } },
        { user: { first_name: 'asc' } },
      ],
    });

    // 2. Fetch attendance records for date
    const attendanceRecords = await prisma.facultyAttendance.findMany({
      where: { date: dateObj },
    });
    const recordMap = new Map(attendanceRecords.map(r => [r.teacher_id, r]));

    // 3. Fetch approved leaves for date
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'Approved',
        start_date: { lte: endOfDay },
        end_date: { gte: startOfDay },
      },
      select: { user_id: true, type: true },
    });
    const leaveMap = new Map(approvedLeaves.map(l => [l.user_id, l]));

    // 4. Merge active teachers into comprehensive table view
    const allRows = activeTeachers.map(teacher => {
      const record = recordMap.get(teacher.id);
      const leave = leaveMap.get(teacher.user_id);

      let status: FacultyAttendanceStatus = 'Not Checked In';
      if (record?.override_status) {
        status = record.override_status as FacultyAttendanceStatus;
      } else if (record?.time_in) {
        status = record.time_out ? 'Completed' : 'Time Out Pending';
      } else if (leave) {
        status = 'On Leave';
      }

      return {
        id: record?.id || null,
        teacherId: teacher.id,
        userId: teacher.user.id,
        name: `${teacher.user.first_name} ${teacher.user.last_name}`,
        employeeId: teacher.employee_id,
        department: teacher.department || 'General Academics',
        position: teacher.position || 'Teacher I',
        date: dateStr,
        timeIn: record?.time_in ? record.time_in.toISOString() : null,
        timeOut: record?.time_out ? record.time_out.toISOString() : null,
        timeInFormatted: formatManilaTime(record?.time_in),
        timeOutFormatted: formatManilaTime(record?.time_out),
        status,
        captureSource: record?.capture_source || null,
        remarks: record?.override_remarks || (leave ? `${leave.type} Leave` : null),
      };
    });

    // 5. Apply in-memory filters (Search, Department, Status)
    let filtered = allRows;

    if (query.department && query.department !== 'All') {
      const deptLower = query.department.toLowerCase();
      filtered = filtered.filter(r => r.department.toLowerCase().includes(deptLower));
    }

    if (query.status && query.status !== 'All') {
      filtered = filtered.filter(r => r.status === query.status);
    }

    if (query.search && query.search.trim().length > 0) {
      const q = query.search.toLowerCase().trim();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      );
    }

    // 6. Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Administrative correction / Official Business override.
   */
  async adminCorrection(id: string, input: AdminCorrectionInput, actorUserId: string, correlationId?: string) {
    const existing = await prisma.facultyAttendance.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Faculty attendance record not found.');
    }

    const previousState = { ...existing };

    const updateData: any = {
      corrected_by_id: actorUserId,
    };

    if (input.time_in !== undefined) {
      updateData.time_in = input.time_in ? new Date(input.time_in) : null;
    }
    if (input.time_out !== undefined) {
      updateData.time_out = input.time_out ? new Date(input.time_out) : null;
    }
    if (input.override_status !== undefined) {
      updateData.override_status = input.override_status;
    }
    if (input.override_remarks !== undefined) {
      updateData.override_remarks = input.override_remarks;
    }

    const updated = await prisma.facultyAttendance.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      actorUserId,
      action: 'FACULTY_ATTENDANCE_CORRECTED',
      resourceType: 'faculty_attendance',
      resourceId: id,
      previousState,
      newState: updated,
      correlationId,
    });

    return {
      ...updated,
      timeInFormatted: formatManilaTime(updated.time_in),
      timeOutFormatted: formatManilaTime(updated.time_out),
    };
  }
}

export const facultyAttendanceService = new FacultyAttendanceService();
