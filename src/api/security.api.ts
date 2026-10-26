import { apiClient } from './client';

export type SecurityTimeWindow = '24h' | '7d';

export interface SecurityOverviewData {
  timeWindow: SecurityTimeWindow;
  windowStart: string;
  windowEnd: string;
  scope: 'FULL_ITADMIN' | 'OPERATIONAL_ADMIN';
  kpis: {
    failedLogins: number | null;
    rateLimits: number | null;
    authDenials: number | null;
    passwordResets: number;
    statusChanges: number;
  };
  accountStatus: {
    totalAccounts: number;
    activeAccounts: number;
    inactiveAccounts: number;
    passwordChangeRequired: number;
  };
  recentEvents: Array<{
    id: string;
    created_at: string;
    action: string;
    category: string | null;
    actor_school_id: string | null;
    actor_role: string | null;
    target_label: string | null;
    result: string;
    ip_address: string | null;
    resource_type: string;
    correlation_id: string | null;
  }>;
}

export const securityApi = {
  getOverview: async (timeWindow: SecurityTimeWindow = '24h'): Promise<SecurityOverviewData> => {
    return apiClient.get<SecurityOverviewData>(`/admin/security-overview?timeWindow=${timeWindow}`);
  },
};
