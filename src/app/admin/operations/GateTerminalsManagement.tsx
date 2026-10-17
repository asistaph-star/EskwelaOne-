import React, { useState, useEffect, useCallback } from 'react';
import { ScanLine, ShieldCheck, CheckCircle2, AlertCircle, ExternalLink, QrCode, Plus, Server, RefreshCw } from 'lucide-react';
import { apiClient } from '../../../api/client';

export interface GateTerminalRecord {
  id: string;
  terminal_name: string;
  terminal_type: 'student' | 'faculty';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function GateTerminalsManagement() {
  const [terminals, setTerminals] = useState<GateTerminalRecord[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('');
  const [targetRole, setTargetRole] = useState<'student' | 'faculty'>('student');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pairedTerminalId, setPairedTerminalId] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? (localStorage.getItem('digiskwela_gate_terminal_id') || 'term-gate-1')
      : 'term-gate-1';
  });

  const handlePairBrowserToTerminal = (t: GateTerminalRecord) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('digiskwela_gate_terminal_id', t.id);
      localStorage.setItem('digiskwela_station_terminal_type', t.terminal_type);
      setPairedTerminalId(t.id);
      setFeedback({
        type: 'success',
        message: `This device is now paired as '${t.terminal_name}' (${t.id}). Launching Gate Attendance Terminal...`
      });
      setTimeout(() => {
        window.location.hash = '#gate';
      }, 800);
    }
  };

  // New Terminal Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState('');
  const [newTerminalType, setNewTerminalType] = useState<'student' | 'faculty'>('student');

  const fetchTerminals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any = await apiClient.get('/attendance/gate/terminals');
      const list: GateTerminalRecord[] = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setTerminals(list);
      if (!selectedTerminalId && list.length > 0) {
        setSelectedTerminalId(list[0].id);
        setTargetRole(list[0].terminal_type);
      } else if (selectedTerminalId) {
        const current = list.find(t => t.id === selectedTerminalId);
        if (current) {
          setTargetRole(current.terminal_type);
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.error?.message || err?.message || 'Failed to fetch registered gate terminals from server.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTerminalId]);

  useEffect(() => {
    fetchTerminals();
  }, [fetchTerminals]);

  const selectedTerminal = terminals.find(t => t.id === selectedTerminalId);

  const handleSelectTerminal = (t: GateTerminalRecord) => {
    setSelectedTerminalId(t.id);
    setTargetRole(t.terminal_type);
    setFeedback(null);
    setAdminPassword('');
  };

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerminal) return;

    if (!adminPassword.trim()) {
      setFeedback({
        type: 'error',
        message: 'Please enter your administrator password to authorize reconfiguration.'
      });
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);

    try {
      // Centralized server-side reconfiguration via PATCH /attendance/gate/terminals/:id
      const res: any = await apiClient.patch(
        `/attendance/gate/terminals/${selectedTerminal.id}`,
        {
          terminal_type: targetRole,
          adminPassword: adminPassword.trim(),
        }
      );

      const updated: GateTerminalRecord = res?.data ?? res;
      if (updated && updated.id) {
        setTerminals(prev => prev.map(t => t.id === updated.id ? updated : t));
        setAdminPassword('');
        setFeedback({
          type: 'success',
          message: `Server successfully updated '${updated.terminal_name}' to ${
            updated.terminal_type === 'faculty' ? 'Faculty Terminal (Faculty Only)' : 'Student Terminal (Students Only)'
          }. Physical kiosks assigned to this ID will automatically sync.`
        });
      }
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Failed to update terminal. Verify administrator authorization.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerminalName.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res: any = await apiClient.post(
        '/attendance/gate/terminals',
        {
          terminal_name: newTerminalName.trim(),
          terminal_type: newTerminalType,
        }
      );

      const created: GateTerminalRecord = res?.data ?? res;
      if (created && created.id) {
        setTerminals(prev => [...prev, created]);
        setSelectedTerminalId(created.id);
        setTargetRole(created.terminal_type);
        setShowNewModal(false);
        setNewTerminalName('');
        setFeedback({
          type: 'success',
          message: `Gate terminal '${created.terminal_name}' registered successfully on the server with ID '${created.id}'.`
        });
      }
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Failed to register terminal. Administrator authorization required.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Title & Introduction */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ScanLine className="text-blue-600" size={28} />
            Gate Terminals
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Centrally configure physical gate terminal assignments (Student / Faculty) and persistent identities. (Configuration only).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchTerminals}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
          >
            <Plus size={14} />
            <span>Register Terminal</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm font-medium ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
          ) : (
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Terminal Registry Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Registered Physical Terminals ({terminals.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">Server Registry (PostgreSQL)</span>
        </div>

        <div className="divide-y divide-slate-100">
          {terminals.map((t) => {
            const isSelected = t.id === selectedTerminalId;
            return (
              <div
                key={t.id}
                onClick={() => handleSelectTerminal(t)}
                className={`p-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer transition ${
                  isSelected ? 'bg-blue-50/60 ring-2 ring-inset ring-blue-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${
                    t.terminal_type === 'faculty' ? 'bg-indigo-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{t.terminal_name}</span>
                      <code className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {t.id}
                      </code>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Binding: {t.terminal_type === 'faculty' ? '/api/attendance/gate/faculty/scan' : '/api/attendance/gate/student/scan'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {t.id === pairedTerminalId && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Paired to this Device
                    </span>
                  )}
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    t.terminal_type === 'faculty'
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                    {t.terminal_type === 'faculty' ? 'Faculty Terminal' : 'Student Terminal'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePairBrowserToTerminal(t);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 transition shadow-sm"
                    title={t.id === pairedTerminalId ? "Launch Kiosk on this paired device" : "Pair this physical machine/browser to this terminal and launch kiosk"}
                  >
                    <ExternalLink size={13} />
                    <span>{t.id === pairedTerminalId ? 'Launch Kiosk' : 'Pair & Launch'}</span>
                  </button>
                  <span className="text-xs font-semibold text-slate-400">
                    {isSelected ? '● Editing' : 'Select'}
                  </span>
                </div>
              </div>
            );
          })}

          {terminals.length === 0 && !isLoading && (
            <div className="p-8 text-center text-sm text-slate-500">
              No terminals registered yet. Click "Register Terminal" above to add your first physical gate station.
            </div>
          )}
        </div>
      </div>

      {/* Selected Terminal Configuration Form */}
      {selectedTerminal && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Configure Assignment: {selectedTerminal.terminal_name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Changes saved here update the server-side database. Physical kiosks polling ID <code className="font-mono text-slate-700">{selectedTerminal.id}</code> will automatically apply this role.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Server Role:</span>
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                selectedTerminal.terminal_type === 'faculty'
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                {selectedTerminal.terminal_type === 'faculty' ? 'Faculty Terminal' : 'Student Terminal'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveConfiguration} className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Station Role Assignment</span>
                {targetRole !== selectedTerminal.terminal_type ? (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    Pending change: {selectedTerminal.terminal_type === 'faculty' ? 'Faculty' : 'Student'} → {targetRole === 'faculty' ? 'Faculty' : 'Student'}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 font-medium">
                    Currently deployed as {selectedTerminal.terminal_type === 'faculty' ? 'Faculty Terminal' : 'Student Terminal'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Student Terminal Option */}
                <label className={`relative flex flex-col p-5 rounded-xl border-2 cursor-pointer transition ${
                  targetRole === 'student'
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <input
                        type="radio"
                        name="terminalType"
                        value="student"
                        checked={targetRole === 'student'}
                        onChange={() => setTargetRole('student')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Student Terminal</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      Students Only
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    Binds to <code className="text-blue-700 font-mono">/api/attendance/gate/student/scan</code>.
                    Accepts 12-digit Student LRNs. Rejects teacher credentials.
                  </p>
                </label>

                {/* Faculty Terminal Option */}
                <label className={`relative flex flex-col p-5 rounded-xl border-2 cursor-pointer transition ${
                  targetRole === 'faculty'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <input
                        type="radio"
                        name="terminalType"
                        value="faculty"
                        checked={targetRole === 'faculty'}
                        onChange={() => setTargetRole('faculty')}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Faculty Terminal</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      Faculty Only
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    Binds to <code className="text-indigo-700 font-mono">/api/attendance/gate/faculty/scan</code>.
                    Accepts TeacherScanCredentials (EMP-T-001). Rejects student LRNs.
                  </p>
                </label>
              </div>
            </div>

            {targetRole !== selectedTerminal.terminal_type ? (
              <div className="bg-slate-50 p-5 rounded-xl border-2 border-amber-300 max-w-lg space-y-4 shadow-sm animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wide">
                    <ShieldCheck size={18} className="text-amber-600" />
                    <span>Reassign Station Role: {selectedTerminal.terminal_type === 'faculty' ? 'Faculty' : 'Student'} → {targetRole === 'faculty' ? 'Faculty' : 'Student'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetRole(selectedTerminal.terminal_type);
                      setAdminPassword('');
                      setFeedback(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 font-medium mb-1">
                    Enter your administrator password to authorize this role change:
                  </label>
                  <input
                    type="password"
                    autoFocus
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      if (feedback?.type === 'error') setFeedback(null);
                    }}
                    placeholder="Enter administrator password"
                    className={`w-full rounded-lg border px-3 py-2 text-sm bg-white transition focus:outline-none focus:ring-1 ${
                      feedback?.type === 'error' && (feedback.message.toLowerCase().includes('password') || feedback.message.toLowerCase().includes('unauthorized'))
                        ? 'border-red-500 text-red-900 bg-red-50/20 focus:border-red-600 focus:ring-red-600'
                        : 'border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-blue-600'
                    }`}
                  />
                  {feedback?.type === 'error' && (feedback.message.toLowerCase().includes('password') || feedback.message.toLowerCase().includes('unauthorized')) && (
                    <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
                      <AlertCircle size={13} />
                      <span>Incorrect administrator password. Please try again.</span>
                    </p>
                  )}
                </div>

                {/* Inline Feedback Banner */}
                {feedback && (
                  <div className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs font-medium ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {feedback.type === 'success' ? (
                      <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                    ) : (
                      <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={16} />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting || !adminPassword.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Updating Server...</span>
                      </>
                    ) : (
                      <span>Authorize & Deploy Role</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetRole(selectedTerminal.terminal_type);
                      setAdminPassword('');
                      setFeedback(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3.5 max-w-lg">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>Station is active as <strong>{selectedTerminal.terminal_type === 'faculty' ? 'Faculty Terminal' : 'Student Terminal'}</strong>. Click the opposite option above if you wish to reassign its role.</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Register New Terminal Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Register New Gate Terminal</h3>
              <p className="text-xs text-slate-500 mt-1">
                Create a persistent server-side identity for a physical gate terminal.
              </p>
            </div>

            <form onSubmit={handleCreateTerminal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Terminal Name / Description
                </label>
                <input
                  type="text"
                  required
                  value={newTerminalName}
                  onChange={(e) => setNewTerminalName(e.target.value)}
                  placeholder="e.g. Gate 3 - High School Entrance"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Initial Station Assignment
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTerminalType('student')}
                    className={`rounded-lg py-2 text-xs font-bold transition border ${
                      newTerminalType === 'student'
                        ? 'bg-blue-600 text-white border-blue-600 shadow'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Student Terminal
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTerminalType('faculty')}
                    className={`rounded-lg py-2 text-xs font-bold transition border ${
                      newTerminalType === 'faculty'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Faculty Terminal
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTerminalName.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow"
                >
                  {isSubmitting ? 'Registering...' : 'Register Terminal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Integration Assets & Diagnostic Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <QrCode size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Student Test QR (Juan Dela Cruz)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                LRN payload: <code className="font-mono text-slate-700">123456789012</code>
              </p>
            </div>
          </div>
          <a
            href="/test_student_qr.png"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <span>Open Student QR</span>
            <ExternalLink size={14} />
          </a>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <QrCode size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Faculty Test QR (Maria Clara)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Credential payload: <code className="font-mono text-slate-700">EMP-T-001</code>
              </p>
            </div>
          </div>
          <a
            href="/test_faculty_qr.png"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <span>Open Faculty QR</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
