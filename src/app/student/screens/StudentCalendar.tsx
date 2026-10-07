import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';

import { useAppContext } from '../../shared/AppContext';

export function StudentCalendar({ setTab }: any) {
  const { events } = useAppContext();
  const [calendarDate, setCalendarDate] = React.useState(new Date(2025, 5, 1));
  const formatTimeDisplay = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${minutes} ${ampm}`;
  };
  const CLASS_SCHEDULE: any = {
    "Monday": [
      { time: "08:00 AM - 09:30 AM", subject: "Mathematics", room: "Room 101" },
      { time: "09:45 AM - 11:15 AM", subject: "Science", room: "Lab A" }
    ],
    "Tuesday": [
      { time: "08:00 AM - 09:30 AM", subject: "English", room: "Room 102" },
      { time: "09:45 AM - 11:15 AM", subject: "History", room: "Room 103" }
    ]
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

              {/* Bottom Row: Weekly Timetable */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={18} color={C.m700} /> Weekly Class Timetable (Grade 10 - Pilot)
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.m700, background: C.m50, padding: "4px 12px", borderRadius: 12 }}>Adviser: Ms. Soriano</span>
                </div>
                <div style={{ padding: 20, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", minWidth: 800 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "0 12px 8px 12px", fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", width: 120 }}>Time</th>
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => (
                          <th key={day} style={{ textAlign: "left", padding: "0 12px 8px 12px", fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...Array(7)].map((_, pIdx) => {
                        const timeSlot = CLASS_SCHEDULE.Monday[pIdx]?.time || "";
                        return (
                          <tr key={pIdx}>
                            <td style={{ padding: "0 12px", fontSize: 11.5, fontWeight: 700, color: C.t2, whiteSpace: "nowrap" }}>{timeSlot}</td>
                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => {
                              const period = CLASS_SCHEDULE[day][pIdx];
                              if (!period) return <td key={day} style={{ padding: "0 6px" }} />;
  return (
                                <td key={day} style={{ padding: "0 6px" }}>
                                  <div style={{ 
                                    background: "#fff", 
                                    border: `1px solid ${C.borderMed}`, 
                                    borderLeft: `4px solid ${C.m700}`, 
                                    padding: "10px 12px", 
                                    borderRadius: 6, 
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                                    transition: "transform 0.15s, box-shadow 0.15s",
                                    cursor: "default"
                                  }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = C.borderHeavy; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.02)"; e.currentTarget.style.borderColor = C.borderMed; }}
                                  >
                                    <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{period.subject}</div>
                                    <div style={{ fontSize: 10, color: C.t2, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><School size={10} color={C.t3} /> {period.room}</div>
                                    <div style={{ fontSize: 9, color: C.t3, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><User size={10} color={C.t3} /> {period.teacher}</div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
  );
}
