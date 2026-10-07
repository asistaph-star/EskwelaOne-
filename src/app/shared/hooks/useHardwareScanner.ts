/**
 * useHardwareScanner — Dedicated Gate Terminal Scanner Hook
 *
 * Physical evidence basis:
 *   PASS — B2D-0240 outputs decoded value as USB HID keystrokes
 *   PASS — B2D-0240 sends CR (Enter) suffix
 *   PASS — Measured burst duration: ~116ms for 12 chars
 *   NOT VERIFIED — Configurable prefix support
 *
 * Detection strategy:
 *   Keystroke-speed timing distinguishes scanner bursts from human typing.
 *   The scanner completes a full burst in ~116ms. A human typing 12 chars
 *   at extreme speed (~10 keys/sec) takes ~1200ms minimum.
 *
 * Classification threshold: 150ms
 *   STATUS: VALIDATED against the physical B2D-0240 on October 5, 2026.
 *   This is an input-classification threshold, NOT a security control.
 *   Backend authentication, authorization, and database rules are the
 *   actual security boundaries.
 *
 * Contamination risk (KNOWN LIMITATION):
 *   Without a verified prefix, the first few digits may briefly appear
 *   in a focused input field before the hook determines they came from
 *   the scanner. The dedicated Gate Terminal avoids editable text fields
 *   to eliminate this risk.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '../../../api/client';

// ─── Timing ────────────────────────────────────────────────────
// STATUS: VALIDATED — The specific tested B2D-0240 unit measures ~116ms.
// Threshold set to 150ms to provide margin above the observed measurement.
const SCANNER_BURST_THRESHOLD_MS = 150;

// ─── Identifier Configuration ──────────────────────────────────
// Current production assumption: Identifier = LRN
// Status: WORKING / VERIFIED FOR TESTING
// Final school ID identifier: NOT VERIFIED
// This configuration isolates the LRN assumption from hardware timing logic.

export interface ScannerIdentifierConfig {
  pattern: RegExp;
  length: number;
}

export const DEFAULT_IDENTIFIER_CONFIG: ScannerIdentifierConfig = {
  pattern: /^\d{12}$/, // LRN format: exactly 12 numeric digits
  length: 12,
};

// ─── Typed State Contract ──────────────────────────────────────
// Matches the actual backend POST /api/attendance/gate/scan response.

export interface GateScanPayload {
  studentName: string;
  studentId: string;
  action: 'Time In' | 'Time Out';
  time: string;
}

export interface ScannerState {
  status: 'idle' | 'submitting' | 'success' | 'error' | 'expired';
  payload?: GateScanPayload;
  errorMessage?: string;
}

// ─── Result display timeout ────────────────────────────────────
// UX behavior constant — not a scanner timing or business-rule value.
// Controls how long a success/error result is shown before returning to idle.
const RESULT_DISPLAY_MS = 3000;

// ─── Hook ──────────────────────────────────────────────────────

export function useHardwareScanner(
  config: ScannerIdentifierConfig = DEFAULT_IDENTIFIER_CONFIG
): ScannerState {
  const [state, setState] = useState<ScannerState>({ status: 'idle' });

  // Buffer stores { char, timestamp } for each keystroke in the current burst
  const bufferRef = useRef<{ char: string; time: number }[]>([]);
  // Prevent duplicate simultaneous submissions
  const isSubmittingRef = useRef(false);
  // Timer ref for auto-reset after result display
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetToIdle = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setState({ status: 'idle' });
  }, []);

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(resetToIdle, RESULT_DISPLAY_MS);
  }, [resetToIdle]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const now = Date.now();

      if (e.key === 'Enter') {
        // Enter arrived — check if the preceding keystrokes look like a scanner burst
        console.log(`[Scanner Hook] Enter received. Buffer length: ${bufferRef.current.length}`);

        if (bufferRef.current.length === config.length) {
          const first = bufferRef.current[0].time;
          const last = bufferRef.current[config.length - 1].time;
          const duration = last - first;
          const candidate = bufferRef.current.map(b => b.char).join('');

          console.log(`[Scanner Hook] Candidate: ${candidate} | Duration: ${duration}ms (Threshold: ${SCANNER_BURST_THRESHOLD_MS}ms)`);

          // Clear buffer immediately regardless of outcome
          bufferRef.current = [];

          if (duration <= SCANNER_BURST_THRESHOLD_MS && config.pattern.test(candidate)) {
            // This looks like a scanner burst — block the Enter from the page
            e.preventDefault();

            if (isSubmittingRef.current) return; // Prevent duplicate submissions
            isSubmittingRef.current = true;
            setState({ status: 'submitting' });

            try {
              const res = await apiClient.post<any>('/attendance/gate/scan', { barcode: candidate });
              // apiClient already unwraps { success: true, data: { ... } } and returns the inner data object
              if (res) {
                const payload: GateScanPayload = {
                  studentName: res.studentName,
                  studentId: res.studentId,
                  action: res.action as 'Time In' | 'Time Out',
                  time: res.time,
                };
                setState({ status: 'success', payload });
                scheduleReset();
              }
            } catch (err: unknown) {
              const error = err as { status?: number; error?: { message?: string }; message?: string };

              if (error.status === 401) {
                // Session expired — do NOT auto-reset; require re-login
                setState({ status: 'expired', errorMessage: 'Session expired. Staff login required.' });
              } else {
                const message = error?.error?.message || error?.message || 'Scan failed. Please try again.';
                setState({ status: 'error', errorMessage: message });
                scheduleReset();
              }
            } finally {
              isSubmittingRef.current = false;
            }
          }
        } else {
          // Wrong number of buffered chars — clear and let Enter through normally
          console.log(`[Scanner Hook] Dropped scan. Buffer length was ${bufferRef.current.length}, expected ${config.length}. Candidate was: ${bufferRef.current.map(b => b.char).join('')}`);
          bufferRef.current = [];
        }
        return;
      }

      // Accumulate single printable characters into the buffer
      if (e.key.length === 1) {
        const now_char = Date.now();

        // If gap since last character is too long, it was human typing — reset buffer
        if (bufferRef.current.length > 0) {
          const lastTime = bufferRef.current[bufferRef.current.length - 1].time;
          if (now_char - lastTime > 50) {
            // 50ms inter-keystroke gap is too slow for a scanner; reset
            bufferRef.current = [];
          }
        }

        bufferRef.current.push({ char: e.key, time: now_char });

        // Safety: cap buffer to prevent runaway accumulation
        if (bufferRef.current.length > config.length) {
          bufferRef.current = [];
        }
      }
    };

    // Attach at bubble phase (NOT capture) so normal input fields receive
    // their keystrokes first, and we only intercept when Enter confirms a scan.
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, [config, scheduleReset]);

  return state;
}
