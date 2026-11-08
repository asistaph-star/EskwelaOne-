import { Router } from 'express';
import { authMiddleware, requirePermissions } from '../common/middleware/auth.js';
import prisma from '../config/database.js';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { getPhilippineCalendarDate } from '../common/utils/dateTime.js';

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

    // 3. Gate Attendance Today & Live Students on Campus (Asia/Manila Date)
    const { dateObj: phToday } = getPhilippineCalendarDate();

    const studentsOnCampusCount = await prisma.gateAttendance.count({
      where: {
        OR: [
          { date: phToday },
          { date: { gte: startOfToday, lte: endOfToday } }
        ],
        time_in: { not: null },
        time_out: null,
      }
    });

    const gateScansTodayCount = await prisma.gateAttendance.count({
      where: {
        OR: [
          { date: phToday },
          { date: { gte: startOfToday, lte: endOfToday } }
        ]
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
        studentsOnCampus: studentsOnCampusCount,
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

/**
 * Canonical DigiSkwela institutional roles for IT Admin Account Overview.
 */
const CANONICAL_ROLES = [
  { role: 'Student', label: 'Student Accounts', portal: 'Student Portal' },
  { role: 'Teacher', label: 'Teacher Accounts', portal: 'Teacher Portal' },
  { role: 'Principal', label: 'Principal Accounts', portal: 'Principal Portal' },
  { role: 'Registrar', label: 'Registrar Accounts', portal: 'Registrar Portal' },
  { role: 'Admin', label: 'School Admin Accounts', portal: 'School Admin Portal' },
  { role: 'ITAdmin', label: 'IT Admin Accounts', portal: 'IT Admin Portal' },
  { role: 'Guidance', label: 'Guidance Accounts', portal: 'Guidance & Welfare Portal' },
  { role: 'Nurse', label: 'Nurse Accounts', portal: 'School Clinic Portal' },
  { role: 'GateOperator', label: 'Gate Operator Accounts', portal: 'Gate Terminal Kiosk' },
] as const;

/**
 * GET /api/admin/system-stats
 * Real-time account, infrastructure, and school operations KPI summary for ITAdmin and Admin dashboards.
 * - ITAdmin receives FULL_ITADMIN scope including complete cross-portal role breakdown and gate terminal metrics.
 * - Admin receives OPERATIONAL_ADMIN scope with accountOverview: null and authoritative school operations metrics
 *   (active academic year & trimesters, sections & rosters, SF9/gradebook readiness, campus inventory,
 *   authorized operational accounts, and recent operational audit events).
 * - All other roles (including Registrar, Teacher, Student) are rejected with 403 Forbidden.
 */
router.get('/system-stats', authMiddleware, async (req, res, next) => {
  try {
    const authUser = (req as any).user as { id: string; roles?: string[] } | undefined;
    const isITAdmin = Boolean(authUser?.roles?.includes('ITAdmin'));
    const isAdmin = Boolean(authUser?.roles?.includes('Admin'));

    if (!isITAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. System account statistics are restricted to administrative personnel.',
        },
      });
    }

    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const twentyFourHoursAgo = subDays(now, 1);

    // ─── SCHOOL ADMIN (OPERATIONAL_ADMIN) SCOPE ───────────────────────────────
    if (!isITAdmin) {
      const operationalRoleNames = ['Student', 'Teacher', 'Guidance', 'Nurse', 'GateOperator', 'Principal', 'Registrar'];
      const privilegedRoleNames = ['ITAdmin', 'Admin'];

      const [
        currentYear,
        allYears,
        inventoryItems,
        operationalUsersTotal,
        operationalUsersActive,
        operationalUsersNew7d,
        facultyAccounts,
        studentAccounts,
        supportStaffAccounts,
        recentOperationalEventsCount,
        recentOperationalEvents,
      ] = await Promise.all([
        prisma.academicYear.findFirst({
          where: { is_current: true },
          include: {
            terms: { orderBy: { key: 'asc' } },
          },
        }),
        prisma.academicYear.findMany({
          orderBy: { start_date: 'desc' },
          take: 1,
          include: {
            terms: { orderBy: { key: 'asc' } },
          },
        }),
        prisma.inventoryItem.findMany({
          select: { status: true, quantity: true, category: true },
        }),
        prisma.user.count({
          where: {
            user_roles: {
              some: { role: { name: { in: operationalRoleNames } } },
              none: { role: { name: { in: privilegedRoleNames } } },
            },
          },
        }),
        prisma.user.count({
          where: {
            status: 'active',
            user_roles: {
              some: { role: { name: { in: operationalRoleNames } } },
              none: { role: { name: { in: privilegedRoleNames } } },
            },
          },
        }),
        prisma.user.count({
          where: {
            created_at: { gte: sevenDaysAgo },
            user_roles: {
              some: { role: { name: { in: operationalRoleNames } } },
              none: { role: { name: { in: privilegedRoleNames } } },
            },
          },
        }),
        prisma.userRole.count({ where: { role: { name: 'Teacher' } } }),
        prisma.userRole.count({ where: { role: { name: 'Student' } } }),
        prisma.userRole.count({ where: { role: { name: { in: ['Guidance', 'Nurse', 'GateOperator'] } } } }),
        prisma.auditLog.count({
          where: {
            created_at: { gte: twentyFourHoursAgo },
            category: { in: ['ACADEMIC', 'CONFIGURATION', 'ACCOUNT', 'ATTENDANCE', 'STUDENT_SERVICES'] },
            OR: [{ actor_role: null }, { actor_role: { not: 'ITAdmin' } }],
          },
        }),
        prisma.auditLog.findMany({
          where: {
            category: { in: ['ACADEMIC', 'CONFIGURATION', 'ACCOUNT', 'ATTENDANCE', 'STUDENT_SERVICES'] },
            OR: [{ actor_role: null }, { actor_role: { not: 'ITAdmin' } }],
          },
          orderBy: { created_at: 'desc' },
          take: 8,
          select: {
            id: true,
            created_at: true,
            action: true,
            category: true,
            actor_school_id: true,
            actor_role: true,
            target_label: true,
            result: true,
            resource_type: true,
          },
        }),
      ]);

      const activeYear = currentYear || allYears[0] || null;

      let sectionsList: Array<{
        id: string;
        name: string;
        gradeLevel: number;
        adviserName: string | null;
        adviserSchoolId: string | null;
        enrolledCount: number;
        sf9IssuedCount: number;
        subjectAssignmentsCount: number;
      }> = [];
      let enrolledStudentsCount = 0;
      let totalGradebooks = 0;
      let publishedGradebooks = 0;
      let draftGradebooks = 0;
      let sf9IssuedCurrent = 0;

      if (activeYear) {
        const [rawSections, enrolledCount, gbTotal, gbPub, gbDraft, sf9Count] = await Promise.all([
          prisma.section.findMany({
            where: { academic_year_id: activeYear.id },
            include: {
              adviser_teacher: {
                include: {
                  user: {
                    select: { first_name: true, last_name: true, school_id: true },
                  },
                },
              },
              _count: {
                select: {
                  enrollments: { where: { status: 'Enrolled' } },
                  sf9_issuances: { where: { is_current: true } },
                  assignments: true,
                },
              },
            },
            orderBy: [{ grade_level: 'asc' }, { name: 'asc' }],
          }),
          prisma.enrollment.count({
            where: { academic_year_id: activeYear.id, status: 'Enrolled' },
          }),
          prisma.gradebooks.count({
            where: { term: { academic_year_id: activeYear.id } },
          }),
          prisma.gradebooks.count({
            where: { term: { academic_year_id: activeYear.id }, status: 'Published' },
          }),
          prisma.gradebooks.count({
            where: { term: { academic_year_id: activeYear.id }, status: 'Draft' },
          }),
          prisma.sf9OfficialIssuance.count({
            where: { academic_year_id: activeYear.id, is_current: true },
          }),
        ]);

        enrolledStudentsCount = enrolledCount;
        totalGradebooks = gbTotal;
        publishedGradebooks = gbPub;
        draftGradebooks = gbDraft;
        sf9IssuedCurrent = sf9Count;

        sectionsList = rawSections.map((sec) => {
          const advUser = sec.adviser_teacher?.user;
          const adviserName = advUser
            ? `${advUser.first_name} ${advUser.last_name}`.trim()
            : sec.adviser_name_snapshot || null;
          return {
            id: sec.id,
            name: sec.name,
            gradeLevel: sec.grade_level,
            adviserName,
            adviserSchoolId: advUser?.school_id || null,
            enrolledCount: sec._count.enrollments,
            sf9IssuedCount: sec._count.sf9_issuances,
            subjectAssignmentsCount: sec._count.assignments,
          };
        });
      }

      const sectionsWithAdviser = sectionsList.filter((s) => Boolean(s.adviserName)).length;
      const sectionsWithoutAdviser = sectionsList.length - sectionsWithAdviser;

      let invGood = 0;
      let invRepair = 0;
      let invBorrowed = 0;
      let invDamagedOrLost = 0;
      let invRetiredOrDisposed = 0;
      let invTotalUnits = 0;

      for (const item of inventoryItems) {
        if (item.status !== 'Retired' && item.status !== 'Disposed') {
          invTotalUnits += item.quantity || 0;
        }
        switch (item.status) {
          case 'Good':
            invGood++;
            break;
          case 'Repair':
            invRepair++;
            break;
          case 'Borrowed':
            invBorrowed++;
            break;
          case 'Damaged':
          case 'Lost':
            invDamagedOrLost++;
            break;
          case 'Retired':
          case 'Disposed':
            invRetiredOrDisposed++;
            break;
        }
      }

      const formatTrimesterLabel = (key: string, name?: string | null) => {
        if (key === 'T1') return 'Term 1 (1st Trimester)';
        if (key === 'T2') return 'Term 2 (2nd Trimester)';
        if (key === 'T3') return 'Term 3 (3rd Trimester)';
        if (key === 'T4') return 'Term 4';
        return name || key;
      };

      return res.json({
        success: true,
        data: {
          scope: 'OPERATIONAL_ADMIN',
          lastUpdated: now.toISOString(),
          totalUsers: operationalUsersTotal,
          activeUsers: operationalUsersActive,
          inactiveUsers: Math.max(0, operationalUsersTotal - operationalUsersActive),
          newUsersLast7Days: operationalUsersNew7d,
          recentSystemEvents: recentOperationalEventsCount,
          accountOverview: null,
          schoolOperationsOverview: {
            activeAcademicYear: activeYear
              ? {
                  id: activeYear.id,
                  name: activeYear.name,
                  isCurrent: activeYear.is_current,
                  startDate: activeYear.start_date.toISOString(),
                  endDate: activeYear.end_date.toISOString(),
                  termSystem: 'Trimester',
                  terms: activeYear.terms.map((t) => ({
                    id: t.id,
                    key: t.key,
                    name: t.name,
                    label: formatTrimesterLabel(t.key, t.name),
                    startDate: t.start_date ? t.start_date.toISOString() : null,
                    endDate: t.end_date ? t.end_date.toISOString() : null,
                  })),
                }
              : null,
            sectionsSummary: {
              totalSections: sectionsList.length,
              sectionsWithAdviser,
              sectionsWithoutAdviser,
              enrolledStudents: enrolledStudentsCount,
              sections: sectionsList,
            },
            sf9Summary: {
              totalGradebooks,
              publishedGradebooks,
              draftGradebooks,
              sf9IssuedCurrent,
            },
            inventorySummary: {
              totalItems: inventoryItems.length,
              totalUnits: invTotalUnits,
              goodCount: invGood,
              repairCount: invRepair,
              borrowedCount: invBorrowed,
              damagedOrLostCount: invDamagedOrLost,
              retiredOrDisposedCount: invRetiredOrDisposed,
              attentionCount: invRepair + invDamagedOrLost,
            },
            operationalAccounts: {
              totalOperationalAccounts: operationalUsersTotal,
              activeOperationalAccounts: operationalUsersActive,
              inactiveOperationalAccounts: Math.max(0, operationalUsersTotal - operationalUsersActive),
              facultyAccounts,
              studentAccounts,
              supportStaffAccounts,
            },
            recentOperationalEvents,
          },
        },
      });
    }

    // ─── IT ADMIN (FULL_ITADMIN) SCOPE ────────────────────────────────────────
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      newUsersLast7Days,
      recentSystemEvents,
      dbRoles,
      unassignedRoleUsers,
      multiRoleGroups,
      gateTerminals,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { status: { not: 'active' } } }),
      prisma.user.count({ where: { created_at: { gte: sevenDaysAgo } } }),
      prisma.auditLog.count({ where: { created_at: { gte: twentyFourHoursAgo } } }),
      prisma.role.findMany({
        include: {
          _count: {
            select: { user_roles: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.user.count({
        where: {
          user_roles: { none: {} },
        },
      }),
      prisma.userRole.groupBy({
        by: ['user_id'],
        _count: { role_id: true },
        having: {
          role_id: { _count: { gt: 1 } },
        },
      }),
      prisma.gateTerminal.findMany({
        orderBy: { created_at: 'asc' },
      }),
    ]);

    const rawCountsByName = new Map<string, number>();
    let totalRoleAssignments = 0;
    for (const r of dbRoles) {
      const count = r._count.user_roles;
      rawCountsByName.set(r.name, count);
      totalRoleAssignments += count;
    }

    const canonicalSet = new Set<string>(CANONICAL_ROLES.map(c => c.role));
    const byRole: Record<string, number> = {};

    const roles = CANONICAL_ROLES.map(item => {
      const count = rawCountsByName.get(item.role) ?? 0;
      byRole[item.role] = count;
      return {
        role: item.role,
        label: item.label,
        portal: item.portal,
        count,
      };
    });

    const otherRoles = dbRoles
      .filter(r => !canonicalSet.has(r.name))
      .map(r => {
        const count = r._count.user_roles;
        byRole[r.name] = count;
        return {
          role: r.name,
          label: `${r.name} Accounts`,
          portal: 'Additional Configured Role',
          count,
        };
      });

    const activeTerminalsCount = gateTerminals.filter(t => t.active).length;
    const studentTerminalsCount = gateTerminals.filter(t => t.terminal_type === 'student').length;
    const facultyTerminalsCount = gateTerminals.filter(t => t.terminal_type === 'faculty').length;

    return res.json({
      success: true,
      data: {
        scope: 'FULL_ITADMIN',
        lastUpdated: now.toISOString(),
        totalUsers,
        activeUsers,
        inactiveUsers,
        newUsersLast7Days,
        recentSystemEvents,
        gateTerminalsSummary: {
          total: gateTerminals.length,
          active: activeTerminalsCount,
          inactive: gateTerminals.length - activeTerminalsCount,
          studentTerminals: studentTerminalsCount,
          facultyTerminals: facultyTerminalsCount,
        },
        accountOverview: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          newUsersLast7Days,
          totalRoleAssignments,
          unassignedRoleUsers,
          multiRoleUsers: multiRoleGroups.length,
          byRole,
          roles,
          otherRoles,
        },
        schoolOperationsOverview: null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
