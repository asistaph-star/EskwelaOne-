import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { facultyAttendanceApi, FacultyPunchStatus } from '../../../api/facultyAttendance.api';

export function TeacherPunchCard({ onAttendanceChange, className }: { onAttendanceChange?: () => void; className?: string }) {
  const [punchData, setPunchData] = useState<FacultyPunchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    facultyAttendanceApi.getTeacherPunchStatus()
      .then(data => {
        setPunchData(data);
      })
      .catch(err => {
        console.error('Failed to load punch status:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTimeIn = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      await facultyAttendanceApi.recordTimeIn();
      setMessage({ type: 'success', text: 'Time In recorded successfully!' });
      fetchStatus();
      if (onAttendanceChange) onAttendanceChange();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to record Time In' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTimeOut = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      await facultyAttendanceApi.recordTimeOut();
      setMessage({ type: 'success', text: 'Time Out recorded successfully!' });
      fetchStatus();
      if (onAttendanceChange) onAttendanceChange();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to record Time Out' });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">Completed</span>;
      case 'Time Out Pending':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">Time Out Pending</span>;
      case 'On Leave':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">On Leave</span>;
      case 'Official Business':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">Official Business</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">Not Checked In</span>;
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-800">
            <Clock size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-serif">Daily Punch Card</h3>
            <p className="text-xs text-slate-500">{punchData?.date || 'Today'}</p>
          </div>
        </div>
        <div>
          {loading ? (
            <span className="text-xs text-slate-400">Loading...</span>
          ) : (
            getStatusBadge(punchData?.status)
          )}
        </div>
      </div>

      {/* Message feedback */}
      {message && (
        <div className={`mt-3 p-2.5 rounded-md text-xs flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {message.type === 'success' ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Time Slots */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        {/* Time In Card / Action */}
        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Time In (Arrival)</div>
          {punchData?.hasTimedIn ? (
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold font-mono text-sm">
              <CheckCircle2 size={14} />
              <span>{punchData.timeInFormatted || 'Recorded'}</span>
            </div>
          ) : (
            <button
              onClick={handleTimeIn}
              disabled={loading || actionLoading || punchData?.status === 'On Leave' || punchData?.status === 'Official Business'}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={13} />}
              <span>Time In</span>
            </button>
          )}
        </div>

        {/* Time Out Card / Action */}
        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Time Out (Departure)</div>
          {punchData?.hasTimedOut ? (
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold font-mono text-sm">
              <CheckCircle2 size={14} />
              <span>{punchData.timeOutFormatted || 'Recorded'}</span>
            </div>
          ) : (
            <button
              onClick={handleTimeOut}
              disabled={loading || actionLoading || !punchData?.hasTimedIn}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={13} />}
              <span>Time Out</span>
            </button>
          )}
        </div>
      </div>

      {punchData?.remarks && (
        <p className="mt-2 text-[11px] text-slate-500 italic">Note: {punchData.remarks}</p>
      )}
    </div>
  );
}
