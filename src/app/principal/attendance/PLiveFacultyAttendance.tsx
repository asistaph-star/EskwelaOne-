import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, ArrowLeft } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { useHardwareScanner } from '../../shared/hooks/useHardwareScanner';
import { useGateAttendanceSSE } from '../../shared/hooks/useGateAttendanceSSE';
import { facultyAttendanceApi, FacultyAttendanceItem } from '../../../api/facultyAttendance.api';
import { useAppContext } from '../../shared/AppContext';

export interface GateScanItem {
  id: string;
  entityType: 'STUDENT' | 'FACULTY';
  studentName?: string;
  teacherName?: string;
  employeeId?: string;
  department?: string;
  position?: string;
  action: 'Time In' | 'Time Out';
  time: string;
  timeFormatted: string;
}

interface PLiveFacultyAttendanceProps {
  onExit: () => void;
  initialMode?: 'student' | 'faculty';
}

export function PLiveFacultyAttendance({ onExit, initialMode = 'faculty' }: PLiveFacultyAttendanceProps) {
  const [feedMode, setFeedMode] = useState<'student' | 'faculty'>(initialMode);
  const [facultyList, setFacultyList] = useState<FacultyAttendanceItem[]>([]);
  const [time, setTime] = useState(new Date());
  const { gateAttendance } = useAppContext();

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

  // Hardware Scanner Integration
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
      toast.error('Scan Error', {
        description: scannerState.errorMessage,
      });
    }
  }, [scannerState.status, scannerState.payload, scannerState.errorMessage, loadData]);

  // Transform Authoritative Faculty Attendance into Chronological Gate Events (Newest First)
  // Per locked requirements: ZERO Late or Absent classification is applied.
  const facultyScans = useMemo(() => {
    const scans: GateScanItem[] = [];

    (facultyList || []).forEach(item => {
      if (item.timeIn) {
        const d = new Date(item.timeIn);
        scans.push({
          id: `${item.teacherId}-in`,
          entityType: 'FACULTY',
          teacherName: item.name,
          employeeId: item.employeeId,
          department: item.department || 'FACULTY',
          position: item.position || 'TEACHER',
          action: 'Time In',
          time: item.timeIn,
          timeFormatted: item.timeInFormatted || d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        });
      }

      if (item.timeOut) {
        const d = new Date(item.timeOut);
        scans.push({
          id: `${item.teacherId}-out`,
          entityType: 'FACULTY',
          teacherName: item.name,
          employeeId: item.employeeId,
          department: item.department || 'FACULTY',
          position: item.position || 'TEACHER',
          action: 'Time Out',
          time: item.timeOut,
          timeFormatted: item.timeOutFormatted || d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        });
      }
    });

    return scans.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [facultyList]);

  // Transform Authoritative Student GateAttendance into Chronological Gate Events (Newest First)
  const studentScans = useMemo(() => {
    const scans: GateScanItem[] = [];

    (gateAttendance || []).forEach(record => {
      if (record.timeIn) {
        const d = new Date(record.timeIn);
        scans.push({
          id: `${record.id}-in`,
          entityType: 'STUDENT',
          studentName: record.studentName || 'Student',
          action: 'Time In',
          time: record.timeIn,
          timeFormatted: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        });
      }

      if (record.timeOut) {
        const d = new Date(record.timeOut);
        scans.push({
          id: `${record.id}-out`,
          entityType: 'STUDENT',
          studentName: record.studentName || 'Student',
          action: 'Time Out',
          time: record.timeOut,
          timeFormatted: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        });
      }
    });

    return scans.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [gateAttendance]);

  const activeScans = feedMode === 'faculty' ? facultyScans : studentScans;
  const leftScan = activeScans[0] || null;
  const rightScan = activeScans[1] || null;

  return (
    <div className="relative flex h-screen w-full flex-col bg-gradient-to-b from-slate-100 to-white font-sans text-slate-800 overflow-hidden">
      
      {/* Huge Background Watermark — Identical to Student Gate Monitor */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.06] overflow-hidden">
        <img src="/school_seal.png" alt="Watermark" className="w-[250%] max-w-none md:w-[150%] lg:w-[130%] object-contain" />
      </div>

      {/* 1. Header Section — Identical to Student Gate Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b-2 border-amber-400 bg-slate-900 px-5 py-3 md:px-6">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
          >
            <ArrowLeft size={16} />
            <span>Exit TV</span>
          </button>

          <img src="/school_seal.png" alt="School Seal" className="h-10 w-10 object-contain md:h-12 md:w-12 lg:h-14 lg:w-14" />
          <div className="flex flex-col justify-center">
            <h1 className="text-lg font-semibold tracking-normal text-white md:text-xl lg:text-2xl leading-tight">
              CALULUT INTEGRATED SCHOOL
            </h1>
            <div className="text-[10px] font-semibold text-amber-400 tracking-wider uppercase">
              {feedMode === 'faculty' ? 'LIVE FACULTY GATE ATTENDANCE' : 'LIVE STUDENT GATE ATTENDANCE'}
            </div>
          </div>
        </div>

        {/* Center Mode Selector */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-1 border border-slate-700 shadow-inner">
          <button
            type="button"
            onClick={() => setFeedMode('student')}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold transition ${
              feedMode === 'student'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Students</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              feedMode === 'student' ? 'bg-blue-800 text-blue-100' : 'bg-slate-700 text-slate-400'
            }`}>
              {studentScans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFeedMode('faculty')}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold transition ${
              feedMode === 'faculty'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Faculty</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              feedMode === 'faculty' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-400'
            }`}>
              {facultyScans.length}
            </span>
          </button>
        </div>

        {/* Right Status Indicator & Clock */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-bold">
            <span className={`h-2 w-2 rounded-full ${
              sseStatus === 'live' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
            }`} />
            <span className={sseStatus === 'live' ? 'text-emerald-400' : 'text-amber-400'}>
              {sseStatus === 'live' ? 'LIVE GATE STREAM' : 'RECONNECTING...'}
            </span>
          </div>

          <div className="font-mono text-xl font-bold tracking-tight text-white">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </header>

      {/* 2. Central Content Area (Chronological Scans Grid) — Identical to Student Gate Monitor */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-8">
        
        {activeScans.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
            <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center mb-3 text-slate-500">
              <User size={32} />
            </div>
            <p className="text-base font-bold text-slate-700">
              {feedMode === 'faculty' ? 'No faculty gate scans recorded today.' : 'No student gate scans recorded today.'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Scans captured at the gate terminal appear here automatically.
            </p>
          </div>
        ) : (
          <div 
            className="relative z-10 h-full w-full columns-1 lg:columns-2 xl:columns-3 gap-6 space-y-3 overflow-hidden" 
            style={{ columnFill: 'auto' }}
          >
            {activeScans.slice(0, 32).map((scan, i) => {
              const isFaculty = scan.entityType === 'FACULTY';
              const displayName = isFaculty ? (scan.teacherName || 'Faculty Member') : (scan.studentName || 'Student');
              const subTitle = isFaculty 
                ? `${scan.employeeId || 'ID'} • ${scan.department || 'FACULTY'}${scan.position ? ` • ${scan.position}` : ''}`
                : 'GRADE 10 • RIZAL';
              const photoSrc = isFaculty ? '/school_seal.png' : '/student_photo.png';

              return (
                <div key={scan.id || i} className="flex h-[4.5rem] break-inside-avoid items-center gap-3 border-b border-slate-200 bg-white/50 px-3 transition-colors hover:bg-white rounded-lg shadow-sm">
                  <img src={photoSrc} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5" />
                  <div className="flex min-w-0 flex-col overflow-hidden justify-center space-y-0.5">
                    <div className="truncate text-xs font-bold uppercase tracking-tight text-slate-800 leading-none">
                      {displayName}
                    </div>
                    <div className="truncate text-[9px] font-semibold tracking-wider text-slate-500 uppercase leading-none">
                      {subTitle}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 leading-none">
                      <span className={scan.action === 'Time In' ? 'text-green-600' : 'text-blue-600'}>
                        {scan.action === 'Time In' ? 'IN' : 'OUT'}
                      </span>
                      <span>{scan.timeFormatted}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* State Overlays — Identical to Student Gate Monitor */}
        {scannerState.status === 'submitting' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-6 py-4 shadow-xl">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="text-sm font-semibold tracking-widest text-slate-700 uppercase">Processing</span>
            </div>
          </div>
        )}

        {scannerState.status === 'error' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center rounded-lg border border-red-100 bg-red-50/80 px-8 py-6 shadow-2xl max-w-sm text-center">
              <div className="text-sm font-bold tracking-widest text-red-600 uppercase">Scan Failed</div>
              <div className="mt-2 text-base font-medium text-slate-800">{scannerState.errorMessage}</div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Bottom Detailed Profile Section (Two side-by-side featured panels) — Identical to Student Gate Monitor */}
      <section className="relative z-10 flex h-72 shrink-0 justify-center gap-4 bg-transparent p-4 md:h-80 md:gap-8 md:p-6 lg:h-[26rem]">
        <div className="w-full max-w-md lg:max-w-lg">
          <ProfileCard scan={leftScan} />
        </div>
        <div className="w-full max-w-md lg:max-w-lg">
          <ProfileCard scan={rightScan} />
        </div>
      </section>

      {/* 4. Footer Section (Status Bar) — Identical to Student Gate Monitor */}
      <footer className="relative z-10 flex shrink-0 items-center justify-between bg-slate-900 px-6 py-2.5 text-xs font-bold tracking-widest text-white shadow-inner">
        <div className="text-[10px] text-slate-400">
          BIOMETRIC SYSTEM - STATUS: ONLINE
        </div>
        <div className="flex items-center gap-6">
          <span className="text-xs text-slate-400 font-mono">{activeScans.length} Total Today</span>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">SCANNER READY</span>
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
          </div>
        </div>
      </footer>

      <Toaster position="top-right" richColors />
    </div>
  );
}

function ProfileCard({ scan }: { scan: GateScanItem | null }) {
  if (!scan) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/50">
        <span className="text-sm font-bold tracking-widest text-slate-400 uppercase">Awaiting Scan</span>
      </div>
    );
  }

  const isIn = scan.action === 'Time In';
  const isFaculty = scan.entityType === 'FACULTY';
  const displayName = isFaculty ? (scan.teacherName || 'Faculty Member') : (scan.studentName || 'Student');
  const subTitle = isFaculty 
    ? `${scan.employeeId || 'ID'} • ${scan.department || 'FACULTY'}${scan.position ? ` • ${scan.position}` : ''}`
    : 'GRADE 10 • RIZAL';
  const photoSrc = isFaculty ? '/school_seal.png' : '/student_photo.png';
  
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      
      {/* Top Status & Time Stamp */}
      <div className="absolute left-5 top-4 z-10 flex flex-col items-center">
        <span className={`text-4xl md:text-5xl lg:text-7xl font-black leading-none tracking-tighter ${isIn ? 'text-red-600' : 'text-emerald-600'}`}>
          {isIn ? 'IN' : 'OUT'}
        </span>
        <span className={`text-[10px] md:text-xs font-extrabold uppercase tracking-widest ${isIn ? 'text-red-700' : 'text-emerald-700'} -mt-1`}>
          CHECKED
        </span>
      </div>

      <div className="absolute right-5 top-5 z-10">
        <span className="text-xl md:text-2xl font-black tracking-tight text-slate-800">
          {scan.timeFormatted}
        </span>
      </div>

      {/* Large Profile Picture */}
      <div className="flex min-h-0 flex-1 w-full items-end justify-center bg-white pt-6">
        <img 
          src={photoSrc} 
          alt={displayName} 
          className="h-full object-contain mix-blend-multiply" 
        />
      </div>

      {/* Colored Label Bar */}
      <div className={`flex w-full shrink-0 flex-col items-center ${isFaculty ? 'bg-indigo-700' : 'bg-slate-600'} py-3.5 text-white md:py-4`}>
        <h2 className="text-lg font-bold uppercase tracking-wider md:text-xl lg:text-2xl">
          {displayName}
        </h2>
        <div className="mt-0.5 text-xs font-semibold tracking-widest text-slate-300 md:text-sm">
          {subTitle}
        </div>
      </div>
    </div>
  );
}
