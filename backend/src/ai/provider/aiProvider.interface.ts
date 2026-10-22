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
  toolCalls?: AIToolCall[];
}

export interface AIToolParameterProperty {
  type?: string | string[];
  description?: string;
  enum?: string[];
  items?: Record<string, any>;
  properties?: Record<string, any>;
  anyOf?: Array<Record<string, any>>;
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
  neurons?: number;
}

export interface AIFailoverMetadata {
  occurred: boolean;
  primaryProvider: string;
  finalProvider: string;
  reason?: string;
  model?: string;
}

export interface AICompletionResponse {
  message: AIMessage;
  toolCalls?: AIToolCall[];
  usage?: AITokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  failoverMetadata?: AIFailoverMetadata;
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

export type AIProviderMode = 'mock' | 'groq' | 'cloudflare' | 'groq_cloudflare' | 'chatgpt_plan' | 'disabled';

/**
 * Common Provider-Independent Interface.
 * Concrete implementations: MockAIProvider, GroqAIProvider, CloudflareAIProvider, FailoverAIProvider.
 */
export interface DigiSkwelaAIProvider {
  readonly name: string;
  readonly mode: AIProviderMode;
  readonly model?: string;
  
  /**
   * Generates conversational completion or tool selections.
   */
  generateResponse(request: AICompletionRequest): Promise<AICompletionResponse>;
}

