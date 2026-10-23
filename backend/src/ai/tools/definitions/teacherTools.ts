import { z } from 'zod';
import { DigiSkwelaTool } from '../toolTypes.js';
import prisma from '../../../config/database.js';
import { AppError } from '../../../common/middleware/errorHandler.js';
import { getPhilippineCalendarDate, parseCalendarDate, formatManilaTime } from '../../../common/utils/dateTime.js';

/**
 * Teacher AI Tool: getMyIncompleteGrades (Phase B0 / B2)
 * 
 * Formal Invariants:
 * 1. Allowed roles: ['Teacher'] strictly.
 * 2. Required permissions: ['assignment:read_own', 'grade:read'].
 * 3. Scope: Strictly limited to the authenticated teacher's own assigned sections/subjects.
 * 4. Missing score definition: No grade-entry record OR score IS NULL.
 *    CRITICAL: A score of 0 is a legitimate, valid recorded score and must NEVER be treated as missing.
 * 5. Denominator: Applicable gradebook columns x actively enrolled students in authorized class.
 * 6. Missing entries explicitly report status: "no score recorded".
 * 7. Never computes pass/fail and never modifies business records (strictly read-only).
 * 8. Never accesses GateAttendance (physical badge scan events).
 * 9. Never outputs LRN, guardian details, or prohibited PII. Student display names included ONLY for assigned students.
 */
