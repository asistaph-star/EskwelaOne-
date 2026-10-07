import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';

import { studentApi } from '../../../api/student.api';
import { useEffect } from 'react';

export function StudentAppointments({ setTab, currentUser }: any) {
  const [apiAppointments, setApiAppointments] = React.useState<any[]>([]);
  const [teachers, setTeachers] = React.useState<any[]>([]);
  const [apptTeacher, setApptTeacher] = React.useState("");
  const [apptDate, setApptDate] = React.useState("");
  const [apptTime, setApptTime] = React.useState("");
  const [apptPurpose, setApptPurpose] = React.useState("");
  const [apptParentEmail, setApptParentEmail] = React.useState("");
  const [isSubmittingAppt, setIsSubmittingAppt] = React.useState(false);
  const [docError, setDocError] = React.useState("");
  const [showApptEmailPreview, setShowApptEmailPreview] = React.useState(false);

  const fetchAppointments = async () => {
    if (currentUser?.id) {
      try {
        const data = await studentApi.getAppointments(currentUser.id);
        const formatted = (data as any[]).map((a: any) => {
          const d = new Date(a.time);
          let hr = d.getUTCHours();
          const min = d.getUTCMinutes();
          const ampm = hr >= 12 ? 'PM' : 'AM';
          hr = hr % 12 || 12;
          return { ...a, displayTime: `${hr}:${min.toString().padStart(2, "0")} ${ampm}` };
        });
        setApiAppointments(formatted);
      } catch (err) {
        console.error(err);
      }
    }
  };

  React.useEffect(() => {
    fetchAppointments();
    studentApi.getStaff().then(staffArray => {
      const uniqueTeachers = new Map();
      if (staffArray && Array.isArray(staffArray)) {
        staffArray.forEach((staff: any) => {
          if (!uniqueTeachers.has(staff.id)) {
            uniqueTeachers.set(staff.id, { ...staff, type: 'teacher' });
          }
        });
      }
      setTeachers(Array.from(uniqueTeachers.values()));
    }).catch(console.error);
  }, [currentUser?.id]);

  const apptStatusColor = (s: string) => {
    if (s === "Approved") return C.teal;
    if (s === "Rejected") return C.red;
    return C.amber;
  };
  const apptStatusBg = (s: string) => {
    if (s === "Approved") return C.tealBg;
    if (s === "Rejected") return "#fee2e2";
    return C.goldLight;
  };

  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Header */}
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif" }}>Appointments</h2>
                <p style={{ fontSize: 14, color: C.t3, marginTop: 4 }}>Schedule meetings with teachers and guidance counselors.</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
                {/* Left Column: Form */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 16 }}>Request a Meeting</div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!apptTeacher || !apptDate || !apptTime || !apptPurpose) {
                      setDocError("Please complete all required fields.");
                      return;
                    }
                    setIsSubmittingAppt(true);
                    
                    let excuseDocId, excuseDocName, excuseDocType, excuseDocSize;
                    try {
                      await studentApi.createAppointment({
                        studentId: currentUser?.id,
                        teacherId: apptTeacher,
                        date: apptDate,
                        time: apptTime,
                        purpose: apptPurpose,
                        parentEmail: apptParentEmail || currentUser?.parentEmail || "",
                      });
                      await fetchAppointments();
                      setApptTeacher("");
                      setApptDate("");
                      setApptTime("");
                      setApptPurpose("");
                      setApptParentEmail("");
                      setDocError("");
                      setIsSubmittingAppt(false);
                    } catch (err) {
                      console.error(err);
                      setDocError("Failed to book appointment");
                      setIsSubmittingAppt(false);
                    }
                  }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Parent Email */}
                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Parent / Guardian Email</label>
                      <input
                        type="email"
                        value={apptParentEmail || currentUser?.parentEmail || ""}
                        onChange={e => setApptParentEmail(e.target.value)}
                        placeholder="parent@email.com"
                        style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", boxSizing: "border-box", outline: "none" }}
                      />
                      {currentUser?.parentEmail && !apptParentEmail && (
                        <div style={{ marginTop: 4, fontSize: 9.5, color: C.green, display: "flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle size={10} /> Auto-filled from Settings
                        </div>
                      )}
                    </div>

                    {/* Select Teacher */}
                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Select Teacher</label>
                      <select
                        value={apptTeacher}
                        onChange={e => setApptTeacher(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", color: C.t1, outline: "none", boxSizing: "border-box" }}
                      >
                        <option value="">ΓÇö Choose a teacher or staff ΓÇö</option>
                        <optgroup label="Subject Teachers">
                          {teachers.filter(t => t.type === 'subject').map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Support Staff">
                          {teachers.filter(t => t.type === 'support').map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Preferred Date</label>
                        <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)}
                          style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", boxSizing: "border-box", outline: "none" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Preferred Time</label>
                        <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)}
                          style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", boxSizing: "border-box", outline: "none" }} />
                      </div>
                    </div>

                    {/* Purpose */}
                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Purpose / Agenda</label>
                      <textarea
                        value={apptPurpose}
                        onChange={e => setApptPurpose(e.target.value)}
                        placeholder="Describe the purpose of this appointment..."
                        rows={4}
                        maxLength={300}
                        style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, resize: "none", background: "#f9fafb", boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif" }}
                      />
                      <div style={{ textAlign: "right", fontSize: 10, color: C.t3, marginTop: 4 }}>{apptPurpose.length} / 300</div>
                    </div>

                    {/* Submit */}
                    <button type="submit" disabled={isSubmittingAppt} style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      background: isSubmittingAppt ? C.borderMed : C.m700, color: "#fff", border: "none",
                      padding: "10px 18px", borderRadius: 6, cursor: isSubmittingAppt ? "default" : "pointer",
                      fontSize: 12, fontWeight: 700, width: "100%",
                      boxShadow: isSubmittingAppt ? "none" : "0 2px 8px rgba(29,78,216,0.25)",
                      transition: "all 0.15s",
                      marginTop: 8,
                      opacity: isSubmittingAppt ? 0.7 : 1
                    }}>
                      <Send size={14} /> {isSubmittingAppt ? "Sending..." : "Send Request"}
                    </button>
                  </form>
                </div>

                {/* Right Column: History */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Clock size={16} color={C.m700} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Appointment History</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.t3 }}>{apiAppointments.length} total</span>
                  </div>

                  {apiAppointments.length === 0 ? (
                    <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 48, textAlign: "center" }}>
                      <CalendarCheck size={36} color={C.t3} style={{ opacity: 0.4, marginBottom: 10 }} />
                      <div style={{ fontSize: 13, color: C.t3 }}>No appointments yet. Book your first one!</div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                    {apiAppointments.map(appt => (
                      <div key={appt.id} style={{
                        background: "#fff", border: `1px solid ${C.borderMed}`,
                        borderRadius: 12, padding: "18px 20px",
                        display: "flex", flexDirection: "column", gap: 14,
                        position: "relative"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 16, background: appt.direction === "parent-to-teacher" ? C.m50 : C.purpleBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {appt.direction === "parent-to-teacher" ? <Send size={14} color={C.m700} /> : <Mail size={14} color={C.purple} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, lineHeight: 1.3 }}>{appt.teacherName}</div>
                              <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                {appt.direction === "parent-to-teacher" ? "You ΓåÆ Teacher" : "Teacher ΓåÆ Parent"}
                              </div>
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: apptStatusColor(appt.status),
                            background: apptStatusBg(appt.status), padding: "3px 10px",
                            borderRadius: 10, border: `1px solid ${apptStatusColor(appt.status)}20`,
                            display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                          }}><div style={{ width: 5, height: 5, borderRadius: 3, background: apptStatusColor(appt.status) }} />{appt.status}</span>
                        </div>

                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t2 }}>
                            <CalendarCheck size={11} color={C.m700} /> {appt.date}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t2 }}>
                            <Clock size={11} color={C.m700} /> {appt.time}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t2 }}>
                            <Mail size={11} color={C.m700} /> {appt.parentEmail}
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: C.t2, padding: "10px 14px", background: "#f9fafb", borderRadius: 8, borderLeft: `3px solid ${C.m700}` }}>
                          <strong style={{ color: C.t1, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 4 }}>Purpose:</strong> {appt.purpose}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 9.5, color: C.t3 }}>Requested on {appt.createdAt}</span>
                          <button
                            onClick={() => setShowApptEmailPreview(appt.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              background: "#fff", color: C.m700, border: `1px solid ${C.borderMed}`,
                              padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                              fontSize: 10, fontWeight: 600, transition: "all 0.15s",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.m50; e.currentTarget.style.borderColor = `${C.m700}30`; e.currentTarget.style.boxShadow = "none"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = C.borderMed; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.02)"; }}
                          >
                            <Eye size={11} /> View Email
                          </button>
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
  );
}
