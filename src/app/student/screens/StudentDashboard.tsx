import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck, BookOpen,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';

export function StudentDashboard({ setTab, currentUser }: any) {
  const [apiGateAttendance, setApiGateAttendance] = useState<any[]>([]);
  const [apiAppointments, setApiAppointments] = useState<any[]>([]);
  const [apiDocRequests, setApiDocRequests] = useState<any[]>([]);
  const [apiExcuses, setApiExcuses] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [academicData, setAcademicData] = useState<{
    student?: any;
    enrollment?: any;
    classes?: any[];
  } | null>(null);
  const [isLoadingAcademic, setIsLoadingAcademic] = useState(true);
  
  // No backend for assignments
  const assignments: any[] = [];
  const assignmentSubmissions: any[] = [];

  useEffect(() => {
    import('../../../api/student.api').then(({ studentApi }) => {
      studentApi.getMyClasses()
        .then((res: any) => {
          const data = res?.data || res;
          setAcademicData(data);
        })
        .catch(console.error)
        .finally(() => setIsLoadingAcademic(false));

      if (currentUser?.id) {
        studentApi.getGateAttendance(currentUser.id).then((data: any) => setApiGateAttendance(data)).catch(console.error);
        studentApi.getAppointments(currentUser.id).then((data: any) => setApiAppointments(data)).catch(console.error);
        studentApi.getDocumentRequests(currentUser.id).then((data: any) => setApiDocRequests(data)).catch(console.error);
        studentApi.getExcuseLetters(currentUser.id).then((data: any) => setApiExcuses(data)).catch(console.error);
      }
    });
    
    apiClient.get<any[]>('/admin/events').then(setEvents).catch(console.error);
    apiClient.get<any[]>('/admin/announcements').then(setAnnouncements).catch(console.error);
  }, [currentUser?.id]);

  const myGateScans = apiGateAttendance || [];
  const myAssignments = assignments.filter((a: any) => a.section === currentUser?.section);
  const mySubmissions = assignmentSubmissions.filter((s: any) => s.studentId === currentUser?.id);
  const myPendingAssignments = myAssignments.filter((a: any) => !mySubmissions.some((s: any) => s.assignmentId === a.id));

  const enrollment = academicData?.enrollment;
  const classesList = academicData?.classes || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Official DepEd Advisory Enrollment Banner */}
      {enrollment ? (
        <div id="student-advisory-banner" style={{
          background: "#fff",
          border: `1.5px solid ${C.borderMed}`,
          borderRadius: 8,
          padding: "16px 20px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: C.m50,
              border: `1px solid ${C.m700}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.m700,
              flexShrink: 0
            }}>
              <School size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 id="student-portal-section-name" style={{ fontSize: 16, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>
                  Grade {enrollment.gradeLevel}, Section {enrollment.sectionName}
                </h2>
                <Stamp label={enrollment.status || 'Enrolled'} color="#059669" bg="#ecfdf5" />
              </div>
              <div style={{ fontSize: 11, color: C.t2, marginTop: 4, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                <span id="student-portal-adviser-name" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <UserCheck size={12} color={C.m700} />
                  Class Adviser: <strong style={{ color: C.t1 }}>{enrollment.adviser?.name || 'Assigned Faculty'}</strong>
                </span>
                <span style={{ color: C.borderHeavy }}>&bull;</span>
                <span id="student-portal-academic-year" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Calendar size={12} color={C.t3} />
                  School Year: <strong style={{ color: C.t1 }}>{enrollment.academicYear}</strong>
                </span>
                <span style={{ color: C.borderHeavy }}>&bull;</span>
                <span id="student-portal-lrn" style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>
                  <Lock size={10} color={C.t3} />
                  LRN: {academicData?.student?.lrn || currentUser?.schoolId}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              id="btn-view-personal-records"
              onClick={() => setTab('profile')}
              style={{
                padding: "8px 16px",
                background: "#fff",
                border: `1.5px solid ${C.m700}`,
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                color: C.m700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.m700; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = C.m700; }}
            >
              <User size={13} /> View Personal Records
            </button>
            <button
              id="btn-view-academics"
              onClick={() => setTab('academics')}
              style={{
                padding: "8px 16px",
                background: C.m50,
                border: `1px solid ${C.m700}30`,
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                color: C.m700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.m700; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.m50; e.currentTarget.style.color = C.m700; }}
            >
              <FileSpreadsheet size={13} /> View Grades &amp; SF9
            </button>
          </div>
        </div>
      ) : !isLoadingAcademic ? (
        <div style={{
          background: "#fff7ed",
          border: "1.5px solid #fed7aa",
          borderRadius: 8,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12
        }}>
          <AlertTriangle size={20} color="#ea580c" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#9a3412" }}>No Active Section Enrollment Found</div>
            <div style={{ fontSize: 11, color: "#c2410c", marginTop: 2 }}>
              You are not currently enrolled in any advisory section for the active school year. Please contact your Class Adviser or the School Registrar.
            </div>
          </div>
        </div>
      ) : null}

      {/* KPI metrics strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Campus Gate Scans", val: myGateScans.length.toString(), sub: "Gate Activity Recorded", icon: CheckCircle, color: C.green, bg: "#f0fdf4" },
          { label: "Assignments Due", val: myPendingAssignments.length.toString(), sub: "Incomplete Assignments", icon: ClipboardList, color: C.red, bg: "#fef2f2" },
          {
            label: "Enrolled Classes",
            val: classesList.length > 0 ? `${classesList.length} Classes` : (enrollment ? "Advisory Active" : "Unenrolled"),
            sub: enrollment ? `Grade ${enrollment.gradeLevel}, Section ${enrollment.sectionName}` : "No section assigned",
            icon: Clock,
            color: classesList.length > 0 ? C.green : (enrollment ? C.m700 : C.t3),
            bg: classesList.length > 0 ? "#f0fdf4" : (enrollment ? C.m50 : "#eff6ff")
          }
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
                    {/* 1. Enrolled Classes & Schedule */}
                    <div id="student-classes-schedule-card" className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <BookOpen size={16} color={C.m700} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
                            Enrolled Classes &amp; Schedule
                          </span>
                        </div>
                        <button id="btn-view-calendar" onClick={() => setTab("calendar")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View Calendar</button>
                      </div>

                      {classesList.length > 0 ? (
                        <div id="student-enrolled-classes-list" style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                          {classesList.map((cls: any) => (
                            <div key={cls.id} style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              border: `1px solid ${C.borderMed}`,
                              borderLeft: `4px solid ${C.m700}`,
                              borderRadius: 6,
                              background: "#fff"
                            }}>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{cls.subjectName}</span>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: C.m700, background: C.m50, padding: "1px 6px", borderRadius: 4 }}>
                                    {cls.subjectCode}
                                  </span>
                                </div>
                                <div style={{ fontSize: 10, color: C.t2, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                  <User size={10} color={C.t3} /> Faculty: {cls.teacherName}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                {cls.schedule?.startTime && cls.schedule?.endTime ? (
                                  <div style={{ fontSize: 10, fontWeight: 700, color: C.m700 }}>
                                    {cls.schedule.startTime} - {cls.schedule.endTime}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 9.5, color: C.t3, fontStyle: "italic" }}>Schedule Pending</div>
                                )}
                                {cls.schedule?.room && (
                                  <div style={{ fontSize: 9, color: C.t3 }}>Room: {cls.schedule.room}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : enrollment ? (
                        <div id="student-advisory-empty-state" style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, justifyContent: "center", alignItems: "center", padding: "14px 8px", textAlign: "center" }}>
                          <div style={{ width: 38, height: 38, borderRadius: 19, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <School size={18} color={C.m700} />
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.t1 }}>
                            Enrolled in Grade {enrollment.gradeLevel}, Section {enrollment.sectionName}
                          </div>
                          <div style={{ fontSize: 11, color: C.t3, maxWidth: 320, lineHeight: 1.4 }}>
                            Class Adviser: <strong style={{ color: C.t2 }}>{enrollment.adviser?.name || 'Class Adviser'}</strong>. Subject-teacher offerings and class periods are currently being scheduled for {enrollment.academicYear}.
                          </div>
                          <div style={{ fontSize: 9.5, color: "#059669", fontWeight: 700, background: "#ecfdf5", padding: "3px 10px", borderRadius: 12, border: "1px solid #a7f3d0" }}>
                            ✓ Official Section Enrollment Active
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
                          <Clock size={32} color={C.t3} style={{ opacity: 0.4 }} />
                          <span style={{ fontSize: 11.5, color: C.t3, textAlign: "center", marginTop: 8 }}>
                            No active section enrollment found.
                          </span>
                        </div>
                      )}

                      <button id="btn-classes-view-calendar" onClick={() => setTab("calendar")} style={{ 
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
                        View Calendar &amp; Timetable
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
