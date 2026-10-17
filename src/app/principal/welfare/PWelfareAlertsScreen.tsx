import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../api/client';
import { PScreen } from '../../shared/types';
import {
  HeartHandshake,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  X,
  User,
  Calendar,
  FileText,
  ShieldAlert,
  Users,
  CheckCircle2
} from 'lucide-react';

export interface WelfareAlertItem {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: number | null;
  sectionName: string | null;
  alertType: 'Behavioral';
  incidentType: string;
  date: string;
  status: 'Reported' | 'Under investigation' | 'Parent notified';
  note: string | null;
  reportedBy: string | null;
  reporterName: string | null;
  createdAt: string;
}

export interface WelfareAlertsSummary {
  totalActiveAlerts: number;
  studentsRequiringAttention: number;
  openCases: number;
  byStatus: {
    reported: number;
    underInvestigation: number;
    parentNotified: number;
  };
}

interface WelfareAlertsResponse {
  summary: WelfareAlertsSummary;
  alerts: WelfareAlertItem[];
}

interface PWelfareAlertsScreenProps {
  onNav?: (s: PScreen) => void;
}

export function PWelfareAlertsScreen({ onNav }: PWelfareAlertsScreenProps) {
  const [alerts, setAlerts] = useState<WelfareAlertItem[]>([]);
  const [summary, setSummary] = useState<WelfareAlertsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Detail Modal
  const [selectedAlert, setSelectedAlert] = useState<WelfareAlertItem | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await apiClient.get<WelfareAlertsResponse>('/admin/welfare-alerts');
      const data: WelfareAlertsResponse = res?.data ?? res;
      setAlerts(Array.isArray(data?.alerts) ? data.alerts : []);
      setSummary(data?.summary ?? null);
    } catch (err: any) {
      console.error('Failed to load welfare alerts:', err);
      setError(err?.error?.message || err?.message || 'Failed to load welfare alerts.');
      setAlerts([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Client-side filtering
  const filteredAlerts = alerts.filter((item) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.studentName.toLowerCase().includes(q) ||
      (item.sectionName && item.sectionName.toLowerCase().includes(q)) ||
      item.incidentType.toLowerCase().includes(q) ||
      (item.reporterName && item.reporterName.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <HeartHandshake size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welfare Alerts</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Executive oversight of active student welfare and disciplinary cases requiring administrative attention.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAlerts}
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
        {/* Students Requiring Attention */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Students Requiring Attention
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : (summary?.studentsRequiringAttention ?? 0)}
            </div>
            <div className="text-xs text-rose-600 font-semibold mt-1">
              Unique Flagged Students
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
        </div>

        {/* Total Active Cases */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Active Cases
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : (summary?.totalActiveAlerts ?? 0)}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">
              Unresolved Incident Reports
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
        </div>

        {/* Under Investigation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Under Investigation
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : (summary?.byStatus.underInvestigation ?? 0)}
            </div>
            <div className="text-xs text-indigo-600 font-semibold mt-1">
              Inquiry in Progress
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
        </div>

        {/* Parent Notified */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Parent Notified
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : (summary?.byStatus.parentNotified ?? 0)}
            </div>
            <div className="text-xs text-blue-600 font-semibold mt-1">
              Family Contact Established
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Main Alerts Table Card */}
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
                placeholder="Search by student, section, incident type, or note..."
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            >
              <option value="all">All Active Statuses</option>
              <option value="Under investigation">Under Investigation</option>
              <option value="Parent notified">Parent Notified</option>
              <option value="Reported">Reported</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">Student</th>
                <th className="py-3 px-4">Grade & Section</th>
                <th className="py-3 px-4">Incident / Concern</th>
                <th className="py-3 px-4">Date Reported</th>
                <th className="py-3 px-4">Current Status</th>
                <th className="py-3 px-4">Reported By</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredAlerts.map((item) => {
                const statusStyles: Record<string, string> = {
                  'Under investigation': 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
                  'Parent notified': 'bg-blue-50 text-blue-700 border-blue-200/80',
                  'Reported': 'bg-amber-50 text-amber-700 border-amber-200/80',
                };
                const badgeClass = statusStyles[item.status] || 'bg-slate-50 text-slate-700 border-slate-200';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                          {item.studentName.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-900">{item.studentName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {item.gradeLevel ? `Grade ${item.gradeLevel}` : '—'}
                      {item.sectionName ? ` • ${item.sectionName}` : ''}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{item.incidentType}</div>
                      <span className="inline-block text-[10px] font-medium text-slate-400">
                        {item.alertType} Concern
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
                      {item.reporterName}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedAlert(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition shadow-sm"
                      >
                        <Eye size={13} />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredAlerts.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center text-slate-400">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <HeartHandshake size={24} />
                      </div>
                      <div className="text-sm font-bold text-slate-700">No Active Welfare Alerts</div>
                      <p className="text-xs text-slate-500 mt-1">
                        All reported student disciplinary cases are resolved, or no cases currently require administrative attention.
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
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                    Welfare Case Oversight
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Case #{selectedAlert.id.slice(0, 8)}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1.5">{selectedAlert.incidentType}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
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
                  <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedAlert.studentName}</div>
                  <div className="text-slate-500 mt-0.5">
                    {selectedAlert.gradeLevel ? `Grade ${selectedAlert.gradeLevel}` : ''}
                    {selectedAlert.sectionName ? ` • Section ${selectedAlert.sectionName}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Current Status</div>
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                      <span>{selectedAlert.status}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Incident Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Incident Date</div>
                  <div className="font-semibold text-slate-800 mt-1">
                    {new Date(selectedAlert.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Reported By</div>
                  <div className="font-semibold text-slate-800 mt-1">{selectedAlert.reporterName}</div>
                </div>
              </div>

              {/* Case Notes */}
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                  Administrative Incident Notes
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 leading-relaxed min-h-[4rem]">
                  {selectedAlert.note ? selectedAlert.note : <span className="text-slate-400 italic">No notes provided.</span>}
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
                onClick={() => setSelectedAlert(null)}
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
