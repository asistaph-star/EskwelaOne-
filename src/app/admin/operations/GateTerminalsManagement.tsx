import React, { useState, useEffect, useCallback } from 'react';
import {
  ScanLine,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  QrCode,
  Plus,
  Server,
  RefreshCw,
  ArrowRight,
  Lock,
  Check,
  Laptop
} from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Role Reassignment Modal State (only appears when clicking the other terminal role)
  const [reassignModalTarget, setReassignModalTarget] = useState<'student' | 'faculty' | null>(null);
  const [reassignPassword, setReassignPassword] = useState('');
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);

  // Device Pairing State
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
        message: `This browser is now paired to '${t.terminal_name}' (${t.id}). Launching kiosk...`
      });
      setTimeout(() => {
        window.location.hash = '#gate';
      }, 700);
    }
  };

  // New Terminal Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState('');
  const [newTerminalType, setNewTerminalType] = useState<'student' | 'faculty'>('student');
  const [isCreating, setIsCreating] = useState(false);

  const fetchTerminals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any = await apiClient.get('/attendance/gate/terminals');
      const list: GateTerminalRecord[] = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setTerminals(list);
      if (!selectedTerminalId && list.length > 0) {
        setSelectedTerminalId(list[0].id);
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
    setFeedback(null);
  };

  const handleOpenReassignModal = (targetRole: 'student' | 'faculty') => {
    if (!selectedTerminal) return;
    if (selectedTerminal.terminal_type === targetRole) {
      // Already active in this role
      return;
    }
    setReassignModalTarget(targetRole);
    setReassignPassword('');
    setReassignError(null);
  };

  const handleConfirmRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerminal || !reassignModalTarget) return;

    if (!reassignPassword.trim()) {
      setReassignError('Please enter your administrator password.');
      return;
    }

    setIsReassigning(true);
    setReassignError(null);

    try {
      const res: any = await apiClient.patch(
        `/attendance/gate/terminals/${selectedTerminal.id}`,
        {
          terminal_type: reassignModalTarget,
          adminPassword: reassignPassword.trim(),
        }
      );

      const updated: GateTerminalRecord = res?.data ?? res;
      if (updated && updated.id) {
        setTerminals(prev => prev.map(t => t.id === updated.id ? updated : t));
        setReassignModalTarget(null);
        setReassignPassword('');
        setFeedback({
          type: 'success',
          message: `'${updated.terminal_name}' is now deployed as ${
            updated.terminal_type === 'faculty' ? 'Faculty Terminal' : 'Student Terminal'
          }. Physical kiosks polling this ID will automatically sync.`
        });
      }
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Failed to update terminal. Verify administrator authorization.';
      setReassignError(message);
    } finally {
      setIsReassigning(false);
    }
  };

  const handleCreateTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerminalName.trim()) return;

    setIsCreating(true);
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
        setShowNewModal(false);
        setNewTerminalName('');
        setFeedback({
          type: 'success',
          message: `Gate terminal '${created.terminal_name}' registered successfully with ID '${created.id}'.`
        });
      }
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Failed to register terminal. Administrator authorization required.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Title & Introduction */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ScanLine className="text-blue-600" size={26} />
            Gate Terminals
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Centrally configure physical gate terminal assignments (Student / Faculty) and persistent identities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchTerminals}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
          >
            <Plus size={14} />
            <span>Register Terminal</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
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
          <span className="flex-1">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
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
            const isFaculty = t.terminal_type === 'faculty';
            const isPaired = t.id === pairedTerminalId;

            return (
              <div
                key={t.id}
                onClick={() => handleSelectTerminal(t)}
                className={`p-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition ${
                  isSelected ? 'bg-blue-50/50 ring-2 ring-inset ring-blue-500' : 'hover:bg-slate-50'
                }`}
              >
                {/* Station Name & Endpoint */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
                    isFaculty ? 'bg-indigo-500' : 'bg-blue-500'
                  }`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{t.terminal_name}</span>
                      <code className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {t.id}
                      </code>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Endpoint: <code className="font-mono text-slate-600">{isFaculty ? '/api/attendance/gate/faculty/scan' : '/api/attendance/gate/student/scan'}</code>
                    </div>
                  </div>
                </div>

                {/* Role Badge, Device Pairing & Actions */}
                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  {/* Clean Role Badge - Single Line, Never Wrapped */}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap border ${
                    isFaculty
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                      : 'bg-blue-50 text-blue-700 border-blue-200/80'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isFaculty ? 'bg-indigo-500' : 'bg-blue-500'}`} />
                    <span>{isFaculty ? 'Faculty Terminal' : 'Student Terminal'}</span>
                  </span>

                  {/* Device Pairing Tag */}
                  {isPaired && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>This Device</span>
                    </span>
                  )}

                  {/* Launch / Pair Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePairBrowserToTerminal(t);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 transition shadow-sm whitespace-nowrap"
                    title={isPaired ? "Launch Kiosk on this paired device" : "Pair this machine to this terminal and launch kiosk"}
                  >
                    <ExternalLink size={13} />
                    <span>{isPaired ? 'Launch Kiosk' : 'Pair & Launch'}</span>
                  </button>

                  <span className="text-xs font-semibold text-slate-400 w-16 text-right">
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
          {/* Card Header: Terminal Name & Clean Status Badge */}
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">
                  {selectedTerminal.terminal_name}
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap border ${
                  selectedTerminal.terminal_type === 'faculty'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                    : 'bg-blue-50 text-blue-700 border-blue-200/80'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    selectedTerminal.terminal_type === 'faculty' ? 'bg-indigo-500' : 'bg-blue-500'
                  }`} />
                  <span>{selectedTerminal.terminal_type === 'faculty' ? 'Faculty Terminal' : 'Student Terminal'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Hardware Station ID: <code className="font-mono text-slate-700 font-semibold">{selectedTerminal.id}</code> • Physical kiosks polling this ID synchronize automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handlePairBrowserToTerminal(selectedTerminal)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-blue-300 transition shrink-0"
            >
              <Laptop size={14} />
              <span>Pair This Device & Launch</span>
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Station Operational Mode
                </span>
                <span className="text-xs text-slate-400">
                  Click a role to reassign this station
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Student Terminal Card */}
                <div
                  onClick={() => handleOpenReassignModal('student')}
                  className={`relative flex flex-col p-5 rounded-xl border-2 transition cursor-pointer ${
                    selectedTerminal.terminal_type === 'student'
                      ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 font-bold text-slate-900 text-sm">
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        selectedTerminal.terminal_type === 'student'
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}>
                        {selectedTerminal.terminal_type === 'student' && <Check size={11} strokeWidth={3} />}
                      </div>
                      <span>Student Terminal</span>
                    </div>

                    {selectedTerminal.terminal_type === 'student' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                        <Check size={12} />
                        <span>Active Mode</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                        <Lock size={11} />
                        <span>Click to Switch</span>
                      </span>
                    )}
                  </div>

                  <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                    Binds to <code className="text-blue-700 font-mono">/api/attendance/gate/student/scan</code>. Accepts 12-digit Student LRNs. Rejects faculty credentials.
                  </p>
                </div>

                {/* Faculty Terminal Card */}
                <div
                  onClick={() => handleOpenReassignModal('faculty')}
                  className={`relative flex flex-col p-5 rounded-xl border-2 transition cursor-pointer ${
                    selectedTerminal.terminal_type === 'faculty'
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 font-bold text-slate-900 text-sm">
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        selectedTerminal.terminal_type === 'faculty'
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}>
                        {selectedTerminal.terminal_type === 'faculty' && <Check size={11} strokeWidth={3} />}
                      </div>
                      <span>Faculty Terminal</span>
                    </div>

                    {selectedTerminal.terminal_type === 'faculty' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                        <Check size={12} />
                        <span>Active Mode</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                        <Lock size={11} />
                        <span>Click to Switch</span>
                      </span>
                    )}
                  </div>

                  <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                    Binds to <code className="text-indigo-700 font-mono">/api/attendance/gate/faculty/scan</code>. Accepts Faculty QR (EMP-T-001). Rejects student LRNs.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>
                Currently active as <strong>{selectedTerminal.terminal_type === 'faculty' ? 'Faculty Terminal' : 'Student Terminal'}</strong>. Click the opposite card above whenever you need to reassign this station.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Role Reassignment Authorization Modal (Appears ONLY when clicking a new role) */}
      {reassignModalTarget && selectedTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
                <ShieldCheck size={20} className="text-blue-600" />
                <h3>Authorize Station Role Change</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                You are modifying the operational role for <strong>{selectedTerminal.terminal_name}</strong> (<code className="font-mono">{selectedTerminal.id}</code>).
              </p>
            </div>

            <form onSubmit={handleConfirmRoleChange} className="p-6 space-y-4">
              {/* Transition Preview */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Current Role</span>
                  <span className="font-semibold text-slate-800">
                    {selectedTerminal.terminal_type === 'faculty' ? 'Faculty Terminal' : 'Student Terminal'}
                  </span>
                </div>
                <ArrowRight size={16} className="text-slate-400" />
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">New Target</span>
                  <span className="font-semibold text-blue-700">
                    {reassignModalTarget === 'faculty' ? 'Faculty Terminal' : 'Student Terminal'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Administrator Password
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={reassignPassword}
                  onChange={(e) => {
                    setReassignPassword(e.target.value);
                    if (reassignError) setReassignError(null);
                  }}
                  placeholder="Enter administrator password"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition"
                />
                {reassignError && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{reassignError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setReassignModalTarget(null);
                    setReassignPassword('');
                    setReassignError(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReassigning || !reassignPassword.trim()}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
                >
                  {isReassigning ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Updating Server...</span>
                    </>
                  ) : (
                    <span>Confirm & Apply Role</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register New Terminal Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Register New Gate Terminal</h3>
              <p className="text-xs text-slate-500 mt-1">
                Create a persistent server-side identity for a physical gate station.
              </p>
            </div>

            <form onSubmit={handleCreateTerminal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Terminal Name / Description
                </label>
                <input
                  type="text"
                  required
                  value={newTerminalName}
                  onChange={(e) => setNewTerminalName(e.target.value)}
                  placeholder="e.g. Gate 3 - High School Entrance"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Initial Station Assignment
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTerminalType('student')}
                    className={`rounded-xl py-2.5 text-xs font-bold transition border ${
                      newTerminalType === 'student'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Student Terminal
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTerminalType('faculty')}
                    className={`rounded-xl py-2.5 text-xs font-bold transition border ${
                      newTerminalType === 'faculty'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
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
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newTerminalName.trim()}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                >
                  {isCreating ? 'Registering...' : 'Register Terminal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Integration Assets & Quick Verification QR Codes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <QrCode size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Student Test QR (Juan Dela Cruz)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                LRN payload: <code className="font-mono text-slate-700 font-semibold">123456789012</code>
              </p>
            </div>
          </div>
          <a
            href="/test_student_qr.png"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            <span>Open Student QR</span>
            <ExternalLink size={13} />
          </a>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <QrCode size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Faculty Test QR (Maria Clara)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Credential payload: <code className="font-mono text-slate-700 font-semibold">EMP-T-001</code>
              </p>
            </div>
          </div>
          <a
            href="/test_faculty_qr.png"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            <span>Open Faculty QR</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
