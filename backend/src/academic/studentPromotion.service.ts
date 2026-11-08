import { z } from 'zod';
import prisma, { withTransaction } from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';
import { resolveSubjectGradeLevel } from './academic.service.js';

export interface PromotionSubjectRating {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  termGrades: Record<string, number | null>;
  finalRating: number | null;
  isPassed: boolean;
  isMAPEH?: boolean;
}

export type PromotionEligibilityStatus = 
  | 'ELIGIBLE_FOR_PROMOTION'  // Passed all learning areas (DepEd Order No. 8, s. 2015, Grades 7-9)
  | 'JHS_COMPLETER'            // Passed all learning areas in Grade 10 (DepEd Order No. 8, s. 2015)
  | 'REMEDIAL_REQUIRED'       // Failed 1-2 learning areas (Requires remedial classes)
  | 'RETAINED'                // Failed 3 or more learning areas (Retained in same grade)
  | 'INCOMPLETE'              // Missing published grades in one or more terms/subjects
  | 'DEPARTED';               // Dropped out or transferred out (DO 11, s. 2018)

export interface LearnerPromotionRecord {
  studentId: string;
  lrn: string;
  fullName: string;
  gender: string;
  currentSectionId: string;
  currentSectionName: string;
  currentGradeLevel: number;
  enrollmentId: string;
  enrollmentStatus: string;
  
  // Academic Performance
  isAcademicallyComplete: boolean;
  missingRequirements: string[];
  learningAreaRatings: PromotionSubjectRating[];
  totalLearningAreas: number;
  passedLearningAreasCount: number;
  failedLearningAreasCount: number;
  failedLearningAreas: string[];
  generalAverage: number | null;
  
  // DepEd Order No. 8, s. 2015 Outcome
  eligibility: PromotionEligibilityStatus;
  eligibilityLabel: string;
  recommendedGradeLevel: number | null; // e.g. Grade 9 if Promoted, Grade 8 if Retained
  policyReference: string;

  // Official Approval State (from AuditLog)
  approval: {
    isApproved: boolean;
    approvedOutcome: 'PROMOTED' | 'REMEDIAL' | 'RETAINED' | 'COMPLETED' | null;
    approvedAt: string | null;
    approvedById: string | null;
    approvedByName: string | null;
    remarks: string | null;
    isStale?: boolean;
    staleReason?: string | null;
  };

  // Next-Year Enrollment State (from active enrollments in target years)
  nextYearEnrollment: {
    isEnrolled: boolean;
    enrollmentId: string | null;
    academicYearId: string | null;
    academicYearName: string | null;
    sectionId: string | null;
    sectionName: string | null;
    gradeLevel: number | null;
    status: string | null;
  } | null;
}

export const approvePromotionSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required.'),
  academicYearId: z.string().min(1, 'Academic Year ID is required.'),
  decision: z.enum(['PROMOTED', 'REMEDIAL', 'RETAINED', 'COMPLETED']),
  remarks: z.string().optional(),
});

export const enrollNextYearSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required.'),
  sourceAcademicYearId: z.string().min(1, 'Source Academic Year ID is required.'),
  targetAcademicYearId: z.string().min(1, 'Target Academic Year ID is required.'),
  targetSectionId: z.string().min(1, 'Target Section ID is required.'),
  remarks: z.string().optional(),
});

export const bulkApprovePromotionSchema = z.object({
  academicYearId: z.string().min(1, 'Academic Year ID is required.'),
  actionType: z.enum(['PROMOTION', 'COMPLETION']),
  studentIds: z.array(z.string()).optional(),
  selectAllMatching: z.boolean().optional(),
  filterScope: z.object({
    gradeLevel: z.number().optional(),
    sectionId: z.string().optional(),
    search: z.string().optional(),
    outcome: z.string().optional(),
  }).optional(),
  remarks: z.string().optional(),
});

export const bulkEnrollNextYearSchema = z.object({
  sourceAcademicYearId: z.string().min(1, 'Source Academic Year ID is required.'),
  targetAcademicYearId: z.string().min(1, 'Target Academic Year ID is required.'),
  placements: z.array(z.object({
    studentId: z.string().min(1, 'Student ID is required.'),
    targetSectionId: z.string().min(1, 'Target Section ID is required.'),
  })).min(1, 'At least one placement is required.'),
  remarks: z.string().optional(),
});

export interface PromotionRosterQueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  gradeLevel?: number;
  sectionId?: string;
  outcome?: string;
  reviewStatus?: string;
  sortBy?: 'name' | 'gradeSection' | 'generalAverage' | 'outcome' | 'reviewStatus';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Retrieve the full promotion evaluation roster for an academic year.
 * Evaluates official annual Final Ratings under DepEd Order No. 8, s. 2015,
 * incorporating MAPEH consolidation and configured academic terms.
 * Supports server-side pagination, search, filtering, and sorting for 1,000+ learners.
 */
