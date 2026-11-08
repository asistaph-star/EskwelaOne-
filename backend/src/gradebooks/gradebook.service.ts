import { z } from 'zod';
import prisma from '../config/database.js';
import { withTransaction } from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { classifyAcademicYearLifecycle } from '../common/utils/calendarValidation.js';
import { createAuditLog } from '../audit/audit.service.js';
import {
  calculateStudentTermGrade,
  getGradingPolicy,
  roundHalfUp,
  type StudentTermScoreInput,
} from '../academic/grading/index.js';
import { resolveSubjectGroup } from './ledger.service.js';

// ─── DTOs ──────────────────────────────────────────────────

export const upsertGradeSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  term: z.enum(['T1', 'T2', 'T3', 'T4']),
  schoolYear: z.string().min(1),
  writtenWork: z.number().finite().min(0).max(100).optional().nullable(),
  performanceTask: z.number().finite().min(0).max(100).optional().nullable(),
  termAssessment: z.number().finite().min(0).max(100).optional().nullable(),
  termGrade: z.number().finite().min(0).max(100).optional().nullable(),
});

// ─── SERVICE ───────────────────────────────────────────────

/**
 * Create or update a grade entry.
 * Note: Under DepEd Order No. 015, s. 2026, direct manual injection of final term grades
 * without underlying assessment ledger entries is strictly prohibited.
 */
export async function upsertGrade(
  input: z.infer<typeof upsertGradeSchema>,
  actorId: string,
  correlationId?: string,
) {
  throw new AppError(
    403,
    'DIRECT_GRADE_MUTATION_PROHIBITED',
    'Direct manual entry or mutation of final term grades is prohibited under DepEd Order No. 015, s. 2026. All grades must be derived from recorded Written Work, Performance Tasks, and Quarterly Assessments encoded in the Gradebook Ledger.'
  );
}

/**
 * Get grades for a specific section, subject, term, and school year.
 */
export async function getGradesForSectionAndSubject(
  sectionId: string,
  subjectId: string,
  term: 'T1' | 'T2' | 'T3' | 'T4',
  schoolYear: string,
  requestingUserId: string,
) {
  // Enforce ownership check
  const assignment = await prisma.teacherSubjectAssignment.findFirst({
    where: {
      section_id: sectionId,
      subject_id: subjectId,
      teacher: { user_id: requestingUserId }
    }
  });

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You are not assigned to teach this subject for this section.');
  }

  const academicYear = await prisma.academicYear.findUnique({
    where: { name: schoolYear }
  });
  if (!academicYear) throw new AppError(404, 'NOT_FOUND', 'Academic year not found');
  const academic_year_id = academicYear.id;

  const enrollments = await prisma.enrollment.findMany({
    where: { section_id: sectionId, academic_year_id, status: 'Enrolled' },
    include: { student: { include: { user: true } } },
    orderBy: { student: { user: { last_name: 'asc' } } }
  });

  const studentIds = enrollments.map(e => e.student_id);

  const rawGrades = await prisma.grade.findMany({
    where: {
      student_id: { in: studentIds },
      subject_id: subjectId,
      term,
      academic_year_id,
    },
    include: { academic_year: true }
  });

  const grades = rawGrades.map(g => ({
    ...g,
    school_year: g.academic_year.name
  }));

  return {
    enrollments,
    grades,
  };
}

export interface PublishGradebookInput {
  gradebookId: string;
  actorUserId: string;
  actorRole: string;
  expectedVersion?: number;
  correctionReason?: string;
  correlationId?: string;
}

