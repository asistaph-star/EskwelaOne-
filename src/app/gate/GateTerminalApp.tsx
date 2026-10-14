import React, { useState, useEffect, useCallback } from 'react';
import { useHardwareScanner, GateScanPayload } from '../shared/hooks/useHardwareScanner';
import { GateTerminalScreen, RecentScan } from './GateTerminalScreen';

interface GateTerminalAppProps {
  onLogout: () => void;
}

export function GateTerminalApp({ onLogout }: GateTerminalAppProps) {
  const scannerState = useHardwareScanner();
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  useEffect(() => {
    if (scannerState.status === 'success' && scannerState.payload) {
      setRecentScans((prev) => {
        const payload = scannerState.payload!;
        const idMatches = (prev[0]?.studentId && prev[0].studentId === payload.studentId) ||
                          (prev[0]?.teacherId && prev[0].teacherId === payload.teacherId);
        if (prev.length > 0 && prev[0].time === payload.time && idMatches) {
          return prev;
        }
        return [payload, ...prev].slice(0, 30);
      });
    }
  }, [scannerState.status, scannerState.payload]);

  const [hasFocus, setHasFocus] = useState(() => document.hasFocus());

  const handleFocus = useCallback(() => setHasFocus(true), []);
  const handleBlur = useCallback(() => setHasFocus(false), []);
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      setHasFocus(true);
    } else if (document.visibilityState === 'hidden') {
      setHasFocus(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleFocus, handleBlur, handleVisibilityChange]);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans">
      <GateTerminalScreen scannerState={scannerState} hasFocus={hasFocus} recentScans={recentScans} />

      {/* Hidden Staff Logout Hot-Corner */}
      <button
        onClick={handleLogoutClick}
        className="absolute bottom-0 right-0 z-40 h-16 w-16 opacity-0 cursor-default"
        aria-label="Logout"
      />

      {/* Premium Logout Confirmation Overlay */}
      {showLogoutConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-6 sm:p-8 flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900">End Gate Session</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
                Are you sure you want to log out? The terminal will be disabled and unable to process student IDs until an operator signs back in.
              </p>
            </div>
            
            <div className="flex flex-row-reverse justify-center gap-3 bg-slate-50 px-6 py-4 border-t border-slate-100 sm:px-8">
              <button 
                onClick={onLogout}
                className="inline-flex w-full justify-center rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:w-auto transition-colors"
              >
                Log Out
              </button>
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="inline-flex w-full justify-center rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:w-auto transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
