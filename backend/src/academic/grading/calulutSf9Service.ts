/**
 * DIGISKWELA — CALULUT SF9 APPLICATION INTEGRATION SERVICE
 *
 * Bridges DigiSkwela database records to the authentic Calulut Integrated School
 * Excel Form 138 / SF9 generator and headless LibreOffice PDF renderer.
 *
 * Safety & Confidentiality Rules:
 * 1. Restricts SF9 generation, data-mapping inspection, and QA verification previews to
 *    authorized school personnel (Teacher/Adviser, Registrar, Admin, ITAdmin, Principal).
 * 2. Enforces teacher-to-section assignment boundaries for real student requests.
 * 3. Enforces strict gradebook publication integrity (no draft-grade bypass for official issuance).
 * 4. Enforces 3-term academic completeness across all required learning areas for official issuance.
 * 5. Resolves live per-term (T1, T2, T3) Gradebook/Grade calculations directly into the exact
 *    Calulut SF9 worksheet & cell coordinates isolated by student_id, section_id, academic_year_id,
 *    subject_id, and term.
 * 6. Never fabricates or substitutes synthetic attendance, comments, LRN, birthdate,
 *    adviser, or school head values for real learners; blocks official output when
 *    authoritative SF9 data sources are unavailable.
 * 7. Disables persistent caching for all real student SF9 documents.
 */

import prisma from '../../config/database.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { getStudentIdentity } from '../../common/utils/studentIdentity.js';
import { AuthenticatedUser } from '../../common/middleware/auth.js';
import {
  generateCalulutSf9,
  validateSf9InputCompleteness,
  GenerateSf9Input,
  Sf9SubjectScores,
} from './calulutSf9Generator.js';
import {
  renderCalulutSf9BufferToPdf,
  resolveLibreOfficeBinary,
} from './calulutSf9PdfRenderer.js';

export const AUTHORIZED_SF9_STAFF_ROLES = [
  'Admin',
  'ITAdmin',
  'Principal',
  'Registrar',
  'Teacher',
] as const;

export const GLOBAL_SF9_ADMIN_ROLES = ['Admin', 'Principal', 'Registrar'] as const;

export type Sf9Action = 'access' | 'view' | 'preview' | 'download' | 'authorize' | 'issue' | 'release';

/**
 * Enforce that the caller is an authenticated school staff member authorized
 * to access official SF9 report cards or synthetic QA verification previews.
 */
export function assertAuthorizedSf9Staff(actor?: AuthenticatedUser | null): void {
  if (!actor || !actor.id || !Array.isArray(actor.roles)) {
    throw new AppError(
      401,
      'UNAUTHORIZED',
      'Authentication is required to access Calulut SF9 documents.'
    );
  }

  const hasAuthorizedRole = actor.roles.some((r) =>
    (AUTHORIZED_SF9_STAFF_ROLES as readonly string[]).includes(r)
  );

  if (!hasAuthorizedRole) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Official Calulut SF9 report cards and verification previews can only be accessed by authorized school personnel (Class Adviser, Registrar, Principal, Administrator).'
    );
  }
}

/**
 * Enforce role and section-scoping boundaries for SF9 report cards:
 * - 'authorize': Strictly restricted to School Principal.
 * - 'issue' / 'release': Strictly restricted to authorized administration (Admin/Principal).
 * - 'access' / 'view' / 'preview' / 'download': Teachers are scoped strictly to their assigned class sections.
 */
