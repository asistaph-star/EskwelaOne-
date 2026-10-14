import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, User, Check, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { C } from '../../shared/constants/tokens';
import { useHardwareScanner } from '../../shared/hooks/useHardwareScanner';
import { useGateAttendanceSSE } from '../../shared/hooks/useGateAttendanceSSE';
import { facultyAttendanceApi, FacultyAttendanceItem, FacultyAttendanceSummary } from '../../../api/facultyAttendance.api';

export function PLiveFacultyAttendance({ onExit }: { onExit: () => void }) {
  const [facultyList, setFacultyList] = useState<FacultyAttendanceItem[]>([]);
  const [summary, setSummary] = useState<FacultyAttendanceSummary | null>(null);
  const [time, setTime] = useState(new Date());
  const [selectedTeacher, setSelectedTeacher] = useState<{ name: string; role: string; img?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Authoritative Faculty Attendance from PostgreSQL
  const loadData = useCallback(() => {
    Promise.all([
      facultyAttendanceApi.getList({ limit: 100 }),
      facultyAttendanceApi.getSummary(),
    ])
      .then(([listRes, summaryRes]) => {
        const items = Array.isArray(listRes?.data) ? listRes.data : (Array.isArray(listRes) ? listRes : []);
        setFacultyList(items);
        setSummary(summaryRes);
      })
      .catch(err => {
        console.error('Failed to load faculty attendance for TV monitor:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-Time SSE Listener
  const sseStatus = useGateAttendanceSSE(loadData);

  // Hardware Optical Scanner Integration (Allows scanning directly on this TV screen or gate)
  const scannerState = useHardwareScanner();

  useEffect(() => {
    if (scannerState.status === 'success' && scannerState.payload) {
      const p = scannerState.payload;
      const teacherName = p.teacherName || p.studentName || 'Faculty Member';
      const role = p.department ? `${p.department} • ${p.position || 'Teacher'}` : (p.position || 'Teacher');
      
      setSelectedTeacher({ 
        name: teacherName, 
        role: `${p.action}: ${role}` 
      });

      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
      loadData();

      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        setSelectedTeacher(current => current?.name === teacherName ? null : current);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [scannerState.status, scannerState.payload, loadData]);

  // Derived categorized groups
  const presentTeachers = useMemo(() => {
    return facultyList.filter(f => 
      (f.status === 'Completed' || f.status === 'Time Out Pending') &&
      (!f.timeInFormatted || f.timeInFormatted <= '07:30 AM')
    );
  }, [facultyList]);

  const lateTeachers = useMemo(() => {
    return facultyList.filter(f => 
      (f.status === 'Completed' || f.status === 'Time Out Pending') &&
      (f.timeInFormatted && f.timeInFormatted > '07:30 AM')
    );
  }, [facultyList]);

  const onLeaveTeachers = useMemo(() => {
    return facultyList.filter(f => f.status === 'On Leave' || f.status === 'Official Business');
  }, [facultyList]);

  const waitingTeachers = useMemo(() => {
    return facultyList.filter(f => f.status === 'Not Checked In');
  }, [facultyList]);

  const tTotal = facultyList.length;
  const tPresent = presentTeachers.length;
  const tLate = lateTeachers.length;
  const tLeave = onLeaveTeachers.length;
  const tWaiting = waitingTeachers.length;

  const bgHeader = '#2A0505'; // Deep dark CIS maroon
  const bgTicker = '#3D0808'; 
  const bgMain = '#FAF5F0'; // Warm off-white paper bg
  const bgCardLight = '#FFFFFF';
  
  const green = '#155E36';
  const yellow = '#92400E';
  const red = '#911818';
  const gray = '#8A7070';
  const textDark = '#190D0D';
  const textMuted = '#4A3232';

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(time);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: bgMain, color: textDark, fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>
      
      {/* HEADER */}
      <div style={{ background: bgHeader, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onExit} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <X size={20} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Exit TV</span>
          </button>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/school_seal.png" alt="CIS Seal" style={{ width: 40, height: 40, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.05em' }}>LIVE FACULTY ATTENDANCE MONITOR</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.03em' }}>{todayFormatted.toUpperCase()}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: sseStatus === 'live' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)', color: sseStatus === 'live' ? '#22c55e' : '#f59e0b', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, marginLeft: 16 }}>
            <div style={{ width: 6, height: 6, borderRadius: 6, background: sseStatus === 'live' ? '#22c55e' : '#f59e0b', animation: 'pulse 1.5s infinite' }} />
            {sseStatus === 'live' ? 'LIVE GATE STREAM' : 'RECONNECTING...'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* STATS */}
          <div style={{ display: 'flex', gap: 12 }}>
            <StatCard val={tTotal} label="Faculty" color="#fff" />
            <StatCard val={tPresent} label="Present" color={green} />
            <StatCard val={tLate} label="Late" color={yellow} />
            <StatCard val={tLeave} label="On Leave" color="#60a5fa" />
            <StatCard val={tWaiting} label="Not Yet In" color={gray} />
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
              {time.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ width: `${tTotal > 0 ? ((tPresent + tLate) / tTotal) * 100 : 0}%`, height: '100%', background: green, transition: 'width 1s' }} />
            </div>
          </div>
        </div>
      </div>

      {/* MAIN 4-COLUMN WALLBOARD */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr 1fr', gap: 20, padding: 20, overflow: 'hidden' }}>
        
        {/* 1. Waiting To Tap In */}
        <Column title="NOT YET CHECKED IN" count={tWaiting} color={gray}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 6, height: '100%' }}>
            {waitingTeachers.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: textMuted }}>
                <Check size={32} style={{ marginBottom: 12, color: green }} />
                <div style={{ fontWeight: 600 }}>All faculty checked in</div>
              </div>
            ) : (
              waitingTeachers.map(w => (
                <div key={w.teacherId} style={{ background: bgCardLight, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(139,30,30,0.12)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                     <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                       <User size={18} />
                     </div>
                     <div>
                       <div style={{ fontWeight: 700, fontSize: 13, color: textDark }}>{w.name}</div>
                       <div style={{ fontSize: 11, color: textMuted }}>{w.department} • <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{w.employeeId}</span></div>
                     </div>
                   </div>
                   <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: gray, background: '#f3f4f6', padding: '3px 8px', borderRadius: 6 }}>
                     Pending
                   </div>
                </div>
              ))
            )}
          </div>
        </Column>

        {/* 2. Present (On Time) */}
        <Column title="PRESENT (ON TIME)" count={tPresent} color={green}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 6, height: '100%' }}>
            {presentTeachers.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: textMuted }}>
                <Clock size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                <div>Awaiting arrivals</div>
              </div>
            ) : (
              presentTeachers.map(f => (
                <motion.div key={f.teacherId} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ background: bgCardLight, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(21,94,54,0.25)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer' }}
                  onClick={() => { confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } }); setSelectedTeacher({ name: f.name, role: `${f.department} • ${f.position}` }); }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: green }}>
                      <Check size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: textDark }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: textMuted }}>{f.department} • <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{f.employeeId}</span></div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: green, fontFamily: "'JetBrains Mono', monospace" }}>{f.timeInFormatted}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: f.timeOutFormatted ? '#2563eb' : '#059669' }}>
                      {f.timeOutFormatted ? `OUT ${f.timeOutFormatted}` : 'INSIDE'}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Column>

        {/* 3. Late Arrivals */}
        <Column title="LATE ARRIVALS" count={tLate} color={yellow}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 6, height: '100%' }}>
            {lateTeachers.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: textMuted }}>
                <Check size={32} style={{ marginBottom: 12, color: green }} />
                <div>No late arrivals</div>
              </div>
            ) : (
              lateTeachers.map(f => (
                <div key={f.teacherId} style={{ background: bgCardLight, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer' }}
                  onClick={() => { setSelectedTeacher({ name: f.name, role: `${f.department} • ${f.position}` }); }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: yellow }}>
                      <Clock size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: textDark }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: textMuted }}>{f.department} • <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{f.employeeId}</span></div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: yellow, fontFamily: "'JetBrains Mono', monospace" }}>{f.timeInFormatted}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: yellow }}>LATE</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Column>

        {/* 4. On Leave / Official Business */}
        <Column title="ON LEAVE / OB" count={tLeave} color="#2563eb">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 6, height: '100%' }}>
            {onLeaveTeachers.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: textMuted }}>
                <ShieldCheck size={32} style={{ marginBottom: 12, color: '#3b82f6', opacity: 0.6 }} />
                <div>No approved leaves today</div>
              </div>
            ) : (
              onLeaveTeachers.map(f => (
                <div key={f.teacherId} style={{ background: bgCardLight, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(59,130,246,0.25)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: textDark }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: textMuted }}>{f.department} • {f.position}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: 6 }}>
                    {f.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </Column>

      </div>

      {/* TICKER */}
      <div style={{ height: 52, background: bgTicker, color: '#fff', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', padding: '0 24px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 24, animation: 'scroll 35s linear infinite' }}>
          {facultyList.filter(f => f.timeInFormatted).length === 0 ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              Optical ID Gate Ready — Present teacher ID card to ONI B2D-0240 scanner to record attendance
            </div>
          ) : (
            facultyList.filter(f => f.timeInFormatted).map((f, i) => (
              <div key={`${f.teacherId}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', padding: '5px 14px', borderRadius: 20 }}>
                 <div style={{ width: 18, height: 18, borderRadius: 9, background: f.timeOutFormatted ? '#2563eb' : green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                   {f.timeOutFormatted ? 'OUT' : 'IN'}
                 </div>
                 <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{f.name}</span>
                 <span style={{ fontSize: 11, color: f.timeOutFormatted ? '#93c5fd' : '#86efac', fontFamily: "'JetBrains Mono', monospace" }}>
                   {f.timeOutFormatted ? f.timeOutFormatted : f.timeInFormatted}
                 </span>
                 <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{f.department}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        ::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.12);
          border-radius: 10px;
        }
      `}} />

      {selectedTeacher && (
        <LiveTapInOverlay teacher={selectedTeacher} onClose={() => setSelectedTeacher(null)} />
      )}
    </div>
  );
}

function StatCard({ val, label, color }: { val: number, label: string, color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

function Column({ title, count, color, children }: { title: string, count: number, color: string, children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', color: '#4B5563' }}>{title}</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color }}>{count}</div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function LiveTapInOverlay({ teacher, onClose }: { teacher: { name: string; role: string; img?: string }, onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(15,8,8,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: "#fff", borderRadius: 24, padding: "36px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", boxShadow: "0 24px 60px rgba(74,10,16,0.4)", maxWidth: 420, width: "100%", position: "relative" }}>
        
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 18, background: "rgba(0,0,0,0.05)", border: "none", color: "#666", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={20} />
        </button>

        <div style={{ width: 120, height: 120, borderRadius: 24, background: C.m50, border: `4px solid ${C.m100}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 32px rgba(0,0,0,0.1)", marginBottom: 20 }}>
          <User size={60} color={C.m700} />
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: C.m700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Faculty Gate Scan</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", lineHeight: 1.1, marginBottom: 8 }}>{teacher.name}</div>
        <div style={{ fontSize: 14, color: C.t2, fontWeight: 600 }}>{teacher.role}</div>

      </motion.div>
    </div>
  );
}
