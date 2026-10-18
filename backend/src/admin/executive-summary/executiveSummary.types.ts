/**
 * Strongly typed facts and response model for DigiSkwela Principal Executive Summary.
 * 
 * Privacy & Grounding Guarantees:
 * - NO Clinic fields (no ClinicReferral, medical diagnoses, medications).
 * - NO Guidance fields (no GuidanceRecord, counseling notes, private sessions).
 * - NO predictive or speculative metrics.
 * - Missing or insufficient data remains strictly null.
 */

export interface SchoolFactSheet {
  asOf: string; // ISO 8601 string
  asOfFormatted: string; // e.g. "Oct 18, 2026 • 8:50 PM" in Asia/Manila

  students: {
    enrolled: number | null;
    onCampusNow: number | null;
  };

  faculty: {
    checkedInNow: number | null; // Currently on campus (timeOutPendingCount)
    checkedInToday: number | null; // Total checked in today (checkedInCount)
    timedOutToday: number | null; // Completed departure (completedCount)
    totalActive: number | null; // Active faculty denominator
  };

  academics: {
    passRate: number | null; // Overall academic pass rate % (or null if grades missing)
    gradeLevelPerformance: { gradeLevel: number; average: number }[] | null;
    lowestPerformingGrade: number | null; // Grade level with lowest average, or null
  };

  welfare: {
    studentsRequiringAttention: number; // Distinct students with active disciplinary concerns
    openBehaviorCases: number; // Active behavior logs (Reported / Under investigation / Parent notified)
  };

  operations: {
    pendingLeaves: number; // Teacher leaves awaiting Principal review
    upcomingEventsCount: number; // School calendar events upcoming today and onward
    nextUpcomingEvents: string[]; // Titles of next upcoming events (up to 3)
  };

  inventory: {
    currentAccountableUnits: number; // Active accountable pool: Good + Repair + Borrowed + Lost + Damaged
    repairUnits: number;
    borrowedUnits: number;
    lostDamagedUnits: number; // Lost + Damaged
    retiredDisposedUnits: number; // Retired + Disposed (historical property records)
  };
}

export interface ExecutiveSummaryResponse {
  summary: string;
  asOf: string;
  asOfFormatted: string;
  generationMode: 'llm' | 'deterministic';
  sourceDomains: string[];
  metrics: {
    students: {
      enrolled: number | null;
      onCampusNow: number | null;
    };
    faculty: {
      checkedInToday: number | null;
      checkedInNow: number | null;
      totalActive: number | null;
    };
    academics: {
      passRate: number | null;
      lowestPerformingGrade: number | null;
    };
    welfare: {
      studentsRequiringAttention: number;
      openBehaviorCases: number;
    };
    operations: {
      pendingLeaves: number;
      upcomingEventsCount: number;
    };
    inventory: {
      currentAccountableUnits: number;
      repairUnits: number;
      lostDamagedUnits: number;
    };
  };
}
