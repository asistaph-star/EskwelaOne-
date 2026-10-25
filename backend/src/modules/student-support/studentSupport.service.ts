import prisma from '../../config/database.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { PASSING_GRADE } from '../../config/academic.config.js';
import { getPhilippineCalendarDate, parseCalendarDate } from '../../common/utils/dateTime.js';
import { TeacherStudentSupportQuery, PrincipalStudentSupportQuery } from './studentSupport.schema.js';

export interface AttendanceWindowInfo {
  startDate: string;
  endDate: string;
  timezone: string;
  isDefaultWindow: boolean;
}

export interface StudentSupportRulesMetadata {
  passingGradeThreshold: number;
  attendanceWindow: AttendanceWindowInfo;
  rules: {
    belowPassingTerms: string;
    recordedAbsences: string;
    missingScoresCount: string;
  };
  disclaimer: string;
}

export interface TeacherStudentSupportIndicator {
  studentId: string;
  studentDisplayName: string;
  sectionId: string;
  sectionName: string;
  gradeLevel: number;
  subjectId: string;
  subjectName: string;
  belowPassingTerms: Array<{
    term: string;
    grade: number;
  }>;
  recordedAbsences: {
    absences: number;
    tardies: number;
    excused: number;
  };
  missingScoresCount: number;
}

export interface TeacherStudentSupportResponse {
  metadata: StudentSupportRulesMetadata;
  filters: {
    sectionId?: string;
    subjectId?: string;
    term?: string;
  };
  students: TeacherStudentSupportIndicator[];
  totalStudentsWithIndicators: number;
}

export interface PrincipalSectionAggregate {
  gradeLevel: number;
  sectionId: string;
  sectionName: string;
  studentsBelowPassingCount: number;
  studentsWithThreeOrMoreAbsencesCount: number;
}

export interface PrincipalStudentSupportResponse {
  metadata: StudentSupportRulesMetadata;
  filters: {
    gradeLevel?: number;
    sectionId?: string;
    term?: string;
  };
  aggregates: PrincipalSectionAggregate[];
  totals: {
    totalSectionsEvaluated: number;
    studentsBelowPassingCount: number;
    studentsWithThreeOrMoreAbsencesCount: number;
  };
}

/**
 * Normalizes term input (e.g. 'Term 1', 't1', 'Q1' -> 'T1').
 */
export function normalizeTermKey(term?: string): string | undefined {
  if (!term) return undefined;
  const t = term.trim().toUpperCase();
  if (t === 'T1' || t === 'Q1' || t.includes('1')) return 'T1';
  if (t === 'T2' || t === 'Q2' || t.includes('2')) return 'T2';
  if (t === 'T3' || t === 'Q3' || t.includes('3')) return 'T3';
  if (t === 'T4' || t === 'Q4' || t.includes('4')) return 'T4';
  return undefined;
}

/**
 * Resolves the attendance calendar window in Asia/Manila.
 * Default: most recent 30 calendar dates ending on current Asia/Manila date, inclusive.
 */
export function resolveAttendanceWindow(startDate?: string, endDate?: string): {
  startDate: string;
  endDate: string;
  startUtc: Date;
  endUtc: Date;
  timezone: string;
  isDefaultWindow: boolean;
} {
  const timezone = 'Asia/Manila';
  if (startDate && endDate) {
    const startUtc = parseCalendarDate(startDate);
    const endUtc = parseCalendarDate(endDate);
    return {
      startDate,
      endDate,
      startUtc,
      endUtc,
      timezone,
      isDefaultWindow: false,
    };
  }

  // Default: 30 calendar dates inclusive ending on today in Asia/Manila
  const cal = getPhilippineCalendarDate();
  const endUtc = new Date(Date.UTC(cal.year, cal.month - 1, cal.day));
  const startUtc = new Date(Date.UTC(cal.year, cal.month - 1, cal.day - 29));

  return {
    startDate: startUtc.toISOString().slice(0, 10),
    endDate: endUtc.toISOString().slice(0, 10),
    startUtc,
    endUtc,
    timezone,
    isDefaultWindow: true,
  };
}

