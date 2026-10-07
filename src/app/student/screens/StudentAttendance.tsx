import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';

import { studentApi } from '../../../api/student.api';
import { useEffect } from 'react';

export function StudentAttendance({ setTab, currentUser }: any) {
  const [apiGateAttendance, setApiGateAttendance] = React.useState<any[]>([]);
  const [apiExcuses, setApiExcuses] = React.useState<any[]>([]);
  const [teachers, setTeachers] = React.useState<any[]>([]);
  const [excuseTeacher, setExcuseTeacher] = React.useState("");
  const [excuseStartDate, setExcuseStartDate] = React.useState("");
  const [excuseEndDate, setExcuseEndDate] = React.useState("");
  const [excuseText, setExcuseText] = React.useState("");
  const [excuseError, setExcuseError] = React.useState("");
  const [excuseFile, setExcuseFile] = React.useState<File | null>(null);
  const [isSubmittingExcuse, setIsSubmittingExcuse] = React.useState(false);
  const [uploadSuccess, setUploadSuccess] = React.useState("");

  const formatTimeDisplay = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${minutes} ${ampm}`;
  };

  const fetchExcuses = async () => {
    if (currentUser?.id) {
      try {
        const data = await studentApi.getExcuseLetters(currentUser.id);
        setApiExcuses(data as any[]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleExcuseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excuseTeacher || !excuseStartDate || !excuseEndDate || !excuseText) {
      setExcuseError("Please fill out all required fields.");
      return;
    }
    setIsSubmittingExcuse(true);
    try {
      let attachmentUrl = null;
      if (excuseFile) {
        attachmentUrl = await studentApi.uploadDocument(excuseFile);
      }
      await studentApi.createExcuseLetter({
        teacherId: excuseTeacher,
        startDate: excuseStartDate,
        endDate: excuseEndDate,
        reason: excuseText,
        documentId: attachmentUrl?.data?.id || null
      });
      setUploadSuccess("Excuse letter submitted successfully.");
      setExcuseTeacher("");
      setExcuseStartDate("");
      setExcuseEndDate("");
      setExcuseText("");
      setExcuseFile(null);
      fetchExcuses();
      setTimeout(() => setUploadSuccess(""), 4000);
    } catch (err) {
      console.error(err);
      setExcuseError("Failed to submit excuse letter.");
    } finally {
      setIsSubmittingExcuse(false);
    }
  };

  React.useEffect(() => {
    if (currentUser?.id) {
      studentApi.getGateAttendance(currentUser.id).then(setApiGateAttendance).catch(console.error);
      fetchExcuses();
      
      studentApi.getStaff().then((staffArray: any) => {
        const uniqueTeachers = new Map();
        if (staffArray && Array.isArray(staffArray)) {
          staffArray.forEach((s: any) => {
            if (!uniqueTeachers.has(s.id)) uniqueTeachers.set(s.id, { ...s, type: 'support' });
          });
        }
        setTeachers(Array.from(uniqueTeachers.values()));
      }).catch(console.error);
    }
  }, [currentUser?.id]);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 w-full">
              
              {/* Left Column: Logs & Excuse Letter Form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {/* Visual Attendance Trend line chart */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                   <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 16 }}>Attendance Trend (Current Term)</div>
                   <div style={{ height: 160 }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={[
                         { week: "Week 1", rate: 100 }, { week: "Week 2", rate: 95 }, { week: "Week 3", rate: 80 }, { week: "Week 4", rate: 90 }, { week: "Week 5", rate: 98 }
                       ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                         <XAxis dataKey="week" stroke={C.t3} fontSize={10} tickLine={false} axisLine={false} />
                         <YAxis domain={[0, 100]} stroke={C.t3} fontSize={10} tickLine={false} axisLine={false} tickFormatter={val => `${val}%`} />
                         <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(val: number) => [`${val}%`, "Attendance Rate"]} />
                         <Line type="monotone" dataKey="rate" stroke={C.green} strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 4, stroke: C.green, strokeWidth: 2, fill: "#fff" }} />
                       </LineChart>
                     </ResponsiveContainer>
                   </div>
                </div>

                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", background: "#fff" }}>Gate Attendance Logs</div>
                  <div className="overflow-x-auto w-full">
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                    <thead>
                      <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
                        {["Date", "Time In", "Time Out", "Status"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 14px", fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {apiGateAttendance
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((row, idx, arr) => {
                          let trendIcon = null;
                          if (idx < arr.length - 1) {
                            const prev = arr[idx + 1];
                            const currH = parseInt(row.time_in?.split(':')[0] || '0');
                            const currM = parseInt(row.time_in?.split(':')[1] || '0');
                            const prevH = parseInt(prev.time_in?.split(':')[0] || '0');
                            const prevM = parseInt(prev.time_in?.split(':')[1] || '0');
                            const currTotal = currH * 60 + currM;
                            const prevTotal = prevH * 60 + prevM;
                            if (currTotal < prevTotal - 10) trendIcon = <span style={{ color: C.green, fontSize: 10, fontWeight: 700, background: C.greenBg, padding: "2px 6px", borderRadius: 10 }}>Earlier! ≡ƒÜÇ</span>;
                            else if (currTotal > prevTotal + 10) trendIcon = <span style={{ color: C.red, fontSize: 10, fontWeight: 700, background: C.redBg, padding: "2px 6px", borderRadius: 10 }}>Later ≡ƒôë</span>;
                          }
                          return (
                            <tr key={row.id} style={{ borderBottom: idx < arr.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                              <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: C.t1 }}>{row.date}</td>
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", color: C.t2 }}>{formatTimeDisplay(row.time_in) || "--:--"}</div>
                                  {trendIcon}
                                </div>
                              </td>
                              <td style={{ padding: "10px 14px", fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", color: C.t2 }}>{formatTimeDisplay(row.time_out) || "--:--"}</td>
                              <td style={{ padding: "10px 14px" }}>
                                {row.status === "Present" ? (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.greenBg, color: C.green, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}><CheckCircle size={12} /> Present</div>
                                  ) : row.status === "Absent" ? (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.redBg, color: C.red, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}><AlertTriangle size={12} /> Absent</div>
                                  ) : row.status === "Late Arrival" ? (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}><Clock size={12} /> Late</div>
                                  ) : (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.m100, color: C.t2, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{row.status}</div>
                                  )}
                              </td>
                            </tr>
                          );
                      })}
                      {apiGateAttendance.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: C.t3, fontSize: 11 }}>No attendance records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>

                {/* Excuse Letter Submission form */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 16 }}>Submit Absence Excuse Letter</div>
                  <form onSubmit={handleExcuseSubmit}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Select Teacher / Class</label>
                      <select
                        value={excuseTeacher}
                        onChange={e => setExcuseTeacher(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 12, appearance: "none" }}
                      >
                        <option value="">ΓÇö Choose a teacher ΓÇö</option>
                        
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
                    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Start Date</label>
                        <input type="date" value={excuseStartDate} onChange={e => setExcuseStartDate(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 12 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>End Date</label>
                        <input type="date" value={excuseEndDate} onChange={e => setExcuseEndDate(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 12 }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Absence Reason / Explanation</label>
                      <textarea
                        value={excuseText}
                        onChange={e => setExcuseText(e.target.value)}
                        placeholder="Please write why you missed class (e.g. sick, emergency consultation)..."
                        style={{ width: "100%", height: 80, padding: 12, fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", outline: "none", boxSizing: "border-box", resize: "vertical" }}
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Attachment (Optional)</label>
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              setExcuseError("File must be smaller than 10MB");
                              setExcuseFile(null);
                            } else {
                              setExcuseFile(file);
                              setExcuseError("");
                            }
                          }
                        }}
                        style={{ width: "100%", padding: "8px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb" }}
                      />
                      <div style={{ fontSize: 9.5, color: C.t3, marginTop: 4 }}>Supported formats: PDF, JPEG, PNG. Max size: 10MB</div>
                    </div>
                    {excuseError && <div style={{ fontSize: 11, color: C.red, marginBottom: 12, background: C.redBg, padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.red}30` }}>{excuseError}</div>}
                    <button type="submit" disabled={isSubmittingExcuse} style={{ background: isSubmittingExcuse ? C.m600 : C.m700, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6, cursor: isSubmittingExcuse ? "default" : "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}>
                      <Send size={14} /> {isSubmittingExcuse ? "Submitting..." : "Submit Excuse Letter"}
                    </button>
                    {uploadSuccess && <div style={{ fontSize: 11, color: C.green, marginTop: 12, fontWeight: 600 }}>Excuse letter submitted successfully!</div>}
                  </form>
                </div>
              </div>

              {/* Right Column: Attendance Calendar & submission logs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 16 }}>Attendance Calendar (June 2025)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center" }}>
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                      <span key={d} style={{ fontSize: 8.5, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>{d}</span>
                    ))}
                    {Array.from({ length: 35 }).map((_, idx) => {
                      const day = idx - 2;
                      const valid = day > 0 && day <= 30;
                      
                      const isAbsent = day === 7;
                      const isLate = day === 8;
                      const isHoliday = day === 12;
                      const isWeekend = idx % 7 === 0 || idx % 7 === 6;

                      let bg = "transparent";
                      let c = C.t2;
                      let dot = null;

                      if (valid) {
                        if (isWeekend) {
                          bg = "#f3f4f6";
                          c = C.t3;
                        } else if (isAbsent) {
                          dot = C.red;
                        } else if (isLate) {
                          dot = C.amber;
                        } else if (isHoliday) {
                          bg = C.blueBg;
                          c = C.blue;
                        } else if (day < 11) {
                          dot = C.green;
                        }
                      }

                      return (
                        <div key={idx} style={{
                          height: 30, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          background: bg, borderRadius: 3, fontSize: 11, fontWeight: valid && !isWeekend ? 600 : 400, color: c, position: "relative"
                        }}>
                          {valid ? day : ""}
                          {dot && <div style={{ width: 4, height: 4, borderRadius: 2, background: dot, position: "absolute", bottom: 2 }} />}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: C.green }}/> Present</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: C.amber }}/> Late</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: C.red }}/> Absent</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: C.blue }}/> Holiday</div>
                  </div>
                </div>

                {/* Submitted excuse letters history */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Excuse Letter Log</div>
                    {apiExcuses.map((log, i) => (
                      <div key={log.id} style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `0.5px solid ${C.border}` }}>
                        <div>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.t1 }}>{log.reason || "Absence Excuse"}</div>
                          <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>For: {new Date(log.start_date).toLocaleDateString()} - {new Date(log.end_date).toLocaleDateString()}</div>
                          {log.document_id && (
                            <button 
                              onClick={async () => {
                                try {
                                  const presignRes: any = await studentApi.getPresignedDownloadUrl(log.document_id);
                                  const url = presignRes?.url || presignRes?.data?.url;
                                  if (url) {
                                      window.open(url.startsWith('http') ? url : `http://localhost:5000${url}`, '_blank');
                                  } else {
                                      alert("Failed to load attachment");
                                  }
                                } catch (e) {
                                  alert("Failed to load attachment");
                                }
                              }}
                              type="button"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.blue, fontSize: 10, fontWeight: 600, padding: 0, marginTop: 6, cursor: "pointer" }}
                            >
                              <Paperclip size={10} /> View Attachment
                            </button>
                          )}
                        </div>
                        <Stamp label={log.status} color={log.status === "Approved" ? C.green : log.status === "Rejected" ? C.red : C.amber} bg={log.status === "Approved" ? C.greenBg : log.status === "Rejected" ? C.redBg : C.amberBg} />
                      </div>
                    ))}
                    {apiExcuses.length === 0 && (
                      <div style={{ padding: "30px 20px", fontSize: 12, color: C.t3, textAlign: "center" }}>No excuse letters submitted yet.</div>
                    )}
                  </div>
              </div>
            </div>
  );
}
