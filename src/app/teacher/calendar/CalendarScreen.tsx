import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { SCHOOL_EVENTS, TEACHER_PERSONAL_EVENTS, CalendarEvent, EVENT_TYPE_CONFIG } from '../../shared/data/calendarData';
import { Calendar, ChevronLeft, ChevronRight, Lock, Plus, X, Save, Trash2 } from 'lucide-react';

export function CalendarScreen() {
  function formatTimeDisplay(timeStr?: string) {
    if (!timeStr) return "";
    let [h, m] = timeStr.split(":");
    let hr = parseInt(h);
    let ampm = hr >= 12 ? " PM" : " AM";
    hr = hr % 12 || 12;
    return `${hr}${m !== "00" ? ":" + m : ""}${ampm}`;
  }

  const [personalEvents, setPersonalEvents] = useState<CalendarEvent[]>([...TEACHER_PERSONAL_EVENTS]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ title: string, date: string, time: string, endTime: string, type: CalendarEvent["type"], audience: CalendarEvent["audience"] }>({ title: "", date: "", time: "", endTime: "", type: "academic", audience: "students" });

  const allEvents = [...SCHOOL_EVENTS.filter(e => e.audience === "all" || e.audience === "teachers"), ...personalEvents];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function handleAddPersonal() {
    if (!form.title || !form.date) return;
    const colors: Record<string, string> = { academic: "#15803d", meeting: "#1e40af", holiday: "#b91c1c", exam: "#9333ea", personal: "#0ea5e9" };
    const ev: CalendarEvent = { 
      id: `tp-${Date.now()}`, 
      title: form.title, 
      date: form.date, 
      time: form.time,
      endTime: form.endTime,
      type: form.type, 
      color: colors[form.type] || "#0ea5e9", 
      locked: form.audience === "students" || form.audience === "all",
      audience: form.audience
    };
    setPersonalEvents(p => [...p, ev]);
    setForm({ title: "", date: "", time: "", endTime: "", type: "academic", audience: "students" });
    setShowForm(false);
  }

  function handleRemovePersonal(id: string) {
    setPersonalEvents(p => p.filter(e => e.id !== id));
  }

  const sorted = [...allEvents].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 28, background: C.paper }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Academic Calendar — June 2025</div>
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


      {/* Calendar Grid */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", marginBottom: 24, boxShadow: "0 4px 20px rgba(139,30,30,0.05)" }}>
        <div style={{ background: C.m800, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}><ChevronLeft size={14} color="#fff" /></button>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>June 2025</span>
          <button style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}><ChevronRight size={14} color="#fff" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${C.borderMed}`, background: "#fafafa" }}>
          {days.map(d => <div key={d} style={{ textAlign: "center", padding: "10px 4px", fontSize: 10, fontWeight: 700, color: C.t3, letterSpacing: "0.07em", textTransform: "uppercase", borderRight: `1px solid ${C.borderLight}` }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {[...Array(5)].map((_, r) =>
            days.map((_, col) => {
              const day = r * 7 + col - 1;
              const valid = day >= 1 && day <= 30;
              const dayStr = `2025-06-${String(day).padStart(2, "0")}`;
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