/**
 * Computes factual student support indicators for an assignment and its active students.
 * 
 * Invariants:
 * 1. Only actively enrolled students.
 * 2. Missing score: column applies to assignment, is_superseded = false, score is null/undefined/missing.
 *    Score of 0 is a recorded score and NEVER missing.
 * 3. ClassAttendance ONLY (P/A/L/E). Never GateAttendance.
 * 4. Recorded term grade below PASSING_GRADE in Grade model.
 * 5. No risk scores, rankings, severity, or predictive labels.
 */
async function computeAssignmentIndicators(
  assignment: {
    id: string;
    section_id: string;
    subject_id: string;
    section: { id: string; name: string; grade_level: number };
    subject: { id: string; name: string };
  },
  normalizedTermKey: string | undefined,
  window: ReturnType<typeof resolveAttendanceWindow>
) {
  // 1. Actively enrolled students in this section
  const enrollments = await prisma.enrollment.findMany({
    where: {
      section_id: assignment.section_id,
      status: { in: ['Enrolled', 'enrolled', 'Active', 'active'] },
    },
    include: {
      student: {
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
            }
          }
        }
      }
    },
    orderBy: [
      { student: { user: { last_name: 'asc' } } },
      { student: { user: { first_name: 'asc' } } },
    ]
  });

  const enrollmentIds = enrollments.map(e => e.id);
  const studentIds = enrollments.map(e => e.student_id);

  // 2. Fetch Gradebooks and Columns for this Assignment
  const gradebooks = await prisma.gradebooks.findMany({
    where: {
      assignment_id: assignment.id,
      ...(normalizedTermKey ? { term: { key: normalizedTermKey as any } } : {}),
    },
    include: {
      term: true,
      columns: {
        orderBy: { sort_order: 'asc' },
        include: {
          entries: {
            where: { is_superseded: false }
          }
        }
      }
    }
  });

  // Calculate missing scores per enrollment
  const missingScoresByEnrollment: Record<string, number> = {};
  for (const enroll of enrollments) {
    missingScoresByEnrollment[enroll.id] = 0;
  }

  for (const gb of gradebooks) {
    for (const col of gb.columns) {
      for (const enroll of enrollments) {
        const entry = col.entries.find(e => e.enrollment_id === enroll.id);
        // Invariant: Missing means no entry OR score is null/undefined.
        // A score of 0 is a VALID recorded score, NOT missing!
        const isMissing = !entry || entry.score === null || entry.score === undefined || isNaN(entry.score);
        if (isMissing) {
          missingScoresByEnrollment[enroll.id] = (missingScoresByEnrollment[enroll.id] || 0) + 1;
        }
      }
    }
  }

  // 3. Fetch Recorded Term Grades from Grade model
  const grades = await prisma.grade.findMany({
    where: {
      student_id: { in: studentIds },
      subject_id: assignment.subject_id,
      ...(normalizedTermKey ? { term: normalizedTermKey as any } : {}),
      term_grade: { not: null },
    },
    orderBy: { updated_at: 'desc' }
  });

  // Deduplicate in case of multiple records: most recent updated_at wins
  const studentTermGrades = new Map<string, Map<string, number>>();
  for (const g of grades) {
    if (g.term_grade === null || g.term_grade === undefined || isNaN(g.term_grade)) continue;
    if (!studentTermGrades.has(g.student_id)) {
      studentTermGrades.set(g.student_id, new Map());
    }
    const termMap = studentTermGrades.get(g.student_id)!;
    if (!termMap.has(g.term)) {
      termMap.set(g.term, g.term_grade);
    }
  }

  // 4. Fetch ClassAttendance (ClassAttendance ONLY — NEVER GateAttendance)
  const classAttendances = await prisma.classAttendance.findMany({
    where: {
      assignment_id: assignment.id,
      enrollment_id: { in: enrollmentIds },
      date: {
        gte: window.startUtc,
        lte: window.endUtc,
      }
    }
  });

  const attendanceByEnrollment: Record<string, { absences: number; tardies: number; excused: number }> = {};
  for (const enroll of enrollments) {
    attendanceByEnrollment[enroll.id] = { absences: 0, tardies: 0, excused: 0 };
  }

  for (const ca of classAttendances) {
    const rec = attendanceByEnrollment[ca.enrollment_id];
    if (!rec) continue;
    const s = (ca.status || '').toUpperCase();
    if (s === 'A') rec.absences++;
    else if (s === 'L') rec.tardies++;
    else if (s === 'E') rec.excused++;
  }

  // 5. Construct per-student factual indicators
  const studentIndicators: Array<{
    studentId: string;
    studentDisplayName: string;
    sectionId: string;
    sectionName: string;
    gradeLevel: number;
    subjectId: string;
    subjectName: string;
    belowPassingTerms: Array<{ term: string; grade: number }>;
    recordedAbsences: { absences: number; tardies: number; excused: number };
    missingScoresCount: number;
    hasIndicator: boolean;
  }> = [];

  for (const enroll of enrollments) {
    const studentId = enroll.student_id;
    const displayName = enroll.student?.user
      ? `${enroll.student.user.first_name} ${enroll.student.user.last_name}`.trim()
      : 'Enrolled Student';

    const belowPassingTerms: Array<{ term: string; grade: number }> = [];
    const termMap = studentTermGrades.get(studentId);
    if (termMap) {
      for (const [termKey, gradeVal] of termMap.entries()) {
        if (gradeVal < PASSING_GRADE) {
          belowPassingTerms.push({ term: termKey, grade: gradeVal });
        }
      }
    }
    belowPassingTerms.sort((a, b) => a.term.localeCompare(b.term));

    const att = attendanceByEnrollment[enroll.id] || { absences: 0, tardies: 0, excused: 0 };
    const missingCount = missingScoresByEnrollment[enroll.id] || 0;

    // A student qualifies for inclusion if ANY factual indicator is present:
    // - at least one term grade below PASSING_GRADE
    // - at least 1 recorded absence (status A) in the window
    // - at least 1 missing applicable gradebook score
    const hasIndicator = belowPassingTerms.length > 0 || att.absences > 0 || missingCount > 0;

    studentIndicators.push({
      studentId,
      studentDisplayName: displayName,
      sectionId: assignment.section_id,
      sectionName: assignment.section.name,
      gradeLevel: assignment.section.grade_level,
      subjectId: assignment.subject_id,
      subjectName: assignment.subject.name,
      belowPassingTerms,
      recordedAbsences: att,
      missingScoresCount: missingCount,
      hasIndicator,
    });
  }

  return studentIndicators;
}