export async function getPromotionRoster(
  academicYearId: string,
  optionsOrSectionId?: string | PromotionRosterQueryOptions
): Promise<{
  academicYear: { id: string; name: string; isCurrent: boolean };
  configuredTerms: Array<{ key: string; label: string }>;
  summary: {
    totalLearners: number;
    eligibleCount: number;
    jhsCompleterCount: number;
    remedialCount: number;
    retainedCount: number;
    incompleteCount: number;
    departedCount: number;
    approvedCount: number;
    nextYearEnrolledCount: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalMatching: number;
  };
  totalLearners: number;
  eligibleCount: number;
  jhsCompleterCount: number;
  remedialCount: number;
  retainedCount: number;
  incompleteCount: number;
  departedCount: number;
  approvedCount: number;
  nextYearEnrolledCount: number;
  learners: LearnerPromotionRecord[];
}> {
  const options: PromotionRosterQueryOptions = typeof optionsOrSectionId === 'string'
    ? { sectionId: optionsOrSectionId }
    : (optionsOrSectionId || {});

  const ay = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    include: {
      terms: { orderBy: { start_date: 'asc' } },
      sections: {
        include: {
          assignments: {
            include: { subject: true }
          }
        }
      }
    }
  });

  if (!ay) {
    throw new AppError(404, 'NOT_FOUND', 'Academic year not found.');
  }

  // Determine configured terms
  const configuredTerms = ay.terms && ay.terms.length > 0
    ? ay.terms.map(t => ({
        key: t.key,
        label: t.key === 'T1' ? 'TERM 1' : t.key === 'T2' ? 'TERM 2' : t.key === 'T3' ? 'TERM 3' : t.key === 'T4' ? 'TERM 4' : t.name || t.key
      }))
    : [
        { key: 'T1', label: 'TERM 1' },
        { key: 'T2', label: 'TERM 2' },
        { key: 'T3', label: 'TERM 3' }
      ];

  // Fetch all enrollments for this academic year
  const enrollments = await prisma.enrollment.findMany({
    where: {
      academic_year_id: academicYearId
    },
    include: {
      student: {
        include: { user: true }
      },
      section: {
        include: {
          assignments: {
            include: { subject: true }
          }
        }
      }
    },
    orderBy: [
      { section: { grade_level: 'asc' } },
      { section: { name: 'asc' } },
      { student: { user: { last_name: 'asc' } } }
    ]
  });

  // Fetch all published grades for this academic year
  const grades = await prisma.grade.findMany({
    where: {
      academic_year_id: academicYearId,
      published_term_grade: { not: null }
    },
    include: { subject: true }
  });

  // Map published grades by studentId -> subjectId -> termKey -> score
  const studentGradesMap = new Map<string, Map<string, Record<string, number>>>();
  const subjectInfoMap = new Map<string, { id: string; code: string; name: string }>();

  for (const g of grades) {
    if (g.subject) {
      subjectInfoMap.set(g.subject.id, { id: g.subject.id, code: g.subject.code || '', name: g.subject.name || '' });
    }
    if (g.published_term_grade === null || g.published_term_grade === undefined) continue;
    if (!studentGradesMap.has(g.student_id)) {
      studentGradesMap.set(g.student_id, new Map());
    }
    const subjMap = studentGradesMap.get(g.student_id)!;
    if (!subjMap.has(g.subject_id)) {
      subjMap.set(g.subject_id, {});
    }
    subjMap.get(g.subject_id)![g.term] = Number(g.published_term_grade);
  }

  // Resilient subject matching helper for academic completeness & MAPEH consolidation
  const findStudentTermGrade = (
    subjGrades: Map<string, Record<string, number>>,
    assignmentSubject: { id: string; code?: string | null; name?: string | null },
    termKey: string
  ): number | undefined => {
    // 1. Direct subject ID match
    const direct = subjGrades.get(assignmentSubject.id)?.[termKey];
    if (direct !== undefined && direct !== null) {
      return direct;
    }

    // 2. Canonical / Code fallback match
    const targetCode = (assignmentSubject.code || '').toUpperCase();
    const targetName = (assignmentSubject.name || '').toLowerCase();
    const isTargetPe = /physical education|\bpe\b|\bpeh\b|^peh/i.test(targetName) || /^peh/i.test(targetCode);
    const isTargetMus = /music|^mus|^ma(?:\b|_|-|\d)/i.test(targetName) || /^ma(?:\b|_|-|\d)/i.test(targetCode);

    for (const [gradeSubjId, terms] of subjGrades.entries()) {
      if (terms[termKey] === undefined || terms[termKey] === null) continue;
      const info = subjectInfoMap.get(gradeSubjId);
      if (!info) continue;
      const gradeCode = (info.code || '').toUpperCase();
      const gradeName = (info.name || '').toLowerCase();

      // Exact code match (e.g. PEH8 === PEH8)
      if (targetCode && gradeCode && targetCode === gradeCode) {
        return terms[termKey];
      }
      // Canonical PE / Health match
      if (isTargetPe && (/physical education|\bpe\b|\bpeh\b|^peh/i.test(gradeName) || /^peh/i.test(gradeCode))) {
        return terms[termKey];
      }
      // Canonical Music & Arts match
      if (isTargetMus && (/music|^mus|^ma(?:\b|_|-|\d)/i.test(gradeName) || /^ma(?:\b|_|-|\d)/i.test(gradeCode))) {
        return terms[termKey];
      }
    }

    return undefined;
  };

  // Fetch existing promotion approval audit logs for this academic year
  const approvalAuditLogs = await prisma.auditLog.findMany({
    where: {
      action: 'STUDENT_PROMOTION_APPROVED',
      category: 'academic_promotion'
    },
    include: {
      actor: true
    },
    orderBy: { created_at: 'desc' }
  });

  // Map latest approval per studentId for this academic year
  const approvalMap = new Map<string, {
    outcome: 'PROMOTED' | 'REMEDIAL' | 'RETAINED' | 'COMPLETED';
    approvedAt: string;
    approvedById: string | null;
    approvedByName: string | null;
    remarks: string | null;
  }>();

  for (const log of approvalAuditLogs) {
    const newState = (log.new_state as any) || {};
    if (newState.academicYearId === academicYearId && newState.studentId && !approvalMap.has(newState.studentId)) {
      approvalMap.set(newState.studentId, {
        outcome: newState.approvedOutcome || 'PROMOTED',
        approvedAt: log.created_at.toISOString(),
        approvedById: log.actor_user_id,
        approvedByName: log.actor ? `${log.actor.first_name || ''} ${log.actor.last_name || ''}`.trim() : log.actor_school_id || 'Authorized Approver',
        remarks: log.reason || newState.remarks || null
      });
    }
  }

  // Fetch next-year enrollments for these students (where academic_year_id !== academicYearId)
  const studentIds = enrollments.map(e => e.student_id);
  const futureEnrollments = await prisma.enrollment.findMany({
    where: {
      student_id: { in: studentIds },
      academic_year_id: { not: academicYearId },
      status: 'Enrolled'
    },
    include: {
      academic_year: true,
      section: true
    },
    orderBy: { created_at: 'desc' }
  });

  const nextYearEnrollmentMap = new Map<string, typeof futureEnrollments[0]>();
  for (const fe of futureEnrollments) {
    if (!nextYearEnrollmentMap.has(fe.student_id)) {
      nextYearEnrollmentMap.set(fe.student_id, fe);
    }
  }

  const learners: LearnerPromotionRecord[] = [];
  let eligibleCount = 0;
  let jhsCompleterCount = 0;
  let remedialCount = 0;
  let retainedCount = 0;
  let incompleteCount = 0;
  let departedCount = 0;
  let approvedCount = 0;
  let nextYearEnrolledCount = 0;

  for (const enr of enrollments) {
    const s = enr.student;
    const u = s?.user;
    const sId = enr.student_id;
    const sName = u ? `${u.last_name}, ${u.first_name}${u.middle_name ? ` ${u.middle_name[0]}.` : ''}` : 'Unnamed Learner';
    const lrn = s?.lrn || 'N/A';
    const currentGrade = enr.section?.grade_level || s?.grade_level || 7;
    const currentSectionName = enr.section?.name || 'Unassigned';

    // Check departure status
    const isDeparted = enr.status === 'Dropped_Out' || enr.status === 'Transferred_Out';

    if (isDeparted) {
      departedCount++;
      learners.push({
        studentId: sId,
        lrn,
        fullName: sName,
        gender: s?.gender || 'N/A',
        currentSectionId: enr.section_id,
        currentSectionName,
        currentGradeLevel: currentGrade,
        enrollmentId: enr.id,
        enrollmentStatus: enr.status,
        isAcademicallyComplete: false,
        missingRequirements: ['Officially departed under DepEd Order No. 11, s. 2018'],
        learningAreaRatings: [],
        totalLearningAreas: 0,
        passedLearningAreasCount: 0,
        failedLearningAreasCount: 0,
        failedLearningAreas: [],
        generalAverage: null,
        eligibility: 'DEPARTED',
        eligibilityLabel: enr.status === 'Dropped_Out' ? 'Dropped Out (DO 11, s. 2018)' : 'Transferred Out (DO 11, s. 2018)',
        recommendedGradeLevel: null,
        policyReference: 'DepEd Order No. 11, s. 2018',
        approval: {
          isApproved: false,
          approvedOutcome: null,
          approvedAt: null,
          approvedById: null,
          approvedByName: null,
          remarks: null
        },
        nextYearEnrollment: null
      });
      continue;
    }

    // Evaluate academic completion & final ratings
    const rawAssignments = enr.section?.assignments || [];
    const sectionAssignments = rawAssignments.filter(a => {
      const g = resolveSubjectGradeLevel(a.subject);
      return g === null || g === currentGrade;
    });
    const subjGrades = studentGradesMap.get(sId) || new Map<string, Record<string, number>>();
    const missingRequirements: string[] = [];

    // Check completeness across configured terms
    for (const term of configuredTerms) {
      for (const a of sectionAssignments) {
        const termVal = findStudentTermGrade(subjGrades, a.subject, term.key);
        if (termVal === undefined || termVal === null) {
          missingRequirements.push(`${a.subject.name} (${term.label})`);
        }
      }
    }

    const isComplete = missingRequirements.length === 0 && sectionAssignments.length > 0;

    if (!isComplete) {
      incompleteCount++;
      learners.push({
        studentId: sId,
        lrn,
        fullName: sName,
        gender: s?.gender || 'N/A',
        currentSectionId: enr.section_id,
        currentSectionName,
        currentGradeLevel: currentGrade,
        enrollmentId: enr.id,
        enrollmentStatus: enr.status,
        isAcademicallyComplete: false,
        missingRequirements,
        learningAreaRatings: [],
        totalLearningAreas: sectionAssignments.length,
        passedLearningAreasCount: 0,
        failedLearningAreasCount: 0,
        failedLearningAreas: [],
        generalAverage: null,
        eligibility: 'INCOMPLETE',
        eligibilityLabel: 'Incomplete Academic Requirements',
        recommendedGradeLevel: null,
        policyReference: 'DepEd Order No. 8, s. 2015 (Section IV.B)',
        approval: {
          isApproved: false,
          approvedOutcome: approvalMap.get(sId)?.outcome || null,
          approvedAt: approvalMap.get(sId)?.approvedAt || null,
          approvedById: approvalMap.get(sId)?.approvedById || null,
          approvedByName: approvalMap.get(sId)?.approvedByName || null,
          remarks: approvalMap.get(sId)?.remarks || null,
          isStale: approvalMap.has(sId),
          staleReason: approvalMap.has(sId) ? 'Academic requirements became incomplete following subsequent grade updates.' : null
        },
        nextYearEnrollment: null
      });
      continue;
    }

    // Complete learner: Compute authoritative Final Ratings & MAPEH consolidation
    let musicAssignment: typeof sectionAssignments[0] | null = null;
    let peAssignment: typeof sectionAssignments[0] | null = null;

    for (const a of sectionAssignments) {
      const sNameLower = (a.subject.name || '').toLowerCase();
      const sCodeUpper = (a.subject.code || '').toUpperCase();
      if (/music/i.test(sNameLower) || (sCodeUpper.startsWith('MA') && !sCodeUpper.startsWith('MATH')) || sCodeUpper.startsWith('MUS')) {
        musicAssignment = a;
      } else if (/physical education|\bpe\b|\bpeh\b|^peh/i.test(sNameLower) || sCodeUpper.startsWith('PEH') || sCodeUpper.startsWith('PE')) {
        peAssignment = a;
      }
    }

    const learningAreaRatings: PromotionSubjectRating[] = [];

    // Core learning areas
    for (const a of sectionAssignments) {
      if ((musicAssignment && a.id === musicAssignment.id) || (peAssignment && a.id === peAssignment.id)) {
        continue; // Handled in consolidated MAPEH
      }
      const termVals = configuredTerms.map(t => findStudentTermGrade(subjGrades, a.subject, t.key) ?? null);
      const validVals = termVals.filter((v): v is number => v !== null);
      const sum = validVals.reduce((acc, v) => acc + v, 0);
      const finalRating = validVals.length === configuredTerms.length ? Math.round(sum / configuredTerms.length) : null;
      const isPassed = finalRating !== null && finalRating >= 75;

      const subjectGradesRecord: Record<string, number | null> = {};
      configuredTerms.forEach(t => {
        subjectGradesRecord[t.key] = findStudentTermGrade(subjGrades, a.subject, t.key) ?? null;
      });

      learningAreaRatings.push({
        subjectId: a.subject_id,
        subjectCode: a.subject.code,
        subjectName: a.subject.name,
        termGrades: subjectGradesRecord,
        finalRating,
        isPassed
      });
    }

    // MAPEH consolidation
    if (musicAssignment && peAssignment) {
      const mapehTermGrades: Record<string, number | null> = {};

      for (const t of configuredTerms) {
        const m = findStudentTermGrade(subjGrades, musicAssignment.subject, t.key);
        const p = findStudentTermGrade(subjGrades, peAssignment.subject, t.key);
        if (m !== undefined && p !== undefined && m !== null && p !== null) {
          mapehTermGrades[t.key] = Math.round((m + p) / 2);
        } else {
          mapehTermGrades[t.key] = null;
        }
      }

      const mapehVals = configuredTerms.map(t => mapehTermGrades[t.key]);
      const validMapeh = mapehVals.filter((v): v is number => v !== null);
      const sumMapeh = validMapeh.reduce((acc, v) => acc + v, 0);
      const finalMapeh = validMapeh.length === configuredTerms.length ? Math.round(sumMapeh / configuredTerms.length) : null;
      const isPassed = finalMapeh !== null && finalMapeh >= 75;

      learningAreaRatings.push({
        subjectId: 'MAPEH_CONSOLIDATED',
        subjectCode: 'MAPEH',
        subjectName: 'Music, Arts, Physical Education & Health (MAPEH)',
        termGrades: mapehTermGrades,
        finalRating: finalMapeh,
        isPassed,
        isMAPEH: true
      });
    }

    // Determine failed learning areas
    const failedAreas = learningAreaRatings.filter(r => !r.isPassed);
    const failedCount = failedAreas.length;
    const passedCount = learningAreaRatings.length - failedCount;

    // General Average calculation
    const allFinals = learningAreaRatings.map(r => r.finalRating).filter((r): r is number => r !== null);
    const generalAverage = allFinals.length === learningAreaRatings.length && allFinals.length > 0
      ? Math.round(allFinals.reduce((acc, v) => acc + v, 0) / allFinals.length)
      : null;

    let eligibility: PromotionEligibilityStatus;
    let eligibilityLabel: string;
    let recommendedGradeLevel: number | null;
    let policyReference: string;

    if (failedCount === 0) {
      if (currentGrade < 10) {
        eligibility = 'ELIGIBLE_FOR_PROMOTION';
        eligibilityLabel = `Eligible for Promotion (Grade ${currentGrade + 1})`;
        recommendedGradeLevel = currentGrade + 1;
      } else {
        eligibility = 'JHS_COMPLETER';
        eligibilityLabel = 'Eligible for JHS Completion';
        recommendedGradeLevel = null; // Junior High School ends at Grade 10
        jhsCompleterCount++;
      }
      policyReference = 'DepEd Order No. 8, s. 2015 (Standard Promotion Criteria)';
      eligibleCount++;
    } else if (failedCount <= 2) {
      eligibility = 'REMEDIAL_REQUIRED';
      eligibilityLabel = `Remedial Classes Required (${failedCount} learning ${failedCount === 1 ? 'area' : 'areas'})`;
      recommendedGradeLevel = null; // Conditional upon remediation
      policyReference = 'DepEd Order No. 8, s. 2015 (Remediation Protocol)';
      remedialCount++;
    } else {
      eligibility = 'RETAINED';
      eligibilityLabel = `Retained in Grade ${currentGrade} (3+ failing learning areas)`;
      recommendedGradeLevel = currentGrade;
      policyReference = 'DepEd Order No. 8, s. 2015 (Retention Criteria)';
      retainedCount++;
    }

    // Check approval & validate freshness against current academic standing
    const existingApproval = approvalMap.get(sId);
    let isApprovalValid = false;
    let isStale = false;
    let staleReason: string | null = null;

    if (existingApproval) {
      if (existingApproval.outcome === 'PROMOTED' && eligibility !== 'ELIGIBLE_FOR_PROMOTION') {
        isStale = true;
        staleReason = `Promotion approval is invalid: learner has ${failedCount} failing learning area(s) and is currently ${eligibilityLabel}.`;
      } else if (existingApproval.outcome === 'COMPLETED' && eligibility !== 'JHS_COMPLETER') {
        isStale = true;
        staleReason = `JHS completion approval is invalid: learner has ${failedCount} failing learning area(s) and does not qualify for completion.`;
      } else {
        isApprovalValid = true;
      }
    }

    if (isApprovalValid) {
      approvedCount++;
    }

    // Check next year enrollment
    const nextEnrollment = nextYearEnrollmentMap.get(sId);
    if (nextEnrollment) {
      nextYearEnrolledCount++;
    }

    learners.push({
      studentId: sId,
      lrn,
      fullName: sName,
      gender: s?.gender || 'N/A',
      currentSectionId: enr.section_id,
      currentSectionName,
      currentGradeLevel: currentGrade,
      enrollmentId: enr.id,
      enrollmentStatus: enr.status,
      isAcademicallyComplete: true,
      missingRequirements: [],
      learningAreaRatings,
      totalLearningAreas: learningAreaRatings.length,
      passedLearningAreasCount: passedCount,
      failedLearningAreasCount: failedCount,
      failedLearningAreas: failedAreas.map(f => f.subjectName),
      generalAverage,
      eligibility,
      eligibilityLabel,
      recommendedGradeLevel,
      policyReference,
      approval: {
        isApproved: isApprovalValid,
        approvedOutcome: existingApproval?.outcome || null,
        approvedAt: existingApproval?.approvedAt || null,
        approvedById: existingApproval?.approvedById || null,
        approvedByName: existingApproval?.approvedByName || null,
        remarks: existingApproval?.remarks || null,
        isStale,
        staleReason
      },
      nextYearEnrollment: nextEnrollment ? {
        isEnrolled: true,
        enrollmentId: nextEnrollment.id,
        academicYearId: nextEnrollment.academic_year_id,
        academicYearName: nextEnrollment.academic_year?.name || 'Next Academic Year',
        sectionId: nextEnrollment.section_id,
        sectionName: nextEnrollment.section?.name || 'Section Assigned',
        gradeLevel: nextEnrollment.section?.grade_level || null,
        status: nextEnrollment.status
      } : null
    });
  }

  // ── Apply Server-Side Filtering ──
  let filtered = [...learners];

  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    filtered = filtered.filter(l =>
      l.fullName.toLowerCase().includes(q) ||
      l.lrn.toLowerCase().includes(q) ||
      l.currentSectionName.toLowerCase().includes(q)
    );
  }

  if (options.gradeLevel !== undefined && !isNaN(options.gradeLevel)) {
    filtered = filtered.filter(l => l.currentGradeLevel === options.gradeLevel);
  }

  if (options.sectionId && options.sectionId !== 'ALL') {
    filtered = filtered.filter(l => l.currentSectionId === options.sectionId);
  }

  if (options.outcome && options.outcome !== 'ALL') {
    if (options.outcome === 'ELIGIBLE') {
      filtered = filtered.filter(l => l.eligibility === 'ELIGIBLE_FOR_PROMOTION' || l.eligibility === 'JHS_COMPLETER');
    } else {
      filtered = filtered.filter(l => l.eligibility === options.outcome);
    }
  }

  if (options.reviewStatus && options.reviewStatus !== 'ALL') {
    if (options.reviewStatus === 'APPROVED') {
      filtered = filtered.filter(l => l.approval.isApproved);
    } else if (options.reviewStatus === 'PENDING') {
      filtered = filtered.filter(l => !l.approval.isApproved && l.isAcademicallyComplete && l.eligibility !== 'DEPARTED');
    } else if (options.reviewStatus === 'ATTENTION') {
      filtered = filtered.filter(l => l.eligibility === 'REMEDIAL_REQUIRED' || l.eligibility === 'RETAINED' || l.eligibility === 'INCOMPLETE');
    }
  }

  // ── Apply Server-Side Sorting ──
  const sortBy = options.sortBy || 'gradeSection';
  const sortOrder = options.sortOrder === 'desc' ? -1 : 1;

  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.fullName.localeCompare(b.fullName);
    } else if (sortBy === 'generalAverage') {
      const avgA = a.generalAverage ?? -999;
      const avgB = b.generalAverage ?? -999;
      comparison = avgA - avgB;
    } else if (sortBy === 'outcome') {
      comparison = a.eligibility.localeCompare(b.eligibility);
    } else if (sortBy === 'reviewStatus') {
      const statusA = a.approval.isApproved ? 1 : 0;
      const statusB = b.approval.isApproved ? 1 : 0;
      comparison = statusA - statusB;
    } else {
      // default: gradeSection
      if (a.currentGradeLevel !== b.currentGradeLevel) {
        comparison = a.currentGradeLevel - b.currentGradeLevel;
      } else if (a.currentSectionName !== b.currentSectionName) {
        comparison = a.currentSectionName.localeCompare(b.currentSectionName);
      } else {
        comparison = a.fullName.localeCompare(b.fullName);
      }
    }
    return comparison * sortOrder;
  });

  // ── Apply Server-Side Pagination ──
  const totalMatching = filtered.length;
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize !== undefined ? options.pageSize : 25;
  const totalPages = pageSize > 0 ? Math.ceil(totalMatching / pageSize) : 1;
  const paginatedLearners = pageSize > 0
    ? filtered.slice((page - 1) * pageSize, page * pageSize)
    : filtered;

  return {
    academicYear: { id: ay.id, name: ay.name, isCurrent: ay.is_current },
    configuredTerms,
    summary: {
      totalLearners: learners.length,
      eligibleCount,
      jhsCompleterCount,
      remedialCount,
      retainedCount,
      incompleteCount,
      departedCount,
      approvedCount,
      nextYearEnrolledCount
    },
    pagination: {
      page,
      pageSize,
      totalPages: totalPages || 1,
      totalMatching
    },
    totalLearners: learners.length,
    eligibleCount,
    jhsCompleterCount,
    remedialCount,
    retainedCount,
    incompleteCount,
    departedCount,
    approvedCount,
    nextYearEnrolledCount,
    learners: paginatedLearners
  };
}

