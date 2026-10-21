import { DigiSkwelaAIProvider, AIProviderError } from './aiProvider.interface.js';
import { MockAIProvider } from './mockAIProvider.js';
import { GroqAIProvider } from './groqAIProvider.js';
import { aiConfig } from '../../config/ai.config.js';

/**
 * Resolves the active AI provider based on configuration.
 * Strictly enforces the FREE-TIER AI POLICY:
 * - 'mock': Deterministic local mock provider (Phase A-D default)
 * - 'groq': GroqCloud Free Plan adapter (Phase E)
 * - 'disabled': AI assistance disabled by policy
 * - All unauthorized/paid modes fail closed.
 */
export function getAIProvider(): DigiSkwelaAIProvider {
  const mode = aiConfig.providerMode;

  if (mode === 'mock') {
    return new MockAIProvider();
  }

  if (mode === 'groq') {
    return new GroqAIProvider();
  }

  if (mode === 'disabled') {
    throw new AIProviderError(
      'PROVIDER_UNAVAILABLE',
      'DigiSkwela AI is currently disabled by administrative policy.'
    );
  }

  // Reject any unauthorized / paid provider modes
  if (!aiConfig.allowPaidProvider) {
    throw new AIProviderError(
      'PAID_PROVIDER_REJECTED',
      `Provider mode '${mode}' is rejected. Paid AI providers and automatic paid upgrades are forbidden.`
    );
  }

  throw new AIProviderError('PROVIDER_UNAVAILABLE', `Unsupported provider mode: ${mode}`);
}
