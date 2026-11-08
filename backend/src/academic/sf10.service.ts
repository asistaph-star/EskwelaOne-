import prisma from '../config/database.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { getStudentIdentity } from '../common/utils/studentIdentity.js';
import { resolveSubjectGradeLevel } from './academic.service.js';

/**
 * SF10 Scholastic Record Service
 * 
 * Reuses the same grading logic established in reportCard.service.ts and calulutSf9Service.ts (Form 138/SF9):
 *   - Final Rating = average of T1, T2, T3 (only when ALL 3 are present)
 *   - Remarks = PASSED if finalRating >= 75, FAILED otherwise (only when finalRating exists)
 *   - MAPEH = 50/50 composite of Music & Arts and PE & Health
 *   - General Average = average of all 8 learning area Final Ratings (only when ALL 8 have final ratings)
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
  const isStudentSelf = student.user_id === actorId || student.id === actorId;

  const actorUser = await prisma.user.findUnique({
    where: { id: actorId },
    include: { user_roles: { include: { role: true } } }
  });

  const isPrivilegedRole = actorUser?.user_roles.some(
    ur => ['Admin', 'Principal', 'Registrar'].includes(ur.role.name)
  );

  if (!isStudentSelf && !isPrivilegedRole) {
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
      published_gradebook: true,
    },
    orderBy: { academic_year: { start_date: 'asc' } }
  });

  // Fetch all gradebooks for student sections to verify official publication status
  const allGradebooks = await prisma.gradebooks.findMany({
    where: {
      assignment: { section: { enrollments: { some: { student_id: student.id } } } },
    },
    include: {
      term: true,
      assignment: true,
    },
  });

  const isTermPublished = (subjectId: string, termKey: string, gradeRow?: any): boolean => {
    if (gradeRow?.published_gradebook?.status === 'Published') {
      return true;
    }
    return allGradebooks.some(
      gb => gb.assignment?.subject_id === subjectId && gb.term?.key === termKey && gb.status === 'Published'
    );
  };

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

  // 6. For each academic year, apply the official 3-term Form 138 / SF9 logic
  const academicYears: SF10AcademicYearRecord[] = [];

  for (const [yearId, { yearName, grades }] of gradesByYear.entries()) {
    const enrInfo = enrollmentMap.get(yearId);
    const enrollmentGradeLevel = enrInfo?.gradeLevel;

    // Group grades by subject within this year, filtering by curriculum grade level
    const subjectMap = new Map<string, { id: string; name: string; code?: string | null; T1: number | null; T2: number | null; T3: number | null; T4: number | null }>();

    for (const g of grades) {
      if (enrollmentGradeLevel !== undefined) {
        const subGradeLevel = resolveSubjectGradeLevel(g.subject);
        if (subGradeLevel !== null && subGradeLevel !== enrollmentGradeLevel) {
          continue;
        }
      }

      if (!subjectMap.has(g.subject_id)) {
        subjectMap.set(g.subject_id, { id: g.subject.id, name: g.subject.name, code: g.subject.code, T1: null, T2: null, T3: null, T4: null });
      }
      const sg = subjectMap.get(g.subject_id)!;
      const published = isTermPublished(g.subject_id, g.term, g);

      // Official permanent records (SF10) strictly incorporate published academic results only.
      // Draft grades are never included in SF10 regardless of the requesting role.
      if (!published) {
        sg[g.term as 'T1' | 'T2' | 'T3' | 'T4'] = null;
      } else {
        const val = g.published_term_grade ?? (g.term_grade !== null ? Math.round(g.term_grade) : null);
        sg[g.term as 'T1' | 'T2' | 'T3' | 'T4'] = val;
      }
    }

    // Detect Music & Arts and PE & Health for official MAPEH consolidation
    let musicSubjectId: string | null = null;
    let peSubjectId: string | null = null;
    for (const [subjectId, sg] of subjectMap.entries()) {
      const name = sg.name;
      const code = sg.code || '';
      if (/music/i.test(name) || /^(?:MA)(?:1[0-2]|[1-9])?$/i.test(code)) {
        musicSubjectId = subjectId;
      } else if (/physical education|\bpe\b/i.test(name) || /^(?:PEH|PE)(?:1[0-2]|[1-9])?$/i.test(code)) {
        peSubjectId = subjectId;
      }
    }

    // Query active terms configured for this academic year
    const configuredTerms = await prisma.term.findMany({
      where: { academic_year_id: yearId },
      orderBy: { key: 'asc' },
    });
    const configuredTermKeys = (configuredTerms.length > 0
      ? configuredTerms.map(t => t.key)
      : ['T1', 'T2', 'T3']) as ('T1' | 'T2' | 'T3' | 'T4')[];

    const subjects: SF10SubjectRecord[] = [];
    let totalFinalRating = 0;
    let finalRatingCount = 0;

    for (const [subjectId, sg] of subjectMap.entries()) {
      if (subjectId === musicSubjectId || subjectId === peSubjectId) {
        continue;
      }
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
        name: sg.name,
        T1: sg.T1,
        T2: sg.T2,
        T3: sg.T3,
        T4: sg.T4,
        finalRating,
        remarks,
      });
    }

    // Official MAPEH Consolidation (Music & Arts + PE & Health -> MAPEH)
    if (musicSubjectId && peSubjectId) {
      const musicSg = subjectMap.get(musicSubjectId)!;
      const peSg = subjectMap.get(peSubjectId)!;

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
        remarks: mapehRemarks,
      });
    }

    // General Average using EXACT Form 138 / SF9 logic across official 8 learning areas
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
      name: getStudentIdentity(student).formalName,
      lrn: student.lrn || 'UNAVAILABLE',
      gender: student.gender || 'Unknown',
      dateOfBirth: student.date_of_birth ? student.date_of_birth.toISOString().split('T')[0] : null,
    },
    academicYears,
  };
}
