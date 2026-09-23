import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { CalendarEvent, EVENT_TYPE_CONFIG } from '../../shared/data/calendarData';
import { useAppContext } from '../../shared/AppContext';
import { Calendar, ChevronLeft, ChevronRight, Lock, Plus, X, Save, Trash2 } from 'lucide-react';
import { apiClient } from '../../../api/client';

export function CalendarScreen() {
  function formatTimeDisplay(timeStr?: string) {
    if (!timeStr) return "";
    let [h, m] = timeStr.split(":");
    let hr = parseInt(h);
    let ampm = hr >= 12 ? " PM" : " AM";
    hr = hr % 12 || 12;
    return `${hr}${m !== "00" ? ":" + m : ""}${ampm}`;
  }

  const { currentUser } = useAppContext();
  const [backendEvents, setBackendEvents] = React.useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ title: string, date: string, time: string, endTime: string, type: CalendarEvent["type"], audience: CalendarEvent["audience"] }>({ title: "", date: "", time: "", endTime: "", type: "academic", audience: "students" });
  const [currentMonth, setCurrentMonth] = useState(new Date());

  React.useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/events');
      if (Array.isArray(res)) setBackendEvents(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  const allEvents = backendEvents
    .filter(e => e.audience === "all" || e.audience === "teachers" || e.audience === "students" || e.created_by_id === currentUser?.id)
    .map(dbEv => {
      const colors: Record<string, string> = { academic: "#15803d", meeting: "#1e40af", holiday: "#b91c1c", exam: "#9333ea", personal: "#0ea5e9" };
      const d = new Date(dbEv.date);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStrLocal = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      
      let endTimeStr = "";
      if (dbEv.end_date) {
        const ed = new Date(dbEv.end_date);
        endTimeStr = `${pad(ed.getHours())}:${pad(ed.getMinutes())}`;
      }
      
      return {
        id: dbEv.id,
        title: dbEv.title,
        date: dateStrLocal,
        time: timeStr,
        endTime: endTimeStr,
        type: dbEv.type,
        color: colors[dbEv.type] || "#0ea5e9",
        locked: dbEv.created_by_id !== currentUser?.id,
        audience: dbEv.audience
      } as CalendarEvent;
    });
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  let startingDayIndex = firstDay.getDay() - 1;
  if (startingDayIndex === -1) startingDayIndex = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const numRows = Math.ceil((startingDayIndex + daysInMonth) / 7);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthYearStr = `${monthNames[month]} ${year}`;

  function handlePrevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
  }
  function handleNextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
  }

  async function handleAddPersonal() {
    if (!form.title || !form.date) return;
    
    const dateTime = new Date(`${form.date}T${form.time || "00:00"}:00`);
    const endDateTime = form.endTime ? new Date(`${form.date}T${form.endTime}:00`) : null;
    
    const payload = {
      title: form.title,
      type: form.type,
      audience: form.audience,
      date: dateTime.toISOString(),
      end_date: endDateTime ? endDateTime.toISOString() : null,
    };
    
    try {
      await apiClient.post('/admin/events', payload);
      await fetchEvents();
      setForm({ title: "", date: "", time: "", endTime: "", type: "academic", audience: "students" });
      setShowForm(false);
    } catch(err: any) {
      console.error("EVENT SAVE ERROR:", err);
      alert(`Error: ${err.message}`);
    }
  }

  async function handleRemovePersonal(id: string) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await apiClient.delete(`/admin/events/${id}`);
      setBackendEvents(prev => prev.filter(e => e.id !== id));
    } catch(err: any) {
      console.error(err);
      alert(`Error deleting event: ${err.message}`);
    }
  }

  const sorted = [...allEvents].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 28, background: "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Academic Calendar</div>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>School events (🔒) are set by admin. Your personal events are editable.</div>
        </div>
        <button onClick={() => { setShowForm(true); setForm({ title: "", date: "", time: "", endTime: "", type: "personal", audience: "teachers" }); }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: C.m700, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "background 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.background = C.m800}
          onMouseLeave={e => e.currentTarget.style.background = C.m700}
        >
          <Plus size={14} /> Add Personal Event
        </button>
      </div>


      {error && (
        <div style={{ background: '#fef2f2', color: '#ef4444', padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 13, border: '1px solid #fecaca' }}>
          <strong>Error loading events:</strong> {error}
        </div>
      )}

      {/* Calendar Grid */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", marginBottom: 24, boxShadow: "0 4px 20px rgba(139,30,30,0.05)" }}>
        <div style={{ background: C.m800, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={handlePrevMonth} style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}><ChevronLeft size={14} color="#fff" /></button>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>{monthYearStr}</span>
          <button onClick={handleNextMonth} style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}><ChevronRight size={14} color="#fff" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${C.borderMed}`, background: "#fafafa" }}>
          {days.map(d => <div key={d} style={{ textAlign: "center", padding: "10px 4px", fontSize: 10, fontWeight: 700, color: C.t3, letterSpacing: "0.07em", textTransform: "uppercase", borderRight: `1px solid ${C.border}` }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {[...Array(numRows)].map((_, r) =>
            days.map((_, col) => {
              const day = r * 7 + col - startingDayIndex + 1;
              const valid = day >= 1 && day <= daysInMonth;
              const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents = allEvents.filter(e => e.date === dayStr);
              return (
                <div key={`${r}-${col}`} 
                  onClick={() => {
                    if (valid) {
                      setForm({ title: "", date: dayStr, time: "", endTime: "", type: "academic", audience: "students" });
                      setShowForm(true);
                    }
                  }}
                  style={{ 
                    minHeight: 100, 
                    padding: "6px 6px", 
                    borderRight: `1px solid ${C.border}`, 
                    borderBottom: `1px solid ${C.border}`, 
                    background: valid ? "#fff" : "#fafafa",
                    cursor: valid ? "pointer" : "default",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={e => { if(valid) e.currentTarget.style.background = "#f4f4f4"; }}
                  onMouseLeave={e => { if(valid) e.currentTarget.style.background = "#fff"; }}
                >
                  {valid && <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: col >= 5 ? C.t3 : C.t1, marginBottom: 8, padding: "2px 4px" }}>{day}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {loading && dayEvents.length === 0 && day === 1 ? <div style={{fontSize: 9, color: C.t3}}>Loading...</div> : null}
                      {dayEvents.map(ev => {
                        const timeStr = formatTimeDisplay(ev.time);
                        const endStr = formatTimeDisplay(ev.endTime);
                        const fullTime = timeStr ? (endStr ? `${timeStr} - ${endStr}` : timeStr) : "All day";
                        return (
                          <div key={ev.id} 
                            onClick={(e) => { e.stopPropagation(); alert(`Event: ${ev.title}\nDate: ${ev.date}${fullTime ? `\nTime: ${fullTime}` : ''}`); }}
                            style={{ display: "flex", flexDirection: "column", padding: "5px 6px", borderRadius: 6, background: ev.color + "12", transition: "background 0.2s", cursor: "pointer" }}
                            onMouseEnter={e => e.currentTarget.style.background = ev.color + "20"}
                            onMouseLeave={e => e.currentTarget.style.background = ev.color + "12"}>
                            <div style={{ fontSize: 9.5, color: ev.color, fontWeight: 800, lineHeight: 1.2, filter: "brightness(0.75)", display: "flex", alignItems: "center", gap: 3 }}>
                              {ev.locked && <Lock size={8} />}
                              {ev.title}
                            </div>
                            {fullTime && <div style={{ fontSize: 8, color: ev.color, fontWeight: 700, marginTop: 2, filter: "brightness(0.9)", opacity: 0.85 }}>{fullTime}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </>}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.t2 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: C.m700, display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={6} color="#fff" /></div>
          School Event (Locked)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.t2 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "#0ea5e9" }} />
          Personal Event (Editable)
        </div>
      </div>

      {/* Upcoming Events List */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderMed}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Upcoming Events</div>
        </div>
        {sorted.map(ev => {
          const cfg = EVENT_TYPE_CONFIG[ev.type];
          return (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ width: 4, height: 36, borderRadius: 2, background: ev.color, flexShrink: 0 }} />
              {ev.locked ? <Lock size={13} color={ev.color} style={{ flexShrink: 0 }} /> : <Calendar size={13} color={ev.color} style={{ flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, display: "flex", alignItems: "center", gap: 6 }}>
                  {ev.title}
                  {ev.locked && <span style={{ fontSize: 8, fontWeight: 700, color: C.m700, background: C.m50, padding: "1px 5px", borderRadius: 3, border: `1px solid ${C.borderMed}` }}>SCHOOL</span>}
                </div>
                <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{ev.date} · {cfg.label}</div>
              </div>
              {!ev.locked && (
                <button onClick={() => handleRemovePersonal(ev.id)} style={{ width: 28, height: 28, borderRadius: 4, background: "#fef2f2", border: "1px solid #fecaca", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trash2 size={12} color="#ef4444" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <style>{`
            @keyframes slideUp {
              0% { opacity: 0; transform: translateY(20px) scale(0.95); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 480, boxShadow: "0 10px 40px rgba(0,0,0,0.2)", position: "relative", animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif" }}>New Personal Event</div>
              <button onClick={() => setShowForm(false)} style={{ background: C.m50, border: "none", borderRadius: 16, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.t2, transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="#e2e8f0"} onMouseLeave={e=>e.currentTarget.style.background=C.m50}><X size={16} /></button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Title</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Parent Conference"
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", transition: "border-color 0.2s" }} onFocus={e=>e.currentTarget.style.borderColor=C.m700} onBlur={e=>e.currentTarget.style.borderColor=C.borderMed} />
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", fontFamily: "inherit" }} onFocus={e=>e.currentTarget.style.borderColor=C.m700} onBlur={e=>e.currentTarget.style.borderColor=C.borderMed} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Start Time</label>
                  <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", fontFamily: "inherit" }} onFocus={e=>e.currentTarget.style.borderColor=C.m700} onBlur={e=>e.currentTarget.style.borderColor=C.borderMed} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>End Time</label>
                  <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", fontFamily: "inherit" }} onFocus={e=>e.currentTarget.style.borderColor=C.m700} onBlur={e=>e.currentTarget.style.borderColor=C.borderMed} />
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", background: "#fff", cursor: "pointer", fontFamily: "inherit" }} onFocus={e=>e.currentTarget.style.borderColor=C.m700} onBlur={e=>e.currentTarget.style.borderColor=C.borderMed}>
                    <option value="academic">Academic</option>
                    <option value="meeting">Meeting</option>
                    <option value="holiday">Holiday</option>
                    <option value="exam">Exam</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Audience</label>
                  <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value as any })}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", background: "#fff", cursor: "pointer", fontFamily: "inherit" }} onFocus={e=>e.currentTarget.style.borderColor=C.m700} onBlur={e=>e.currentTarget.style.borderColor=C.borderMed}>
                    <option value="students">My Students Only</option>
                    <option value="teachers">Just Me (Personal)</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, gap: 12 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "10px 16px", background: "none", color: C.t2, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAddPersonal} style={{ padding: "10px 20px", background: C.m700, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background=C.m800} onMouseLeave={e=>e.currentTarget.style.background=C.m700}>
                <Save size={14} /> Save Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}