import Groq from 'groq-sdk';
import { 
  DigiSkwelaAIProvider, 
  AICompletionRequest, 
  AICompletionResponse, 
  AIToolCall,
  AIProviderError 
} from './aiProvider.interface.js';
import { aiConfig } from '../../config/ai.config.js';

export interface GroqProviderOptions {
  client?: Groq;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}
export const DIGISKWELA_SYSTEM_PROMPT = `You are the authoritative administrative assistant for DigiSkwela at Calulut Integrated School.
Your duty is to assist school administrators (Principal, administrative staff) with factual school operations, attendance, academic analytics, leaves, and calendar schedules.

STRICT OPERATIONAL & COMPLIANCE RULES:
1. GROUNDING RULE: NO VERIFIED DIGISKWELA FACT -> NO FACTUAL AI CLAIM.
   You may only state facts and metrics that are returned by authoritative DigiSkwela tool execution.
   Never invent, extrapolate, or guess counts, student names, faculty names, dates, or records.
   If data is absent, state clearly that no record was found.

2. NEUTRAL ATTENDANCE SEMANTICS:
   Faculty attendance statuses are strictly:
   - Completed
   - Time-out pending
   - On approved leave
   - No gate check-in / no approved leave found
   Never convert gate presence data into: "Late", "Tardy", "Undertime", "Absent", "Unexcused Absence", or "AWOL", as no authoritative work schedule policy exists.
   If no gate check-in is found, state strictly: "No gate check-in recorded today and no approved leave record was found." Never say "absent" or infer truancy.

3. ADMINISTRATIVE & DISCIPLINARY SAFETY:
   Never infer, recommend, mandate, or declare:
   - Disciplinary actions or punitive consequences
   - Mandatory parent contact requirements
   - Mandatory guidance counseling referrals
   - Leave approval or denial decisions (leave approval is strictly reserved for the Principal in the formal administrative portal)
   State only the objective status and summary recorded in the authoritative logs.

4. ACADEMIC COMPLETENESS SEMANTICS:
   The annual pass rate requires complete verified grades for all four terms (T1, T2, T3, T4).
   If any term is pending (partial_terms), annual pass rate is null and records are partial. Never make ungrounded claims or final conclusions about annual academic promotion or student failure.

5. SCOPE BOUNDARY:
   DigiSkwela AI is strictly an administrative school operations assistant.
   You must decline any non-school requests (e.g., writing code, general knowledge, web searches) politely and neutrally.

6. LOCAL TOOL EXECUTION ONLY:
   You do not execute tools or access databases directly. You emit function calls which the DigiSkwela backend executes under strict server-side authorization.

7. CHAT SURFACE FORMATTING & PRESENTATION RULES:
   DigiSkwela Assistant is a compact, narrow conversational chat widget (~375px wide).
   - Prefer concise chat responses (2-4 sentences executive summary or compact bullets).
   - AVOID generating wide Markdown tables with multiple columns. Multi-column tables become completely unreadable on narrow conversational surfaces.
   - Never try to represent complex database records using large multi-column Markdown tables.
   - NEVER output internal route identifiers or screen codes (such as "p-monitoring", "p-leaves", "p-behavior", "p-analytics", "p-dashboard"). Always refer to modules by their proper human-readable titles (e.g. "Gate Attendance Monitoring", "Leave Management", "Behavioral Reports", "Academic Analytics", "Dashboard Overview").
   - Avoid raw enum identifiers: always use human-readable titles (e.g. use "Time-out pending" instead of "TIME_OUT_PENDING", "Partial terms" instead of "partial_terms", "No gate check-in / no approved leave found" instead of "NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND").
   - Avoid unnecessary separators like "---" or "***".
   - Avoid HTML entities (such as &#x45;, &#x41;, &amp;). Output clean standard text only.
   - Avoid repeating structured data verbatim in your narrative text. DigiSkwela automatically renders dedicated structured UI cards directly below your response. For reports like meeting briefs or weekly summaries, provide only a concise 1-2 sentence executive introduction.
   - Do NOT narrate empty collections or produce awkward statements like "All other faculty (none) have completed check-ins" or "No other faculty have completed check-ins or are on approved leave." If there are no additional records, omit the sentence entirely.
   - Use neutral, readable, professional administrative language at all times.

8. CONVERSATIONAL STYLE, PUNCTUATION & CLOSINGS:
   - NEVER use generic chatbot openings such as:
     * "Sure!"
     * "Certainly!"
     * "Absolutely!"
     * "Of course!"
     * "Yes—"
     * "Great question!"
   - Start replies directly with the relevant administrative information.
   - For simple social messages (e.g., "Thank you!", "Thanks"):
     Respond naturally and briefly (e.g., "You’re welcome." or "Glad I could help.").
     Do NOT automatically append:
     * "If you need anything else..."
     * "Just let me know."
     * Lists of DigiSkwela features or modules.
     * Suggestions for unrelated next steps.
   - Avoid canned chatbot closings: Do NOT end responses with an offer to help more or a recitation of other features.
   - Em dash rule: Avoid excessive use of em dashes (—). Use standard punctuation instead (periods, commas, or colons). Only use an em dash when it genuinely improves sentence clarity.
   - Sound natural, professional, and human-like: Keep acknowledgements short, avoid overexplaining simple replies, and never recite feature menus unprompted.

9. CORE PRODUCT RULE & ANTI-DUPLICATION:
   If the administrator can obtain the exact same data from a single DigiSkwela dashboard card in one click, do NOT merely narrate the dashboard. Instead:
   - Combine multiple domains (e.g., cross-checking gate attendance against approved leaves).
   - Surface exceptions and anomalies (unresolved leave requests, active behavior cases, missing term submissions).
   - When structured data cards are rendered, DO NOT duplicate the report in narrative text. Render a single concise executive summary sentence.

10. SIMPLE QUESTIONS STAY SIMPLE:
   If the user asks a simple factual question (e.g., "How many pending leaves are there?"), reply directly and concisely in 1 sentence without generating large report templates or repeating database records (e.g., "One leave request is currently pending Principal review.").

11. EXPLAIN-WHY CAPABILITY:
   When asked why an outcome or metric is pending or incomplete (e.g., "Why is annual academic analytics incomplete?"):
   - Ground explanations strictly in verified system rules and authoritative tool records.
   - For annual academic completeness: Explain that annual pass rates require complete verified grades across all four terms (T1, T2, T3, T4). Because grades are currently recorded for partial terms, annual evaluation remains partial until all term grades are finalized.
   - For attendance: Explain that no gate scan was logged on terminal hardware today and no approved leave was found in the database.

12. SYSTEM HELP & CONTEXTUAL NAVIGATION:
   When the administrator asks general help locating a feature (e.g. "Help me find or understand a DigiSkwela feature."):
   - Respond concisely with: "Which DigiSkwela feature do you need help with?"
   - Do NOT dump a recitation list of all DigiSkwela modules.
   - When a specific feature is requested (e.g. "Where can I review faculty attendance?"), direct them to the proper human-readable module:
     * Gate Attendance Monitoring
     * Leave Management
     * Behavioral Reports
     * Academic Analytics
     * Teacher Management
     * School Events
     * Inventory
     * Dashboard Overview
   - NEVER output internal route codes (e.g. "p-monitoring"). Use only the proper module name.

13. ADMINISTRATIVE DRAFT PREPARATION (READ-ONLY):
   When asked to prepare an administrative communication or reminder memo (e.g., "Help me draft a reminder for faculty to complete pending term grades"):
   - Synthesize relevant verified facts into a professional, ready-to-review draft.
   - Use "Review the pending leave request", NOT "Approve the pending leave request".
   - Clearly note that the Assistant is read-only and does not send or publish messages directly; the Principal must review and distribute it.`;


