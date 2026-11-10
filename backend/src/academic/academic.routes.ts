import { Router, Request, Response, NextFunction } from 'express';
import reportCardRoutes from './reportCard.routes.js';
import sf10Routes from './sf10.routes.js';
import calendarRoutes from './calendar.routes.js';
import adviserCommentsRoutes from './adviserComments.routes.js';
import advisoryRoutes from './advisory/advisory.routes.js';
import healthMetricRoutes from './health/healthMetric.routes.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import prisma from '../config/database.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';
import {
  assignSectionClassAdviser,
  resolvePersistedSf9Signatories,
} from './grading/index.js';
import { 
  createAcademicYearSchema, 
  addAcademicTermSchema,
  createSubjectSchema, 
  createSectionSchema, 
  createTeacherAssignmentSchema,
  updateTeacherAssignmentSchema,
  createAcademicYear,
  createSubject,
  createSection,
  createTeacherAssignment,
  updateTeacherAssignment,
  addAcademicTerm,
  removeAcademicTerm,
  resolveSubjectGradeLevel
} from './academic.service.js';
import {
  assessAcademicYearClosureReadiness,
  closeAcademicYear,
  closeAcademicYearSchema
} from './closureReadiness.service.js';
import {
  getPromotionRoster,
  approveStudentPromotion,
  enrollNextYearStudent,
  bulkApproveStudentPromotion,
  bulkEnrollNextYearStudents,
  approvePromotionSchema,
  enrollNextYearSchema,
  bulkApprovePromotionSchema,
  bulkEnrollNextYearSchema
} from './studentPromotion.service.js';

const router = Router();
router.use('/report-card', reportCardRoutes);
router.use('/sf10', sf10Routes);
router.use('/calendar', calendarRoutes);
router.use('/sf9/comments', adviserCommentsRoutes);
router.use('/advisory', advisoryRoutes);
router.use('/health', healthMetricRoutes);
router.use(authMiddleware);

// ─── Academic Years ──────────────────────────────────────────

/**
 * POST /api/academic/years
 * Requires academic:write permission.
 */