/**
 * Principal approval of a learner's promotion eligibility outcome.
 * Enforces academic authority (Principal role or academic:write).
 * Validates eligibility under DepEd Order No. 8, s. 2015.
 */
export async function approveStudentPromotion(
  input: z.infer<typeof approvePromotionSchema>,
  actor: { id: string; schoolId?: string; roles: string[]; permissions: string[] },
  correlationId?: string
) {
  // Authorization check: Must be Principal or have academic:write
  const isPrincipal = actor.roles.includes('Principal') || actor.roles.includes('Admin');
  const hasAcademicWrite = actor.permissions.includes('academic:write');

  if (!isPrincipal && !hasAcademicWrite) {
    throw new AppError(403, 'FORBIDDEN', 'Only authorized academic leadership (Principal) can approve student promotion outcomes.');
  }

  // Evaluate the learner's authoritative eligibility
  const roster = await getPromotionRoster(input.academicYearId);
  const learner = roster.learners.find(l => l.studentId === input.studentId);

  if (!learner) {
    throw new AppError(404, 'NOT_FOUND', 'Learner enrollment not found in this academic year.');
  }

  if (learner.eligibility === 'INCOMPLETE') {
    throw new AppError(400, 'INCOMPLETE_RECORDS', 'Cannot approve promotion for learner with incomplete academic records under DepEd Order No. 8, s. 2015.');
  }

  if (learner.eligibility === 'DEPARTED') {
    throw new AppError(400, 'INVALID_STATUS', 'Cannot approve promotion for officially departed learner (DepEd Order No. 11, s. 2018).');
  }

  if (input.decision === 'PROMOTED') {
    if (learner.currentGradeLevel >= 10) {
      throw new AppError(400, 'GRADE_10_PROGRAM_BOUNDARY', 'Grade 10 learners complete Junior High School and cannot be promoted to Grade 11 in DigiSkwela. Use JHS Completion confirmation instead.');
    }
    if (learner.eligibility === 'RETAINED') {
      throw new AppError(400, 'POLICY_VIOLATION', 'Cannot approve promotion for a learner with 3 or more failing learning areas under DepEd Order No. 8, s. 2015.');
    }
    if (learner.eligibility === 'REMEDIAL_REQUIRED') {
      throw new AppError(400, 'REMEDIAL_PENDING', 'Cannot approve promotion while required remedial classes remain pending completion under DepEd Order No. 8, s. 2015.');
    }
  }

  if (input.decision === 'COMPLETED') {
    if (learner.currentGradeLevel < 10) {
      throw new AppError(400, 'INVALID_DECISION', 'JHS Completion confirmation is only applicable for Grade 10 learners.');
    }
    if (learner.failedLearningAreasCount > 0) {
      throw new AppError(400, 'POLICY_VIOLATION', 'Cannot confirm JHS completion for learner with failing learning areas.');
    }
  }

  // Record authorized approval in AuditLog
  const auditId = generateId();
  const targetGrade = input.decision === 'PROMOTED' 
    ? learner.recommendedGradeLevel 
    : (input.decision === 'COMPLETED' ? 10 : learner.currentGradeLevel);

  await createAuditLog({
    actorUserId: actor.id,
    action: 'STUDENT_PROMOTION_APPROVED',
    category: 'academic_promotion',
    resourceType: 'student',
    resourceId: input.studentId,
    targetLabel: `${learner.fullName} (LRN: ${learner.lrn})`,
    newState: {
      academicYearId: input.academicYearId,
      studentId: input.studentId,
      lrn: learner.lrn,
      currentGradeLevel: learner.currentGradeLevel,
      currentSectionName: learner.currentSectionName,
      approvedOutcome: input.decision,
      targetGradeLevel: targetGrade,
      generalAverage: learner.generalAverage,
      remarks: input.remarks || `Approved ${input.decision} under DepEd Order No. 8, s. 2015`,
      approvedById: actor.id,
      approvedByRole: actor.roles.includes('Principal') ? 'Principal' : 'Admin'
    },
    reason: input.remarks || `Official DepEd Order No. 8, s. 2015 Deliberation: ${input.decision}`,
    correlationId
  });

  return {
    success: true,
    studentId: input.studentId,
    academicYearId: input.academicYearId,
    approvedOutcome: input.decision,
    targetGradeLevel: targetGrade,
    generalAverage: learner.generalAverage,
    message: input.decision === 'COMPLETED'
      ? `Junior High School Completion officially confirmed for ${learner.fullName}.`
      : `Promotion outcome '${input.decision}' officially recorded for ${learner.fullName}.`
  };
}

