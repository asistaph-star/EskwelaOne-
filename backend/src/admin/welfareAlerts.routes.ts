import { Router, Request, Response, NextFunction } from 'express';
import { requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import prisma from '../config/database.js';

const router = Router();

/**
 * GET /api/admin/welfare-alerts
 * Executive oversight endpoint for Principal and authorized administrators.
 * Returns unresolved student disciplinary / welfare cases from BehaviorLog.
 * 
 * Privacy Guarantees:
 * - Does NOT query or expose ClinicReferral (medical data isolation).
 * - Does NOT query or expose GuidanceRecord (confidential counseling data isolation).
 * - Strictly excludes 'Resolved' cases from active alert counts.
 * - Requires 'behavior:read' permission (granted to Principal, Admin, ITAdmin).
 */
router.get('/', requirePermissions('behavior:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeCases = await prisma.behaviorLog.findMany({
      where: {
        status: {
          in: ['Reported', 'Under investigation', 'Parent notified'],
        },
      },
      orderBy: {
        date: 'desc',
      },
      include: {
        reporter: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        student: {
          include: {
            user: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
            current_section: {
              select: {
                name: true,
                grade_level: true,
              },
            },
          },
        },
      },
    });

    const alerts = activeCases.map((c) => ({
      id: c.id,
      studentId: c.student_id,
      studentName: c.student?.user
        ? `${c.student.user.first_name} ${c.student.user.last_name}`
        : 'Unknown Student',
      gradeLevel: c.student?.current_section?.grade_level ?? c.student?.grade_level ?? null,
      sectionName: c.student?.current_section?.name ?? null,
      alertType: 'Behavioral' as const,
      incidentType: c.type,
      date: c.date.toISOString(),
      status: c.status,
      note: c.note,
      reportedBy: c.reported_by,
      reporterName: c.reporter
        ? `${c.reporter.first_name} ${c.reporter.last_name}`
        : c.reported_by || 'Staff',
      createdAt: c.created_at.toISOString(),
    }));

    const uniqueStudentIds = new Set(activeCases.map((c) => c.student_id));

    const summary = {
      totalActiveAlerts: activeCases.length,
      studentsRequiringAttention: uniqueStudentIds.size,
      openCases: activeCases.filter(
        (c) => c.status === 'Reported' || c.status === 'Under investigation'
      ).length,
      byStatus: {
        reported: activeCases.filter((c) => c.status === 'Reported').length,
        underInvestigation: activeCases.filter((c) => c.status === 'Under investigation').length,
        parentNotified: activeCases.filter((c) => c.status === 'Parent notified').length,
      },
    };

    res.json({
      success: true,
      data: {
        summary,
        alerts,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
