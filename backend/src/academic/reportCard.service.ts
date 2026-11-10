import prisma from '../config/database.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { classifyAcademicYearLifecycle } from '../common/utils/calendarValidation.js';
import { getStudentIdentity } from '../common/utils/studentIdentity.js';
import { resolveSubjectGradeLevel } from './academic.service.js';
import { computePersistedStudentMonthlyAttendance } from './grading/calulutSf2Sf9Persistence.service.js';

export interface ReportCardSubject {
  id: string;
  name: string;
  T1: number | null;
  T2: number | null;
  T3: number | null;
  T4: number | null;
  finalRating: number | null;
  remarks: 'PASSED' | 'FAILED' | null;
}

export interface ReportCardDiagnostic {
  excludedContradictorySubjects?: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode?: string | null;
    subjectGradeLevel: number | null;
    enrollmentGradeLevel: number;
    reason: string;
  }>;
}

export interface ReportCardDTO {
  student: {
    id: string;
    name: string;
    lrn: string;
    age: number | null;
    gender: string;
  };
  school: {
    name: string;
    academicYear: string;
    isCurrent?: boolean;
    isHistorical?: boolean;
    isUpcoming?: boolean;
    lifecycle?: string;
  };
  enrollment: {
    gradeLevel: number;
    section: string;
  };
  scholastic: {
    subjects: ReportCardSubject[];
    generalAverage: number | null;
    configuredTerms: ('T1' | 'T2' | 'T3' | 'T4')[];
    termCount: number;
  };
  attendance: any;
  adviser: string | null;
  adviserComments?: {
    T1: string | null;
    T2: string | null;
    T3: string | null;
  };
  principal: string | null;
  promotionApproval?: {
    isApproved: boolean;
    approvedOutcome: 'PROMOTED' | 'REMEDIAL' | 'RETAINED' | 'COMPLETED' | null;
    targetGradeLevel?: number | null;
    approvedAt?: string | null;
    approvedByName?: string | null;
    approvedByRole?: string | null;
    isStale?: boolean;
    staleReason?: string | null;
    remarks?: string | null;
  } | null;
  termsMetadata?: Array<{
    id: string;
    key: string;
    name: string;
    isGradesVisible: boolean;
  }>;
  isOfficialSf9Released?: boolean;
  diagnostics?: ReportCardDiagnostic;
}

