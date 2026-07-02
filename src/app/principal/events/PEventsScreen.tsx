import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { SCHOOL_EVENTS, CalendarEvent, EVENT_TYPE_CONFIG } from '../../shared/data/calendarData';
import { Plus, Trash2, Edit2, Calendar, Lock, ChevronLeft, ChevronRight, X, Save } from 'lucide-react';

export function PEventsScreen() {
  const [events, setEvents] = useState<CalendarEvent[]>([...SCHOOL_EVENTS]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", date: "", type: "academic" as CalendarEvent["type"], audience: "all" as CalendarEvent["audience"] });

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function handleSave() {
    if (!form.title || !form.date) return;
    const cfg = EVENT_TYPE_CONFIG[form.type];
    if (editId) {
      setEvents(ev => ev.map(e => e.id === editId ? { ...e, title: form.title, date: form.date, type: form.type, audience: form.audience, color: cfg.color } : e));
      setEditId(null);
    } else {
      const newEvent: CalendarEvent = {
        id: `se-${Date.now()}`, title: form.title, date: form.date, type: form.type,
        color: cfg.color, locked: true, audience: form.audience,
      };
      setEvents(ev => [...ev, newEvent]);
    }
    setForm({ title: "", date: "", type: "academic", audience: "all" });
    setShowForm(false);
  }

  function handleEdit(ev: CalendarEvent) {
    setForm({ title: ev.title, date: ev.date, type: ev.type, audience: ev.audience || "all" });
    setEditId(ev.id);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    setEvents(ev => ev.filter(e => e.id !== id));
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 28, background: C.paper }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>School Events Manager</div>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Create and manage school-wide events. These events appear locked on Teacher and Student calendars.</div>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ title: "", date: "", type: "academic", audience: "all" }); }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: C.m700, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={14} /> Create Event
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 24, marginBottom: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{editId ? "Edit Event" : "New School Event"}</div>
            <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.t3 }}><X size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Event Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. PTA General Assembly"
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none", background: "#fff" }}>
                <option value="academic">Academic</option>
                <option value="meeting">Meeting</option>
                <option value="holiday">Holiday</option>
                <option value="exam">Exam</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Audience</label>
              <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value as any })}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none", background: "#fff" }}>
                <option value="all">Everyone</option>
                <option value="teachers">Teachers Only</option>
                <option value="students">Students Only</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ padding: "7px 16px", background: C.m50, border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 11, cursor: "pointer", color: C.t2 }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: "7px 16px", background: C.m700, color: "#fff", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Save size={12} /> {editId ? "Update" : "Create Event"}
            </button>
          </div>
        </div>
      )}

      {/* Calendar Preview */}
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
              const dayEvents = events.filter(e => e.date === dayStr);
              return (
                <div key={`${r}-${col}`} style={{ minHeight: 72, padding: "6px 6px", borderRight: `0.5px solid ${C.border}`, borderBottom: `0.5px solid ${C.border}`, background: "#fff" }}>
                  {valid && <>
                    <div style={{ fontSize: 11, fontWeight: 400, color: col >= 5 ? C.t3 : C.t2, marginBottom: 3 }}>{day}</div>
                    {dayEvents.map(ev => (
                      <div key={ev.id} style={{ fontSize: 8.5, fontWeight: 600, color: "#fff", background: ev.color, borderRadius: 3, padding: "2px 5px", marginBottom: 2, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 3 }}>
                        <Lock size={7} /> {ev.title.length > 14 ? ev.title.slice(0, 14) + "…" : ev.title}
                      </div>
                    ))}
                  </>}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Events List */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderMed}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>All School Events ({events.length})</div>
        </div>
        {sorted.map(ev => {
          const cfg = EVENT_TYPE_CONFIG[ev.type];
          return (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ width: 4, height: 36, borderRadius: 2, background: ev.color, flexShrink: 0 }} />
              <Calendar size={14} color={ev.color} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{ev.title}</div>
                <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{ev.date} · {cfg.label} · {ev.audience === "all" ? "Everyone" : ev.audience === "teachers" ? "Teachers Only" : "Students Only"}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => handleEdit(ev)} style={{ width: 28, height: 28, borderRadius: 4, background: C.m50, border: `1px solid ${C.borderMed}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Edit2 size={12} color={C.t2} />
                </button>
                <button onClick={() => handleDelete(ev.id)} style={{ width: 28, height: 28, borderRadius: 4, background: "#fef2f2", border: "1px solid #fecaca", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trash2 size={12} color="#ef4444" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
