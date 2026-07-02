import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { SCHOOL_EVENTS, TEACHER_PERSONAL_EVENTS, CalendarEvent, EVENT_TYPE_CONFIG } from '../../shared/data/calendarData';
import { Calendar, ChevronLeft, ChevronRight, Lock, Plus, X, Save, Trash2 } from 'lucide-react';

export function CalendarScreen() {
  const [personalEvents, setPersonalEvents] = useState<CalendarEvent[]>([...TEACHER_PERSONAL_EVENTS]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", date: "" });

  const allEvents = [...SCHOOL_EVENTS.filter(e => e.audience === "all" || e.audience === "teachers"), ...personalEvents];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function handleAddPersonal() {
    if (!form.title || !form.date) return;
    const ev: CalendarEvent = { id: `tp-${Date.now()}`, title: form.title, date: form.date, type: "personal", color: "#0ea5e9", locked: false };
    setPersonalEvents(p => [...p, ev]);
    setForm({ title: "", date: "" });
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
        <button onClick={() => { setShowForm(true); setForm({ title: "", date: "" }); }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={14} /> Add Personal Event
        </button>
      </div>

      {/* Add personal event form */}
      {showForm && (
        <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>New Personal Event</div>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.t3 }}><X size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Parent Conference"
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none" }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={handleAddPersonal} style={{ padding: "7px 16px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Save size={12} /> Save
            </button>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ background: C.m800, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={14} color="#fff" /></button>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>June 2025</span>
          <button style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={14} color="#fff" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${C.borderMed}` }}>
          {days.map(d => <div key={d} style={{ textAlign: "center", padding: "8px 4px", fontSize: 10, fontWeight: 700, color: C.t3, letterSpacing: "0.07em", textTransform: "uppercase", borderRight: `0.5px solid ${C.border}` }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {[...Array(5)].map((_, r) =>
            days.map((_, col) => {
              const day = r * 7 + col - 1;
              const valid = day >= 1 && day <= 30;
              const dayStr = `2025-06-${String(day).padStart(2, "0")}`;
              const dayEvents = allEvents.filter(e => e.date === dayStr);
              const isToday = day === 10;
              return (
                <div key={`${r}-${col}`} style={{ minHeight: 72, padding: "6px 6px", borderRight: `0.5px solid ${C.border}`, borderBottom: `0.5px solid ${C.border}`, background: isToday ? C.m50 : "#fff" }}>
                  {valid && <>
                    <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? C.m700 : col >= 5 ? C.t3 : C.t2, marginBottom: 3 }}>{day}</div>
                    {dayEvents.map(ev => (
                      <div key={ev.id} style={{ fontSize: 8.5, fontWeight: 600, color: "#fff", background: ev.color, borderRadius: 3, padding: "2px 5px", marginBottom: 2, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 3 }}>
                        {ev.locked && <Lock size={7} />}
                        {ev.title.length > 14 ? ev.title.slice(0, 14) + "…" : ev.title}
                      </div>
                    ))}
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
    </div>
  );
}