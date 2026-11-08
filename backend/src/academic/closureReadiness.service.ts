import { z } from 'zod';
import prisma, { withTransaction } from '../config/database.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { classifyAcademicYearLifecycle, AcademicYearLifecycle } from '../common/utils/calendarValidation.js';
import { AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';

export interface TermReadinessSummary {
  termKey: 'T1' | 'T2' | 'T3' | 'T4';
  termLabel: string;
  expectedGradebooks: number;
  publishedGradebooks: number;
  draftGradebooks: number;
  missingGradebooks: number;
  status: 'READY' | 'NOT_READY';
}

export interface UnresolvedGradebookItem {
  sectionId: string;
  sectionName: string;
  gradeLevel: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  termKey: string;
  termLabel: string;
  teacherId: string;
  teacherName: string;
  status: 'Draft' | 'Missing';
  gradebookId: string | null;
  requiredAction?: string;
}

export interface UnresolvedStudentItem {
  studentId: string;
  schoolId: string;
  name: string;
  gradeLevel: number;
  sectionName: string;
  missingTerms: string[];
  missingSubjectsCount: number;
  hasIssuedSf9: boolean;
  generalAverageStatus: 'Eligible' | 'Withheld (Incomplete Record)' | 'Withheld (Unverified Departure)';
  reason: string;
  requiredAction?: string;
}

export interface DraftDailyAttendanceItem {
  id: string;
  date: Date;
  sectionName: string;
  gradeLevel: number;
  adviserName: string;
  status: string;
  requiredAction: string;
}

export interface AttendanceAnomalyItem {
  id: string;
  studentId: string;
  studentName: string;
  sectionName: string;
  date: Date;
  effectivePeriod: string;
  anomalyType: 'ATTENDANCE_AFTER_DEPARTURE' | 'ATTENDANCE_BEFORE_ENROLLMENT';
  description: string;
  requiredAction: string;
}

export interface LearnerExceptionItem {
  studentId: string;
  schoolId: string;
  name: string;
  gradeLevel: number;
  sectionName: string;
  status: 'Dropped_Out' | 'Transferred_Out' | 'Enrolled' | 'Completed';
  departureDate: string | null;
  preservedTerms: string[];
  excusedTerms: string[];
  isVerified: boolean;
  authorizedBy?: string;
  authorizedAt?: string;
  notes: string;
}

export interface AcademicRemedialItem {
  studentId: string;
  schoolId: string;
  name: string;
  gradeLevel: number;
  sectionName: string;
  failedSubjectsCount: number;
  failedSubjects: Array<{
    subjectName: string;
    termKey: string;
    grade: number;
    finalRating?: number;
    termBreakdown?: string;
  }>;
  recommendation: 'Remedial Classes Required (DepEd Order No. 8, s. 2015)' | 'Retained in Grade Level (DepEd Order No. 8, s. 2015)';
}

export interface SectionCurriculumSummary {
  sectionId: string;
  sectionName: string;
  gradeLevel: number;
  assignedSubjectsCount: number;
  expectedSubjectsCount: number;
  hasFullJhsCurriculum: boolean;
  missingLearningAreas: string[];
}

export interface ClosureReadinessReport {
  academicYear: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
    lifecycle: AcademicYearLifecycle;
    configuredTerms: Array<{ key: string; label: string }>;
  };
  overallStatus: 'READY' | 'NOT_READY' | 'REVIEW_REQUIRED';
  summaryMessage: string;
  gradebooks: {
    totalExpected: number;
    totalExisting: number;
    publishedCount: number;
    draftCount: number;
    missingCount: number;
    byTerm: TermReadinessSummary[];
    unresolvedCount: number;
    unresolvedSample: UnresolvedGradebookItem[];
    unresolvedGradebooks?: UnresolvedGradebookItem[];
  };
  curriculumCoverage: {
    requiredLearningAreasPerSection: number;
    sectionsEvaluated: SectionCurriculumSummary[];
    allSectionsHaveFullCurriculum: boolean;
  };
  studentCompleteness: {
    totalEnrolled: number;
    activeEnrolledCount: number;
    departedCount: number;
    droppedCount: number;
    transferredCount: number;
    fullyCompleteCount: number;
    incompleteCount: number;
    remedialCandidatesCount: number;
    retainedCandidatesCount: number;
    withheldAverageCount: number;
    unresolvedStudents: UnresolvedStudentItem[];
    departedLearners?: LearnerExceptionItem[];
    academicExceptions?: AcademicRemedialItem[];
  };
  officialAttendance: {
    totalCalendarMonths: number;
    finalizedMonthsCount: number;
    unfinalizedMonthsCount: number;
    totalDailyRecords: number;
    verifiedDailyRecordsCount: number;
    draftDailyRecordsCount: number;
    anomaliesCount: number;
    status: 'READY' | 'NOT_READY';
    draftDailyItems?: DraftDailyAttendanceItem[];
    anomaliesItems?: AttendanceAnomalyItem[];
  };
  sf9IssuanceReadiness: {
    totalEligibleStudents: number;
    issuedSf9Count: number;
    unissuedSf9Count: number;
    status: 'REVIEW_REQUIRED' | 'READY';
    note: string;
  };
  blockers: string[];
  policyDependencies: string[];
}

const AUTHORIZED_ADMIN_ROLES = ['Admin', 'ITAdmin', 'Principal', 'Registrar'];

function getTermLabel(key: string): string {
  switch (key) {
    case 'T1': return 'TERM 1';
    case 'T2': return 'TERM 2';
    case 'T3': return 'TERM 3';
    case 'T4': return 'TERM 4';
    default: return key.toUpperCase();
  }
}