/**
 * Registrar next-year enrollment for a promoted or retained learner.
 * Reuses existing Student profile (same 12-digit LRN, same student User account).
 * Enforces atomic transaction, idempotency, duplicate prevention, and section grade level alignment.
 */
export async function enrollNextYearStudent(
  input: z.infer<typeof enrollNextYearSchema>,
  actor: { id: string; schoolId?: string; roles: string[]; permissions: string[] },
  correlationId?: string
) {
  // Authorization check: Must have enrollment:write permission (Registrar or Admin)
  const hasEnrollmentWrite = actor.permissions.includes('enrollment:write') || actor.roles.includes('Registrar') || actor.roles.includes('Admin');
  if (!hasEnrollmentWrite) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions to perform student enrollment. Registrar authorization required.');
  }

  return withTransaction(async (tx) => {
    // 1. Fetch Student profile
    const student = await tx.student.findUnique({
      where: { id: input.studentId },
      include: { user: true }
    });

    if (!student) {
      throw new AppError(404, 'NOT_FOUND', 'Student record not found.');
    }

    // 2. Fetch Source Enrollment
    const sourceEnrollment = await tx.enrollment.findFirst({
      where: {
        student_id: input.studentId,
        academic_year_id: input.sourceAcademicYearId,
        status: 'Enrolled'
      },
      include: {
        section: true,
        academic_year: true
      }
    });

    if (!sourceEnrollment) {
      throw new AppError(404, 'NOT_FOUND', 'Active source enrollment for student not found in specified academic year.');
    }

    // 3. Fetch Target Academic Year
    const targetAy = await tx.academicYear.findUnique({
      where: { id: input.targetAcademicYearId }
    });

    if (!targetAy) {
      throw new AppError(404, 'NOT_FOUND', 'Target academic year not found.');
    }

    if (input.targetAcademicYearId === input.sourceAcademicYearId) {
      throw new AppError(400, 'INVALID_TARGET_YEAR', 'Target academic year must be different from source academic year for promotion enrollment.');
    }

    // 4. Fetch Target Section
    const targetSection = await tx.section.findUnique({
      where: { id: input.targetSectionId }
    });

    if (!targetSection) {
      throw new AppError(404, 'NOT_FOUND', 'Target section not found.');
    }

    if (targetSection.academic_year_id !== input.targetAcademicYearId) {
      throw new AppError(400, 'INVALID_SECTION_RELATION', 'Target section does not belong to the target academic year.');
    }

    // 5. Duplicate Prevention: Verify no existing enrollment in target academic year
    const existingTargetEnrollment = await tx.enrollment.findFirst({
      where: {
        student_id: input.studentId,
        academic_year_id: input.targetAcademicYearId,
        status: 'Enrolled'
      }
    });

    if (existingTargetEnrollment) {
      throw new AppError(409, 'DUPLICATE_ENROLLMENT', 'Student is already enrolled in the target academic year. Duplicate enrollment is strictly prevented.');
    }

    // 6. Verify Promotion Evaluation & Grade Placement
    const roster = await getPromotionRoster(input.sourceAcademicYearId);
    const learner = roster.learners.find(l => l.studentId === input.studentId);

    if (!learner) {
      throw new AppError(404, 'NOT_FOUND', 'Learner not found in source academic year.');
    }

    if (learner.eligibility === 'INCOMPLETE') {
      throw new AppError(400, 'INCOMPLETE_RECORDS', 'Cannot enroll learner with incomplete academic records into the next school year.');
    }

    if (learner.eligibility === 'DEPARTED') {
      throw new AppError(400, 'INVALID_STATUS', 'Cannot enroll officially departed learner into the next school year.');
    }

    if (learner.eligibility === 'REMEDIAL_REQUIRED') {
      throw new AppError(400, 'REMEDIAL_PENDING', 'Cannot enroll learner while required remedial classes remain unresolved.');
    }

    if (learner.approval?.isStale) {
      throw new AppError(400, 'STALE_APPROVAL', `Learner promotion approval is stale: ${learner.approval.staleReason || 'Academic standing changed after approval'}. Re-deliberation by the Principal is required.`);
    }

    const currentGrade = sourceEnrollment.section.grade_level;
    let expectedGradeLevel: number;

    if (currentGrade >= 10) {
      if (learner.eligibility === 'RETAINED') {
        expectedGradeLevel = 10;
      } else {
        throw new AppError(400, 'GRADE_10_PROGRAM_BOUNDARY', 'DigiSkwela Junior High School ends at Grade 10. Grade 10 completers cannot be enrolled into Grade 11.');
      }
    } else if (learner.eligibility === 'RETAINED') {
      expectedGradeLevel = currentGrade; // Stays in same grade level
    } else if (learner.approval.isApproved && learner.approval.approvedOutcome === 'PROMOTED') {
      expectedGradeLevel = currentGrade + 1; // Advances to next grade level
    } else {
      throw new AppError(400, 'PROMOTION_APPROVAL_REQUIRED', 'Official promotion approval from the Principal is required before next-year enrollment.');
    }

    if (targetSection.grade_level !== expectedGradeLevel) {
      const outcomeLabel = learner.eligibility === 'RETAINED' ? 'retained' : 'promoted';
      throw new AppError(400, 'INVALID_GRADE_LEVEL_PLACEMENT', `Target section grade level (${targetSection.grade_level}) does not match expected placement (${expectedGradeLevel}) for ${outcomeLabel} learner.`);
    }

    // 7. Create NEW Enrollment for the target academic year
    // Note: The previous enrollment in sourceAcademicYearId is NOT overwritten, preserving all historical grades and section records
    const newEnrollmentId = generateId();
    const newEnrollment = await tx.enrollment.create({
      data: {
        id: newEnrollmentId,
        academic_year_id: input.targetAcademicYearId,
        student_id: input.studentId,
        section_id: input.targetSectionId,
        status: 'Enrolled',
        effective_start_date: targetAy.start_date,
      },
      include: {
        section: true,
        academic_year: true
      }
    });

    // 8. Update Student's active current_section_id and grade_level ONLY if target academic year is current
    // If target academic year is future (not yet current), leave current_section_id pointing to the active school year
    if (targetAy.is_current) {
      await tx.student.update({
        where: { id: input.studentId },
        data: {
          grade_level: targetSection.grade_level,
          current_section_id: targetSection.id
        }
      });
    }

    // 9. Audit Logging
    await createAuditLog({
      actorUserId: actor.id,
      action: 'NEXT_YEAR_STUDENT_ENROLLED',
      category: 'student_enrollment',
      resourceType: 'student_enrollment',
      resourceId: newEnrollmentId,
      targetLabel: `${student.user?.last_name || ''}, ${student.user?.first_name || ''} (LRN: ${student.lrn})`,
      previousState: {
        sourceAcademicYearId: input.sourceAcademicYearId,
        sourceGradeLevel: currentGrade,
        sourceSectionId: sourceEnrollment.section_id,
        sourceEnrollmentId: sourceEnrollment.id
      },
      newState: {
        targetAcademicYearId: input.targetAcademicYearId,
        targetGradeLevel: targetSection.grade_level,
        targetSectionId: input.targetSectionId,
        targetEnrollmentId: newEnrollmentId,
        studentId: input.studentId,
        lrn: student.lrn,
        approvedOutcome: learner.approval.approvedOutcome || (learner.eligibility === 'RETAINED' ? 'RETAINED' : 'PROMOTED')
      },
      reason: input.remarks || `Next-year enrollment into Grade ${targetSection.grade_level} ${targetSection.name} (${targetAy.name})`,
      correlationId
    }, tx);

    return {
      success: true,
      enrollment: {
        id: newEnrollment.id,
        studentId: input.studentId,
        lrn: student.lrn,
        fullName: `${student.user?.last_name}, ${student.user?.first_name}`,
        sourceGradeLevel: currentGrade,
        targetGradeLevel: targetSection.grade_level,
        targetAcademicYearId: targetAy.id,
        targetAcademicYearName: targetAy.name,
        targetSectionId: targetSection.id,
        targetSectionName: targetSection.name,
        status: newEnrollment.status,
        effectiveStartDate: newEnrollment.effective_start_date
      },
      message: `Student ${student.user?.first_name} ${student.user?.last_name} successfully enrolled in Grade ${targetSection.grade_level} ${targetSection.name} for ${targetAy.name}.`
    };
  });
}