export async function publishGradebook(input: PublishGradebookInput) {
  return withTransaction(async (tx) => {
    const gb = await tx.gradebooks.findUnique({
      where: { id: input.gradebookId },
      include: {
        assignment: {
          include: {
            teacher: true,
            section: true,
            subject: true,
            academic_year: true,
          },
        },
        term: true,
      },
    });

    if (!gb) {
      throw new AppError(404, 'NOT_FOUND', `Gradebook ${input.gradebookId} not found`);
    }

    const lifecycle = classifyAcademicYearLifecycle(gb.assignment.academic_year);
    if (lifecycle === 'HISTORICAL') {
      throw new AppError(403, 'HISTORICAL_GRADEBOOK_READ_ONLY', 'Cannot publish or modify a gradebook for a historical academic year. Historical records are strictly read-only.');
    }
    if (lifecycle === 'UPCOMING') {
      throw new AppError(403, 'UPCOMING_ACADEMIC_YEAR_INACTIVE', 'Cannot publish grades for an upcoming academic year that has not yet become active.');
    }

    // Role check: must be the assigned subject teacher or Admin/Principal/Registrar
    const isAssignedTeacher = gb.assignment.teacher.user_id === input.actorUserId;
    const isStaffOverride = ['Admin', 'Principal', 'Registrar'].includes(input.actorRole);
    if (!isAssignedTeacher && !isStaffOverride) {
      throw new AppError(403, 'FORBIDDEN', 'Only the assigned subject teacher or Admin/Principal/Registrar can publish this gradebook');
    }

    // Concurrency check
    if (input.expectedVersion !== undefined && gb.version !== input.expectedVersion) {
      throw new AppError(409, 'CONFLICT', `Gradebook version mismatch. Current: ${gb.version}, Expected: ${input.expectedVersion}`);
    }

    const isRepublication = gb.status === 'Published';
    if (isRepublication) {
      if (!isStaffOverride && (!input.correctionReason || input.correctionReason.trim().length < 5)) {
        throw new AppError(409, 'PUBLISHED_GRADE_SNAPSHOT_PROTECTED', 'Re-publishing an already published gradebook requires a correction reason of at least 5 characters');
      }
    }

    // Get active enrolled students
    const enrollments = await tx.enrollment.findMany({
      where: {
        section_id: gb.assignment.section_id,
        status: 'Enrolled',
      },
      include: {
        student: { include: { user: true } },
      },
    });

    if (enrollments.length === 0) {
      throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Cannot publish gradebook: section has no enrolled students');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CENTRALIZED ACADEMIC INTEGRITY & ASSESSMENT PROVENANCE VALIDATION
    // Under DepEd Order No. 015, s. 2026:
    // 1. Assessment columns must exist in the gradebook.
    // 2. All 3 required assessment pillars must be present:
    //    - Written Work (WW)
    //    - Performance Tasks (PT)
    //    - Quarterly/Term Assessment (EX/QA)
    // 3. Every enrolled learner must have recorded scores in grade_entries for all columns.
    // 4. Final grades must be derived from the authoritative calculation engine.
    // ─────────────────────────────────────────────────────────────────────────

    // Fetch all columns and un-superseded entries for this gradebook
    const columns = await tx.gradebook_columns.findMany({
      where: { gradebook_id: gb.id },
      include: {
        entries: {
          where: { is_superseded: false },
        },
      },
      orderBy: { sort_order: 'asc' },
    });

    // 1. Column Existence Check
    if (columns.length === 0) {
      throw new AppError(
        422,
        'INCOMPLETE_ASSESSMENT_STRUCTURE',
        'Cannot publish gradebook: No assessment columns have been created. Under DepEd Order No. 015, s. 2026, gradebooks must contain recorded assessments (Written Work, Performance Tasks, and Quarterly Assessment) before publication.'
      );
    }

    // 2. Required Assessment Pillars Check
    const hasWW = columns.some((c: any) => c.type === 'WW');
    const hasPT = columns.some((c: any) => c.type === 'PT');
    const hasExam = columns.some((c: any) => ['EX', 'QA', 'TE', 'ST1', 'ST2'].includes(c.type));

    const missingPillars: string[] = [];
    if (!hasWW) missingPillars.push('Written Work (WW)');
    if (!hasPT) missingPillars.push('Performance Tasks (PT)');
    if (!hasExam) missingPillars.push('Quarterly/Term Assessment (EX/QA)');

    if (missingPillars.length > 0) {
      throw new AppError(
        422,
        'INCOMPLETE_ASSESSMENT_STRUCTURE',
        `Cannot publish gradebook: Missing required DepEd assessment categories: ${missingPillars.join(', ')}. Under DepEd Order No. 015, s. 2026, all three components are required before a gradebook can be officially published.`
      );
    }

    // 3. Resolve Policy & Weights based on subject and academic year
    const subjectGroup = resolveSubjectGroup(gb.assignment.subject.code, gb.assignment.subject.name);
    const policy = getGradingPolicy({
      schoolYear: gb.assignment.academic_year.name,
      gradeLevel: gb.assignment.section.grade_level,
      subjectGroup,
    });

    const wwCols = columns.filter((c: any) => c.type === 'WW');
    const ptCols = columns.filter((c: any) => c.type === 'PT');
    const exCols = columns.filter((c: any) => ['EX', 'QA', 'TE', 'ST1', 'ST2'].includes(c.type));

    // 4. Verify score completeness and calculate authoritative grades for all learners
    const missingScoreStudents: string[] = [];
    const calculatedResults: Array<{
      enrollment: any;
      calc: any;
    }> = [];

    for (const enr of enrollments) {
      const studentName = `${enr.student?.last_name || enr.student?.user?.last_name || ''}, ${enr.student?.first_name || enr.student?.user?.first_name || ''}`.trim() || enr.student_id;

      let studentComplete = true;
      const scoreMap: Record<string, number | null> = {};

      for (const col of columns) {
        const entry = col.entries.find((e: any) => e.enrollment_id === enr.id);
        if (!entry || entry.score === null || entry.score === undefined || isNaN(entry.score)) {
          studentComplete = false;
          scoreMap[col.id] = null;
        } else {
          scoreMap[col.id] = entry.score;
        }
      }

      if (!studentComplete) {
        missingScoreStudents.push(studentName);
        continue;
      }

      const wwScores = wwCols.map((c: any) => ({
        id: c.id,
        label: c.label,
        score: scoreMap[c.id],
        maxScore: c.max_score,
      }));

      const ptScores = ptCols.map((c: any) => ({
        id: c.id,
        label: c.label,
        score: scoreMap[c.id],
        maxScore: c.max_score,
      }));

      const isDynamic = exCols.some((c: any) => c.type === 'EX' || c.type === 'QA');
      let dynamicExams: any = undefined;
      let st1: any = undefined;
      let st2: any = undefined;
      let te: any = undefined;

      if (isDynamic) {
        dynamicExams = exCols.map((c: any) => ({
          id: c.id,
          label: c.label,
          score: scoreMap[c.id],
          maxScore: c.max_score,
          weight: 100 / exCols.length,
        }));
      } else {
        const colSt1 = exCols.find((c: any) => c.type === 'ST1');
        const colSt2 = exCols.find((c: any) => c.type === 'ST2');
        const colTe = exCols.find((c: any) => c.type === 'TE');
        if (colSt1) st1 = { score: scoreMap[colSt1.id], maxScore: colSt1.max_score };
        if (colSt2) st2 = { score: scoreMap[colSt2.id], maxScore: colSt2.max_score };
        if (colTe) te = { score: scoreMap[colTe.id], maxScore: colTe.max_score };
      }

      const calcInput: StudentTermScoreInput = {
        enrollmentId: enr.id,
        wwScores,
        ptScores,
        dynamicExams,
        st1,
        st2,
        te,
      };

      const calc = calculateStudentTermGrade(calcInput, policy);
      if (!calc.isComplete || calc.termGrade === null) {
        missingScoreStudents.push(studentName);
      } else {
        calculatedResults.push({ enrollment: enr, calc });
      }
    }

    if (missingScoreStudents.length > 0) {
      throw new AppError(
        422,
        'INCOMPLETE_GRADES',
        `Cannot publish gradebook: ${missingScoreStudents.length} student(s) have missing or incomplete assessment scores: ${missingScoreStudents.slice(0, 3).join(', ')}${missingScoreStudents.length > 3 ? '...' : ''}`
      );
    }

    const nextVersion = gb.version + 1;
    const now = new Date();

    // 1. Update gradebook status & version
    const updatedGb = await tx.gradebooks.update({
      where: { id: gb.id },
      data: {
        status: 'Published',
        version: nextVersion,
        updated_at: now,
      },
    });

    // 2. Lock authoritative grade snapshots into Grade table
    for (const res of calculatedResults) {
      const { enrollment: enr, calc } = res;
      const termGradeInt = Math.round(calc.termGrade);
      const initialGradeDec = calc.initialGrade !== null ? calc.initialGrade : termGradeInt;

      await tx.grade.upsert({
        where: {
          student_id_subject_id_term_academic_year_id: {
            student_id: enr.student_id,
            subject_id: gb.assignment.subject_id,
            term: gb.term.key as any,
            academic_year_id: gb.assignment.academic_year_id,
          },
        },
        update: {
          written_work: calc.wwResult ? roundHalfUp(calc.wwResult.weightedScore, 2) : null,
          performance_task: calc.ptResult ? roundHalfUp(calc.ptResult.weightedScore, 2) : null,
          term_assessment: calc.exResult?.weightedScore !== null && calc.exResult?.weightedScore !== undefined
            ? roundHalfUp(calc.exResult.weightedScore, 2)
            : null,
          term_grade: termGradeInt,
          published_term_grade: termGradeInt,
          published_initial_grade: initialGradeDec,
          published_gradebook_id: gb.id,
          published_version: nextVersion,
          published_at: now,
          published_by_id: input.actorUserId,
          publication_correction_reason: input.correctionReason || null,
        },
        create: {
          id: generateId(),
          student_id: enr.student_id,
          subject_id: gb.assignment.subject_id,
          term: gb.term.key as any,
          academic_year_id: gb.assignment.academic_year_id,
          written_work: calc.wwResult ? roundHalfUp(calc.wwResult.weightedScore, 2) : null,
          performance_task: calc.ptResult ? roundHalfUp(calc.ptResult.weightedScore, 2) : null,
          term_assessment: calc.exResult?.weightedScore !== null && calc.exResult?.weightedScore !== undefined
            ? roundHalfUp(calc.exResult.weightedScore, 2)
            : null,
          term_grade: termGradeInt,
          published_term_grade: termGradeInt,
          published_initial_grade: initialGradeDec,
          published_gradebook_id: gb.id,
          published_version: nextVersion,
          published_at: now,
          published_by_id: input.actorUserId,
          publication_correction_reason: input.correctionReason || null,
        },
      });
    }

    await createAuditLog({
      actorUserId: input.actorUserId,
      action: isRepublication ? 'GRADEBOOK_REPUBLISHED' : 'GRADEBOOK_PUBLISHED',
      resourceType: 'gradebook',
      resourceId: gb.id,
      newState: {
        status: 'Published',
        version: nextVersion,
        columnsCount: columns.length,
        studentCount: enrollments.length,
        policyVersion: policy.policyVersion,
        subjectGroup,
        term: gb.term.key,
        subjectId: gb.assignment.subject_id,
      },
      correlationId: input.correlationId,
    }, tx);

    return {
      gradebook: updatedGb,
      publishedCount: enrollments.length,
    };
  });
}

export async function unpublishGradebook(
  gradebookId: string,
  actorUserId: string,
  actorRole: string,
  reason: string,
  correlationId?: string
) {
  if (!reason || reason.trim().length < 5) {
    throw new AppError(422, 'VALIDATION_ERROR', 'A valid unpublish reason of at least 5 characters is required');
  }

  const isStaffOverride = ['Admin', 'Principal', 'Registrar'].includes(actorRole);

  return withTransaction(async (tx) => {
    const gb = await tx.gradebooks.findUnique({
      where: { id: gradebookId },
      include: {
        assignment: { include: { teacher: true, academic_year: true } },
        term: true,
      },
    });

    if (!gb) throw new AppError(404, 'NOT_FOUND', `Gradebook ${gradebookId} not found`);

    const lifecycle = classifyAcademicYearLifecycle(gb.assignment.academic_year);
    if (lifecycle === 'HISTORICAL') {
      throw new AppError(403, 'HISTORICAL_GRADEBOOK_READ_ONLY', 'Cannot unpublish a gradebook for a historical academic year. Historical records are strictly read-only.');
    }
    if (lifecycle === 'UPCOMING') {
      throw new AppError(403, 'UPCOMING_ACADEMIC_YEAR_INACTIVE', 'Cannot unpublish grades for an upcoming academic year that has not yet become active.');
    }

    const isAssignedTeacher = gb.assignment.teacher.user_id === actorUserId;
    if (!isAssignedTeacher && !isStaffOverride) {
      throw new AppError(403, 'FORBIDDEN', 'Only assigned teacher or Admin/Principal/Registrar can unpublish');
    }

    if (gb.status !== 'Published') {
      throw new AppError(409, 'CONFLICT', 'Gradebook is not currently published');
    }

    const nextVersion = gb.version + 1;
    const now = new Date();

    const updatedGb = await tx.gradebooks.update({
      where: { id: gb.id },
      data: {
        status: 'Draft',
        version: nextVersion,
        updated_at: now,
      },
    });

    // Preserve previously published grades before status change
    const previouslyPublishedGrades = await tx.grade.findMany({
      where: {
        published_gradebook_id: gb.id,
      },
      select: {
        id: true,
        student_id: true,
        published_term_grade: true,
        published_initial_grade: true,
        published_version: true,
        published_at: true,
      },
    });

    // Mark grades with correction reason without destroying historical publication snapshots
    await tx.grade.updateMany({
      where: {
        published_gradebook_id: gb.id,
      },
      data: {
        publication_correction_reason: `Reopened for revision: ${reason.trim()}`,
      },
    });

    await createAuditLog({
      actorUserId,
      action: 'GRADEBOOK_UNPUBLISHED',
      resourceType: 'gradebook',
      resourceId: gb.id,
      previousState: {
        status: 'Published',
        version: gb.version,
        publishedCount: previouslyPublishedGrades.length,
        grades: JSON.parse(JSON.stringify(previouslyPublishedGrades)),
      },
      newState: { status: 'Draft', version: nextVersion, reason: reason.trim() },
      reason: reason.trim(),
      correlationId,
    }, tx);

    return updatedGb;
  });
}

// ─── GRADE CONSIDERATION / AUTHORIZED ADJUSTMENT ─────────────

export const requestGradeConsiderationSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  term: z.enum(['T1', 'T2', 'T3', 'T4']),
  schoolYear: z.string().min(1),
  proposedGrade: z.number().int().min(60).max(100),
  reason: z.string().min(10, 'Justification must be at least 10 characters detailing academic basis'),
  evidenceRef: z.string().min(5, 'Assessment evidence reference must be at least 5 characters (e.g. Remedial Assessment #3)'),
});

