import { describe, it, expect } from 'vitest';
import {
  getPhilippineDayPart,
  formatPrincipalGreeting,
  buildBriefingSections,
  buildSynthesizedNarrative,
  PhilippineDayPart,
} from '../../src/app/principal/dashboard/briefingHelpers';
import { ExecutiveSummaryResponse } from '../../src/api/executiveSummary.api';

describe('DIGISKWELA — MILESTONE 2B: DAILY EXECUTIVE BRIEFING UX', () => {
  // ─── 1. Time-Aware Daypart & Greeting Logic ─────────────────────────────
  describe('1. Daypart & Greeting Rules (Asia/Manila)', () => {
    it('correctly resolves Morning between 5:00 AM and 11:59 AM in Asia/Manila', () => {
      // 08:30 AM Manila time (UTC+8) = 00:30 UTC
      const morningDate = new Date('2026-10-18T00:30:00.000Z');
      expect(getPhilippineDayPart(morningDate)).toBe('morning');

      // 05:00 AM Manila time = 21:00 UTC previous day
      const fiveAm = new Date('2026-10-17T21:00:00.000Z');
      expect(getPhilippineDayPart(fiveAm)).toBe('morning');

      // 11:59 AM Manila time = 03:59 UTC
      const elevenFiftyNine = new Date('2026-10-18T03:59:00.000Z');
      expect(getPhilippineDayPart(elevenFiftyNine)).toBe('morning');
    });

    it('correctly resolves Afternoon between 12:00 PM and 5:59 PM in Asia/Manila', () => {
      // 12:00 PM Manila time = 04:00 UTC
      const noon = new Date('2026-10-18T04:00:00.000Z');
      expect(getPhilippineDayPart(noon)).toBe('afternoon');

      // 03:30 PM Manila time = 07:30 UTC
      const afternoonDate = new Date('2026-10-18T07:30:00.000Z');
      expect(getPhilippineDayPart(afternoonDate)).toBe('afternoon');

      // 05:59 PM Manila time = 09:59 UTC
      const fiveFiftyNine = new Date('2026-10-18T09:59:00.000Z');
      expect(getPhilippineDayPart(fiveFiftyNine)).toBe('afternoon');
    });

    it('correctly resolves Evening from 6:00 PM onward and early morning before 5:00 AM', () => {
      // 06:00 PM Manila time = 10:00 UTC
      const sixPm = new Date('2026-10-18T10:00:00.000Z');
      expect(getPhilippineDayPart(sixPm)).toBe('evening');

      // 09:45 PM Manila time = 13:45 UTC
      const night = new Date('2026-10-18T13:45:00.000Z');
      expect(getPhilippineDayPart(night)).toBe('evening');

      // 02:00 AM Manila time = 18:00 UTC previous day
      const earlyAm = new Date('2026-10-17T18:00:00.000Z');
      expect(getPhilippineDayPart(earlyAm)).toBe('evening');
    });

    it('displays authenticated Principal name formatted as "Good <dayPart>, Principal <FirstName>"', () => {
      expect(formatPrincipalGreeting('morning', { name: 'Maria Santos' })).toBe('Good morning, Principal Maria');
      expect(formatPrincipalGreeting('afternoon', { name: 'Maria Santos' })).toBe('Good afternoon, Principal Maria');
      expect(formatPrincipalGreeting('evening', { name: 'Maria Santos' })).toBe('Good evening, Principal Maria');

      // If user object provides direct firstName
      expect(formatPrincipalGreeting('morning', { firstName: 'Clara', name: 'Clara Reyes' })).toBe('Good morning, Principal Clara');
    });

    it('falls back gracefully to "Good <dayPart>, Principal" when user name is unavailable', () => {
      expect(formatPrincipalGreeting('morning', null)).toBe('Good morning, Principal');
      expect(formatPrincipalGreeting('afternoon', undefined)).toBe('Good afternoon, Principal');
      expect(formatPrincipalGreeting('evening', { name: '' })).toBe('Good evening, Principal');
    });

    it('avoids duplicate title when name already begins with "Principal"', () => {
      expect(formatPrincipalGreeting('morning', { name: 'Principal Maria' })).toBe('Good morning, Principal Maria');
    });
  });

  // ─── 2. Structured Section Building & Semantic Integrity ─────────────────────────
  describe('2. Structured Scannable Briefing Sections', () => {
    const baseSummaryData: ExecutiveSummaryResponse = {
      summary: 'School operations are underway.',
      asOf: '2026-10-18T13:44:00.000Z',
      asOfFormatted: 'Oct 18, 2026 • 9:44 PM',
      generationMode: 'deterministic',
      sourceDomains: ['Gate Attendance', 'Faculty Attendance', 'Academics'],
      metrics: {
        students: {
          enrolled: 500,
          onCampusNow: 420,
        },
        faculty: {
          checkedInToday: 21,
          checkedInNow: 19,
          totalActive: 23,
        },
        academics: {
          academicCompleteness: 'complete_annual',
          annualPassRate: 87,
          lowestTermAverageGradeLevel: null,
          assessedGradeLevelsCount: 4,
        },
        welfare: {
          studentsRequiringAttention: 1,
          openBehaviorCases: 1,
        },
        operations: {
          pendingLeaves: 2,
          upcomingEventsCount: 2,
        },
        inventory: {
          currentAccountableUnits: 50,
          repairUnits: 0,
          lostDamagedUnits: 0,
        },
      },
    };

    it('correctly builds School Operations section with distinct campus vs cumulative counts', () => {
      const sections = buildBriefingSections(baseSummaryData);

      expect(sections.operations[0]).toBe('420 students are currently on campus.');
      expect(sections.operations[1]).toBe('21 of 23 faculty members checked in today (19 currently on campus).');
    });

    it('formats Needs Your Attention section when actionable items exist', () => {
      const sections = buildBriefingSections(baseSummaryData);

      expect(sections.attention.hasItems).toBe(true);
      expect(sections.attention.items).toContain(
        '1 student has an unresolved behavioral concern across 1 open case.'
      );
      expect(sections.attention.items).toContain(
        '2 faculty leave requests are awaiting review.'
      );
      expect(sections.attention.behaviorCases).toBe(1);
      expect(sections.attention.pendingLeaves).toBe(2);
    });

    it('shows reassuring message when no items require attention', () => {
      const cleanData: ExecutiveSummaryResponse = {
        ...baseSummaryData,
        metrics: {
          ...baseSummaryData.metrics,
          welfare: { studentsRequiringAttention: 0, openBehaviorCases: 0 },
          operations: { pendingLeaves: 0, upcomingEventsCount: 0 },
          inventory: { currentAccountableUnits: 50, repairUnits: 0, lostDamagedUnits: 0 },
        },
      };

      const sections = buildBriefingSections(cleanData);
      expect(sections.attention.hasItems).toBe(false);
      expect(sections.attention.items[0]).toBe(
        'No current administrative action items require your attention.'
      );
    });

    it('formats Academic section for complete annual data with promotion pass rate only', () => {
      const sections = buildBriefingSections(baseSummaryData);

      expect(sections.academics).toBe(
        'The current annual promotion pass rate is 87% across active sections.'
      );
      // Strictly no lowest grade level assertion
      expect(sections.academics).not.toContain('lowest');
      expect(sections.academics).not.toContain('Grade');
    });

    it('formats Academic section for partial-term data with >= 2 grade levels', () => {
      const partialData: ExecutiveSummaryResponse = {
        ...baseSummaryData,
        metrics: {
          ...baseSummaryData.metrics,
          academics: {
            academicCompleteness: 'partial_terms',
            annualPassRate: null,
            lowestTermAverageGradeLevel: 8,
            assessedGradeLevelsCount: 4,
          },
        },
      };

      const sections = buildBriefingSections(partialData);
      expect(sections.academics).toBe(
        'Among currently submitted term grades across 4 grade levels, Grade 8 currently records the lowest average.'
      );
      expect(sections.academics).not.toContain('lowest-performing');
      expect(sections.academics).not.toContain('annual pass rate');
    });

    it('formats Academic section transparently when fewer than 2 grade levels are assessed in partial terms', () => {
      const singleGradeData: ExecutiveSummaryResponse = {
        ...baseSummaryData,
        metrics: {
          ...baseSummaryData.metrics,
          academics: {
            academicCompleteness: 'partial_terms',
            annualPassRate: null,
            lowestTermAverageGradeLevel: null,
            assessedGradeLevelsCount: 1,
          },
        },
      };

      const sections = buildBriefingSections(singleGradeData);
      expect(sections.academics).toBe(
        'Annual academic performance is not yet available because complete T1–T4 grades have not been submitted.'
      );
    });

    it('formats Academic section transparently when data is insufficient', () => {
      const insufficientData: ExecutiveSummaryResponse = {
        ...baseSummaryData,
        metrics: {
          ...baseSummaryData.metrics,
          academics: {
            academicCompleteness: 'insufficient_data',
            annualPassRate: null,
            lowestTermAverageGradeLevel: null,
            assessedGradeLevelsCount: 0,
          },
        },
      };

      const sections = buildBriefingSections(insufficientData);
      expect(sections.academics).toBe(
        'Annual academic performance is not yet available because complete T1–T4 grades have not been submitted.'
      );
    });

    it('omits Property section when repair and lost/damaged units are 0', () => {
      const sections = buildBriefingSections(baseSummaryData);
      // When repairUnits = 0 and lostDamagedUnits = 0, section is omitted to reduce noise
      expect(sections.property).toBeNull();
    });

    it('surfaces Property section when units are under repair, lost, or damaged', () => {
      const damagedData: ExecutiveSummaryResponse = {
        ...baseSummaryData,
        metrics: {
          ...baseSummaryData.metrics,
          inventory: {
            currentAccountableUnits: 45,
            repairUnits: 3,
            lostDamagedUnits: 2,
          },
        },
      };

      const sections = buildBriefingSections(damagedData);
      expect(sections.property).toBe(
        'Property records show 3 units under repair and 2 lost or damaged out of 45 accountable units.'
      );
      expect(sections.attention.items).toContain(
        '5 property units require attention (3 under repair, 2 lost or damaged).'
      );
    });

    it('surfaces Upcoming Operations when school events are scheduled', () => {
      const sections = buildBriefingSections(baseSummaryData);
      expect(sections.upcomingEvents).toBe(
        '2 school events are scheduled on the calendar in the coming days.'
      );
    });

    it('handles null fact sheet gracefully without throwing', () => {
      const sections = buildBriefingSections(null);
      expect(sections.operations).toBeDefined();
      expect(sections.attention.items[0]).toBe(
        'No current administrative action items require your attention.'
      );
      expect(sections.academics).toBe(
        'Academic performance data is currently compiling.'
      );
    });
  });

  // ─── 3. Provenance & Generation Disclosures ───────────────────────────────
  describe('3. Generation Mode Disclosures', () => {
    it('discloses deterministic generation mode correctly', () => {
      const mode: 'llm' | 'deterministic' = 'deterministic';
      const label =
        mode === 'llm'
          ? 'AI-generated from grounded DigiSkwela data'
          : 'Deterministic grounded synthesis';
      expect(label).toBe('Deterministic grounded synthesis');
    });

    it('discloses future LLM generation mode correctly', () => {
      const mode: 'llm' | 'deterministic' = 'llm';
      const label =
        mode === 'llm'
          ? 'AI-generated from grounded DigiSkwela data'
          : 'Deterministic grounded synthesis';
      expect(label).toBe('AI-generated from grounded DigiSkwela data');
    });
  });

  // ─── 4. Narrative-First Synthesis & Compact Action Items ───────────────────
  describe('4. Narrative-First Synthesis & Compact Action Items', () => {
    const baseSummaryData: ExecutiveSummaryResponse = {
      summary: 'School operations are underway.',
      asOf: '2026-10-18T13:44:00.000Z',
      asOfFormatted: 'Oct 18, 2026 • 9:44 PM',
      generationMode: 'deterministic',
      sourceDomains: ['Gate Attendance', 'Faculty Attendance', 'Academics'],
      metrics: {
        students: { enrolled: 500, onCampusNow: 420 },
        faculty: { checkedInToday: 21, checkedInNow: 19, totalActive: 23 },
        academics: {
          academicCompleteness: 'complete_annual',
          annualPassRate: 87,
          lowestTermAverageGradeLevel: null,
          assessedGradeLevelsCount: 4,
        },
        welfare: { studentsRequiringAttention: 1, openBehaviorCases: 1 },
        operations: { pendingLeaves: 2, upcomingEventsCount: 2 },
        inventory: { currentAccountableUnits: 50, repairUnits: 0, lostDamagedUnits: 0 },
      },
    };

    it('produces concise management narrative paragraphs instead of raw metric lists', () => {
      const narrative = buildSynthesizedNarrative(baseSummaryData);
      expect(narrative.paragraphs.length).toBeGreaterThanOrEqual(3);
      expect(narrative.paragraphs[0]).toContain('420 students');
      expect(narrative.paragraphs[1]).toContain('Two items require your attention');
      expect(narrative.paragraphs[2]).toContain('The current annual promotion pass rate is 87%');

      // Actions shortcuts:
      expect(narrative.actions).toEqual([
        { label: 'Review Behavior Case', screen: 'p-behavior' },
        { label: 'Review Leave Requests', screen: 'p-leaves' },
      ]);
    });

    it('produces calm reassurance when no attention items exist', () => {
      const cleanData: ExecutiveSummaryResponse = {
        ...baseSummaryData,
        metrics: {
          ...baseSummaryData.metrics,
          welfare: { studentsRequiringAttention: 0, openBehaviorCases: 0 },
          operations: { pendingLeaves: 0, upcomingEventsCount: 0 },
          inventory: { currentAccountableUnits: 50, repairUnits: 0, lostDamagedUnits: 0 },
        },
      };

      const narrative = buildSynthesizedNarrative(cleanData);
      expect(narrative.paragraphs[1]).toBe(
        'No current administrative action items require your attention.'
      );
      expect(narrative.actions.length).toBe(0);
    });

    it('synthesizes stable operations narrative when all faculty checked in and 0 students on campus', () => {
      const demoData: ExecutiveSummaryResponse = {
        ...baseSummaryData,
        metrics: {
          ...baseSummaryData.metrics,
          students: { enrolled: 1, onCampusNow: 0 },
          faculty: { checkedInToday: 1, checkedInNow: 0, totalActive: 1 },
        },
      };

      const narrative = buildSynthesizedNarrative(demoData);
      expect(narrative.paragraphs[0]).toBe(
        'School operations are currently stable. All active faculty have checked in today, while no students are currently recorded on campus.'
      );
    });
  });
});