export async function getReportCardData(studentId: string, actorId: string, requestedAcademicYearId?: string): Promise<ReportCardDTO> {
  // 1. Resolve student and current enrollment/section (supports both student.id and student.user_id)
  const student = await prisma.student.findFirst({
    where: {
      OR: [
        { id: studentId },
        { user_id: studentId },
      ]
    },
    include: {
      user: true,
      current_section: {
        include: {
          academic_year: true,
          adviser_teacher: {
            include: { user: true }
          },
          assignments: {
            include: { teacher: true, subject: true }
          }
        }
      },
    }
  });

  if (!student) {
    throw new AppError(404, 'NOT_FOUND', 'Student not found');
  }

  // Determine target section & academic year (current or historical)
  let activeSection = student.current_section;
  let activeAcademicYear = student.current_section?.academic_year;

  if (requestedAcademicYearId) {
    if (student.current_section && student.current_section.academic_year_id === requestedAcademicYearId) {
      activeSection = student.current_section;
      activeAcademicYear = student.current_section.academic_year;
    } else {
      const historicalEnrollment = await prisma.enrollment.findFirst({
        where: {
          student_id: student.id,
          academic_year_id: requestedAcademicYearId,
        },
        include: {
          academic_year: true,
          section: {
            include: {
              academic_year: true,
              adviser_teacher: {
                include: { user: true }
              },
              assignments: {
                include: { teacher: true, subject: true }
              }
            }
          }
        }
      });

      if (!historicalEnrollment) {
        throw new AppError(404, 'NOT_FOUND', 'Student has no enrollment for the requested academic year');
      }

      activeSection = historicalEnrollment.section as any;
      activeAcademicYear = historicalEnrollment.academic_year;
    }
  } else {
    // If no specific year requested, prioritize enrollment in the active current academic year
    const currentAy = await prisma.academicYear.findFirst({
      where: { is_current: true }
    });
    if (currentAy) {
      const activeCurrentEnrollment = await prisma.enrollment.findFirst({
        where: {
          student_id: student.id,
          academic_year_id: currentAy.id,
          status: 'Enrolled'
        },
        include: {
          academic_year: true,
          section: {
            include: {
              academic_year: true,
              adviser_teacher: {
                include: { user: true }
              },
              assignments: {
                include: { teacher: true, subject: true }
              }
            }
          }
        }
      });
      if (activeCurrentEnrollment?.section) {
        activeSection = activeCurrentEnrollment.section as any;
        activeAcademicYear = activeCurrentEnrollment.academic_year;
      }
    }
  }

  if (!activeSection) {
    throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Student has no active section/enrollment');
  }

  // 2. Authorization: Student viewing their own card OR teacher assigned to this section OR Admin/Principal/Registrar
  const isStudentSelf = student.user_id === actorId || student.id === actorId;
  const isClassAdviser = (activeSection as any).adviser_teacher?.user_id === actorId;
  const isAuthorizedTeacher = isClassAdviser || activeSection.assignments.some(a => a.teacher.user_id === actorId);

  if (!isStudentSelf && !isAuthorizedTeacher) {
    const actorUser = await prisma.user.findUnique({ where: { id: actorId }, include: { user_roles: { include: { role: true } } } });
    const isGlobalAdmin = actorUser?.user_roles.some(ur => ['Admin', 'Principal', 'Registrar', 'Guidance'].includes(ur.role.name));
    if (!isGlobalAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'You are not authorized to access this student\'s report card.');
    }
  }

  const academicYearId = activeSection.academic_year_id;

  // 3. Fetch Grades with published_gradebook
  const grades = await prisma.grade.findMany({
    where: {
      student_id: student.id,
      academic_year_id: academicYearId
    },
    include: {
      subject: true,
      published_gradebook: true
    }
  });

  // Fetch section gradebooks to verify official publication status
  const sectionGradebooks = await prisma.gradebooks.findMany({
    where: {
      assignment: { section_id: activeSection.id },
      term: { academic_year_id: academicYearId }
    },
    include: {
      term: true,
      assignment: true
    }
  });

  const isTermPublished = (subjectId: string, termKey: string, gradeRow?: any): boolean => {
    if (gradeRow?.published_term_grade !== null && gradeRow?.published_term_grade !== undefined) {
      return true;
    }
    if (gradeRow?.published_gradebook?.status === 'Published') {
      return true;
    }
    return sectionGradebooks.some(
      gb => gb.assignment?.subject_id === subjectId && gb.term?.key === termKey && gb.status === 'Published'
    );
  };

  // 4. Transform into Subjects
  // We determine enrolled subjects from the section assignments and filter strictly by enrollment grade level.
  const enrollmentGradeLevel = activeSection.grade_level;
  const excludedContradictorySubjects: NonNullable<ReportCardDiagnostic['excludedContradictorySubjects']> = [];

  const enrolledSubjectsMap = new Map<string, { id: string; name: string; code?: string | null }>(); // subject_id -> subject details
  for (const assignment of activeSection.assignments) {
    const subj = assignment.subject;
    const subGradeLevel = resolveSubjectGradeLevel(subj);
    if (subGradeLevel !== null && subGradeLevel !== enrollmentGradeLevel) {
      excludedContradictorySubjects.push({
        subjectId: subj.id,
        subjectName: subj.name,
        subjectCode: subj.code || null,
        subjectGradeLevel: subGradeLevel,
        enrollmentGradeLevel,
        reason: `Subject curriculum grade level (${subGradeLevel}) contradicts enrollment grade level (${enrollmentGradeLevel})`
      });
      continue;
    }
    enrolledSubjectsMap.set(subj.id, { id: subj.id, name: subj.name, code: subj.code });
  }

  // Resolve actor roles to enforce student-facing term visibility toggle
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    include: { user_roles: { include: { role: true } } },
  });
  const isStudentUser = actor?.user_roles?.some((ur: any) => ur.role?.name === 'Student');

  // Check if official SF9 for this student & academic year has already been released
  const releasedIssuance = await (prisma as any).sf9OfficialIssuance.findFirst({
    where: {
      student_id: student.id,
      academic_year_id: academicYearId,
      is_current: true,
    },
  });
  let isReleasedSf9 = false;
  if (releasedIssuance) {
    try {
      const parsed = JSON.parse(releasedIssuance.calculated_summary_encrypted || '{}');
      if (parsed?.release?.released) isReleasedSf9 = true;
    } catch {}
  }

  // Query active terms configured for this academic year (including is_grades_visible_to_students)
  const configuredTerms = await prisma.term.findMany({
    where: { academic_year_id: academicYearId },
    orderBy: { key: 'asc' },
  });
  const configuredTermKeys = (configuredTerms.length > 0
    ? configuredTerms.map((t: any) => t.key)
    : ['T1', 'T2', 'T3']) as ('T1' | 'T2' | 'T3' | 'T4')[];

  // Group grades by subject_id
  const gradeBySubject = new Map<string, { T1: number | null, T2: number | null, T3: number | null, T4: number | null }>();
  
  for (const [subjectId, _] of enrolledSubjectsMap.entries()) {
    gradeBySubject.set(subjectId, { T1: null, T2: null, T3: null, T4: null });
  }

  for (const g of grades) {
    const subj = g.subject;
    const subGradeLevel = resolveSubjectGradeLevel(subj);
    if (subGradeLevel !== null && subGradeLevel !== enrollmentGradeLevel) {
      if (!excludedContradictorySubjects.some(e => e.subjectId === subj.id)) {
        excludedContradictorySubjects.push({
          subjectId: subj.id,
          subjectName: subj.name,
          subjectCode: subj.code || null,
          subjectGradeLevel: subGradeLevel,
          enrollmentGradeLevel,
          reason: `Grade record belongs to curriculum grade level (${subGradeLevel}) which contradicts enrollment grade level (${enrollmentGradeLevel})`
        });
      }
      continue;
    }

    if (!gradeBySubject.has(g.subject_id)) {
      gradeBySubject.set(g.subject_id, { T1: null, T2: null, T3: null, T4: null });
      enrolledSubjectsMap.set(g.subject_id, { id: subj.id, name: subj.name, code: subj.code });
    }
    
    const subjectGrades = gradeBySubject.get(g.subject_id)!;
    const published = isTermPublished(g.subject_id, g.term, g);

    // Rule: Prevent unpublished draft grades from appearing in cross-subject or student-facing reporting.
    // Only the officially assigned subject teacher who authored the grade may view their own private draft.
    const isSubjectAuthor = activeSection.assignments.some(
      (a: any) => a.subject_id === g.subject_id && a.teacher?.user_id === actorId
    );

    // Phase 2: Check student visibility toggle for the term
    const termObj = configuredTerms.find((t: any) => t.key === g.term);
    const isTermGradesVisible = (termObj as any)?.is_grades_visible_to_students !== false;

    if (!published && !isSubjectAuthor) {
      subjectGrades[g.term as 'T1'|'T2'|'T3'|'T4'] = null;
    } else if (isStudentUser && !isReleasedSf9 && !isTermGradesVisible) {
      // Concealed from student by school-level term grade visibility toggle
      subjectGrades[g.term as 'T1'|'T2'|'T3'|'T4'] = null;
    } else {
      const termGradeVal = published
        ? (g.published_term_grade ?? (g.term_grade !== null ? Math.round(g.term_grade) : null))
        : (isSubjectAuthor && g.term_grade !== null ? Math.round(g.term_grade) : null);
      subjectGrades[g.term as 'T1'|'T2'|'T3'|'T4'] = termGradeVal;
    }
  }

  // Detect Music & Arts and PE & Health for official MAPEH consolidation
  let musicSubjectId: string | null = null;
  let peSubjectId: string | null = null;
  for (const [subjectId, subj] of enrolledSubjectsMap.entries()) {
    const name = subj.name;
    const code = subj.code || '';
    if (/music/i.test(name) || /^(?:MA)(?:1[0-2]|[1-9])?$/i.test(code)) {
      musicSubjectId = subjectId;
    } else if (/physical education|\bpe\b/i.test(name) || /^(?:PEH|PE)(?:1[0-2]|[1-9])?$/i.test(code)) {
      peSubjectId = subjectId;
    }
  }

  const subjects: ReportCardSubject[] = [];
  let totalFinalRating = 0;
  let finalRatingCount = 0;

  // Process core non-MAPEH learning areas
  for (const [subjectId, subj] of enrolledSubjectsMap.entries()) {
    if (subjectId === musicSubjectId || subjectId === peSubjectId) {
      continue;
    }
    const name = subj.name;
    const sg = gradeBySubject.get(subjectId)!;
    let finalRating: number | null = null;
    let remarks: 'PASSED' | 'FAILED' | null = null;

    const hasAllConfiguredTerms = configuredTermKeys.length > 0 &&
      configuredTermKeys.every(k => sg[k] !== null);

    if (hasAllConfiguredTerms) {
      const sum = configuredTermKeys.reduce((acc, k) => acc + sg[k]!, 0);
      finalRating = Math.round(sum / configuredTermKeys.length);
      remarks = finalRating >= 75 ? 'PASSED' : 'FAILED';
      totalFinalRating += finalRating;
      finalRatingCount++;
    }

    subjects.push({
      id: subjectId,
      name,
      T1: sg.T1,
      T2: sg.T2,
      T3: sg.T3,
      T4: sg.T4,
      finalRating,
      remarks
    });
  }

  // Official DepEd MAPEH Consolidation (Music & Arts + PE & Health -> MAPEH)
  if (musicSubjectId && peSubjectId) {
    const musicSg = gradeBySubject.get(musicSubjectId)!;
    const peSg = gradeBySubject.get(peSubjectId)!;

    const computeMapehTerm = (t: 'T1' | 'T2' | 'T3' | 'T4'): number | null => {
      if (musicSg[t] !== null && peSg[t] !== null) {
        return Math.round((musicSg[t]! + peSg[t]!) / 2);
      }
      return null;
    };

    const mapehTerms: Record<'T1'|'T2'|'T3'|'T4', number | null> = {
      T1: computeMapehTerm('T1'),
      T2: computeMapehTerm('T2'),
      T3: computeMapehTerm('T3'),
      T4: computeMapehTerm('T4'),
    };

    let mapehFinal: number | null = null;
    let mapehRemarks: 'PASSED' | 'FAILED' | null = null;
    const hasAllMapehTerms = configuredTermKeys.length > 0 &&
      configuredTermKeys.every(k => mapehTerms[k] !== null);

    if (hasAllMapehTerms) {
      const sum = configuredTermKeys.reduce((acc, k) => acc + mapehTerms[k]!, 0);
      mapehFinal = Math.round(sum / configuredTermKeys.length);
      mapehRemarks = mapehFinal >= 75 ? 'PASSED' : 'FAILED';
      totalFinalRating += mapehFinal;
      finalRatingCount++;
    }

    subjects.push({
      id: 'mapeh-composite',
      name: 'MAPEH',
      T1: mapehTerms.T1,
      T2: mapehTerms.T2,
      T3: mapehTerms.T3,
      T4: mapehTerms.T4,
      finalRating: mapehFinal,
      remarks: mapehRemarks
    });
  }

  // 5. Compute General Average across official 8 learning areas
  // Under DepEd Order No. 8, s. 2015, an official General Average in Junior High School (Grades 7–10)
  // must be computed across all required core learning areas (minimum 8: Filipino, English, Math, Science, AP, EsP, TLE, MAPEH).
  // A partial subset of subjects cannot be certified or misrepresented as an official General Average.
  let generalAverage: number | null = null;
  const isJHS = activeSection?.grade_level && activeSection.grade_level >= 7 && activeSection.grade_level <= 10;
  const minimumExpectedSubjects = isJHS ? 8 : 1;

  if (subjects.length >= minimumExpectedSubjects && finalRatingCount === subjects.length) {
    generalAverage = Math.round(totalFinalRating / subjects.length);
  }

  // Calculate age if DOB exists
  let age = null;
  if (student.date_of_birth) {
    const dob = new Date(student.date_of_birth);
    const ageDifMs = Date.now() - dob.getTime();
    const ageDate = new Date(ageDifMs);
    age = Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  // Find Adviser (using designated adviser_teacher first, then assignments as fallback)
  let adviserName: string | null = null;
  if ((activeSection as any).adviser_teacher?.user) {
    const au = (activeSection as any).adviser_teacher.user;
    adviserName = `${au.first_name} ${au.last_name}`;
  } else if ((activeSection as any).adviser_name_snapshot) {
    adviserName = (activeSection as any).adviser_name_snapshot;
  } else if (activeSection.assignments.length > 0) {
    const adviserTeacher = activeSection.assignments[0].teacher;
    const adviserUser = await prisma.user.findUnique({ where: { id: adviserTeacher.user_id } });
    if (adviserUser) {
      adviserName = `${adviserUser.first_name} ${adviserUser.last_name}`;
    }
  }

  // Find Principal
  let principalName: string | null = null;
  if ((activeAcademicYear as any)?.school_head_name_snapshot) {
    principalName = (activeAcademicYear as any).school_head_name_snapshot;
  } else {
    const principalRoleUser = await prisma.userRole.findFirst({
      where: { role: { name: 'Principal' } },
      include: { user: true }
    });
    if (principalRoleUser) {
      const pu = principalRoleUser.user;
      principalName = `${pu.first_name} ${pu.last_name}`;
    }
  }

  // Authoritative School Settings & Principal Signatory (G-11)
  const schoolSettings = await prisma.schoolSettings.findFirst();
  const schoolName = schoolSettings?.school_name?.trim() || 'Calulut Integrated School';
  if (!principalName && schoolSettings?.school_head_name) {
    principalName = schoolSettings.school_head_name.trim();
  }

  // 6. Resolve Principal Promotion Approval & Outcome (Phase 2C Final Integration)
  let promotionApproval: ReportCardDTO['promotionApproval'] = null;
  const targetAyId = activeAcademicYear?.id || (activeSection as any)?.academic_year_id;
  if (targetAyId) {
    const promotionAuditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'STUDENT_PROMOTION_APPROVED',
        category: 'academic_promotion',
        resource_id: student.id
      },
      include: {
        actor: true
      },
      orderBy: { created_at: 'desc' }
    });

    if (promotionAuditLog) {
      const newState = (promotionAuditLog.new_state as any) || {};
      if (newState.academicYearId === targetAyId) {
        const outcome = (newState.approvedOutcome as 'PROMOTED' | 'REMEDIAL' | 'RETAINED' | 'COMPLETED') || 'PROMOTED';
        // Validate academic integrity against live scholastic ratings
        const hasIncompleteSubjects = subjects.some(s => s.finalRating === null);
        const failingSubjects = subjects.filter(s => s.finalRating !== null && s.finalRating < 75);
        const hasFailing = failingSubjects.length > 0;

        // An approval for PROMOTED or COMPLETED becomes stale if subjects are now failing or incomplete
        const isStale = (outcome === 'PROMOTED' || outcome === 'COMPLETED') && (hasIncompleteSubjects || hasFailing);

        promotionApproval = {
          isApproved: !isStale,
          approvedOutcome: outcome,
          targetGradeLevel: typeof newState.targetGradeLevel === 'number' ? newState.targetGradeLevel : null,
          approvedAt: promotionAuditLog.created_at.toISOString(),
          approvedByName: promotionAuditLog.actor
            ? `${promotionAuditLog.actor.first_name || ''} ${promotionAuditLog.actor.last_name || ''}`.trim()
            : promotionAuditLog.actor_school_id || 'Authorized Approver',
          approvedByRole: 'Principal',
          isStale,
          staleReason: isStale
            ? (hasIncompleteSubjects
                ? 'Academic records became incomplete following subsequent grade updates.'
                : `Learner has ${failingSubjects.length} failing learning area(s) following subsequent grade updates.`)
            : null,
          remarks: newState.remarks || null
        };
      }
    }
  }

  // Compute authentic attendance from official SF2 and school-calendar records
  let attendancePayload: any = null;
  try {
    const attRes = await computePersistedStudentMonthlyAttendance(prisma as any, {
      studentId: student.id,
      academicYearId,
      targetTerm: 'T1',
    });
    if (attRes?.sf9Mapping) {
      attendancePayload = {
        totalClassDays: attRes.sf9Mapping.totalClassDays,
        totalDaysPresent: attRes.sf9Mapping.totalDaysPresent,
        totalDaysAbsent: attRes.sf9Mapping.totalDaysAbsent,
        totalDaysTardy: attRes.sf9Mapping.totalDaysTardy,
        classDaysByMonth: attRes.sf9Mapping.attendance?.classDays,
        presentByMonth: attRes.sf9Mapping.attendance?.present,
        monthlySummaries: attRes.monthlySummaries,
      };
    }
  } catch (attErr) {
    attendancePayload = null;
  }

  // Fetch published adviser comments for this student and academic year
  const publishedComments = await (prisma as any).sf9AdviserComment.findMany({
    where: {
      student_id: student.id,
      academic_year_id: academicYearId,
      status: 'PUBLISHED',
    },
  });

  const adviserComments: { T1: string | null; T2: string | null; T3: string | null } = {
    T1: null,
    T2: null,
    T3: null,
  };

  for (const c of publishedComments) {
    const termKey = c.target_term as 'T1' | 'T2' | 'T3';
    if (termKey === 'T1' || termKey === 'T2' || termKey === 'T3') {
      const termObj = configuredTerms.find((t: any) => t.key === termKey);
      const isTermGradesVisible = (termObj as any)?.is_grades_visible_to_students !== false;
      if (isStudentUser && !isReleasedSf9 && !isTermGradesVisible) {
        adviserComments[termKey] = null;
      } else {
        adviserComments[termKey] = c.comment || null;
      }
    }
  }

  return {
    student: {
      id: student.id,
      name: getStudentIdentity(student).formalName,
      lrn: student.lrn || 'UNAVAILABLE',
      age,
      gender: student.gender || 'Unknown'
    },
    school: {
      name: schoolName,
      academicYear: activeAcademicYear?.name || (activeSection as any).academic_year?.name || 'Academic Year',
      isCurrent: activeAcademicYear ? activeAcademicYear.is_current : true,
      isHistorical: activeAcademicYear ? classifyAcademicYearLifecycle(activeAcademicYear) === 'HISTORICAL' : false,
      isUpcoming: activeAcademicYear ? classifyAcademicYearLifecycle(activeAcademicYear) === 'UPCOMING' : false,
      lifecycle: activeAcademicYear ? classifyAcademicYearLifecycle(activeAcademicYear) : 'CURRENT',
    },
    enrollment: {
      gradeLevel: activeSection.grade_level,
      section: activeSection.name
    },
    scholastic: {
      subjects,
      generalAverage,
      configuredTerms: configuredTermKeys,
      termCount: configuredTermKeys.length
    },
    attendance: attendancePayload,
    adviser: adviserName,
    adviserComments,
    principal: principalName,
    promotionApproval,
    termsMetadata: configuredTerms.map((t: any) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      isGradesVisible: (t as any).is_grades_visible_to_students !== false,
    })),
    isOfficialSf9Released: isReleasedSf9,
    diagnostics: {
      excludedContradictorySubjects
    }
  };
}
