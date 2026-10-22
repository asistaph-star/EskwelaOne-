import { apiClient } from './client.js';

export interface AIMessagePayload {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AIChatRequest {
  messages: AIMessagePayload[];
  portal?: string;
  turnId?: string;
  sessionId?: string;
  conversationId?: string;
}

export interface AIChatResponse {
  turnId?: string;
  sessionId?: string;
  message: {
    role: 'assistant';
    content: string;
  };
  responseType?: 'text' | 'structured';
  structuredData?: {
    type: 'fact_sheet' | 'attendance' | 'leaves' | 'events' | 'behavior' | 'academics' | 'meeting_brief' | 'weekly_report' | 'generic';
    raw: any;
    provenance?: {
      sourceDomains: string[];
      asOf?: string;
    };
  };
  provenance?: {
    sourceDomains: string[];
    asOf?: string;
  };
  navigationActions?: Array<{
    label: string;
    screen: string;
    description?: string;
  }>;
  traceId: string;
  scopeDecision: string;
  toolsExecuted: string[];
}

export interface EphemeralSessionMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  responseType?: 'text' | 'structured';
  structuredData?: any;
  provenance?: any;
  navigationActions?: any;
  traceId?: string;
}

export interface EphemeralSessionData {
  id: string;
  portal: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  messages: EphemeralSessionMessageData[];
}

/**
 * Client service for DigiSkwela Conversational AI Assistant.
 * Connects directly to backend POST /api/ai/chat and session continuity endpoints.
 * All RBAC, permissions, and tool executions are server-enforced.
 */
export const aiApi = {
  chat: async (request: AIChatRequest): Promise<AIChatResponse> => {
    return apiClient.post<AIChatResponse>('/ai/chat', request);
  },

  getSession: async (params?: { portal?: string; conversationId?: string }): Promise<{ session: EphemeralSessionData | null }> => {
    const query = new URLSearchParams();
    if (params?.portal) query.set('portal', params.portal);
    if (params?.conversationId) query.set('conversationId', params.conversationId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<{ session: EphemeralSessionData | null }>(`/ai/session${qs}`);
  },

  clearSession: async (params?: { portal?: string }): Promise<{ success: boolean; message: string }> => {
    const portal = params?.portal || 'General';
    return apiClient.delete<{ success: boolean; message: string }>(`/ai/session?portal=${encodeURIComponent(portal)}`);
  },
};