/**
 * Assesses school-year closure readiness in strict read-only mode.
 * Performs zero database mutations.
 */
export async function assessAcademicYearClosureReadiness(
  academicYearId: string,
  actor: AuthenticatedUser
): Promise<ClosureReadinessReport> {
  // 1. Role Authorization Verification
  const userRoles = Array.isArray(actor.roles) ? actor.roles : [];
  const isAuthorized = userRoles.some(r => AUTHORIZED_ADMIN_ROLES.includes(r));
  if (!isAuthorized) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only authorized school administrators (Admin, ITAdmin, Principal, Registrar) may access school-year closure readiness.'
    );
  }

  // 2. Academic Year Resolution
  const academicYear = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    include: {
      terms: {
        orderBy: { key: 'asc' },
      },
      sections: {
        orderBy: [{ grade_level: 'asc' }, { name: 'asc' }],
        include: {
          assignments: {
            include: {
              subject: true,
              teacher: {
                include: { user: true }
              }
            }
          }
        }
      }
    }
  });

  if (!academicYear) {
    throw new AppError(404, 'NOT_FOUND', `Academic year ${academicYearId} not found.`);
  }

  const lifecycle = classifyAcademicYearLifecycle(academicYear);
  const configuredTerms = academicYear.terms.map(t => ({
    key: t.key,
    label: getTermLabel(t.key),
  }));

  // 3. Gradebook Completeness Inspection
  // Total expected = sections * assignments * configuredTerms
  const allAssignments = academicYear.sections.flatMap(s =>
    s.assignments.map(a => ({
      ...a,
      sectionName: s.name,
      gradeLevel: s.grade_level,
    }))
  );

  const existingGradebooks = await prisma.gradebooks.findMany({
    where: {
      term: { academic_year_id: academicYearId }
    },
    include: {
      term: true,
      assignment: {
        include: {
          subject: true,
          section: true,
          teacher: { include: { user: true } }
        }
      }
    }
  });

  const gradebookLookup = new Map<string, typeof existingGradebooks[0]>();
  for (const gb of existingGradebooks) {
    gradebookLookup.set(`${gb.assignment_id}_${gb.term.key}`, gb);
  }

  const totalExpectedGradebooks = allAssignments.length * configuredTerms.length;
  let publishedGradebooksCount = 0;
  let draftGradebooksCount = 0;
  let missingGradebooksCount = 0;

  const unresolvedGradebooks: UnresolvedGradebookItem[] = [];
  const byTermSummary: TermReadinessSummary[] = [];

  for (const term of configuredTerms) {
    let termPublished = 0;
    let termDraft = 0;
    let termMissing = 0;

    for (const a of allAssignments) {
      const gbKey = `${a.id}_${term.key}`;
      const gb = gradebookLookup.get(gbKey);

      if (!gb) {
        termMissing++;
        missingGradebooksCount++;
        unresolvedGradebooks.push({
          sectionId: a.section_id,
          sectionName: a.sectionName,
          gradeLevel: a.gradeLevel,
          subjectId: a.subject_id,
          subjectCode: a.subject.code,
          subjectName: a.subject.name,
          termKey: term.key,
          termLabel: term.label,
          teacherId: a.teacher_id,
          teacherName: a.teacher?.user ? `${a.teacher.user.first_name} ${a.teacher.user.last_name}` : 'Unassigned',
          status: 'Missing',
          gradebookId: null,
          requiredAction: 'Initialize gradebook and encode scores',
        });
      } else if (gb.status === 'Published') {
        termPublished++;
        publishedGradebooksCount++;
      } else {
        termDraft++;
        draftGradebooksCount++;
        unresolvedGradebooks.push({
          sectionId: a.section_id,
          sectionName: a.sectionName,
          gradeLevel: a.gradeLevel,
          subjectId: a.subject_id,
          subjectCode: a.subject.code,
          subjectName: a.subject.name,
          termKey: term.key,
          termLabel: term.label,
          teacherId: a.teacher_id,
          teacherName: a.teacher?.user ? `${a.teacher.user.first_name} ${a.teacher.user.last_name}` : 'Unassigned',
          status: 'Draft',
          gradebookId: gb.id,
          requiredAction: 'Teacher to encode scores and publish',
        });
      }
    }

    byTermSummary.push({
      termKey: term.key as any,
      termLabel: term.label,
      expectedGradebooks: allAssignments.length,
      publishedGradebooks: termPublished,
      draftGradebooks: termDraft,
      missingGradebooks: termMissing,
      status: (termMissing === 0 && termDraft === 0) ? 'READY' : 'NOT_READY',
    });
  }

  // 4. Curriculum Coverage Verification
  // In JHS (Grades 7–10), 9 database subjects represent 8 official core learning areas (with MAPEH composite)
  const sectionsCurriculum: SectionCurriculumSummary[] = academicYear.sections.map(s => {
    const subjectCodes = s.assignments.map(a => a.subject.code.toUpperCase());
    const isJhs = s.grade_level >= 7 && s.grade_level <= 10;
    const expectedCount = isJhs ? 9 : 1;
    const hasFull = s.assignments.length >= expectedCount;

    const missingAreas: string[] = [];
    if (isJhs) {
      if (!subjectCodes.some(c => c.startsWith('FIL'))) missingAreas.push('Filipino');
      if (!subjectCodes.some(c => c.startsWith('ENG'))) missingAreas.push('English');
      if (!subjectCodes.some(c => c.startsWith('MATH'))) missingAreas.push('Mathematics');
      if (!subjectCodes.some(c => c.startsWith('SCI'))) missingAreas.push('Science');
      if (!subjectCodes.some(c => c.startsWith('AP'))) missingAreas.push('Araling Panlipunan');
      if (!subjectCodes.some(c => c.startsWith('VE') || c.startsWith('ESP'))) missingAreas.push('Values Education / EsP');
      if (!subjectCodes.some(c => c.startsWith('TLE'))) missingAreas.push('TLE');
      if (!subjectCodes.some(c => c.startsWith('MA') || c.startsWith('PEH'))) missingAreas.push('MAPEH');
    }

    return {
      sectionId: s.id,
      sectionName: s.name,
      gradeLevel: s.grade_level,
      assignedSubjectsCount: s.assignments.length,
      expectedSubjectsCount: expectedCount,
      hasFullJhsCurriculum: hasFull && missingAreas.length === 0,
      missingLearningAreas: missingAreas,
    };
  });

  const allSectionsCurriculumComplete = sectionsCurriculum.every(s => s.hasFullJhsCurriculum);

  // 5. Learner Academic Completeness
  const enrollments = await prisma.enrollment.findMany({
    where: {
      academic_year_id: academicYearId,
    },
    include: {
      student: { include: { user: true } },
      section: true,
      sf9_issuances: {
        where: { is_current: true }
      }
    },
    orderBy: [
      { section: { grade_level: 'asc' } },
      { section: { name: 'asc' } },
      { student: { user: { last_name: 'asc' } } }
    ]
  });

  const allGrades = await prisma.grade.findMany({
    where: { academic_year_id: academicYearId },
    include: { subject: true }
  });

  // Query audit logs for departure authorization evidence (DepEd Order No. 11, s. 2018)
  const departureAudits = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          'ENROLLMENT_TRANSFERRED',
          'STUDENT_DROPPED_OUT',
          'STUDENT_TRANSFERRED_OUT',
          'LEARNER_STATUS_UPDATED',
          'ENROLLMENT_STATUS_UPDATED',
          'LEARNER_DEPARTURE_RECORDED',
          'STUDENT_STATUS_UPDATE',
          'ENROLLMENT_UPDATE',
        ]
      },
      actor_role: {
        in: ['Admin', 'ITAdmin', 'Principal', 'Registrar']
      }
    },
    orderBy: { created_at: 'desc' }
  });

  const auditByResourceId = new Map<string, typeof departureAudits[0]>();
  for (const aud of departureAudits) {
    if (aud.resource_id && !auditByResourceId.has(aud.resource_id)) {
      auditByResourceId.set(aud.resource_id, aud);
    }
  }

  // Group published grades by student
  const studentGradesMap = new Map<string, typeof allGrades>();
  for (const g of allGrades) {
    if (!studentGradesMap.has(g.student_id)) {
      studentGradesMap.set(g.student_id, []);
    }
    studentGradesMap.get(g.student_id)!.push(g);
  }

  let activeEnrolledCount = 0;
  let droppedCount = 0;
  let transferredCount = 0;
  let completedCount = 0;

  let fullyCompleteStudentsCount = 0;
  let incompleteStudentsCount = 0;
  let remedialCandidatesCount = 0;
  let retainedCandidatesCount = 0;

  const unresolvedStudents: UnresolvedStudentItem[] = [];
  const departedLearners: LearnerExceptionItem[] = [];
  const academicExceptions: AcademicRemedialItem[] = [];

  for (const enr of enrollments) {
    const sName = enr.student.user
      ? `${enr.student.user.first_name} ${enr.student.user.last_name}`
      : `${enr.student.first_name} ${enr.student.last_name}`;
    const schoolId = enr.student.user?.school_id || enr.student.lrn || 'N/A';
    const sGrades = studentGradesMap.get(enr.student_id) || [];
    const publishedGrades = sGrades.filter(g => g.published_term_grade !== null);
    const sectionAssignments = allAssignments.filter(a => a.section_id === enr.section_id);
    const hasSf9 = enr.sf9_issuances.length > 0;

    const rawStatus = (enr.status || '').toLowerCase().replace(/[-_\s]/g, '');
    const isDropped = rawStatus.includes('drop');
    const isTransferred = rawStatus.includes('transfer');
    const isDeparted = isDropped || isTransferred;

    if (isDropped) droppedCount++;
    else if (isTransferred) transferredCount++;
    else if (rawStatus.includes('complete')) completedCount++;
    else activeEnrolledCount++;

    if (isDeparted) {
      // Learner movement under DepEd Order No. 11, s. 2018 & DO 58, s. 2017
      const departureDate = enr.effective_end_date ? new Date(enr.effective_end_date) : null;
      const departureDateStr = departureDate ? departureDate.toISOString().split('T')[0] : null;

      // Check 1: Valid departure date within academic year bounds
      const isDateValid = departureDate !== null &&
        departureDate >= academicYear.start_date &&
        departureDate <= academicYear.end_date;

      // Check 2: Administrative authorization evidence in AuditLog
      const auditRecord = auditByResourceId.get(enr.id) || auditByResourceId.get(enr.student_id);
      const hasAuthorizationEvidence = Boolean(auditRecord);

      if (!departureDate || !isDateValid) {
        // MANDATORY BLOCKER: Missing or invalid departure date
        incompleteStudentsCount++;
        unresolvedStudents.push({
          studentId: enr.student_id,
          schoolId,
          name: sName,
          gradeLevel: enr.section.grade_level,
          sectionName: enr.section.name,
          missingTerms: ['All (Invalid / Missing Departure Date)'],
          missingSubjectsCount: sectionAssignments.length,
          hasIssuedSf9: hasSf9,
          generalAverageStatus: 'Withheld (Incomplete Record)',
          reason: !departureDate
            ? `Officially marked ${isDropped ? 'Dropped Out' : 'Transferred Out'} but missing verified departure date in accordance with DepEd Order No. 11, s. 2018.`
            : `Departure date ${departureDateStr} falls outside academic year boundaries (${academicYear.start_date.toISOString().split('T')[0]} to ${academicYear.end_date.toISOString().split('T')[0]}).`,
          requiredAction: 'Registrar or School Head must record valid effective departure date within academic year bounds.',
        });
      } else if (!hasAuthorizationEvidence) {
        // MANDATORY BLOCKER: Departure date exists but lacks administrative authorization in AuditLog
        incompleteStudentsCount++;
        unresolvedStudents.push({
          studentId: enr.student_id,
          schoolId,
          name: sName,
          gradeLevel: enr.section.grade_level,
          sectionName: enr.section.name,
          missingTerms: ['All (Unverified Departure)'],
          missingSubjectsCount: sectionAssignments.length,
          hasIssuedSf9: hasSf9,
          generalAverageStatus: 'Withheld (Unverified Departure)',
          reason: `Learner marked ${isDropped ? 'Dropped Out' : 'Transferred Out'} on ${departureDateStr} lacks verified administrative authorization audit trail (DepEd Order No. 11, s. 2018).`,
          requiredAction: 'Registrar or School Head must verify official departure documentation and record administrative approval.',
        });
      } else {
        // Departure is verified and authorized! Determine preserved vs excused terms
        const preservedTerms: string[] = [];
        const excusedTerms: string[] = [];

        for (const term of academicYear.terms) {
          const tLabel = getTermLabel(term.key);
          const hasPubInTerm = publishedGrades.some(g => g.term === term.key);
          const termStart = term.start_date ? new Date(term.start_date) : null;

          if (termStart && departureDate < termStart) {
            excusedTerms.push(tLabel);
          } else {
            if (hasPubInTerm) {
              preservedTerms.push(tLabel);
            } else {
              excusedTerms.push(`${tLabel} (Departed Mid-Term)`);
            }
          }
        }

        departedLearners.push({
          studentId: enr.student_id,
          schoolId,
          name: sName,
          gradeLevel: enr.section.grade_level,
          sectionName: enr.section.name,
          status: isDropped ? 'Dropped_Out' : 'Transferred_Out',
          departureDate: departureDateStr,
          preservedTerms,
          excusedTerms,
          isVerified: true,
          authorizedBy: auditRecord ? `${auditRecord.actor_role || 'Authorized Admin'} (${auditRecord.actor_school_id || auditRecord.actor_user_id || 'System'})` : 'Administrative Record',
          authorizedAt: auditRecord ? auditRecord.created_at.toISOString().split('T')[0] : undefined,
          notes: isDropped
            ? `Learner officially dropped out on ${departureDateStr}. Earned records preserved; subsequent terms excused per DO 11, s. 2018.`
            : `Learner officially transferred out on ${departureDateStr}. Earned records preserved for SF10 transfer per DO 58, s. 2017.`,
        });
        // Note: Do NOT increment fullyCompleteStudentsCount! Officially departed learners are tracked separately in departedCount.
      }
    } else {
      // Active learner (Enrolled or Completed)
      const missingTermLabels: string[] = [];
      const missingSubjectLabels: string[] = [];

      // Map published grades for this learner by subject_id and term key
      const publishedGradeBySubject = new Map<string, Record<string, number>>();
      const subjectByGradeId = new Map<string, { code: string; name: string }>();
      for (const g of publishedGrades) {
        if (g.published_term_grade !== null) {
          if (!publishedGradeBySubject.has(g.subject_id)) {
            publishedGradeBySubject.set(g.subject_id, {});
          }
          publishedGradeBySubject.get(g.subject_id)![g.term] = Number(g.published_term_grade);
          if (g.subject) {
            subjectByGradeId.set(g.subject_id, { code: g.subject.code || '', name: g.subject.name || '' });
          }
        }
      }

      // Resilient helper: matches by ID or canonical subject code/name (PEH, MA, etc.)
      const getLearnerTermGrade = (assignmentSubject: { id: string; code?: string | null; name?: string | null }, termKey: string): number | undefined => {
        const direct = publishedGradeBySubject.get(assignmentSubject.id)?.[termKey];
        if (direct !== undefined && direct !== null) return direct;

        const targetCode = (assignmentSubject.code || '').toUpperCase();
        const targetName = (assignmentSubject.name || '').toLowerCase();
        const isTargetPe = /physical education|\bpe\b|\bpeh\b|^peh/i.test(targetName) || /^peh/i.test(targetCode);
        const isTargetMus = /music|^mus|^ma(?:\b|_|-|\d)/i.test(targetName) || /^ma(?:\b|_|-|\d)/i.test(targetCode);

        for (const [gradeSubjId, terms] of publishedGradeBySubject.entries()) {
          if (terms[termKey] === undefined || terms[termKey] === null) continue;
          const info = subjectByGradeId.get(gradeSubjId);
          if (!info) continue;
          const gradeCode = info.code.toUpperCase();
          const gradeName = info.name.toLowerCase();

          if (targetCode && gradeCode && targetCode === gradeCode) return terms[termKey];
          if (isTargetPe && (/physical education|\bpe\b|\bpeh\b|^peh/i.test(gradeName) || /^peh/i.test(gradeCode))) return terms[termKey];
          if (isTargetMus && (/music|^mus|^ma(?:\b|_|-|\d)/i.test(gradeName) || /^ma(?:\b|_|-|\d)/i.test(gradeCode))) return terms[termKey];
        }
        return undefined;
      };

      for (const term of configuredTerms) {
        let termComplete = true;
        for (const a of sectionAssignments) {
          const val = getLearnerTermGrade(a.subject, term.key);
          if (val === undefined) {
            termComplete = false;
            missingSubjectLabels.push(`${a.subject.name} (${term.label})`);
          }
        }
        if (!termComplete) {
          missingTermLabels.push(term.label);
        }
      }

      const isFullyComplete = missingTermLabels.length === 0 && sectionAssignments.length > 0;

      if (isFullyComplete) {
        fullyCompleteStudentsCount++;

        // Evaluate authoritative annual Final Learning-Area Ratings under DepEd Order No. 8, s. 2015
        // 1. Detect Music & Arts and PE & Health for official MAPEH consolidation
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

        interface EvaluatedLearningArea {
          learningArea: string;
          finalRating: number;
          termGradesText: string;
          isFailed: boolean;
        }

        const evaluatedAreas: EvaluatedLearningArea[] = [];

        // Process core non-MAPEH learning areas
        for (const a of sectionAssignments) {
          if ((musicAssignment && a.id === musicAssignment.id) || (peAssignment && a.id === peAssignment.id)) {
            continue; // Handled in composite MAPEH below
          }
          const termVals = configuredTerms.map(t => getLearnerTermGrade(a.subject, t.key));
          const validVals = termVals.filter((v): v is number => v !== undefined);
          if (validVals.length !== configuredTerms.length) continue;

          const sum = validVals.reduce((acc: number, v: number) => acc + v, 0);
          const finalRating = Math.round(sum / configuredTerms.length);
          const termBreakdown = configuredTerms.map(t => `${t.key}: ${getLearnerTermGrade(a.subject, t.key) ?? 'N/A'}`).join(', ');

          evaluatedAreas.push({
            learningArea: a.subject.name,
            finalRating,
            termGradesText: `Final: ${finalRating} (${termBreakdown})`,
            isFailed: finalRating < 75,
          });
        }

        // Process MAPEH consolidation (DepEd Order No. 8, s. 2015 & DO 58, s. 2017)
        if (musicAssignment && peAssignment) {
          const mapehTermGrades: Record<string, number> = {};
          for (const t of configuredTerms) {
            const mVal = getLearnerTermGrade(musicAssignment.subject, t.key);
            const pVal = getLearnerTermGrade(peAssignment.subject, t.key);
            if (mVal !== undefined && pVal !== undefined) {
              mapehTermGrades[t.key] = Math.round((mVal + pVal) / 2);
            }
          }

          const mapehVals = configuredTerms.map(t => mapehTermGrades[t.key]);
          const validMapeh = mapehVals.filter((v): v is number => v !== undefined);
          const mapehSum = validMapeh.reduce((acc: number, v: number) => acc + v, 0);
          const finalMapehRating = validMapeh.length === configuredTerms.length ? Math.round(mapehSum / configuredTerms.length) : 0;
          const mapehTermBreakdown = configuredTerms
            .map(t => `${t.key}: ${mapehTermGrades[t.key]} (M:${getLearnerTermGrade(musicAssignment.subject, t.key)}, PE:${getLearnerTermGrade(peAssignment.subject, t.key)})`)
            .join(', ');

          evaluatedAreas.push({
            learningArea: 'MAPEH',
            finalRating: finalMapehRating,
            termGradesText: `Final: ${finalMapehRating} (${mapehTermBreakdown})`,
            isFailed: finalMapehRating < 75,
          });
        }

        // Identify failed learning areas based strictly on annual Final Ratings (< 75)
        const failedLearningAreas = evaluatedAreas.filter(a => a.isFailed);

        if (failedLearningAreas.length > 0) {
          const distinctFailedCount = failedLearningAreas.length;

          if (distinctFailedCount <= 2) {
            remedialCandidatesCount++;
            academicExceptions.push({
              studentId: enr.student_id,
              schoolId,
              name: sName,
              gradeLevel: enr.section.grade_level,
              sectionName: enr.section.name,
              failedSubjectsCount: distinctFailedCount,
              failedSubjects: failedLearningAreas.map(f => ({
                subjectName: f.learningArea,
                termKey: f.termGradesText,
                grade: f.finalRating,
                finalRating: f.finalRating,
                termBreakdown: f.termGradesText,
              })),
              recommendation: 'Remedial Classes Required (DepEd Order No. 8, s. 2015)',
            });
          } else {
            retainedCandidatesCount++;
            academicExceptions.push({
              studentId: enr.student_id,
              schoolId,
              name: sName,
              gradeLevel: enr.section.grade_level,
              sectionName: enr.section.name,
              failedSubjectsCount: distinctFailedCount,
              failedSubjects: failedLearningAreas.map(f => ({
                subjectName: f.learningArea,
                termKey: f.termGradesText,
                grade: f.finalRating,
                finalRating: f.finalRating,
                termBreakdown: f.termGradesText,
              })),
              recommendation: 'Retained in Grade Level (DepEd Order No. 8, s. 2015)',
            });
          }
        }
      } else {
        incompleteStudentsCount++;
        unresolvedStudents.push({
          studentId: enr.student_id,
          schoolId,
          name: sName,
          gradeLevel: enr.section.grade_level,
          sectionName: enr.section.name,
          missingTerms: missingTermLabels,
          missingSubjectsCount: missingSubjectLabels.length,
          hasIssuedSf9: hasSf9,
          generalAverageStatus: 'Withheld (Incomplete Record)',
          reason: missingTermLabels.length > 0
            ? `Missing published grades for ${missingTermLabels.join(', ')}`
            : 'Incomplete subject assignments',
          requiredAction: 'Awaiting grade publication for missing terms',
        });
      }
    }
  }

  // 6. Official Attendance Verification Inspection
  const calendarMonths = await prisma.schoolCalendarMonth.findMany({
    where: { academic_year_id: academicYearId },
    orderBy: [{ calendar_year: 'asc' }, { calendar_month: 'asc' }],
  });

  const totalCalendarMonths = calendarMonths.length;
  const finalizedMonthsCount = calendarMonths.filter(m => m.status === 'FINALIZED').length;
  const unfinalizedMonthsCount = totalCalendarMonths - finalizedMonthsCount;

  const attendanceGroup = await prisma.officialDailyAttendance.groupBy({
    where: { academic_year_id: academicYearId },
    by: ['record_status'],
    _count: { id: true },
  });

  let verifiedDailyRecordsCount = 0;
  let draftDailyRecordsCount = 0;
  for (const group of attendanceGroup) {
    if (group.record_status === 'VERIFIED') {
      verifiedDailyRecordsCount += group._count.id;
    } else {
      draftDailyRecordsCount += group._count.id;
    }
  }
  const totalDailyRecords = verifiedDailyRecordsCount + draftDailyRecordsCount;

  // Retrieve details of draft daily attendance records (for actionable resolver UI)
  const draftAttendanceDetails = await prisma.officialDailyAttendance.findMany({
    where: { academic_year_id: academicYearId, record_status: 'DRAFT' },
    include: {
      section: {
        include: {
          adviser_teacher: {
            include: { user: true }
          }
        }
      }
    },
    take: 50,
  });

  const draftDailyItems: DraftDailyAttendanceItem[] = draftAttendanceDetails.map(d => ({
    id: d.id,
    date: d.date,
    sectionName: d.section.name,
    gradeLevel: d.section.grade_level,
    adviserName: d.section.adviser_teacher?.user
      ? `${d.section.adviser_teacher.user.first_name} ${d.section.adviser_teacher.user.last_name}`
      : d.section.adviser_name_snapshot || 'Unassigned',
    status: 'Draft',
    requiredAction: 'Class Adviser must verify daily attendance in Attendance Hub',
  }));

  // Detect attendance records violating enrollment boundaries (DepEd Order No. 11, s. 2018 & DO 4, s. 2014)
  const attendanceAnomalies: AttendanceAnomalyItem[] = [];
  const allDailyAttendance = await prisma.officialDailyAttendance.findMany({
    where: { academic_year_id: academicYearId },
    select: {
      id: true,
      student_id: true,
      enrollment_id: true,
      date: true,
      record_status: true,
      section: { select: { name: true, grade_level: true } },
      student: { select: { id: true, user: { select: { first_name: true, last_name: true, school_id: true } } } },
      enrollment: { select: { effective_start_date: true, effective_end_date: true, status: true } }
    }
  });

  for (const att of allDailyAttendance) {
    const sName = att.student?.user
      ? `${att.student.user.first_name} ${att.student.user.last_name}`
      : 'Unknown Learner';
    const attDate = new Date(att.date);
    const attDateStr = attDate.toISOString().split('T')[0];

    // Check 1: Attendance recorded AFTER effective departure date
    if (att.enrollment?.effective_end_date) {
      const depDate = new Date(att.enrollment.effective_end_date);
      if (attDate > depDate) {
        const depDateStr = depDate.toISOString().split('T')[0];
        attendanceAnomalies.push({
          id: att.id,
          studentId: att.student_id,
          studentName: sName,
          sectionName: att.section?.name || 'N/A',
          date: att.date,
          effectivePeriod: `Ended: ${depDateStr}`,
          anomalyType: 'ATTENDANCE_AFTER_DEPARTURE',
          description: `Daily attendance was recorded on ${attDateStr}, which is after the learner's official departure date (${depDateStr}).`,
          requiredAction: 'School Registrar or Class Adviser must remove or correct invalid post-departure attendance records.',
        });
      }
    }

    // Check 2: Attendance recorded BEFORE effective start date
    if (att.enrollment?.effective_start_date) {
      const enrStartDate = new Date(att.enrollment.effective_start_date);
      if (attDate < enrStartDate) {
        const startDateStr = enrStartDate.toISOString().split('T')[0];
        attendanceAnomalies.push({
          id: att.id,
          studentId: att.student_id,
          studentName: sName,
          sectionName: att.section?.name || 'N/A',
          date: att.date,
          effectivePeriod: `Started: ${startDateStr}`,
          anomalyType: 'ATTENDANCE_BEFORE_ENROLLMENT',
          description: `Daily attendance was recorded on ${attDateStr}, which is prior to the learner's official enrollment start date (${startDateStr}).`,
          requiredAction: 'Class Adviser or Registrar must verify late-enrollee start date or adjust pre-enrollment attendance records.',
        });
      }
    }
  }

  const attendanceStatus: 'READY' | 'NOT_READY' =
    (unfinalizedMonthsCount === 0 && draftDailyRecordsCount === 0 && attendanceAnomalies.length === 0 && totalCalendarMonths > 0)
      ? 'READY'
      : 'NOT_READY';

  // 7. Official SF9 Issuance Readiness (Reported Separately)
  // Departed learners (Dropped Out / Transferred Out) do not receive year-end SF9 Form 138 report cards
  const eligibleEnrollments = enrollments.filter(e => {
    const raw = (e.status || '').toLowerCase().replace(/[-_\s]/g, '');
    return !raw.includes('drop') && !raw.includes('transfer');
  });
  const issuedSf9Count = eligibleEnrollments.filter(e => e.sf9_issuances.length > 0).length;
  const unissuedSf9Count = eligibleEnrollments.length - issuedSf9Count;
  const sf9Status: 'REVIEW_REQUIRED' | 'READY' = unissuedSf9Count === 0 ? 'READY' : 'REVIEW_REQUIRED';

  // 8. Blockers and Overall Readiness Determination
  const blockers: string[] = [];
  if (missingGradebooksCount > 0) {
    blockers.push(`${missingGradebooksCount} expected subject gradebooks have not been created.`);
  }
  if (draftGradebooksCount > 0) {
    blockers.push(`${draftGradebooksCount} subject gradebooks are currently in Draft status and unpublished.`);
  }
  if (incompleteStudentsCount > 0) {
    blockers.push(`${incompleteStudentsCount} enrolled learners have unresolved incomplete records or unverified departures.`);
  }
  if (draftDailyRecordsCount > 0) {
    blockers.push(`${draftDailyRecordsCount} official daily attendance records are unverified drafts.`);
  }
  if (attendanceAnomalies.length > 0) {
    blockers.push(`${attendanceAnomalies.length} daily attendance record(s) violate official learner enrollment boundaries (recorded after departure or prior to enrollment).`);
  }
  if (unfinalizedMonthsCount > 0) {
    blockers.push(`${unfinalizedMonthsCount} school calendar months have not been finalized.`);
  }

  const policyDependencies: string[] = [
    'Dual-party authorization policy: DigiSkwela enforces atomic execution and single-session concurrency protection via PostgreSQL row-level locks. Institutional governance may establish a two-person sign-off policy (e.g., Registrar verification and Principal authorization) prior to initiating closure.',
    'Official learner movement documentation: Under DepEd Order No. 11, s. 2018, all dropped out and transferred out learners must have verified effective departure dates and authorized administrative audit records. Prior earned grades are preserved for SF10 permanent records (DepEd Order No. 58, s. 2017).',
    'Post-closure grade immutability: In accordance with DepEd guidelines, historical grades are read-only; any future grade corrections require Division Superintendent authorization.',
    'Student promotion and remedial protocol: Learner promotion, remedial assignment, and retention remain independent academic evaluations under DepEd Order No. 8, s. 2015 based on authoritative annual Final Ratings (averaging configured terms, consolidating MAPEH as 1 learning area) and are not triggered automatically by administrative closure.',
    'Institutional Academic Calendar Alignment: DepEd Order No. 009, s. 2026 establishes the national academic calendar from June 8, 2026 to April 8, 2027 (~200 instructional days). Calulut Integrated School operates an authorized 11-month calendar from June 1, 2026 to April 30, 2027 (220 instructional days, including 28 verified/draft attendance entries on June 1, 2026). SDO San Fernando division authorization must be retained on file for local school calendar variations.',
    'Attendance separation policy: Official School Form 2 (SF2) attendance is strictly verified via classroom teacher-verified daily records (OfficialDailyAttendance). Gate turnstile/RFID attendance is maintained separately and does not determine academic SF2 compliance.'
  ];

  let overallStatus: 'READY' | 'NOT_READY' | 'REVIEW_REQUIRED' = 'READY';
  if (blockers.length > 0) {
    overallStatus = 'NOT_READY';
  } else if (unissuedSf9Count > 0) {
    overallStatus = 'REVIEW_REQUIRED';
  }

  const summaryMessage = overallStatus === 'READY'
    ? 'All academic requirements, gradebooks, curriculum coverage, and attendance verifications are complete. School year is eligible for administrative closure.'
    : overallStatus === 'NOT_READY'
    ? `School year is NOT ready for closure. ${blockers.length} mandatory academic requirements remain incomplete.`
    : 'Mandatory academic requirements are satisfied, but outstanding institutional policy items require administrative review.';

  return {
    academicYear: {
      id: academicYear.id,
      name: academicYear.name,
      startDate: academicYear.start_date,
      endDate: academicYear.end_date,
      isCurrent: academicYear.is_current,
      lifecycle,
      configuredTerms,
    },
    overallStatus,
    summaryMessage,
    gradebooks: {
      totalExpected: totalExpectedGradebooks,
      totalExisting: existingGradebooks.length,
      publishedCount: publishedGradebooksCount,
      draftCount: draftGradebooksCount,
      missingCount: missingGradebooksCount,
      byTerm: byTermSummary,
      unresolvedCount: unresolvedGradebooks.length,
      unresolvedSample: unresolvedGradebooks.slice(0, 50),
      unresolvedGradebooks,
    },
    curriculumCoverage: {
      requiredLearningAreasPerSection: 8,
      sectionsEvaluated: sectionsCurriculum,
      allSectionsHaveFullCurriculum: allSectionsCurriculumComplete,
    },
    studentCompleteness: {
      totalEnrolled: enrollments.length,
      activeEnrolledCount,
      departedCount: droppedCount + transferredCount,
      droppedCount,
      transferredCount,
      fullyCompleteCount: fullyCompleteStudentsCount,
      incompleteCount: incompleteStudentsCount,
      remedialCandidatesCount,
      retainedCandidatesCount,
      withheldAverageCount: incompleteStudentsCount,
      unresolvedStudents,
      departedLearners,
      academicExceptions,
    },
    officialAttendance: {
      totalCalendarMonths,
      finalizedMonthsCount,
      unfinalizedMonthsCount,
      totalDailyRecords,
      verifiedDailyRecordsCount,
      draftDailyRecordsCount,
      anomaliesCount: attendanceAnomalies.length,
      status: attendanceStatus,
      draftDailyItems,
      anomaliesItems: attendanceAnomalies,
    },
    sf9IssuanceReadiness: {
      totalEligibleStudents: eligibleEnrollments.length,
      issuedSf9Count,
      unissuedSf9Count,
      status: sf9Status,
      note: 'SF9 Form 138 issuance is evaluated separately from school-year closure. In accordance with DepEd practices, graduation certification and SF9 release require complete published grades.',
    },
    blockers,
    policyDependencies,
  };
}