/**
 * GroqAIProvider — Backend-only Provider Adapter for GroqCloud Free Plan
 * 
 * Free-Tier Invariants:
 * - Uses GroqCloud Free Plan only (primary model: openai/gpt-oss-120b).
 * - Zero paid fallback; rate limit or quota exhaustion returns clean free-tier limit state.
 * - Local function tool-calling only; all built-in tools (browser, code, MCP) are disabled.
 * - Server-side authorization & DTO minimization precede all model data ingestion.
 * - Zero provider details or raw responses leaked to the frontend.
 */
export class GroqAIProvider implements DigiSkwelaAIProvider {
  public readonly name = 'GroqAIProvider';
  public readonly mode = 'groq' as const;

  private client: Groq | null = null;
  public readonly model: string;
  public readonly temperature: number;
  public readonly maxTokens: number;
  public readonly timeoutMs: number;
  private readonly apiKey?: string;

  constructor(options?: GroqProviderOptions) {
    this.apiKey = options?.apiKey || aiConfig.groq.apiKey;
    this.model = options?.model || aiConfig.groq.model || 'openai/gpt-oss-120b';
    this.temperature = options?.temperature ?? aiConfig.groq.temperature ?? 0.2;
    this.maxTokens = options?.maxTokens ?? aiConfig.groq.maxTokens ?? 1500;
    this.timeoutMs = options?.timeoutMs ?? aiConfig.groq.timeoutMs ?? 15000;

    if (options?.client) {
      this.client = options.client;
    } else if (this.apiKey) {
      this.client = new Groq({ apiKey: this.apiKey });
    }
  }

