import { apiClient } from './client';

export interface AuditLogItem {
  id: string;
  actor_user_id: string | null;
  actor_school_id: string | null;
  actor_role: string | null;
  action: string;
  category: string | null;
  resource_type: string;
  resource_id: string | null;
  target_label: string | null;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED' | string;
  ip_address: string | null;
  user_agent: string | null;
  previous_state: Record<string, any> | null;
  new_state: Record<string, any> | null;
  reason: string | null;
  correlation_id: string | null;
  created_at: string;
  actor?: {
    id: string;
    school_id: string;
    first_name: string;
    last_name: string;
    email?: string | null;
  } | null;
}

export interface PaginationData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuditSummary {
  eventsToday: number;
  failedAuthToday: number;
  denialsToday: number;
  adminChangesToday: number;
}

export interface AuditListResponse {
  items: AuditLogItem[];
  pagination: PaginationData;
  summary: AuditSummary;
}

export interface AuditQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  action?: string;
  result?: string;
  actorRole?: string;
  actorSchoolId?: string;
  startDate?: string;
  endDate?: string;
}

export const auditApi = {
  getAuditLogs: async (params: AuditQueryParams = {}): Promise<AuditListResponse> => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.pageSize) query.append('pageSize', String(params.pageSize));
    if (params.search) query.append('search', params.search);
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.action && params.action !== 'ALL') query.append('action', params.action);
    if (params.result && params.result !== 'ALL') query.append('result', params.result);
    if (params.actorRole && params.actorRole !== 'ALL') query.append('actorRole', params.actorRole);
    if (params.actorSchoolId) query.append('actorSchoolId', params.actorSchoolId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);

    const queryString = query.toString();
    const endpoint = `/admin/audit-logs${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<AuditListResponse>(endpoint);
  },

  getAuditLogById: async (id: string): Promise<AuditLogItem> => {
    return apiClient.get<AuditLogItem>(`/admin/audit-logs/${encodeURIComponent(id)}`);
  },

  exportCsvUrl: (params: AuditQueryParams = {}): string => {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.action && params.action !== 'ALL') query.append('action', params.action);
    if (params.result && params.result !== 'ALL') query.append('result', params.result);
    if (params.actorRole && params.actorRole !== 'ALL') query.append('actorRole', params.actorRole);
    if (params.actorSchoolId) query.append('actorSchoolId', params.actorSchoolId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);

    const queryString = query.toString();
    return `${API_BASE_URL}/admin/audit-logs/export/csv${queryString ? `?${queryString}` : ''}`;
  },
};
