import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { SCHOOL_EVENTS, CalendarEvent, EVENT_TYPE_CONFIG } from '../../shared/data/calendarData';
import { Plus, Trash2, Edit2, Calendar, Lock, ChevronLeft, ChevronRight, X, Save, Clock } from 'lucide-react';

function formatTimeDisplay(timeStr?: string) {
  if (!timeStr) return "";
  let [h, m] = timeStr.split(":");
  let hr = parseInt(h);
  let ampm = hr >= 12 ? "p" : "a";
  hr = hr % 12 || 12;
  return `${hr}${m !== "00" ? ":" + m : ""}${ampm}`;
}

export function PEventsScreen() {
  const [events, setEvents] = useState<CalendarEvent[]>([...SCHOOL_EVENTS]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", date: "", time: "", endTime: "", type: "academic" as CalendarEvent["type"], audience: "all" as CalendarEvent["audience"] });

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function handleSave() {
    if (!form.title || !form.date) return;
    const cfg = EVENT_TYPE_CONFIG[form.type];
    if (editId) {
      setEvents(ev => ev.map(e => e.id === editId ? { ...e, title: form.title, date: form.date, time: form.time, endTime: form.endTime, type: form.type, audience: form.audience, color: cfg.color } : e));
      setEditId(null);
    } else {
      const newEvent: CalendarEvent = {
        id: `se-${Date.now()}`, title: form.title, date: form.date, time: form.time, endTime: form.endTime, type: form.type,
        color: cfg.color, locked: true, audience: form.audience,
      };
      setEvents(ev => [...ev, newEvent]);
    }
    setForm({ title: "", date: "", time: "", endTime: "", type: "academic", audience: "all" });
    setShowForm(false);
  }

  function handleEdit(ev: CalendarEvent) {
    setForm({ title: ev.title, date: ev.date, time: ev.time || "", endTime: ev.endTime || "", type: ev.type, audience: ev.audience || "all" });
    setEditId(ev.id);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    setEvents(ev => ev.filter(e => e.id !== id));
  }

  const sorted = [...events].sort((a, b) => {
    if (a.date === b.date) return (a.time || "").localeCompare(b.time || "");
    return a.date.localeCompare(b.date);
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 28, background: C.paper, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>School Events Manager</div>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Create and manage school-wide events. Click any date on the calendar to add an event.</div>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ title: "", date: "", time: "", endTime: "", type: "academic", audience: "all" }); }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: C.m700, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "background 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.background = C.m800}
          onMouseLeave={e => e.currentTarget.style.background = C.m700}
        >
          <Plus size={14} /> Create Event
        </button>
      </div>

      {/* Calendar Preview */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
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
              const dayEvents = events.filter(e => e.date === dayStr);
              return (
                <div 
                  key={`${r}-${col}`} 
                  onClick={() => {
                    if (valid) {
                      setForm({ title: "", date: dayStr, time: "", endTime: "", type: "academic", audience: "all" });
                      setEditId(null);
                      setShowForm(true);
                    }
                  }}
                  style={{ 
                    minHeight: 100, 
                    padding: "6px 6px", 
                    borderRight: `1px solid ${C.borderLight}`, 
                    borderBottom: `1px solid ${C.borderLight}`, 
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
                          <div 
                            key={ev.id} 
                            onClick={(e) => { e.stopPropagation(); handleEdit(ev); }}
                            style={{ 
                              display: "flex", 
                              flexDirection: "column",
                              padding: "4px 8px", 
                              borderRadius: 4, 
                              background: ev.color + "15",
                              borderLeft: `3px solid ${ev.color}`,
                              transition: "background 0.2s",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = ev.color + "25"}
                            onMouseLeave={e => e.currentTarget.style.background = ev.color + "15"}
                          >
                            <div style={{ fontSize: 9.5, color: C.t1, fontWeight: 700, lineHeight: 1.2 }}>
                              {ev.title}
                            </div>
                            <div style={{ fontSize: 8.5, color: ev.color, fontWeight: 700, marginTop: 2, filter: "brightness(0.7)" }}>{fullTime}</div>
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

      {/* Events List */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>All School Events ({events.length})</div>
        </div>
        {sorted.map(ev => {
          const cfg = EVENT_TYPE_CONFIG[ev.type];
          
          let timeDisplay = "All day";
          if (ev.time) {
            timeDisplay = formatTimeDisplay(ev.time);
            if (ev.endTime) timeDisplay += ` - ${formatTimeDisplay(ev.endTime)}`;
          }

          return (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ width: 4, height: 36, borderRadius: 2, background: ev.color, flexShrink: 0 }} />
              <div style={{ width: 36, height: 36, borderRadius: 18, background: ev.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Calendar size={16} color={ev.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{ev.title}</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>
                  <span style={{ fontWeight: 600, color: C.t2 }}>{ev.date}</span>
                  <span style={{ marginLeft: 6, paddingLeft: 6, borderLeft: `1px solid ${C.borderMed}` }}><Clock size={10} style={{ display: "inline", marginBottom: -1, marginRight: 3 }} />{timeDisplay}</span>
                  <span style={{ marginLeft: 6, paddingLeft: 6, borderLeft: `1px solid ${C.borderMed}` }}>{cfg.label}</span>
                  <span style={{ marginLeft: 6, paddingLeft: 6, borderLeft: `1px solid ${C.borderMed}` }}>{ev.audience === "all" ? "Everyone" : ev.audience === "teachers" ? "Teachers Only" : "Students Only"}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleEdit(ev)} style={{ width: 32, height: 32, borderRadius: 6, background: C.m50, border: `1px solid ${C.borderMed}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="#e2e8f0"} onMouseLeave={e=>e.currentTarget.style.background=C.m50}>
                  <Edit2 size={14} color={C.t2} />
                </button>
                <button onClick={() => handleDelete(ev.id)} style={{ width: 32, height: 32, borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="#fee2e2"} onMouseLeave={e=>e.currentTarget.style.background="#fef2f2"}>
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
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
              <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif" }}>{editId ? "Edit Event" : "New School Event"}</div>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: C.m50, border: "none", borderRadius: 16, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.t2, transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="#e2e8f0"} onMouseLeave={e=>e.currentTarget.style.background=C.m50}><X size={16} /></button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Event Title</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. PTA General Assembly"
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
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Audience</label>
                  <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value as any })}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", background: "#fff", cursor: "pointer", fontFamily: "inherit" }} onFocus={e=>e.currentTarget.style.borderColor=C.m700} onBlur={e=>e.currentTarget.style.borderColor=C.borderMed}>
                    <option value="all">Everyone</option>
                    <option value="teachers">Teachers Only</option>
                    <option value="students">Students Only</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 28 }}>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ padding: "10px 20px", background: C.m50, border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", color: C.t2, transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="#e2e8f0"} onMouseLeave={e=>e.currentTarget.style.background=C.m50}>Cancel</button>
              <button onClick={handleSave} style={{ padding: "10px 20px", background: C.m700, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background 0.2s", boxShadow: "0 4px 12px rgba(139,30,30,0.2)" }} onMouseEnter={e=>e.currentTarget.style.background=C.m800} onMouseLeave={e=>e.currentTarget.style.background=C.m700}>
                <Save size={14} /> {editId ? "Update Event" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