router.post('/years', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAcademicYearSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const year = await createAcademicYear(input, actorId, correlationId);
    res.status(201).json({ success: true, data: year });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/years
 */
router.get('/years', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const years = await prisma.academicYear.findMany({
      orderBy: { start_date: 'desc' },
    });
    res.json({ success: true, data: years });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/years/:yearId/closure-readiness
 * Assesses school-year closure readiness in strict read-only mode.
 * Accessible exclusively by authorized administrative roles (Admin, ITAdmin, Principal, Registrar).
 */
router.get('/years/:yearId/closure-readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearId = req.params.yearId as string;
    const authUser = (req as any).user as AuthenticatedUser;

    const report = await assessAcademicYearClosureReadiness(yearId, authUser);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/years/:yearId/close
 * Executes official atomic school-year closure with PostgreSQL row-level locks,
 * prerequisite readiness enforcement, and audit recording.
 * Accessible exclusively by authorized administrative roles (Admin, ITAdmin, Principal).
 */
router.post('/years/:yearId/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearId = req.params.yearId as string;
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const parsed = closeAcademicYearSchema.parse(req.body);
    const result = await closeAcademicYear(yearId, parsed, authUser, correlationId);

    res.json({
      success: true,
      message: `Academic year ${result.name} has been successfully closed and transitioned to historical status.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Student Promotion & Year-End Outcomes (DepEd Order No. 8, s. 2015) ───

/**
 * GET /api/academic/years/:yearId/promotion-roster
 * Evaluates annual final ratings, General Average, MAPEH consolidation,
 * and DepEd Order No. 8, s. 2015 promotion/remedial/retention eligibility.
 * Accessible to Principal, Admin, and Registrar.
 */
router.get('/years/:yearId/promotion-roster', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearId = req.params.yearId as string;
    const authUser = (req as any).user as AuthenticatedUser;

    const isStudent = authUser.roles.includes('Student');
    if (isStudent) {
      throw new AppError(403, 'FORBIDDEN', 'Students cannot view school-wide promotion rosters.');
    }

    const hasAccess = authUser.roles.some(r => ['Principal', 'Admin', 'Registrar', 'Teacher'].includes(r)) ||
      authUser.permissions.includes('academic:read') ||
      authUser.permissions.includes('enrollment:read');

    if (!hasAccess) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions to view promotion roster.');
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const pageSize = req.query.pageSize !== undefined ? parseInt(req.query.pageSize as string, 10) : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const gradeLevel = req.query.gradeLevel ? parseInt(req.query.gradeLevel as string, 10) : undefined;
    const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
    const outcome = typeof req.query.outcome === 'string' ? req.query.outcome : undefined;
    const reviewStatus = typeof req.query.reviewStatus === 'string' ? req.query.reviewStatus : undefined;
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy as any : undefined;
    const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';

    const roster = await getPromotionRoster(yearId, {
      page,
      pageSize,
      search,
      gradeLevel,
      sectionId,
      outcome,
      reviewStatus,
      sortBy,
      sortOrder
    });
    res.json({ success: true, data: roster });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/years/:yearId/promotion/approve
 * Authorized Principal approval of student promotion or retention outcome.
 * Enforces academic authority and policy validation.
 */
router.post('/years/:yearId/promotion/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearId = req.params.yearId as string;
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    // Strict role check: Only Principal or Admin with academic authority
    const isAcademicLeader = authUser.roles.includes('Principal') || authUser.roles.includes('Admin');
    const hasAcademicWrite = authUser.permissions.includes('academic:write');

    if (!isAcademicLeader && !hasAcademicWrite) {
      throw new AppError(403, 'FORBIDDEN', 'Only authorized academic leadership (Principal) can approve student promotion outcomes.');
    }

    const input = approvePromotionSchema.parse({
      ...req.body,
      academicYearId: yearId
    });

    const result = await approveStudentPromotion(input, authUser, correlationId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/years/:yearId/promotion/enroll-next-year
 * Registrar next-year enrollment for promoted or retained student.
 * Reuses existing Student profile (same 12-digit LRN and User account).
 * Enforces atomic duplicate prevention and section grade-level alignment.
 */
router.post('/years/:yearId/promotion/enroll-next-year', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearId = req.params.yearId as string;
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const input = enrollNextYearSchema.parse({
      ...req.body,
      sourceAcademicYearId: yearId
    });

    const result = await enrollNextYearStudent(input, authUser, correlationId);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/years/:yearId/promotion/bulk-approve
 * Principal Safe Bulk Promotion and JHS Completion Approval (Phase 2C.3).
 * Re-validates every individual learner at execution time under DepEd Order No. 8, s. 2015.
 * Strictly separates Grade 7–9 Promotion from Grade 10 JHS Completion.
 */
router.post('/years/:yearId/promotion/bulk-approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearId = req.params.yearId as string;
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    // Strict role check: Only Principal or Admin with academic authority
    const isAcademicLeader = authUser.roles.includes('Principal') || authUser.roles.includes('Admin');
    const hasAcademicWrite = authUser.permissions.includes('academic:write');

    if (!isAcademicLeader && !hasAcademicWrite) {
      throw new AppError(403, 'FORBIDDEN', 'Only authorized academic leadership (Principal) can bulk approve student promotion outcomes.');
    }

    const input = bulkApprovePromotionSchema.parse({
      ...req.body,
      academicYearId: yearId
    });

    const result = await bulkApproveStudentPromotion(input, authUser, correlationId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/years/:yearId/promotion/bulk-enroll-next-year
 * Registrar Safe Bulk Next-Year Re-Enrollment (Phase 2C.3).
 * Atomically places approved Grade 7–9 learners into target academic year sections.
 */
router.post('/years/:yearId/promotion/bulk-enroll-next-year', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearId = req.params.yearId as string;
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const input = bulkEnrollNextYearSchema.parse({
      ...req.body,
      sourceAcademicYearId: yearId
    });

    const result = await bulkEnrollNextYearStudents(input, authUser, correlationId);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Terms ───────────────────────────────────────────────────

/**
 * Strict database-verified authorization middleware:
 * Only Admin and ITAdmin are authorized to add or remove academic terms.
 */
async function requireAdminOrItAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const actor = (req as any).user;
    if (!actor || !actor.id) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: actor.id },
      include: {
        user_roles: {
          include: { role: true }
        }
      }
    });
    if (!dbUser || dbUser.status !== 'active') {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found or inactive.');
    }
    const isAuthorized = dbUser.user_roles.some(
      (ur) => ur.role.name === 'Admin' || ur.role.name === 'ITAdmin'
    );
    if (!isAuthorized) {
      throw new AppError(403, 'FORBIDDEN', 'Only ITAdmin and Admin are authorized to manage academic terms.');
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/academic/years/:yearId/terms
 */
router.get('/years/:yearId/terms', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const terms = await prisma.term.findMany({
      where: { academic_year_id: req.params.yearId as string },
      orderBy: { key: 'asc' }, // T1, T2, T3, T4
    });
    res.json({ success: true, data: terms });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/academic/terms/:termId/visibility
 * Toggles whether published grades for this term are visible to students in the Student Portal.
 * Authorized: Principal, Admin, ITAdmin.
 */
router.patch('/terms/:termId/visibility', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;
    if (!actor || !actor.id) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const userRoles = actor.roles || [];
    const isAuthorized = userRoles.some((r: string) => ['Principal', 'Admin', 'ITAdmin'].includes(r));
    if (!isAuthorized) {
      throw new AppError(403, 'FORBIDDEN', 'Only Principal, Admin, and ITAdmin may manage term grade visibility.');
    }

    const termId = req.params.termId as string;
    const rawVisible = req.body.isVisible ?? req.body.isGradesVisible ?? req.body.isGradesVisibleToStudents;
    const isVisible = rawVisible !== undefined ? Boolean(rawVisible) : true;

    await (prisma as any).$executeRawUnsafe(
      `UPDATE terms SET is_grades_visible_to_students = $1, updated_at = NOW() WHERE id = $2`,
      isVisible,
      termId
    );

    const term = await (prisma as any).term.findUnique({
      where: { id: termId },
      include: { academic_year: true },
    });

    if (!term) throw new AppError(404, 'NOT_FOUND', `Term ${termId} not found`);

    await createAuditLog({
      actorUserId: actor.id,
      action: 'TERM_GRADES_VISIBILITY_TOGGLED',
      resourceType: 'term',
      resourceId: termId,
      result: 'SUCCESS',
      newState: {
        termId,
        termKey: term.key,
        academicYearId: term.academic_year_id,
        isGradesVisible: isVisible,
        toggledBy: actor.id,
      },
      correlationId: (req as any).correlationId,
    });

    res.json({
      success: true,
      data: {
        id: term.id,
        key: term.key,
        name: term.name,
        isGradesVisible: isVisible,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/years/:yearId/terms
 * Add the next chronological term to an academic year.
 * Authorized: ITAdmin, Admin only (verified from database roles).
 */
router.post('/years/:yearId/terms', requireAdminOrItAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearId = req.params.yearId as string;
    const input = addAcademicTermSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    const term = await addAcademicTerm(yearId, input, actorId, correlationId);
    res.status(201).json({ success: true, data: term });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/academic/years/:yearId/terms/:termId
 * Remove the highest unused term from an academic year.
 * Authorized: ITAdmin, Admin only (verified from database roles).
 */
router.delete('/years/:yearId/terms/:termId', requireAdminOrItAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearId = req.params.yearId as string;
    const termId = req.params.termId as string;
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    const result = await removeAcademicTerm(yearId, termId, actorId, correlationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Subjects ────────────────────────────────────────────────

/**
 * POST /api/academic/subjects
 * Requires academic:write permission.
 */
router.post('/subjects', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createSubjectSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const subject = await createSubject(input, actorId, correlationId);
    res.status(201).json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/subjects
 */
router.get('/subjects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
});

// ─── Sections ────────────────────────────────────────────────

/**
 * POST /api/academic/sections
 * Requires academic:write permission.
 */
router.post('/sections', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createSectionSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const section = await createSection(input, actorId, correlationId);
    res.status(201).json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/sections
 * Returns all sections or filtered by yearId/gradeLevel, including adviser teacher and academic year.
 */
router.get('/sections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { yearId, gradeLevel } = req.query;
    const where: any = {};
    if (yearId) where.academic_year_id = yearId as string;
    if (gradeLevel) where.grade_level = parseInt(gradeLevel as string, 10);

    const sections = await prisma.section.findMany({
      where,
      include: {
        academic_year: true,
        adviser_teacher: {
          include: {
            user: {
              select: {
                id: true,
                school_id: true,
                first_name: true,
                last_name: true,
                middle_name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [
        { academic_year: { start_date: 'desc' } },
        { grade_level: 'asc' },
        { name: 'asc' },
      ],
    });
    res.json({ success: true, data: sections });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/years/:yearId/sections
 */
router.get('/years/:yearId/sections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sections = await prisma.section.findMany({
      where: { academic_year_id: req.params.yearId as string },
      include: {
        academic_year: true,
        adviser_teacher: {
          include: {
            user: {
              select: {
                id: true,
                school_id: true,
                first_name: true,
                last_name: true,
                middle_name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [
        { grade_level: 'asc' },
        { name: 'asc' },
      ],
    });
    res.json({ success: true, data: sections });
  } catch (err) {
    next(err);
  }
});

// ─── Teacher Assignments ─────────────────────────────────────

/**
 * POST /api/academic/assignments
 * Requires assignment:write permission.
 */
router.post('/assignments', requirePermissions('assignment:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createTeacherAssignmentSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const assignment = await createTeacherAssignment(input, actorId, correlationId);
    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/academic/assignments/:id
 * Updates an assignment (e.g. to assign schedule)
 * Requires assignment:write permission.
 */
router.put('/assignments/:id', requirePermissions('assignment:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateTeacherAssignmentSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const assignment = await updateTeacherAssignment(req.params.id as string, input, actorId, correlationId);
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/years/:yearId/assignments/me
 * Get assignments for the currently logged in teacher.
 */
router.get('/years/:yearId/assignments/me', requirePermissions('assignment:read_own'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    
    // We need the teacher ID, not the user ID
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { teacher: true },
    });

    if (!user || !user.teacher) {
      return res.status(403).json({ success: false, error: { code: 'NOT_A_TEACHER', message: 'Current user does not have a teacher profile.' } });
    }

    const assignments = await prisma.teacherSubjectAssignment.findMany({
      where: {
        academic_year_id: req.params.yearId as string,
        teacher_id: user.teacher.id,
      },
      include: {
        subject: true,
        section: true,
        gradebooks: {
          include: { term: true }
        }
      }
    });

    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/student/my-classes
 * Retrieves the authenticated student's active advisory enrollment, section,
 * designated class adviser, and subject class assignments for the active academic year.
 * Restricted to authenticated students (academic:read).
 */
router.get('/student/my-classes', requirePermissions('academic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;

    const student = await prisma.student.findUnique({
      where: { user_id: authUser.id },
      include: {
        user: true,
        current_section: {
          include: {
            academic_year: true,
            adviser_teacher: {
              include: { user: true }
            },
            assignments: {
              include: {
                subject: true,
                teacher: { include: { user: true } }
              }
            }
          }
        },
        enrollments: {
          where: { status: 'Enrolled' },
          include: {
            section: {
              include: {
                academic_year: true,
                adviser_teacher: {
                  include: { user: true }
                },
                assignments: {
                  include: {
                    subject: true,
                    teacher: { include: { user: true } }
                  }
                }
              }
            },
            academic_year: true,
          },
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!student) {
      throw new AppError(404, 'STUDENT_PROFILE_NOT_FOUND', 'Current user does not have an active Student profile.');
    }

    // Determine active academic year
    const activeYear = await prisma.academicYear.findFirst({
      where: { is_current: true }
    });

    // Select active enrollment matching active academic year first
    let activeEnrollment = student.enrollments.find(e => activeYear && e.academic_year_id === activeYear.id);
    if (!activeEnrollment && student.enrollments.length > 0) {
      activeEnrollment = student.enrollments[0];
    }

    const activeSection = activeEnrollment?.section || student.current_section;
    const academicYearName = activeEnrollment?.academic_year?.name || activeSection?.academic_year?.name || activeYear?.name || 'SY 2026-2027';
    const academicYearId = activeEnrollment?.academic_year_id || activeSection?.academic_year_id || activeYear?.id || null;

    let adviserData = null;
    if (activeSection?.adviser_teacher?.user) {
      adviserData = {
        id: activeSection.adviser_teacher.id,
        name: `${activeSection.adviser_teacher.user.first_name} ${activeSection.adviser_teacher.user.last_name}`,
        employeeId: activeSection.adviser_teacher.employee_id,
        position: activeSection.adviser_teacher.position || 'Class Adviser',
      };
    }

    const enrollmentData = activeSection ? {
      id: activeEnrollment?.id || `current-${activeSection.id}`,
      status: activeEnrollment?.status || (student.current_section_id ? 'Enrolled' : 'Not Enrolled'),
      academicYear: academicYearName,
      academicYearId,
      sectionId: activeSection.id,
      sectionName: activeSection.name,
      gradeLevel: activeSection.grade_level,
      adviser: adviserData,
    } : null;

    // Filter assignments for the active academic year if configured
    const assignments = (activeSection?.assignments || []).filter(a => {
      if (academicYearId) {
        return a.academic_year_id === academicYearId;
      }
      return true;
    });

    const classes = assignments.map(a => ({
      id: a.id,
      subjectId: a.subject_id,
      subjectCode: a.subject.code,
      subjectName: a.subject.name,
      teacherId: a.teacher_id,
      teacherName: a.teacher?.user ? `${a.teacher.user.first_name} ${a.teacher.user.last_name}` : 'Assigned Faculty',
      schedule: {
        days: a.days || null,
        startTime: a.start_time || null,
        endTime: a.end_time || null,
        room: a.room || null,
      }
    }));

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          lrn: student.lrn,
          name: `${student.first_name || authUser.firstName} ${student.last_name || authUser.lastName}`.trim(),
          gradeLevel: activeSection?.grade_level || student.grade_level,
        },
        enrollment: enrollmentData,
        classes,
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/student/:studentId/classes
 * Parameterized endpoint with strict ownership enforcement for students.
 */
router.get('/student/:studentId/classes', requirePermissions('academic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetStudentId = req.params.studentId as string;
    const authUser = (req as any).user as AuthenticatedUser;

    const isStudent = authUser.roles.includes('Student');
    if (isStudent) {
      const studentSelf = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!studentSelf || (studentSelf.id !== targetStudentId && studentSelf.user_id !== targetStudentId)) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied: Learners cannot view another student\'s academic classes.');
      }
    }

    const student = await prisma.student.findFirst({
      where: {
        OR: [{ id: targetStudentId }, { user_id: targetStudentId }]
      },
      include: {
        user: true,
        current_section: {
          include: {
            academic_year: true,
            adviser_teacher: { include: { user: true } },
            assignments: { include: { subject: true, teacher: { include: { user: true } } } }
          }
        },
        enrollments: {
          where: { status: 'Enrolled' },
          include: {
            section: {
              include: {
                academic_year: true,
                adviser_teacher: { include: { user: true } },
                assignments: { include: { subject: true, teacher: { include: { user: true } } } }
              }
            },
            academic_year: true,
          },
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!student) {
      throw new AppError(404, 'STUDENT_PROFILE_NOT_FOUND', 'Student profile not found.');
    }

    const activeYear = await prisma.academicYear.findFirst({ where: { is_current: true } });
    let activeEnrollment = student.enrollments.find(e => activeYear && e.academic_year_id === activeYear.id);
    if (!activeEnrollment && student.enrollments.length > 0) {
      activeEnrollment = student.enrollments[0];
    }

    const activeSection = activeEnrollment?.section || student.current_section;
    const academicYearName = activeEnrollment?.academic_year?.name || activeSection?.academic_year?.name || activeYear?.name || 'SY 2026-2027';
    const academicYearId = activeEnrollment?.academic_year_id || activeSection?.academic_year_id || activeYear?.id || null;

    let adviserData = null;
    if (activeSection?.adviser_teacher?.user) {
      adviserData = {
        id: activeSection.adviser_teacher.id,
        name: `${activeSection.adviser_teacher.user.first_name} ${activeSection.adviser_teacher.user.last_name}`,
        employeeId: activeSection.adviser_teacher.employee_id,
        position: activeSection.adviser_teacher.position || 'Class Adviser',
      };
    }

    const enrollmentData = activeSection ? {
      id: activeEnrollment?.id || `current-${activeSection.id}`,
      status: activeEnrollment?.status || (student.current_section_id ? 'Enrolled' : 'Not Enrolled'),
      academicYear: academicYearName,
      academicYearId,
      sectionId: activeSection.id,
      sectionName: activeSection.name,
      gradeLevel: activeSection.grade_level,
      adviser: adviserData,
    } : null;

    const assignments = (activeSection?.assignments || []).filter(a => {
      if (academicYearId) return a.academic_year_id === academicYearId;
      return true;
    });

    const classes = assignments.map(a => ({
      id: a.id,
      subjectId: a.subject_id,
      subjectCode: a.subject.code,
      subjectName: a.subject.name,
      teacherId: a.teacher_id,
      teacherName: a.teacher?.user ? `${a.teacher.user.first_name} ${a.teacher.user.last_name}` : 'Assigned Faculty',
      schedule: {
        days: a.days || null,
        startTime: a.start_time || null,
        endTime: a.end_time || null,
        room: a.room || null,
      }
    }));

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          lrn: student.lrn,
          name: `${student.first_name || student.user?.first_name || ''} ${student.last_name || student.user?.last_name || ''}`.trim(),
          gradeLevel: activeSection?.grade_level || student.grade_level,
        },
        enrollment: enrollmentData,
        classes,
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/my-classes
 * Get the current teacher's classes for the active academic year, shaped for the Teacher Portal.
 */
router.get('/my-classes', requirePermissions('assignment:read_own'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    
    // We need the teacher ID
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { teacher: true },
    });

    if (!user || !user.teacher) {
      return res.status(403).json({ success: false, error: { code: 'NOT_A_TEACHER', message: 'Current user does not have a teacher profile.' } });
    }

    // Get the current active academic year
    const currentYear = await prisma.academicYear.findFirst({
      where: { is_current: true }
    });

    if (!currentYear) {
      return res.status(404).json({ success: false, message: 'No active academic year found' });
    }

    const assignments = await prisma.teacherSubjectAssignment.findMany({
      where: {
        academic_year_id: currentYear.id,
        teacher_id: user.teacher.id,
      },
      include: {
        subject: true,
        section: {
          include: {
            _count: {
              select: { enrollments: { where: { status: 'Enrolled' } } }
            }
          }
        },
      }
    });

    // Map to the shape expected by MY_CLASSES frontend
    const mapped = assignments.map((a, i) => {
      // Generate a stable color based on index or ID
      const hues = [220, 160, 345, 45, 280];
      const hue = hues[i % hues.length];
      
      return {
        id: a.id,
        sectionId: a.section_id,
        grade: a.section.grade_level,
        section: a.section.name,
        subject: a.subject.name,
        students: a.section._count.enrollments,
        completion: 0, // Mocked until grades completion logic is implemented
        semester: currentYear.name,
        adviser: user.teacher ? (a.section as any).adviser_teacher_id === user.teacher.id : false,
        imgHue: `hsl(${hue},60%,34%)`
      };
    });

    // Also include sections where the teacher is designated Class Adviser
    const advisorySections = await prisma.section.findMany({
      where: {
        academic_year_id: currentYear.id,
        adviser_teacher_id: user.teacher.id,
      },
      include: {
        _count: {
          select: { enrollments: { where: { status: 'Enrolled' } } }
        }
      }
    });

    const mappedSectionIds = new Set(mapped.map(m => m.sectionId));
    for (const advSec of advisorySections) {
      if (!mappedSectionIds.has(advSec.id)) {
        mapped.push({
          id: `adv-${advSec.id}`,
          sectionId: advSec.id,
          grade: advSec.grade_level,
          section: advSec.name,
          subject: 'Advisory Class',
          students: advSec._count.enrollments,
          completion: 0,
          semester: currentYear.name,
          adviser: true,
          imgHue: 'hsl(142,60%,34%)'
        });
      }
    }

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

// ─── Enrollments ─────────────────────────────────────────────

/**
 * GET /api/academic/sections/:sectionId/enrollments
 */
router.get('/sections/:sectionId/enrollments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const sectionId = req.params.sectionId as string;

    const isGlobalViewer = authUser.roles.some(r => ['Admin', 'Principal', 'Registrar'].includes(r));

    if (!isGlobalViewer) {
      if (authUser.roles.includes('Teacher')) {
        // Must be a teacher assigned to this section OR the designated Section Class Adviser
        const isSectionAdviser = await prisma.section.findFirst({
          where: {
            id: sectionId,
            adviser_teacher: { user_id: authUser.id }
          }
        });
        const assignment = isSectionAdviser ? null : await prisma.teacherSubjectAssignment.findFirst({
          where: {
            section_id: sectionId,
            teacher: { user_id: authUser.id }
          }
        });
        if (!assignment && !isSectionAdviser) {
          throw new AppError(403, 'FORBIDDEN', 'You are not assigned to teach or advise this section.');
        }
      } else {
        // Students and any other roles
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view section enrollments.');
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { section_id: req.params.sectionId as string },
      include: {
        student: {
          include: {
            user: true
          }
        }
      }
    });

    res.json({ success: true, data: enrollments });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/sections/:sectionId/roster
 * Official section roster endpoint mirroring section enrollments.
 */
router.get('/sections/:sectionId/roster', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const sectionId = req.params.sectionId as string;

    const isGlobalViewer = authUser.roles.some(r => ['Admin', 'Principal', 'Registrar'].includes(r));

    if (!isGlobalViewer) {
      if (authUser.roles.includes('Teacher')) {
        const isSectionAdviser = await prisma.section.findFirst({
          where: {
            id: sectionId,
            adviser_teacher: { user_id: authUser.id }
          }
        });
        const assignment = isSectionAdviser ? null : await prisma.teacherSubjectAssignment.findFirst({
          where: {
            section_id: sectionId,
            teacher: { user_id: authUser.id }
          }
        });
        if (!assignment && !isSectionAdviser) {
          throw new AppError(403, 'FORBIDDEN', 'You are not assigned to teach or advise this section.');
        }
      } else {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view section roster.');
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { section_id: req.params.sectionId as string },
      include: {
        student: {
          include: {
            user: true
          }
        }
      }
    });

    res.json({ success: true, data: enrollments });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/sections/:sectionId/academic-overview
 * Read-only cross-subject academic performance overview.
 * Authorized for:
 * - Designated Class Adviser for this section
 * - Assigned Subject Teachers teaching any subject in this section
 * - Administrative personnel (Admin, Principal, Registrar, Guidance)
 * Returns enrolled students with their published grades across all subjects.
 * Strictly hides unpublished draft grades from unauthorized teachers/advisers.
 */
router.get('/sections/:sectionId/academic-overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const sectionId = req.params.sectionId as string;

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        academic_year: true,
        adviser_teacher: {
          include: { user: true }
        }
      }
    });

    if (!section) {
      throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found.`);
    }

    const isGlobal = authUser.roles.some(r => ['Admin', 'Principal', 'Registrar', 'Guidance'].includes(r));
    let isAdviser = false;
    let isSubjectTeacher = false;
    const editableSubjectIds: string[] = [];

    if (!isGlobal) {
      if (authUser.roles.includes('Teacher')) {
        const teacher = await prisma.teacher.findFirst({
          where: { user_id: authUser.id }
        });
        if (!teacher) {
          throw new AppError(403, 'FORBIDDEN', 'Teacher profile not found.');
        }

        isAdviser = section.adviser_teacher_id === teacher.id;
        const assignments = await prisma.teacherSubjectAssignment.findMany({
          where: { section_id: sectionId, teacher_id: teacher.id }
        });
        isSubjectTeacher = assignments.length > 0;
        assignments.forEach(a => editableSubjectIds.push(a.subject_id));

        // Strict Section Authorization Policy (Calulut Integrated School):
        // Only officially assigned Subject Teachers and the designated Class Adviser can view section overviews.
        // Unrelated teachers receive HTTP 403 Forbidden.
        if (!isAdviser && !isSubjectTeacher) {
          throw new AppError(403, 'FORBIDDEN', 'Access denied: You are neither the Class Adviser nor an assigned Subject Teacher for this section.');
        }
      } else {
        throw new AppError(403, 'FORBIDDEN', 'Access denied.');
      }
    } else {
      isAdviser = true;
    }

    // Enrolled learners
    const enrollments = await prisma.enrollment.findMany({
      where: { section_id: sectionId, status: 'Enrolled' },
      include: {
        student: {
          include: { user: true }
        }
      },
      orderBy: [
        { student: { user: { last_name: 'asc' } } },
        { student: { user: { first_name: 'asc' } } }
      ]
    });

    // All section subject assignments
    const sectionAssignments = await prisma.teacherSubjectAssignment.findMany({
      where: { section_id: sectionId },
      include: {
        subject: true,
        teacher: { include: { user: true } },
        gradebooks: {
          include: { term: true }
        }
      },
      orderBy: { subject: { name: 'asc' } }
    });

    // Configured terms for this academic year
    const configuredTerms = await prisma.term.findMany({
      where: { academic_year_id: section.academic_year_id },
      orderBy: { key: 'asc' }
    });
    const termKeys = configuredTerms.length > 0 ? configuredTerms.map(t => t.key) : ['T1', 'T2', 'T3'];

    // Map published gradebooks for this section
    const publishedGbMap = new Set<string>(); // `${subjectId}:${termKey}`
    for (const a of sectionAssignments) {
      for (const gb of a.gradebooks) {
        if (gb.status === 'Published') {
          publishedGbMap.add(`${a.subject_id}:${gb.term.key}`);
        }
      }
    }

    // Student IDs
    const studentIds = enrollments.map(e => e.student_id);

    // Fetch grades
    const grades = await prisma.grade.findMany({
      where: {
        student_id: { in: studentIds },
        academic_year_id: section.academic_year_id,
      },
      include: {
        published_gradebook: true,
        subject: true
      }
    });

    // Index grades by `${studentId}:${subjectId}:${term}`
    const gradeIndex = new Map<string, any>();
    for (const g of grades) {
      gradeIndex.set(`${g.student_id}:${g.subject_id}:${g.term}`, g);
    }

    // Build subject list
    const subjects = sectionAssignments.map(a => ({
      id: a.subject.id,
      name: a.subject.name,
      code: a.subject.code || '',
      teacherName: a.teacher?.user ? `${a.teacher.user.first_name} ${a.teacher.user.last_name}` : 'Unassigned',
      teacherId: a.teacher_id,
      assignmentId: a.id,
      isEditableByMe: editableSubjectIds.includes(a.subject_id)
    }));

    // Build student rows
    const studentRows = enrollments.map(e => {
      const s = e.student;
      const user = (s.user || {}) as any;

      const subjectGrades: Record<string, any> = {};
      let totalPublishedFinal = 0;
      let countPublishedFinal = 0;

      for (const subj of subjects) {
        const termScores: Record<string, number | null> = {};
        const termPublished: Record<string, boolean> = {};

        for (const t of termKeys) {
          const key = `${s.id}:${subj.id}:${t}`;
          const g = gradeIndex.get(key);
          const isPublished = publishedGbMap.has(`${subj.id}:${t}`) || (g && g.published_term_grade !== null) || (g && g.published_gradebook?.status === 'Published');

          termPublished[t] = !!isPublished;
          if (isPublished && g) {
            termScores[t] = g.published_term_grade ?? (g.term_grade !== null ? Math.round(g.term_grade) : null);
          } else {
            termScores[t] = null; // Strictly null for unpublished or missing grades
          }
        }

        // Final rating for this subject if all configured terms are published
        let finalRating: number | null = null;
        let remarks: 'PASSED' | 'FAILED' | null = null;
        const allTermsPublished = termKeys.every(t => termPublished[t] && termScores[t] !== null);

        if (allTermsPublished && termKeys.length > 0) {
          const sum = termKeys.reduce((acc, t) => acc + (termScores[t] || 0), 0);
          finalRating = Math.round(sum / termKeys.length);
          remarks = finalRating >= 75 ? 'PASSED' : 'FAILED';
          totalPublishedFinal += finalRating;
          countPublishedFinal++;
        }

        subjectGrades[subj.id] = {
          subjectId: subj.id,
          subjectName: subj.name,
          terms: termScores,
          isPublished: termPublished,
          finalRating,
          remarks
        };
      }

      const generalAverage = countPublishedFinal === subjects.length && subjects.length > 0
        ? Math.round(totalPublishedFinal / subjects.length)
        : null;

      return {
        studentId: s.id,
        enrollmentId: e.id,
        lrn: s.lrn || '',
        name: `${user.last_name || ''}, ${user.first_name || ''}`.trim(),
        gender: user.gender || 'Unknown',
        grades: subjectGrades,
        generalAverage,
      };
    });

    res.json({
      success: true,
      data: {
        section: {
          id: section.id,
          name: section.name,
          gradeLevel: section.grade_level,
          academicYear: section.academic_year?.name || 'SY 2026-2027',
          adviserName: section.adviser_teacher?.user
            ? `${section.adviser_teacher.user.first_name} ${section.adviser_teacher.user.last_name}`
            : 'Unassigned',
          adviserEmployeeId: section.adviser_teacher?.employee_id || null,
        },
        viewer: {
          isClassAdviser: isAdviser,
          isSubjectTeacher,
          canEditAny: editableSubjectIds.length > 0,
          editableSubjectIds,
        },
        terms: termKeys,
        subjects,
        students: studentRows,
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/sections/:sectionId/term-summary
 * Official Calulut Integrated School Consolidated Section-Level Term Summary.
 * Visual and structural replica of SF9 7-Agoncillo (SY 2026-2027) (1).xlsx:
 * - Replicates TERM 1 SUMMARY, TERM 2 SUMMARY, and TERM 3 SUMMARY layouts
 * - Segregated Male and Female rosters (numbered 1..N)
 * - Standard Calulut subject order: Filipino, English, Math, Science, AP, GMRC/VE, EPP/TLE, MA, PEH, MAPEH composite
 * - MAPEH composite = ROUND((MA + PEH) / 2, 0) (Requires both components to be complete)
 * - Overall Term Average = ROUND((7 Core + 1 MAPEH) / 8, 0)
 * - Provisional Term Average flagged with missing count if 1 <= completed < 8
 * - Class Ranking calculated using RANK.AVG (fractional ties) exclusively for 100% complete learners
 * - Incomplete learners receive Rank: Pending
 * Authorized for:
 * - Assigned Subject Teachers teaching in this section
 * - Designated Class Adviser for this section
 * - Administrative personnel (Admin, Principal, Registrar, Guidance)
 * Unrelated teachers receive HTTP 403 Forbidden.
 */
router.get('/sections/:sectionId/term-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const sectionId = req.params.sectionId as string;
    const termKey = ((req.query.term as string) || 'T1').toUpperCase();

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        academic_year: true,
        adviser_teacher: {
          include: { user: true }
        }
      }
    });

    if (!section) {
      throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found.`);
    }

    const isGlobal = authUser.roles.some(r => ['Admin', 'Principal', 'Registrar', 'Guidance'].includes(r));
    let isAdviser = false;
    let isSubjectTeacher = false;
    const editableSubjectIds: string[] = [];

    if (!isGlobal) {
      if (authUser.roles.includes('Teacher')) {
        const teacher = await prisma.teacher.findFirst({
          where: { user_id: authUser.id }
        });
        if (!teacher) {
          throw new AppError(403, 'FORBIDDEN', 'Teacher profile not found.');
        }

        isAdviser = section.adviser_teacher_id === teacher.id;
        const assignments = await prisma.teacherSubjectAssignment.findMany({
          where: { section_id: sectionId, teacher_id: teacher.id }
        });
        isSubjectTeacher = assignments.length > 0;
        assignments.forEach(a => editableSubjectIds.push(a.subject_id));

        if (!isAdviser && !isSubjectTeacher) {
          throw new AppError(403, 'FORBIDDEN', 'Access denied: You are neither the Class Adviser nor an assigned Subject Teacher for this section.');
        }
      } else {
        throw new AppError(403, 'FORBIDDEN', 'Access denied: Teacher or administrative role required.');
      }
    } else {
      isAdviser = true;
    }

    const termLabelMap: Record<string, string> = {
      'T1': 'FIRST TERM',
      'T2': 'SECOND TERM',
      'T3': 'THIRD TERM'
    };
    const termLabel = termLabelMap[termKey] || `${termKey} TERM`;

    const settings = await prisma.schoolSettings.findFirst();
    const school = {
      name: settings?.school_name || 'Calulut Integrated School',
      schoolId: settings?.school_id || '500146',
      region: settings?.region || 'Region III',
      division: settings?.division || 'City of San Fernando (P)',
      academicYear: section.academic_year?.name || '2026-2027',
      schoolHead: settings?.school_head_name || 'APRIL G. CONCEPCION'
    };

    const adviserUser = section.adviser_teacher?.user;
    const adviserName = adviserUser
      ? `${adviserUser.last_name || ''}, ${adviserUser.first_name || ''}${adviserUser.middle_name ? ' ' + adviserUser.middle_name : ''}`.toUpperCase().trim()
      : 'UNASSIGNED';

    const sectionAssignments = await prisma.teacherSubjectAssignment.findMany({
      where: { section_id: sectionId },
      include: {
        subject: true,
        teacher: { include: { user: true } },
        gradebooks: {
          where: { term: { key: termKey as any } },
          include: { term: true }
        }
      }
    });

    const gradeLevel = section.grade_level;

    // Fetch all catalog subjects in the database
    const allCatalogSubjects = await prisma.subject.findMany();

    const publishedGbMap = new Set<string>();
    for (const a of sectionAssignments) {
      for (const gb of a.gradebooks) {
        if (gb.status === 'Published') {
          publishedGbMap.add(a.subject_id);
        }
      }
    }

    // Official Calulut / DepEd JHS Curriculum Standard (8 Canonical Learning Areas):
    // 1. Filipino, 2. English, 3. Mathematics, 4. Science, 5. Araling Panlipunan,
    // 6. Values Education, 7. TLE, 8. MAPEH (Music & Arts, Physical Education & Health)
    const canonicalAreaDefs = [
      {
        order: 1,
        key: 'filipino',
        defaultCode: `FIL${gradeLevel}`,
        defaultName: `Filipino ${gradeLevel}`,
        matcher: (c: string, n: string) => c.startsWith('FIL') || n.includes('filipino')
      },
      {
        order: 2,
        key: 'english',
        defaultCode: `ENG${gradeLevel}`,
        defaultName: `English ${gradeLevel}`,
        matcher: (c: string, n: string) => c.startsWith('ENG') || n.includes('english')
      },
      {
        order: 3,
        key: 'math',
        defaultCode: `MATH${gradeLevel}`,
        defaultName: `Mathematics ${gradeLevel}`,
        matcher: (c: string, n: string) => c.startsWith('MATH') || (c.startsWith('MA') && !c.startsWith('MA1') && !c.startsWith('MA7') && !c.startsWith('MA8') && !c.startsWith('MA9') && !n.includes('music')) || n.includes('math')
      },
      {
        order: 4,
        key: 'science',
        defaultCode: `SCI${gradeLevel}`,
        defaultName: `Science ${gradeLevel}`,
        matcher: (c: string, n: string) => c.startsWith('SCI') || n.includes('science')
      },
      {
        order: 5,
        key: 'ap',
        defaultCode: `AP${gradeLevel}`,
        defaultName: `Araling Panlipunan ${gradeLevel}`,
        matcher: (c: string, n: string) => c.startsWith('AP') || n.includes('araling panlipunan')
      },
      {
        order: 6,
        key: 've',
        defaultCode: `VE${gradeLevel}`,
        defaultName: `Values Education ${gradeLevel}`,
        matcher: (c: string, n: string) => c.startsWith('VE') || c.startsWith('GMRC') || n.includes('values') || n.includes('gmrc') || n.includes('edukasyon sa pagpapakatao')
      },
      {
        order: 7,
        key: 'tle',
        defaultCode: `TLE${gradeLevel}`,
        defaultName: `Technology and Livelihood Education ${gradeLevel}`,
        matcher: (c: string, n: string) => c.startsWith('TLE') || c.startsWith('EPP') || n.includes('technology') || n.includes('epp')
      },
      {
        order: 8,
        key: 'ma',
        defaultCode: `MA${gradeLevel}`,
        defaultName: `Music and Arts ${gradeLevel}`,
        isMAPEHComponent: 'MA' as const,
        matcher: (c: string, n: string) => (c.startsWith('MA') && !c.startsWith('MATH')) || n.includes('music')
      },
      {
        order: 9,
        key: 'peh',
        defaultCode: `PEH${gradeLevel}`,
        defaultName: `Physical Education and Health ${gradeLevel}`,
        isMAPEHComponent: 'PEH' as const,
        matcher: (c: string, n: string) => c.startsWith('PEH') || n.includes('physical education') || n.includes('health')
      }
    ];

    const gradeCatalogSubjects = allCatalogSubjects.filter(subj => {
      const g = resolveSubjectGradeLevel(subj);
      return g === null || g === gradeLevel;
    });

    const resolvedSubjects = canonicalAreaDefs.map(def => {
      // Situation A: Subject exists and teacher is assigned to this section
      const asgn = sectionAssignments.find(a => def.matcher(a.subject.code.toUpperCase(), a.subject.name.toLowerCase()));
      if (asgn) {
        return {
          id: asgn.subject.id,
          code: asgn.subject.code,
          name: asgn.subject.name,
          teacherName: asgn.teacher?.user ? `${asgn.teacher.user.first_name} ${asgn.teacher.user.last_name}` : 'Unassigned',
          teacherId: asgn.teacher_id,
          assignmentId: asgn.id,
          status: 'ASSIGNED' as const,
          isAssigned: true,
          isConfiguredInCurriculum: true,
          isEditableByMe: editableSubjectIds.includes(asgn.subject_id),
          isPublished: publishedGbMap.has(asgn.subject_id),
          subjectId: asgn.subject.id,
          isMAPEHComponent: def.isMAPEHComponent
        };
      }

      // Situation B: Subject exists in curriculum catalog for this grade level, but teacher is NOT assigned to this section
      const catalogSubj = gradeCatalogSubjects.find(s => def.matcher(s.code.toUpperCase(), s.name.toLowerCase()));
      if (catalogSubj) {
        return {
          id: catalogSubj.id,
          code: catalogSubj.code,
          name: catalogSubj.name,
          teacherName: 'Unassigned',
          teacherId: null,
          assignmentId: null,
          status: 'UNASSIGNED' as const,
          isAssigned: false,
          isConfiguredInCurriculum: true,
          isEditableByMe: false,
          isPublished: false,
          subjectId: catalogSubj.id,
          isMAPEHComponent: def.isMAPEHComponent
        };
      }

      // Situation C: Canonical curriculum learning area, but Subject record not yet provisioned in DB
      return {
        id: def.defaultCode,
        code: def.defaultCode,
        name: def.defaultName,
        teacherName: 'Not in Catalog',
        teacherId: null,
        assignmentId: null,
        status: 'NOT_IN_CATALOG' as const,
        isAssigned: false,
        isConfiguredInCurriculum: false,
        isEditableByMe: false,
        isPublished: false,
        subjectId: null,
        isMAPEHComponent: def.isMAPEHComponent
      };
    });

    const coreAreas = resolvedSubjects.filter(s => !s.isMAPEHComponent);
    const maArea = resolvedSubjects.find(s => s.isMAPEHComponent === 'MA')!;
    const pehArea = resolvedSubjects.find(s => s.isMAPEHComponent === 'PEH')!;

    const enrollments = await prisma.enrollment.findMany({
      where: { section_id: sectionId, status: 'Enrolled' },
      include: {
        student: {
          include: { user: true }
        }
      }
    });

    const isMale = (gender?: string | null) => {
      if (!gender) return false;
      const g = gender.toLowerCase().trim();
      return g === 'male' || g === 'm';
    };

    const sortFn = (a: any, b: any) => {
      const lastA = (a.student.last_name || a.student.user?.last_name || '').toUpperCase();
      const lastB = (b.student.last_name || b.student.user?.last_name || '').toUpperCase();
      if (lastA !== lastB) return lastA.localeCompare(lastB);
      const firstA = (a.student.first_name || a.student.user?.first_name || '').toUpperCase();
      const firstB = (b.student.first_name || b.student.user?.first_name || '').toUpperCase();
      return firstA.localeCompare(firstB);
    };

    const maleEnrollments = enrollments.filter(e => isMale(e.student.gender)).sort(sortFn);
    const femaleEnrollments = enrollments.filter(e => !isMale(e.student.gender)).sort(sortFn);

    const studentIds = enrollments.map(e => e.student_id);
    const grades = await prisma.grade.findMany({
      where: {
        student_id: { in: studentIds },
        academic_year_id: section.academic_year_id,
        term: termKey as any
      },
      include: {
        published_gradebook: true,
        subject: true
      }
    });

    const gradeIndex = new Map<string, any>();
    for (const g of grades) {
      gradeIndex.set(`${g.student_id}:${g.subject_id}`, g);
    }

    const processLearner = (e: any, idx: number, sexChar: 'M' | 'F') => {
      const s = e.student;
      const u = s.user || {};

      const lastName = s.last_name || u.last_name || '';
      const firstName = s.first_name || u.first_name || '';
      const middleVal = s.middle_name || u.middle_name;
      const middle = middleVal ? ` ${middleVal}` : '';
      const name = `${lastName}, ${firstName}${middle}`.toUpperCase().trim();

      let dobString: string | null = null;
      let age: number | null = null;
      if (s.date_of_birth) {
        const dob = new Date(s.date_of_birth);
        if (!isNaN(dob.getTime())) {
          dobString = dob.toISOString().split('T')[0];
          const now = new Date();
          age = now.getFullYear() - dob.getFullYear();
          const m = now.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
            age--;
          }
        }
      }

      const coreGrades: Record<string, number | null> = {};
      let completedCoreCount = 0;
      let sumCore = 0;

      for (const core of coreAreas) {
        let score: number | null = null;
        if (core.subjectId && core.isAssigned) {
          const g = gradeIndex.get(`${s.id}:${core.subjectId}`);
          const isPublished = (core.isPublished && g?.published_gradebook?.status === 'Published') || (g && typeof g.published_term_grade === 'number');
          if (isPublished && g && typeof g.published_term_grade === 'number') {
            score = g.published_term_grade;
          }
        }
        coreGrades[core.code] = score;
        if (score !== null) {
          completedCoreCount++;
          sumCore += score;
        }
      }

      let maGrade: number | null = null;
      if (maArea.subjectId && maArea.isAssigned) {
        const g = gradeIndex.get(`${s.id}:${maArea.subjectId}`);
        const isPublished = (maArea.isPublished && g?.published_gradebook?.status === 'Published') || (g && typeof g.published_term_grade === 'number');
        if (isPublished && g && typeof g.published_term_grade === 'number') {
          maGrade = g.published_term_grade;
        }
      }

      let pehGrade: number | null = null;
      if (pehArea.subjectId && pehArea.isAssigned) {
        const g = gradeIndex.get(`${s.id}:${pehArea.subjectId}`);
        const isPublished = (pehArea.isPublished && g?.published_gradebook?.status === 'Published') || (g && typeof g.published_term_grade === 'number');
        if (isPublished && g && typeof g.published_term_grade === 'number') {
          pehGrade = g.published_term_grade;
        }
      }

      const isMapehComplete = maGrade !== null && pehGrade !== null;
      let mapehCompositeGrade: number | null = null;
      if (isMapehComplete) {
        mapehCompositeGrade = Math.round((maGrade! + pehGrade!) / 2);
      } else if (maGrade !== null || pehGrade !== null) {
        mapehCompositeGrade = maGrade !== null ? maGrade : pehGrade;
      }

      const totalExpectedLearningAreas = 8;
      const hasMapehComplete = isMapehComplete && mapehCompositeGrade !== null;
      const totalCompletedAreas = completedCoreCount + (hasMapehComplete ? 1 : 0);

      const isComplete = totalCompletedAreas === totalExpectedLearningAreas;
      let finalGrade: number | null = null;
      let isProvisional = false;
      let missingCount = totalExpectedLearningAreas - totalCompletedAreas;

      if (isComplete) {
        finalGrade = Math.round((sumCore + mapehCompositeGrade!) / totalExpectedLearningAreas);
        isProvisional = false;
        missingCount = 0;
      } else if (totalCompletedAreas > 0) {
        const sumCompleted = sumCore + (hasMapehComplete ? mapehCompositeGrade! : 0);
        finalGrade = Math.round(sumCompleted / totalCompletedAreas);
        isProvisional = true;
      } else {
        finalGrade = null;
        isProvisional = false;
        missingCount = totalExpectedLearningAreas;
      }

      return {
        no: idx + 1,
        studentId: s.id,
        enrollmentId: e.id,
        lrn: s.lrn || '',
        name,
        dateOfBirth: dobString,
        age,
        sex: sexChar,
        grades: coreGrades,
        mapeh: {
          musicArts: maGrade,
          peHealth: pehGrade,
          termGrade: mapehCompositeGrade,
          isComplete: isMapehComplete
        },
        termAverage: finalGrade,
        isComplete,
        isProvisional,
        missingCount,
        rank: null as number | null,
        rankDisplay: '—'
      };
    };

    const maleLearners = maleEnrollments.map((e, idx) => processLearner(e, idx, 'M'));
    const femaleLearners = femaleEnrollments.map((e, idx) => processLearner(e, idx, 'F'));

    const allLearners = [...maleLearners, ...femaleLearners];
    const eligibleLearners = allLearners.filter(l => l.isComplete && l.termAverage !== null);

    for (const l of eligibleLearners) {
      const myScore = l.termAverage!;
      let higherCount = 0;
      let tiedCount = 0;
      for (const other of eligibleLearners) {
        if (other.termAverage! > myScore) {
          higherCount++;
        } else if (other.termAverage! === myScore) {
          tiedCount++;
        }
      }
      const rankAvg = 1 + higherCount + (tiedCount - 1) / 2;
      l.rank = rankAvg;
      l.rankDisplay = Number.isInteger(rankAvg) ? rankAvg.toString() : rankAvg.toFixed(1);
    }

    for (const l of allLearners) {
      if (!l.isComplete) {
        l.rank = null;
        l.rankDisplay = 'Pending';
      }
    }

    const completeAverages = eligibleLearners.map(l => l.termAverage!);
    const classAverage = completeAverages.length > 0
      ? Math.round(completeAverages.reduce((a, b) => a + b, 0) / completeAverages.length)
      : null;

    const subjectsSummary = resolvedSubjects.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      teacherName: s.teacherName,
      teacherId: s.teacherId,
      assignmentId: s.assignmentId,
      status: s.status,
      isAssigned: s.isAssigned,
      isConfiguredInCurriculum: s.isConfiguredInCurriculum,
      isEditableByMe: s.isEditableByMe,
      isPublished: s.isPublished
    }));

    res.json({
      success: true,
      data: {
        school,
        section: {
          id: section.id,
          name: section.name,
          gradeLevel: section.grade_level,
          adviserName,
          adviserId: section.adviser_teacher_id,
          term: termKey,
          termLabel
        },
        subjects: subjectsSummary,
        males: maleLearners,
        females: femaleLearners,
        stats: {
          totalEnrolled: enrollments.length,
          maleCount: maleLearners.length,
          femaleCount: femaleLearners.length,
          completeCount: eligibleLearners.length,
          provisionalCount: allLearners.filter(l => l.isProvisional).length,
          pendingCount: allLearners.filter(l => !l.isComplete && !l.isProvisional).length,
          classAverage
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/school/students-grades
 * School-Wide Cross-Subject Student Grade Directory.
 * Authorized for:
 * - Administrative personnel (Admin, Principal, Registrar, Guidance)
 * Strictly hides unpublished draft scores and private medical records.
 * Ordinary teachers must use section-specific consolidated summaries for their assigned sections.
 */
router.get('/school/students-grades', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const isGlobal = authUser.roles.some(r => ['Admin', 'Principal', 'Registrar', 'Guidance'].includes(r));

    if (!isGlobal) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied: Administrative oversight role required.');
    }

    const { search, gradeLevel, sectionId, academicYearId } = req.query;

    // Find target academic year
    let targetAyId = academicYearId as string;
    if (!targetAyId) {
      const currentAy = await prisma.academicYear.findFirst({
        where: { is_current: true }
      });
      targetAyId = currentAy?.id || '';
    }

    const ay = await prisma.academicYear.findUnique({
      where: { id: targetAyId }
    });

    if (!ay) {
      throw new AppError(404, 'NOT_FOUND', 'Academic year not found.');
    }

    // Build enrollment where clause
    const enrollmentWhere: any = {
      academic_year_id: targetAyId,
      status: 'Enrolled'
    };

    if (sectionId) {
      enrollmentWhere.section_id = sectionId as string;
    }

    if (gradeLevel) {
      const gl = parseInt(gradeLevel as string, 10);
      if (!isNaN(gl)) {
        enrollmentWhere.section = { grade_level: gl };
      }
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const term = search.trim();
      enrollmentWhere.OR = [
        { student: { lrn: { contains: term, mode: 'insensitive' } } },
        { student: { user: { first_name: { contains: term, mode: 'insensitive' } } } },
        { student: { user: { last_name: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    // Fetch enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: enrollmentWhere,
      include: {
        student: {
          include: { user: true }
        },
        section: {
          include: {
            adviser_teacher: {
              include: { user: true }
            },
            assignments: {
              include: {
                subject: true,
                teacher: { include: { user: true } },
                gradebooks: {
                  include: { term: true }
                }
              },
              orderBy: { subject: { name: 'asc' } }
            }
          }
        }
      },
      orderBy: [
        { section: { grade_level: 'asc' } },
        { section: { name: 'asc' } },
        { student: { user: { last_name: 'asc' } } },
        { student: { user: { first_name: 'asc' } } }
      ]
    });

    // Student IDs
    const studentIds = enrollments.map(e => e.student_id);

    // Fetch grades for these students in this academic year
    const grades = await prisma.grade.findMany({
      where: {
        student_id: { in: studentIds },
        academic_year_id: targetAyId,
      },
      include: {
        published_gradebook: true
      }
    });

    // Map grades: `${studentId}:${subjectId}:${termKey}` -> Grade
    const gradeMap = new Map<string, any>();
    for (const g of grades) {
      gradeMap.set(`${g.student_id}:${g.subject_id}:${g.term}`, g);
    }

    // Terms
    const termRecords = await prisma.term.findMany({
      where: { academic_year_id: targetAyId },
      orderBy: { key: 'asc' }
    });
    const termKeys = termRecords.length > 0 ? termRecords.map(t => t.key) : ['T1', 'T2', 'T3'];

    // Map results
    const studentsData = enrollments.map(e => {
      const s = e.student;
      const u = s.user || ({} as any);
      const sec = e.section;

      let totalSubjectFinals = 0;
      let countPublishedSubjects = 0;

      const subjectsData = sec.assignments.map(a => {
        const termsData: Record<string, any> = {};
        const subjectPublishedTerms: number[] = [];

        for (const t of termKeys) {
          const key = `${s.id}:${a.subject_id}:${t}`;
          const g = gradeMap.get(key);

          // Check if published
          const isGbPublished = a.gradebooks.some(gb => gb.term.key === t && gb.status === 'Published');
          const isGradePublished = g && g.published_term_grade !== null;
          const isPublished = isGbPublished || isGradePublished;

          if (isPublished && g && g.published_term_grade !== null) {
            const isAdjusted = g.publication_correction_reason && g.publication_correction_reason.toLowerCase().includes('consideration');
            termsData[t] = {
              score: g.published_term_grade,
              status: isAdjusted ? 'ADJUSTED' : 'PUBLISHED',
              isAdjusted: !!isAdjusted,
              adjustmentReason: isAdjusted ? g.publication_correction_reason : undefined,
            };
            subjectPublishedTerms.push(g.published_term_grade);
          } else if (g && g.term_grade !== null) {
            // Assessment encoded but not published -> MUST NOT expose raw score to other teachers
            termsData[t] = {
              score: null,
              status: 'UNPUBLISHED',
              isAdjusted: false,
            };
          } else {
            termsData[t] = {
              score: null,
              status: 'NOT_ENCODED',
              isAdjusted: false,
            };
          }
        }

        // Final rating for subject if all terms published
        let finalRating: number | null = null;
        let remarks: 'PASSED' | 'FAILED' | null = null;
        if (subjectPublishedTerms.length === termKeys.length && termKeys.length > 0) {
          const sum = subjectPublishedTerms.reduce((acc, val) => acc + val, 0);
          finalRating = Math.round(sum / termKeys.length);
          remarks = finalRating >= 75 ? 'PASSED' : 'FAILED';
          totalSubjectFinals += finalRating;
          countPublishedSubjects++;
        }

        return {
          subjectId: a.subject.id,
          subjectName: a.subject.name,
          subjectCode: a.subject.code || '',
          teacherName: a.teacher?.user
            ? `${a.teacher.user.first_name} ${a.teacher.user.last_name}`
            : 'Unassigned',
          teacherEmployeeId: a.teacher?.employee_id || null,
          terms: termsData,
          finalRating,
          remarks
        };
      });

      const generalAverage = (countPublishedSubjects === sec.assignments.length && sec.assignments.length > 0)
        ? Math.round(totalSubjectFinals / sec.assignments.length)
        : null;

      return {
        studentId: s.id,
        enrollmentId: e.id,
        lrn: s.lrn || '',
        name: `${u.last_name || ''}, ${u.first_name || ''}${u.middle_name ? ' ' + u.middle_name : ''}`.trim(),
        gender: u.gender || 'Unknown',
        gradeLevel: sec.grade_level,
        sectionId: sec.id,
        sectionName: sec.name,
        adviserName: sec.adviser_teacher?.user
          ? `${sec.adviser_teacher.user.first_name} ${sec.adviser_teacher.user.last_name}`
          : 'Unassigned',
        generalAverage,
        generalAverageRemarks: generalAverage ? (generalAverage >= 75 ? 'PASSED' : 'FAILED') : null,
        subjects: subjectsData,
      };
    });

    res.json({
      success: true,
      data: {
        academicYear: { id: ay.id, name: ay.name },
        terms: termKeys,
        totalStudents: studentsData.length,
        students: studentsData
      }
    });
  } catch (err) {
    next(err);
  }
});

// ─── Section Class Adviser & Signatories ─────────────────────

/**
 * PATCH /api/academic/sections/:sectionId/adviser
 * Assigns or updates the designated class adviser for a section.
 */
router.patch('/sections/:sectionId/adviser', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const { teacherId, effectiveStartDate } = req.body;
    const authUser = (req as any).user as AuthenticatedUser;

    if (!teacherId || typeof teacherId !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid teacherId is required' });
    }

    const result = await assignSectionClassAdviser(prisma as any, {
      sectionId,
      adviserTeacherId: teacherId,
      actorUserId: authUser.id,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/sections/:sectionId/signatories
 * Resolves the class adviser, head teacher, and principal names for official forms.
 */
router.get('/sections/:sectionId/signatories', requirePermissions('academic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const { academicYearId } = req.query;

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });
    if (!section) throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found`);

    const ayId = (academicYearId as string) || section.academic_year_id;

    const signatories = await resolvePersistedSf9Signatories(prisma as any, {
      sectionId,
      academicYearId: ayId,
    });

    res.json({ success: true, data: signatories });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/academic/settings/signatories
 * Updates school-level head signatories (Principal, Head Teacher).
 */
router.patch('/settings/signatories', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { schoolHeadName, schoolHeadTitle, schoolName, schoolId } = req.body;
    const authUser = (req as any).user as AuthenticatedUser;

    const updated = await (prisma as any).schoolSettings.upsert({
      where: { id: 'default' },
      update: {
        ...(schoolHeadName !== undefined ? { school_head_name: schoolHeadName } : {}),
        ...(schoolHeadTitle !== undefined ? { school_head_title: schoolHeadTitle } : {}),
        ...(schoolName !== undefined ? { school_name: schoolName } : {}),
        ...(schoolId !== undefined ? { school_id: schoolId } : {}),
      },
      create: {
        id: 'default',
        school_name: schoolName || 'Calulut Integrated School',
        school_short_name: 'CIS',
        school_head_name: schoolHeadName || null,
        school_head_title: schoolHeadTitle || 'Principal IV',
        school_id: schoolId || '500146',
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
