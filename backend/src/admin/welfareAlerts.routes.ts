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

    // Aggregate by student for student-centric Welfare Alerts (PRIN-004)
    const studentMap = new Map<string, {
      studentId: string;
      studentName: string;
      gradeLevel: number | null;
      sectionName: string | null;
      openConcernsCount: number;
      latestIncident: string;
      latestStatus: string;
      lastActivity: string;
      incidentTypes: string[];
      notes: string[];
    }>();

    for (const c of activeCases) {
      const studentId = c.student_id;
      const studentName = c.student?.user
        ? `${c.student.user.first_name} ${c.student.user.last_name}`
        : 'Unknown Student';
      const gradeLevel = c.student?.current_section?.grade_level ?? c.student?.grade_level ?? null;
      const sectionName = c.student?.current_section?.name ?? null;

      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          studentId,
          studentName,
          gradeLevel,
          sectionName,
          openConcernsCount: 1,
          latestIncident: c.type,
          latestStatus: c.status,
          lastActivity: c.date.toISOString(),
          incidentTypes: [c.type],
          notes: c.note ? [c.note] : [],
        });
      } else {
        const entry = studentMap.get(studentId)!;
        entry.openConcernsCount += 1;
        if (!entry.incidentTypes.includes(c.type)) {
          entry.incidentTypes.push(c.type);
        }
        if (c.note) {
          entry.notes.push(c.note);
        }
      }
    }

    const attentionStudents = Array.from(studentMap.values());
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
        attentionStudents,
        alerts,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