function optionsApproverCheck(roles: string[]): boolean {
  return roles.some(r => ['Admin', 'Principal', 'Registrar'].includes(r));
}

export async function requestGradeConsideration(
  input: z.infer<typeof requestGradeConsiderationSchema>,
  actorUserId: string,
  correlationId?: string
) {
  const validated = requestGradeConsiderationSchema.parse(input);

  return withTransaction(async (tx) => {
    // 1. Resolve Academic Year
    const ay = await tx.academicYear.findUnique({
      where: { name: validated.schoolYear }
    });
    if (!ay) throw new AppError(404, 'NOT_FOUND', `Academic year ${validated.schoolYear} not found.`);

    // 2. Resolve Student Enrollment
    const enrollment = await tx.enrollment.findFirst({
      where: {
        student_id: validated.studentId,
        academic_year_id: ay.id,
        status: 'Enrolled'
      },
      include: {
        student: { include: { user: true } },
        section: true
      }
    });
    if (!enrollment) {
      throw new AppError(404, 'NOT_FOUND', 'Active student enrollment not found.');
    }

    // 3. Strict Subject Teacher Ownership Check:
    // Only the assigned subject teacher for this student's section may initiate a grade consideration
    const assignment = await tx.teacherSubjectAssignment.findFirst({
      where: {
        section_id: enrollment.section_id,
        subject_id: validated.subjectId,
        teacher: { user_id: actorUserId }
      },
      include: {
        teacher: { include: { user: true } },
        subject: true
      }
    });

    if (!assignment) {
      throw new AppError(403, 'FORBIDDEN', 'Only the assigned subject teacher is authorized to request a grade consideration for this subject.');
    }

    // 4. Resolve Subject
    const subject = await tx.subject.findUnique({
      where: { id: validated.subjectId }
    });
    if (!subject) throw new AppError(404, 'NOT_FOUND', 'Subject not found.');

    // 5. Resolve Student Grade Record
    const grade = await tx.grade.findFirst({
      where: {
        student_id: validated.studentId,
        subject_id: validated.subjectId,
        term: validated.term,
        academic_year_id: ay.id
      }
    });

    if (!grade) {
      throw new AppError(404, 'NOT_FOUND', 'Assessment scores must be encoded in the gradebook before requesting a grade consideration.');
    }

    // Check if there is already a PENDING request for this grade
    const pendingRequest = await tx.auditLog.findFirst({
      where: {
        resource_type: 'Grade',
        resource_id: grade.id,
        action: 'GRADE_CONSIDERATION_REQUESTED',
        result: 'PENDING'
      }
    });

    if (pendingRequest) {
      throw new AppError(409, 'CONFLICT', 'A grade consideration request is already pending authorization for this student and subject.');
    }

    const studentUser = enrollment.student.user;
    const teacherUser = assignment.teacher.user;
    const requestId = generateId();

    const auditLog = await tx.auditLog.create({
      data: {
        id: requestId,
        actor_user_id: actorUserId,
        actor_school_id: teacherUser?.school_id || null,
        actor_role: 'Teacher',
        action: 'GRADE_CONSIDERATION_REQUESTED',
        category: 'ACADEMIC',
        resource_type: 'Grade',
        resource_id: grade.id,
        target_label: `${studentUser.last_name}, ${studentUser.first_name} - ${subject.name} (${validated.term})`,
        result: 'PENDING',
        reason: validated.reason.trim(),
        previous_state: {
          originalComputedGrade: grade.term_grade,
          publishedTermGrade: grade.published_term_grade,
          term: validated.term,
          subjectId: validated.subjectId,
          subjectName: subject.name,
          studentId: validated.studentId,
          studentName: `${studentUser.last_name}, ${studentUser.first_name}`,
          sectionName: enrollment.section.name,
          gradeLevel: enrollment.section.grade_level,
          schoolYear: validated.schoolYear
        },
        new_state: {
          proposedGrade: validated.proposedGrade,
          evidenceRef: validated.evidenceRef.trim(),
          status: 'PENDING',
          teacherName: `${teacherUser.first_name} ${teacherUser.last_name}`,
          teacherId: assignment.teacher_id,
          requestedAt: new Date().toISOString()
        },
        correlation_id: correlationId
      }
    });

    return {
      id: auditLog.id,
      status: 'PENDING',
      studentName: `${studentUser.last_name}, ${studentUser.first_name}`,
      subjectName: subject.name,
      term: validated.term,
      originalComputedGrade: grade.term_grade,
      currentPublishedGrade: grade.published_term_grade,
      proposedGrade: validated.proposedGrade,
      reason: validated.reason.trim(),
      evidenceRef: validated.evidenceRef.trim(),
      requestedAt: auditLog.created_at
    };
  });
}

