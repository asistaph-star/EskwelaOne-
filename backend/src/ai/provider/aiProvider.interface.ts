/**
 * DigiSkwela Provider-Independent AI Interface & Contracts
 * 
 * Defines vendor-agnostic abstraction for conversational reasoning
 * and structured tool selection.
 */

export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  role: AIMessageRole;
  content: string;
  toolCallId?: string;
  name?: string;
}

export interface AIToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: Record<string, any>;
  properties?: Record<string, any>;
}

export interface AIToolParametersSchema {
  type: 'object';
  properties: Record<string, AIToolParameterProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface AIToolDeclaration {
  id: string;
  name: string;
  description: string;
  parameters: AIToolParametersSchema;
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  tools?: AIToolDeclaration[];
  context?: {
    portal?: string;
    authenticatedRole?: string;
    allowedToolNames?: string[];
  };
}

export interface AITokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AICompletionResponse {
  message: AIMessage;
  toolCalls?: AIToolCall[];
  usage?: AITokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export type AIProviderErrorCode = 
  | 'RATE_LIMITED'
  | 'FREE_QUOTA_EXHAUSTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'PAID_PROVIDER_REJECTED'
  | 'UNKNOWN_ERROR';

export class AIProviderError extends Error {
  public readonly code: AIProviderErrorCode;
  public readonly isRetryable: boolean;

  constructor(code: AIProviderErrorCode, message: string, isRetryable = false) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

/**
 * Common Provider-Independent Interface.
 * Concrete implementations: MockAIProvider, future GroqProvider.
 */
export interface DigiSkwelaAIProvider {
  readonly name: string;
  readonly mode: 'mock' | 'groq' | 'disabled';
  
  /**
   * Generates conversational completion or tool selections.
   */
  generateResponse(request: AICompletionRequest): Promise<AICompletionResponse>;
}
