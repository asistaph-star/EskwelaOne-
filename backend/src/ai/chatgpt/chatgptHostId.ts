import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface ChatGPTAgentHostInfo {
  hostId: string;
  createdAt: string;
}

const DEFAULT_STORAGE_PATH = path.resolve(process.cwd(), 'storage', 'chatgpt', 'host_id.json');

/**
 * Retrieves or initializes a stable, opaque host identifier for the local DigiSkwela environment.
 * 
 * Formal Invariants:
 * - Format: Standard RFC 4122 UUID URN (`urn:uuid:<uuid-v4>`).
 * - Stable: Generated once upon initial setup and persisted across process restarts.
 * - Privacy: Machine-level identity only; strictly ZERO personal info, emails, LRNs, or user IDs.
 */
export function getOrCreateHostId(customPath?: string): string {
  const filePath = customPath || DEFAULT_STORAGE_PATH;

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed: ChatGPTAgentHostInfo = JSON.parse(raw);
      if (parsed && typeof parsed.hostId === 'string' && parsed.hostId.startsWith('urn:uuid:')) {
        return parsed.hostId;
      }
    }
  } catch {
    // If read/parse fails, regenerate below
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const newHostId = `urn:uuid:${randomUUID()}`;
  const data: ChatGPTAgentHostInfo = {
    hostId: newHostId,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return newHostId;
}