export async function assertAuthorizedStaffForSection(
  actor: AuthenticatedUser,
  sectionId: string,
  db: any = prisma,
  action: Sf9Action | string = 'access'
): Promise<void> {
  assertAuthorizedSf9Staff(actor);

  // 1. Action-level role restrictions
  if (action === 'authorize') {
    if (!actor.roles.includes('Principal')) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Official SF9 academic authorization is strictly restricted to the School Principal. Administrators, Teachers, and Registrars are not authorized to grant academic authorization.'
      );
    }
    return;
  }

  if (action === 'issue' || action === 'release') {
    if (!actor.roles.includes('Admin')) {
      throw new AppError(
        403,
        'FORBIDDEN',
        `Official SF9 document ${action === 'issue' ? 'issuance and cryptographic sealing' : 'release to the Student Portal'} is strictly restricted to School Administration (Admin). School Principals review and grant academic authorization but do not execute Admin ${action} operations; Teachers, Advisers, Registrars, and IT Admins are not authorized to ${action} official SF9 report cards.`
      );
    }
    return;
  }

  // 2. Read / View / Preview scoping
  const isGlobalStaff = actor.roles.some((r) =>
    GLOBAL_SF9_ADMIN_ROLES.includes(r as any)
  );
  if (isGlobalStaff) return;

  if (actor.roles.includes('Teacher')) {
    const teacher = await db.teacher.findFirst({
      where: { user_id: actor.id },
    });
    if (!teacher) {
      throw new AppError(
        403,
        'FORBIDDEN',
        `Teachers may only ${action} SF9 report cards for their assigned class sections.`
      );
    }

    const section = await db.section.findUnique({
      where: { id: sectionId },
      include: {
        assignments: {
          where: { teacher_id: teacher.id },
        },
      },
    });

    if (!section) {
      throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found.`);
    }

    const isAdviser = section.adviser_teacher_id === teacher.id;
    const hasAssignment = section.assignments && section.assignments.length > 0;

    if (!isAdviser && !hasAssignment) {
      throw new AppError(
        403,
        'FORBIDDEN',
        `Teachers may only ${action} SF9 report cards for their assigned class sections.`
      );
    }
    return;
  }

  throw new AppError(403, 'FORBIDDEN', 'Access denied to SF9 report cards.');
}

// Canonical Synthetic Baseline for Safe Verification Only (Never used for real learners)
const SYNTHETIC_VERIFICATION_PAYLOAD: GenerateSf9Input = {
  demographics: {
    name: 'DELA CRUZ, JUAN SYNTHETIC',
    lrn: '999999260001',
    birthdateSerial: '41409', // Dec 15, 2013 (13 y/o)
    age: 13,
    gender: 'M',
    gradeLevel: 7,
    section: 'Agoncillo',
    schoolYear: '2026-2027',
    schoolName: 'Calulut Integrated School',
    schoolId: '500146',
    schoolHead: 'APRIL G. CONCEPCION',
    adviser: 'KATHRINA MAE H. OMLANG',
  },
  grades: {
    filipino: [88, 90, 92],
    english: [85, 87, 88],
    math: [91, 93, 95],
    science: [89, 91, 90],
    ap: [86, 88, 90],
    gmrc: [92, 94, 96],
    tle: [87, 89, 91],
    music: [90, 92, 94],
    pe: [88, 90, 92],
  },
  attendance: {
    present: [15, 22, 20, 20, 19, 20, 20, 18, 18, 20, 5],
    classDays: [15, 22, 20, 20, 20, 20, 20, 18, 18, 20, 5],
  },
  comments: {
    t1: 'Demonstrates commendable academic dedication and exemplary conduct.',
    t2: 'Consistently achieves high performance across all learning areas.',
    t3: 'Maintains outstanding enthusiasm and mastery of competencies.',
  },
};

/**
 * Generate a synthetic authentic SF9 Excel file for staff verification and acceptance tests.
 */
export function generateSyntheticSf9Preview(actor?: AuthenticatedUser): {
  buffer: Buffer;
  filename: string;
} {
  if (arguments.length > 0) {
    assertAuthorizedSf9Staff(actor);
  }

  const result = generateCalulutSf9(SYNTHETIC_VERIFICATION_PAYLOAD);
  if (!result.success) {
    throw new AppError(500, 'GENERATION_FAILED', `Failed to generate synthetic SF9: ${result.reason}`);
  }

  return {
    buffer: result.buffer,
    filename: 'SF9_Calulut_7-Agoncillo_Synthetic_Verification.xlsx',
  };
}

/**
 * Generate a 1-page landscape PDF rendered directly from the populated synthetic
 * Calulut SF9 Excel workbook ('SF9 - GRADE 4-10') via headless LibreOffice Calc.
 */
export async function generateSyntheticSf9PdfPreview(
  actor?: AuthenticatedUser
): Promise<{ buffer: Buffer; filename: string }> {
  if (arguments.length > 0) {
    assertAuthorizedSf9Staff(actor);
  }

  const { buffer: xlsxBuffer } = generateSyntheticSf9Preview();
  const pdfBuffer = await renderCalulutSf9BufferToPdf(xlsxBuffer, {
    cachePolicy: 'synthetic-memory-ttl',
  });
  return {
    buffer: pdfBuffer,
    filename: 'SF9_Calulut_7-Agoncillo_Synthetic_Verification.pdf',
  };
}

/**
 * Return structured synthetic SF9 verification data for the authentic in-app viewer.
 */
export function getSyntheticSf9Data(actor?: AuthenticatedUser) {
  if (arguments.length > 0) {
    assertAuthorizedSf9Staff(actor);
  }

  const result = generateCalulutSf9(SYNTHETIC_VERIFICATION_PAYLOAD);
  const sofficeBin = resolveLibreOfficeBinary();
  return {
    success: result.success,
    payload: SYNTHETIC_VERIFICATION_PAYLOAD,
    calculated: result.success ? result.calculated : undefined,
    source: {
      template: 'master_template_sanitized.xlsx',
      worksheet: 'SF9 - GRADE 4-10',
      schoolYear: '2026-2027',
      schoolId: '500146',
      generator: 'calulutSf9Generator.ts',
      rendererStatus: sofficeBin ? 'VERIFIED_LIBREOFFICE_PDF' : 'BLOCKED_HOST_PDF_PREREQUISITE',
      rendererMessage: sofficeBin
        ? 'Rendered directly from the populated Calulut SF9 OpenXML workbook (.xlsx) via headless LibreOffice Calc.'
        : 'In-app PDF rendering requires headless LibreOffice or containerized conversion service. Populated OpenXML workbook (.xlsx) is verified and available for download.',
      pdfEndpoint: '/academic/report-card/sf9/preview/pdf',
      xlsxEndpoint: '/academic/report-card/sf9/preview',
    },
  };
}

export const REQUIRED_SUBJECT_KEYS: Array<keyof Sf9SubjectScores> = [
  'filipino',
  'english',
  'math',
  'science',
  'ap',
  'gmrc',
  'tle',
  'music',
  'pe',
];

export interface Sf9LearningAreaCellMapping {
  key: keyof Sf9SubjectScores | 'mapeh';
  label: string;
  summaryCol: string;
  sf9Row: number;
  t1SummaryCell: string;
  t2SummaryCell: string;
  t3SummaryCell: string;
  sf9T1Cell: string;
  sf9T2Cell: string;
  sf9T3Cell: string;
  sf9FinalCell: string | null;
  sf9RemarksCell: string | null;
}

export interface Sf9MappedSubjectRecord {
  key: keyof Sf9SubjectScores;
  label: string;
  subjectId: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  assignmentId: string | null;
  T1: number | null;
  T2: number | null;
  T3: number | null;
  finalGrade: number | null;
  remarks: 'Passed' | 'Failed' | null;
  publishedT1: number | null;
  publishedT2: number | null;
  publishedT3: number | null;
  publishedFinalGrade: number | null;
  isSubjectPublishedAcrossThreeTerms: boolean;
  termPublicationStatus: {
    T1: string;
    T2: string;
    T3: string;
  };
  cells: Sf9LearningAreaCellMapping;
}

export interface StudentSf9DataMapping {
  student: {
    id: string;
    userId: string | null;
    formattedName: string;
    lrn: string | null;
    gender: 'M' | 'F' | null;
    dateOfBirth: string | null;
    birthdateSerial: string | null;
    age: number | null;
    cells: {
      inputDataName: string;
      inputDataLrn: string;
      inputDataBirthdate: string;
      sf9Name: string;
      sf9Lrn: string;
      sf9Age: string;
      sf9Sex: string;
      sf9GradeLevel: string;
      sf9Section: string;
      sf9SchoolYear: string;
    };
  };
  schoolMetadata: {
    schoolName: string;
    schoolShortName: string;
    schoolNameSource: 'SchoolSettings.school_name' | 'DefaultFallback';
    schoolId: null;
    region: null;
    division: null;
    cells: {
      region: string;
      division: string;
      schoolName: string;
      schoolId: string;
    };
  };
  enrollment: {
    sectionId: string;
    sectionName: string;
    gradeLevel: number;
    academicYearId: string;
    academicYearName: string;
  };
  learningAreas: Record<keyof Sf9SubjectScores, Sf9MappedSubjectRecord>;
  mapehComposite: {
    key: 'mapeh';
    label: string;
    T1: number | null;
    T2: number | null;
    T3: number | null;
    finalGrade: number | null;
    remarks: 'Passed' | 'Failed' | null;
    publishedT1: number | null;
    publishedT2: number | null;
    publishedT3: number | null;
    publishedFinalGrade: number | null;
    isCompositePublishedAcrossThreeTerms: boolean;
    cells: Sf9LearningAreaCellMapping;
  };
  generalAverage: {
    value: number | null;
    publishedValue: number | null;
    remarks: 'Passed' | 'Failed' | null;
    sf9FinalCell: string;
    sf9RemarksCell: string;
  };
  publicationStatus: {
    allGradebooksPublished: boolean;
    allThreeTermsPublished: boolean;
    allAssignedSubjectsPublished: boolean;
    hasImmutablePublishedSnapshot: false;
    provenanceLimitation: string;
    completeThreeTermSubjects: Array<keyof Sf9SubjectScores>;
    missingThreeTermSubjects: Array<keyof Sf9SubjectScores>;
    publishedThreeTermSubjects: Array<keyof Sf9SubjectScores>;
  };
  attendance: {
    isAuthoritativeSourceAvailable: false;
    months: string[];
    present: null;
    classDays: null;
    absent: null;
    reason: string;
  };
  comments: {
    isAuthoritativeSourceAvailable: false;
    t1: null;
    t2: null;
    t3: null;
    reason: string;
  };
  signatories: {
    isAuthoritativeSourceAvailable: false;
    adviser: null;
    schoolHead: null;
    reason: string;
  };
  releaseGate: {
    isEligibleForOfficialRelease: boolean;
    blockingReasons: string[];
  };
}

interface SubjectSlotDefinition {
  key: keyof Sf9SubjectScores;
  label: string;
  pattern: RegExp;
  summaryCol: string;
  sf9Row: number;
  hasFinalColumn: boolean;
}

const CALULUT_SUBJECT_SLOTS: SubjectSlotDefinition[] = [
  {
    key: 'filipino',
    label: 'Filipino',
    pattern: /filipino|^fil/i,
    summaryCol: 'K',
    sf9Row: 32,
    hasFinalColumn: true,
  },
  {
    key: 'english',
    label: 'English',
    pattern: /english|^eng/i,
    summaryCol: 'L',
    sf9Row: 33,
    hasFinalColumn: true,
  },
  {
    key: 'math',
    label: 'Mathematics',
    pattern: /math/i,
    summaryCol: 'M',
    sf9Row: 34,
    hasFinalColumn: true,
  },
  {
    key: 'science',
    label: 'Science',
    pattern: /science|^sci/i,
    summaryCol: 'N',
    sf9Row: 35,
    hasFinalColumn: true,
  },
  {
    key: 'ap',
    label: 'Araling Panlipunan (AP)',
    pattern: /araling panlipunan|^ap(?:\b|_|-|\d)/i,
    summaryCol: 'O',
    sf9Row: 36,
    hasFinalColumn: true,
  },
  {
    key: 'gmrc',
    label: 'GMRC (Good Manners and Right Conduct)',
    pattern: /edukasyon sa pagpapakatao|\besp\b|gmrc|values/i,
    summaryCol: 'P',
    sf9Row: 37,
    hasFinalColumn: true,
  },
  {
    key: 'tle',
    label: 'EPP / TLE',
    pattern: /technology and livelihood|\btle\b|\bepp\b/i,
    summaryCol: 'Q',
    sf9Row: 38,
    hasFinalColumn: true,
  },
  {
    key: 'music',
    label: 'Music & Arts',
    pattern: /music/i,
    summaryCol: 'R',
    sf9Row: 40,
    hasFinalColumn: false,
  },
  {
    key: 'pe',
    label: 'PE & Health',
    pattern: /physical education|\bpe\b/i,
    summaryCol: 'S',
    sf9Row: 41,
    hasFinalColumn: false,
  },
];

function buildCellMapping(
  key: keyof Sf9SubjectScores | 'mapeh',
  label: string,
  summaryCol: string,
  sf9Row: number,
  hasFinalColumn: boolean
): Sf9LearningAreaCellMapping {
  return {
    key,
    label,
    summaryCol,
    sf9Row,
    t1SummaryCell: `'TERM 1 SUMMARY'!${summaryCol}15`,
    t2SummaryCell: `'TERM 2 SUMMARY'!${summaryCol}15`,
    t3SummaryCell: `'TERM 3 SUMMARY'!${summaryCol}15`,
    sf9T1Cell: `'SF9 - GRADE 4-10'!F${sf9Row}`,
    sf9T2Cell: `'SF9 - GRADE 4-10'!G${sf9Row}`,
    sf9T3Cell: `'SF9 - GRADE 4-10'!H${sf9Row}`,
    sf9FinalCell: hasFinalColumn ? `'SF9 - GRADE 4-10'!I${sf9Row}` : null,
    sf9RemarksCell: hasFinalColumn ? `'SF9 - GRADE 4-10'!J${sf9Row}` : null,
  };
}

function dateToExcelSerial(date: Date): string {
  // Excel 1900 date system serial number (with 1900 leap-year bug offset: 25569 = 1970-01-01)
  const utcMidnightMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const serial = Math.floor(utcMidnightMs / 86_400_000) + 25569;
  return String(serial);
}

/**
 * Resolve the live, student-isolated Calulut SF9 data mapping from authoritative
 * DigiSkwela database records (`Student`, `Enrollment`, `Section`, `AcademicYear`,
 * `TeacherSubjectAssignment`, `Grade`, and `gradebooks`).
 *
 * Preserves per-term grades (e.g. a saved Term 1 grade when T2/T3 are still null)
 * while maintaining strict publication and completeness tracking for official SF9 issuance.
 */
export async function resolveStudentSf9DataMapping(
  studentId: string,
  actor: AuthenticatedUser,
  options?: { enforcePublishedGateFirst?: boolean }
): Promise<StudentSf9DataMapping> {
  // 1. Role-Based Access Gate
  assertAuthorizedSf9Staff(actor);

  if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
    throw new AppError(400, 'INVALID_STUDENT_ID', 'A valid student identifier is required.');
  }

  // 2. Fetch Student, Section, and Academic Year by stable database ID
  const student = await prisma.student.findFirst({
    where: {
      OR: [{ id: studentId }, { user_id: studentId }],
    },
    include: {
      user: true,
      current_section: {
        include: {
          academic_year: true,
          adviser_teacher: { include: { user: true } },
          assignments: {
            include: { teacher: { include: { user: true } }, subject: true },
          },
        },
      },
    },
  });

  if (!student) {
    throw new AppError(404, 'NOT_FOUND', 'Student record not found.');
  }

  if (!student.current_section || !student.current_section.academic_year) {
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Student has no active section or academic year enrollment record.'
    );
  }

  const section = student.current_section;
  const academicYear = section.academic_year;

  // 3. Teacher-to-Section Authorization Boundary (G-8)
  const isGlobalStaff = actor.roles.some((r) =>
    (GLOBAL_SF9_ADMIN_ROLES as readonly string[]).includes(r)
  );
  if (actor.roles.includes('Teacher') && !isGlobalStaff) {
    const isAdviser = (section as any).adviser_teacher?.user_id === actor.id;
    const isAssignedToSectionInYear = isAdviser || section.assignments.some(
      (a) =>
        a.teacher?.user_id === actor.id &&
        (!a.academic_year_id || a.academic_year_id === academicYear.id)
    );
    if (!isAssignedToSectionInYear) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Teachers may only generate SF9 report cards for their assigned class sections.'
      );
    }
  }

  // 4. Verify Academic Year Term Compatibility with Official Calulut SF9 Template
  const configuredTerms = await prisma.term.findMany({
    where: { academic_year_id: academicYear.id },
    orderBy: { key: 'asc' },
  });
  if (configuredTerms.length > 0 && configuredTerms.length !== 3) {
    throw new AppError(
      422,
      'UNSUPPORTED_SF9_CONFIGURATION',
      `The official Calulut Integrated School SF9 template is designed specifically for 3-term academic calendars. Academic year "${academicYear.name}" has ${configuredTerms.length} configured terms. Official generation requires a verified ${configuredTerms.length}-term SF9 template.`
    );
  }

  // 4. Query Section Gradebooks & Check Publication Status
  const gradebooks = await prisma.gradebooks.findMany({
    where: {
      assignment: { section_id: section.id },
      term: { academic_year_id: academicYear.id },
    },
    include: {
      term: true,
    },
  });

  const allGradebooksPublished =
    gradebooks.length > 0 && gradebooks.every((gb) => gb.status === 'Published');

  const publishedTerms = new Set(
    gradebooks
      .filter((gb) => gb.status === 'Published' && gb.term?.key)
      .map((gb) => gb.term.key)
  );
  const hasTermMetadata = gradebooks.some((gb) => Boolean(gb.term?.key));
  const allThreeTermsPublished =
    !hasTermMetadata ||
    (publishedTerms.has('T1') && publishedTerms.has('T2') && publishedTerms.has('T3'));

  const hasAssignmentIdsInGradebooks = gradebooks.some((row) => Boolean(row.assignment_id));
  const sectionAssignmentsWithIds = section.assignments.filter((a) => Boolean(a.id));
  const allAssignedSubjectsPublished =
    !hasAssignmentIdsInGradebooks ||
    (sectionAssignmentsWithIds.length > 0 &&
      sectionAssignmentsWithIds.every((asgn) =>
        (['T1', 'T2', 'T3'] as const).every((termKey) =>
          gradebooks.some(
            (gb) =>
              gb.assignment_id === asgn.id &&
              gb.term?.key === termKey &&
              gb.status === 'Published'
          )
        )
      ));

  if (
    options?.enforcePublishedGateFirst &&
    (!allGradebooksPublished || !allThreeTermsPublished || !allAssignedSubjectsPublished)
  ) {
    throw new AppError(
      422,
      'GRADES_NOT_PUBLISHED',
      'Cannot generate official SF9: student gradebooks for all 3 terms (T1, T2, T3) in this academic year have not been officially approved and published.'
    );
  }

  // 5. Query Student Grades scoped strictly by student.id and academicYear.id, plus SchoolSettings if available
  const rawGrades = await prisma.grade.findMany({
    where: {
      student_id: student.id,
      academic_year_id: academicYear.id,
    },
    include: { subject: true },
  });

  let persistedSchoolSettings: { school_name?: string; school_short_name?: string } | null = null;
  if (!options?.enforcePublishedGateFirst && (prisma as any).schoolSettings?.findUnique) {
    try {
      persistedSchoolSettings = await (prisma as any).schoolSettings.findUnique({
        where: { id: 'default' },
      });
    } catch {
      persistedSchoolSettings = null;
    }
  }

  // 6. Map each Calulut SF9 learning area slot to its assigned subject and per-term grades (T1, T2, T3)
  const learningAreas = {} as Record<keyof Sf9SubjectScores, Sf9MappedSubjectRecord>;

  for (const slot of CALULUT_SUBJECT_SLOTS) {
    // Prefer section's TeacherSubjectAssignment matching this slot
    const matchedAssignment = section.assignments.find(
      (a) =>
        a.subject &&
        (slot.pattern.test(a.subject.name) || slot.pattern.test(a.subject.code || ''))
    );

    // Match student's Grade rows for this learning area (scoped by subject_id if assignment exists, or pattern)
    const matchingGrades = rawGrades.filter((g) => {
      if (matchedAssignment?.subject_id && g.subject_id === matchedAssignment.subject_id) {
        return true;
      }
      return (
        Boolean(g.subject) &&
        (slot.pattern.test(g.subject.name) || slot.pattern.test(g.subject.code || ''))
      );
    });

    const resolvedSubject = matchedAssignment?.subject ?? matchingGrades[0]?.subject ?? null;

    const findTermGrade = (termKey: 'T1' | 'T2' | 'T3'): number | null => {
      const g = matchingGrades.find((row) => row.term === termKey);
      if (g && typeof g.term_grade === 'number' && !Number.isNaN(g.term_grade)) {
        return Math.round(g.term_grade);
      }
      return null;
    };

    const t1 = findTermGrade('T1');
    const t2 = findTermGrade('T2');
    const t3 = findTermGrade('T3');

    // Final Grade formula in SF9 - GRADE 4-10: =IF(COUNT(F..:H..)<=2,"",AVERAGE(F..:H..)) rounded as integer
    let finalGrade: number | null = null;
    let remarks: 'Passed' | 'Failed' | null = null;
    if (slot.hasFinalColumn && t1 !== null && t2 !== null && t3 !== null) {
      finalGrade = Math.round((t1 + t2 + t3) / 3);
      remarks = finalGrade >= 75 ? 'Passed' : 'Failed';
    }

    const resolveTermPubStatus = (termKey: 'T1' | 'T2' | 'T3'): string => {
      if (hasAssignmentIdsInGradebooks) {
        if (!matchedAssignment?.id) return 'Missing';
        const gb = gradebooks.find(
          (row) => row.assignment_id === matchedAssignment.id && row.term?.key === termKey
        );
        return gb?.status ?? 'Missing';
      }
      const gb = gradebooks.find((row) => row.term?.key === termKey);
      return gb?.status ?? 'Missing';
    };

    const t1Pub = resolveTermPubStatus('T1');
    const t2Pub = resolveTermPubStatus('T2');
    const t3Pub = resolveTermPubStatus('T3');

    const publishedT1 = t1Pub === 'Published' ? t1 : null;
    const publishedT2 = t2Pub === 'Published' ? t2 : null;
    const publishedT3 = t3Pub === 'Published' ? t3 : null;
    const isSubjectPublishedAcrossThreeTerms =
      t1Pub === 'Published' && t2Pub === 'Published' && t3Pub === 'Published';
    const publishedFinalGrade =
      slot.hasFinalColumn &&
      publishedT1 !== null &&
      publishedT2 !== null &&
      publishedT3 !== null
        ? Math.round((publishedT1 + publishedT2 + publishedT3) / 3)
        : null;

    learningAreas[slot.key] = {
      key: slot.key,
      label: slot.label,
      subjectId: resolvedSubject?.id ?? null,
      subjectCode: resolvedSubject?.code ?? null,
      subjectName: resolvedSubject?.name ?? null,
      assignmentId: matchedAssignment?.id ?? null,
      T1: t1,
      T2: t2,
      T3: t3,
      finalGrade,
      remarks,
      publishedT1,
      publishedT2,
      publishedT3,
      publishedFinalGrade,
      isSubjectPublishedAcrossThreeTerms,
      termPublicationStatus: {
        T1: t1Pub,
        T2: t2Pub,
        T3: t3Pub,
      },
      cells: buildCellMapping(slot.key, slot.label, slot.summaryCol, slot.sf9Row, slot.hasFinalColumn),
    };
  }

  // 7. Compute MAPEH Composite per term & final rating (matches 'TERM 1-3 SUMMARY'!T15 and 'SF9 - GRADE 4-10'!F39:J39)
  // Requires BOTH Music & Arts and PE & Health components to exist (never computes a composite from 1 component).
  const computeMapehTerm = (termKey: 'T1' | 'T2' | 'T3'): number | null => {
    const m = learningAreas.music[termKey];
    const p = learningAreas.pe[termKey];
    if (m !== null && p !== null) {
      return Math.round((m + p) / 2);
    }
    return null;
  };

  const computePublishedMapehTerm = (
    termKey: 'publishedT1' | 'publishedT2' | 'publishedT3'
  ): number | null => {
    const m = learningAreas.music[termKey];
    const p = learningAreas.pe[termKey];
    if (m !== null && p !== null) {
      return Math.round((m + p) / 2);
    }
    return null;
  };

  const mapehT1 = computeMapehTerm('T1');
  const mapehT2 = computeMapehTerm('T2');
  const mapehT3 = computeMapehTerm('T3');
  const mapehFinal =
    mapehT1 !== null && mapehT2 !== null && mapehT3 !== null
      ? Math.round((mapehT1 + mapehT2 + mapehT3) / 3)
      : null;
  const mapehRemarks: 'Passed' | 'Failed' | null =
    mapehFinal !== null ? (mapehFinal >= 75 ? 'Passed' : 'Failed') : null;

  const mapehPubT1 = computePublishedMapehTerm('publishedT1');
  const mapehPubT2 = computePublishedMapehTerm('publishedT2');
  const mapehPubT3 = computePublishedMapehTerm('publishedT3');
  const mapehPubFinal =
    mapehPubT1 !== null && mapehPubT2 !== null && mapehPubT3 !== null
      ? Math.round((mapehPubT1 + mapehPubT2 + mapehPubT3) / 3)
      : null;
  const isCompositePublishedAcrossThreeTerms =
    learningAreas.music.isSubjectPublishedAcrossThreeTerms &&
    learningAreas.pe.isSubjectPublishedAcrossThreeTerms;

  const mapehComposite = {
    key: 'mapeh' as const,
    label: 'MAPEH',
    T1: mapehT1,
    T2: mapehT2,
    T3: mapehT3,
    finalGrade: mapehFinal,
    remarks: mapehRemarks,
    publishedT1: mapehPubT1,
    publishedT2: mapehPubT2,
    publishedT3: mapehPubT3,
    publishedFinalGrade: mapehPubFinal,
    isCompositePublishedAcrossThreeTerms,
    cells: buildCellMapping('mapeh', 'MAPEH', 'T', 39, true),
  };

  // 8. Compute General Average across the 8 main rows (I32:I39) only when all 8 are complete
  // Matches 'SF9 - GRADE 4-10'!I42: =IF(COUNT(I32:I39)<=7,"",AVERAGE(I32:I39))
  const eightFinals = [
    learningAreas.filipino.finalGrade,
    learningAreas.english.finalGrade,
    learningAreas.math.finalGrade,
    learningAreas.science.finalGrade,
    learningAreas.ap.finalGrade,
    learningAreas.gmrc.finalGrade,
    learningAreas.tle.finalGrade,
    mapehComposite.finalGrade,
  ];
  const allEightFinalsPresent = eightFinals.every((val): val is number => typeof val === 'number');
  const generalAvgVal = allEightFinalsPresent
    ? Math.round(eightFinals.reduce((acc, v) => acc + v, 0) / 8)
    : null;
  const generalAvgRemarks: 'Passed' | 'Failed' | null =
    generalAvgVal !== null ? (generalAvgVal >= 75 ? 'Passed' : 'Failed') : null;

  const eightPublishedFinals = [
    learningAreas.filipino.publishedFinalGrade,
    learningAreas.english.publishedFinalGrade,
    learningAreas.math.publishedFinalGrade,
    learningAreas.science.publishedFinalGrade,
    learningAreas.ap.publishedFinalGrade,
    learningAreas.gmrc.publishedFinalGrade,
    learningAreas.tle.publishedFinalGrade,
    mapehComposite.publishedFinalGrade,
  ];
  const allEightPublishedFinalsPresent = eightPublishedFinals.every(
    (val): val is number => typeof val === 'number'
  );
  const publishedGeneralAvgVal = allEightPublishedFinalsPresent
    ? Math.round(eightPublishedFinals.reduce((acc, v) => acc + v, 0) / 8)
    : null;

  // 9. Completeness & Release Gate Diagnostics
  const completeThreeTermSubjects = REQUIRED_SUBJECT_KEYS.filter(
    (k) =>
      learningAreas[k].T1 !== null &&
      learningAreas[k].T2 !== null &&
      learningAreas[k].T3 !== null
  );
  const missingThreeTermSubjects = REQUIRED_SUBJECT_KEYS.filter(
    (k) => !completeThreeTermSubjects.includes(k)
  );
  const publishedThreeTermSubjects = REQUIRED_SUBJECT_KEYS.filter(
    (k) =>
      learningAreas[k].publishedT1 !== null &&
      learningAreas[k].publishedT2 !== null &&
      learningAreas[k].publishedT3 !== null
  );

  const blockingReasons: string[] = [];
  if (!allGradebooksPublished || !allThreeTermsPublished || !allAssignedSubjectsPublished) {
    blockingReasons.push('GRADES_NOT_PUBLISHED');
  }
  if (missingThreeTermSubjects.length > 0) {
    blockingReasons.push(`INCOMPLETE_ACADEMIC_RECORD (${missingThreeTermSubjects.join(', ')})`);
  }

  const validLrn = student.lrn && /^\d{12}$/.test(student.lrn.trim()) ? student.lrn.trim() : null;
  if (!validLrn) {
    blockingReasons.push('MISSING_AUTHORITATIVE_LRN');
  }

  let birthdateIso: string | null = null;
  let birthdateSerial: string | null = null;
  let age: number | null = null;
  if (student.date_of_birth) {
    const dob = new Date(student.date_of_birth);
    if (!Number.isNaN(dob.getTime())) {
      birthdateIso = dob.toISOString().slice(0, 10);
      birthdateSerial = dateToExcelSerial(dob);
      const ageDifMs = Date.now() - dob.getTime();
      age = Math.abs(new Date(ageDifMs).getUTCFullYear() - 1970);
    }
  }
  if (!birthdateIso) {
    blockingReasons.push('MISSING_AUTHORITATIVE_BIRTHDATE');
  }

  let normalizedGender: 'M' | 'F' | null = null;
  if (student.gender && /^(male|female|m|f)$/i.test(student.gender.trim())) {
    normalizedGender = student.gender.trim().toLowerCase().startsWith('f') ? 'F' : 'M';
  } else {
    blockingReasons.push('MISSING_AUTHORITATIVE_GENDER');
  }

  blockingReasons.push(
    'UNMAPPED_OFFICIAL_MONTHLY_ATTENDANCE',
    'UNMAPPED_OFFICIAL_ADVISER_COMMENTS'
  );

  const identity = getStudentIdentity(student);
  const formattedName = `${identity.lastName}, ${identity.firstName}${
    identity.middleName ? ' ' + identity.middleName : ''
  }`.toUpperCase();

  return {
    student: {
      id: student.id,
      userId: student.user_id || null,
      formattedName,
      lrn: validLrn,
      gender: normalizedGender,
      dateOfBirth: birthdateIso,
      birthdateSerial,
      age,
      cells: {
        inputDataName: "'INPUT DATA'!L11 (sharedStrings index)",
        inputDataLrn: "'INPUT DATA'!M11",
        inputDataBirthdate: "'INPUT DATA'!N11",
        sf9Name: "'SF9 - GRADE 4-10'!C17",
        sf9Lrn: "'SF9 - GRADE 4-10'!C18",
        sf9Age: "'SF9 - GRADE 4-10'!I17",
        sf9Sex: "'SF9 - GRADE 4-10'!K17",
        sf9GradeLevel: "'SF9 - GRADE 4-10'!I18 (Home!G9)",
        sf9Section: "'SF9 - GRADE 4-10'!K18 (Home!G10)",
        sf9SchoolYear: "'SF9 - GRADE 4-10'!G20 (Home!G8)",
      },
    },
    schoolMetadata: {
      schoolName: persistedSchoolSettings?.school_name || 'Calulut Integrated School',
      schoolShortName: persistedSchoolSettings?.school_short_name || 'CIS',
      schoolNameSource: persistedSchoolSettings?.school_name
        ? 'SchoolSettings.school_name'
        : 'DefaultFallback',
      schoolId: null,
      region: null,
      division: null,
      cells: {
        region: "Home!G4",
        division: "Home!G5",
        schoolName: "Home!G6",
        schoolId: "Home!G7",
      },
    },
    enrollment: {
      sectionId: section.id,
      sectionName: section.name,
      gradeLevel: section.grade_level,
      academicYearId: academicYear.id,
      academicYearName: academicYear.name,
    },
    learningAreas,
    mapehComposite,
    generalAverage: {
      value: generalAvgVal,
      publishedValue: publishedGeneralAvgVal,
      remarks: generalAvgRemarks,
      sf9FinalCell: "'SF9 - GRADE 4-10'!I42",
      sf9RemarksCell: "'SF9 - GRADE 4-10'!J42",
    },
    publicationStatus: {
      allGradebooksPublished,
      allThreeTermsPublished,
      allAssignedSubjectsPublished,
      hasImmutablePublishedSnapshot: false,
      provenanceLimitation:
        'Grade rows in the grades table are updated in-place by saveLedger() without a gradebook_id, published_version, or immutable published snapshot table.',
      completeThreeTermSubjects,
      missingThreeTermSubjects,
      publishedThreeTermSubjects,
    },
    attendance: {
      isAuthoritativeSourceAvailable: false,
      months: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
      present: null,
      classDays: null,
      absent: null,
      reason:
        'No SchoolCalendar model (for monthly classDays) or daily official homeroom/SF2 attendance model exists in schema.prisma; ClassAttendance records subject-period status and GateAttendance records physical gate entry/exit.',
    },
    comments: {
      isAuthoritativeSourceAvailable: false,
      t1: null,
      t2: null,
      t3: null,
      reason:
        'No database table or field exists for 3-term official Class Adviser narrative remarks (TEACHERS COMMENTS F14, J14, O14).',
    },
    signatories: {
      isAuthoritativeSourceAvailable: false,
      adviser: null,
      schoolHead: null,
      reason:
        'Section model has no dedicated adviser_teacher_id column, and school head/principal signatory is not stored on AcademicYear/Section/SchoolSettings metadata.',
    },
    releaseGate: {
      isEligibleForOfficialRelease: false,
      blockingReasons,
    },
  };
}

/**
 * Generate authentic Calulut SF9 Excel report for an enrolled student.
 *
 * Strictly enforces:
 * - Staff RBAC and teacher-to-section authorization
 * - Published gradebook requirement across all 3 terms (T1, T2, T3) with zero draft bypass
 * - Complete 3-term ratings across all required learning areas
 * - Zero fabrication of missing official attendance, adviser comments, or demographics
 */
export async function generateStudentCalulutSf9(
  studentId: string,
  actor: AuthenticatedUser
): Promise<{ buffer: Buffer; filename: string; calculated: any }> {
  const mapping = await resolveStudentSf9DataMapping(studentId, actor, {
    enforcePublishedGateFirst: true,
  });

  // 4. Grade Publication Integrity Gate (No draft bypass permitted)
  if (
    !mapping.publicationStatus.allGradebooksPublished ||
    !mapping.publicationStatus.allThreeTermsPublished ||
    !mapping.publicationStatus.allAssignedSubjectsPublished
  ) {
    throw new AppError(
      422,
      'GRADES_NOT_PUBLISHED',
      'Cannot generate official SF9: student gradebooks for all 3 terms (T1, T2, T3) in this academic year have not been officially approved and published.'
    );
  }

  // 5. Enforce 3-Term Subject Completeness
  const missingSubjects = mapping.publicationStatus.missingThreeTermSubjects;
  if (missingSubjects.length > 0) {
    throw new AppError(
      422,
      'INCOMPLETE_ACADEMIC_RECORD',
      `Cannot generate official SF9 report card: academic record is incomplete across all 3 terms (T1, T2, T3). Missing learning areas: ${missingSubjects.join(', ')}`
    );
  }

  const mappedGrades: Partial<Sf9SubjectScores> = {};
  for (const key of REQUIRED_SUBJECT_KEYS) {
    const area = mapping.learningAreas[key];
    if (area.T1 !== null && area.T2 !== null && area.T3 !== null) {
      mappedGrades[key] = [area.T1, area.T2, area.T3];
    }
  }

  // 6. Verify Authoritative Demographics, Signatories, Monthly Attendance & Adviser Comments
  // Never substitute synthetic attendance, hardcoded teacher comments, or fabricated demographic fallbacks.
  const unmappedAuthoritativeFields: string[] = [];

  if (!mapping.student.lrn) {
    unmappedAuthoritativeFields.push('demographics.lrn');
  }
  if (!mapping.student.dateOfBirth) {
    unmappedAuthoritativeFields.push('demographics.date_of_birth');
  }
  if (!mapping.student.gender) {
    unmappedAuthoritativeFields.push('demographics.gender');
  }

  unmappedAuthoritativeFields.push(
    'attendance.present (11 monthly totals)',
    'attendance.classDays (11 monthly school-calendar totals)',
    'comments.t1 (Term 1 official adviser remark)',
    'comments.t2 (Term 2 official adviser remark)',
    'comments.t3 (Term 3 official adviser remark)',
    'signatories.adviser (Section class adviser)',
    'signatories.schoolHead (Official school head)'
  );

  const candidatePayload: GenerateSf9Input = {
    demographics: {
      name: mapping.student.formattedName,
      lrn: mapping.student.lrn || '',
      birthdateSerial: mapping.student.birthdateSerial || '',
      age: mapping.student.age || 0,
      gender: (mapping.student.gender || 'M') as 'M' | 'F',
      gradeLevel: mapping.enrollment.gradeLevel,
      section: mapping.enrollment.sectionName,
      schoolYear: mapping.enrollment.academicYearName,
      schoolName: mapping.schoolMetadata.schoolName,
      schoolId: '500146',
    },
    grades: mappedGrades,
    attendance: {
      present: [],
      classDays: [],
    },
    comments: {
      t1: '',
      t2: '',
      t3: '',
    },
  };

  const completenessErrors = validateSf9InputCompleteness(candidatePayload);
  if (unmappedAuthoritativeFields.length > 0 || completenessErrors.length > 0) {
    throw new AppError(
      422,
      'AUTHORITATIVE_SF9_DATA_UNAVAILABLE',
      `Cannot release official Calulut SF9 report card: authoritative student data is unavailable for [${unmappedAuthoritativeFields.join(
        ', '
      )}]. Synthetic or hardcoded fallback values are strictly prohibited on real learner records.`
    );
  }

  throw new AppError(
    422,
    'AUTHORITATIVE_SF9_DATA_UNAVAILABLE',
    'Official student SF9 generation is blocked until authoritative monthly attendance and adviser comment mappings are enabled.'
  );
}

/**
 * Generate a 1-page landscape PDF rendered directly from an enrolled student's
 * populated Calulut SF9 Excel workbook via headless LibreOffice Calc.
 * Enforces the exact same role, section, completeness, grade publication, and
 * non-fabrication gates, and enforces cachePolicy: 'no-store'.
 */
export async function generateStudentCalulutSf9Pdf(
  studentId: string,
  actor: AuthenticatedUser
): Promise<{ buffer: Buffer; filename: string; calculated: any }> {
  const { buffer: xlsxBuffer, filename, calculated } = await generateStudentCalulutSf9(
    studentId,
    actor
  );
  const pdfBuffer = await renderCalulutSf9BufferToPdf(xlsxBuffer, {
    cachePolicy: 'no-store',
  });
  return {
    buffer: pdfBuffer,
    filename: filename.replace(/\.xlsx$/i, '.pdf'),
    calculated,
  };
}
