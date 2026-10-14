/**
 * useGateAttendanceSSE
 *
 * Connects Principal Monitoring to the backend SSE stream at
 * GET /api/attendance/gate/events.
 *
 * Authentication: EventSource sends cookies automatically (same-origin).
 * The existing auth_token cookie is included without any token-in-URL workaround.
 *
 * Design:
 * - Receives 'attendance-changed' events (invalidation only, no attendance payload).
 * - On each event, calls refreshGateAttendance() which fetches from GET /api/attendance/gate.
 * - PostgreSQL / REST API remains the authoritative source of truth.
 * - Reconnects automatically via native EventSource retry behavior.
 * - Tracks connection status ('connecting' | 'live' | 'error') for UI feedback.
 * - Cleans up on unmount — no leaked listeners.
 */

import { useEffect, useState } from 'react';
import { useAppContext } from '../AppContext';

const SSE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api')
  + '/attendance/gate/events';

export type SseStatus = 'connecting' | 'live' | 'error';

export function useGateAttendanceSSE(onFacultyAttendanceChanged?: () => void): SseStatus {
  const { refreshGateAttendance, addInvalidScan } = useAppContext();
  const [status, setStatus] = useState<SseStatus>('connecting');

  useEffect(() => {
    // EventSource automatically sends cookies (credentials are included for
    // same-site requests). No token-in-URL required.
    const es = new EventSource(SSE_URL, { withCredentials: true });

    es.addEventListener('connected', () => {
      setStatus('live');
    });

    es.addEventListener('attendance-changed', () => {
      // The event carries no data — we fetch the authoritative state from the API.
      refreshGateAttendance();
    });

    es.addEventListener('faculty-attendance-changed', () => {
      // Invalidation event for faculty gate attendance
      if (onFacultyAttendanceChanged) {
        onFacultyAttendanceChanged();
      }
    });

    es.addEventListener('invalid-scan', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        addInvalidScan(data.barcode, data.time);
      } catch (err) {
        console.error('Failed to parse invalid-scan event', err);
      }
    });

    // 'heartbeat' events are intentionally ignored — they only keep the TCP
    // connection alive through proxies that close idle connections.

    es.onerror = () => {
      // EventSource retries automatically. We surface the status so the UI
      // can show a non-alarming "reconnecting" indicator.
      setStatus('error');
      // Note: we do NOT close the EventSource here. Browsers will retry
      // automatically with an exponential backoff. When the connection
      // is re-established, 'connected' will fire again and reset status to 'live'.
    };

    es.addEventListener('connected', () => {
      // Re-fires on each successful reconnect
      setStatus('live');
    });

    return () => {
      es.close();
    };
  }, [refreshGateAttendance]);

  return status;
}