export async function getGradeConsiderations(options: {
  actorUserId: string;
  actorRoles: string[];
  status?: string;
  subjectId?: string;
}) {
  const isApprover = optionsApproverCheck(options.actorRoles);

  const whereClause: any = {
    category: 'ACADEMIC',
    action: 'GRADE_CONSIDERATION_REQUESTED'
  };

  if (options.status) {
    whereClause.result = options.status;
  }

  if (!isApprover) {
    // Regular teachers only see considerations they initiated
    whereClause.actor_user_id = options.actorUserId;
  }

  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    orderBy: { created_at: 'desc' }
  });

  return logs.map((log: any) => {
    const prev = (log.previous_state || {}) as any;
    const next = (log.new_state || {}) as any;
    return {
      id: log.id,
      gradeId: log.resource_id,
      studentId: prev.studentId,
      studentName: prev.studentName || log.target_label,
      subjectId: prev.subjectId,
      subjectName: prev.subjectName,
      sectionName: prev.sectionName,
      gradeLevel: prev.gradeLevel,
      term: prev.term,
      originalComputedGrade: prev.originalComputedGrade,
      currentPublishedGrade: prev.publishedTermGrade,
      proposedGrade: next.proposedGrade,
      evidenceRef: next.evidenceRef,
      reason: log.reason,
      status: log.result, // 'PENDING' | 'APPROVED' | 'REJECTED'
      requestedBy: next.teacherName,
      requestedAt: log.created_at,
      approvedAt: next.approvedAt || null,
      approvedBy: next.approvedByName || null
    };
  });
}

