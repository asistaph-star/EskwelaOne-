import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { HeartHandshake, CheckCircle, XCircle, Clock, Calendar, Plus, Mail, X, User, FileText } from 'lucide-react';
import type { Appointment } from '../../shared/AppContext';
import { apiClient } from '@/api/client';

export function GCounselingScreen() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  
  const loadData = async () => {
    try {
      const [apptRes, studentsRes] = await Promise.all([
        apiClient.get<any>('/student-services/appointments/me'),
        apiClient.get<any>('/users?role=Student')
      ]);
      setAppointments(apptRes);
      setStudents(studentsRes); 
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadData(); }, []);

  const counselingAppts = appointments;
  const pending = counselingAppts.filter(a => a.status === "Pending");
  const confirmed = counselingAppts.filter(a => a.status === "Confirmed");
  const completed = counselingAppts.filter(a => a.status === "Completed");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formStudent, setFormStudent] = useState("");
  const [formParentEmail, setFormParentEmail] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formPurpose, setFormPurpose] = useState("");
  const [formDirection, setFormDirection] = useState<"parent-to-teacher" | "teacher-to-parent">("teacher-to-parent");

  const [scheduleModal, setScheduleModal] = useState(false);
  const [form, setForm] = useState({
    studentId: "",
    parentEmail: "",
    date: "",
    time: "",
    purpose: ""
  });

  async function handleStatus(id: string, status: "Confirmed" | "Declined" | "Completed") {
    try {
      const res = await apiClient.patch(`/student-services/appointments/${id}/status`, { status });
      if (res) loadData();
    } catch (e) { console.error(e); }
  }

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.date || !form.time) return;
    
    try {
      const res = await apiClient.post('/student-services/appointments', {
        studentId: form.studentId,
        parentEmail: form.parentEmail,
        date: form.date,
        time: form.time,
        purpose: form.purpose
      });
      if (res) {
        setForm({ studentId: "", parentEmail: "", date: "", time: "", purpose: "" });
        setScheduleModal(false);
        loadData();
      }
    } catch (err) { console.error(err); }
  };

  const mailtoHref = (appt: any) =>
    `mailto:${appt.parent_email || ''}?subject=Counseling%20Session&body=Dear%20Parent%2C%0A%0AWe%20would%20like%20to%20schedule%20a%20counseling%20session%20on%20${new Date(appt.date).toLocaleDateString()}%20at%20${typeof appt.time === 'string' ? appt.time : new Date(appt.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.%0A%0APurpose%3A%20${encodeURIComponent(appt.purpose)}%0A%0AThank%20you.%0A%0A-%20Guidance%20Office`;
  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Counseling Sessions</h1>
            <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Manage appointments for student counseling and parent consultations.</div>
          </div>
<<<<<<< HEAD
          <button
            id="schedule-session-btn"
            onClick={() => setIsModalOpen(true)}
            style={{
              background: C.m700, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6,
              fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.m600; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.m700; e.currentTarget.style.transform = "translateY(0)"; }}
          >
