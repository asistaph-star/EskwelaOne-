import prisma from '../config/database.js';
import { AppError } from '../common/middleware/errorHandler.js';

/**
 * SF10 Scholastic Record Service
 * 
 * Reuses the same grading logic established in reportCard.service.ts (Form 138/SF9):
 *   - Final Rating = average of T1, T2, T3, T4 (only when ALL four are present)
 *   - Remarks = PASSED if finalRating >= 75, FAILED otherwise (only when finalRating exists)
 *   - General Average = average of all subject Final Ratings (only when ALL subjects have final ratings)
 *   - Missing terms remain null, never converted to 0
 *   - Missing final ratings remain null
 *   - Missing general average remains null
 */

export interface SF10SubjectRecord {
  id: string;
  name: string;
  T1: number | null;
  T2: number | null;
  T3: number | null;
  T4: number | null;
  finalRating: number | null;
  remarks: 'PASSED' | 'FAILED' | null;
}

export interface SF10AcademicYearRecord {
  academicYearId: string;
  academicYearName: string;
  gradeLevel: number | null;
  section: string | null;
  subjects: SF10SubjectRecord[];
  generalAverage: number | null;
}

export interface SF10DTO {
  student: {
    id: string;
    name: string;
    lrn: string;
    gender: string;
    dateOfBirth: string | null;
  };
  academicYears: SF10AcademicYearRecord[];
}

export async function getSF10Data(studentId: string, actorId: string): Promise<SF10DTO> {
  // 1. Resolve student
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      enrollments: {
        include: {
          academic_year: true,
          section: true,
        },
        orderBy: { academic_year: { start_date: 'asc' } }
      }
    }
  });

  if (!student) {
    throw new AppError(404, 'NOT_FOUND', 'Student not found');
  }

  // 2. Authorization: Principal, Registrar, Admin, or assigned Teacher
  const actorUser = await prisma.user.findUnique({
    where: { id: actorId },
    include: { user_roles: { include: { role: true } } }
  });

  const isPrivilegedRole = actorUser?.user_roles.some(
    ur => ['Admin', 'Principal', 'Registrar'].includes(ur.role.name)
  );

  if (!isPrivilegedRole) {
    // Check if actor is a teacher assigned to any section the student is enrolled in
    const isAssignedTeacher = await prisma.teacherSubjectAssignment.findFirst({
      where: {
        teacher: { user_id: actorId },
        section: {
          enrollments: { some: { student_id: student.id } }
        }
      }
    });
    if (!isAssignedTeacher) {
      throw new AppError(403, 'FORBIDDEN', 'You are not authorized to access this student\'s SF10 record.');
    }
  }

  // 3. Fetch ALL grades for this student across all academic years
  const allGrades = await prisma.grade.findMany({
    where: { student_id: student.id },
    include: {
      subject: true,
      academic_year: true,
    },
    orderBy: { academic_year: { start_date: 'asc' } }
  });

  // 4. Build enrollment map: academic_year_id -> { gradeLevel, section }
  const enrollmentMap = new Map<string, { gradeLevel: number; section: string }>();
  for (const enrollment of student.enrollments) {
    enrollmentMap.set(enrollment.academic_year_id, {
      gradeLevel: enrollment.section.grade_level,
      section: enrollment.section.name,
    });
  }

  // 5. Group grades by academic_year_id
  const gradesByYear = new Map<string, { yearName: string; grades: typeof allGrades }>();
  for (const g of allGrades) {
    const yearId = g.academic_year_id;
    if (!gradesByYear.has(yearId)) {
      gradesByYear.set(yearId, { yearName: g.academic_year.name, grades: [] });
    }
    gradesByYear.get(yearId)!.grades.push(g);
  }

  // 6. For each academic year, apply the SAME grading logic from Form 138
  const academicYears: SF10AcademicYearRecord[] = [];

  for (const [yearId, { yearName, grades }] of gradesByYear.entries()) {
    // Group grades by subject within this year
    const subjectMap = new Map<string, { name: string; T1: number | null; T2: number | null; T3: number | null; T4: number | null }>();

    for (const g of grades) {
      if (!subjectMap.has(g.subject_id)) {
        subjectMap.set(g.subject_id, { name: g.subject.name, T1: null, T2: null, T3: null, T4: null });
      }
      const sg = subjectMap.get(g.subject_id)!;
      sg[g.term as 'T1' | 'T2' | 'T3' | 'T4'] = g.term_grade;
    }

    // Calculate final ratings using EXACT Form 138 logic:
    // - Final Rating only when ALL four terms present
    // - Remarks only when final rating exists
    const subjects: SF10SubjectRecord[] = [];
    let totalFinalRating = 0;
    let finalRatingCount = 0;

    for (const [subjectId, sg] of subjectMap.entries()) {
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
        name: sg.name,
        T1: sg.T1,
        T2: sg.T2,
        T3: sg.T3,
        T4: sg.T4,
        finalRating,
        remarks,
      });
    }

    // General Average using EXACT Form 138 logic:
    // Only when ALL subjects have final ratings
    let generalAverage: number | null = null;
    if (subjects.length > 0 && finalRatingCount === subjects.length) {
      generalAverage = Math.round(totalFinalRating / subjects.length);
    }

    // Resolve grade level and section from enrollment, if available
    const enrollment = enrollmentMap.get(yearId);

    academicYears.push({
      academicYearId: yearId,
      academicYearName: yearName,
      gradeLevel: enrollment?.gradeLevel ?? null,
      section: enrollment?.section ?? null,
      subjects,
      generalAverage,
    });
  }

  return {
    student: {
      id: student.id,
      name: `${student.user.last_name}, ${student.user.first_name}${student.user.middle_name ? ` ${student.user.middle_name}` : ''}`,
      lrn: student.lrn || 'UNAVAILABLE',
      gender: student.gender || 'Unknown',
      dateOfBirth: student.date_of_birth ? student.date_of_birth.toISOString().split('T')[0] : null,
    },
    academicYears,
  };
}