/**
 * Service: Retrieves factual student support indicators for an authenticated Teacher.
 */
export async function getTeacherStudentSupportIndicators(
  actorUserId: string,
  query: TeacherStudentSupportQuery
): Promise<TeacherStudentSupportResponse> {
  // 1. Resolve Teacher
  const teacher = await prisma.teacher.findUnique({
    where: { user_id: actorUserId }
  });

  if (!teacher) {
    throw new AppError(403, 'FORBIDDEN', 'Authenticated user is not registered as a teacher.');
  }

  // 2. Resolve Assignments (Strict Scope Verification)
  const assignments = await prisma.teacherSubjectAssignment.findMany({
    where: {
      teacher_id: teacher.id,
      ...(query.sectionId ? { section_id: query.sectionId } : {}),
      ...(query.subjectId ? { subject_id: query.subjectId } : {}),
    },
    include: {
      section: true,
      subject: true,
    }
  });

  // If a specific section was requested but teacher owns no matching assignment, throw 403
  if (query.sectionId && assignments.length === 0) {
    throw new AppError(403, 'FORBIDDEN', `You are not authorized to view student support indicators for section '${query.sectionId}'.`);
  }

  // 3. Resolve Window & Term
  const window = resolveAttendanceWindow(query.startDate, query.endDate);
  const normalizedTerm = normalizeTermKey(query.term);

  // 4. Compute Indicators across all authorized assignments
  const collectedIndicators: TeacherStudentSupportIndicator[] = [];

  for (const assignment of assignments) {
    const rawIndicators = await computeAssignmentIndicators(
      assignment,
      normalizedTerm,
      window
    );

    // Only include students with at least one indicator
    for (const ind of rawIndicators) {
      if (ind.hasIndicator) {
        collectedIndicators.push({
          studentId: ind.studentId,
          studentDisplayName: ind.studentDisplayName,
          sectionId: ind.sectionId,
          sectionName: ind.sectionName,
          gradeLevel: ind.gradeLevel,
          subjectId: ind.subjectId,
          subjectName: ind.subjectName,
          belowPassingTerms: ind.belowPassingTerms,
          recordedAbsences: ind.recordedAbsences,
          missingScoresCount: ind.missingScoresCount,
        });
      }
    }
  }

  // Sort alphabetically by student display name within section
  collectedIndicators.sort((a, b) => {
    const secCompare = a.sectionName.localeCompare(b.sectionName);
    if (secCompare !== 0) return secCompare;
    return a.studentDisplayName.localeCompare(b.studentDisplayName);
  });

  const metadata: StudentSupportRulesMetadata = {
    passingGradeThreshold: PASSING_GRADE,
    attendanceWindow: {
      startDate: window.startDate,
      endDate: window.endDate,
      timezone: window.timezone,
      isDefaultWindow: window.isDefaultWindow,
    },
    rules: {
      belowPassingTerms: `Terms where the recorded term grade is below ${PASSING_GRADE}. A term grade below ${PASSING_GRADE} is not a final result; final evaluation requires all terms.`,
      recordedAbsences: `Count of recorded ClassAttendance records with status A (absent), L (tardy), and E (excused) in the resolved date window. Never accesses GateAttendance.`,
      missingScoresCount: `Count of missing gradebook cells for applicable assignments. A score of 0 is a recorded score and is not missing.`,
    },
    disclaimer: `Factual records from DigiSkwela. This is not a prediction. A grade below ${PASSING_GRADE} in one term is not a final result. Review before acting.`,
  };

  return {
    metadata,
    filters: {
      sectionId: query.sectionId,
      subjectId: query.subjectId,
      term: query.term,
    },
    students: collectedIndicators,
    totalStudentsWithIndicators: collectedIndicators.length,
  };
}