=======
          <button onClick={() => setScheduleModal(true)} style={{
            background: C.m700, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6,
            fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}>
>>>>>>> 6acd4af (feat: implement authoritative SF10 Scholastic Records logic and UI)
            <Plus size={14} /> Schedule Session
          </button>
        </div>

        {/* Stats Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "Pending", val: pending.length, color: "#f59e0b", bg: "#fef3c7", icon: Clock },
            { label: "Confirmed", val: confirmed.length, color: C.blue, bg: C.blueBg, icon: Calendar },
            { label: "Completed", val: completed.length, color: C.green, bg: C.greenBg, icon: CheckCircle },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} style={{
                background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 10,
                padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
                boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: stat.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} color={stat.color} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.t1 }}>{stat.val}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 2 Column Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          
          {/* Pending Requests */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} color="#f59e0b" /> Pending Requests ({pending.length})
            </div>
            
            {pending.length === 0 ? (
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
                <CheckCircle size={32} color={C.t3} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: C.t2 }}>No pending session requests.</div>
              </div>
            ) : (
              pending.map(appt => (
                <div key={appt.id} style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{appt.student ? `${appt.student.user.first_name} ${appt.student.user.last_name}` : appt.student_id}</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{new Date(appt.date).toLocaleDateString()} • {typeof appt.time === 'string' ? appt.time : new Date(appt.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "#fef3c7", padding: "4px 10px", borderRadius: 12 }}>Pending</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.t2, background: C.paper, padding: 12, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <strong>Purpose:</strong> {appt.purpose}
                  </div>
                  <div style={{ fontSize: 11, color: C.t3, display: "flex", alignItems: "center", gap: 6 }}>
                    <Mail size={12} /> {appt.parentEmail}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <a href={mailtoHref(appt)} style={{ flex: 1, padding: "8px", background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}>
                      <Mail size={14} /> Email Parent
                    </a>
                    <button onClick={() => handleStatus(appt.id, "Confirmed")} style={{ flex: 1, padding: "8px", background: C.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <CheckCircle size={14} /> Accept
                    </button>
                    <button onClick={() => handleStatus(appt.id, "Declined")} style={{ flex: 1, padding: "8px", background: "#fff", color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <XCircle size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Confirmed Sessions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={16} color={C.blue} /> Scheduled Sessions ({confirmed.length})
            </div>
            
            {confirmed.length === 0 ? (
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
                <Calendar size={32} color={C.t3} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: C.t2 }}>No upcoming sessions.</div>
              </div>
            ) : (
              confirmed.map(appt => (
                <div key={appt.id} style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{appt.student ? `${appt.student.user.first_name} ${appt.student.user.last_name}` : appt.student_id}</div>
                      <div style={{ fontSize: 11, marginTop: 2, color: C.blue, fontWeight: 600 }}>{new Date(appt.date).toLocaleDateString()} • {typeof appt.time === 'string' ? appt.time : new Date(appt.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.blue, background: C.blueBg, padding: "4px 10px", borderRadius: 12 }}>Confirmed</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.t2 }}>
                    <strong>Purpose:</strong> {appt.purpose}
                  </div>
                  <div style={{ fontSize: 11, color: C.t3, display: "flex", alignItems: "center", gap: 6 }}>
                    <Mail size={12} /> {appt.parentEmail}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <a href={mailtoHref(appt)} style={{ flex: 1, padding: "8px", background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}>
                      <Mail size={14} /> Email Parent
                    </a>
                    <button onClick={() => handleStatus(appt.id, "Completed")} style={{ flex: 1, padding: "8px", background: "transparent", color: C.m700, border: `1px solid ${C.m700}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Mark as Completed
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>

      {/* Schedule Session Modal */}
<<<<<<< HEAD
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div
            style={{
              background: "#fff", width: 540, maxHeight: "90vh", borderRadius: 16,
              overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "22px 28px", borderBottom: `1px solid ${C.border}`,
              background: C.paper,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: C.blueBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Calendar size={18} color={C.blue} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, color: C.t1, fontFamily: "'Fraunces', serif" }}>Schedule Session</h2>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Set up a counseling appointment with a student's parent/guardian.</div>
                </div>
              </div>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={20} color={C.t3} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSchedule} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>

              {/* Student Name */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><User size={13} /> Student Name</span>
                </label>
                <input
                  id="form-student-name"
                  type="text"
                  placeholder="e.g., Juan Dela Cruz"
                  value={formStudent}
                  onChange={e => setFormStudent(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed}
                />
              </div>

              {/* Parent Email */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Mail size={13} /> Parent/Guardian Email</span>
                </label>
                <input
                  id="form-parent-email"
                  type="email"
                  placeholder="e.g., parent@email.com"
                  value={formParentEmail}
                  onChange={e => setFormParentEmail(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed}
                />
              </div>

              {/* Date & Time Row */}
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Calendar size={13} /> Date</span>
                  </label>
                  <input
                    id="form-date"
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                    style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = C.m500}
                    onBlur={e => e.currentTarget.style.borderColor = C.borderMed}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Clock size={13} /> Time</span>
                  </label>
                  <input
                    id="form-time"
                    type="time"
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    required
                    style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = C.m500}
                    onBlur={e => e.currentTarget.style.borderColor = C.borderMed}
                  />
                </div>
              </div>

              {/* Session Type */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Session Initiated By</label>
                <div style={{ display: "flex", gap: 12 }}>
                  {([
                    { val: "teacher-to-parent" as const, label: "Counselor (You)", desc: "You are scheduling this session" },
                    { val: "parent-to-teacher" as const, label: "Parent Request", desc: "Parent requested this session" },
                  ]).map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setFormDirection(opt.val)}
                      style={{
                        flex: 1, padding: "12px 14px", borderRadius: 8,
                        border: `1.5px solid ${formDirection === opt.val ? C.m500 : C.borderMed}`,
                        background: formDirection === opt.val ? C.m50 : "#fff",
                        cursor: "pointer", textAlign: "left",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: formDirection === opt.val ? C.m700 : C.t1 }}>{opt.label}</div>
                      <div style={{ fontSize: 10.5, color: C.t3, marginTop: 2 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: C.t3, marginTop: 6, fontStyle: "italic" }}>
                  {formDirection === "teacher-to-parent"
                    ? "Session will be added as \"Confirmed\" automatically."
                    : "Session will be added as \"Pending\" for your review."}
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><FileText size={13} /> Purpose / Agenda</span>
                </label>
                <textarea
                  id="form-purpose"
                  placeholder="Describe the purpose of this counseling session..."
                  value={formPurpose}
                  onChange={e => setFormPurpose(e.target.value)}
                  required
                  rows={3}
                  style={{ ...inputStyle, resize: "none" }}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  style={{ padding: "10px 20px", background: "none", border: `1px solid ${C.borderMed}`, borderRadius: 8, color: C.t2, fontWeight: 600, cursor: "pointer", fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "10px 24px", background: C.m700, color: "#fff",
                    border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer",
                    fontSize: 12, display: "flex", alignItems: "center", gap: 8,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.m600}
                  onMouseLeave={e => e.currentTarget.style.background = C.m700}
                >
                  <Calendar size={14} /> Schedule Session
                </button>
=======
      {scheduleModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(10,4,4,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setScheduleModal(false); }}>
          <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 440, overflow: "hidden", boxShadow: "0 24px 64px rgba(74,10,16,0.25)" }}>
            <div style={{ background: C.m800, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Fraunces',serif" }}>Schedule Counseling Session</div>
              <button onClick={() => setScheduleModal(false)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 4, width: 28, height: 28, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSchedule} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Student Name</label>
                <select required value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }}>
                  <option value="">Select a student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Parent Email</label>
                <input type="email" value={form.parentEmail} onChange={e => setForm({ ...form, parentEmail: e.target.value })} placeholder="e.g. parent@email.com" style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Date</label>
                  <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Time</label>
                  <input required type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Purpose / Notes</label>
                <textarea rows={3} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Discuss academic performance and social behavior..." style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setScheduleModal(false)} style={{ padding: "8px 16px", background: C.m50, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: C.t2, cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "8px 20px", background: C.m700, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Save Session</button>
>>>>>>> 6acd4af (feat: implement authoritative SF10 Scholastic Records logic and UI)
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
