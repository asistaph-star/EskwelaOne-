import React, { useState, useEffect, useCallback } from 'react';
import { useHardwareScanner } from '../shared/hooks/useHardwareScanner';
import { GateTerminalScreen, RecentScan } from './GateTerminalScreen';
import { apiClient } from '../../api/client';

export type GateTerminalType = 'student' | 'faculty';

export interface GateTerminalInfo {
  id: string;
  terminal_name: string;
  terminal_type: GateTerminalType;
}

/**
 * Resolves the physical station terminal ID from deployment configuration:
 * 1. Persisted identity in localStorage ('digiskwela_gate_terminal_id').
 * 2. Environment configuration (VITE_GATE_TERMINAL_ID).
 * 3. Fallback to canonical default 'term-gate-1'.
 */
export function getPersistentTerminalId(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('digiskwela_gate_terminal_id');
    if (stored) return stored;
  }
  const envId = (import.meta as any).env?.VITE_GATE_TERMINAL_ID;
  if (envId) return envId;
  return 'term-gate-1';
}

/**
 * Resolves the physical station terminal type from deployment configuration:
 * 1. Persisted deployment station setting in localStorage ('digiskwela_station_terminal_type').
 * 2. Environment configuration (VITE_GATE_TERMINAL_TYPE, defaulting to 'student').
 */
export function getStationTerminalType(): GateTerminalType {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('digiskwela_station_terminal_type')?.toLowerCase();
    if (stored === 'faculty' || stored === 'student') {
      return stored;
    }
  }

  const envType = ((import.meta as any).env?.VITE_GATE_TERMINAL_TYPE || 'student').toLowerCase();
  if (envType === 'faculty') return 'faculty';
  return 'student';
}

interface GateTerminalAppProps {
  onLogout: () => void;
}

