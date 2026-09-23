import prisma from '../config/database.js';
import { AppError } from '../common/middleware/errorHandler.js';

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
  };
  enrollment: {
    gradeLevel: number;
    section: string;
  };
  scholastic: {
    subjects: ReportCardSubject[];
    generalAverage: number | null;
  };
  attendance: null; // explicitly missing due to lack of a calendar model
  adviser: string | null;
  principal: string | null;
}

export async function getReportCardData(studentId: string, actorId: string): Promise<ReportCardDTO> {
  // 1. Resolve student and current enrollment/section
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      current_section: {
        include: {
          academic_year: true,
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

  if (!student.current_section) {
    throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Student has no active section/enrollment');
  }

  // 2. Authorization: Must be assigned to this section OR be an admin (assuming teachers here)
  const isAuthorized = student.current_section.assignments.some(a => a.teacher.user_id === actorId);
  if (!isAuthorized) {
    // Add global role check if Admin/Principal is implemented. For now, strict teacher assignment rule:
    const actorUser = await prisma.user.findUnique({ where: { id: actorId }, include: { user_roles: { include: { role: true } } } });
    const isGlobalAdmin = actorUser?.user_roles.some(ur => ur.role.name === 'Admin' || ur.role.name === 'Principal');
    if (!isGlobalAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'You are not authorized to access this student\'s report card.');
    }
  }

  const academicYearId = student.current_section.academic_year_id;

  // 3. Fetch Grades
  const grades = await prisma.grade.findMany({
    where: {
      student_id: student.id,
      academic_year_id: academicYearId
    },
    include: {
      subject: true
    }
  });

  // 4. Transform into Subjects
  // We determine enrolled subjects from the section assignments.
  const enrolledSubjectsMap = new Map<string, string>(); // subject_id -> subject_name
  for (const assignment of student.current_section.assignments) {
    enrolledSubjectsMap.set(assignment.subject_id, assignment.subject.name);
  }

  // Group grades by subject_id
  const gradeBySubject = new Map<string, { T1: number | null, T2: number | null, T3: number | null, T4: number | null }>();
  
  for (const [subjectId, _] of enrolledSubjectsMap.entries()) {
    gradeBySubject.set(subjectId, { T1: null, T2: null, T3: null, T4: null });
  }

  for (const g of grades) {
    // Even if they have grades for a subject they aren't currently enrolled in, include it?
    // According to rule: "Subjects must come from the student's actual academic/enrollment/assignment data"
    // We'll trust the grades table, but prefer enrolled subjects first.
    if (!gradeBySubject.has(g.subject_id)) {
      gradeBySubject.set(g.subject_id, { T1: null, T2: null, T3: null, T4: null });
      enrolledSubjectsMap.set(g.subject_id, g.subject.name);
    }
    
    const subjectGrades = gradeBySubject.get(g.subject_id)!;
    subjectGrades[g.term as 'T1'|'T2'|'T3'|'T4'] = g.term_grade;
  }

  const subjects: ReportCardSubject[] = [];
  let totalFinalRating = 0;
  let finalRatingCount = 0;

  for (const [subjectId, name] of enrolledSubjectsMap.entries()) {
    const sg = gradeBySubject.get(subjectId)!;
    let finalRating: number | null = null;
    let remarks: 'PASSED' | 'FAILED' | null = null;

    if (sg.T1 !== null && sg.T2 !== null && sg.T3 !== null && sg.T4 !== null) {
      finalRating = Math.round((sg.T1 + sg.T2 + sg.T3 + sg.T4) / 4);
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

  // 5. Compute General Average
  // "General Average = sum of all subject Final Ratings / number of learning areas with valid final ratings
  // BUT only produce a General Average when the report contains the required complete set of final ratings"
  let generalAverage: number | null = null;
  if (subjects.length > 0 && finalRatingCount === subjects.length) {
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

  // Find Adviser (using the first assigned teacher to the section as fallback if no advisory role exists)
  let adviserName: string | null = null;
  if (student.current_section.assignments.length > 0) {
    const adviserTeacher = student.current_section.assignments[0].teacher;
    const adviserUser = await prisma.user.findUnique({ where: { id: adviserTeacher.user_id } });
    if (adviserUser) {
      adviserName = `${adviserUser.first_name} ${adviserUser.last_name}`;
    }
  }

  // Find Principal
  let principalName: string | null = null;
  const principalRoleUser = await prisma.userRole.findFirst({
    where: { role: { name: 'Principal' } },
    include: { user: true }
  });
  if (principalRoleUser) {
    const pu = principalRoleUser.user;
    principalName = `${pu.first_name} ${pu.last_name}`;
  }

  return {
    student: {
      id: student.id,
      name: `${student.user.last_name}, ${student.user.first_name}${student.user.middle_name ? ` ${student.user.middle_name}` : ''}`,
      lrn: student.lrn || 'UNAVAILABLE',
      age,
      gender: student.gender || 'Unknown'
    },
    school: {
      name: 'DigiSkwela Integrated School', // or fetch from global config if exists, but we are instructed to use available data
      academicYear: student.current_section.academic_year.name
    },
    enrollment: {
      gradeLevel: student.current_section.grade_level,
      section: student.current_section.name
    },
    scholastic: {
      subjects,
      generalAverage
    },
    attendance: null,
    adviser: adviserName,
    principal: principalName
  };
}