/**
 * Principal Safe Bulk Promotion and JHS Completion Approval (Phase 2C.3).
 * Re-validates every individual learner at execution time under DepEd Order No. 8, s. 2015.
 * Strictly separates Grade 7–9 Promotion from Grade 10 JHS Completion.
 * Ensures record-level atomicity, idempotency, and individual audit logs.
 */
export async function bulkApproveStudentPromotion(
  input: z.infer<typeof bulkApprovePromotionSchema>,
  actor: { id: string; schoolId?: string; roles: string[]; permissions: string[] },
  correlationId?: string
) {
  // Authorization check: Principal or Admin only
  const hasAcademicWrite = actor.permissions.includes('academic:write') || actor.roles.includes('Principal') || actor.roles.includes('Admin');
  if (!hasAcademicWrite) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions to approve student outcomes. Principal authorization required.');
  }

  const batchId = generateId();

  // Fetch full promotion evaluation roster for this academic year
  const roster = await getPromotionRoster(input.academicYearId);
  const learnersMap = new Map(roster.learners.map(l => [l.studentId, l]));

  let candidateLearners: LearnerPromotionRecord[] = [];

  if (input.selectAllMatching) {
    // Filter candidates matching the provided filter scope
    let pool = [...roster.learners];
    const scope = input.filterScope || {};
    if (scope.search && scope.search.trim()) {
      const q = scope.search.trim().toLowerCase();
      pool = pool.filter(l => l.fullName.toLowerCase().includes(q) || l.lrn.includes(q));
    }
    if (scope.gradeLevel !== undefined && !isNaN(scope.gradeLevel)) {
      pool = pool.filter(l => l.currentGradeLevel === scope.gradeLevel);
    }
    if (scope.sectionId && scope.sectionId !== 'ALL') {
      pool = pool.filter(l => l.currentSectionId === scope.sectionId);
    }
    if (scope.outcome && scope.outcome !== 'ALL') {
      if (scope.outcome === 'ELIGIBLE') {
        pool = pool.filter(l => l.eligibility === 'ELIGIBLE_FOR_PROMOTION' || l.eligibility === 'JHS_COMPLETER');
      } else {
        pool = pool.filter(l => l.eligibility === scope.outcome);
      }
    }
    candidateLearners = pool;
  } else if (input.studentIds && input.studentIds.length > 0) {
    for (const sid of input.studentIds) {
      const l = learnersMap.get(sid);
      if (l) candidateLearners.push(l);
    }
  } else {
    throw new AppError(400, 'INVALID_REQUEST', 'Either studentIds or selectAllMatching must be provided.');
  }

  const approvedLearners: Array<{ studentId: string; fullName: string; lrn: string; gradeLevel: number; outcome: string }> = [];
  const excludedLearners: Array<{ studentId: string; fullName: string; lrn: string; reason: string }> = [];
  let alreadyApprovedCount = 0;

  for (const learner of candidateLearners) {
    // 1. Departed check
    if (learner.eligibility === 'DEPARTED') {
      excludedLearners.push({
        studentId: learner.studentId,
        fullName: learner.fullName,
        lrn: learner.lrn,
        reason: 'Officially departed under DepEd Order No. 11, s. 2018'
      });
      continue;
    }

    // 2. Incomplete academic requirements check
    if (!learner.isAcademicallyComplete || learner.eligibility === 'INCOMPLETE') {
      excludedLearners.push({
        studentId: learner.studentId,
        fullName: learner.fullName,
        lrn: learner.lrn,
        reason: learner.missingRequirements[0] || 'Incomplete published term grades'
      });
      continue;
    }

    // 3. Action type consistency check:
    if (input.actionType === 'PROMOTION') {
      if (learner.currentGradeLevel >= 10) {
        excludedLearners.push({
          studentId: learner.studentId,
          fullName: learner.fullName,
          lrn: learner.lrn,
          reason: 'Grade 10 learners complete JHS and must be confirmed through JHS Completion, not Promotion.'
        });
        continue;
      }
      if (learner.eligibility === 'RETAINED') {
        excludedLearners.push({
          studentId: learner.studentId,
          fullName: learner.fullName,
          lrn: learner.lrn,
          reason: `Retained in Grade ${learner.currentGradeLevel} (3+ failing learning areas under DO 8, s. 2015)`
        });
        continue;
      }
      if (learner.eligibility === 'REMEDIAL_REQUIRED') {
        excludedLearners.push({
          studentId: learner.studentId,
          fullName: learner.fullName,
          lrn: learner.lrn,
          reason: 'Pending completion of remedial classes under DO 8, s. 2015'
        });
        continue;
      }
    } else if (input.actionType === 'COMPLETION') {
      if (learner.currentGradeLevel < 10) {
        excludedLearners.push({
          studentId: learner.studentId,
          fullName: learner.fullName,
          lrn: learner.lrn,
          reason: `Learner is in Grade ${learner.currentGradeLevel}. JHS Completion is only applicable to Grade 10 learners.`
        });
        continue;
      }
      if (learner.failedLearningAreasCount > 0) {
        excludedLearners.push({
          studentId: learner.studentId,
          fullName: learner.fullName,
          lrn: learner.lrn,
          reason: `Failing learning areas: ${learner.failedLearningAreas.join(', ')}`
        });
        continue;
      }
    }

    const targetOutcome: 'PROMOTED' | 'COMPLETED' = input.actionType === 'COMPLETION' ? 'COMPLETED' : 'PROMOTED';
    const targetGrade = targetOutcome === 'COMPLETED' ? 10 : (learner.recommendedGradeLevel || (learner.currentGradeLevel + 1));

    // 4. Idempotency: Already approved check
    if (learner.approval.isApproved && learner.approval.approvedOutcome === targetOutcome) {
      alreadyApprovedCount++;
      continue;
    }

    // 5. Create atomic audit log record for this individual approval
    await createAuditLog({
      actorUserId: actor.id,
      action: 'STUDENT_PROMOTION_APPROVED',
      category: 'academic_promotion',
      resourceType: 'student',
      resourceId: learner.studentId,
      targetLabel: `${learner.fullName} (LRN: ${learner.lrn})`,
      newState: {
        academicYearId: input.academicYearId,
        studentId: learner.studentId,
        lrn: learner.lrn,
        currentGradeLevel: learner.currentGradeLevel,
        currentSectionName: learner.currentSectionName,
        approvedOutcome: targetOutcome,
        targetGradeLevel: targetGrade,
        generalAverage: learner.generalAverage,
        remarks: input.remarks || `Bulk ${input.actionType} approved under DepEd Order No. 8, s. 2015`,
        batchOperation: true,
        batchId,
        approvedById: actor.id,
        approvedByRole: actor.roles.includes('Principal') ? 'Principal' : 'Admin'
      },
      reason: input.remarks || `Bulk Official DepEd Order No. 8, s. 2015 Approval: ${input.actionType} (Batch ${batchId})`,
      correlationId
    });

    approvedLearners.push({
      studentId: learner.studentId,
      fullName: learner.fullName,
      lrn: learner.lrn,
      gradeLevel: learner.currentGradeLevel,
      outcome: targetOutcome
    });
  }

  return {
    batchId,
    actionType: input.actionType,
    totalRequested: candidateLearners.length,
    approvedCount: approvedLearners.length,
    alreadyApprovedCount,
    excludedCount: excludedLearners.length,
    failedCount: 0,
    approvedLearners,
    excludedLearners,
    message: input.actionType === 'COMPLETION'
      ? `${approvedLearners.length} Grade 10 learner(s) successfully confirmed for JHS Completion. ${excludedLearners.length} excluded. ${alreadyApprovedCount} already confirmed.`
      : `${approvedLearners.length} learner(s) successfully approved for promotion. ${excludedLearners.length} excluded. ${alreadyApprovedCount} already approved.`
  };
}

