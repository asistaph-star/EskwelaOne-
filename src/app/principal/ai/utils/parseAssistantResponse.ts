import { PrincipalAIMessage, SafeNavAction } from '../types.js';
import { AIChatResponse } from '../../../../api/ai.api.js';

export interface NormalizedAssistantResponse {
  displayText: string;
  responseType: 'text' | 'structured';
  structuredData?: PrincipalAIMessage['structuredData'];
  provenance?: PrincipalAIMessage['provenance'];
  navigationActions?: SafeNavAction[];
}

/**
 * Normalized DigiSkwela Assistant Response Mapper.
 * 
 * Invariants:
 * - 100% Provider-Agnostic: Zero provider-specific coupling or logic.
 * - Consumes the authoritative backend-normalized response contract directly.
 * - Performs ZERO JSON scraping or string manipulation on assistant narrative text.
 * - Works identically across all current and future model providers.
 */
export function normalizeAssistantResponse(response: AIChatResponse): NormalizedAssistantResponse {
  const displayText = response.message?.content || '';
  const responseType = response.responseType || (response.structuredData ? 'structured' : 'text');
  const structuredData = response.structuredData;
  const provenance = response.provenance || structuredData?.provenance;
  const navigationActions = response.navigationActions as SafeNavAction[] | undefined;

  return {
    displayText,
    responseType,
    structuredData,
    provenance,
    navigationActions,
  };
}

/**
 * Provider-agnostic adapter function.
 * Does NOT scrape serialized JSON from narrative text.
 */
export function parseAssistantResponse(
  contentOrResponse: string | AIChatResponse,
  _toolsExecuted: string[] = []
): NormalizedAssistantResponse {
  if (typeof contentOrResponse === 'object' && contentOrResponse !== null) {
    return normalizeAssistantResponse(contentOrResponse);
  }

  return {
    displayText: typeof contentOrResponse === 'string' ? contentOrResponse : '',
    responseType: 'text',
  };
}