export async function approveGradeConsideration(
  requestId: string,
  actorUserId: string,
  actorRoles: string[],
  correlationId?: string
) {
  const isApprover = optionsApproverCheck(actorRoles);
  if (!isApprover) {
    throw new AppError(403, 'FORBIDDEN', 'Only the School Principal or Administrator is authorized to approve grade considerations.');
  }

  return withTransaction(async (tx) => {
    const request = await tx.auditLog.findUnique({
      where: { id: requestId }
    });

    if (!request || request.action !== 'GRADE_CONSIDERATION_REQUESTED') {
      throw new AppError(404, 'NOT_FOUND', 'Grade consideration request not found.');
    }

    if (request.result !== 'PENDING') {
      throw new AppError(409, 'CONFLICT', `Grade consideration request is already ${request.result}.`);
    }

    const nextState = (request.new_state || {}) as any;
    const proposedGrade = Number(nextState.proposedGrade);
    const evidenceRef = String(nextState.evidenceRef || '');
    const reason = String(request.reason || '');

    // Target Grade record
    const grade = await tx.grade.findUnique({
      where: { id: request.resource_id! }
    });

    if (!grade) {
      throw new AppError(404, 'NOT_FOUND', 'Underlying grade record not found.');
    }

    const approverUser = await tx.user.findUnique({
      where: { id: actorUserId }
    });

    const now = new Date();

    // 1. Update authoritative Grade published_term_grade
    // NOTICE: grade.term_grade (original computed grade) is PRESERVED and NEVER modified!
    await tx.grade.update({
      where: { id: grade.id },
      data: {
        published_term_grade: proposedGrade,
        publication_correction_reason: `Approved Grade Consideration: ${reason} (Evidence: ${evidenceRef})`,
        published_at: now,
        published_by_id: actorUserId
      }
    });

    // 2. Mark request as APPROVED
    await tx.auditLog.update({
      where: { id: requestId },
      data: {
        result: 'APPROVED',
        new_state: {
          ...nextState,
          status: 'APPROVED',
          approvedByUserId: actorUserId,
          approvedByName: approverUser ? `${approverUser.first_name} ${approverUser.last_name}` : 'Principal',
          approvedAt: now.toISOString()
        }
      }
    });

    // 3. Create approval audit log
    await tx.auditLog.create({
      data: {
        id: generateId(),
        actor_user_id: actorUserId,
        actor_school_id: approverUser?.school_id || null,
        actor_role: 'Principal',
        action: 'GRADE_CONSIDERATION_APPROVED',
        category: 'ACADEMIC',
        resource_type: 'Grade',
        resource_id: grade.id,
        target_label: request.target_label,
        result: 'APPROVED',
        reason: `Approved consideration: ${reason}`,
        previous_state: {
          originalComputedGrade: grade.term_grade,
          previousPublishedGrade: grade.published_term_grade,
          requestId
        },
        new_state: {
          finalGrade: proposedGrade,
          approvedAt: now.toISOString(),
          approvedBy: approverUser ? `${approverUser.first_name} ${approverUser.last_name}` : 'Principal'
        },
        correlation_id: correlationId
      }
    });

    return {
      id: requestId,
      status: 'APPROVED',
      finalGrade: proposedGrade,
      originalComputedGrade: grade.term_grade,
      updatedAt: now
    };
  });
}

