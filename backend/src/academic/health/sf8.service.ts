/**
 * DigiSkwela — DepEd School Form 8 (SF8) Service
 * File: backend/src/academic/health/sf8.service.ts
 *
 * Implements authoritative DepEd School Form 8 (Learner's Basic Health and Nutrition Report)
 * according to DepEd Order No. 058, s. 2017 & Calulut INHS Policy:
 * - Assessment periods: Beginning of School Year (BOSY) & End of School Year (EOSY)
 * - Prepared by: Class Adviser / MAPEH Teacher (No School Nurse required for Calulut INHS)
 * - Certified by: School Head / Principal
 * - Aggregated summary tables: BMI Nutritional Status & Height-for-Age (HFA) disaggregated by Sex
 * - Exports: CSV, authentic formatted Excel (.xlsx) workbook, and printable PDF document
 */

import prisma from '../../config/database.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { getStudentIdentity } from '../../common/utils/studentIdentity.js';
import { calculateAgeAsOf } from './ageCalculator.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface Sf8SummaryRow {
  category: string;
  maleCount: number;
  femaleCount: number;
  totalCount: number;
  malePercentage: number;
  femalePercentage: number;
  totalPercentage: number;
}

export interface Sf8LearnerRow {
  rowNumber: number;
  studentId: string;
  lrn: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
  gender: 'Male' | 'Female';
  birthDate?: string;
  unassessedAge?: {
    years: number;
    months: number;
    formatted: string;
  };
  
  // BOSY Measurement
  bosy?: {
    measurementDate: string;
    weightKg: number;
    heightCm: number;
    heightM: number;
    heightSquaredM2: number;
    ageYears: number;
    ageMonths: number;
    measurementAgeYears?: number;
    measurementAgeMonths?: number;
    bmi: number;
    nutritionalStatusBmi: string;
    heightForAgeStatus: string;
    remarks?: string;
    isLatest: boolean;
  };

  // EOSY Measurement
  eosy?: {
    measurementDate: string;
    weightKg: number;
    heightCm: number;
    heightM: number;
    heightSquaredM2: number;
    ageYears: number;
    ageMonths: number;
    measurementAgeYears?: number;
    measurementAgeMonths?: number;
    bmi: number;
    nutritionalStatusBmi: string;
    heightForAgeStatus: string;
    remarks?: string;
    isLatest: boolean;
  };
}

export interface Sf8ReportData {
  schoolInfo: {
    schoolName: string;
    schoolId: string;
    district: string;
    division: string;
    region: string;
    schoolYear: string;
    gradeLevel: number;
    sectionName: string;
    trackStrand?: string;
    ageCutoffBasis?: string;
  };
  accountability: {
    conductedByName: string;
    conductedByRole: string;
    reviewedByName: string;
    reviewedByRole: string;
    certifiedByName: string;
    certifiedByRole: string;
    preparedByName: string;
    preparedByRole: string;
    classAdviserName?: string;
    classAdviserRole?: string;
    dateGenerated: string;
    schoolNurseRequired: boolean;
    policyCitation: string;
    systemDisclaimer: string;
  };
  period: 'BOSY' | 'EOSY' | 'ALL';
  totalEnrolled: {
    male: number;
    female: number;
    total: number;
  };
  totalAssessed: {
    male: number;
    female: number;
    total: number;
  };
  totalUnassessed: {
    male: number;
    female: number;
    total: number;
  };
  learners: {
    male: Sf8LearnerRow[];
    female: Sf8LearnerRow[];
  };
  summaryBmi: {
    bosy: Sf8SummaryRow[];
    eosy?: Sf8SummaryRow[];
  };
  summaryHfa: {
    bosy: Sf8SummaryRow[];
    eosy?: Sf8SummaryRow[];
  };
}

/**
 * Generate official DepEd SF8 Report for a section
 */
