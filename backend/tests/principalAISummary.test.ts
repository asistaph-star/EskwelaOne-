import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';
import { buildSchoolFactSheet } from '../src/admin/executive-summary/factSheet.service';
import { ExecutiveSummarySynthesizer } from '../src/admin/executive-summary/synthesizer.service';
import { SchoolFactSheet } from '../src/admin/executive-summary/executiveSummary.types';

const prisma = new PrismaClient();

describe('DIGISKWELA — MILESTONE 2: PRINCIPAL AI EXECUTIVE SUMMARY', () => {
  let principalToken: string;
  let principalUserId: string;

  let studentToken: string;
  let studentUserId: string;

  let nurseToken: string;
  let nurseUserId: string;

  beforeAll(async () => {
    // 1. Create clean test users for RBAC testing
    principalUserId = generateId();
    studentUserId = generateId();
    nurseUserId = generateId();

    const pUser = await prisma.user.create({
      data: {
        id: principalUserId,
        email: `prin_ai_test_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Maria',
        last_name: 'Santos',
        status: 'active',
      },
    });

    const principalRole = await prisma.role.findUnique({ where: { name: 'Principal' } });
    if (principalRole) {
      await prisma.userRole.create({
        data: { user_id: principalUserId, role_id: principalRole.id },
      });
    }

    const sUser = await prisma.user.create({
      data: {
        id: studentUserId,
        email: `stud_ai_test_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Pedro',
        last_name: 'Penduko',
        status: 'active',
      },
    });

    const studentRole = await prisma.role.findUnique({ where: { name: 'Student' } });
    if (studentRole) {
      await prisma.userRole.create({
        data: { user_id: studentUserId, role_id: studentRole.id },
      });
    }

    const nUser = await prisma.user.create({
      data: {
        id: nurseUserId,
        email: `nurse_ai_test_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Clara',
        last_name: 'Reyes',
        status: 'active',
      },
    });

    const nurseRole = await prisma.role.findUnique({ where: { name: 'Nurse' } });
    if (nurseRole) {
      await prisma.userRole.create({
        data: { user_id: nurseUserId, role_id: nurseRole.id },
      });
    }

    // Sign tokens using { userId }
    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '1h' });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });
    nurseToken = sign({ userId: nurseUserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    try {
      await prisma.userRole.deleteMany({
        where: { user_id: { in: [principalUserId, studentUserId, nurseUserId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [principalUserId, studentUserId, nurseUserId] } },
      });
    } catch (_err) {}
    await prisma.$disconnect();
  });

  // ─── 1. Fact Sheet Grounding & PostgreSQL Integrity ─────────────────────────────
  describe('1. SchoolFactSheet Data Grounding', () => {
    it('should build a typed fact sheet reflecting live PostgreSQL state without throwing', async () => {
      const facts = await buildSchoolFactSheet();
      expect(facts).toBeDefined();
      expect(typeof facts.asOf).toBe('string');
      expect(typeof facts.asOfFormatted).toBe('string');
      expect(facts.students).toHaveProperty('enrolled');
      expect(facts.students).toHaveProperty('onCampusNow');
      expect(facts.faculty).toHaveProperty('checkedInToday');
      expect(facts.academics).toHaveProperty('annualPassRate');
      expect(facts.academics).toHaveProperty('lowestTermAverageGradeLevel');
      expect(facts.academics).toHaveProperty('academicCompleteness');
      expect(facts.welfare).toHaveProperty('openBehaviorCases');
      expect(facts.operations).toHaveProperty('pendingLeaves');
      expect(facts.inventory).toHaveProperty('currentAccountableUnits');
      expect(facts.inventory).toHaveProperty('repairUnits');
    });

    it('must NEVER expose Clinic or Guidance confidential fields in SchoolFactSheet', async () => {
      const facts: any = await buildSchoolFactSheet();
      
      // Prohibited private medical / counseling keys
      expect(facts.clinic).toBeUndefined();
      expect(facts.clinicReferrals).toBeUndefined();
      expect(facts.medical).toBeUndefined();
      expect(facts.diagnoses).toBeUndefined();
      expect(facts.medication).toBeUndefined();

      expect(facts.guidance).toBeUndefined();
      expect(facts.counseling).toBeUndefined();
      expect(facts.counselorNotes).toBeUndefined();
      expect(facts.counselingSessions).toBeUndefined();
    });
  });

  // ─── 2. Deterministic Synthesis & Hallucination Defense ──────────────────────────
  describe('2. Grounded Synthesis & Hallucination Defense', () => {
    const synthesizer = new ExecutiveSummarySynthesizer();

    it('contains ONLY supplied numbers from a known test fact sheet (Zero Invented Values)', () => {
      const testFacts: SchoolFactSheet = {
        asOf: '2026-10-18T12:00:00.000Z',
        asOfFormatted: 'Oct 18, 2026 • 8:00 PM',
        students: {
          enrolled: 100,
          onCampusNow: 75,
        },
        faculty: {
          checkedInNow: 10,
          checkedInToday: 10,
          timedOutToday: 0,
          totalActive: 12,
        },
        academics: {
          academicCompleteness: 'insufficient_data',
          annualPassRate: null, // Null should remain omitted
          termGradeAverages: null,
          lowestTermAverageGradeLevel: null,
          assessedGradeLevelsCount: 0,
        },
        welfare: {
          studentsRequiringAttention: 2,
          openBehaviorCases: 2,
        },
        operations: {
          pendingLeaves: 1,
          upcomingEventsCount: 0,
          nextUpcomingEvents: [],
        },
        inventory: {
          currentAccountableUnits: 10,
          repairUnits: 3,
          borrowedUnits: 0,
          lostDamagedUnits: 0,
          retiredDisposedUnits: 0,
        },
      };

      const summary = synthesizer.synthesizeDeterministic(testFacts);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(20);

      // Extract all numbers appearing in the output text
      const numbersInText = (summary.match(/\b\d+\b/g) || []).map(Number);

      // Every single number in the text MUST belong to the known fact sheet
      const allowedNumbers = new Set([75, 10, 12, 2, 1, 3, 0]);
      for (const num of numbersInText) {
        expect(allowedNumbers.has(num)).toBe(true);
      }

      // Explicitly check that null pass rate is NOT converted to 0% or fake score
      expect(summary).not.toContain('%');
      expect(summary).not.toContain('0%');
      expect(summary).not.toContain('pass rate');
    });

    it('strictly omits academic statements when academic metrics are null', () => {
      const factsWithNullAcademic: SchoolFactSheet = {
        asOf: '2026-10-18T12:00:00.000Z',
        asOfFormatted: 'Oct 18, 2026 • 8:00 PM',
        students: { enrolled: 50, onCampusNow: 40 },
        faculty: { checkedInNow: 5, checkedInToday: 5, timedOutToday: 0, totalActive: 5 },
        academics: {
          academicCompleteness: 'insufficient_data',
          annualPassRate: null,
          termGradeAverages: null,
          lowestTermAverageGradeLevel: null,
          assessedGradeLevelsCount: 0,
        },
        welfare: { studentsRequiringAttention: 0, openBehaviorCases: 0 },
        operations: { pendingLeaves: 0, upcomingEventsCount: 0, nextUpcomingEvents: [] },
        inventory: { currentAccountableUnits: 5, repairUnits: 0, borrowedUnits: 0, lostDamagedUnits: 0, retiredDisposedUnits: 0 },
      };

      const summary = synthesizer.synthesizeDeterministic(factsWithNullAcademic);
      expect(summary).not.toMatch(/pass rate/i);
      expect(summary).not.toMatch(/grade-level average/i);
      expect(summary).not.toContain('%');
    });

    it('partial-term fact cannot produce annual-general-average or promotion wording', () => {
      const factsWithPartialTerms: SchoolFactSheet = {
        asOf: '2026-10-18T12:00:00.000Z',
        asOfFormatted: 'Oct 18, 2026 • 8:00 PM',
        students: { enrolled: 200, onCampusNow: 150 },
        faculty: { checkedInNow: 20, checkedInToday: 20, timedOutToday: 0, totalActive: 22 },
        academics: {
          academicCompleteness: 'partial_terms',
          annualPassRate: null, // Quarters 2-4 pending
          termGradeAverages: [{ gradeLevel: 7, average: 85 }, { gradeLevel: 8, average: 78 }],
          lowestTermAverageGradeLevel: 8,
          assessedGradeLevelsCount: 2,
        },
        welfare: { studentsRequiringAttention: 0, openBehaviorCases: 0 },
        operations: { pendingLeaves: 0, upcomingEventsCount: 0, nextUpcomingEvents: [] },
        inventory: { currentAccountableUnits: 30, repairUnits: 0, borrowedUnits: 0, lostDamagedUnits: 0, retiredDisposedUnits: 0 },
      };

      const summary = synthesizer.synthesizeDeterministic(factsWithPartialTerms);
      // Strictly term wording only
      expect(summary).toContain('Among currently submitted term grades across 2 grade levels, Grade 8 currently records the lowest average.');
      // Proves: partial-term fact cannot produce annual-general-average wording
      expect(summary).not.toContain('lowest general average');
      expect(summary).not.toContain('lowest-performing');
      expect(summary).not.toContain('annual');
      expect(summary).not.toContain('promotion');
      expect(summary).not.toContain('pass rate');
    });

    it('accurately reports annual promotion pass rate without implying a lowest annual grade level', () => {
      const factsWithCompleteAnnual: SchoolFactSheet = {
        asOf: '2026-10-18T12:00:00.000Z',
        asOfFormatted: 'Oct 18, 2026 • 8:00 PM',
        students: { enrolled: 200, onCampusNow: 150 },
        faculty: { checkedInNow: 20, checkedInToday: 20, timedOutToday: 0, totalActive: 22 },
        academics: {
          academicCompleteness: 'complete_annual',
          annualPassRate: 88,
          termGradeAverages: [{ gradeLevel: 7, average: 88 }, { gradeLevel: 8, average: 82 }],
          lowestTermAverageGradeLevel: 8,
          assessedGradeLevelsCount: 2,
        },
        welfare: { studentsRequiringAttention: 0, openBehaviorCases: 0 },
        operations: { pendingLeaves: 0, upcomingEventsCount: 0, nextUpcomingEvents: [] },
        inventory: { currentAccountableUnits: 30, repairUnits: 0, borrowedUnits: 0, lostDamagedUnits: 0, retiredDisposedUnits: 0 },
      };

      const summary = synthesizer.synthesizeDeterministic(factsWithCompleteAnnual);
      expect(summary).toContain('Academic performance reflects an overall annual promotion pass rate of 88%.');
      // Proves: annual pass rate does NOT automatically imply a lowest annual grade level
      expect(summary).not.toContain('lowest general average');
      expect(summary).not.toContain('lowest');
      expect(summary).not.toContain('Grade 8');
    });

    it('does NOT make comparative lowest claims when only 1 single grade level has grades', () => {
      const singleGradeLevelFacts: SchoolFactSheet = {
        asOf: '2026-10-18T12:00:00.000Z',
        asOfFormatted: 'Oct 18, 2026 • 8:00 PM',
        students: { enrolled: 50, onCampusNow: 30 },
        faculty: { checkedInNow: 5, checkedInToday: 5, timedOutToday: 0, totalActive: 5 },
        academics: {
          academicCompleteness: 'partial_terms',
          annualPassRate: null,
          termGradeAverages: [{ gradeLevel: 10, average: 85 }],
          lowestTermAverageGradeLevel: null, // Single grade level cannot be "the lowest"
          assessedGradeLevelsCount: 1,
        },
        welfare: { studentsRequiringAttention: 0, openBehaviorCases: 0 },
        operations: { pendingLeaves: 0, upcomingEventsCount: 0, nextUpcomingEvents: [] },
        inventory: { currentAccountableUnits: 5, repairUnits: 0, borrowedUnits: 0, lostDamagedUnits: 0, retiredDisposedUnits: 0 },
      };

      const summary = synthesizer.synthesizeDeterministic(singleGradeLevelFacts);
      expect(summary).not.toContain('lowest');
      expect(summary).not.toContain('lowest-performing');
    });

    it('NEVER introduces predictive or speculative claims', () => {
      const testFacts: SchoolFactSheet = {
        asOf: '2026-10-18T12:00:00.000Z',
        asOfFormatted: 'Oct 18, 2026 • 8:00 PM',
        students: { enrolled: 100, onCampusNow: 50 },
        faculty: { checkedInNow: 5, checkedInToday: 5, timedOutToday: 0, totalActive: 10 },
        academics: {
          academicCompleteness: 'complete_annual',
          annualPassRate: 75,
          termGradeAverages: null,
          lowestTermAverageGradeLevel: 9,
          assessedGradeLevelsCount: 2,
        },
        welfare: { studentsRequiringAttention: 3, openBehaviorCases: 4 },
        operations: { pendingLeaves: 2, upcomingEventsCount: 1, nextUpcomingEvents: ['PTA Assembly'] },
        inventory: { currentAccountableUnits: 20, repairUnits: 2, borrowedUnits: 1, lostDamagedUnits: 1, retiredDisposedUnits: 0 },
      };

      const summary = synthesizer.synthesizeDeterministic(testFacts);

      // Speculative & predictive keywords forbidden
      const forbiddenTerms = [
        'will',
        'may decrease',
        'likely',
        'forecast',
        'predicted',
        'at risk tomorrow',
        'expect',
        'probably',
        'projected',
      ];

      for (const term of forbiddenTerms) {
        expect(summary.toLowerCase()).not.toContain(term);
      }
    });

    it('NEVER introduces fake student names, teacher names, medical claims, or legacy branding', () => {
      const testFacts: SchoolFactSheet = {
        asOf: '2026-10-18T12:00:00.000Z',
        asOfFormatted: 'Oct 18, 2026 • 8:00 PM',
        students: { enrolled: 100, onCampusNow: 50 },
        faculty: { checkedInNow: 5, checkedInToday: 5, timedOutToday: 0, totalActive: 10 },
        academics: { passRate: 85, gradeLevelPerformance: null, lowestPerformingGrade: null },
        welfare: { studentsRequiringAttention: 1, openBehaviorCases: 1 },
        operations: { pendingLeaves: 1, upcomingEventsCount: 0, nextUpcomingEvents: [] },
        inventory: { currentAccountableUnits: 10, repairUnits: 0, borrowedUnits: 0, lostDamagedUnits: 0, retiredDisposedUnits: 0 },
      };

      const summary = synthesizer.synthesizeDeterministic(testFacts);

      // Hallucinated names or terms
      expect(summary).not.toMatch(/Juan|Maria|Espino|Hernandez|Bondoc/);
      expect(summary).not.toMatch(/fever|clinic|diagnos|counseling|counselor/i);
      expect(summary).not.toContain('Asyntai');
    });
  });

  // ─── 3. Endpoint Access Control & RBAC ──────────────────────────────────────────
  describe('3. API Endpoint & Leadership Access Control', () => {
    it('allows Principal access via GET /api/principal/ai-summary with 200 OK', async () => {
      const res = await request(app)
        .get('/api/principal/ai-summary')
        .set('Authorization', `Bearer ${principalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.summary).toBe('string');
      expect(res.body.data.generationMode).toBe('deterministic');
      expect(Array.isArray(res.body.data.sourceDomains)).toBe(true);
      expect(res.body.data.sourceDomains).toContain('Gate Attendance');
      expect(res.body.data.sourceDomains).toContain('Academics');
      expect(res.body.data.sourceDomains).toContain('Behavior & Welfare');
    });

    it('allows Principal access via GET /api/admin/ai-summary with 200 OK (alias)', async () => {
      const res = await request(app)
        .get('/api/admin/ai-summary')
        .set('Authorization', `Bearer ${principalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
    });

    it('rejects unauthorized Student with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/principal/ai-summary')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthorized Nurse (without oversight permissions) with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/principal/ai-summary')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/principal/ai-summary');
      expect(res.status).toBe(401);
    });

    it('discloses generationMode transparently as "deterministic" in baseline dev', async () => {
      const res = await request(app)
        .get('/api/principal/ai-summary')
        .set('Authorization', `Bearer ${principalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.generationMode).toBe('deterministic');
    });
  });
});