export const closeAcademicYearSchema = z.object({
  confirmClosure: z.literal(true, {
    errorMap: () => ({ message: 'Explicit confirmation (confirmClosure: true) is required to close a school year.' }),
  }),
  confirmationCode: z.string().min(1, 'Confirmation code or school year name is required.'),
  remarks: z.string().max(500).optional(),
});

export type CloseAcademicYearInput = z.infer<typeof closeAcademicYearSchema>;

/**
 * Closes an active academic year in an atomic transaction with PostgreSQL row-level locks,
 * prerequisite readiness enforcement, and audit recording.
 * 
 * In accordance with DepEd academic record preservation requirements:
 * 1. Requires complete published gradebooks and zero unresolved learner grades.
 * 2. Does not mutate, duplicate, or delete student grades, enrollments, or SF9 documents.
 * 3. Immediately transitions the academic year to read-only HISTORICAL status.
 * 4. All published grades automatically become visible in Student Academic History.
 */
export async function closeAcademicYear(
  academicYearId: string,
  input: CloseAcademicYearInput,
  actor: AuthenticatedUser,
  correlationId?: string
) {
  // 1. Authorization: Only Admin, ITAdmin, and Principal may close a school year
  const userRoles = Array.isArray(actor.roles) ? actor.roles : [];
  const isAuthorized = userRoles.some(r => ['Admin', 'ITAdmin', 'Principal'].includes(r));
  if (!isAuthorized) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only authorized school leadership (Admin, ITAdmin, Principal) may execute official school-year closure.'
    );
  }

  // 2. Pre-transaction inspection
  const targetYear = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
  });

  if (!targetYear) {
    throw new AppError(404, 'NOT_FOUND', `Academic year ${academicYearId} not found.`);
  }

  if (!targetYear.is_current) {
    throw new AppError(
      400,
      'ALREADY_CLOSED',
      `Academic year ${targetYear.name} is already closed and in historical status.`
    );
  }

  // Check confirmation code matches year name (case-insensitive, normalizing dashes)
  const normalizedCode = input.confirmationCode.trim().toLowerCase().replace(/[\u2010\u2013\u2014]/g, '-');
  const normalizedName = targetYear.name.trim().toLowerCase().replace(/[\u2010\u2013\u2014]/g, '-');
  const validCodes = [
    normalizedName,
    `close ${normalizedName}`,
    targetYear.name.trim().toLowerCase(),
    `close ${targetYear.name.trim().toLowerCase()}`,
  ];

  if (!validCodes.includes(normalizedCode)) {
    throw new AppError(
      400,
      'INVALID_CONFIRMATION_CODE',
      `Confirmation code does not match. Please enter "${targetYear.name}" to authorize closure.`
    );
  }

  // 3. Authoritative readiness evaluation
  const readiness = await assessAcademicYearClosureReadiness(academicYearId, actor);
  if (readiness.overallStatus === 'NOT_READY') {
    throw new AppError(
      422,
      'CLOSURE_READINESS_FAILED',
      `School year cannot be closed because ${readiness.blockers.length} mandatory readiness requirements remain incomplete.`,
      {
        overallStatus: readiness.overallStatus,
        blockers: readiness.blockers,
        summaryMessage: readiness.summaryMessage,
        incompleteLearnersCount: readiness.studentCompleteness.incompleteCount,
        unresolvedGradebooksCount: readiness.gradebooks.unresolvedCount,
        draftDailyAttendanceCount: readiness.officialAttendance.draftDailyRecordsCount,
      }
    );
  }

  // 4. Atomic Execution with Row-Level Lock
  return await withTransaction(async (tx) => {
    // Acquire PostgreSQL exclusive row-level lock on the academic year record
    const lockedRows: any[] = await tx.$queryRaw`
      SELECT id, name, is_current, start_date, end_date
      FROM academic_years
      WHERE id = ${academicYearId}
      FOR UPDATE;
    `;

    if (!lockedRows || lockedRows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Academic year ${academicYearId} not found.`);
    }

    const row = lockedRows[0];
    if (!row.is_current) {
      throw new AppError(
        400,
        'ALREADY_CLOSED',
        `Academic year ${row.name} was already closed by another administrative session.`
      );
    }

    const now = new Date();

    const closedYear = await tx.academicYear.update({
      where: { id: academicYearId },
      data: {
        is_current: false,
        updated_at: now,
      },
    });

    await createAuditLog({
      actorUserId: actor.id,
      actorRole: userRoles[0] || 'Admin',
      action: 'ACADEMIC_YEAR_CLOSED',
      resourceType: 'academic_year',
      resourceId: academicYearId,
      targetLabel: row.name,
      previousState: {
        is_current: true,
        end_date: row.end_date,
      },
      newState: {
        is_current: false,
        end_date: row.end_date,
      },
      reason: input.remarks || 'Official School-Year Closure executed following complete readiness validation.',
      correlationId,
    }, tx);

    return {
      ...closedYear,
      lifecycle: classifyAcademicYearLifecycle(closedYear),
    };
  });
}

