import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Calendar, Users, CheckCircle2, Clock, CalendarDays, Briefcase, UserX, ChevronLeft, ChevronRight } from 'lucide-react';
import { facultyAttendanceApi, FacultyAttendanceItem, FacultyAttendanceSummary, getManilaTodayDateString } from '../../../api/facultyAttendance.api';
import { useSchoolSettings } from '../../shared/context/SchoolSettingsContext';

export function FacultyAttendanceTable() {
  const { settings } = useSchoolSettings();
  const [date, setDate] = useState<string>(getManilaTodayDateString());
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  const [records, setRecords] = useState<FacultyAttendanceItem[]>([]);
  const [summary, setSummary] = useState<FacultyAttendanceSummary | null>(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [listRes, summaryRes] = await Promise.all([
        facultyAttendanceApi.getList({
          date,
          status: statusFilter,
          search: search.trim() || undefined,
          page,
          limit
        }),
        facultyAttendanceApi.getSummary(date)
      ]);

      setRecords(listRes.data || []);
      setPagination(listRes.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
      setSummary(summaryRes);
    } catch (err: any) {
      console.error('Failed to load faculty attendance:', err);
      setError(err.message || 'Failed to load faculty attendance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date, search, statusFilter, page, limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setPage(1);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const renderStatusBadge = (status: FacultyAttendanceItem['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Completed
          </span>
        );
      case 'Time Out Pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            Time Out Pending
          </span>
        );
      case 'On Leave':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            On Leave
          </span>
        );
      case 'Official Business':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
            Official Business
          </span>
        );
      case 'Not Checked In':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            Not Checked In
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold font-serif text-white tracking-wide">
              Daily Faculty Attendance
            </h2>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              PRIN-014 Read-Only
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {settings.schoolName ? `${settings.schoolName} · ` : ''}Official Faculty Attendance Roster (Asia/Manila)
          </p>
        </div>

        {/* Date Selector and Refresh Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => handleDateChange(getManilaTodayDateString())}
            className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition"
          >
            Today
          </button>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-50"
            title="Refresh Attendance List"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-amber-400' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Chips / Status Ribbon */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Total Active Faculty</span>
              <Users size={14} className="text-slate-400" />
            </div>
            <div className="text-lg font-extrabold text-slate-900 mt-1">
              {summary?.totalActiveFaculty ?? 0}
            </div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
              <span>Completed</span>
              <CheckCircle2 size={14} className="text-emerald-500" />
            </div>
            <div className="text-lg font-extrabold text-emerald-800 mt-1">
              {summary?.completedCount ?? 0}
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs text-amber-700 font-medium">
              <span>Time Out Pending</span>
              <Clock size={14} className="text-amber-500" />
            </div>
            <div className="text-lg font-extrabold text-amber-800 mt-1">
              {summary?.timeOutPendingCount ?? 0}
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs text-blue-700 font-medium">
              <span>On Leave</span>
              <CalendarDays size={14} className="text-blue-500" />
            </div>
            <div className="text-lg font-extrabold text-blue-800 mt-1">
              {summary?.onLeaveCount ?? 0}
            </div>
          </div>

          <div className="bg-white border border-purple-200 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs text-purple-700 font-medium">
              <span>Official Business</span>
              <Briefcase size={14} className="text-purple-500" />
            </div>
            <div className="text-lg font-extrabold text-purple-800 mt-1">
              {summary?.officialBusinessCount ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search faculty name, employee ID, department..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-800 focus:border-red-800 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Status Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Time Out Pending">Time Out Pending</option>
            <option value="On Leave">On Leave</option>
            <option value="Official Business">Official Business</option>
            <option value="Not Checked In">Not Checked In</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs">
          Error loading attendance records: {error}
        </div>
      )}

      {/* Attendance Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4">Teacher Name</th>
              <th className="py-3 px-4">Employee ID</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Position / Rank</th>
              <th className="py-3 px-4">Time In</th>
              <th className="py-3 px-4">Time Out</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                    <RefreshCw size={16} className="animate-spin text-red-800" />
                    <span>Loading faculty attendance records...</span>
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <UserX size={28} className="text-slate-300" />
                    <p className="font-semibold text-slate-700">No faculty records found</p>
                    <p className="text-[11px] text-slate-400">
                      No teachers matched the search or filter criteria for {date}.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((item) => (
                <tr
                  key={item.teacherId}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {item.employeeId || '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {item.department || 'General'}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {item.position || 'Teacher'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                    {item.timeInFormatted ? (
                      <span className="text-emerald-700 font-semibold">{item.timeInFormatted}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                    {item.timeOutFormatted ? (
                      <span className="text-emerald-700 font-semibold">{item.timeOutFormatted}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {renderStatusBadge(item.status)}
                    {item.remarks && (
                      <div className="text-[10px] text-slate-400 italic mt-0.5" title={item.remarks}>
                        {item.remarks.length > 25 ? `${item.remarks.slice(0, 25)}...` : item.remarks}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loading && pagination.total > 0 && (
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-800">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
            <span className="font-semibold text-slate-800">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
            <span className="font-semibold text-slate-800">{pagination.total}</span> faculty members
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="p-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 py-0.5 text-xs font-semibold text-slate-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
