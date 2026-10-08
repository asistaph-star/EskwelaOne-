import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { CalendarEvent, EVENT_TYPE_CONFIG } from '../../shared/data/calendarData';
import { Calendar, Lock, ChevronLeft, ChevronRight, X, Save, Clock, Edit2, Trash2, Plus } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { CalendarGrid, formatTimeDisplay } from '../../shared/features/calendar/CalendarGrid';

export function PEventsScreen() {
  const [backendEvents, setBackendEvents] = React.useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", date: "", time: "", endTime: "", type: "academic" as CalendarEvent["type"], audience: "all" as CalendarEvent["audience"] });
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

  const events = backendEvents.map(dbEv => {
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
      locked: true,
      audience: dbEv.audience
    } as CalendarEvent;
  });

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  async function handleSave() {
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
      if (editId) {
        await apiClient.patch(`/admin/events/${editId}`, payload);
      } else {
        await apiClient.post('/admin/events', payload);
      }
      await fetchEvents();
      setEditId(null);
      setForm({ title: "", date: "", time: "", endTime: "", type: "academic", audience: "all" });
      setShowForm(false);
    } catch (err: any) {
      console.error(err);
      alert(`Error saving event: ${err.message}`);
    }
  }

  function handleEdit(ev: CalendarEvent) {
    setForm({ title: ev.title, date: ev.date, time: ev.time || "", endTime: ev.endTime || "", type: ev.type, audience: ev.audience || "all" });
    setEditId(ev.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await apiClient.delete(`/admin/events/${id}`);
      setBackendEvents(prev => prev.filter(e => e.id !== id));
    } catch(err: any) {
      console.error(err);
      alert(`Error deleting event: ${err.message}`);
    }
  }

  const sorted = [...events].sort((a, b) => {
    if (a.date === b.date) return (a.time || "").localeCompare(b.time || "");
    return a.date.localeCompare(b.date);
  });

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 28, background: "transparent", position: "relative" }}>
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
      <CalendarGrid
        events={events}
        currentMonth={currentMonth}
        isLoading={loading}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onDayClick={(dateStr) => {
          setForm({ title: "", date: dateStr, time: "", endTime: "", type: "academic", audience: "all" });
          setEditId(null);
          setShowForm(true);
        }}
        onEventClick={(ev, e) => {
          handleEdit(ev as CalendarEvent);
        }}
      />

      {error && (
        <div style={{ background: '#fef2f2', color: '#ef4444', padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 13, border: '1px solid #fecaca' }}>
          <strong>Error loading events:</strong> {error}
        </div>
      )}

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