export function GateTerminalApp({ onLogout }: GateTerminalAppProps) {
  // Persistent hardware terminal identity
  const [terminalId, setTerminalId] = useState<string>(() => getPersistentTerminalId());
  const [terminalName, setTerminalName] = useState<string>('');
  const [terminalType, setTerminalType] = useState<GateTerminalType>(() => getStationTerminalType());
  const [showAdminConfig, setShowAdminConfig] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Admin Credential Challenge State
  const [availableTerminals, setAvailableTerminals] = useState<GateTerminalInfo[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>(terminalId);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [targetTerminalType, setTargetTerminalType] = useState<GateTerminalType>(terminalType);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Centralized Server-Side Terminal Synchronization
  // Periodically polls the server for role assignment changes from Admin Portal
  const syncTerminalConfig = useCallback(async () => {
    try {
      const res: any = await apiClient.get(`/attendance/gate/terminals/${terminalId}`);
      const info = res?.data ?? res;
      if (info) {
        if (info.terminal_type === 'faculty' || info.terminal_type === 'student') {
          setTerminalType(info.terminal_type);
          localStorage.setItem('digiskwela_station_terminal_type', info.terminal_type);
        }
        if (info.terminal_name) {
          setTerminalName(info.terminal_name);
        }
      }
    } catch {
      // Offline fallback: keep current role from localStorage
    }
  }, [terminalId]);

  useEffect(() => {
    syncTerminalConfig();
    const interval = setInterval(syncTerminalConfig, 15_000);
    return () => clearInterval(interval);
  }, [syncTerminalConfig]);

  // Load available terminals when opening Admin Config modal
  const loadAvailableTerminals = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/attendance/gate/terminals');
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      if (list && list.length > 0) {
        setAvailableTerminals(list);
      }
    } catch {
      // Ignore
    }
  }, []);

  const openAdminModal = useCallback(() => {
    setAuthError(null);
    setAdminPassword('');
    setSelectedTerminalId(terminalId);
    setTargetTerminalType(terminalType);
    setShowAdminConfig(true);
    loadAvailableTerminals();
  }, [terminalId, terminalType, loadAvailableTerminals]);

  // Administrative station reconfiguration hotkey: Ctrl + Shift + F12
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F12') {
        e.preventDefault();
        openAdminModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openAdminModal]);

  const handleAdminAuthorizeReconfigure = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthorizing(true);

    try {
      const res = await apiClient.post<any>('/attendance/gate/terminal/reconfigure', {
        email: adminEmail.trim(),
        password: adminPassword,
        terminalId: selectedTerminalId,
        terminalType: targetTerminalType,
      });

      if (res) {
        localStorage.setItem('digiskwela_gate_terminal_id', selectedTerminalId);
        localStorage.setItem('digiskwela_station_terminal_type', targetTerminalType);
        setTerminalId(selectedTerminalId);
        setTerminalType(targetTerminalType);
        setShowAdminConfig(false);
        setAdminPassword('');
      }
    } catch (err: unknown) {
      const error = err as { status?: number; error?: { message?: string }; message?: string };
      const message = error?.error?.message || error?.message || 'Authorization failed. Admin or ITAdmin credentials required.';
      setAuthError(message);
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Hardware scanner hook binds strictly to the configured terminal endpoint
  const scannerConfig = React.useMemo(() => ({
    endpoint: terminalType === 'faculty'
      ? '/attendance/gate/faculty/scan'
      : '/attendance/gate/student/scan'
  }), [terminalType]);

  const scannerState = useHardwareScanner(scannerConfig);
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

  const handleFocus = useCallback(() => {
    setHasFocus(true);
    syncTerminalConfig();
  }, [syncTerminalConfig]);

  const handleBlur = useCallback(() => setHasFocus(false), []);
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      setHasFocus(true);
      syncTerminalConfig();
    } else if (document.visibilityState === 'hidden') {
      setHasFocus(false);
    }
  }, [syncTerminalConfig]);

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans">
      <GateTerminalScreen
        scannerState={scannerState}
        hasFocus={hasFocus}
        recentScans={recentScans}
        terminalType={terminalType}
        terminalName={terminalName}
        terminalId={terminalId}
        onOpenAdminConfig={openAdminModal}
      />

      {/* Hidden Staff Hot-Corner: Click opens Logout, Shift+Click prompts Admin Station Reconfiguration */}
      <button
        onClick={(e) => {
          if (e.shiftKey) {
            openAdminModal();
          } else {
            setShowLogoutConfirm(true);
          }
        }}
        className="absolute bottom-0 right-0 z-40 h-16 w-16 opacity-0 cursor-default"
        aria-label="Staff Session Control"
      />

      {/* Authenticated Admin Station Reconfiguration Modal */}
      {showAdminConfig && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md">
          <div className="flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6 sm:p-8 flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Station Authorization</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Administrator credentials (Admin or ITAdmin) are required to reassign this physical attendance station.
              </p>
              
              <div className="mt-3 flex flex-col items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                <div>Station ID: <code className="font-mono text-blue-700">{terminalId}</code> {terminalName ? `(${terminalName})` : ''}</div>
                <div className="font-extrabold text-slate-900 uppercase">Current Role: {terminalType} Terminal</div>
              </div>
            </div>

            <form onSubmit={handleAdminAuthorizeReconfigure} className="px-6 pb-6 sm:px-8 space-y-4">
              {authError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                  {authError}
                </div>
              )}

              {availableTerminals.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Terminal Identity
                  </label>
                  <select
                    value={selectedTerminalId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedTerminalId(id);
                      const match = availableTerminals.find(t => t.id === id);
                      if (match) setTargetTerminalType(match.terminal_type);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                  >
                    {availableTerminals.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.terminal_name} ({t.id}) - {t.terminal_type.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Target Station Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetTerminalType('student')}
                    className={`rounded-lg py-2 text-xs font-bold transition border ${
                      targetTerminalType === 'student'
                        ? 'bg-blue-600 text-white border-blue-600 shadow'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Student Terminal
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetTerminalType('faculty')}
                    className={`rounded-lg py-2 text-xs font-bold transition border ${
                      targetTerminalType === 'faculty'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Faculty Terminal
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@school.edu.ph"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Administrator Password
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isAuthorizing}
                  className="inline-flex w-full justify-center items-center rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {isAuthorizing ? 'Authorizing Reconfiguration...' : 'Authorize & Lock Station Role'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminConfig(false)}
                  className="inline-flex w-full justify-center rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Confirmation Overlay */}
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
                Are you sure you want to log out? The terminal will be disabled and unable to process scans until an operator signs back in.
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
