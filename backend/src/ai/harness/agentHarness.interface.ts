import { AIMessage, AIToolCall, AITokenUsage } from '../provider/aiProvider.interface.js';
import { AuthenticatedUser } from '../../common/middleware/auth.js';
import { 
  NormalizedStructuredData, 
  NormalizedProvenance, 
  NormalizedNavigationAction 
} from '../ai.service.js';
import { OperationalDomainName } from '../orchestration/domainCatalog.js';

export interface AgentTurnInput {
  sessionId?: string;
  turnId?: string;
  traceId?: string;
  messages: AIMessage[];
  portal: string;
  authUser: AuthenticatedUser;
  correlationId?: string;
  provider?: any;
}

export interface ObligationMetricSummary {
  obligationsTotal: number;
  domainObligationsTotal: number;
  operationObligationsTotal: number;
  satisfiedCount: number;
  satisfiedDomainCount: number;
  satisfiedOperationCount: number;
  remediedCount: number;
  unmetCount: number;
  completionState: 'COMPLETE' | 'PARTIAL' | 'FAILED';
}

export interface TurnTraceSpan {
  name: string;
  round?: number;
  toolName?: string;
  callId?: string;
  domain?: string;
  status?: string;
  durationMs: number;
  timestamp: string;
}

export interface AgentTurnResult {
  sessionId: string;
  turnId: string;
  traceId: string;
  message: AIMessage;
  responseType: 'text' | 'structured';
  structuredData?: NormalizedStructuredData;
  provenance?: NormalizedProvenance;
  navigationActions?: NormalizedNavigationAction[];
  toolsExecuted: string[];
  scopeDecision: string;
  completion?: ObligationMetricSummary;
  traceSpans?: TurnTraceSpan[];
  origin?: 'STATIC_UI' | 'LOCAL_APPLICATION' | 'AI_PROVIDER' | 'ERROR_FALLBACK';
}
