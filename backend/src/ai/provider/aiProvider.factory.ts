import { DigiSkwelaAIProvider, AIProviderError } from './aiProvider.interface.js';
import { MockAIProvider } from './mockAIProvider.js';
import { aiConfig } from '../../config/ai.config.js';

/**
 * Resolves the active AI provider based on configuration.
 * Strictly enforces the FREE-TIER AI POLICY:
 * Paid providers are rejected unless explicitly allowed.
 */
export function getAIProvider(): DigiSkwelaAIProvider {
  const mode = aiConfig.providerMode;

  if (mode === 'mock') {
    return new MockAIProvider();
  }

  if (mode === 'groq') {
    // Phase A/B check: Groq adapter is scheduled for Phase G
    throw new AIProviderError(
      'PROVIDER_UNAVAILABLE',
      'Groq free-tier provider is not yet initialized. Use mock mode during Phase A/B.'
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
