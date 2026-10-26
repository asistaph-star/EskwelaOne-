import { Response } from 'express';

// ─── SSE Client Registry & Broadcaster ────────────────────────────────────────
// Centralized real-time broadcaster for Student & Faculty Gate Attendance events.
// Tracks all active Principal Monitoring and Administrative SSE connections.
//
// Invalidation Principle:
// All events emitted carry zero sensitive student/faculty PII.
// The event serves strictly as a push-invalidation notification instructing
// authorized clients to refetch authoritative data from PostgreSQL via REST.
const sseClients = new Set<Response>();

/**
 * Registers an active Express response stream as an SSE client.
 * Returns an unregister function for cleanup on client disconnect.
 */
export function registerSSEClient(res: Response): () => void {
  sseClients.add(res);
  return () => {
    sseClients.delete(res);
  };
}

/**
 * Returns the count of currently connected SSE clients.
 */
export function getSSEClientCount(): number {
  return sseClients.size;
}

/**
 * Clears all registered SSE clients (primarily for test isolation).
 */
export function clearAllSSEClients(): void {
  sseClients.clear();
}

/**
 * Emits 'attendance-changed' to all connected clients.
 * Triggered whenever student gate attendance is created, scanned, or updated.
 */
export function emitGateAttendanceChanged(): void {
  for (const client of sseClients) {
    try {
      client.write('event: attendance-changed\ndata: {}\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * Emits 'faculty-attendance-changed' to all connected clients.
 * Triggered whenever faculty gate attendance is scanned, self-recorded, or corrected.
 */
export function emitFacultyAttendanceChanged(): void {
  for (const client of sseClients) {
    try {
      client.write('event: faculty-attendance-changed\ndata: {}\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * Emits 'invalid-scan' to all connected clients for real-time gate terminal diagnostics.
 */
export function emitInvalidScan(barcode: string): void {
  for (const client of sseClients) {
    try {
      client.write(`event: invalid-scan\ndata: ${JSON.stringify({ barcode, time: new Date().toISOString() })}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}
