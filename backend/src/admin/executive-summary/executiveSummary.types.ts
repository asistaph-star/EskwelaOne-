/**
 * Strongly typed facts and response model for DigiSkwela Principal Executive Summary.
 * 
 * Privacy & Grounding Guarantees:
 * - NO Clinic fields (no ClinicReferral, medical diagnoses, medications).
 * - NO Guidance fields (no GuidanceRecord, counseling notes, private sessions).
 * - NO predictive or speculative metrics.
 * - Missing or insufficient data remains strictly null.
 * - Clear semantic distinction between complete annual performance vs partial term submissions.
 */

export type AcademicCompleteness = 'complete_annual' | 'partial_terms' | 'insufficient_data';

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
    academicCompleteness: AcademicCompleteness;
    annualPassRate: number | null; // DepEd promotion pass rate based on complete T1-T4 ratings across all subjects
    termGradeAverages: { gradeLevel: number; average: number }[] | null; // Averages of submitted term grades
    lowestTermAverageGradeLevel: number | null; // Grade level with lowest average; ONLY populated if >= 2 grade levels assessed
    assessedGradeLevelsCount: number; // Number of grade levels with at least one submitted term grade
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
      academicCompleteness: AcademicCompleteness;
      annualPassRate: number | null;
      lowestTermAverageGradeLevel: number | null;
      assessedGradeLevelsCount: number;
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