export const getMyIncompleteGradesTool: DigiSkwelaTool = {
  id: 'TCH-AI-01',
  name: 'getMyIncompleteGrades',
  description: 'Retrieves incomplete grading records, unrecorded scores, and missing gradebook entries across the authenticated teacher\'s assigned classes and sections. Returns completeness rates and missing entries per student and column. A score of 0 is a valid recorded score, not missing.',
  allowedRoles: ['Teacher'],
  requiredPermissions: ['assignment:read_own', 'grade:read'],
  inputSchema: z.object({
    sectionId: z.string().optional(),
    subjectId: z.string().optional(),
    term: z.string().optional(),
  }).strict(),
  declaration: {
    id: 'TCH-AI-01',
    name: 'getMyIncompleteGrades',
    description: 'Retrieves incomplete grading records, unrecorded scores, and missing gradebook entries across the authenticated teacher\'s assigned classes and sections. Returns completeness rates and missing entries per student and column.',
    parameters: {
      type: 'object',
      properties: {
        sectionId: {
          type: 'string',
          description: 'Optional ID of a specific section assigned to the teacher.'
        },
        subjectId: {
          type: 'string',
          description: 'Optional ID of a specific subject assigned to the teacher.'
        },
        term: {
          type: 'string',
          description: 'Optional term filter (e.g. "T1", "T2", "T3", "T4", or "Term 1").'
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  async execute(args, context) {
    // 1. Resolve Teacher Identity from authenticated user
    const teacher = await prisma.teacher.findUnique({
      where: { user_id: context.user.id }
    });

    if (!teacher) {
      throw new AppError(403, 'FORBIDDEN', 'Authenticated user is not registered as a teacher.');
    }

    // 2. Strict Scope Enforcement: If specific section requested, verify ownership
    if (args.sectionId) {
      const ownsSection = await prisma.teacherSubjectAssignment.findFirst({
        where: { teacher_id: teacher.id, section_id: args.sectionId }
      });
      if (!ownsSection) {
        throw new AppError(403, 'FORBIDDEN', `Section '${args.sectionId}' is not assigned to the authenticated teacher.`);
      }
    }

    if (args.subjectId) {
      const ownsSubject = await prisma.teacherSubjectAssignment.findFirst({
        where: { teacher_id: teacher.id, subject_id: args.subjectId }
      });
      if (!ownsSubject) {
        throw new AppError(403, 'FORBIDDEN', `Subject '${args.subjectId}' is not assigned to the authenticated teacher.`);
      }
    }

    // 3. Query Authorized Assignments Only
    const assignments = await prisma.teacherSubjectAssignment.findMany({
      where: {
        teacher_id: teacher.id,
        ...(args.sectionId ? { section_id: args.sectionId } : {}),
        ...(args.subjectId ? { subject_id: args.subjectId } : {}),
      },
      include: {
        section: true,
        subject: true,
      }
    });

    if (assignments.length === 0) {
      return {
        asOf: new Date().toISOString(),
        teacherId: teacher.id,
        classes: [],
        summary: {
          totalClassesChecked: 0,
          incompleteClassesCount: 0,
          fullyGradedClassesCount: 0,
          totalMissingScoresCount: 0,
        }
      };
    }

    // Normalize optional term argument (e.g., 'Term 1', 't1', 'Q1' -> 'T1')
    let normalizedTermKey: string | undefined = undefined;
    if (args.term) {
      const t = args.term.trim().toUpperCase();
      if (t === 'T1' || t === 'Q1' || t.includes('1')) normalizedTermKey = 'T1';
      else if (t === 'T2' || t === 'Q2' || t.includes('2')) normalizedTermKey = 'T2';
      else if (t === 'T3' || t === 'Q3' || t.includes('3')) normalizedTermKey = 'T3';
      else if (t === 'T4' || t === 'Q4' || t.includes('4')) normalizedTermKey = 'T4';
    }

    const classResults: any[] = [];
    let totalMissingAcrossAll = 0;

    for (const assignment of assignments) {
      // 4. Fetch Actively Enrolled Students for this Section
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
        }
      });

      // 5. Fetch Gradebooks for this Assignment
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

      // Evaluate completeness for each gradebook
      for (const gb of gradebooks) {
        const columns = gb.columns;
        const totalStudents = enrollments.length;
        const totalExpectedCells = columns.length * totalStudents;

        const missingEntries: Array<{
          studentName: string;
          columnLabel: string;
          columnType: string;
          maxScore: number;
          status: 'no score recorded';
        }> = [];

        let recordedScoresCount = 0;

        for (const col of columns) {
          for (const enroll of enrollments) {
            const entry = col.entries.find(e => e.enrollment_id === enroll.id);

            // Invariant: Missing means no entry OR score is null/undefined.
            // A score of 0 is a VALID recorded score, NOT missing!
            const isMissing = !entry || entry.score === null || entry.score === undefined || isNaN(entry.score);

            if (isMissing) {
              const studentName = enroll.student?.user
                ? `${enroll.student.user.first_name} ${enroll.student.user.last_name}`.trim()
                : 'Enrolled Student';

              missingEntries.push({
                studentName,
                columnLabel: col.label,
                columnType: col.type,
                maxScore: col.max_score,
                status: 'no score recorded',
              });
            } else {
              recordedScoresCount++;
            }
          }
        }

        const missingScoresCount = missingEntries.length;
        totalMissingAcrossAll += missingScoresCount;

        const completenessPercentage = totalExpectedCells > 0
          ? Math.round((recordedScoresCount / totalExpectedCells) * 100)
          : 100;

        classResults.push({
          assignmentId: assignment.id,
          sectionId: assignment.section_id,
          sectionName: assignment.section.name,
          gradeLevel: assignment.section.grade_level,
          subjectId: assignment.subject_id,
          subjectName: assignment.subject.name,
          term: gb.term.key,
          termName: gb.term.name,
          totalStudents,
          totalColumns: columns.length,
          totalExpectedScores: totalExpectedCells,
          recordedScoresCount,
          missingScoresCount,
          completenessPercentage,
          isGradingComplete: missingScoresCount === 0,
          columnsSummary: columns.map(c => {
            const colEntries = c.entries.filter(e =>
              enrollments.some(en => en.id === e.enrollment_id) &&
              e.score !== null &&
              e.score !== undefined &&
              !isNaN(e.score)
            );
            return {
              id: c.id,
              label: c.label,
              type: c.type,
              maxScore: c.max_score,
              recordedCount: colEntries.length,
              missingCount: totalStudents - colEntries.length,
            };
          }),
          missingScores: missingEntries,
        });
      }
    }

    const incompleteClasses = classResults.filter(c => !c.isGradingComplete);
    const fullyGradedClasses = classResults.filter(c => c.isGradingComplete);

    return {
      asOf: new Date().toISOString(),
      classes: classResults,
      summary: {
        totalClassesChecked: classResults.length,
        incompleteClassesCount: incompleteClasses.length,
        fullyGradedClassesCount: fullyGradedClasses.length,
        totalMissingScoresCount: totalMissingAcrossAll,
      }
    };
  }
};

/**
 * Teacher AI Tool: getMyTeachingOperations (Phase B1)
 * 
 * Formal Invariants:
 * 1. Allowed roles: ['Teacher'] strictly.
 * 2. Required permissions: ['assignment:read_own'].
 * 3. Scope: Strictly limited to the authenticated teacher's own operations.
 * 4. Returns:
 *    - assigned sections and subjects with safe IDs;
 *    - today's confirmed parent appointments (Asia/Manila date);
 *    - unreviewed excuse letters owned by this teacher (using existing backend ownership rule: teacher_id).
 * 5. Excuse letters return metadata only (safe ID, student display name, date range, status).
 *    Parent-written free-text reason is strictly omitted to prevent instruction injection.
 * 6. Never includes grading data, events, prioritization logic, or GateAttendance.
 * 7. Strictly read-only; never writes or modifies records.
 * 8. Never leaks prohibited PII (guardian phone/email, LRN, clinic, counseling).
 */
export const getMyTeachingOperationsTool: DigiSkwelaTool = {
  id: 'TCH-AI-02',
  name: 'getMyTeachingOperations',
  description: 'Retrieves operational teaching assignments, today\'s confirmed parent appointments, and unreviewed excuse letters owned by the authenticated teacher. Does not include grading data or gate attendance logs.',
  allowedRoles: ['Teacher'],
  requiredPermissions: ['assignment:read_own'],
  inputSchema: z.object({}).strict(),
  declaration: {
    id: 'TCH-AI-02',
    name: 'getMyTeachingOperations',
    description: 'Retrieves operational teaching assignments, today\'s confirmed parent appointments, and unreviewed excuse letters owned by the authenticated teacher.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    }
  },
  async execute(_args, context) {
    // 1. Resolve Teacher Identity
    const teacher = await prisma.teacher.findUnique({
      where: { user_id: context.user.id }
    });

    if (!teacher) {
      throw new AppError(403, 'FORBIDDEN', 'Authenticated user is not registered as a teacher.');
    }

    // 2. Fetch Authorized Class Assignments
    const assignments = await prisma.teacherSubjectAssignment.findMany({
      where: { teacher_id: teacher.id },
      include: {
        section: true,
        subject: true,
      },
      orderBy: [
        { section: { name: 'asc' } },
        { subject: { name: 'asc' } },
      ]
    });

    const mappedAssignments = assignments.map(a => ({
      assignmentId: a.id,
      sectionId: a.section_id,
      sectionName: a.section.name,
      gradeLevel: a.section.grade_level,
      subjectId: a.subject_id,
      subjectName: a.subject.name,
      schedule: {
        days: a.days || null,
        startTime: a.start_time || null,
        endTime: a.end_time || null,
        room: a.room || null,
      }
    }));

    // 3. Fetch Today's Confirmed Parent Appointments (School Date: Asia/Manila)
    const calDate = getPhilippineCalendarDate();
    const windowStart = new Date(Date.UTC(calDate.year, calDate.month - 1, calDate.day - 1, 12, 0, 0, 0));
    const windowEnd = new Date(Date.UTC(calDate.year, calDate.month - 1, calDate.day + 1, 12, 0, 0, 0));

    const appointments = await prisma.appointment.findMany({
      where: {
        teacher_id: teacher.id,
        status: { in: ['Confirmed', 'confirmed', 'CONFIRMED'] },
        date: {
          gte: windowStart,
          lte: windowEnd,
        }
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
      orderBy: { time: 'asc' }
    });

    // Match appointments strictly belonging to today in Asia/Manila
    const todaysAppointments = appointments.filter(apt => {
      return getPhilippineCalendarDate(apt.date).dateStr === calDate.dateStr;
    });

    // Map appointments without leaking guardian phone/email or LRN
    const mappedAppointments = todaysAppointments.map(apt => {
      const studentName = apt.student?.user
        ? `${apt.student.user.first_name} ${apt.student.user.last_name}`.trim()
        : 'Assigned Student';
      return {
        appointmentId: apt.id,
        studentId: apt.student_id,
        studentName,
        date: calDate.dateStr,
        time: formatManilaTime(apt.time) || '10:00 AM',
        status: 'Confirmed',
        direction: apt.direction,
      };
    });

    // 4. Fetch Unreviewed Excuse Letters Owned by this Teacher
    // Existing backend ownership rule: teacher_id scopes authoritative ownership
    const excuseLetters = await prisma.excuseLetter.findMany({
      where: {
        teacher_id: teacher.id,
        status: { in: ['Pending Review', 'pending review', 'Pending', 'pending', 'PENDING'] }
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                first_name: true,
                last_name: true,
              }
            },
            current_section: true,
          }
        }
      },
      orderBy: { submitted_date: 'desc' }
    });

    // Metadata only: omit free-text reason to prevent prompt injection
    const mappedExcuseLetters = excuseLetters.map(el => {
      const studentName = el.student?.user
        ? `${el.student.user.first_name} ${el.student.user.last_name}`.trim()
        : 'Assigned Student';
      const startStr = getPhilippineCalendarDate(el.start_date).dateStr;
      const endStr = getPhilippineCalendarDate(el.end_date).dateStr;
      return {
        excuseLetterId: el.id,
        studentId: el.student_id,
        studentName,
        sectionName: el.student?.current_section?.name || null,
        startDate: startStr,
        endDate: endStr,
        status: 'Pending Review',
        submittedDate: el.submitted_date.toISOString(),
      };
    });

    return {
      asOf: new Date().toISOString(),
      schoolDate: calDate.dateStr,
      teacherId: teacher.id,
      assignments: mappedAssignments,
      appointmentsToday: mappedAppointments,
      unreviewedExcuseLetters: mappedExcuseLetters,
      summary: {
        totalAssignedClasses: mappedAssignments.length,
        confirmedAppointmentsTodayCount: mappedAppointments.length,
        unreviewedExcuseLettersCount: mappedExcuseLetters.length,
      }
    };
  }
};

