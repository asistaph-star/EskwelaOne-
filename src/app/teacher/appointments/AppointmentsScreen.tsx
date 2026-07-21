import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { CalendarCheck, Clock, Mail, User, Send, CheckCircle, XCircle, ChevronDown, Users, FileText, Filter, Search, Eye } from 'lucide-react';
import type { AppointmentStatus } from '../../shared/AppContext';

const AVAILABLE_STUDENTS = [
  { name: "Juan Miguel Santos", section: "Grade 10 - Pilot", parentEmail: "maria.santos@email.com" },
  { name: "Trisha Ann Cruz", section: "Grade 10 - Pilot", parentEmail: "elena.cruz@email.com" },
  { name: "Mark Anthony Reyes", section: "Grade 10 - Pilot", parentEmail: "jose.reyes@email.com" },
  { name: "Maria Clara Gonzales", section: "Grade 8 - Rizal", parentEmail: "pedro.gonzales@email.com" },
  { name: "Carlos Rivera Jr.", section: "Grade 9 - Mabini", parentEmail: "ana.rivera@email.com" },
];

export function AppointmentsScreen() {
  const { appointments, addAppointment, updateAppointment, parentEmail } = useAppContext();
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing" | "history">("incoming");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | AppointmentStatus>("all");

  // Request form state
  const [selStudent, setSelStudent] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [reqTime, setReqTime] = useState("");
  const [reqPurpose, setReqPurpose] = useState("");

  const selectedStudentData = AVAILABLE_STUDENTS.find(s => s.name === selStudent);

  const incomingAppointments = appointments.filter(a => a.direction === "parent-to-teacher" && a.teacherName === "Ana R. Soriano");
  const outgoingAppointments = appointments.filter(a => a.direction === "teacher-to-parent" && a.teacherName === "Ana R. Soriano");
  const allTeacherAppointments = appointments.filter(a => a.teacherName === "Ana R. Soriano");

  const filteredHistory = filterStatus === "all" ? allTeacherAppointments : allTeacherAppointments.filter(a => a.status === filterStatus);

  function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selStudent || !reqDate || !reqTime || !reqPurpose) {
      alert("Please fill in all fields.");
      return;
    }
    const dateObj = new Date(reqDate);
    const formattedDate = dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const [h, m] = reqTime.split(":");
    let hr = parseInt(h);
    const ampm = hr >= 12 ? "PM" : "AM";
    hr = hr % 12 || 12;
    const formattedTime = `${hr}:${m} ${ampm}`;

    addAppointment({
      id: "appt-" + Date.now(),
      studentName: selStudent,
      parentEmail: selectedStudentData?.parentEmail || "",
      teacherName: "Ana R. Soriano",
      date: formattedDate,
      time: formattedTime,
      purpose: reqPurpose,
      status: "Pending",
      direction: "teacher-to-parent",
      createdAt: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    });

    setShowRequestForm(false);
    setSelStudent("");
    setReqDate("");
    setReqTime("");
    setReqPurpose("");
    alert("✅ Appointment request sent! A notification email has been simulated to the parent.");
  }

  function statusColor(s: AppointmentStatus) {
    return s === "Confirmed" ? C.green : s === "Pending" ? "#f59e0b" : s === "Declined" ? C.red : C.blue;
  }
  function statusBg(s: AppointmentStatus) {
    return s === "Confirmed" ? C.greenBg : s === "Pending" ? "#fef3c7" : s === "Declined" ? C.redBg : C.blueBg;
  }

  const pendingIncoming = incomingAppointments.filter(a => a.status === "Pending");
  const pendingOutgoing = outgoingAppointments.filter(a => a.status === "Pending");

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 100px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Parent-Teacher Appointments</h1>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>Manage appointment requests between parents and teachers.</div>
          </div>
          <button
            onClick={() => setShowRequestForm(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: C.m700, color: "#fff", border: "none",
              padding: "10px 20px", borderRadius: 6, cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              boxShadow: "0 2px 8px rgba(29,78,216,0.25)",
              transition: "all 0.15s"
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <CalendarCheck size={15} />
            Request Appointment with Parent
          </button>
        </div>

        {/* KPI Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Total Appointments", val: allTeacherAppointments.length.toString(), icon: CalendarCheck, color: C.m700, bg: C.m50 },
            { label: "Pending Requests", val: (pendingIncoming.length + pendingOutgoing.length).toString(), icon: Clock, color: "#f59e0b", bg: "#fef3c7" },
            { label: "Confirmed", val: allTeacherAppointments.filter(a => a.status === "Confirmed").length.toString(), icon: CheckCircle, color: C.green, bg: C.greenBg },
            { label: "Incoming from Parents", val: incomingAppointments.length.toString(), icon: Mail, color: C.blue, bg: C.blueBg },
          ].map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className="hover-zoom" style={{
                background: "#fff", border: `1.5px solid ${C.borderMed}`,
                borderRadius: 8, padding: "14px 16px",
                display: "flex", flexDirection: "column", gap: 8,
                boxShadow: "0 2px 6px rgba(0,0,0,0.02)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={14} color={kpi.color} />
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{kpi.val}</div>
              </div>
            );
          })}
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${C.border}` }}>
          {([
            { id: "incoming" as const, label: "Incoming Requests", count: pendingIncoming.length },
            { id: "outgoing" as const, label: "My Requests", count: pendingOutgoing.length },
            { id: "history" as const, label: "All History", count: 0 },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "10px 20px",
                background: "transparent",
                border: "none",
                borderBottom: activeTab === t.id ? `2px solid ${C.m700}` : "2px solid transparent",
                color: activeTab === t.id ? C.m700 : C.t3,
                fontSize: 12,
                fontWeight: activeTab === t.id ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: -2
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: "#fff",
                  background: C.red, borderRadius: 10,
                  padding: "1px 6px", minWidth: 16, textAlign: "center"
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Incoming Requests Tab */}
        {activeTab === "incoming" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {incomingAppointments.length === 0 ? (
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 40, textAlign: "center" }}>
                <CalendarCheck size={32} color={C.t3} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: C.t3 }}>No incoming appointment requests from parents.</div>
              </div>
            ) : (
              incomingAppointments.map(appt => (
                <div key={appt.id} style={{
                  background: "#fff", border: `1.5px solid ${C.borderMed}`,
                  borderRadius: 8, padding: "18px 22px",
                  display: "flex", flexDirection: "column", gap: 14,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                  transition: "border-color 0.15s"
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.m700}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.borderMed}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 20, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1.5px solid ${C.borderMed}` }}>
                        <User size={18} color={C.m700} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{appt.studentName}</div>
                        <div style={{ fontSize: 11, color: C.t3, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                          <Mail size={10} /> {appt.parentEmail}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: statusColor(appt.status),
                      background: statusBg(appt.status), padding: "3px 10px",
                      borderRadius: 10, border: `1px solid ${statusColor(appt.status)}20`
                    }}>{appt.status}</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.t2 }}>
                      <CalendarCheck size={12} color={C.m700} />
                      <span><strong>Date:</strong> {appt.date}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.t2 }}>
                      <Clock size={12} color={C.m700} />
                      <span><strong>Time:</strong> {appt.time}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.t2 }}>
                      <strong>Purpose:</strong> {appt.purpose}
                    </div>
                  </div>

                  {appt.status === "Pending" && (
                    <div style={{ display: "flex", gap: 8, paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
                      <button
                        onClick={() => {
                          updateAppointment(appt.id, "Confirmed");
                          alert(`✅ Appointment confirmed! A confirmation email has been simulated to ${appt.parentEmail}.`);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: C.green, color: "#fff", border: "none",
                          padding: "8px 16px", borderRadius: 4, cursor: "pointer",
                          fontSize: 11, fontWeight: 700, transition: "all 0.15s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                      >
                        <CheckCircle size={13} /> Confirm
                      </button>
                      <button
                        onClick={() => {
                          updateAppointment(appt.id, "Declined");
                          alert(`Appointment declined. A notification email has been simulated to ${appt.parentEmail}.`);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "#fff", color: C.red, border: `1.5px solid ${C.red}`,
                          padding: "8px 16px", borderRadius: 4, cursor: "pointer",
                          fontSize: 11, fontWeight: 700, transition: "all 0.15s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = C.redBg}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                      >
                        <XCircle size={13} /> Decline
                      </button>
                      <button
                        onClick={() => setShowEmailPreview(appt.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "#fff", color: C.t2, border: `1.5px solid ${C.borderMed}`,
                          padding: "8px 16px", borderRadius: 4, cursor: "pointer",
                          fontSize: 11, fontWeight: 600, marginLeft: "auto", transition: "all 0.15s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = C.m700}
                        onMouseLeave={e => e.currentTarget.style.borderColor = C.borderMed}
                      >
                        <Eye size={13} /> Preview Email
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Outgoing Requests Tab */}
        {activeTab === "outgoing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {outgoingAppointments.length === 0 ? (
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 40, textAlign: "center" }}>
                <Send size={32} color={C.t3} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: C.t3, marginBottom: 12 }}>No outgoing appointment requests yet.</div>
                <button onClick={() => setShowRequestForm(true)} style={{
                  background: C.m700, color: "#fff", border: "none",
                  padding: "8px 18px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700
                }}>Send an Appointment Request</button>
              </div>
            ) : (
              outgoingAppointments.map(appt => (
                <div key={appt.id} style={{
                  background: "#fff", border: `1.5px solid ${C.borderMed}`,
                  borderRadius: 8, padding: "18px 22px",
                  display: "flex", flexDirection: "column", gap: 14,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.02)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 20, background: C.purpleBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1.5px solid ${C.purple}20` }}>
                        <Send size={16} color={C.purple} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>To Parent of: {appt.studentName}</div>
                        <div style={{ fontSize: 11, color: C.t3, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                          <Mail size={10} /> {appt.parentEmail}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: statusColor(appt.status),
                      background: statusBg(appt.status), padding: "3px 10px",
                      borderRadius: 10, border: `1px solid ${statusColor(appt.status)}20`
                    }}>{appt.status}</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.t2 }}>
                      <CalendarCheck size={12} color={C.m700} />
                      <span><strong>Date:</strong> {appt.date}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.t2 }}>
                      <Clock size={12} color={C.m700} />
                      <span><strong>Time:</strong> {appt.time}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.t2 }}>
                      <strong>Purpose:</strong> {appt.purpose}
                    </div>
                  </div>

                  <div style={{ fontSize: 10, color: C.t3, display: "flex", alignItems: "center", gap: 4 }}>
                    Requested on {appt.createdAt}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.t2 }}>
                <Filter size={12} />
                <span style={{ fontWeight: 600 }}>Filter:</span>
              </div>
              {(["all", "Pending", "Confirmed", "Declined", "Completed"] as const).map(f => (
                <button key={f} onClick={() => setFilterStatus(f)} style={{
                  padding: "4px 12px", borderRadius: 12,
                  background: filterStatus === f ? C.m700 : "#fff",
                  color: filterStatus === f ? "#fff" : C.t2,
                  border: `1px solid ${filterStatus === f ? C.m700 : C.borderMed}`,
                  fontSize: 10, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.15s", textTransform: "capitalize"
                }}>{f === "all" ? "All" : f}</button>
              ))}
            </div>

            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    {["Student", "Parent Email", "Date & Time", "Purpose", "Direction", "Status"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", fontSize: 11, color: C.t3 }}>No appointments match the current filter.</td></tr>
                  ) : (
                    filteredHistory.map(appt => (
                      <tr key={appt.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.paper}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                        <td style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 600, color: C.t1 }}>{appt.studentName}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: C.t2 }}>{appt.parentEmail}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: C.t2 }}>{appt.date} · {appt.time}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: C.t2, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{appt.purpose}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                            color: appt.direction === "parent-to-teacher" ? C.blue : C.purple,
                            background: appt.direction === "parent-to-teacher" ? C.blueBg : C.purpleBg
                          }}>
                            {appt.direction === "parent-to-teacher" ? "← From Parent" : "→ To Parent"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: statusColor(appt.status),
                            background: statusBg(appt.status), padding: "3px 10px",
                            borderRadius: 10, border: `1px solid ${statusColor(appt.status)}20`
                          }}>{appt.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Request Appointment Modal ── */}
      {showRequestForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 520, background: "#fff", borderRadius: 12,
            boxShadow: "0 20px 50px rgba(0,0,0,0.2)", overflow: "hidden",
            animation: "popIn 0.25s ease-out"
          }}>
            <style>{`@keyframes popIn { 0% { opacity:0; transform:translateY(16px) scale(0.97); } 100% { opacity:1; transform:translateY(0) scale(1); } }`}</style>

            <div style={{ background: `linear-gradient(135deg, ${C.m800} 0%, ${C.m600} 100%)`, padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Fraunces', serif" }}>Request Appointment with Parent</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>A notification email will be sent to the parent</div>
              </div>
              <button onClick={() => setShowRequestForm(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: 15, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <form onSubmit={handleSendRequest} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Select Student</label>
                <select
                  value={selStudent}
                  onChange={e => setSelStudent(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, background: "#fff", color: C.t1, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                >
                  <option value="">— Choose a student —</option>
                  {AVAILABLE_STUDENTS.map(s => (
                    <option key={s.name} value={s.name}>{s.name} ({s.section})</option>
                  ))}
                </select>
              </div>

              {selectedStudentData && (
                <div style={{ padding: "10px 14px", background: C.m50, borderRadius: 6, border: `1px solid ${C.borderMed}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <Mail size={14} color={C.m700} />
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Parent's Email</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginTop: 1 }}>{selectedStudentData.parentEmail}</div>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Preferred Date</label>
                  <input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, boxSizing: "border-box", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Preferred Time</label>
                  <input type="time" value={reqTime} onChange={e => setReqTime(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, boxSizing: "border-box", outline: "none" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Purpose / Agenda</label>
                <textarea
                  value={reqPurpose}
                  onChange={e => setReqPurpose(e.target.value)}
                  placeholder="Describe the purpose of this meeting..."
                  rows={3}
                  style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                <button type="button" onClick={() => setShowRequestForm(false)} style={{
                  padding: "9px 20px", background: "#fff", color: C.t2,
                  border: `1.5px solid ${C.borderMed}`, borderRadius: 6, cursor: "pointer",
                  fontSize: 12, fontWeight: 600
                }}>Cancel</button>
                <button type="submit" style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 20px", background: C.m700, color: "#fff",
                  border: "none", borderRadius: 6, cursor: "pointer",
                  fontSize: 12, fontWeight: 700, transition: "all 0.15s"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = C.m600}
                  onMouseLeave={e => e.currentTarget.style.background = C.m700}
                >
                  <Send size={14} /> Send Request & Notify Parent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Email Preview Modal ── */}
      {showEmailPreview && (() => {
        const appt = appointments.find(a => a.id === showEmailPreview);
        if (!appt) return null;
        return (
          <div onClick={() => setShowEmailPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: 520, background: "#fff", borderRadius: 12,
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)", overflow: "hidden",
              animation: "popIn 0.25s ease-out"
            }}>
              <div style={{ background: C.paper, padding: "16px 24px", borderBottom: `1px solid ${C.borderMed}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Mail size={16} color={C.m700} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Email Preview</span>
                </div>
                <button onClick={() => setShowEmailPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.t3, fontSize: 16 }}>✕</button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, width: 50 }}>To:</span>
                  <span style={{ fontSize: 11, color: C.t1 }}>{appt.parentEmail}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, width: 50 }}>From:</span>
                  <span style={{ fontSize: 11, color: C.t1 }}>noreply@calulut-is.edu.ph</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, width: 50 }}>Subject:</span>
                  <span style={{ fontSize: 11, color: C.t1, fontWeight: 600 }}>Appointment Request — Calulut Integrated School</span>
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: C.t1, lineHeight: 1.7, background: C.paper, padding: "16px 18px", borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <p style={{ margin: "0 0 10px" }}>Dear Parent/Guardian,</p>
                    <p style={{ margin: "0 0 10px" }}>
                      This is to inform you that a <strong>parent-teacher appointment</strong> has been {appt.direction === "parent-to-teacher" ? "requested by you" : "requested by the teacher"} for your child, <strong>{appt.studentName}</strong>.
                    </p>
                    <p style={{ margin: "0 0 6px" }}><strong>Details:</strong></p>
                    <ul style={{ margin: "0 0 10px", paddingLeft: 20, fontSize: 11.5 }}>
                      <li><strong>Teacher:</strong> {appt.teacherName}</li>
                      <li><strong>Date:</strong> {appt.date}</li>
                      <li><strong>Time:</strong> {appt.time}</li>
                      <li><strong>Purpose:</strong> {appt.purpose}</li>
                    </ul>
                    <p style={{ margin: "0 0 10px" }}>Please confirm your attendance by replying to this email or contacting the school office.</p>
                    <p style={{ margin: "0", color: C.t3 }}>— Calulut Integrated School</p>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.t3, background: C.amberBg, padding: "4px 12px", borderRadius: 10, border: `1px solid ${C.amber}30` }}>
                    ⚠ This is a preview — email sending is simulated
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
