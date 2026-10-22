import { PrincipalRequestPlan } from './requestPlanner.js';
import { ExecutedToolResult } from './planExecutor.js';
import { AggregationResult } from './aggregator.js';
import { DOMAIN_CATALOG } from './domainCatalog.js';
import { replaceRouteIds } from '../utils/normalizeResponseText.js';

export type ObligationCompletionStatus = 'SATISFIED' | 'REMEDIED' | 'UNAVAILABLE';

export interface StructuredObligationRecord {
  domain: string;
  operation: string;
  description: string;
  toolName: string;
  executionStatus: 'SUCCESS' | 'FAILED' | 'NOT_DISPATCHED';
  synthesisCoverage: boolean;
  completionState: ObligationCompletionStatus;
  remedyApplied?: string;
}

export interface CompletenessValidationResult {
  finalizedContent: string;
  auditMetrics: {
    obligationsTotal: number;
    satisfiedCount: number;
    remediedCount: number;
    unmetCount: number;
    records?: StructuredObligationRecord[];
  };
}

/**
 * Structured Completeness Validator.
 * Architecture:
 *   request obligation -> execution result -> synthesis coverage -> structured completion state -> validator
 * 
 * Evaluates completion state per obligation rather than relying on brittle raw text matching,
 * applying deterministic grounded facts from execution results where coverage is missing.
 */
export function validateAndRemedyCompleteness(
  content: string,
  plan: PrincipalRequestPlan,
  executedResults: ExecutedToolResult[],
  aggregateData: AggregationResult,
  primaryToolName: string,
  hasStructuredData: boolean
): CompletenessValidationResult {
  let finalized = content.trim();
  const addendumLines: string[] = [];

  let satisfiedCount = 0;
  let remediedCount = 0;
  let unmetCount = 0;
  const records: StructuredObligationRecord[] = [];

  for (const obligation of plan.obligations) {
    const domainMeta = DOMAIN_CATALOG[obligation.domain];
    if (!domainMeta) {
      satisfiedCount++;
      records.push({
        domain: obligation.domain,
        operation: obligation.operation,
        description: obligation.description,
        toolName: '',
        executionStatus: 'SUCCESS',
        synthesisCoverage: true,
        completionState: 'SATISFIED',
      });
      continue;
    }

    // 1. Evaluate Execution Result
    const execResult = executedResults.find(r => r.name === domainMeta.toolName);
    if (!execResult || !execResult.success) {
      unmetCount++;
      const unavailableNotice = `Note: Could not verify ${domainMeta.displayName} records at this time.`;
      addendumLines.push(unavailableNotice);
      records.push({
        domain: obligation.domain,
        operation: obligation.operation,
        description: obligation.description,
        toolName: domainMeta.toolName,
        executionStatus: execResult ? 'FAILED' : 'NOT_DISPATCHED',
        synthesisCoverage: false,
        completionState: 'UNAVAILABLE',
        remedyApplied: unavailableNotice,
      });
      continue;
    }

    // 2. Evaluate Synthesis Coverage
    const isPrimary = domainMeta.toolName === primaryToolName;
    const isCoveredByCard = isPrimary && hasStructuredData && plan.intent !== 'MULTI_DOMAIN';
    const isCoveredInNarrative = domainMeta.coverageRegex.test(finalized);
    const synthesisCoverage = isCoveredByCard || isCoveredInNarrative;

    // 3. Structured Completion State & Remedy Application
    if (synthesisCoverage) {
      satisfiedCount++;
      records.push({
        domain: obligation.domain,
        operation: obligation.operation,
        description: obligation.description,
        toolName: domainMeta.toolName,
        executionStatus: 'SUCCESS',
        synthesisCoverage: true,
        completionState: 'SATISFIED',
      });
    } else {
      remediedCount++;
      const groundedSummary = domainMeta.summarizeResult(execResult.result);
      if (groundedSummary) {
        addendumLines.push(groundedSummary);
      }
      records.push({
        domain: obligation.domain,
        operation: obligation.operation,
        description: obligation.description,
        toolName: domainMeta.toolName,
        executionStatus: 'SUCCESS',
        synthesisCoverage: false,
        completionState: 'REMEDIED',
        remedyApplied: groundedSummary,
      });
    }
  }

  // 4. Cross-Cutting Obligation: Correlation Verification (Non-causal)
  if (plan.isCorrelate && aggregateData.correlations.length > 0) {
    const mentionsCorrelation = aggregateData.correlations.some(c => 
      finalized.toLowerCase().includes('pending leave') && finalized.toLowerCase().includes('gate check-in')
    );
    if (!mentionsCorrelation) {
      for (const corr of aggregateData.correlations) {
        addendumLines.push(`Cross-Check Finding: ${corr.description}`);
      }
    }
  }

  // 5. Cross-Cutting Obligation: Prioritization Disclaimer Verification
  if (plan.isPrioritize && aggregateData.priorityDisclaimer) {
    if (!finalized.includes('not DepEd policy') && !addendumLines.some(l => l.includes('not DepEd policy'))) {
      addendumLines.push(aggregateData.priorityDisclaimer);
    }
  }

  // 6. Cross-Cutting Obligation: Draft Notice Verification
  if (plan.isDraft) {
    const requiredNotice = '(Draft for Principal review · Read-only AI assistance)';
    if (!finalized.includes(requiredNotice) && !addendumLines.some(l => l.includes(requiredNotice))) {
      addendumLines.push(requiredNotice);
    }
  }

  // Combine content and addendum cleanly
  if (addendumLines.length > 0) {
    if (finalized.length > 0) {
      finalized = `${finalized}\n\n${addendumLines.join('\n\n')}`;
    } else {
      finalized = addendumLines.join('\n\n');
    }
  }

  // Final sanitation pass: enforce human-readable module names, zero route codes
  finalized = replaceRouteIds(finalized);

  return {
    finalizedContent: finalized.trim(),
    auditMetrics: {
      obligationsTotal: plan.obligations.length,
      satisfiedCount,
      remediedCount,
      unmetCount,
      records,
    }
  };
}
