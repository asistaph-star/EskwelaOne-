import { ExecutedToolResult } from '../orchestration/planExecutor.js';
import { PlanObligation } from '../orchestration/requestPlanner.js';
import { TurnTraceSpan } from './agentHarness.interface.js';

export interface ModelRoundRecord {
  round: number;
  content?: string;
  toolCallsRequested: Array<{ id: string; name: string; arguments: Record<string, any> }>;
  latencyMs: number;
}

/**
 * TurnState — Ephemeral Execution State for exactly One Agent Turn.
 * 
 * Formal Invariants:
 * 1. Fresh execution state per turn. Previous-turn tool results/structuredData never carry forward.
 * 2. Every tool call ID includes the turnId to prevent cross-turn ID collisions.
 * 3. Results with mismatched turn IDs fail closed.
 * 4. Tracks duplicate calls to prevent infinite loops.
 */
export class TurnState {
  public readonly turnId: string;
  public readonly sessionId: string;
  public readonly traceId: string;
  public readonly role: string;
  public readonly obligations: PlanObligation[];

  public modelRounds: ModelRoundRecord[] = [];
  public toolsRequested: string[] = [];
  public toolsExecuted: string[] = [];
  public executedResults: ExecutedToolResult[] = [];
  public duplicateToolCallsAvoided: number = 0;
  public finalModelContent?: string;
  public traceSpans: TurnTraceSpan[] = [];

  private signatureCounts: Map<string, number> = new Map();

  constructor(options: {
    turnId: string;
    sessionId: string;
    traceId: string;
    role: string;
    obligations: PlanObligation[];
  }) {
    this.turnId = options.turnId;
    this.sessionId = options.sessionId;
    this.traceId = options.traceId;
    this.role = options.role;
    this.obligations = options.obligations;
    this.addSpan('TURN_START', { status: 'STARTED' });
  }

  public addSpan(name: string, details?: { round?: number; toolName?: string; callId?: string; domain?: string; status?: string; durationMs?: number }): void {
    this.traceSpans.push({
      name,
      round: details?.round,
      toolName: details?.toolName,
      callId: details?.callId,
      domain: details?.domain,
      status: details?.status || 'OK',
      durationMs: details?.durationMs || 0,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Generates a normalized signature for a tool call to detect infinite duplicate loops.
   */
  public getToolCallSignature(name: string, args: Record<string, any>): string {
    const sortedArgs = JSON.stringify(args || {}, Object.keys(args || {}).sort());
    return `${name}:${sortedArgs}`;
  }

  /**
   * Checks if calling this tool would exceed duplicate threshold (max 2 identical calls).
   */
  public isDuplicateCallExceeded(name: string, args: Record<string, any>, maxDuplicates = 2): boolean {
    const sig = this.getToolCallSignature(name, args);
    const count = this.signatureCounts.get(sig) || 0;
    return count >= maxDuplicates;
  }

  /**
   * Generates a unique, turn-bound call ID.
   */
  public generateCallId(round: number, toolName: string, index: number): string {
    return `${this.turnId}_r${round}_${toolName}_${index}`;
  }

  /**
   * Validates that a tool result belongs to this current turn.
   */
  public validateTurnResult(callId: string): boolean {
    return typeof callId === 'string' && callId.startsWith(`${this.turnId}_`);
  }

  /**
   * Records a tool execution in the turn state.
   */
  public recordToolExecution(item: ExecutedToolResult): void {
    this.toolsRequested.push(item.name);
    if (item.success) {
      this.toolsExecuted.push(item.name);
    }
    this.executedResults.push(item);

    const sig = this.getToolCallSignature(item.name, item.args);
    this.signatureCounts.set(sig, (this.signatureCounts.get(sig) || 0) + 1);
  }

  /**
   * Finds previously grounded result for a duplicate call.
   */
  public findCachedResult(name: string, args: Record<string, any>): any | undefined {
    const sig = this.getToolCallSignature(name, args);
    const match = this.executedResults.find(r => r.name === name && r.success && this.getToolCallSignature(r.name, r.args) === sig);
    return match?.result;
  }
}
