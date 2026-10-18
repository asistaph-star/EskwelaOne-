import { apiClient } from './client';

export type AcademicCompleteness = 'complete_annual' | 'partial_terms' | 'insufficient_data';

export interface ExecutiveSummaryMetrics {
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
}

export interface ExecutiveSummaryResponse {
  summary: string;
  asOf: string;
  asOfFormatted: string;
  generationMode: 'llm' | 'deterministic';
  sourceDomains: string[];
  metrics: ExecutiveSummaryMetrics;
}

export const executiveSummaryApi = {
  getSummary: (): Promise<ExecutiveSummaryResponse> => apiClient.get<ExecutiveSummaryResponse>('/principal/ai-summary'),
};
