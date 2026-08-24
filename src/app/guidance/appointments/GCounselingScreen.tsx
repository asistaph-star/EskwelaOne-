import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { HeartHandshake, CheckCircle, XCircle, Clock, Calendar, Plus, Mail, X, User, FileText } from 'lucide-react';
import type { Appointment } from '../../shared/AppContext';

export function GCounselingScreen() {
  const { appointments, addAppointment, updateAppointment } = useAppContext();
  
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

  function handleStatus(id: string, status: "Confirmed" | "Declined" | "Completed") {
    updateAppointment(id, status);
  }

  function resetForm() {
    setFormStudent("");
    setFormParentEmail("");
    setFormDate("");
    setFormTime("");
    setFormPurpose("");
    setFormDirection("teacher-to-parent");
  }

  function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!formStudent.trim() || !formParentEmail.trim() || !formDate || !formTime || !formPurpose.trim()) return;

    // Format date for display
    const dateObj = new Date(formDate + "T00:00:00");
    const displayDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Format time for display
    const [h, m] = formTime.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const displayTime = `${displayHour}:${m} ${ampm}`;

    const newAppt: Appointment = {
      id: "appt-" + Math.random().toString(36).substr(2, 9),
      studentName: formStudent,
      parentEmail: formParentEmail,
      teacherName: "Counselor Perez",
      date: displayDate,
      time: displayTime,
      purpose: formPurpose,
      status: formDirection === "teacher-to-parent" ? "Confirmed" : "Pending",
      direction: formDirection,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    };

    addAppointment(newAppt);
    resetForm();
    setIsModalOpen(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: `1px solid ${C.borderMed}`, outline: "none",
    boxSizing: "border-box", fontSize: 13,
    fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Counseling Sessions</h1>
            <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Manage appointments for student counseling and parent consultations.</div>
          </div>
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
              <Clock size={16} color="#f59e0b" /> Pending Requests
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
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{appt.studentName}</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{appt.date} • {appt.time}</div>
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
                    <button
                      onClick={() => {
                        const subject = encodeURIComponent(`Counseling Session: ${appt.studentName} — ${appt.date}`);
                        const body = encodeURIComponent(
                          `Dear Parent/Guardian,\n\nThis is Counselor Perez from the Guidance Office of Calulut Integrated School.\n\nWe would like to confirm a counseling session for your child, ${appt.studentName}, scheduled on ${appt.date} at ${appt.time}.\n\nPurpose: ${appt.purpose}\n\nPlease reply to confirm your attendance or contact us to reschedule.\n\nRespectfully,\nCounselor Perez\nGuidance Office`
                        );
                        window.open(`mailto:${appt.parentEmail}?subject=${subject}&body=${body}`, '_blank');
                      }}
                      style={{ flex: 1, padding: "8px", background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <Mail size={14} /> Email Parent
                    </button>
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
              <Calendar size={16} color={C.blue} /> Scheduled Sessions
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
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{appt.studentName}</div>
                      <div style={{ fontSize: 11, color: C.blue, fontWeight: 600, marginTop: 2 }}>{appt.date} • {appt.time}</div>
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
                    <button
                      onClick={() => {
                        const subject = encodeURIComponent(`Counseling Session Reminder: ${appt.studentName} — ${appt.date}`);
                        const body = encodeURIComponent(
                          `Dear Parent/Guardian,\n\nThis is a reminder of the scheduled counseling session for ${appt.studentName} on ${appt.date} at ${appt.time}.\n\nPurpose: ${appt.purpose}\n\nPlease contact us if you need to reschedule.\n\nRespectfully,\nCounselor Perez\nGuidance Office`
                        );
                        window.open(`mailto:${appt.parentEmail}?subject=${subject}&body=${body}`, '_blank');
                      }}
                      style={{ flex: 1, padding: "8px", background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <Mail size={14} /> Email Parent
                    </button>
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
