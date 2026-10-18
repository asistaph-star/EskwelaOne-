import { apiClient } from './client';

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
