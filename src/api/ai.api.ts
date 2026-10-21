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
}

export interface AIChatResponse {
  message: {
    role: 'assistant';
    content: string;
  };
  traceId: string;
  scopeDecision: string;
  toolsExecuted: string[];
}

/**
 * Client service for DigiSkwela Conversational AI Assistant.
 * Connects directly to backend POST /api/ai/chat.
 * All RBAC, permissions, and tool executions are server-enforced.
 */
export const aiApi = {
  chat: async (request: AIChatRequest): Promise<AIChatResponse> => {
    return apiClient.post<AIChatResponse>('/ai/chat', request);
  }
};
