import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, User, ArrowLeft, Radio } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { useHardwareScanner } from '../../shared/hooks/useHardwareScanner';
import { useGateAttendanceSSE } from '../../shared/hooks/useGateAttendanceSSE';
import { facultyAttendanceApi, FacultyAttendanceItem } from '../../../api/facultyAttendance.api';
import { useAppContext } from '../../shared/AppContext';

interface GateFeedEvent {
  id: string;
  name: string;
  metadata: string;
  direction: 'IN' | 'OUT' | 'INVALID';
  timestamp: Date;
  timeFormatted: string;
}

export function PLiveFacultyAttendance({ 
  onExit, 
  initialMode = 'faculty' 
}: { 
  onExit: () => void;
  initialMode?: 'student' | 'faculty';
}) {
  const [feedMode, setFeedMode] = useState<'student' | 'faculty'>(initialMode);
  const [facultyList, setFacultyList] = useState<FacultyAttendanceItem[]>([]);
  const [time, setTime] = useState(new Date());
  const { gateAttendance, invalidScans } = useAppContext();

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Authoritative Faculty Attendance from PostgreSQL
  const loadData = useCallback(() => {
    facultyAttendanceApi.getList({ limit: 100 })
      .then(res => {
        const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setFacultyList(items);
      })
      .catch(err => {
        console.error('Failed to load faculty attendance for TV monitor:', err);
        setFacultyList([]);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-Time SSE Listener
  const sseStatus = useGateAttendanceSSE(loadData);

  // Hardware Scanner Integration & Visual Feedback
  const scannerState = useHardwareScanner();
  useEffect(() => {
    if (scannerState.status === 'success') {
      loadData();
      if (scannerState.payload) {
        const p = scannerState.payload;
        const who = p.teacherName || p.studentName || 'Identifier';
        toast.success(`${who} — ${p.action} Recorded`, {
          description: `${p.employeeId || p.studentId || ''} • Verified Gate Scan`,
        });
      }
    } else if (scannerState.status === 'error' && scannerState.errorMessage) {
      toast.error('Gate Scan Rejected', {
        description: scannerState.errorMessage,
      });
    }
  }, [scannerState.status, scannerState.payload, scannerState.errorMessage, loadData]);

  // Transform authoritative FacultyAttendance rows into chronological scan events (newest first)
  // Per locked requirements: NO Late or Absent classification is applied.
  const facultyEvents = useMemo(() => {
    const events: GateFeedEvent[] = [];

    (facultyList || []).forEach(item => {
      const meta = [item.employeeId, item.department || item.position || 'Faculty'].filter(Boolean).join(' · ');

      if (item.timeIn) {
        const d = new Date(item.timeIn);
        events.push({
          id: `${item.teacherId}-in`,
          name: item.name,
          metadata: meta,
          direction: 'IN',
          timestamp: d,
          timeFormatted: item.timeInFormatted || d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
        });
      }

      if (item.timeOut) {
        const d = new Date(item.timeOut);
        events.push({
          id: `${item.teacherId}-out`,
          name: item.name,
          metadata: meta,
          direction: 'OUT',
          timestamp: d,
          timeFormatted: item.timeOutFormatted || d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
        });
      }
    });

    (invalidScans || []).forEach(scan => {
      const d = new Date(scan.time);
      events.push({
        id: `invalid-${scan.time}-${scan.barcode}`,
        name: 'Unrecognized Identifier',
        metadata: `Scanned: ${scan.barcode}`,
        direction: 'INVALID',
        timestamp: d,
        timeFormatted: d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
      });
    });

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [facultyList, invalidScans]);

  // Transform Student GateAttendance rows into chronological events (newest first)
  const studentEvents = useMemo(() => {
    const events: GateFeedEvent[] = [];

    (gateAttendance || []).forEach(record => {
      if (record.timeIn) {
        const d = new Date(record.timeIn);
        events.push({
          id: `${record.id}-in`,
          name: record.studentName,
          metadata: 'Grade 10 · Rizal',
          direction: 'IN',
          timestamp: d,
          timeFormatted: d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
        });
      }
      if (record.timeOut) {
        const d = new Date(record.timeOut);
        events.push({
          id: `${record.id}-out`,
          name: record.studentName,
          metadata: 'Grade 10 · Rizal',
          direction: 'OUT',
          timestamp: d,
          timeFormatted: d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
        });
      }
    });

    (invalidScans || []).forEach(scan => {
      const d = new Date(scan.time);
      events.push({
        id: `invalid-${scan.time}-${scan.barcode}`,
        name: 'Unrecognized Identifier',
        metadata: `Scanned: ${scan.barcode}`,
        direction: 'INVALID',
        timestamp: d,
        timeFormatted: d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
      });
    });

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [gateAttendance, invalidScans]);

  const activeEvents = feedMode === 'faculty' ? facultyEvents : studentEvents;
  const featuredLeft = activeEvents[0] || null;
  const featuredRight = activeEvents[1] || null;

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(time);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      
      {/* 1. TV TOP HEADER BAR */}
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
        <div className="flex items-center gap-6">
          <button 
            type="button"
            onClick={onExit}
            className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
          >
            <ArrowLeft size={16} />
            <span>Exit TV</span>
          </button>

          <div className="h-8 w-px bg-slate-800" />

          <div className="flex items-center gap-3.5">
            <img src="/school_seal.png" alt="School Seal" className="h-11 w-11 object-contain" />
            <div>
              <div className="text-base font-extrabold tracking-wider text-white uppercase font-serif">
                {feedMode === 'faculty' ? 'LIVE FACULTY GATE FEED' : 'LIVE STUDENT GATE FEED'}
              </div>
              <div className="text-[11px] font-semibold text-slate-400 tracking-wide">
                CALULUT INTEGRATED SCHOOL • {todayFormatted.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Center Mode Selector */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setFeedMode('student')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition ${
              feedMode === 'student'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Students</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              feedMode === 'student' ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-400'
            }`}>
              {studentEvents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFeedMode('faculty')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition ${
              feedMode === 'faculty'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Faculty</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              feedMode === 'faculty' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-400'
            }`}>
              {facultyEvents.length}
            </span>
          </button>
        </div>

        {/* Right Status & Digital Clock */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 rounded-full bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-bold">
            <span className={`h-2.5 w-2.5 rounded-full ${
              sseStatus === 'live' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
            }`} />
            <span className={sseStatus === 'live' ? 'text-emerald-400' : 'text-amber-400'}>
              {sseStatus === 'live' ? 'LIVE GATE STREAM' : 'RECONNECTING...'}
            </span>
          </div>

          <div className="text-right font-mono text-2xl font-black tracking-tight text-white">
            {time.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </header>

      {/* 2. MAIN TV BODY */}
      <main className="flex min-h-0 flex-1 flex-col gap-6 p-6 overflow-hidden">
        
        {/* Top Featured Latest 2 Scans (Matching Student Gate TV visual rhythm) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0 h-48 lg:h-52">
          <FeaturedScanCard event={featuredLeft} label="LATEST GATE SCAN" />
          <FeaturedScanCard event={featuredRight} label="PREVIOUS SCAN" />
        </div>

        {/* Bottom Multi-Column Chronological Feed (Newest First) */}
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-950/70 p-5 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
            <div className="flex items-center gap-2">
              <Radio size={15} className="text-emerald-400 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Chronological Activity Stream — {feedMode === 'faculty' ? 'Faculty Gate Scans' : 'Student Gate Scans'}
              </h2>
            </div>
            <div className="text-[11px] font-semibold text-slate-500">
              Newest activity at top • Server authoritative timestamps
            </div>
          </div>

          {activeEvents.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-500 py-12">
              <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                <User size={24} className="text-slate-600" />
              </div>
              <p className="text-sm font-bold text-slate-400">
                {feedMode === 'faculty' 
                  ? 'No faculty gate scans recorded today.' 
                  : 'No student gate scans recorded today.'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Scans captured at the gate terminal or via optical reader appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 overflow-y-auto pr-2">
              {activeEvents.map((ev) => (
                <div 
                  key={ev.id} 
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-4 py-3.5 shadow-sm hover:border-slate-700 transition"
                >
                  <div className="min-w-0 pr-3">
                    <div className="truncate text-sm font-bold text-white tracking-tight">
                      {ev.name}
                    </div>
                    <div className="truncate text-xs font-semibold text-slate-400 mt-0.5">
                      {ev.metadata}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <DirectionBadge direction={ev.direction} />
                    <span className="font-mono text-xs font-bold text-slate-300">
                      {ev.timeFormatted}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 3. TV FOOTER STATUS BAR */}
      <footer className="flex h-10 shrink-0 items-center justify-between border-t border-slate-800 bg-slate-950 px-6 text-xs text-slate-500 font-medium">
        <div>
          DIGISKWELA GATE MONITORING SYSTEM • CALULUT INTEGRATED SCHOOL
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-slate-400">{activeEvents.length} Total Today</span>
          <span>•</span>
          <span className="text-slate-400">Timezone: Asia/Manila (UTC+8)</span>
        </div>
      </footer>

      <Toaster position="top-right" richColors theme="dark" />
    </div>
  );
}

function DirectionBadge({ direction }: { direction: 'IN' | 'OUT' | 'INVALID' }) {
  if (direction === 'IN') {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
        TIME IN
      </span>
    );
  }

  if (direction === 'OUT') {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-400">
        TIME OUT
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-400">
      INVALID
    </span>
  );
}

function FeaturedScanCard({ event, label }: { event: GateFeedEvent | null; label: string }) {
  if (!event) {
    return (
      <div className="flex h-full flex-col justify-center items-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-slate-600">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
        <span className="text-sm font-semibold">Awaiting scan activity</span>
      </div>
    );
  }

  const isIn = event.direction === 'IN';
  const isInvalid = event.direction === 'INVALID';

  return (
    <div className={`relative flex h-full flex-col justify-between overflow-hidden rounded-xl border p-5 shadow-lg transition ${
      isInvalid 
        ? 'border-rose-900/60 bg-gradient-to-br from-rose-950/40 to-slate-950'
        : isIn 
          ? 'border-emerald-900/60 bg-gradient-to-br from-emerald-950/40 to-slate-950' 
          : 'border-blue-900/60 bg-gradient-to-br from-blue-950/40 to-slate-950'
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <DirectionBadge direction={event.direction} />
      </div>

      <div className="my-auto flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-white tracking-tight leading-tight">
            {event.name}
          </h3>
          <p className="text-sm font-semibold text-slate-300 mt-1">
            {event.metadata}
          </p>
        </div>

        <div className="text-right">
          <div className="font-mono text-3xl font-black tracking-tight text-white">
            {event.timeFormatted}
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            VERIFIED TIMESTAMP
          </div>
        </div>
      </div>

      <div className="h-1 w-full rounded-full overflow-hidden bg-slate-800">
        <div className={`h-full ${
          isInvalid ? 'bg-rose-500' : isIn ? 'bg-emerald-500' : 'bg-blue-500'
        } w-full`} />
      </div>
    </div>
  );
}
