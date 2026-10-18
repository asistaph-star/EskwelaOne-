import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../../api/client';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  X,
  User,
  Calendar,
  FileText,
  Users,
  CheckCircle2,
  Clock,
  Filter,
  ChevronDown,
  Check
} from 'lucide-react';

export interface BehaviorLogItem {
  id: string;
  student_id: string;
  type: string;
  date: string;
  status: 'Reported' | 'Under investigation' | 'Parent notified' | 'Resolved' | string;
  note: string | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
  reporter_name?: string | null;
  studentName?: string;
  gradeLevel?: number | null;
  sectionName?: string | null;
  reporter?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface BehaviorSummaryData {
  total: number;
  studentsCount: number;
  statusCounts: Record<string, number>;
  reported: number;
  underInvestigation: number;
  parentNotified: number;
  resolved: number;
}

interface DropdownOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  width?: string;
}

function FilterDropdown({ label, value, options, onChange, width = "w-44" }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400 font-medium">{label}:</span>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`inline-flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${width}`}
        >
          <span className="truncate">{selectedOption.label}</span>
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180 text-indigo-600' : ''}`}
          />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-40 w-52 bg-white rounded-2xl border border-slate-200/90 shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            Filter by {label}
          </div>
          <div className="max-h-60 overflow-y-auto py-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-xs font-medium flex items-center justify-between cursor-pointer rounded-lg mx-1 transition text-left ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="text-indigo-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function PBehaviorScreen() {
  const [logs, setLogs] = useState<BehaviorLogItem[]>([]);
  const [summary, setSummary] = useState<BehaviorSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<BehaviorLogItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, summaryRes]: any = await Promise.all([
        apiClient.get<BehaviorLogItem[]>('/student-services/behavior'),
        apiClient.get<BehaviorSummaryData>('/student-services/behavior/summary')
      ]);
      const logsData = Array.isArray(logsRes?.data) ? logsRes.data : Array.isArray(logsRes) ? logsRes : [];
      const summaryData = summaryRes?.data || summaryRes || null;
      setLogs(logsData);
      setSummary(summaryData);
    } catch (err: any) {
      console.error('Failed to load behavioral reports:', err);
      setError(err?.error?.message || err?.message || 'Failed to load behavioral reports.');
      setLogs([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Distinct types for type filter dropdown
  const availableTypes = Array.from(new Set(logs.map(l => l.type).filter(Boolean)));

  // Client-side filtering
  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase().trim();
    const studentMatch = (log.studentName || '').toLowerCase().includes(q) || (log.student_id || '').toLowerCase().includes(q);
    const typeMatch = (log.type || '').toLowerCase().includes(q);
    const noteMatch = (log.note || '').toLowerCase().includes(q);
    const reporterMatch = (log.reporter_name || '').toLowerCase().includes(q);
    const sectionMatch = (log.sectionName || '').toLowerCase().includes(q);
    const matchesSearch = !q || studentMatch || typeMatch || noteMatch || reporterMatch || sectionMatch;

    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesType = typeFilter === 'all' || log.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const activeCasesCount = (summary?.reported ?? 0) + (summary?.underInvestigation ?? 0) + (summary?.parentNotified ?? 0);

  const statusOptions: DropdownOption[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Under investigation', label: 'Under Investigation' },
    { value: 'Parent notified', label: 'Parent Notified' },
    { value: 'Reported', label: 'Reported' },
    { value: 'Resolved', label: 'Resolved' },
  ];

  const typeOptions: DropdownOption[] = [
    { value: 'all', label: 'All Types' },
    ...availableTypes.map((t) => ({ value: t, label: t })),
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <ShieldAlert size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Behavioral Reports</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                  Read-Only Oversight
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Full incident-level history and active disciplinary records across the institution.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 flex items-start gap-3 text-sm font-medium">
          <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Incidents */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Recorded Logs
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : (summary?.total ?? logs.length)}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">
              Historical & Active
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
        </div>

        {/* Active Cases */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active Cases
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : activeCasesCount}
            </div>
            <div className="text-xs text-amber-600 font-semibold mt-1">
              Pending Resolution
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
        </div>

        {/* Under Investigation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Under Investigation
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : (summary?.underInvestigation ?? 0)}
            </div>
            <div className="text-xs text-indigo-600 font-semibold mt-1">
              Active Administrative Inquiry
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
        </div>

        {/* Resolved Cases */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Resolved Cases
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : (summary?.resolved ?? 0)}
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-1">
              Concluded Successfully
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Main Incident History Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student, section, incident type, reporter, or note..."
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <FilterDropdown
              label="Status"
              value={statusFilter}
              options={statusOptions}
              onChange={setStatusFilter}
              width="w-44"
            />

            {availableTypes.length > 0 && (
              <FilterDropdown
                label="Type"
                value={typeFilter}
                options={typeOptions}
                onChange={setTypeFilter}
                width="w-40"
              />
            )}

            {(statusFilter !== 'all' || typeFilter !== 'all' || search.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">Student</th>
                <th className="py-3 px-4">Grade & Section</th>
                <th className="py-3 px-4">Incident Type</th>
                <th className="py-3 px-4">Date Reported</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reported By</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredLogs.map((item) => {
                const statusStyles: Record<string, string> = {
                  'Under investigation': 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
                  'Parent notified': 'bg-blue-50 text-blue-700 border-blue-200/80',
                  'Reported': 'bg-amber-50 text-amber-700 border-amber-200/80',
                  'Resolved': 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
                };
                const badgeClass = statusStyles[item.status] || 'bg-slate-50 text-slate-700 border-slate-200';
                const sName = item.studentName || 'Student';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                          {sName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{sName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {item.student_id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {item.gradeLevel ? `Grade ${item.gradeLevel}` : '—'}
                      {item.sectionName ? ` • ${item.sectionName}` : ''}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{item.type}</div>
                      <span className="inline-block text-[10px] font-medium text-slate-400">
                        Disciplinary Record
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${badgeClass}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                        <span>{item.status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {item.reporter_name || item.reported_by || 'Staff'}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg transition shadow-sm"
                      >
                        <Eye size={13} />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center text-slate-400">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <ShieldAlert size={24} />
                      </div>
                      <div className="text-sm font-bold text-slate-700">No Behavioral Reports Found</div>
                      <p className="text-xs text-slate-500 mt-1">
                        No student behavioral incident records match the current filter criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Read-Only Incident Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    Disciplinary Record Details
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Incident #{selectedLog.id.slice(0, 8)}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1.5">{selectedLog.type}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              {/* Student Metadata Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Student</div>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedLog.studentName || 'Student'}</div>
                  <div className="text-slate-500 mt-0.5">
                    {selectedLog.gradeLevel ? `Grade ${selectedLog.gradeLevel}` : ''}
                    {selectedLog.sectionName ? ` • Section ${selectedLog.sectionName}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Current Status</div>
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                      <span>{selectedLog.status}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Incident Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Date Reported</div>
                  <div className="font-semibold text-slate-800 mt-1">
                    {new Date(selectedLog.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Reported By</div>
                  <div className="font-semibold text-slate-800 mt-1">
                    {selectedLog.reporter_name || selectedLog.reported_by || 'Staff'}
                  </div>
                </div>
              </div>

              {/* Case Notes */}
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                  Administrative Incident Notes
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 leading-relaxed min-h-[4rem]">
                  {selectedLog.note ? selectedLog.note : <span className="text-slate-400 italic">No notes provided.</span>}
                </div>
              </div>

              {/* Least-Privilege Notice */}
              <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 text-blue-800 text-[11px] leading-relaxed flex items-start gap-2">
                <AlertCircle size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Executive Oversight:</strong> This record reflects administrative disciplinary logging under <code className="font-mono text-blue-900">behavior:read</code>. Confidential counseling and clinic treatments remain strictly protected under guidance and medical privacy.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
              >
                Close Case Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