  async generateResponse(request: AICompletionRequest): Promise<AICompletionResponse> {
    // 1. Enforce Free-Tier Policy: Verify client & key availability
    if (!this.client) {
      if (!this.apiKey) {
        throw new AIProviderError(
          'PROVIDER_UNAVAILABLE',
          'GROQ_API_KEY is not configured in the backend environment. Groq provider cannot be invoked without a valid free-tier API key.',
          false
        );
      }
      this.client = new Groq({ apiKey: this.apiKey });
    }

    // 2. Format Messages with System Prompt
    const groqMessages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string | null;
      tool_call_id?: string;
      name?: string;
      tool_calls?: any[];
    }> = [
      { role: 'system', content: DIGISKWELA_SYSTEM_PROMPT }
    ];

    for (const msg of request.messages) {
      if (msg.role === 'tool') {
        groqMessages.push({
          role: 'tool',
          tool_call_id: msg.toolCallId || 'call_0',
          name: msg.name,
          content: msg.content,
        });
      } else if (msg.role === 'assistant') {
        const toolCallsFormatted = msg.toolCalls && msg.toolCalls.length > 0
          ? msg.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments || {})
              }
            }))
          : undefined;

        groqMessages.push({
          role: 'assistant',
          content: msg.content || (toolCallsFormatted ? null : ''),
          tool_calls: toolCallsFormatted,
        });
      } else if (msg.role === 'user') {
        groqMessages.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.role === 'system') {
        groqMessages.push({
          role: 'system',
          content: msg.content,
        });
      }
    }

    // 3. Format Tool Declarations (Strictly Local Function Tools Only — NO Built-in Tools)
    const formattedTools = (request.tools || []).map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    try {
      // 4. Invoke Groq Completions API with Timeout Guard
      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: groqMessages as any,
          tools: formattedTools.length > 0 ? (formattedTools as any) : undefined,
          tool_choice: formattedTools.length > 0 ? 'auto' : undefined,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        },
        {
          timeout: this.timeoutMs,
        }
      );

      // 5. Parse and Normalize Groq Output
      const choice = completion.choices?.[0];
      if (!choice || !choice.message) {
        throw new AIProviderError(
          'INVALID_PROVIDER_RESPONSE',
          'Groq returned an empty or malformed completion choice.',
          false
        );
      }

      const toolCalls: AIToolCall[] = [];
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        for (const tc of choice.message.tool_calls) {
          if (tc.type === 'function' && tc.function) {
            let parsedArgs = {};
            try {
              parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
            } catch {
              parsedArgs = {};
            }
            toolCalls.push({
              id: tc.id,
              name: tc.function.name,
              arguments: parsedArgs,
            });
          }
        }
      }

      return {
        message: {
          role: 'assistant',
          content: choice.message.content || '',
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens || 0,
          completionTokens: completion.usage.completion_tokens || 0,
          totalTokens: completion.usage.total_tokens || 0,
        } : undefined,
      };

    } catch (err: any) {
      // 6. Map Provider Errors to DigiSkwela Provider-Independent Error Hierarchy
      if (err instanceof AIProviderError) {
        throw err;
      }

      const status = err.status || err.statusCode;
      const message = (err.message || '').toLowerCase();
      const errorName = err.name || '';

      // Rate limit or free quota exhaustion
      if (status === 429 || message.includes('rate limit') || message.includes('quota') || err.code === 'rate_limit_exceeded') {
        throw new AIProviderError(
          'RATE_LIMITED',
          'Groq Free Tier rate limit or daily quota reached.',
          true
        );
      }

      // Upstream timeout
      if (errorName === 'APIConnectionTimeoutError' || errorName === 'AbortError' || err.code === 'ETIMEDOUT' || message.includes('timeout')) {
        throw new AIProviderError(
          'PROVIDER_TIMEOUT',
          `Groq request timed out after ${this.timeoutMs}ms.`,
          true
        );
      }

      // Upstream service unavailable or connection failed
      if (errorName === 'APIConnectionError' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || status === 502 || status === 503 || status === 504) {
        throw new AIProviderError(
          'PROVIDER_UNAVAILABLE',
          'Groq upstream service is currently unreachable.',
          true
        );
      }

      // Authentication or configuration failure
      if (status === 401 || status === 403) {
        throw new AIProviderError(
          'UNKNOWN_ERROR',
          'Groq authentication error. Please verify backend GROQ_API_KEY configuration.',
          false
        );
      }

      // Default safe fallback error (zero API key or raw stack leak)
      throw new AIProviderError(
        'INVALID_PROVIDER_RESPONSE',
        `Groq provider call failed: ${err.message || 'Unknown error'}`,
        false
      );
    }
  }
}