/**
 * Service: Retrieves Principal aggregate counts by grade level and section.
 * 
 * Strict Invariants:
 * - Aggregate counts ONLY (students with recorded term grade below PASSING_GRADE, students with 3+ recorded absences).
 * - Absolutely NO student names, student IDs, LRN, individual grades, or individual attendance histories.
 */
export async function getPrincipalStudentSupportAggregate(
  query: PrincipalStudentSupportQuery
): Promise<PrincipalStudentSupportResponse> {
  const window = resolveAttendanceWindow(query.startDate, query.endDate);
  const normalizedTerm = normalizeTermKey(query.term);

  // 1. Fetch sections matching criteria
  const sections = await prisma.section.findMany({
    where: {
      ...(query.sectionId ? { id: query.sectionId } : {}),
      ...(query.gradeLevel ? { grade_level: query.gradeLevel } : {}),
    },
    orderBy: [
      { grade_level: 'asc' },
      { name: 'asc' },
    ]
  });

  const sectionAggregates: PrincipalSectionAggregate[] = [];
  let totalBelowPassing = 0;
  let totalWithThreeOrMoreAbsences = 0;

  for (const section of sections) {
    // Active enrollments in this section
    const enrollments = await prisma.enrollment.findMany({
      where: {
        section_id: section.id,
        status: { in: ['Enrolled', 'enrolled', 'Active', 'active'] },
      },
      select: {
        id: true,
        student_id: true,
      }
    });

    const enrollmentIds = enrollments.map(e => e.id);
    const studentIds = enrollments.map(e => e.student_id);

    if (studentIds.length === 0) {
      sectionAggregates.push({
        gradeLevel: section.grade_level,
        sectionId: section.id,
        sectionName: section.name,
        studentsBelowPassingCount: 0,
        studentsWithThreeOrMoreAbsencesCount: 0,
      });
      continue;
    }

    // 1. Students with at least one recorded term grade below PASSING_GRADE in this section
    // Invariant: If duplicate Grade tuples exist, the row with the latest updated_at is authoritative
    const allSectionGrades = await prisma.grade.findMany({
      where: {
        student_id: { in: studentIds },
        term_grade: { not: null },
        ...(normalizedTerm ? { term: normalizedTerm as any } : {}),
      },
      orderBy: { updated_at: 'desc' }
    });

    const latestGradeMap = new Map<string, number>();
    for (const g of allSectionGrades) {
      if (g.term_grade === null || g.term_grade === undefined || isNaN(g.term_grade)) continue;
      const key = `${g.student_id}:${g.subject_id}:${g.term}`;
      if (!latestGradeMap.has(key)) {
        latestGradeMap.set(key, g.term_grade);
      }
    }

    const studentsBelowPassingSet = new Set<string>();
    for (const [key, gradeVal] of latestGradeMap.entries()) {
      if (gradeVal < PASSING_GRADE) {
        const studentId = key.split(':')[0];
        studentsBelowPassingSet.add(studentId);
      }
    }
    const studentsBelowPassingCount = studentsBelowPassingSet.size;

    // 2. Students with 3 or more recorded A entries in the window (ClassAttendance ONLY)
    const absentRecords = await prisma.classAttendance.findMany({
      where: {
        enrollment_id: { in: enrollmentIds },
        status: 'A',
        date: {
          gte: window.startUtc,
          lte: window.endUtc,
        }
      },
      select: {
        enrollment_id: true,
      }
    });

    // Count absences per student
    const enrollmentStudentMap = new Map<string, string>();
    for (const e of enrollments) {
      enrollmentStudentMap.set(e.id, e.student_id);
    }

    const absencesPerStudent = new Map<string, number>();
    for (const r of absentRecords) {
      const sId = enrollmentStudentMap.get(r.enrollment_id);
      if (sId) {
        absencesPerStudent.set(sId, (absencesPerStudent.get(sId) || 0) + 1);
      }
    }

    let studentsWithThreeOrMoreAbsencesCount = 0;
    for (const count of absencesPerStudent.values()) {
      if (count >= 3) {
        studentsWithThreeOrMoreAbsencesCount++;
      }
    }

    totalBelowPassing += studentsBelowPassingCount;
    totalWithThreeOrMoreAbsences += studentsWithThreeOrMoreAbsencesCount;

    sectionAggregates.push({
      gradeLevel: section.grade_level,
      sectionId: section.id,
      sectionName: section.name,
      studentsBelowPassingCount,
      studentsWithThreeOrMoreAbsencesCount,
    });
  }

  const metadata: StudentSupportRulesMetadata = {
    passingGradeThreshold: PASSING_GRADE,
    attendanceWindow: {
      startDate: window.startDate,
      endDate: window.endDate,
      timezone: window.timezone,
      isDefaultWindow: window.isDefaultWindow,
    },
    rules: {
      belowPassingTerms: `Count of distinct actively enrolled students in the section with at least one recorded term grade below ${PASSING_GRADE}. A term grade below ${PASSING_GRADE} is not a final result; final evaluation requires all terms.`,
      recordedAbsences: `Count of distinct actively enrolled students in the section with 3 or more recorded absences (ClassAttendance status A) in the resolved date window. Never accesses GateAttendance.`,
      missingScoresCount: `Not aggregated at school-wide level. Available exclusively to assigned classroom teachers.`,
    },
    disclaimer: `Factual aggregate records from DigiSkwela. This is not a prediction or risk classification. Review before acting.`,
  };

  return {
    metadata,
    filters: {
      gradeLevel: query.gradeLevel,
      sectionId: query.sectionId,
      term: query.term,
    },
    aggregates: sectionAggregates,
    totals: {
      totalSectionsEvaluated: sectionAggregates.length,
      studentsBelowPassingCount: totalBelowPassing,
      studentsWithThreeOrMoreAbsencesCount: totalWithThreeOrMoreAbsences,
    }
  };
}