export async function rejectGradeConsideration(
  requestId: string,
  actorUserId: string,
  actorRoles: string[],
  rejectionReason?: string,
  correlationId?: string
) {
  const isApprover = optionsApproverCheck(actorRoles);
  if (!isApprover) {
    throw new AppError(403, 'FORBIDDEN', 'Only the School Principal or Administrator is authorized to reject grade considerations.');
  }

  return withTransaction(async (tx) => {
    const request = await tx.auditLog.findUnique({
      where: { id: requestId }
    });

    if (!request || request.action !== 'GRADE_CONSIDERATION_REQUESTED') {
      throw new AppError(404, 'NOT_FOUND', 'Grade consideration request not found.');
    }

    if (request.result !== 'PENDING') {
      throw new AppError(409, 'CONFLICT', `Grade consideration request is already ${request.result}.`);
    }

    const approverUser = await tx.user.findUnique({
      where: { id: actorUserId }
    });

    const nextState = (request.new_state || {}) as any;
    const now = new Date();

    // Mark request as REJECTED
    await tx.auditLog.update({
      where: { id: requestId },
      data: {
        result: 'REJECTED',
        new_state: {
          ...nextState,
          status: 'REJECTED',
          rejectedByUserId: actorUserId,
          rejectedByName: approverUser ? `${approverUser.first_name} ${approverUser.last_name}` : 'Principal',
          rejectedAt: now.toISOString(),
          rejectionReason: rejectionReason || 'Request does not meet DepEd Order No. 015, s. 2026 grade consideration standards'
        }
      }
    });

    // Create rejection audit log
    await tx.auditLog.create({
      data: {
        id: generateId(),
        actor_user_id: actorUserId,
        actor_school_id: approverUser?.school_id || null,
        actor_role: 'Principal',
        action: 'GRADE_CONSIDERATION_REJECTED',
        category: 'ACADEMIC',
        resource_type: 'Grade',
        resource_id: request.resource_id,
        target_label: request.target_label,
        result: 'REJECTED',
        reason: rejectionReason || 'Rejected by School Principal',
        previous_state: { requestId },
        new_state: { status: 'REJECTED', rejectedAt: now.toISOString() },
        correlation_id: correlationId
      }
    });

    return {
      id: requestId,
      status: 'REJECTED',
      reason: rejectionReason || 'Rejected by School Principal'
    };
  });
}

