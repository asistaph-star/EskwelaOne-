import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';

import { apiClient } from '../../../api/client';
import { useEffect } from 'react';
export type CalendarEvent = { id: string; title: string; date: string; time?: string; endTime?: string; audience: "all" | "students" | "parents" | "teachers"; };


export function StudentCalendar({ setTab }: any) {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [academicData, setAcademicData] = useState<any>(null);

  useEffect(() => {
    apiClient.get<CalendarEvent[]>('/admin/events').then(setEvents).catch(console.error);
    import('../../../api/student.api').then(({ studentApi }) => {
      studentApi.getMyClasses()
        .then((res: any) => setAcademicData(res?.data || res))
        .catch(console.error);
    });
  }, []);
  const [calendarDate, setCalendarDate] = React.useState(new Date(2025, 5, 1));
  const formatTimeDisplay = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${minutes} ${ampm}`;
  };

  const calYear = calendarDate.getFullYear();
            const calMonth = calendarDate.getMonth();
            const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
            let firstDay = new Date(calYear, calMonth, 1).getDay();
            firstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon=0
            
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            
            return (
            <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1600, width: "100%", margin: "0 auto" }}>
              
              {/* Top Row: Monthly Calendar & Events */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6">
                {/* Left: Monthly Calendar Preview */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                  <div style={{ background: C.m900, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <button onClick={() => setCalendarDate(new Date(calYear, calMonth - 1, 1))} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}><ChevronLeft size={14} color="#fff" /></button>
                    <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>{monthNames[calMonth]} {calYear}</span>
                    <button onClick={() => setCalendarDate(new Date(calYear, calMonth + 1, 1))} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}><ChevronRight size={14} color="#fff" /></button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${C.borderMed}`, textAlign: "center", background: "#f8fafc" }}>
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, i) => (
                      <div key={i} style={{ padding: "10px 4px", fontSize: 10, fontWeight: 700, color: C.t3, letterSpacing: "0.05em" }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#fff" }}>
                    {[...Array(42)].map((_, idx) => {
                      const day = idx - firstDay + 1;
                      const valid = day >= 1 && day <= daysInMonth;
                      const dayStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const dayEvents = events.filter((e: any) => e.date === dayStr && (e.audience === "all" || e.audience === "students"));
                      const isToday = valid && day === new Date().getDate() && calMonth === new Date().getMonth() && calYear === new Date().getFullYear();

                      return (
                        <div key={idx} style={{ 
                          minHeight: 80, 
                          padding: 8, 
                          borderRight: `1px solid ${C.border}`, 
                          borderBottom: `1px solid ${C.border}`,
                          background: isToday ? C.m50 : "#fff",
                          boxSizing: "border-box"
                        }}>
                          {valid && (
                            <>
                              <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? C.m700 : idx % 7 >= 5 ? C.t3 : C.t1, marginBottom: 4 }}>{day}</div>
                              {dayEvents.map(ev => {
                                const timeStr = formatTimeDisplay(ev.time);
                                const endStr = formatTimeDisplay(ev.endTime);
                                const fullTime = timeStr ? (endStr ? `${timeStr} - ${endStr}` : timeStr) : "All day";
                                return (
                                  <div key={ev.id} title={ev.title} 
                                    style={{ 
                                      fontSize: 9, 
                                      fontWeight: 700, 
                                      color: C.m700, 
                                      background: C.m50, 
                                      borderRadius: 4, 
                                      padding: "4px 6px", 
                                      marginTop: 4, 
                                      lineHeight: 1.3,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      display: "flex",
                                      flexDirection: "column",
                                      cursor: "default",
                                      border: `1px solid ${C.m700}30`,
                                      transition: "all 0.2s"
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <Lock size={8} /> {ev.title}
                                    </div>
                                    {fullTime && <div style={{ fontSize: 8, color: C.m700, marginTop: 2, opacity: 0.9 }}>{fullTime}</div>}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: School Events list */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                    <CalendarCheck size={18} color={C.m700} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Upcoming Events</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
                    {events.filter(e => e.audience === "all" || e.audience === "students").map(ev => (
                      <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${C.border}`, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: 4, height: 32, background: C.m700, borderRadius: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                           <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                           <div style={{ fontSize: 10, color: C.t3, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><Calendar size={10} /> {ev.date}</div>
                        </div>
                        <Lock size={12} color={C.t3} style={{ flexShrink: 0, opacity: 0.5 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Row: Weekly Timetable & Classes */}
              <div id="student-calendar-timetable" style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={18} color={C.m700} />
                    Weekly Class Timetable {academicData?.enrollment ? `(Grade ${academicData.enrollment.gradeLevel}, Section ${academicData.enrollment.sectionName})` : ''}
                  </div>
                  {academicData?.enrollment?.adviser?.name && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.m700, background: C.m50, padding: "4px 12px", borderRadius: 12, border: `1px solid ${C.m700}20` }}>
                      Class Adviser: {academicData.enrollment.adviser.name}
                    </span>
                  )}
                </div>

                {academicData?.classes && academicData.classes.length > 0 ? (
                  <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                    {academicData.classes.map((cls: any) => (
                      <div key={cls.id} style={{
                        background: "#fff",
                        border: `1px solid ${C.borderMed}`,
                        borderLeft: `4px solid ${C.m700}`,
                        padding: "12px 14px",
                        borderRadius: 6,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{cls.subjectName}</div>
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: C.m700, background: C.m50, padding: "2px 6px", borderRadius: 4 }}>
                            {cls.subjectCode}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: C.t2, marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                          <User size={12} color={C.t3} /> Faculty: {cls.teacherName}
                        </div>
                        <div style={{ fontSize: 10.5, color: C.t3, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                          <School size={12} color={C.t3} /> Room: {cls.schedule?.room || 'Assigned Room'}
                        </div>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: cls.schedule?.startTime ? C.m700 : C.t3, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                          <Clock size={12} color={cls.schedule?.startTime ? C.m700 : C.t3} />
                          {cls.schedule?.startTime && cls.schedule?.endTime
                            ? `${cls.schedule.days ? `${cls.schedule.days}, ` : ''}${cls.schedule.startTime} - ${cls.schedule.endTime}`
                            : 'Schedule to be announced by faculty'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : academicData?.enrollment ? (
                  <div style={{ padding: "32px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <School size={28} color={C.m700} style={{ opacity: 0.7 }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>
                      Enrolled in Grade {academicData.enrollment.gradeLevel}, Section {academicData.enrollment.sectionName}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.t3, maxWidth: 440, lineHeight: 1.5 }}>
                      Class Adviser: <strong>{academicData.enrollment.adviser?.name || 'Class Adviser'}</strong>. Detailed subject class schedules for this section are being finalized by school faculty for {academicData.enrollment.academicYear}.
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 30, textAlign: "center", color: C.t3, fontSize: 12 }}>
                    No active class schedule available.
                  </div>
                )}
              </div>
            </div>
            
  );
}