/**
 * Registrar Safe Bulk Next-Year Re-Enrollment (Phase 2C.3).
 * Atomically places approved Grade 7–9 learners into target academic year sections.
 * Enforces verified Principal approval, section grade-level alignment, duplicate prevention,
 * and strict Grade 10 boundary preservation.
 */
export async function bulkEnrollNextYearStudents(
  input: z.infer<typeof bulkEnrollNextYearSchema>,
  actor: { id: string; schoolId?: string; roles: string[]; permissions: string[] },
  correlationId?: string
) {
  // Authorization check: Must have enrollment:write permission (Registrar or Admin)
  const hasEnrollmentWrite = actor.permissions.includes('enrollment:write') || actor.roles.includes('Registrar') || actor.roles.includes('Admin');
  if (!hasEnrollmentWrite) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions to perform student enrollment. Registrar authorization required.');
  }

  if (input.targetAcademicYearId === input.sourceAcademicYearId) {
    throw new AppError(400, 'INVALID_TARGET_YEAR', 'Target academic year must be different from source academic year.');
  }

  const targetAy = await prisma.academicYear.findUnique({
    where: { id: input.targetAcademicYearId }
  });
  if (!targetAy) {
    throw new AppError(404, 'NOT_FOUND', 'Target academic year not found.');
  }

  // Pre-fetch all sections in target academic year
  const targetSections = await prisma.section.findMany({
    where: { academic_year_id: input.targetAcademicYearId }
  });
  const sectionMap = new Map(targetSections.map(s => [s.id, s]));

  // Pre-fetch existing target enrollments to prevent duplicates
  const studentIds = input.placements.map(p => p.studentId);
  const existingEnrollments = await prisma.enrollment.findMany({
    where: {
      student_id: { in: studentIds },
      academic_year_id: input.targetAcademicYearId,
      status: 'Enrolled'
    }
  });
  const existingEnrollmentSet = new Set(existingEnrollments.map(e => e.student_id));

  // Fetch source roster to verify approval and eligibility
  const roster = await getPromotionRoster(input.sourceAcademicYearId);
  const learnersMap = new Map(roster.learners.map(l => [l.studentId, l]));

  const enrolledLearners: Array<{ studentId: string; fullName: string; targetSectionName: string; gradeLevel: number }> = [];
  const excludedLearners: Array<{ studentId: string; fullName: string; reason: string }> = [];
  let skippedCount = 0;

  for (const placement of input.placements) {
    const learner = learnersMap.get(placement.studentId);
    if (!learner) {
      excludedLearners.push({
        studentId: placement.studentId,
        fullName: 'Unknown Student',
        reason: 'Student not found in source academic year.'
      });
      continue;
    }

    // 1. Check duplicate
    if (existingEnrollmentSet.has(placement.studentId)) {
      skippedCount++;
      continue;
    }

    // 2. Target Section validity
    const targetSection = sectionMap.get(placement.targetSectionId);
    if (!targetSection) {
      excludedLearners.push({
        studentId: placement.studentId,
        fullName: learner.fullName,
        reason: 'Target section does not exist in target academic year.'
      });
      continue;
    }

    // 3. Grade 10 program boundary check
    if (learner.currentGradeLevel >= 10 || learner.approval.approvedOutcome === 'COMPLETED') {
      excludedLearners.push({
        studentId: placement.studentId,
        fullName: learner.fullName,
        reason: 'Grade 10 completers cannot be enrolled into next school year (JHS program ends at Grade 10).'
      });
      continue;
    }

    // 4. Principal approval check
    if (learner.approval?.isStale) {
      excludedLearners.push({
        studentId: placement.studentId,
        fullName: learner.fullName,
        reason: `Promotion approval is stale: ${learner.approval.staleReason || 'Academic standing changed after approval'}.`
      });
      continue;
    }

    if (!learner.approval.isApproved || learner.approval.approvedOutcome !== 'PROMOTED') {
      excludedLearners.push({
        studentId: placement.studentId,
        fullName: learner.fullName,
        reason: 'Official Principal promotion approval required before enrollment.'
      });
      continue;
    }

    // 5. Target grade level alignment
    const expectedGradeLevel = learner.eligibility === 'RETAINED' ? learner.currentGradeLevel : (learner.currentGradeLevel + 1);
    if (targetSection.grade_level !== expectedGradeLevel) {
      excludedLearners.push({
        studentId: placement.studentId,
        fullName: learner.fullName,
        reason: `Target section grade level (${targetSection.grade_level}) does not match expected placement (${expectedGradeLevel}).`
      });
      continue;
    }

    // 6. Create enrollment atomically per student (safe batch processing with record-level atomicity)
    const newEnrollmentId = generateId();
    await prisma.enrollment.create({
      data: {
        id: newEnrollmentId,
        academic_year_id: input.targetAcademicYearId,
        student_id: placement.studentId,
        section_id: placement.targetSectionId,
        status: 'Enrolled'
      }
    });

    // Record audit log
    await createAuditLog({
      actorUserId: actor.id,
      action: 'STUDENT_ENROLLED_NEXT_YEAR',
      category: 'academic_promotion',
      resourceType: 'enrollment',
      resourceId: newEnrollmentId,
      targetLabel: `${learner.fullName} (LRN: ${learner.lrn})`,
      newState: {
        enrollmentId: newEnrollmentId,
        studentId: placement.studentId,
        sourceAcademicYearId: input.sourceAcademicYearId,
        targetAcademicYearId: input.targetAcademicYearId,
        targetSectionId: placement.targetSectionId,
        targetSectionName: targetSection.name,
        targetGradeLevel: targetSection.grade_level,
        status: 'Enrolled',
        batchOperation: true,
        remarks: input.remarks || 'Bulk next-year enrollment by Registrar'
      },
      reason: input.remarks || 'Authorized Bulk Next-Year Student Enrollment',
      correlationId
    });

    existingEnrollmentSet.add(placement.studentId);
    enrolledLearners.push({
      studentId: placement.studentId,
      fullName: learner.fullName,
      targetSectionName: targetSection.name,
      gradeLevel: targetSection.grade_level
    });
  }

  return {
    totalRequested: input.placements.length,
    enrolledCount: enrolledLearners.length,
    skippedCount,
    excludedCount: excludedLearners.length,
    failedCount: excludedLearners.length,
    enrolledLearners,
    excludedLearners,
    message: `${enrolledLearners.length} student(s) successfully enrolled into next school year. ${excludedLearners.length} excluded. ${skippedCount} already enrolled.`
  };
}
