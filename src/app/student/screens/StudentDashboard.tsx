import React from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';

export function StudentDashboard({ setTab, currentUser, events, apiAppointments, apiDocRequests, apiExcuses, apiGateAttendance = [], assignments = [], assignmentSubmissions = [], announcements = [] }: any) {
  const myGateScans = apiGateAttendance || [];
  const myAssignments = assignments ? assignments.filter((a: any) => a.section === currentUser?.section) : [];
  const mySubmissions = assignmentSubmissions ? assignmentSubmissions.filter((s: any) => s.studentId === currentUser?.id) : [];
  const myPendingAssignments = myAssignments.filter((a: any) => !mySubmissions.some((s: any) => s.assignmentId === a.id));

  return (
<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* KPI metrics strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: "Attendance Scans", val: myGateScans.length.toString(), sub: "Gate Scans Recorded", icon: CheckCircle, color: C.green, bg: "#f0fdf4" },
                  { label: "Assignments Due", val: myPendingAssignments.length.toString(), sub: "Incomplete Assignments", icon: ClipboardList, color: C.red, bg: "#fef2f2" },
                  { label: "Today's Classes", val: "Unavailable", sub: "Schedule not yet synced", icon: Clock, color: C.t3, bg: "#eff6ff" }
                ].map((kpi, idx) => {
                  const Icon = kpi.icon;
                  return (
                    <div key={idx} className="hover-zoom" style={{ 
                      background: "#fff", 
                      border: `1.5px solid ${C.borderMed}`, 
                      borderRadius: 8, 
                      padding: "12px 14px", 
                      boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 12, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={12} color={kpi.color} />
                        </div>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: C.t3 }}>{kpi.label}</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{kpi.val}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: kpi.color }}>{kpi.sub}</div>
                    </div>
                  );
                })}
              </div>

              {/* Main content layout with Left (2 columns) and Right (340px) structure */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_340px] gap-5">
                
                {/* Left Area: Contains Schedule, Assignments, and Announcements */}
                <div className="col-span-1 xl:col-span-2 flex flex-col gap-5">
                  
                  {/* Row 1: Schedule and Assignments side-by-side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* 1. Today's Schedule */}
                    <div className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Calendar size={16} color={C.m700} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Today's Schedule</span>
                        </div>
                        <button onClick={() => setTab("calendar")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View Calendar</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <Clock size={32} color={C.t3} style={{ opacity: 0.4 }} />
                        <span style={{ fontSize: 11.5, color: C.t3, textAlign: "center", marginTop: 8 }}>Detailed student schedules are not yet available.</span>
                      </div>
                      <button onClick={() => setTab("calendar")} style={{ 
                        alignSelf: "center",
                        padding: "7px 24px",
                        background: "#fff",
                        border: `1.5px solid rgba(139, 30, 30, 0.15)`,
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: C.m700,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        display: "block",
                        margin: "12px auto 0"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.m50; e.currentTarget.style.borderColor = C.m700; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "rgba(139, 30, 30, 0.15)"; }}
                      >
                        View Calendar Events
                      </button>
                    </div>

                    {/* 2. Upcoming Assignments */}
                    <div className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ClipboardList size={16} color={C.m700} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Upcoming Assignments</span>
                        </div>
                        <button onClick={() => setTab("assignments")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View All</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                        {myPendingAssignments.slice(0, 4).map((ass) => (
                          <div key={ass.id} style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: 12, 
                            padding: 10, 
                            border: `1px solid ${C.borderMed}`, 
                            borderRadius: 6,
                            background: "#fff"
                          }}>
                            <div style={{ width: 32, height: 32, borderRadius: 4, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <ClipboardList size={14} color={C.m700} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ass.title}</div>
                              <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>{ass.subject}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: C.t3 }}>Due {ass.dueDate}</div>
                            </div>
                          </div>
                        ))}
                        {myPendingAssignments.length === 0 && (
                          <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: C.t3 }}>No upcoming assignments.</div>
                        )}
                      </div>
                      <button onClick={() => setTab("assignments")} style={{ 
                        alignSelf: "center",
                        padding: "7px 24px",
                        background: "#fff",
                        border: `1.5px solid rgba(139, 30, 30, 0.15)`,
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: C.m700,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        display: "block",
                        margin: "12px auto 0"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.m50; e.currentTarget.style.borderColor = C.m700; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "rgba(139, 30, 30, 0.15)"; }}
                      >
                        View All Assignments
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Announcements */}
                  <div className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Megaphone size={16} color={C.m700} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Announcements</span>
                      </div>
                      <button onClick={() => setTab("announcements")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View All</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(() => {
                        const dashboardAnnouncements = announcements
                          .filter(a => a.audience === "All" || a.audience === "Students")
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .slice(0, 3);
                          
                        return (
                          <>
                            {dashboardAnnouncements.map((ann) => (
                              <div key={ann.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", border: `1px solid ${C.borderMed}`, borderRadius: 6, position: "relative" }}>
                                <div style={{ width: 28, height: 28, borderRadius: 14, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                  <Bell size={13} color={C.m700} />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{ann.title}</div>
                                  <p style={{ fontSize: 10.5, color: C.t2, margin: "4px 0", lineHeight: 1.4 }}>{ann.body}</p>
                                  <span style={{ fontSize: 9, color: C.t3 }}>{new Date(ann.created_at || new Date()).toLocaleDateString()} &middot; {ann.author?.first_name ? `${ann.author.first_name} ${ann.author.last_name}` : "Administration"}</span>
                                </div>
                              </div>
                            ))}
                            {dashboardAnnouncements.length === 0 && (
                              <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: C.t3 }}>No announcements at this time.</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Row 3: Pending Requests and Appointments */}
                  <div className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileText size={16} color={C.m700} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Pending Requests & Appointments</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {(() => {
                          const myAppts = apiAppointments.filter(a => a.status === "Pending" || a.status === "Confirmed");
                          const myDocs = apiDocRequests.filter(d => d.status !== "Completed" && !d.status.includes("Rejected"));
                          const myExcuses = apiExcuses.filter(e => e.status === "Pending Review");
                          
                          const hasAny = myAppts.length > 0 || myDocs.length > 0 || myExcuses.length > 0;
                          
                          return (
                            <>
                              {myAppts.map(appt => (
                                <div key={appt.id} className="hover-lift" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.m50, padding: "10px 14px", borderRadius: 8, cursor: "pointer", border: `1px solid ${C.borderLight}` }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.borderLight}` }}>
                                      <Calendar size={14} color={C.m700} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{appt.teacher_name}</div>
                                      <div style={{ fontSize: 10.5, color: C.t2 }}>{new Date(appt.date).toLocaleDateString()} at {appt.time}</div>
                                    </div>
                                  </div>
                                  <Stamp label={appt.status} color={appt.status === "Confirmed" ? C.green : "#f59e0b"} bg={appt.status === "Confirmed" ? C.greenBg : "#fef3c7"} />
                                </div>
                              ))}
                              {myDocs.map(doc => (
                                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: `1px solid ${C.borderMed}`, borderRadius: 6 }}>
                                  <FileText size={14} color={C.m700} />
                                  <div style={{ flex: 1, fontSize: 11.5, color: C.t1 }}>Request for <strong>{doc.documentType}</strong></div>
                                  <span style={{ fontSize: 9.5, padding: "2px 8px", background: "#eff6ff", color: C.blue, borderRadius: 10, fontWeight: 700 }}>{doc.status}</span>
                                </div>
                              ))}
                              {myExcuses.map(excuse => (
                                <div key={excuse.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: `1px solid ${C.borderMed}`, borderRadius: 6 }}>
                                  <AlertTriangle size={14} color={C.m700} />
                                  <div style={{ flex: 1, fontSize: 11.5, color: C.t1 }}>Excuse Letter (Absence on {excuse.dates})</div>
                                  <span style={{ fontSize: 9.5, padding: "2px 8px", background: "#fff7ed", color: "#f97316", borderRadius: 10, fontWeight: 700 }}>Pending</span>
                                </div>
                              ))}
                              
                              {!hasAny && (
                                <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: C.t3 }}>You have no pending requests or upcoming appointments.</div>
                              )}
                            </>
                          );
                        })()}
                    </div>
                  </div>

                </div>

                {/* Right Area: Stacked Column for Academic Calendar */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
                  
                  {/* Academic Calendar Widget */}
                  <div className="hover-zoom" style={{ flex: 1, background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={16} color={C.m700} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Academic Calendar</span>
                      </div>
                      <button onClick={() => setTab("calendar")} style={{ background: "none", border: "none", color: C.m700, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View Calendar</button>
                    </div>
                    <div style={{ borderBottom: `0.5px solid ${C.border}`, paddingBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>Upcoming Events</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(() => {
                        const now = new Date();
                        const upcomingEvents = events
                          .filter(e => (e.audience === "all" || e.audience === "students") && new Date(e.date) >= now)
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .slice(0, 3);
                          
                        return upcomingEvents.map((ev, idx) => {
                          const dateObj = new Date(ev.date);
                          const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                          const day = dateObj.getDate();
                          return (
                            <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ width: 36, height: 36, background: C.m50, border: `1px solid ${C.borderMed}`, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: 7, fontWeight: 800, color: C.m700 }}>{month}</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: C.m700, lineHeight: 1 }}>{day}</span>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{ev.title}</div>
                                <div style={{ fontSize: 9, color: C.t3, marginTop: 2 }}>{ev.time ? ev.time + (ev.endTime ? " - " + ev.endTime : "") : "All Day"}</div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                      {events.filter(e => e.audience === "all" || e.audience === "students").length === 0 && (
                        <div style={{ fontSize: 11, color: C.t3, textAlign: "center", padding: "10px 0" }}>No upcoming events.</div>
                      )}
                    </div>
                    <button onClick={() => setTab("calendar")} style={{ 
                      alignSelf: "center",
                      padding: "7px 24px",
                      background: "#fff",
                      border: `1.5px solid rgba(139, 30, 30, 0.15)`,
                      borderRadius: 6,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: C.m700,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      display: "block",
                      margin: "auto auto 0"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.m50; e.currentTarget.style.borderColor = C.m700; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "rgba(139, 30, 30, 0.15)"; }}
                    >
                      View Full Calendar
                    </button>
                  </div>

                </div>

              </div>

            </div>
  );
}