export async function generateSf8Report(
  sectionId: string,
  period: 'BOSY' | 'EOSY' | 'ALL',
  authUserId: string
): Promise<Sf8ReportData> {
  // 1. Authorize caller
  const user = await prisma.user.findUnique({
    where: { id: authUserId },
    include: {
      user_roles: { include: { role: true } },
      teacher: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authenticated caller not found.');
  }

  const roleNames = user.user_roles.map((ur) => ur.role.name);
  const isGlobalStaff =
    roleNames.includes('Admin') ||
    roleNames.includes('ITAdmin') ||
    roleNames.includes('Principal') ||
    roleNames.includes('Registrar') ||
    roleNames.includes('Nurse');

  // 2. Fetch section, school settings, academic year, and enrolled students
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      academic_year: true,
      assignments: {
        include: { subject: true },
      },
      adviser_teacher: {
        include: { user: true },
      },
      enrollments: {
        where: { status: 'Enrolled' },
        include: {
          student: {
            include: {
              user: true,
              health_metrics: {
                where: { is_latest: true },
                orderBy: { measurement_date: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  if (!section) {
    throw new AppError(404, 'NOT_FOUND', `Section '${sectionId}' not found.`);
  }

  // 3. RBAC Enforcement: Class Adviser or MAPEH Teacher
  if (!isGlobalStaff) {
    if (!user.teacher) {
      throw new AppError(403, 'FORBIDDEN', 'Teacher profile is required.');
    }
    const isAdviser = section.adviser_teacher_id === user.teacher.id;
    if (!isAdviser) {
      const mapeh = await prisma.teacherSubjectAssignment.findFirst({
        where: {
          section_id: sectionId,
          teacher_id: user.teacher.id,
          subject: {
            OR: [
              { name: { contains: 'MAPEH', mode: 'insensitive' } },
              { name: { contains: 'Health', mode: 'insensitive' } },
              { name: { contains: 'Physical Education', mode: 'insensitive' } },
            ],
          },
        },
      });
      if (!mapeh) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Access restricted to the designated Class Adviser or assigned MAPEH Teacher.'
        );
      }
    }
  }

  // 4. Resolve School Settings & Authoritative Signatories per DepEd DO 58 s. 2017:
  // - Conducted/Assessed By: Person who performed measurements
  // - Reviewed By: MAPEH Coordinator / School Health Focal
  // - Certified Correct By: School Head / Principal
  const settings = await prisma.schoolSettings.findFirst();
  const ay = section.academic_year_id
    ? await prisma.academicYear.findUnique({ where: { id: section.academic_year_id } })
    : null;

  // Signatory 1: Conducted / Assessed By
  // Check if adviser has an official MAPEH subject assignment for this section
  const hasMapehAssignment = section.assignments?.some((a) => {
    const isThisTeacher = a.teacher_id === section.adviser_teacher_id;
    const subjName = a.subject?.name?.toLowerCase() || '';
    const subjCode = a.subject?.code?.toLowerCase() || '';
    return (
      isThisTeacher &&
      (subjName.includes('mapeh') ||
        subjName.includes('music') ||
        subjName.includes('arts') ||
        subjName.includes('physical education') ||
        subjName.includes('health') ||
        subjCode.includes('map') ||
        subjCode.includes('pe'))
    );
  });

  // Signatory 1: Conducted / Assessed By
  // DepEd DO 58, s. 2017: Only populate when supported by verified physical assessor records or approved school procedure.
  // Maria Clara is verified as Class Adviser and system encoder, but physical assessment responsibility
  // is unverified in school records. Leave signature field blank for physical assessor sign-off.
  const conductedByName = '';
  const conductedByRole = hasMapehAssignment
    ? 'Assigned MAPEH Teacher'
    : 'Designated Assessor / MAPEH Teacher';

  // Signatory 2: Reviewed By
  // Unverified in current configuration — leave blank line for physical review sign-off
  const reviewedByName = '';
  const reviewedByRole = 'MAPEH Coordinator / Health Focal';

  // Signatory 3: Certified Correct By
  // School Head / Principal verified from academic_year snapshot or school_settings; fallback to active Principal
  let certifiedByName =
    ay?.school_head_name_snapshot?.trim() ||
    settings?.school_head_name?.trim() ||
    '';
  let certifiedByRole =
    ay?.school_head_title_snapshot?.trim() ||
    settings?.school_head_title?.trim() ||
    'School Head / Principal';

  // For genuine official reports, require an appropriately verified institutional signatory
  // (from authorized academic year snapshot or school settings). Silent fallback to arbitrary
  // user accounts with role 'Principal' is disallowed to prevent unauthorized signatories.

  // 5. Transform learners and group by sex
  const maleLearners: Sf8LearnerRow[] = [];
  const femaleLearners: Sf8LearnerRow[] = [];

  const enrollments = [...section.enrollments];
  // Sort alphabetically by last name, then first name
  enrollments.sort((a, b) => {
    const nameA = `${a.student.last_name || ''} ${a.student.first_name || ''}`.toLowerCase();
    const nameB = `${b.student.last_name || ''} ${b.student.first_name || ''}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  let maleIndex = 1;
  let femaleIndex = 1;

  for (const enr of enrollments) {
    const s = enr.student;
    const ident = getStudentIdentity(s);
    const gender = s.gender === 'Female' ? 'Female' : 'Male';

    // Find BOSY and EOSY metrics
    const bosyMetric = s.health_metrics.find((m) => m.measurement_period === 'BOSY');
    const eosyMetric = s.health_metrics.find((m) => m.measurement_period === 'EOSY');

    // Calculate learner's completed age as of the provisional report cutoff reference date (DepEd DO 58, s. 2017)
    // DepEd SY 2026-2027 opening date was June 8, 2026; unconfirmed cutoff preserved as provisional.
    const provisionalBosyDate = section.academic_year?.start_date
      ? section.academic_year.start_date.toISOString().split('T')[0]
      : '2026-08-01';
    const refDate =
      period === 'EOSY'
        ? section.academic_year?.end_date
          ? section.academic_year.end_date.toISOString().split('T')[0]
          : '2027-03-31'
        : provisionalBosyDate;

    let unassessedAge: { years: number; months: number; formatted: string } | undefined;
    let reportAgeYears: number | undefined;
    let reportAgeMonths: number | undefined;

    if (s.date_of_birth) {
      const calc = calculateAgeAsOf(s.date_of_birth, refDate);
      if (calc) {
        reportAgeYears = calc.years;
        reportAgeMonths = calc.months;
        unassessedAge = {
          years: calc.years,
          months: calc.months,
          formatted: `${calc.years}`,
        };
      }
    }

    const learnerRow: Sf8LearnerRow = {
      rowNumber: gender === 'Male' ? maleIndex++ : femaleIndex++,
      studentId: s.id,
      lrn: s.lrn || '',
      lastName: ident.lastName,
      firstName: ident.firstName,
      middleName: ident.middleName || undefined,
      suffix: ident.suffix || undefined,
      gender,
      birthDate: s.date_of_birth ? s.date_of_birth.toISOString().split('T')[0] : undefined,
      unassessedAge,
    };

    if (bosyMetric) {
      const hCm = Number(bosyMetric.height_cm);
      const hM = Number((hCm / 100).toFixed(2));
      const hM2 = Number((hM * hM).toFixed(2));
      learnerRow.bosy = {
        measurementDate: bosyMetric.measurement_date.toISOString().split('T')[0],
        weightKg: Number(bosyMetric.weight_kg),
        heightCm: hCm,
        heightM: hM,
        heightSquaredM2: hM2,
        // Completed whole years as of report cutoff reference date per DepEd DO 58, s. 2017
        ageYears: reportAgeYears ?? (bosyMetric.computed_age_years ?? 0),
        ageMonths: reportAgeMonths ?? (bosyMetric.computed_age_months ?? 0),
        measurementAgeYears: bosyMetric.computed_age_years ?? 0,
        measurementAgeMonths: bosyMetric.computed_age_months ?? 0,
        bmi: Number(bosyMetric.computed_bmi ?? 0),
        nutritionalStatusBmi: bosyMetric.bmi_category || 'Pending Verification',
        heightForAgeStatus: bosyMetric.hfa_category || 'Pending Verification',
        remarks: bosyMetric.remarks || undefined,
        isLatest: bosyMetric.is_latest,
      };
    }

    if (eosyMetric) {
      const hCm = Number(eosyMetric.height_cm);
      const hM = Number((hCm / 100).toFixed(2));
      const hM2 = Number((hM * hM).toFixed(2));
      const eosyRefDate = section.academic_year?.end_date
        ? section.academic_year.end_date.toISOString().split('T')[0]
        : '2027-03-31';
      const calcEosy = s.date_of_birth ? calculateAgeAsOf(s.date_of_birth, eosyRefDate) : null;
      learnerRow.eosy = {
        measurementDate: eosyMetric.measurement_date.toISOString().split('T')[0],
        weightKg: Number(eosyMetric.weight_kg),
        heightCm: hCm,
        heightM: hM,
        heightSquaredM2: hM2,
        ageYears: calcEosy ? calcEosy.years : (eosyMetric.computed_age_years ?? 0),
        ageMonths: calcEosy ? calcEosy.months : (eosyMetric.computed_age_months ?? 0),
        measurementAgeYears: eosyMetric.computed_age_years ?? 0,
        measurementAgeMonths: eosyMetric.computed_age_months ?? 0,
        bmi: Number(eosyMetric.computed_bmi ?? 0),
        nutritionalStatusBmi: eosyMetric.bmi_category || 'Pending Verification',
        heightForAgeStatus: eosyMetric.hfa_category || 'Pending Verification',
        remarks: eosyMetric.remarks || undefined,
        isLatest: eosyMetric.is_latest,
      };
    }

    if (gender === 'Male') {
      maleLearners.push(learnerRow);
    } else {
      femaleLearners.push(learnerRow);
    }
  }

  // 6. Compute Nutritional Summary Statistics (BMI and HFA)
  // Crucial: Missing/unassessed measurements are NOT counted in Normal or any WHO category
  function computeSummaryTable(
    males: Sf8LearnerRow[],
    females: Sf8LearnerRow[],
    targetPeriod: 'BOSY' | 'EOSY'
  ) {
    const bmiCategories = ['Severely Wasted', 'Wasted', 'Normal', 'Overweight', 'Obese'];
    const hfaCategories = ['Severely Stunted', 'Stunted', 'Normal', 'Tall'];

    const totalM = males.length;
    const totalF = females.length;
    const grandTotal = totalM + totalF;

    const bmiSummary: Sf8SummaryRow[] = bmiCategories.map((cat) => {
      const mCount = males.filter(
        (m) => (targetPeriod === 'BOSY' ? m.bosy?.nutritionalStatusBmi : m.eosy?.nutritionalStatusBmi) === cat
      ).length;
      const fCount = females.filter(
        (f) => (targetPeriod === 'BOSY' ? f.bosy?.nutritionalStatusBmi : f.eosy?.nutritionalStatusBmi) === cat
      ).length;
      const tCount = mCount + fCount;
      return {
        category: cat,
        maleCount: mCount,
        femaleCount: fCount,
        totalCount: tCount,
        malePercentage: totalM > 0 ? Number(((mCount / totalM) * 100).toFixed(1)) : 0,
        femalePercentage: totalF > 0 ? Number(((fCount / totalF) * 100).toFixed(1)) : 0,
        totalPercentage: grandTotal > 0 ? Number(((tCount / grandTotal) * 100).toFixed(1)) : 0,
      };
    });

    const hfaSummary: Sf8SummaryRow[] = hfaCategories.map((cat) => {
      const mCount = males.filter(
        (m) => (targetPeriod === 'BOSY' ? m.bosy?.heightForAgeStatus : m.eosy?.heightForAgeStatus) === cat
      ).length;
      const fCount = females.filter(
        (f) => (targetPeriod === 'BOSY' ? f.bosy?.heightForAgeStatus : f.eosy?.heightForAgeStatus) === cat
      ).length;
      const tCount = mCount + fCount;
      return {
        category: cat,
        maleCount: mCount,
        femaleCount: fCount,
        totalCount: tCount,
        malePercentage: totalM > 0 ? Number(((mCount / totalM) * 100).toFixed(1)) : 0,
        femalePercentage: totalF > 0 ? Number(((fCount / totalF) * 100).toFixed(1)) : 0,
        totalPercentage: grandTotal > 0 ? Number(((tCount / grandTotal) * 100).toFixed(1)) : 0,
      };
    });

    return { bmiSummary, hfaSummary };
  }

  const bosySummary = computeSummaryTable(maleLearners, femaleLearners, 'BOSY');
  const eosySummary = computeSummaryTable(maleLearners, femaleLearners, 'EOSY');

  // Count assessed vs unassessed for selected period
  const isAssessedForPeriod = (l: Sf8LearnerRow) => {
    if (period === 'BOSY') return Boolean(l.bosy);
    if (period === 'EOSY') return Boolean(l.eosy);
    return Boolean(l.bosy || l.eosy);
  };

  const assessedM = maleLearners.filter(isAssessedForPeriod).length;
  const assessedF = femaleLearners.filter(isAssessedForPeriod).length;
  const unassessedM = maleLearners.length - assessedM;
  const unassessedF = femaleLearners.length - assessedF;

  // School Identity resolution: Confirmed official school name is Calulut Integrated School
  const configuredSchoolName = settings?.school_name?.trim();
  const schoolName = configuredSchoolName || 'Calulut Integrated School';

  // Institution DepEd School ID kept pending authorized configuration until separately confirmed
  const configuredSchoolId = settings?.school_id?.trim();
  const schoolId = configuredSchoolId || 'Pending Configuration (Ref: 500146)';

  const district = settings?.district?.trim() || '— Pending Configuration —';
  const division = settings?.division?.trim() || 'San Fernando City (Pending Confirmation)';
  const region = settings?.region?.trim() || 'Region III';

  const provisionalBosyDate = section.academic_year?.start_date
    ? section.academic_year.start_date.toISOString().split('T')[0]
    : '2026-08-01';

  return {
    schoolInfo: {
      schoolName,
      schoolId,
      district,
      division,
      region,
      schoolYear: section.academic_year?.name || 'SY 2026-2027',
      gradeLevel: section.grade_level,
      sectionName: section.name,
      trackStrand: section.grade_level >= 11 ? 'Senior High School' : 'Junior High School',
      ageCutoffBasis:
        period === 'EOSY'
          ? 'Provisional EOSY Cutoff (2027-03-31) — Awaiting Calulut Confirmation'
          : `Provisional BOSY Cutoff: ${provisionalBosyDate} — Awaiting Calulut Confirmation (Note: Official DepEd SY 2026–2027 opening was June 8, 2026; assessment cutoff pending confirmation)`,
    },
    accountability: {
      conductedByName,
      conductedByRole,
      reviewedByName,
      reviewedByRole,
      certifiedByName,
      certifiedByRole,
      preparedByName: conductedByName,
      preparedByRole: conductedByRole,
      classAdviserName: section.adviser_teacher?.user
        ? `${section.adviser_teacher.user.first_name} ${section.adviser_teacher.user.last_name}`
        : undefined,
      classAdviserRole: 'Class Adviser',
      dateGenerated: new Date().toISOString().split('T')[0],
      schoolNurseRequired: false,
      policyCitation: 'DepEd Order No. 058, s. 2017 & Calulut Staffing Policy',
      systemDisclaimer: 'DigiSkwela System-Generated Report — Conforming to DepEd SF8 layout. Not an official LIS portal issuance.',
    },
    period,
    totalEnrolled: {
      male: maleLearners.length,
      female: femaleLearners.length,
      total: maleLearners.length + femaleLearners.length,
    },
    totalAssessed: {
      male: assessedM,
      female: assessedF,
      total: assessedM + assessedF,
    },
    totalUnassessed: {
      male: unassessedM,
      female: unassessedF,
      total: unassessedM + unassessedF,
    },
    learners: {
      male: maleLearners,
      female: femaleLearners,
    },
    summaryBmi: {
      bosy: bosySummary.bmiSummary,
      eosy: period === 'EOSY' || period === 'ALL' ? eosySummary.bmiSummary : undefined,
    },
    summaryHfa: {
      bosy: bosySummary.hfaSummary,
      eosy: period === 'EOSY' || period === 'ALL' ? eosySummary.hfaSummary : undefined,
    },
  };
}

/**
 * Export official DepEd SF8 Report as formatted CSV
 */
export async function exportSf8Csv(
  sectionId: string,
  period: 'BOSY' | 'EOSY' | 'ALL',
  authUserId: string
): Promise<{ filename: string; csv: string; report: Sf8ReportData }> {
  const report = await generateSf8Report(sectionId, period, authUserId);

  function escapeCsv(val: any): string {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  }

  const lines: string[] = [];

  // 1. DepEd Official Header
  lines.push([escapeCsv('DEPARTMENT OF EDUCATION'), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv('')].join(','));
  lines.push([escapeCsv('SCHOOL FORM 8 (SF8) - LEARNER BASIC HEALTH AND NUTRITION REPORT'), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv('')].join(','));
  lines.push([escapeCsv('Conforming to DepEd Order No. 058, s. 2017 & WHO Growth Reference 2007'), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv('')].join(','));
  lines.push('');

  // 2. School Metadata
  lines.push([escapeCsv('School Name:'), escapeCsv(report.schoolInfo.schoolName), escapeCsv('School ID:'), escapeCsv(report.schoolInfo.schoolId), escapeCsv('District:'), escapeCsv(report.schoolInfo.district), escapeCsv('Division:'), escapeCsv(report.schoolInfo.division)].join(','));
  lines.push([escapeCsv('Region:'), escapeCsv(report.schoolInfo.region), escapeCsv('School Year:'), escapeCsv(report.schoolInfo.schoolYear), escapeCsv('Grade & Section:'), escapeCsv(`Grade ${report.schoolInfo.gradeLevel} - ${report.schoolInfo.sectionName}`), escapeCsv('Assessment Period:'), escapeCsv(period)].join(','));
  if (report.schoolInfo.ageCutoffBasis) {
    lines.push([escapeCsv('Age Reference Basis:'), escapeCsv(report.schoolInfo.ageCutoffBasis)].join(','));
  }
  lines.push('');

  // 3. Helper for learner tables
  const addLearnerSection = (title: string, list: Sf8LearnerRow[], assessedCount: number, unassessedCount: number) => {
    lines.push([escapeCsv(title), escapeCsv(`(${list.length} Enrolled | ${assessedCount} Assessed | ${unassessedCount} Pending)`), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv('')].join(','));
    lines.push([
      escapeCsv('#'),
      escapeCsv('LRN'),
      escapeCsv("Learner's Name (Last, First, Middle)"),
      escapeCsv('Birthdate'),
      escapeCsv('AGE'),
      escapeCsv('Weight (kg)'),
      escapeCsv('Height (m)'),
      escapeCsv('Height² (m²)'),
      escapeCsv('BMI'),
      escapeCsv('BMI Nutritional Status'),
      escapeCsv('Height-for-Age Status'),
      escapeCsv('Remarks'),
    ].join(','));

    for (const l of list) {
      const m = period === 'EOSY' ? (l.eosy || l.bosy) : l.bosy;
      const fullName = `${l.lastName}, ${l.firstName}${l.middleName ? ' ' + l.middleName : ''}${l.suffix ? ' ' + l.suffix : ''}`;
      // Completed whole years per DO 58, s. 2017
      const ageStr = m
        ? String(m.ageYears)
        : (l.unassessedAge ? String(l.unassessedAge.years) : '—');
      lines.push([
        escapeCsv(l.rowNumber),
        escapeCsv(l.lrn),
        escapeCsv(fullName),
        escapeCsv(l.birthDate || '—'),
        escapeCsv(ageStr),
        escapeCsv(m ? m.weightKg.toFixed(1) : '—'),
        escapeCsv(m ? m.heightM.toFixed(2) : '—'),
        escapeCsv(m ? m.heightSquaredM2.toFixed(2) : '—'),
        escapeCsv(m ? m.bmi.toFixed(1) : '—'),
        escapeCsv(m ? m.nutritionalStatusBmi : 'Unassessed'),
        escapeCsv(m ? m.heightForAgeStatus : 'Unassessed'),
        escapeCsv(m?.remarks || (m ? 'Screened' : 'Unmeasured')),
      ].join(','));
    }
    lines.push('');
  };

  addLearnerSection('MALE LEARNERS', report.learners.male, report.totalAssessed.male, report.totalUnassessed.male);
  addLearnerSection('FEMALE LEARNERS', report.learners.female, report.totalAssessed.female, report.totalUnassessed.female);

  // 4. BMI Summary Table
  lines.push([escapeCsv('SUMMARY NUTRITIONAL STATUS (BMI-FOR-AGE)'), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv('')].join(','));
  lines.push([
    escapeCsv('Nutritional Category'),
    escapeCsv('Male'),
    escapeCsv('Male %'),
    escapeCsv('Female'),
    escapeCsv('Female %'),
    escapeCsv('Total'),
    escapeCsv('Total %'),
  ].join(','));
  const bmiRows = (period === 'EOSY' && report.summaryBmi.eosy) ? report.summaryBmi.eosy : report.summaryBmi.bosy;
  for (const r of bmiRows) {
    lines.push([
      escapeCsv(r.category),
      escapeCsv(r.maleCount),
      escapeCsv(`${r.malePercentage}%`),
      escapeCsv(r.femaleCount),
      escapeCsv(`${r.femalePercentage}%`),
      escapeCsv(r.totalCount),
      escapeCsv(`${r.totalPercentage}%`),
    ].join(','));
  }
  lines.push('');

  // 5. HFA Summary Table
  lines.push([escapeCsv('SUMMARY HEIGHT-FOR-AGE (HFA)'), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv(''), escapeCsv('')].join(','));
  lines.push([
    escapeCsv('Growth Category'),
    escapeCsv('Male'),
    escapeCsv('Male %'),
    escapeCsv('Female'),
    escapeCsv('Female %'),
    escapeCsv('Total'),
    escapeCsv('Total %'),
  ].join(','));
  const hfaRows = (period === 'EOSY' && report.summaryHfa.eosy) ? report.summaryHfa.eosy : report.summaryHfa.bosy;
  for (const r of hfaRows) {
    lines.push([
      escapeCsv(r.category),
      escapeCsv(r.maleCount),
      escapeCsv(`${r.malePercentage}%`),
      escapeCsv(r.femaleCount),
      escapeCsv(`${r.femalePercentage}%`),
      escapeCsv(r.totalCount),
      escapeCsv(`${r.totalPercentage}%`),
    ].join(','));
  }
  lines.push('');

  // 6. Completeness Breakdown
  lines.push([escapeCsv('ASSESSMENT COMPLETENESS BREAKDOWN'), escapeCsv(''), escapeCsv(''), escapeCsv('')].join(','));
  lines.push([escapeCsv('Total Enrolled:'), escapeCsv(report.totalEnrolled.male), escapeCsv(report.totalEnrolled.female), escapeCsv(report.totalEnrolled.total)].join(','));
  lines.push([escapeCsv('Total Assessed:'), escapeCsv(report.totalAssessed.male), escapeCsv(report.totalAssessed.female), escapeCsv(report.totalAssessed.total)].join(','));
  lines.push([escapeCsv('Total Unassessed:'), escapeCsv(report.totalUnassessed.male), escapeCsv(report.totalUnassessed.female), escapeCsv(report.totalUnassessed.total)].join(','));
  lines.push('');

  // 7. Official SF8 Signatory Responsibilities (DepEd DO 058, s. 2017)
  lines.push([escapeCsv('OFFICIAL SF8 SIGNATORY RESPONSIBILITIES')].join(','));
  lines.push([escapeCsv('Conducted / Assessed By:'), escapeCsv(report.accountability.conductedByName || '— Pending Designation —'), escapeCsv(report.accountability.conductedByRole)].join(','));
  lines.push([escapeCsv('Reviewed By:'), escapeCsv(report.accountability.reviewedByName || '— Pending Designation —'), escapeCsv(report.accountability.reviewedByRole)].join(','));
  lines.push([escapeCsv('Certified Correct By:'), escapeCsv(report.accountability.certifiedByName || '— Pending Designation —'), escapeCsv(report.accountability.certifiedByRole)].join(','));
  lines.push([escapeCsv('Date Generated:'), escapeCsv(report.accountability.dateGenerated), escapeCsv('Policy:'), escapeCsv(report.accountability.policyCitation)].join(','));
  lines.push([escapeCsv('Disclaimer:'), escapeCsv(report.accountability.systemDisclaimer)].join(','));

  const cleanSec = report.schoolInfo.sectionName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `DepEd_SF8_Grade${report.schoolInfo.gradeLevel}_${cleanSec}_${period}.csv`;

  return {
    filename,
    csv: lines.join('\r\n'),
    report,
  };
}

/**
 * Export official DepEd SF8 Report as authentic styled Excel (.xlsx) workbook
 */
export async function exportSf8Excel(
  sectionId: string,
  period: 'BOSY' | 'EOSY' | 'ALL',
  authUserId: string
): Promise<{ filename: string; buffer: Buffer; report: Sf8ReportData }> {
  const report = await generateSf8Report(sectionId, period, authUserId);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DigiSkwela - Calulut Integrated School';
  workbook.lastModifiedBy = report.accountability.preparedByName;
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheetName = `SF8 - Gr${report.schoolInfo.gradeLevel} ${report.schoolInfo.sectionName}`.slice(0, 31);
  const ws = workbook.addWorksheet(sheetName, {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  // Set explicit column widths
  ws.columns = [
    { key: 'col1', width: 5 },
    { key: 'col2', width: 16 },
    { key: 'col3', width: 32 },
    { key: 'col4', width: 13 },
    { key: 'col5', width: 9 },
    { key: 'col6', width: 10 },
    { key: 'col7', width: 10 },
    { key: 'col8', width: 10 },
    { key: 'col9', width: 10 },
    { key: 'col10', width: 18 },
    { key: 'col11', width: 18 },
    { key: 'col12', width: 18 },
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  // 1. Official Header
  ws.mergeCells('A1:L1');
  const row1 = ws.getCell('A1');
  row1.value = 'REPUBLIC OF THE PHILIPPINES • DEPARTMENT OF EDUCATION';
  row1.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF475569' } };
  row1.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('A2:L2');
  const row2 = ws.getCell('A2');
  row2.value = 'SCHOOL FORM 8 (SF8) — LEARNER BASIC HEALTH AND NUTRITION REPORT';
  row2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  row2.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('A3:L3');
  const row3 = ws.getCell('A3');
  row3.value = '(Conforming to DepEd Order No. 058, s. 2017 & WHO Growth Reference 2007)';
  row3.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
  row3.alignment = { horizontal: 'center', vertical: 'middle' };

  // 2. School Metadata Grid
  ws.mergeCells('A5:C5');
  ws.getCell('A5').value = `School Name: ${report.schoolInfo.schoolName}`;
  ws.mergeCells('D5:F5');
  ws.getCell('D5').value = `School ID: ${report.schoolInfo.schoolId}`;
  ws.mergeCells('G5:I5');
  ws.getCell('G5').value = `District: ${report.schoolInfo.district}`;
  ws.mergeCells('J5:L5');
  ws.getCell('J5').value = `Division: ${report.schoolInfo.division}`;

  ws.mergeCells('A6:C6');
  ws.getCell('A6').value = `Region: ${report.schoolInfo.region}`;
  ws.mergeCells('D6:F6');
  ws.getCell('D6').value = `School Year: ${report.schoolInfo.schoolYear}`;
  ws.mergeCells('G6:I6');
  ws.getCell('G6').value = `Grade & Section: Grade ${report.schoolInfo.gradeLevel} - ${report.schoolInfo.sectionName}`;
  ws.mergeCells('J6:L6');
  ws.getCell('J6').value = `Assessment Period: ${period} ${period === 'BOSY' ? 'Baseline' : period === 'EOSY' ? 'Post-Assessment' : ''}`;

  ['A5', 'D5', 'G5', 'J5', 'A6', 'D6', 'G6', 'J6'].forEach((cellRef) => {
    const c = ws.getCell(cellRef);
    c.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF1E293B' } };
    c.alignment = { vertical: 'middle' };
  });

  if (report.schoolInfo.ageCutoffBasis) {
    ws.mergeCells('A7:L7');
    const c7 = ws.getCell('A7');
    c7.value = `Age Reference Basis: ${report.schoolInfo.ageCutoffBasis}`;
    c7.font = { name: 'Arial', size: 7.5, italic: true, color: { argb: 'FF64748B' } };
    c7.alignment = { vertical: 'middle' };
  }

  let curRow = report.schoolInfo.ageCutoffBasis ? 9 : 8;

  // 3. Table Column Headers
  const headers = [
    '#',
    'LRN',
    "LEARNER'S NAME (Last, First, Middle)",
    'BIRTHDATE',
    'AGE',
    'WT (kg)',
    'HT (m)',
    'HT² (m²)',
    'BMI',
    'BMI STATUS',
    'HFA STATUS',
    'REMARKS',
  ];

  const headerRow = ws.getRow(curRow);
  headerRow.values = headers;
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });
  curRow++;

  // Helper to add learners
  const addLearnerBlock = (title: string, learners: Sf8LearnerRow[], bgColor: string) => {
    ws.mergeCells(`A${curRow}:L${curRow}`);
    const sectionCell = ws.getCell(`A${curRow}`);
    sectionCell.value = title;
    sectionCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    sectionCell.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(curRow).height = 20;
    curRow++;

    if (learners.length === 0) {
      ws.mergeCells(`A${curRow}:L${curRow}`);
      const emptyCell = ws.getCell(`A${curRow}`);
      emptyCell.value = 'No learners enrolled in this category.';
      emptyCell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
      emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      emptyCell.border = thinBorder;
      curRow++;
      return;
    }

    for (const l of learners) {
      const m = period === 'EOSY' ? (l.eosy || l.bosy) : l.bosy;
      const r = ws.getRow(curRow);
      const fullName = `${l.lastName}, ${l.firstName}${l.middleName ? ' ' + l.middleName[0] + '.' : ''}${l.suffix ? ' ' + l.suffix : ''}`;
      // Completed whole years per DO 58, s. 2017
      const ageVal = m
        ? m.ageYears
        : (l.unassessedAge ? l.unassessedAge.years : '—');
      
      r.values = [
        l.rowNumber,
        l.lrn,
        fullName,
        l.birthDate || '—',
        ageVal,
        m ? m.weightKg : '—',
        m ? m.heightM : '—',
        m ? m.heightSquaredM2 : '—',
        m ? m.bmi : '—',
        m ? m.nutritionalStatusBmi : 'Unassessed',
        m ? m.heightForAgeStatus : 'Unassessed',
        m ? (m.remarks || 'Screened') : 'Unmeasured',
      ];

      r.height = 18;
      r.eachCell((cell, colNum) => {
        cell.border = thinBorder;
        cell.font = { name: 'Arial', size: 8, color: { argb: 'FF0F172A' } };
        cell.alignment = { vertical: 'middle' };

        if (colNum === 1 || colNum === 4 || colNum === 5) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNum === 2) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Consolas', size: 8, bold: true, color: { argb: 'FF1E293B' } };
        } else if (colNum >= 6 && colNum <= 9) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (typeof cell.value === 'number') {
            cell.numFmt = colNum === 7 || colNum === 8 ? '0.00' : '0.0';
          }
        } else if (colNum === 10 || colNum === 11) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          const val = String(cell.value);
          if (val === 'Normal') cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF166534' } };
          else if (val === 'Overweight') cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF854D0E' } };
          else if (val === 'Obese' || val === 'Severely Wasted' || val === 'Severely Stunted') cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF991B1B' } };
          else if (val === 'Wasted' || val === 'Stunted') cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFC2410C' } };
          else cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
        }
      });
      curRow++;
    }
  };

  addLearnerBlock(
    `MALE LEARNERS (${report.learners.male.length} Enrolled | ${report.totalAssessed.male} Assessed | ${report.totalUnassessed.male} Pending)`,
    report.learners.male,
    'FF1E3A8A'
  );
  addLearnerBlock(
    `FEMALE LEARNERS (${report.learners.female.length} Enrolled | ${report.totalAssessed.female} Assessed | ${report.totalUnassessed.female} Pending)`,
    report.learners.female,
    'FF831843'
  );

  curRow += 1;

  // 4. DepEd Nutritional Summary Statistics Tables
  ws.mergeCells(`A${curRow}:L${curRow}`);
  const summaryHeader = ws.getCell(`A${curRow}`);
  summaryHeader.value = 'SUMMARY NUTRITIONAL STATUS & HEIGHT-FOR-AGE (HFA) TABLES';
  summaryHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  curRow++;

  const bmiRows = (period === 'EOSY' && report.summaryBmi.eosy) ? report.summaryBmi.eosy : report.summaryBmi.bosy;
  const hfaRows = (period === 'EOSY' && report.summaryHfa.eosy) ? report.summaryHfa.eosy : report.summaryHfa.bosy;

  // BMI Summary Header
  ws.mergeCells(`A${curRow}:F${curRow}`);
  const bmiTitle = ws.getCell(`A${curRow}`);
  bmiTitle.value = 'NUTRITIONAL STATUS (BMI-FOR-AGE)';
  bmiTitle.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
  bmiTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  bmiTitle.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`G${curRow}:L${curRow}`);
  const hfaTitle = ws.getCell(`G${curRow}`);
  hfaTitle.value = 'HEIGHT-FOR-AGE (HFA / STUNTING STATUS)';
  hfaTitle.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
  hfaTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  hfaTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  curRow++;

  const subHeader = ws.getRow(curRow);
  subHeader.values = [
    'Category', 'M', '%', 'F', '%', 'Total',
    'Category', 'M', '%', 'F', '%', 'Total',
  ];
  subHeader.eachCell((c) => {
    c.font = { name: 'Arial', size: 7, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder;
  });
  curRow++;

  const maxRows = Math.max(bmiRows.length, hfaRows.length);
  for (let i = 0; i < maxRows; i++) {
    const b = bmiRows[i];
    const h = hfaRows[i];
    const r = ws.getRow(curRow);
    r.values = [
      b ? b.category : '',
      b ? b.maleCount : '',
      b ? `${b.malePercentage}%` : '',
      b ? b.femaleCount : '',
      b ? `${b.femalePercentage}%` : '',
      b ? b.totalCount : '',
      h ? h.category : '',
      h ? h.maleCount : '',
      h ? `${h.malePercentage}%` : '',
      h ? h.femaleCount : '',
      h ? `${h.femalePercentage}%` : '',
      h ? h.totalCount : '',
    ];
    r.eachCell((c) => {
      c.font = { name: 'Arial', size: 8 };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = thinBorder;
    });
    curRow++;
  }

  curRow += 1;

  // 5. Completeness Summary Box
  ws.mergeCells(`A${curRow}:D${curRow}`);
  ws.getCell(`A${curRow}`).value = `Total Enrolled: ${report.totalEnrolled.total} (Male: ${report.totalEnrolled.male}, Female: ${report.totalEnrolled.female})`;
  ws.mergeCells(`E${curRow}:H${curRow}`);
  ws.getCell(`E${curRow}`).value = `Total Assessed: ${report.totalAssessed.total} (Male: ${report.totalAssessed.male}, Female: ${report.totalAssessed.female})`;
  ws.mergeCells(`I${curRow}:L${curRow}`);
  ws.getCell(`I${curRow}`).value = `Pending / Unassessed: ${report.totalUnassessed.total} (Male: ${report.totalUnassessed.male}, Female: ${report.totalUnassessed.female})`;

  ['A', 'E', 'I'].forEach((col) => {
    const c = ws.getCell(`${col}${curRow}`);
    c.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF1E293B' } };
    c.alignment = { vertical: 'middle' };
  });

  curRow += 3;

  // 6. Official Accountability Signatures (Conducted, Reviewed, Certified Correct)
  ws.mergeCells(`A${curRow}:D${curRow}`);
  const cond = ws.getCell(`A${curRow}`);
  cond.value = report.accountability.conductedByName || '';
  cond.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
  cond.alignment = { horizontal: 'center', vertical: 'middle' };
  cond.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } };

  ws.mergeCells(`E${curRow}:H${curRow}`);
  const rev = ws.getCell(`E${curRow}`);
  rev.value = report.accountability.reviewedByName || '';
  rev.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
  rev.alignment = { horizontal: 'center', vertical: 'middle' };
  rev.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } };

  ws.mergeCells(`I${curRow}:L${curRow}`);
  const cert = ws.getCell(`I${curRow}`);
  cert.value = report.accountability.certifiedByName || '';
  cert.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
  cert.alignment = { horizontal: 'center', vertical: 'middle' };
  cert.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } };

  curRow++;
  ws.mergeCells(`A${curRow}:D${curRow}`);
  ws.getCell(`A${curRow}`).value = report.accountability.conductedByRole;
  ws.getCell(`A${curRow}`).font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF475569' } };
  ws.getCell(`A${curRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`E${curRow}:H${curRow}`);
  ws.getCell(`E${curRow}`).value = report.accountability.reviewedByRole;
  ws.getCell(`E${curRow}`).font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF475569' } };
  ws.getCell(`E${curRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`I${curRow}:L${curRow}`);
  ws.getCell(`I${curRow}`).value = report.accountability.certifiedByRole;
  ws.getCell(`I${curRow}`).font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF475569' } };
  ws.getCell(`I${curRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  curRow++;
  ws.mergeCells(`A${curRow}:D${curRow}`);
  ws.getCell(`A${curRow}`).value = report.accountability.conductedByName ? 'Conducted / Assessed By' : 'Conducted / Assessed By (Pending Verification)';
  ws.getCell(`A${curRow}`).font = { name: 'Arial', size: 7, italic: true, color: { argb: 'FF64748B' } };
  ws.getCell(`A${curRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`E${curRow}:H${curRow}`);
  ws.getCell(`E${curRow}`).value = 'Reviewed By (Pending Designation)';
  ws.getCell(`E${curRow}`).font = { name: 'Arial', size: 7, italic: true, color: { argb: 'FF64748B' } };
  ws.getCell(`E${curRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`I${curRow}:L${curRow}`);
  ws.getCell(`I${curRow}`).value = 'Certified Correct By (Pending Designation)';
  ws.getCell(`I${curRow}`).font = { name: 'Arial', size: 7, italic: true, color: { argb: 'FF64748B' } };
  ws.getCell(`I${curRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  curRow += 2;
  ws.mergeCells(`A${curRow}:L${curRow}`);
  const disclaimerCell = ws.getCell(`A${curRow}`);
  disclaimerCell.value = `${report.accountability.systemDisclaimer} • Generated: ${report.accountability.dateGenerated}`;
  disclaimerCell.font = { name: 'Arial', size: 7, italic: true, color: { argb: 'FF94A3B8' } };
  disclaimerCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const rawBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(rawBuffer);

  const cleanSec = report.schoolInfo.sectionName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `DepEd_SF8_Grade${report.schoolInfo.gradeLevel}_${cleanSec}_${period}.xlsx`;

  return { filename, buffer, report };
}

/**
 * Export official DepEd SF8 Report as printable PDF document
 */
export async function exportSf8Pdf(
  sectionId: string,
  period: 'BOSY' | 'EOSY' | 'ALL',
  authUserId: string
): Promise<{ filename: string; buffer: Buffer; report: Sf8ReportData }> {
  const report = await generateSf8Report(sectionId, period, authUserId);
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 20 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  // 1. Header
  doc.fontSize(8).fillColor('#475569').text('REPUBLIC OF THE PHILIPPINES • DEPARTMENT OF EDUCATION', { align: 'center' });
  doc.fontSize(13).fillColor('#0f172a').font('Helvetica-Bold').text('SCHOOL FORM 8 (SF8) — LEARNER BASIC HEALTH AND NUTRITION REPORT', { align: 'center' });
  doc.fontSize(7).fillColor('#64748b').font('Helvetica-Oblique').text('(Conforming to DepEd Order No. 058, s. 2017 & WHO Growth Reference 2007)', { align: 'center' });
  doc.moveDown(0.5);

  // 2. School Metadata Grid
  const metaY = doc.y;
  doc.rect(20, metaY, 802, 38).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').font('Helvetica').fontSize(7.5);
  doc.text(`School Name: ${report.schoolInfo.schoolName}`, 26, metaY + 4);
  doc.text(`School ID: ${report.schoolInfo.schoolId}`, 250, metaY + 4);
  doc.text(`District: ${report.schoolInfo.district}`, 420, metaY + 4);
  doc.text(`Division: ${report.schoolInfo.division}`, 620, metaY + 4);

  doc.text(`Region: ${report.schoolInfo.region}`, 26, metaY + 16);
  doc.text(`School Year: ${report.schoolInfo.schoolYear}`, 250, metaY + 16);
  doc.text(`Grade & Section: Grade ${report.schoolInfo.gradeLevel} - ${report.schoolInfo.sectionName}`, 420, metaY + 16);
  doc.text(`Assessment Period: ${period} Baseline`, 620, metaY + 16);

  if (report.schoolInfo.ageCutoffBasis) {
    doc.fillColor('#64748b').font('Helvetica-Oblique').fontSize(6.5);
    doc.text(`Age Reference Basis: ${report.schoolInfo.ageCutoffBasis}`, 26, metaY + 28);
  }

  doc.y = metaY + 44;

  // 3. Table Column Layout Helper
  const colX = [20, 42, 110, 270, 335, 380, 420, 460, 500, 540, 625, 710];
  const colW = [22, 68, 160, 65,  45,  40,  40,  40,  40,  85,  85,  92];

  const drawTableHeader = () => {
    const y = doc.y;
    doc.rect(20, y, 802, 16).fill('#0f172a');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7);
    const hTitles = ['#', 'LRN', "LEARNER'S NAME", 'BIRTHDATE', 'AGE', 'WT(kg)', 'HT(m)', 'HT²(m²)', 'BMI', 'BMI STATUS', 'HFA STATUS', 'REMARKS'];
    hTitles.forEach((title, idx) => {
      doc.text(title, colX[idx], y + 4, { width: colW[idx], align: idx === 1 || idx === 2 ? 'left' : 'center' });
    });
    doc.y = y + 16;
  };

  const drawLearnerRows = (title: string, learners: Sf8LearnerRow[], bannerColor: string) => {
    if (doc.y > 510) doc.addPage();
    const bannerY = doc.y;
    doc.rect(20, bannerY, 802, 14).fill(bannerColor);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5);
    doc.text(title, 26, bannerY + 3);
    doc.y = bannerY + 14;

    if (learners.length === 0) {
      const emptyY = doc.y;
      doc.rect(20, emptyY, 802, 14).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#64748b').font('Helvetica-Oblique').fontSize(7);
      doc.text('No learners enrolled in this category.', 20, emptyY + 4, { width: 802, align: 'center' });
      doc.y = emptyY + 14;
      return;
    }

    for (let i = 0; i < learners.length; i++) {
      if (doc.y > 540) {
        doc.addPage();
        drawTableHeader();
      }
      const l = learners[i];
      const m = period === 'EOSY' ? (l.eosy || l.bosy) : l.bosy;
      const rowY = doc.y;
      const rowH = 13;

      doc.rect(20, rowY, 802, rowH).fillAndStroke(i % 2 === 0 ? '#ffffff' : '#f8fafc', '#e2e8f0');
      doc.fillColor('#0f172a').font('Helvetica').fontSize(7);

      const fullName = `${l.lastName}, ${l.firstName}${l.middleName ? ' ' + l.middleName[0] + '.' : ''}`;
      // Completed whole years per DO 58, s. 2017
      const ageStr = m
        ? String(m.ageYears)
        : (l.unassessedAge ? String(l.unassessedAge.years) : '—');
      doc.text(String(l.rowNumber), colX[0], rowY + 3, { width: colW[0], align: 'center' });
      doc.font('Helvetica-Bold').text(l.lrn, colX[1], rowY + 3, { width: colW[1], align: 'left' });
      doc.font('Helvetica').text(fullName, colX[2], rowY + 3, { width: colW[2], align: 'left' });
      doc.text(l.birthDate || '—', colX[3], rowY + 3, { width: colW[3], align: 'center' });
      doc.text(ageStr, colX[4], rowY + 3, { width: colW[4], align: 'center' });
      doc.text(m ? m.weightKg.toFixed(1) : '—', colX[5], rowY + 3, { width: colW[5], align: 'center' });
      doc.text(m ? m.heightM.toFixed(2) : '—', colX[6], rowY + 3, { width: colW[6], align: 'center' });
      doc.text(m ? m.heightSquaredM2.toFixed(2) : '—', colX[7], rowY + 3, { width: colW[7], align: 'center' });
      doc.text(m ? m.bmi.toFixed(1) : '—', colX[8], rowY + 3, { width: colW[8], align: 'center' });
      
      const bmiStat = m ? m.nutritionalStatusBmi : 'Unassessed';
      doc.text(bmiStat, colX[9], rowY + 3, { width: colW[9], align: 'center' });

      const hfaStat = m ? m.heightForAgeStatus : 'Unassessed';
      doc.text(hfaStat, colX[10], rowY + 3, { width: colW[10], align: 'center' });

      doc.text(m ? (m.remarks || 'Screened') : 'Unmeasured', colX[11], rowY + 3, { width: colW[11], align: 'left' });

      doc.y = rowY + rowH;
    }
  };

  drawTableHeader();
  drawLearnerRows(
    `MALE LEARNERS (${report.learners.male.length} Enrolled | ${report.totalAssessed.male} Assessed | ${report.totalUnassessed.male} Pending)`,
    report.learners.male,
    '#1e3a8a'
  );
  drawLearnerRows(
    `FEMALE LEARNERS (${report.learners.female.length} Enrolled | ${report.totalAssessed.female} Assessed | ${report.totalUnassessed.female} Pending)`,
    report.learners.female,
    '#831843'
  );

  // 4. Summaries and Signatories
  if (doc.y > 450) doc.addPage();
  doc.moveDown(0.8);
  const sumY = doc.y;

  // BMI Summary Box (Left)
  doc.rect(20, sumY, 390, 68).fillAndStroke('#ffffff', '#cbd5e1');
  doc.rect(20, sumY, 390, 14).fill('#0f172a');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5).text('NUTRITIONAL STATUS (BMI-FOR-AGE)', 26, sumY + 3);

  const bmiRows = (period === 'EOSY' && report.summaryBmi.eosy) ? report.summaryBmi.eosy : report.summaryBmi.bosy;
  let curSumY = sumY + 16;
  doc.fillColor('#0f172a').font('Helvetica').fontSize(6.5);
  for (const r of bmiRows) {
    doc.text(`${r.category}: Male ${r.maleCount} (${r.malePercentage}%) | Female ${r.femaleCount} (${r.femalePercentage}%) | Total ${r.totalCount} (${r.totalPercentage}%)`, 26, curSumY);
    curSumY += 10;
  }

  // HFA Summary Box (Right)
  doc.rect(432, sumY, 390, 68).fillAndStroke('#ffffff', '#cbd5e1');
  doc.rect(432, sumY, 390, 14).fill('#0f172a');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5).text('HEIGHT-FOR-AGE (HFA / STUNTING STATUS)', 438, sumY + 3);

  const hfaRows = (period === 'EOSY' && report.summaryHfa.eosy) ? report.summaryHfa.eosy : report.summaryHfa.bosy;
  let curHfaY = sumY + 16;
  doc.fillColor('#0f172a').font('Helvetica').fontSize(6.5);
  for (const r of hfaRows) {
    doc.text(`${r.category}: Male ${r.maleCount} (${r.malePercentage}%) | Female ${r.femaleCount} (${r.femalePercentage}%) | Total ${r.totalCount} (${r.totalPercentage}%)`, 438, curHfaY);
    curHfaY += 10;
  }

  doc.y = sumY + 74;

  // Completeness indicator line
  doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(7);
  doc.text(`Enrolled: ${report.totalEnrolled.total} (M: ${report.totalEnrolled.male}, F: ${report.totalEnrolled.female})   •   Assessed: ${report.totalAssessed.total} (M: ${report.totalAssessed.male}, F: ${report.totalAssessed.female})   •   Unassessed: ${report.totalUnassessed.total} (M: ${report.totalUnassessed.male}, F: ${report.totalUnassessed.female})`, 26, doc.y);
  doc.moveDown(1);

  // Three Official SF8 Signatures: Conducted/Assessed By, Reviewed By, Certified Correct By
  const sigY = doc.y + 12;
  const bW = 240;

  // 1. Conducted / Assessed By
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
  doc.text(report.accountability.conductedByName || ' ', 30, sigY, { width: bW, align: 'center' });
  doc.rect(30, sigY + 10, bW, 0.5).stroke('#0f172a');
  doc.font('Helvetica').fontSize(7).fillColor('#475569');
  doc.text(report.accountability.conductedByRole, 30, sigY + 13, { width: bW, align: 'center' });
  doc.font('Helvetica-Oblique').fontSize(6).fillColor('#64748b');
  doc.text(report.accountability.conductedByName ? 'Conducted / Assessed By' : 'Conducted / Assessed By (Pending Verification)', 30, sigY + 22, { width: bW, align: 'center' });

  // 2. Reviewed By
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
  doc.text(report.accountability.reviewedByName || ' ', 300, sigY, { width: bW, align: 'center' });
  doc.rect(300, sigY + 10, bW, 0.5).stroke('#0f172a');
  doc.font('Helvetica').fontSize(7).fillColor('#475569');
  doc.text(report.accountability.reviewedByRole, 300, sigY + 13, { width: bW, align: 'center' });
  doc.font('Helvetica-Oblique').fontSize(6).fillColor('#64748b');
  doc.text('Reviewed By (Pending Designation)', 300, sigY + 22, { width: bW, align: 'center' });

  // 3. Certified Correct By
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
  doc.text(report.accountability.certifiedByName || ' ', 570, sigY, { width: bW, align: 'center' });
  doc.rect(570, sigY + 10, bW, 0.5).stroke('#0f172a');
  doc.font('Helvetica').fontSize(7).fillColor('#475569');
  doc.text(report.accountability.certifiedByRole, 570, sigY + 13, { width: bW, align: 'center' });
  doc.font('Helvetica-Oblique').fontSize(6).fillColor('#64748b');
  doc.text('Certified Correct By (Pending Designation)', 570, sigY + 22, { width: bW, align: 'center' });

  doc.fontSize(6.5).fillColor('#94a3b8').text(`${report.accountability.systemDisclaimer} • Generated: ${report.accountability.dateGenerated}`, 20, 565, { align: 'center' });

  doc.end();

  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const cleanSec = report.schoolInfo.sectionName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `DepEd_SF8_Grade${report.schoolInfo.gradeLevel}_${cleanSec}_${period}.pdf`;

  return { filename, buffer, report };
}
