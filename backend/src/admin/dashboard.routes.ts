import { Router } from 'express';
import { authMiddleware, requirePermissions } from '../common/middleware/auth.js';
import prisma from '../config/database.js';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

const router = Router();

/**
 * GET /api/admin/dashboard
 * Dashboard aggregation for Principal/Admin roles.
 * Requires user:read permission as a baseline for accessing aggregate user/school data.
 */
router.get('/dashboard', authMiddleware, requirePermissions('user:read'), async (req, res, next) => {
  try {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    // 1. Enrolled Students (Active Academic Year)
    const currentYear = await prisma.academicYear.findFirst({
      where: { is_current: true },
      select: { id: true }
    });

    let enrolledStudentsCount = 0;
    let activeSectionsCount = 0;
    if (currentYear) {
      enrolledStudentsCount = await prisma.enrollment.count({
        where: {
          academic_year_id: currentYear.id,
          status: 'Enrolled' // Assuming 'Enrolled' is the active status based on standard semantics
        }
      });
      activeSectionsCount = await prisma.section.count({
        where: {
          academic_year_id: currentYear.id
        }
      });
    }

    // 2. Total Teachers
    const teachersCount = await prisma.teacher.count();

    // 3. Gate Attendance Today
    const gateScansTodayCount = await prisma.gateAttendance.count({
      where: {
        date: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });

    // 4. Pending Approvals
    // For Principal: Pending LeaveRequests
    const pendingLeaves = await prisma.leaveRequest.count({
      where: { status: 'Pending' }
    });
    // For Principal: Pending DocumentRequests (if they have a principal approval stage)
    const pendingDocs = await prisma.documentRequest.count({
      where: { status: 'Pending Principal Approval' } 
    });
    // Note: status might just be "Pending" and current_stage might indicate whose turn it is.
    // For safety, let's just aggregate Leaves since that is definitively Principal responsibility.

    // 5. Unresolved Behavior / Welfare Alerts (Excluding 'Resolved')
    const pendingBehaviorCases = await prisma.behaviorLog.count({
      where: {
        status: { in: ['Reported', 'Under investigation', 'Parent notified'] }
      }
    });

    const flaggedStudents = await prisma.behaviorLog.findMany({
      where: {
        status: { in: ['Reported', 'Under investigation', 'Parent notified'] }
      },
      distinct: ['student_id'],
      select: { student_id: true }
    });

    // 6. Gate Trend (Last 7 Days)
    const gateTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const start = startOfDay(d);
      const end = endOfDay(d);
      const count = await prisma.gateAttendance.count({
        where: {
          date: {
            gte: start,
            lte: end
          }
        }
      });
      gateTrend.push({
        date: format(d, 'MMM dd'),
        count
      });
    }

    res.json({
      success: true,
      data: {
        enrolledStudents: enrolledStudentsCount,
        totalTeachers: teachersCount,
        activeSections: activeSectionsCount,
        gateToday: gateScansTodayCount,
        pendingApprovals: pendingLeaves,
        pendingDisciplineCases: pendingBehaviorCases,
        studentsRequiringAttention: flaggedStudents.length,
        gateTrend
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
