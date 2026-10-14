import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { facultyAttendanceApi, FacultyPunchStatus } from '../../../api/facultyAttendance.api';

export function TeacherPunchCard({ className }: { onAttendanceChange?: () => void; className?: string }) {
  const [punchData, setPunchData] = useState<FacultyPunchStatus | null>(null);
  const [loading, setLoading] = useState(true);

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
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-800">
            <Clock size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-serif">Today's Gate Attendance</h3>
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

      {/* Read-Only Time Slots */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        {/* Time In Card */}
        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Time In (Gate Arrival)</div>
          <div className="flex items-center gap-1.5 font-bold font-mono text-sm">
            {punchData?.hasTimedIn ? (
              <>
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-emerald-700">{punchData.timeInFormatted || 'Recorded'}</span>
              </>
            ) : (
              <span className="text-slate-400 font-sans text-xs">Not recorded</span>
            )}
          </div>
        </div>

        {/* Time Out Card */}
        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex flex-col justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Time Out (Gate Departure)</div>
          <div className="flex items-center gap-1.5 font-bold font-mono text-sm">
            {punchData?.hasTimedOut ? (
              <>
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-emerald-700">{punchData.timeOutFormatted || 'Recorded'}</span>
              </>
            ) : (
              <span className="text-slate-400 font-sans text-xs">
                {punchData?.hasTimedIn ? 'Time Out Pending' : '—'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Guidance footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
        <span>Attendance is recorded automatically when you scan your school ID at the gate.</span>
      </div>

      {punchData?.remarks && (
        <p className="mt-2 text-[11px] text-slate-500 italic">Note: {punchData.remarks}</p>
      )}
    </div>
  );
}
