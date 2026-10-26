import { apiClient } from './client';

export type HealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'UNAVAILABLE' | 'NOT_CONFIGURED' | 'NOT_MONITORED';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  lastChecked: string;
  message: string;
  latencyMs?: number;
  details?: string;
}

export interface SystemHealthData {
  status: 'OPERATIONAL' | 'DEGRADED' | 'UNAVAILABLE';
  lastChecked: string;
  scope: 'FULL_ITADMIN' | 'OPERATIONAL_ADMIN';
  application: {
    name: string;
    version: string;
    environment: string;
    uptimeSeconds: number;
  };
  components: {
    api: ComponentHealth;
    database: ComponentHealth;
    storage: ComponentHealth;
    gateEventService: ComponentHealth;
    aiService: ComponentHealth;
    emailService: ComponentHealth;
  };
}

export const healthApi = {
  getSystemHealth: async (): Promise<SystemHealthData> => {
    return apiClient.get<SystemHealthData>('/admin/system-health');
  },
};
