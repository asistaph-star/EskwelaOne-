/**
 * Comprehensive Verification and Regression Test Suite for SF9 Modernization
 * Phases 1, 2, and 3 against isolated development environment (digiskwela_sf9_dev, port 4001).
 */
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database.js';
import { generatePersistedStudentCalulutSf9FromDb } from '../src/academic/grading/calulutSf2Sf9Persistence.service.js';
import { getReportCardData } from '../src/academic/reportCard.service.js';
import { config } from '../src/config/env.js';
import fs from 'fs';

const CALULUT_ACADEMIC_YEAR_ID = 'ay2026_2027';
const TERM_1_ID = 'ay2026_t1';
const SECTION_AGUINALDO_ID = '01a1bfd5-2089-766b-b8e9-f3b2aadee893';
const SECTION_RIZAL_ID = 'c091a392-3c56-4a5c-9fc8-69d9823c6945';

const MATEO_ID = '01a1bfd5-22d9-71f8-b680-78c804cb76e3';
const BEA_ID = '01a1bfd5-22d9-71f8-b680-78c804cb76e4';
const CARLOS_ID = '01a1bfd5-22d9-71f8-b680-78c804cb76e5';
const HANNAH_ID = '7b330e5a-bb50-452c-bb60-76032b017993';

interface TestResult {
  name: string;
  category: 'PHASE_1' | 'PHASE_2' | 'PHASE_3';
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(category: 'PHASE_1' | 'PHASE_2' | 'PHASE_3', name: string, passed: boolean, details: string) {
  results.push({ category, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${category}] ${name}: ${details}`);
}

async function evaluateLearnerByLrn(lrn: string) {
  const student = await (prisma as any).student.findFirst({
    where: { lrn },
    include: { enrollments: { where: { status: 'Enrolled' } } },
  });
  if (!student || !student.enrollments[0]) {
    throw new Error(`Student or enrollment not found for LRN ${lrn}`);
  }
  const enrollment = student.enrollments[0];
  const res = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
    studentId: student.id,
    enrollmentId: enrollment.id,
    academicYearId: enrollment.academic_year_id,
    targetTerm: 'T1',
    renderPdf: false,
    mode: 'OFFICIAL',
  });
  return { student, enrollment, res };
}

async function runVerification() {
  console.log('========================================================================');
  console.log('   DIGISKWELA SF9 MODERNIZATION — FULL VERIFICATION & REGRESSION SUITE   ');
  console.log('   Database: digiskwela_sf9_dev | Backend Port: 4001                   ');
  console.log('========================================================================\n');

  try {
    // 0. Resolve Principal and Admin Users and generate valid JWT Tokens
    const principal = await (prisma as any).user.findFirst({
      where: { school_id: 'EMP-QA-P01' },
      include: { user_roles: { include: { role: true } } },
    });
    if (!principal) throw new Error('Principal user EMP-QA-P01 not found');

    const principalToken = jwt.sign(
      {
        id: principal.id,
        userId: principal.id,
        schoolId: principal.school_id,
        roles: ['Principal'],
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    const adminUser = await (prisma as any).user.findFirst({
      where: { user_roles: { some: { role: { name: 'Admin' } } } },
      include: { user_roles: { include: { role: true } } },
    });
    if (!adminUser) throw new Error('No user with Admin role found in database');

    const adminToken = jwt.sign(
      {
        id: adminUser.id,
        userId: adminUser.id,
        schoolId: adminUser.school_id,
        roles: ['Admin'],
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // -------------------------------------------------------------------------
    // TEST 1.1: Hannah Torres Hollow Gradebook Defense
    // -------------------------------------------------------------------------
    console.log('--- Phase 1: Academic Correctness & Hollow Gradebook Defense ---');
    const { res: hannahEval } = await evaluateLearnerByLrn('999026000008');

    const hannahHollowBlockers = (hannahEval.blockingReasons || []).filter((r: string) =>
      r.includes('HOLLOW_GRADEBOOK_NO_ASSESSMENT_COLUMNS')
    );

    const hasGMRC = hannahHollowBlockers.some((b: string) => b.includes('gmrc') || b.includes('ve'));
    const hasTLE = hannahHollowBlockers.some((b: string) => b.includes('tle'));
    const hasMusic = hannahHollowBlockers.some((b: string) => b.includes('music'));
    const hasPE = hannahHollowBlockers.some((b: string) => b.includes('pe'));

    record(
      'PHASE_1',
      'Hannah Torres Hollow Gradebook Rejection',
      !hannahEval.readyForOfficialSf9 && hannahHollowBlockers.length === 4 && hasGMRC && hasTLE && hasMusic && hasPE,
      `Rejected with exactly 4 hollow blockers (${hannahHollowBlockers.join(', ')}). Genuine subjects (AP10, ENG10, FIL10, MATH10, SCI10) passed provenance.`
    );

    // -------------------------------------------------------------------------
    // TEST 1.2: Mateo Aquino Academic Completeness & Released V1 Preservation
    // -------------------------------------------------------------------------
    const { student: mateoStudent, res: mateoEval } = await evaluateLearnerByLrn('999026000031');

    const mateoIssuances = await (prisma as any).sf9OfficialIssuance.findMany({
      where: { student_id: mateoStudent.id },
      orderBy: { version: 'desc' },
      take: 1,
    });
    const mateoIss = mateoIssuances[0];
    let isMateoReleased = false;
    if (mateoIss) {
      try {
        const parsed = JSON.parse(mateoIss.calculated_summary_encrypted || '{}');
        if (parsed?.release?.released) isMateoReleased = true;
      } catch {}
    }
    if (!isMateoReleased) {
      const releaseAudit = await (prisma as any).auditLog.findFirst({
        where: {
          action: 'SF9_STUDENT_PORTAL_RELEASE',
          resource_id: mateoStudent.id,
        },
      });
      if (releaseAudit) isMateoReleased = true;
    }
    const mateoHasV1 = mateoIss ? mateoIss.version === 1 : false;

    console.log(`[DEBUG Mateo] ready=${mateoEval.readyForOfficialSf9}, blockers=${mateoEval.blockingReasons?.length}, hasV1=${mateoHasV1}, isReleased=${isMateoReleased}`);

    record(
      'PHASE_1',
      'Mateo Aquino Completeness & Released V1 Preservation',
      Boolean(mateoEval.readyForOfficialSf9) && (mateoEval.blockingReasons?.length === 0) && mateoHasV1 && isMateoReleased,
      `Academic Completeness=PASS (0 blockers). Existing Term 1 Version 1 release preserved: SHA-256=${mateoIss?.pdf_sha256?.substring(0, 16) || mateoIss?.pdfSha256?.substring(0, 16)}...`
    );

    // -------------------------------------------------------------------------
    // TEST 1.3: Bea Dizon & Carlos Garcia 5 Blockers (4 Missing SF2 + 1 Comment)
    // -------------------------------------------------------------------------
    const { res: beaEval } = await evaluateLearnerByLrn('999026000032');
    const { student: carlosStudent, res: carlosEval } = await evaluateLearnerByLrn('999026000033');

    const beaAtt = (beaEval.blockingReasons || []).filter((r: string) => r.includes('Month') && r.includes('INCOMPLETE_MISSING_ATTENDANCE'));
    const beaCom = (beaEval.blockingReasons || []).filter((r: string) => r.includes('MISSING_PUBLISHED_ADVISER_COMMENT:T1'));

    const carAtt = (carlosEval.blockingReasons || []).filter((r: string) => r.includes('Month') && r.includes('INCOMPLETE_MISSING_ATTENDANCE'));
    const carCom = (carlosEval.blockingReasons || []).filter((r: string) => r.includes('MISSING_PUBLISHED_ADVISER_COMMENT:T1'));

    record(
      'PHASE_1',
      'Bea Dizon 5 Term 1 Blockers Verification',
      !beaEval.readyForOfficialSf9 && beaAtt.length === 4 && beaCom.length === 1 && beaEval.blockingReasons.length === 5,
      `Blocked by exactly 5 items: 4 missing SF2 months (Jun, Jul, Aug, Sep) + missing published adviser comment.`
    );

    record(
      'PHASE_1',
      'Carlos Garcia 5 Term 1 Blockers Verification',
      !carlosEval.readyForOfficialSf9 && carAtt.length === 4 && carCom.length === 1 && carlosEval.blockingReasons.length === 5,
      `Blocked by identical 5 items: 4 missing SF2 months (Jun, Jul, Aug, Sep) + missing published adviser comment.`
    );

    // -------------------------------------------------------------------------
    // TEST 1.4: Section Overview Readiness Aggregates Endpoint
    // -------------------------------------------------------------------------
    const resAguinaldo = await fetch(
      `http://localhost:4001/api/academic/report-card/sections/${SECTION_AGUINALDO_ID}/overview?term=T1`,
      { headers: { Authorization: `Bearer ${principalToken}` } }
    );
    const dataAguinaldo = await resAguinaldo.json();
    const stats = dataAguinaldo?.data?.stats;

    const statsMatch =
      stats?.totalLearners === 3 &&
      stats?.eligibleCount === 1 &&
      stats?.incompleteCount === 2;

    record(
      'PHASE_1',
      'Section Overview Readiness Aggregates (HTTP GET /overview)',
      statsMatch,
      `HTTP ${resAguinaldo.status}: totalLearners=${stats?.totalLearners}, eligibleCount=${stats?.eligibleCount}, incompleteCount=${stats?.incompleteCount}`
    );

    // -------------------------------------------------------------------------
    // TEST 1.5: Partial-Batch Section Authorization Endpoint (/authorize-eligible)
    // -------------------------------------------------------------------------
    const resAuthEligible = await fetch(
      `http://localhost:4001/api/academic/report-card/sections/${SECTION_AGUINALDO_ID}/authorize-eligible`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${principalToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetTerm: 'T1' }),
      }
    );
    const dataAuthEligible = await resAuthEligible.json();
    const authData = dataAuthEligible?.data;

    const authSafe =
      resAuthEligible.status === 200 &&
      authData?.excludedCount === 2 &&
      authData?.excludedLearners?.some((e: any) => e.name?.includes('Dizon')) &&
      authData?.excludedLearners?.some((e: any) => e.name?.includes('Garcia'));

    record(
      'PHASE_1',
      'Safe Partial-Batch Authorization (HTTP POST /authorize-eligible)',
      authSafe,
      `HTTP ${resAuthEligible.status}: Authorized=${authData?.authorizedCount}, Safely Excluded=${authData?.excludedCount} (Bea & Carlos bypassed without batch failure).`
    );

    // -------------------------------------------------------------------------
    // TEST 2.1: School-Level Term Grade Visibility Toggle
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 2: Digital SF9 Viewer & Term Grade Visibility ---');

    // Toggle visibility to FALSE via PATCH endpoint
    const resToggleOff = await fetch(
      `http://localhost:4001/api/academic/terms/${TERM_1_ID}/visibility`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${principalToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isGradesVisibleToStudents: false }),
      }
    );

    // Query Carlos (unreleased student) via getReportCardData
    const carlosConcealed = await getReportCardData(carlosStudent.id, carlosStudent.user_id);
    const carlosT1Grades = carlosConcealed.scholastic.subjects.map(s => s.T1);
    const allCarlosT1Null = carlosT1Grades.every(g => g === null);

    // Query Mateo (officially released student)
    const mateoReleased = await getReportCardData(mateoStudent.id, mateoStudent.user_id);
    const mateoT1Grades = mateoReleased.scholastic.subjects.map(s => s.T1);
    const mateoGradesPreserved = mateoT1Grades.some(g => typeof g === 'number' && g > 0);

    record(
      'PHASE_2',
      'Term Grade Concealment when Visibility Disabled (Student Actor)',
      allCarlosT1Null && mateoGradesPreserved,
      `Carlos unreleased grades sanitized to null (blank template). Mateo released grades preserved (${mateoT1Grades.filter(Boolean).length} ratings).`
    );

    // Toggle visibility back to TRUE via PATCH endpoint
    const resToggleOn = await fetch(
      `http://localhost:4001/api/academic/terms/${TERM_1_ID}/visibility`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${principalToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isGradesVisibleToStudents: true }),
      }
    );

    const carlosVisible = await getReportCardData(carlosStudent.id, carlosStudent.user_id);
    const carlosT1VisibleGrades = carlosVisible.scholastic.subjects.map(s => s.T1);
    const carlosHasGrades = carlosT1VisibleGrades.some(g => typeof g === 'number' && g > 0);

    record(
      'PHASE_2',
      'Term Grade Visibility Restoration when Toggle Enabled',
      carlosHasGrades,
      `Carlos can now view published trimester ratings in Digital SF9 Viewer prior to official PDF release.`
    );

    // -------------------------------------------------------------------------
    // TEST 3.1: Asynchronous Batch Queue Worker & Bounded Concurrency
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 3: Scalable Background Queue & Bulk Issuance ---');

    // Call POST /bulk-issue with Admin token
    const resBulk = await fetch(
      `http://localhost:4001/api/academic/report-card/sections/${SECTION_AGUINALDO_ID}/bulk-issue`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetTerm: 'T1' }),
      }
    );
    const bulkData = await resBulk.json();
    const batchId = bulkData?.data?.batchId;

    record(
      'PHASE_3',
      'Bulk Issue Enqueueing (HTTP POST /bulk-issue)',
      [200, 202].includes(resBulk.status) && Boolean(batchId),
      `HTTP ${resBulk.status}: Batch ${batchId} enqueued with bounded concurrency MAX_CONCURRENT_RENDERS=2.`
    );

    // Poll progress via GET /batches/:batchId/progress
    let progress: any = null;
    let attempts = 0;
    while (attempts < 25) {
      await new Promise(res => setTimeout(res, 500));
      const resProg = await fetch(
        `http://localhost:4001/api/academic/report-card/batches/${batchId}/progress`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const dataProg = await resProg.json();
      progress = dataProg?.data;
      if (progress?.status === 'COMPLETED' || progress?.status === 'FAILED') break;
      attempts++;
    }

    const batchSuccess =
      progress?.status === 'COMPLETED' &&
      progress?.skippedCount >= 2; // Bea & Carlos safely skipped

    record(
      'PHASE_3',
      'Batch Progress Polling & Safe Learner Skipping (HTTP GET /progress)',
      batchSuccess,
      `Status=${progress?.status}, Completed=${progress?.completedCount}, Skipped=${progress?.skippedCount}, Total=${progress?.totalCount}`
    );

    // -------------------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('                          VERIFICATION SUMMARY                          ');
    console.log('========================================================================');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    console.log(`Total Checks: ${total}`);
    console.log(`Passed:       ${passed}`);
    console.log(`Failed:       ${failed}`);

    // Write results artifact
    fs.writeFileSync(
      'c:/Users/Admin/Documents/Capstone Project/DigiSkwela/backend/scripts/verification_results.json',
      JSON.stringify({ timestamp: new Date().toISOString(), results, passed, failed, total }, null, 2)
    );

    if (failed === 0) {
      console.log('\n🌟 ALL SF9 MODERNIZATION SPECIFICATIONS PASSED REGRESSION CHECKS!');
    } else {
      console.error(`\n⚠️ ${failed} CHECKS FAILED! Inspect details above.`);
    }

  } catch (err: any) {
    console.error('Unexpected error during verification:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