/**
 * Teacher AI Tool: getMyClassPerformance (Phase B3)
 * 
 * Formal Invariants:
 * 1. Allowed roles: ['Teacher'] strictly.
 * 2. Required permissions: ['assignment:read_own', 'grade:read', 'attendance:read'].
 * 3. Scope: Strictly limited to the teacher's authorized assignment (sectionId + subjectId).
 *    If teacher does not own the requested section/subject, returns 403 FORBIDDEN.
 * 4. Grades: Authoritative submitted grade averages by term.
 *    If fewer than two comparable terms exist, explicitly states that a trend cannot yet be concluded.
 * 5. Attendance: Uses ClassAttendance ONLY; NEVER queries or imports GateAttendance.
 *    Returns P/A/L/E counts for requested window.
 *    If no dates provided, defaults to current Monday-Friday calendar week in Asia/Manila and states exact dates used.
 * 6. Surfaces factual list of students with 3+ recorded A entries inside requested window.
 *    STRICTLY FORBIDDEN to label students as: "at risk", "dropout risk", "truant", "problematic", or "failing".
 *    No student ranking.
 * 7. Never outputs prohibited PII (guardian contacts, LRN, clinic/guidance data).
 */
export const getMyClassPerformanceTool: DigiSkwelaTool = {
  id: 'TCH-AI-03',
  name: 'getMyClassPerformance',
  description: 'Retrieves submitted grade averages and classroom attendance metrics (P/A/L/E) for an assigned section and subject. Uses ClassAttendance only (never GateAttendance). Factual absence lists do not classify or label student risk.',
  allowedRoles: ['Teacher'],
  requiredPermissions: ['assignment:read_own', 'grade:read', 'attendance:read'],
  inputSchema: z.object({
    sectionId: z.string({ required_error: 'sectionId is required' }).min(1),
    subjectId: z.string({ required_error: 'subjectId is required' }).min(1),
    term: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).strict(),
  declaration: {
    id: 'TCH-AI-03',
    name: 'getMyClassPerformance',
    description: 'Retrieves submitted grade averages and classroom attendance metrics (P/A/L/E) for an assigned section and subject. Uses ClassAttendance only.',
    parameters: {
      type: 'object',
      properties: {
        sectionId: {
          type: 'string',
          description: 'Required section ID assigned to the teacher.'
        },
        subjectId: {
          type: 'string',
          description: 'Required subject ID assigned to the teacher.'
        },
        term: {
          type: 'string',
          description: 'Optional term filter (e.g. "T1", "T2", "T3", "T4", or "Term 1").'
        },
        startDate: {
          type: 'string',
          description: 'Optional start date for attendance window in YYYY-MM-DD format.'
        },
        endDate: {
          type: 'string',
          description: 'Optional end date for attendance window in YYYY-MM-DD format.'
        }
      },
      required: ['sectionId', 'subjectId'],
      additionalProperties: false
    }
  },
  async execute(args, context) {
    // 1. Resolve Teacher Identity
    const teacher = await prisma.teacher.findUnique({
      where: { user_id: context.user.id }
    });

    if (!teacher) {
      throw new AppError(403, 'FORBIDDEN', 'Authenticated user is not registered as a teacher.');
    }

    // 2. Strict Scope Verification: Check assignment ownership
    const assignment = await prisma.teacherSubjectAssignment.findFirst({
      where: {
        teacher_id: teacher.id,
        section_id: args.sectionId,
        subject_id: args.subjectId,
      },
      include: {
        section: true,
        subject: true,
      }
    });

    if (!assignment) {
      throw new AppError(403, 'FORBIDDEN', `You are not authorized for section '${args.sectionId}' and subject '${args.subjectId}'.`);
    }

    // 3. Fetch Actively Enrolled Students in this Section
    const enrollments = await prisma.enrollment.findMany({
      where: {
        section_id: args.sectionId,
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
      }
    });

    const enrollmentIds = enrollments.map(e => e.id);
    const studentIds = enrollments.map(e => e.student_id);
    const studentNameMap = new Map<string, string>();
    const enrollmentStudentMap = new Map<string, string>();
    for (const e of enrollments) {
      const name = e.student?.user ? `${e.student.user.first_name} ${e.student.user.last_name}`.trim() : 'Enrolled Student';
      studentNameMap.set(e.student_id, name);
      enrollmentStudentMap.set(e.id, e.student_id);
    }

    // 4. Grades Calculation: Submitted Grade Averages by Term
    let normalizedTermKey: string | undefined = undefined;
    if (args.term) {
      const t = args.term.trim().toUpperCase();
      if (t === 'T1' || t === 'Q1' || t.includes('1')) normalizedTermKey = 'T1';
      else if (t === 'T2' || t === 'Q2' || t.includes('2')) normalizedTermKey = 'T2';
      else if (t === 'T3' || t === 'Q3' || t.includes('3')) normalizedTermKey = 'T3';
      else if (t === 'T4' || t === 'Q4' || t.includes('4')) normalizedTermKey = 'T4';
    }

    const grades = await prisma.grade.findMany({
      where: {
        student_id: { in: studentIds },
        subject_id: args.subjectId,
        ...(normalizedTermKey ? { term: normalizedTermKey as any } : {})
      }
    });

    // Group submitted grades by term
    const termGradesMap: Record<string, number[]> = {};
    for (const g of grades) {
      if (g.term_grade !== null && g.term_grade !== undefined && !isNaN(g.term_grade)) {
        if (!termGradesMap[g.term]) termGradesMap[g.term] = [];
        termGradesMap[g.term].push(g.term_grade);
      }
    }

    const termAverages = Object.entries(termGradesMap).map(([termKey, scores]) => {
      const sum = scores.reduce((acc, s) => acc + s, 0);
      const avg = Math.round((sum / scores.length) * 10) / 10;
      return {
        term: termKey,
        studentsEvaluated: scores.length,
        averageGrade: avg,
      };
    });

    // Trend Evaluation: Require at least 2 comparable terms
    let trendConclusion: string;
    if (termAverages.length < 2) {
      trendConclusion = 'A trend cannot yet be concluded because fewer than two comparable terms exist.';
    } else {
      const t1 = termAverages.find(t => t.term === 'T1')?.averageGrade;
      const t2 = termAverages.find(t => t.term === 'T2')?.averageGrade;
      if (t1 !== undefined && t2 !== undefined) {
        const diff = Math.round((t2 - t1) * 10) / 10;
        trendConclusion = diff >= 0
          ? `Average grade changed by +${diff} points between T1 (${t1}) and T2 (${t2}).`
          : `Average grade changed by ${diff} points between T1 (${t1}) and T2 (${t2}).`;
      } else {
        trendConclusion = 'Comparable term grade data available across multiple terms.';
      }
    }

    // 5. Classroom Attendance: ClassAttendance ONLY (NEVER GateAttendance)
    let windowStartStr: string;
    let windowEndStr: string;
    let startUtc: Date;
    let endUtc: Date;

    if (args.startDate && args.endDate) {
      windowStartStr = args.startDate;
      windowEndStr = args.endDate;
      startUtc = parseCalendarDate(args.startDate);
      endUtc = parseCalendarDate(args.endDate);
    } else {
      // Current Monday-Friday calendar week in Asia/Manila
      const cal = getPhilippineCalendarDate();
      const d = new Date(Date.UTC(cal.year, cal.month - 1, cal.day));
      const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mondayDate = new Date(Date.UTC(cal.year, cal.month - 1, cal.day + mondayOffset));
      const fridayDate = new Date(Date.UTC(cal.year, cal.month - 1, cal.day + mondayOffset + 4));

      windowStartStr = mondayDate.toISOString().slice(0, 10);
      windowEndStr = fridayDate.toISOString().slice(0, 10);
      startUtc = mondayDate;
      endUtc = fridayDate;
    }

    const classAttendances = await prisma.classAttendance.findMany({
      where: {
        assignment_id: assignment.id,
        enrollment_id: { in: enrollmentIds },
        date: {
          gte: startUtc,
          lte: endUtc,
        }
      }
    });

    let countP = 0;
    let countA = 0;
    let countL = 0;
    let countE = 0;
    const absencesPerEnrollment: Record<string, number> = {};

    for (const ca of classAttendances) {
      const s = ca.status.toUpperCase();
      if (s === 'P') countP++;
      else if (s === 'A') {
        countA++;
        absencesPerEnrollment[ca.enrollment_id] = (absencesPerEnrollment[ca.enrollment_id] || 0) + 1;
      } else if (s === 'L') countL++;
      else if (s === 'E') countE++;
    }

    // Factual list of students with 3+ recorded A entries inside requested window
    // STRICTLY NEVER label as at risk, dropout risk, truant, problematic, or failing.
    const studentsWithThreeOrMoreAbsences: Array<{
      studentName: string;
      recordedAbsencesCount: number;
    }> = [];

    for (const [enrId, absCount] of Object.entries(absencesPerEnrollment)) {
      if (absCount >= 3) {
        const studentId = enrollmentStudentMap.get(enrId);
        const studentName = studentId ? studentNameMap.get(studentId) || 'Enrolled Student' : 'Enrolled Student';
        studentsWithThreeOrMoreAbsences.push({
          studentName,
          recordedAbsencesCount: absCount,
        });
      }
    }

    return {
      asOf: new Date().toISOString(),
      assignmentId: assignment.id,
      sectionId: assignment.section_id,
      sectionName: assignment.section.name,
      gradeLevel: assignment.section.grade_level,
      subjectId: assignment.subject_id,
      subjectName: assignment.subject.name,
      grades: {
        termAverages,
        trend: trendConclusion,
      },
      classroomAttendance: {
        source: 'ClassAttendance',
        attendanceDateWindow: {
          startDate: windowStartStr,
          endDate: windowEndStr,
          isDefaultMondayToFridayWeek: !args.startDate && !args.endDate,
        },
        counts: {
          present: countP,
          absent: countA,
          late: countL,
          excused: countE,
          totalRecordedSessions: classAttendances.length,
        },
        studentsWithThreeOrMoreAbsences,
        semanticsNote: 'Factual record of recorded classroom attendance only. Does not classify, label, or determine student risk.',
      }
    };
  }
};

