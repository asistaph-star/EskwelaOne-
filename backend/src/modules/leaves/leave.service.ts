import prisma from '../../config/database.js';

export interface PendingLeaveRecord {
  requestId: string;
  userId: string;
  applicantDisplayName: string;
  department: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  submittedOn: string;
  status: 'Pending';
}

export interface ApprovedLeaveRecord {
  requestId: string;
  userId: string;
  applicantDisplayName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysCount: number;
}

export class LeaveService {
  /**
   * Retrieves pending leave applications awaiting administrative action.
   * Excludes private medical details, notes, attachments, and personal contact info.
   */
  async getPendingLeaves(limit: number = 50): Promise<PendingLeaveRecord[]> {
    const rawLeaves = await prisma.leaveRequest.findMany({
      where: { status: 'Pending' },
      take: Math.min(Math.max(limit, 1), 100),
      orderBy: { submitted_on: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            teacher: {
              select: { department: true }
            },
            staff: {
              select: { department: true }
            }
          }
        }
      }
    });

    return rawLeaves.map(leave => {
      const dept = leave.user?.teacher?.department || leave.user?.staff?.department || null;
      return {
        requestId: leave.id,
        userId: leave.user_id,
        applicantDisplayName: `${leave.user.first_name} ${leave.user.last_name}`,
        department: dept,
        leaveType: leave.type,
        startDate: leave.start_date.toISOString().split('T')[0],
        endDate: leave.end_date.toISOString().split('T')[0],
        daysCount: leave.days,
        submittedOn: leave.submitted_on.toISOString(),
        status: 'Pending' as const,
      };
    });
  }

  /**
   * Retrieves all approved leaves covering a specific calendar date.
   */
  async getApprovedLeavesForDate(date: Date): Promise<ApprovedLeaveRecord[]> {
    const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'Approved',
        start_date: { lte: endOfDay },
        end_date: { gte: startOfDay },
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          }
        }
      }
    });

    return leaves.map(leave => ({
      requestId: leave.id,
      userId: leave.user_id,
      applicantDisplayName: `${leave.user.first_name} ${leave.user.last_name}`,
      leaveType: leave.type,
      startDate: leave.start_date.toISOString().split('T')[0],
      endDate: leave.end_date.toISOString().split('T')[0],
      daysCount: leave.days,
    }));
  }

  /**
   * Retrieves approved leaves within a date window.
   */
  async getApprovedLeavesForPeriod(startDate: Date, endDate: Date): Promise<ApprovedLeaveRecord[]> {
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'Approved',
        start_date: { lte: endDate },
        end_date: { gte: startDate },
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          }
        }
      }
    });

    return leaves.map(leave => ({
      requestId: leave.id,
      userId: leave.user_id,
      applicantDisplayName: `${leave.user.first_name} ${leave.user.last_name}`,
      leaveType: leave.type,
      startDate: leave.start_date.toISOString().split('T')[0],
      endDate: leave.end_date.toISOString().split('T')[0],
      daysCount: leave.days,
    }));
  }

  /**
   * Counts pending leaves.
   */
  async getPendingCount(): Promise<number> {
    return await prisma.leaveRequest.count({
      where: { status: 'Pending' }
    });
  }
}

export const leaveService = new LeaveService();
