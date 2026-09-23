import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { CalendarCheck, Clock, Mail, User, Send, CheckCircle, XCircle, ChevronDown, Users, FileText, Filter, Search, Eye } from 'lucide-react';
import { apiClient } from '../../../api/client';

type AppointmentStatus = "Pending" | "Confirmed" | "Declined" | "Completed" | "Cancelled";

export function AppointmentsScreen() {
  const { addNotification } = useAppContext();
  
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing" | "history">("incoming");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | AppointmentStatus>("all");
  
  const [apiAppointments, setApiAppointments] = useState<any[]>([]);
  const [apiStudents, setApiStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Request form state
  const [selStudent, setSelStudent] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [reqTime, setReqTime] = useState("");
  const [reqPurpose, setReqPurpose] = useState("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [apptsRes, studentsRes] = await Promise.all([
        apiClient.get('/student-services/appointments/me'),
        apiClient.get('/student-services/appointments/students')
      ]);

      const formatted = (apptsRes || []).map((a: any) => {
        const d = new Date(a.time);
        let hr = d.getUTCHours();
        const min = d.getUTCMinutes();
        const ampm = hr >= 12 ? 'PM' : 'AM';
        hr = hr % 12 || 12;
        const timeStr = `${hr}:${min.toString().padStart(2, '0')} ${ampm}`;
        
        return {
          id: a.id,
          direction: a.direction,
          teacherId: a.teacher_id,
          studentId: a.student_id,
          teacherName: a.teacher?.user?.first_name ? `${a.teacher.user.first_name} ${a.teacher.user.last_name}` : "Teacher",
          studentName: a.student?.user?.first_name ? `${a.student.user.first_name} ${a.student.user.last_name}` : "Student",
          parentEmail: a.parent_email,
          date: new Date(a.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          time: timeStr,
          purpose: a.purpose,
          status: a.status
        };
      });
      setApiAppointments(formatted);
      
      const st = (studentsRes || []);
      const mappedStudents = st.map((s: any) => ({
        id: s.id,
        name: `${s.user.first_name} ${s.user.last_name}`,
        parentEmail: s.guardian_email,
        section: s.current_section?.name || "Unassigned"
      }));
      setApiStudents(mappedStudents);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load appointments and students.");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const selectedStudentData = apiStudents.find(s => s.id === selStudent);

  const incomingAppointments = apiAppointments.filter(a => a.direction === "parent-to-teacher");
  const outgoingAppointments = apiAppointments.filter(a => a.direction === "teacher-to-parent");
  const allTeacherAppointments = apiAppointments;

  const filteredHistory = filterStatus === "all" ? allTeacherAppointments : allTeacherAppointments.filter(a => a.status === filterStatus);

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (isSendingRequest) return;
    if (!selStudent || !reqDate || !reqTime || !reqPurpose) return;
    
    const student = apiStudents.find(s => s.id === selStudent);
    if (!student) return;

    setIsSendingRequest(true);
    try {
      await apiClient.post('/student-services/appointments', {
        studentId: student.id,
        date: reqDate,
        time: reqTime,
        purpose: reqPurpose
      });

      await fetchData();
      addNotification(`Appointment request sent to ${student.name}'s parent.`, "success");

      setSelStudent("");
      setReqDate("");
      setReqTime("");
      setReqPurpose("");
      setShowRequestForm(false);
    } catch (err: any) {
      console.error("Failed to send appointment request:", err);
      addNotification(err.message || "Failed to send request", "error");
    } finally {
      setIsSendingRequest(false);
    }
  }

  async function handleUpdateStatus(id: string, status: string) {
    try {
      await apiClient.patch(`/student-services/appointments/${id}/status`, { status });
      await fetchData();
      addNotification(`Appointment ${status.toLowerCase()}.`, "success");
    } catch (err: any) {
      console.error(err);
      addNotification(err.message || `Failed to update appointment.`, "error");
    }
  }

  function statusColor(s: AppointmentStatus | string) {
    return s === "Confirmed" ? C.green : s === "Pending" ? "#f59e0b" : s === "Declined" || s === "Rejected" ? C.red : C.blue;
  }
  function statusBg(s: AppointmentStatus | string) {
    return s === "Confirmed" ? C.greenBg : s === "Pending" ? "#fef3c7" : s === "Declined" || s === "Rejected" ? C.redBg : C.blueBg;
  }

  const pendingIncoming = incomingAppointments.filter(a => a.status === "Pending");
  const pendingOutgoing = outgoingAppointments.filter(a => a.status === "Pending");

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTopColor: C.m700, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.t2, marginTop: 16 }}>Loading appointments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 32, background: C.redBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <XCircle size={32} color={C.red} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", marginBottom: 8 }}>Unable to Load Data</h2>
        <p style={{ fontSize: 13, color: C.t3, maxWidth: 300, lineHeight: 1.5, textAlign: "center" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 32px 100px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Parent-Teacher Appointments</h1>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>Manage appointment requests between parents and teachers.</div>
          </div>
          <button
            onClick={() => setShowRequestForm(true)}
            disabled={apiStudents.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: apiStudents.length === 0 ? C.borderMed : C.m700, color: apiStudents.length === 0 ? C.t3 : "#fff", border: "none",
              padding: "10px 20px", borderRadius: 6, cursor: apiStudents.length === 0 ? "not-allowed" : "pointer",
              fontSize: 12, fontWeight: 700,
              boxShadow: apiStudents.length === 0 ? "none" : "0 2px 8px rgba(29,78,216,0.25)",
              transition: "all 0.15s"
            }}
            title={apiStudents.length === 0 ? "No Students Available" : ""}
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
                  background: activeTab === t.id ? C.m700 : C.m100,
                  color: activeTab === t.id ? "#fff" : C.m700,
                  fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* INCOMING TAB */}
        {activeTab === "incoming" && (
          <div className="fade-in">
            {incomingAppointments.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", background: "#fff", border: `1.5px dashed ${C.border}`, borderRadius: 12, marginTop: 10 }}>
                <Mail size={32} color={C.border} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: C.t2 }}>No Incoming Requests</div>
                <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>You don't have any appointment requests from parents.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, marginTop: 10 }}>
                {incomingAppointments.map(appt => (
                  <div key={appt.id} style={{
                    background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 10,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)", overflow: "hidden", display: "flex", flexDirection: "column"
                  }}>
                    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 16, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <User size={16} color={C.m700} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Parent of</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{appt.studentName}</div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: statusColor(appt.status),
                          background: statusBg(appt.status), padding: "3px 10px",
                          borderRadius: 10, border: `1px solid ${statusColor(appt.status)}20`
                        }}>{appt.status}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.t2 }}>
                          <CalendarCheck size={14} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{appt.date}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.t2 }}>
                          <Clock size={14} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{appt.time}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "14px 18px", flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Purpose</div>
                      <p style={{ fontSize: 12, color: C.t1, margin: 0, lineHeight: 1.5 }}>"{appt.purpose}"</p>
                    </div>
                    
                    <div style={{ padding: "12px 18px", background: C.paper, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
                      {appt.status === "Pending" ? (
                        <>
                          <button onClick={() => handleUpdateStatus(appt.id, "Confirmed")} style={{ flex: 1, padding: "8px 0", background: C.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <CheckCircle size={14} /> Accept
                          </button>
                          <button onClick={() => handleUpdateStatus(appt.id, "Rejected")} style={{ flex: 1, padding: "8px 0", background: "#fff", color: C.red, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <XCircle size={14} /> Decline
                          </button>
                        </>
                      ) : (
                        <div style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 600, color: C.t3 }}>
                          This request has been {appt.status.toLowerCase()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* OUTGOING TAB */}
        {activeTab === "outgoing" && (
          <div className="fade-in">
            {outgoingAppointments.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", background: "#fff", border: `1.5px dashed ${C.border}`, borderRadius: 12, marginTop: 10 }}>
                <Send size={32} color={C.border} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: C.t2 }}>No Sent Requests</div>
                <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>You haven't requested any appointments with parents.</div>
                <button
                  onClick={() => setShowRequestForm(true)}
                  disabled={apiStudents.length === 0}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: apiStudents.length === 0 ? C.borderMed : C.m700, color: apiStudents.length === 0 ? C.t3 : "#fff", border: "none",
                    padding: "10px 20px", borderRadius: 6, cursor: apiStudents.length === 0 ? "not-allowed" : "pointer",
                    fontSize: 12, fontWeight: 700, marginTop: 16
                  }}
                >
                  <CalendarCheck size={15} /> Request Appointment
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, marginTop: 10 }}>
                {outgoingAppointments.map(appt => (
                  <div key={appt.id} style={{
                    background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 10,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)", overflow: "hidden", display: "flex", flexDirection: "column"
                  }}>
                    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 16, background: C.blueBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Mail size={16} color={C.blue} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>To Parent of</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{appt.studentName}</div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: statusColor(appt.status),
                          background: statusBg(appt.status), padding: "3px 10px",
                          borderRadius: 10, border: `1px solid ${statusColor(appt.status)}20`
                        }}>{appt.status}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.t2 }}>
                          <CalendarCheck size={14} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{appt.date}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.t2 }}>
                          <Clock size={14} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{appt.time}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "14px 18px", flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Purpose</div>
                      <p style={{ fontSize: 12, color: C.t1, margin: 0, lineHeight: 1.5 }}>"{appt.purpose}"</p>
                    </div>
                    
                    <div style={{ padding: "12px 18px", background: C.paper, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: C.t3, fontWeight: 600 }}>Sent to: {appt.parentEmail}</span>
                      <button onClick={() => setShowEmailPreview(appt.id)} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <Eye size={12} /> View Email
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", padding: "6px 12px", borderRadius: 6, border: `1.5px solid ${C.borderMed}` }}>
                <Filter size={14} color={C.t3} />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.t2 }}>Filter Status:</span>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                  style={{ background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: C.t1, outline: "none", cursor: "pointer" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Declined">Declined</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 10, border: `1.5px solid ${C.borderMed}`, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
                    <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>Direction</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>Student</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>Date & Time</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>Purpose</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", fontSize: 12, color: C.t3 }}>No appointments match the current filter.</td></tr>
                  ) : (
                    filteredHistory.map((appt, i) => (
                      <tr key={appt.id} style={{ borderBottom: i === filteredHistory.length - 1 ? "none" : `1px solid ${C.border}` }}>
                        <td style={{ padding: "10px 14px" }}>
                          {appt.direction === "parent-to-teacher" ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.blueBg, color: C.blue, padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}><Users size={12} /> Incoming</div>
                          ) : (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.m100, color: C.m700, padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}><User size={12} /> Outgoing</div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 600, color: C.t1 }}>{appt.studentName}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.t1 }}>{appt.date}</div>
                          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{appt.time}</div>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: C.t2, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{appt.purpose}</td>
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

      {/* Request Form Modal */}
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
                  <option value="">- Choose a student -</option>
                  {apiStudents.length === 0 ? (
                    <option value="" disabled>No Students Available (No Assigned Sections)</option>
                  ) : (
                    apiStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.section})</option>
                    ))
                  )}
                </select>
              </div>

              {selectedStudentData && (
                <div style={{ padding: "10px 14px", background: C.m50, borderRadius: 6, border: `1px solid ${C.borderMed}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <Mail size={14} color={C.m700} />
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Parent's Email</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginTop: 1 }}>{selectedStudentData.parentEmail || "No email on record"}</div>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Preferred Date</label>
                  <input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} required
                    style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, boxSizing: "border-box", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Preferred Time</label>
                  <input type="time" value={reqTime} onChange={e => setReqTime(e.target.value)} required
                    style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, boxSizing: "border-box", outline: "none" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Purpose / Agenda</label>
                <textarea
                  value={reqPurpose}
                  onChange={e => setReqPurpose(e.target.value)}
                  placeholder="Describe the purpose of this meeting..."
                  rows={3} required
                  style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                <button type="button" onClick={() => setShowRequestForm(false)} style={{
                  padding: "9px 20px", background: "#fff", color: C.t2,
                  border: `1.5px solid ${C.borderMed}`, borderRadius: 6, cursor: "pointer",
                  fontSize: 12, fontWeight: 600
                }}>Cancel</button>
                <button type="submit" disabled={isSendingRequest} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 20px", background: isSendingRequest ? C.borderMed : C.m700, color: "#fff",
                  border: "none", borderRadius: 6, cursor: isSendingRequest ? "not-allowed" : "pointer",
                  fontSize: 12, fontWeight: 700, transition: "all 0.15s"
                }}
                >
                  <Send size={14} /> {isSendingRequest ? "Sending..." : "Send Request & Notify"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {showEmailPreview && (() => {
        const appt = apiAppointments.find(a => a.id === showEmailPreview);
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
                  <span style={{ fontSize: 11, color: C.t1 }}>{appt.parentEmail || "N/A"}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, width: 50 }}>From:</span>
                  <span style={{ fontSize: 11, color: C.t1 }}>noreply@calulut-is.edu.ph</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, width: 50 }}>Subject:</span>
                  <span style={{ fontSize: 11, color: C.t1, fontWeight: 600 }}>Appointment Request - Calulut Integrated School</span>
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
                    ⚠️ This is a preview - email sending is simulated
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
