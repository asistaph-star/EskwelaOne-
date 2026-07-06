import React, { useState, useEffect } from 'react';
import { X, User, Check, Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock Data
const INITIAL_FACULTY = [
  { id: '1', name: 'Redmond, Mark', role: 'Mathematics Teacher', dept: 'Math', time: '07:53:44 AM', status: 'present', ago: '1 min ago', img: 'https://i.pravatar.cc/150?u=1' },
  { id: '2', name: 'Ababa, Jerome', role: 'Computer Science', dept: 'CS', time: '07:58:19 AM', status: 'present', ago: '4 min ago', img: 'https://i.pravatar.cc/150?u=2' },
  { id: '3', name: 'Denis Santos, Angel', role: 'Music Teacher', dept: 'MAPEH', time: '07:59:24 AM', status: 'present', ago: '5 min ago', img: 'https://i.pravatar.cc/150?u=3' },
  { id: '4', name: 'Cruz, Hazel', role: 'Science Teacher', dept: 'Science', time: '07:53:54 AM', status: 'present', ago: '2 min ago', img: 'https://i.pravatar.cc/150?u=4' },
  { id: '5', name: 'Aquino, Patrick', role: 'English Teacher', dept: 'English', time: '08:18:32 AM', status: 'late', ago: '8 min ago', img: 'https://i.pravatar.cc/150?u=5' },
  { id: '6', name: 'Lim, Patrick', role: 'Math Teacher', dept: 'Math', time: '08:23:15 AM', status: 'late', ago: '4 min ago', img: 'https://i.pravatar.cc/150?u=6' },
];

const WAITING_LIST = [
  { id: '10', name: 'Gomez, Maria', role: 'Science Teacher', dept: 'Science', img: 'https://i.pravatar.cc/150?u=10' },
  { id: '11', name: 'Reyes, John', role: 'History Teacher', dept: 'AP', img: 'https://i.pravatar.cc/150?u=11' }
];

export function PLiveFacultyAttendance({ onExit }: { onExit: () => void }) {
  const [faculty, setFaculty] = useState(INITIAL_FACULTY);
  const [waiting, setWaiting] = useState(WAITING_LIST);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate real-time check-ins
  useEffect(() => {
    const checkInTimer = setInterval(() => {
      setWaiting(prev => {
        if (prev.length === 0) return prev;
        const nextPerson = prev[0];
        const newRest = prev.slice(1);
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        setFaculty(f => [{
          ...nextPerson,
          time: timeStr,
          status: 'present',
          ago: 'Just now'
        }, ...f]);
        
        return newRest;
      });
    }, 15000); // someone checks in every 15s for demo

    return () => clearInterval(checkInTimer);
  }, []);

  const tPresent = faculty.filter(f => f.status === 'present').length;
  const tLate = faculty.filter(f => f.status === 'late').length;
  const tAbsent = faculty.filter(f => f.status === 'absent').length;
  const tWaiting = waiting.length;
  const tTotal = tPresent + tLate + tAbsent + tWaiting;

  const bgDark = '#2A0505'; // Deep dark maroon
  const bgHeader = '#2A0505';
  const bgTicker = '#3D0808'; 
  const bgMain = '#F3F4F6'; // Light background for main area
  const bgCardLight = '#FFFFFF';
  
  const green = '#10b981';
  const yellow = '#f59e0b';
  const red = '#ef4444';
  const gray = '#6b7280';
  const textDark = '#111827';
  const textMuted = '#6B7280';
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: bgMain, color: textDark, fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>
      
      {/* HEADER */}
      <div style={{ background: bgHeader, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onExit} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <X size={20} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Exit</span>
          </button>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #A52828 0%, #6B1616 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <span style={{ fontWeight: 800 }}>E1</span>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.05em' }}>LIVE TEACHER ATTENDANCE</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>July 4, 2026 - Sindalan National High School</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.2)', color: red, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, marginLeft: 16 }}>
            <div style={{ width: 6, height: 6, borderRadius: 6, background: red, animation: 'pulse 1.5s infinite' }} />
            LIVE
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* STATS */}
          <div style={{ display: 'flex', gap: 12 }}>
            <StatCard val={tTotal} label="Total" color="#fff" />
            <StatCard val={tPresent} label="Present" color={green} />
            <StatCard val={tLate} label="Late" color={yellow} />
            <StatCard val={tAbsent} label="Absent" color={red} />
            <StatCard val={tWaiting} label="Not Yet In" color={gray} />
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
              {time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(tPresent+tLate)/tTotal * 100}%`, height: '100%', background: green, transition: 'width 1s' }} />
            </div>
          </div>
        </div>
      </div>

      {/* MAIN COLUMNS */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1fr', gap: 24, padding: 24, overflow: 'hidden' }}>
        
        {/* Waiting */}
        <Column title="WAITING TO TAP IN" count={tWaiting} color={gray}>
          <AnimatePresence>
            {waiting.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: textMuted }}>
                <Check size={32} style={{ marginBottom: 12 }} />
                <div>All clear</div>
              </motion.div>
            ) : (
              waiting.map(w => (
                <motion.div key={w.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50 }} style={{ background: bgCardLight, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                   <img src={w.img} style={{ width: 40, height: 40, borderRadius: 20 }} alt="" />
                   <div>
                     <div style={{ fontWeight: 600, fontSize: 14, color: textDark }}>{w.name}</div>
                     <div style={{ fontSize: 11, color: textMuted }}>{w.role}</div>
                   </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </Column>

        {/* Present */}
        <Column title="PRESENT" count={tPresent} color={green}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 8, height: '100%' }}>
            <AnimatePresence>
              {faculty.filter(f => f.status === 'present').map(f => (
                <motion.div key={f.id} layout initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} style={{ background: bgCardLight, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={f.img} style={{ width: 44, height: 44, borderRadius: 22 }} alt="" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: textDark }}>{f.name}</div>
                      <div style={{ fontSize: 12, color: textMuted }}>{f.role}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: green }}>{f.time}</div>
                    <div style={{ fontSize: 11, color: textMuted }}>{f.ago}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Column>

        {/* Late */}
        <Column title="LATE" count={tLate} color={yellow}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 8, height: '100%' }}>
             {faculty.filter(f => f.status === 'late').map(f => (
                <div key={f.id} style={{ background: bgCardLight, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={f.img} style={{ width: 40, height: 40, borderRadius: 20 }} alt="" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: textDark }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: textMuted }}>{f.role}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: yellow }}>{f.time}</div>
                    <div style={{ fontSize: 10, color: textMuted }}>{f.ago}</div>
                  </div>
                </div>
              ))}
          </div>
        </Column>

        {/* Absent */}
        <Column title="ABSENT" count={tAbsent} color={red}>
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: textMuted }}>
              <AlertCircle size={32} style={{ marginBottom: 12 }} />
              <div>None recorded yet</div>
            </div>
        </Column>

      </div>

      {/* TICKER */}
      <div style={{ height: 60, background: bgTicker, color: '#fff', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', padding: '0 24px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 24, animation: 'scroll 30s linear infinite' }}>
          {faculty.map((f, i) => (
            <div key={`${f.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: 20 }}>
               <img src={f.img} style={{ width: 24, height: 24, borderRadius: 12 }} alt="" />
               <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                 <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{f.name}</span>
                 <span style={{ fontSize: 11, color: f.status === 'present' ? green : yellow }}>Tapped In</span>
                 <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{f.ago}</span>
               </div>
            </div>
          ))}
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
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.15);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}

function StatCard({ val, label, color }: { val: number, label: string, color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function Column({ title, count, color, children }: { title: string, count: number, color: string, children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', color: '#4B5563' }}>{title}</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>{count}</div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
