import React, { useState } from 'react';
import { C } from '../shared/constants/tokens';
import { StudentReportCard } from './components/StudentReportCard';
import {
  LogOut, BookOpen, Calendar, Award, BookMarked, Printer, Download,
  LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Pin
} from 'lucide-react';
import { Stamp } from '../shared/components/Stamp';
import { StatBox } from '../shared/components/StatBox';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { SCHOOL_EVENTS, CLASS_SCHEDULE, SUBJECT_COLORS } from '../shared/data/calendarData';

export function StudentPortal({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<
    "dashboard" | "academics" | "attendance" | "assignments" | "resources" | "behavior" | "clinic" | "requests" | "settings" | "calendar"
  >("dashboard");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Document Requests States
  const [docType, setDocType] = useState("Official Report Card Copy (SF9)");
  const [purpose, setPurpose] = useState("Scholarship Application");
  const [requests, setRequests] = useState([
    { id: "REQ-002", type: "Official Report Card Copy (SF9)", date: "June 5, 2025", purpose: "Scholarship", status: "Ready" },
    { id: "REQ-001", type: "Form 137 (SF10)", date: "May 12, 2025", purpose: "Further Studies / Transfer", status: "Released" }
  ]);

  // Unified To-Do Checklist States
  const [todos, setTodos] = useState([
    { id: 1, s: "English", label: "Write a 500-word narrative essay on local folklore", due: "June 12, 2025", type: "Homework", completed: false },
    { id: 2, s: "Mathematics", label: "Algebra Set 3: Quadratic functions problems 1-10", due: "June 14, 2025", type: "Homework", completed: true },
    { id: 3, s: "Science", label: "Group Capstone Project proposal - climate change impact", due: "June 20, 2025", type: "Project", completed: false },
    { id: 4, s: "Araling Panlipunan", label: "Concept map of Philippine colonial trade lines", due: "June 11, 2025", type: "Homework", completed: false },
  ]);

  // Excuse Letter States
  const [excuseText, setExcuseText] = useState("");
  const [excuseFile, setExcuseFile] = useState<string|null>(null);
  const [excuseLog, setExcuseLog] = useState([
    { date: "June 7, 2025", reason: "High Fever / Flu", file: "medical_certificate.pdf", status: "Approved" }
  ]);

  // Settings States
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);

  // Core Data
  const SUBS = [
    { name: "Filipino", q1: 85, q2: 88, q3: 86 },
    { name: "English", q1: 88, q2: 90, q3: 87 },
    { name: "Mathematics", q1: 74, q2: 78, q3: 71 },
    { name: "Science", q1: 91, q2: 93, q3: 90 },
    { name: "Araling Panlipunan", q1: 90, q2: 92, q3: 91 },
    { name: "TLE", q1: 88, q2: 90, q3: 87 },
    { name: "MAPEH", q1: 92, q2: 94, q3: 93 },
    { name: "EsP (Edukasyon sa Pagpapakatao)", q1: 95, q2: 96, q3: 94 },
  ];
  const genAvg = Math.round(SUBS.reduce((s, sg) => s + (sg.q1 + sg.q2 + sg.q3) / 3, 0) / SUBS.length);

  // Grade Trend Data for Line Chart
  const gradeTrendData = [
    { name: "Grade 7", avg: 86.4 },
    { name: "Grade 8", avg: 87.8 },
    { name: "Grade 9", avg: 88.2 },
    { name: "Grade 10", avg: 87.0 }
  ];

  // Document Request Action
  function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newReq = {
      id: `REQ-${Math.floor(Math.random() * 900 + 100)}`,
      type: docType,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      purpose: purpose,
      status: "Pending Review"
    };
    setRequests([newReq, ...requests]);
    alert("Document request submitted successfully!");
  }

  // Excuse Letter Submit
  function handleExcuseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!excuseText) {
      alert("Please provide a reason.");
      return;
    }
    const newLog = {
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      reason: excuseText,
      file: excuseFile || "written_excuse.pdf",
      status: "Pending Review"
    };
    setExcuseLog([newLog, ...excuseLog]);
    setExcuseText("");
    setExcuseFile(null);
    alert("Excuse letter submitted to adviser!");
  }

  // Toggle To-Do Item
  function toggleTodo(id: number) {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  }

  return (
    <div style={{ minHeight: "100vh", background: C.paper, fontFamily: "'Inter',sans-serif", display: "flex" }}>
      {/* ── Left Sidebar Navigation ── */}
      <div style={{ width: 240, background: C.m900, borderRight: `1px solid ${C.borderHeavy}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        
        {/* Brand Header */}
        <div style={{ padding: "22px 24px", borderBottom: `1px solid ${C.borderHeavy}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.m600} 0%, ${C.m800} 100%)`,
            border: "1.5px solid rgba(200, 134, 10, 0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
          }}>
            <BookMarked size={18} color={C.gold} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "0.06em", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              ESKWELAONE
            </div>
            <div style={{ fontSize: 8, color: C.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.13em", marginTop: 2 }}>
              STUDENT PORTAL
            </div>
          </div>
        </div>

        {/* Flat Navigation list matching the mockup */}
        <div style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "profile", label: "My Profile", icon: User },
            { id: "calendar", label: "My Schedule", icon: Calendar },
            { id: "academics", label: "Grades", icon: BookOpen },
            { id: "attendance", label: "Attendance", icon: Calendar },
            { id: "assignments", label: "Assignments", icon: ClipboardList },
            { id: "resources", label: "Subjects", icon: FileText },
            { id: "announcements", label: "Announcements", icon: Bell },
            { id: "messages", label: "Messages", icon: MessageSquare },
            { id: "requests", label: "Documents", icon: FolderOpen },
            { id: "calendar_alt", label: "Calendar", icon: Calendar },
            { id: "behavior", label: "Achievement", icon: Award },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            
            // Map tab highlight correctly
            const isDashboard = item.id === "dashboard" && tab === "dashboard";
            const isProfile = item.id === "profile" && tab === "settings";
            const isSchedule = item.id === "calendar" && tab === "calendar";
            const isGrades = item.id === "academics" && tab === "academics";
            const isAttendance = item.id === "attendance" && tab === "attendance";
            const isAssignments = item.id === "assignments" && tab === "assignments";
            const isSubjects = item.id === "resources" && tab === "resources";
            const isAnnouncements = item.id === "announcements" && tab === "dashboard";
            const isMessages = item.id === "messages" && tab === "dashboard";
            const isDocuments = item.id === "requests" && tab === "requests";
            const isCalendarAlt = item.id === "calendar_alt" && tab === "calendar";
            const isAchievement = item.id === "behavior" && tab === "behavior";
            const isSettings = item.id === "settings" && tab === "settings";

            const act = isDashboard || isProfile || isSchedule || isGrades || isAttendance || isAssignments || isSubjects || isAnnouncements || isMessages || isDocuments || isCalendarAlt || isAchievement || isSettings;

            const clickHandler = () => {
              if (item.id === "dashboard") setTab("dashboard");
              else if (item.id === "profile") setTab("settings");
              else if (item.id === "calendar" || item.id === "calendar_alt") setTab("calendar");
              else if (item.id === "academics") setTab("academics");
              else if (item.id === "attendance") setTab("attendance");
              else if (item.id === "assignments") setTab("assignments");
              else if (item.id === "resources") setTab("resources");
              else if (item.id === "announcements") { setTab("dashboard"); alert("Announcements list resides at the bottom of the overview dashboard."); }
              else if (item.id === "messages") { alert("Direct messages are integrated in your notification alerts tray."); }
              else if (item.id === "requests") setTab("requests");
              else if (item.id === "behavior") setTab("behavior");
              else if (item.id === "settings") setTab("settings");
            };

            return (
              <button
                key={item.id}
                onClick={clickHandler}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 4,
                  background: act ? C.m800 : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: act ? "#fff" : "rgba(255,255,255,0.65)",
                  fontSize: 12,
                  fontWeight: act ? 700 : 400,
                  textAlign: "left",
                  transition: "all 0.12s",
                  boxSizing: "border-box"
                }}
                onMouseEnter={e => { if(!act) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if(!act) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={16} color={act ? C.gold : "rgba(255,255,255,0.65)"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer matching the mockup */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.borderHeavy}` }}>
          <button 
            onClick={onLogout}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 10, 
              background: "transparent", 
              border: "none", 
              color: "rgba(255,255,255,0.65)", 
              fontSize: 12, 
              fontWeight: 500, 
              cursor: "pointer",
              padding: 0,
              width: "100%"
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.gold}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.65)"}
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>

      </div>

      {/* ── Main Content View Window ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* Top Header Band */}
        <div style={{
          background: "#fff",
          borderBottom: `1.5px solid ${C.borderMed}`,
          padding: "0 28px",
          height: 54,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0
        }}>
          {/* Hamburger + search bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
            <Menu size={16} color={C.t3} style={{ cursor: "pointer" }} />
            <div style={{ display: "flex", alignItems: "center", position: "relative", width: 340 }}>
              <Search size={13} color={C.t3} style={{ position: "absolute", left: 10 }} />
              <input 
                type="text" 
                placeholder="Search for subjects, assignments, announcements..." 
                style={{
                  width: "100%",
                  padding: "7px 12px 7px 30px",
                  fontSize: 11.5,
                  color: C.t1,
                  background: C.m50,
                  border: "1.5px solid " + C.borderMed,
                  borderRadius: 20,
                  outline: "none",
                  transition: "all 0.15s"
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = C.m700;
                  e.currentTarget.style.background = "#fff";
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = C.borderMed;
                  e.currentTarget.style.background = C.m50;
                }}
              />
              <span style={{ position: "absolute", right: 10, fontSize: 9.5, color: C.t3, background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "2px 5px", fontWeight: 600 }}>Ctrl + K</span>
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Theme Sun button */}
            <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, border: `2px solid ${C.t2}` }} />
            </button>

            {/* Notification Bell */}
            <div style={{ position: "relative" }}>
              <button 
                onClick={() => setNotifOpen(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  position: "relative"
                }}
              >
                <Bell size={18} color={C.t2} />
                <div style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  background: C.red,
                  color: "#fff",
                  fontSize: 8,
                  fontWeight: 700,
                  borderRadius: 10,
                  width: 14,
                  height: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1.5px solid #fff"
                }}>3</div>
              </button>
            </div>

            {/* User Profile display */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: `1px solid ${C.borderMed}`, paddingLeft: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, overflow: "hidden", background: C.m100 }}>
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face" alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>Juan Miguel Santos</div>
                <div style={{ fontSize: 9, color: C.t3, marginTop: 1 }}>Grade 10 - Pilot Section</div>
              </div>
              <ChevronDown size={12} color={C.t3} />
            </div>

          </div>
        </div>

        {/* Inner Content Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

          {/* 1. MOCKUP STUDENT DASHBOARD */}
          {tab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* Top Row: Welcome greeting & Digital ID floating card */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, color: C.t3, fontWeight: 500 }}>Good Morning,</div>
                  <h1 style={{ fontSize: 32, fontWeight: 800, color: C.m900, fontFamily: "'Fraunces', serif", margin: "4px 0 6px 0", display: "flex", alignItems: "center", gap: 8 }}>
                    Juan Miguel! <span style={{ fontSize: 24 }}>👋</span>
                  </h1>
                  <div style={{ fontSize: 12, color: C.t3 }}>Here's what's happening today.</div>
                </div>

                {/* Floating ID Card block */}
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 16, 
                  background: "#fff", 
                  border: `1.5px solid ${C.borderMed}`, 
                  borderRadius: 12, 
                  padding: "12px 18px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", background: C.m50, flexShrink: 0 }}>
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face" alt="Student Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "2px 8px", fontSize: 11, marginBottom: 6 }}>
                      <span style={{ color: C.t3, fontWeight: 600 }}>Student ID</span>
                      <span style={{ color: C.t1, fontWeight: 700 }}>2022-10045</span>
                      <span style={{ color: C.t3, fontWeight: 600 }}>LRN</span>
                      <span style={{ color: C.t1, fontWeight: 700 }}>100001</span>
                    </div>
                    <button onClick={() => alert("Digital QR Code active and validated.")} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${C.borderMed}`, padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: C.m700, cursor: "pointer", transition: "all 0.15s" }}>
                      <QrCode size={11} /> My QR Code
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI metrics strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                {[
                  { label: "Attendance Rate", val: "95.4%", sub: "▲ 2% from last month", icon: CheckCircle, color: C.green, bg: "#f0fdf4" },
                  { label: "Current GPA", val: "88.0", sub: "Above Passing", icon: Award, color: C.gold, bg: "#fefbeb" },
                  { label: "Assignments Due", val: "2", sub: "Due Today", icon: ClipboardList, color: C.red, bg: "#fef2f2" },
                  { label: "Today's Classes", val: "4 Classes", sub: "Next: Math (9:00 AM)", icon: Clock, color: C.blue, bg: "#eff6ff" },
                  { label: "Achievements", val: "5 Badges", sub: "View all achievements", icon: Award, color: "#8b5cf6", bg: "#f5f3ff" },
                  { label: "Needs Attention", val: "2 Items", sub: "View details >", icon: AlertTriangle, color: "#f97316", bg: "#fff7ed" }
                ].map((kpi, idx) => {
                  const Icon = kpi.icon;
                  return (
                    <div key={idx} style={{ 
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

               {/* 3-Column main content grid */}
              <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
                {/* Left Side: Schedule, Assignments, and Announcements */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    {/* Column 1: Today's Schedule */}
                    <div style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Today's Schedule</span>
                        <button onClick={() => setTab("calendar")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View Full Schedule</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, position: "relative" }}>
                        <div style={{ position: "absolute", left: 54, top: 8, bottom: 8, width: 2, background: C.borderMed }} />
                        {[
                          { time: "8:00 AM", title: "Physical Education and Health", room: "Gymnasium", status: "Completed", color: C.green, bg: "#f0fdf4" },
                          { time: "9:00 AM", title: "Mathematics", room: "Room 204", status: "In Progress", color: "#f97316", bg: "#fff7ed" },
                          { time: "10:30 AM", title: "English", room: "Room 105", status: "Upcoming", color: C.t3, bg: C.paper },
                          { time: "1:00 PM", title: "Science", room: "Laboratory 1", status: "Upcoming", color: C.t3, bg: C.paper },
                          { time: "2:30 PM", title: "Filipino", room: "Room 201", status: "Upcoming", color: C.t3, bg: C.paper }
                        ].map((slot, idx) => (
                          <div key={idx} style={{ 
                            display: "flex", 
                            gap: 16, 
                            alignItems: "center", 
                            position: "relative", 
                            zIndex: 1,
                            paddingLeft: slot.status === "In Progress" ? 4 : 8,
                            borderLeft: slot.status === "In Progress" ? `3px solid ${C.m700}` : "none"
                          }}>
                            <span style={{ width: 46, fontSize: 10, fontWeight: 700, color: C.t3 }}>{slot.time}</span>
                            <div style={{ width: 8, height: 8, borderRadius: 4, background: slot.status === "In Progress" ? C.m700 : "#d1d5db", border: "2px solid #fff", flexShrink: 0 }} />
                            <div style={{ 
                              flex: 1, 
                              padding: "8px 0",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              borderBottom: idx < 4 ? `1px dashed ${C.borderMed}` : "none"
                            }}>
                              <div>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{slot.title}</div>
                                <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>{slot.room}</div>
                              </div>
                              <span style={{ 
                                fontSize: 9, 
                                fontWeight: 700, 
                                color: slot.color, 
                                background: slot.bg, 
                                padding: "2px 6px", 
                                borderRadius: 4 
                              }}>{slot.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                        <button onClick={() => setTab("calendar")} style={{ padding: "6px 20px", background: "transparent", border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: C.m700, cursor: "pointer", transition: "all 0.15s" }}>View Full Schedule</button>
                      </div>
                    </div>

                    {/* Column 2: Upcoming Assignments */}
                    <div style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Upcoming Assignments</span>
                        <button onClick={() => setTab("assignments")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View All</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                        {[
                          { title: "Science Lab Report", desc: "Science · Ms. Ana R. Soriano", due: "Due Today", time: "11:59 PM", color: C.red },
                          { title: "Math Problem Set #8", desc: "Mathematics · Mr. Carlo D. Reyes", due: "Due Tomorrow", time: "11:59 PM", color: "#f97316" },
                          { title: "English Essay", desc: "English · Ms. Liza M. Bautista", due: "Due Jun 14", time: "11:59 PM", color: C.t3 },
                          { title: "Filipino Reflection Paper", desc: "Filipino · Mr. Jose P. Dela Cruz", due: "Due Jun 16", time: "11:59 PM", color: C.t3 }
                        ].map((ass, idx) => (
                          <div key={idx} style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: 12, 
                            padding: "8px 0",
                            borderBottom: idx < 3 ? `1px dashed ${C.borderMed}` : "none"
                          }}>
                            <div style={{ width: 30, height: 30, borderRadius: 4, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <ClipboardList size={14} color={C.m700} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ass.title}</div>
                              <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>{ass.desc}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: ass.color }}>{ass.due}</div>
                              <div style={{ fontSize: 8.5, color: C.t3, marginTop: 1 }}>{ass.time}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                        <button onClick={() => setTab("assignments")} style={{ padding: "6px 20px", background: "transparent", border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: C.m700, cursor: "pointer", transition: "all 0.15s" }}>View All Assignments</button>
                      </div>
                    </div>
                  </div>

                  {/* Announcements Section */}
                  <div style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Announcements</span>
                      <button onClick={() => alert("All announcements can be viewed in detail.")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View All</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { title: "Quarter 4 Progress Check", desc: "Please be informed that the Q4 Progress Check will be on June 14, 2025.", date: "June 8, 2025 · Principal's Office" },
                        { title: "Library Orientation", desc: "All students are required to attend the library orientation this June 12.", date: "June 7, 2025 · Library Department" }
                      ].map((ann, idx) => (
                        <div key={idx} style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 12, 
                          padding: "10px 0", 
                          borderBottom: idx === 0 ? `1px dashed ${C.borderMed}` : "none",
                          position: "relative" 
                        }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Pin size={13} color="#b91c1c" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{ann.title}</div>
                            <p style={{ fontSize: 10.5, color: C.t2, margin: "4px 0", lineHeight: 1.4 }}>{ann.desc}</p>
                            <span style={{ fontSize: 9, color: C.t3 }}>{ann.date}</span>
                          </div>
                          <ChevronRight size={14} color={C.t3} style={{ cursor: "pointer" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Stacked Widgets (Grades Summary & Academic Calendar) */}
                <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Grades Summary */}
                  <div style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Grades Summary (Q1 - Q3)</span>
                      <button onClick={() => setTab("academics")} style={{ background: "none", border: "none", color: C.m700, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>View Grades</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                        <div style={{ width: 80, height: 40, overflow: "hidden", position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                          <div style={{ width: 70, height: 70, borderRadius: 35, border: "6px solid #f3f4f6", borderTopColor: C.m700, borderRightColor: C.m700, transform: "rotate(45deg)", position: "absolute", bottom: -35 }} />
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, marginTop: 4 }}>88.0</div>
                        <div style={{ fontSize: 8, fontWeight: 700, color: C.green }}>Above Passing</div>
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {[
                          { s: "Mathematics", g: 90 },
                          { s: "English", g: 85 },
                          { s: "Science", g: 88 },
                          { s: "Filipino", g: 87 },
                          { s: "Araling Panlipunan", g: 89 },
                          { s: "PE & Health", g: 92 },
                          { s: "TLE", g: 86 }
                        ].map((sub, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5 }}>
                            <span style={{ color: C.t2 }}>{sub.s}</span>
                            <span style={{ fontWeight: 700, color: C.t1 }}>{sub.g}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Academic Calendar Widget */}
                  <div style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Academic Calendar</span>
                      <button onClick={() => setTab("calendar")} style={{ background: "none", border: "none", color: C.m700, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>View Calendar</button>
                    </div>
                    <div style={{ borderBottom: `0.5px solid ${C.border}`, paddingBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>June 10, 2025</span>
                      <span style={{ fontSize: 9.5, color: C.t3, marginLeft: 6 }}>Tuesday</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { m: "JUN", d: "14", title: "Quarter 4 - Progress Check", time: "8:00 AM - 12:00 PM" },
                        { m: "JUN", d: "20", title: "School Foundation Day", time: "No Classes" }
                      ].map((ev, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <div style={{ width: 36, height: 36, background: C.m50, border: `1px solid ${C.borderMed}`, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 7, fontWeight: 800, color: C.m700 }}>{ev.m}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: C.m700, lineHeight: 1 }}>{ev.d}</span>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{ev.title}</div>
                            <div style={{ fontSize: 9, color: C.t3, marginTop: 2 }}>{ev.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                      <button onClick={() => setTab("calendar")} style={{ padding: "6px 20px", background: "transparent", border: `1.5px solid ${C.borderMed}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: C.m700, cursor: "pointer", transition: "all 0.15s" }}>View Full Calendar</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. ACADEMIC RECORDS */}
          {tab === "academics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Scholastic History & Grades</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Official report card records under Form 138 specification.</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => alert("Report printed successfully.")} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: C.t2, background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 3, padding: "6px 12px", cursor: "pointer" }}><Printer size={12}/>Print Card (SF9)</button>
                  <button onClick={() => alert("PDF downloaded successfully.")} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#fff", background: C.m700, border: "none", borderRadius: 3, padding: "6px 14px", cursor: "pointer" }}><Download size={12}/>Download PDF</button>
                </div>
              </div>

              {/* Standard DepEd Report Card widget */}
              <StudentReportCard student={{ surname: "Santos", first: "Juan Miguel", lrn: "100001", grade: 10, section: "Pilot", adviser: "Ana R. Soriano", gender: "male" }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Visual Grade Trend line chart per year level */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 12 }}>Grade Averages Trend</div>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={gradeTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" stroke={C.t3} fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis domain={[80, 92]} stroke={C.t3} fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} />
                        <Line type="monotone" dataKey="avg" stroke={C.m700} strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 4, stroke: C.m700, strokeWidth: 2, fill: "#fff" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Standing & Class rank metrics */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Academic Standing Details</div>
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>Class Ranking</div>
                        <div style={{ fontSize: 10, color: C.t3 }}>Out of 38 enrolled students in Section Pilot</div>
                      </div>
                      <Stamp label="Rank 4" color={C.gold} bg={C.goldLight} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>Academic Track Recommendation</div>
                        <div style={{ fontSize: 10, color: C.t3 }}>Suggested path for senior high enrolment</div>
                      </div>
                      <Stamp label="STEM Track" color={C.blue} bg={C.blueBg} />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 3. ATTENDANCE */}
          {tab === "attendance" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
              
              {/* Left Column: Logs & Excuse Letter Form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Gate Attendance Logs</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
                        {["Date", "Time In", "Time Out", "Status"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 14px", fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { date: "June 10, 2025", in: "7:18 AM", out: "4:30 PM", stat: "Present", color: C.green, bg: C.greenBg },
                        { date: "June 9, 2025", in: "7:22 AM", out: "4:32 PM", stat: "Present", color: C.green, bg: C.greenBg },
                        { date: "June 8, 2025", in: "7:41 AM", out: "4:30 PM", stat: "Late Arrival", color: C.amber, bg: C.amberBg },
                        { date: "June 7, 2025", in: "--:--", out: "--:--", stat: "Absent", color: C.red, bg: C.redBg },
                        { date: "June 6, 2025", in: "7:15 AM", out: "4:31 PM", stat: "Present", color: C.green, bg: C.greenBg },
                      ].map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < 4 ? `0.5px solid ${C.border}` : "none" }}>
                          <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: C.t1 }}>{row.date}</td>
                          <td style={{ padding: "10px 14px", fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", color: C.t2 }}>{row.in}</td>
                          <td style={{ padding: "10px 14px", fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", color: C.t2 }}>{row.out}</td>
                          <td style={{ padding: "10px 14px" }}><Stamp label={row.stat} color={row.color} bg={row.bg} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Excuse Letter Submission form */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "16px 20px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 12 }}>Submit Absence Excuse Letter</div>
                  <form onSubmit={handleExcuseSubmit}>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 11, color: C.t2, marginBottom: 5 }}>Absence Reason / Explanation</label>
                      <textarea
                        value={excuseText}
                        onChange={e => setExcuseText(e.target.value)}
                        placeholder="Please write why you missed class (e.g. sick, emergency consultation)..."
                        style={{ width: "100%", height: 60, padding: 8, fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 4, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                      <div 
                        onClick={() => {
                          setExcuseFile("parent_signature_note.pdf");
                          alert("Excuse file selected!");
                        }}
                        style={{ border: `1.5px dashed ${C.borderMed}`, padding: "8px 16px", borderRadius: 4, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, color: C.t2, background: C.paper }}
                      >
                        <Upload size={13} /> {excuseFile ? excuseFile : "Attach Doctor Note / PDF"}
                      </div>
                      {excuseFile && <span style={{ fontSize: 10, color: C.green }}>✓ Attached</span>}
                    </div>
                    <button type="submit" style={{ background: C.m700, color: "#fff", border: "none", padding: "7px 16px", borderRadius: 3, cursor: "pointer", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                      <Send size={11} /> Submit Excuse Letter
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Attendance Calendar & submission logs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 12 }}>Attendance Calendar (June 2025)</div>
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
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Excuse Letter Log</div>
                  {excuseLog.map((log, i) => (
                    <div key={i} style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.t1 }}>{log.reason}</div>
                        <div style={{ fontSize: 10, color: C.t3, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><Paperclip size={10}/> {log.file} &middot; {log.date}</div>
                      </div>
                      <Stamp label={log.status} color={log.status === "Approved" ? C.green : C.amber} bg={log.status === "Approved" ? C.greenBg : C.amberBg} />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* 4. ASSIGNMENTS & TO-DOS */}
          {tab === "assignments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Unified To-Do Task Tracker</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Checked items represent completed assignments.</div>
              </div>

              {/* To-Do Checklist tracker */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>My Assignments Checklist</div>
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {todos.map((todo) => (
                    <div 
                      key={todo.id} 
                      onClick={() => toggleTodo(todo.id)}
                      style={{ 
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", 
                        border: `1px solid ${C.borderMed}`, borderRadius: 4, cursor: "pointer", 
                        background: todo.completed ? C.greenBg + "20" : "#fff",
                        transition: "all 0.12s"
                      }}
                    >
                      {todo.completed ? <CheckSquare size={16} color={C.green} /> : <Square size={16} color={C.t3} />}
                      <div style={{ flex: 1 }}>
                        <span style={{ 
                          fontSize: 12, fontWeight: 600, color: todo.completed ? C.t3 : C.t1,
                          textDecoration: todo.completed ? "line-through" : "none"
                        }}>
                          {todo.label}
                        </span>
                        <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{todo.s} &middot; Due: <strong style={{ color: todo.completed ? C.t3 : C.red }}>{todo.due}</strong></div>
                      </div>
                      <Stamp label={todo.type} color={C.blue} bg={C.blueBg} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming Exams */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Upcoming Exams Schedule</div>
                <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { title: "First Quarterly Assessment", dates: "June 25 - June 26, 2025", desc: "Covers all modules in Q1" },
                    { title: "Mathematics Unit 1 Exam", dates: "June 15, 2025", desc: "Focus: Quadratic equations & functions" }
                  ].map((ex, i) => (
                    <div key={i} style={{ border: `1px solid ${C.borderMed}`, padding: 12, borderRadius: 4, background: C.paper }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{ex.title}</div>
                      <div style={{ fontSize: 10.5, color: C.m700, fontWeight: 600, marginTop: 4 }}>{ex.dates}</div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>{ex.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 5. DOCUMENT REQUESTS */}
          {tab === "requests" && (
            <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
              {/* Form panel */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "16px 20px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 14 }}>Submit New Document Request</div>
                <form onSubmit={handleRequestSubmit}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 11, color: C.t2, marginBottom: 5 }}>Select Document Type</label>
                    <select value={docType} onChange={e=>setDocType(e.target.value)} style={{ width: "100%", padding: 8, fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 4, background: C.m50 }}>
                      <option value="Official Report Card Copy (SF9)">Official Report Card Copy (SF9)</option>
                      <option value="Good Moral Character Certificate">Good Moral Character Certificate</option>
                      <option value="Learner Permanent Record (SF10 / Form 137)">Learner Permanent Record (SF10 / Form 137)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 11, color: C.t2, marginBottom: 5 }}>Purpose of Request</label>
                    <select value={purpose} onChange={e=>setPurpose(e.target.value)} style={{ width: "100%", padding: 8, fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 4, background: C.m50 }}>
                      <option value="Scholarship Application">Scholarship Application</option>
                      <option value="Further Studies / Transfer">Further Studies / Transfer</option>
                      <option value="Employment Requirement">Employment Requirement</option>
                      <option value="General Reference ID">General Reference ID</option>
                    </select>
                  </div>
                  <button type="submit" style={{ width: "100%", background: C.m700, color: "#fff", border: "none", padding: "9px 16px", borderRadius: 3, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                    Submit Request
                  </button>
                </form>
              </div>

              {/* Status Tracker list */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Document Request Status Tracker</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
                      {["Request ID", "Document Type", "Date", "Purpose", "Status", "Actions"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 14px", fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id} style={{ borderBottom: `0.5px solid ${C.border}` }}>
                        <td style={{ padding: "10px 14px", fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: C.t1 }}>{r.id}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: C.t1 }}>{r.type}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: C.t3 }}>{r.date}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: C.t2 }}>{r.purpose}</td>
                        <td style={{ padding: "10px 14px" }}><Stamp label={r.status} color={r.status === "Ready" ? C.green : r.status === "Released" ? C.blue : C.amber} bg={r.status === "Ready" ? C.greenBg : r.status === "Released" ? C.blueBg : C.amberBg} /></td>
                        <td style={{ padding: "10px 14px" }}>
                          {r.status === "Ready" && (
                            <button onClick={() => alert("Downloading document...")} style={{ background: C.m100, border: `1px solid rgba(139,30,30,0.15)`, padding: "4px 8px", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, color: C.m700, display: "flex", alignItems: "center", gap: 3 }}><Download size={10}/> Download</button>
                          )}
                          {r.status === "Pending Review" && (
                            <button onClick={() => setRequests(requests.filter(x=>x.id!==r.id))} style={{ background: "#f3f4f6", border: "1px solid #d1d5db", padding: "4px 8px", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 600, color: C.t2 }}>Cancel</button>
                          )}
                          {r.status === "Released" && <span style={{ fontSize: 10, color: C.t3, fontStyle: "italic" }}>Handed Over</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. LESSON RESOURCES */}
          {tab === "resources" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Lesson Slides & Learning Materials</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Resources uploaded by subject teachers.</div>
              </div>

              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Class Resources & Materials</div>
                {[
                  { name: "Quadratic Formula Presentation", subject: "Mathematics", type: "Lesson Slides", file: "Math_10_Quadratic.pdf" },
                  { name: "Narrative Tone and Structure Guide", subject: "English", type: "Learning Material", file: "Eng10_NarrativeTone.pdf" },
                  { name: "Grade 10 Science Curriculum DLL References", subject: "Science", type: "DLL Reference", file: "Sci10_DLL_Ref.pdf" }
                ].map((res, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: idx < 2 ? `0.5px solid ${C.border}` : "none" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{res.name}</div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>{res.subject} &middot; <strong style={{ color: C.m700 }}>{res.type}</strong></div>
                    </div>
                    <button onClick={() => alert(`Downloading file: ${res.file}`)} style={{ display: "flex", alignItems: "center", gap: 4, background: C.m100, border: `1px solid rgba(139,30,30,0.15)`, padding: "6px 12px", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, color: C.m700 }}>
                      <Download size={11} /> {res.file}
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Teacher Announcements</div>
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 12 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>Math quiz postponement</div>
                    <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Posted by Ms. Ana R. Soriano &middot; June 9, 2025</div>
                    <p style={{ fontSize: 11, color: C.t2, margin: "6px 0 0" }}>"Tomorrow's Math quiz on factoring will be postponed to Friday, June 13, to give more time for review."</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. BEHAVIOR & AWARDS */}
          {tab === "behavior" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Student Behavior & Guidance Log</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Privately logged incident records and counseling history.</div>
              </div>

              {/* Achievements & honors list */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Certificates & Honors Award Badges</div>
                <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { title: "First Quarter Honors Roll", rank: "With Honors", badge: "GPA 90.1", color: C.gold },
                    { title: "Second Quarter Honors Roll", rank: "With Honors", badge: "GPA 89.9", color: C.gold },
                    { title: "Third Quarter Honors Roll", rank: "With Honors", badge: "GPA 91.0", color: C.gold }
                  ].map((cert, idx) => (
                    <div key={idx} style={{ border: `1.5px solid ${C.borderMed}`, borderRadius: 6, padding: "14px 18px", background: C.paper, textAlign: "center" }}>
                      <div style={{ display: "inline-flex", background: C.goldLight, width: 38, height: 38, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                        <Award size={18} color={cert.color} />
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{cert.title}</div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>{cert.rank} &middot; <strong style={{ color: C.gold }}>{cert.badge}</strong></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Commendations */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Commendations & Achievements</div>
                {[
                  { title: "Perfect Attendance in English", date: "May 2025", desc: "Recognized for zero absences or lates" },
                  { title: "Science Classroom Assistance", date: "June 2, 2025", desc: "Helped arrange lab glassware apparatus after class hours" }
                ].map((c, idx) => (
                  <div key={idx} style={{ padding: "12px 14px", borderBottom: idx < 1 ? `0.5px solid ${C.border}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{c.title}</div>
                      <span style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>{c.date}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.t3, marginTop: 3 }}>{c.desc}</div>
                  </div>
                ))}
              </div>

              {/* Guidance Sessions */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Guidance Counseling Log</div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>Routine Career Path Consultation</div>
                    <span style={{ fontSize: 10, color: C.t3 }}>June 2, 2025</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.t2, marginTop: 4 }}>Discussion about academic performance targets and senior high school STEM enrollment preparation.</div>
                </div>
              </div>

            </div>
          )}

          {/* 8. CLINIC RECORD */}
          {tab === "clinic" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Student Health & Medical Log</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Privately logged clinic records and health alerts.</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Medical Profile</div>
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      ["Height", "165 cm"],
                      ["Weight", "55 kg"],
                      ["Blood Type", "O Positive (O+)"],
                      ["Known Allergies", "Peanuts, dust mites"],
                      ["Conditions", "Mild asthma (albuterol inhaler logged)"]
                    ].map(([l, v]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `0.5px solid ${C.border}` }}>
                        <span style={{ fontSize: 10.5, color: C.t3, fontWeight: 600 }}>{l}</span>
                        <span style={{ fontSize: 11, color: C.t1, fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Medical Notifications & Health Alerts</div>
                  <div style={{ padding: 14 }}>
                    <div style={{ border: `1px solid ${C.borderMed}`, background: C.blueBg, color: C.blue, padding: 12, borderRadius: 4 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700 }}>Annual Physical Examination</div>
                      <div style={{ fontSize: 10, marginTop: 4 }}>Scheduled for July 15, 2026, 9:00 AM at the school main clinic office. Parent consent form required.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Clinic Visits Log</div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>Complaint: Mild Headache & Dizziness</div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Administered: Paracetamol 500mg &middot; Nurse: Cruz, Ellen</div>
                    </div>
                    <span style={{ fontSize: 10, color: C.t3 }}>June 1, 2025, 2:15 PM</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.t2, marginTop: 6 }}>Rested for 30 minutes. Dizziness resolved, student returned to regular classroom schedule.</div>
                </div>
              </div>
            </div>
          )}

                    {/* School Calendar & Class Schedule Tab */}
          {tab === "calendar" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
              {/* Left: Weekly Timetable */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: `0.5px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Weekly Class Timetable (Grade 10 - Pilot)</div>
                    <span style={{ fontSize: 10, color: C.t3 }}>Homeroom Adviser: Ms. Soriano</span>
                  </div>
                  <div style={{ padding: 16, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.borderMed}` }}>
                          <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10.5, color: C.t3, textTransform: "uppercase" }}>Time</th>
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => (
                            <th key={day} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10.5, color: C.t3, textTransform: "uppercase" }}>{day}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...Array(7)].map((_, pIdx) => {
                          const timeSlot = CLASS_SCHEDULE.Monday[pIdx]?.time || "";
                          return (
                            <tr key={pIdx} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: "10px 10px", fontSize: 11, fontWeight: 700, color: C.t2, whiteSpace: "nowrap" }}>{timeSlot}</td>
                              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => {
                                const period = CLASS_SCHEDULE[day][pIdx];
                                if (!period) return <td key={day} style={{ padding: "10px 10px" }} />;
                                const color = SUBJECT_COLORS[period.subject] || C.m700;
                                return (
                                  <td key={day} style={{ padding: "6px 8px" }}>
                                    <div style={{ background: color + "10", borderLeft: `3px solid ${color}`, padding: "6px 8px", borderRadius: 3 }}>
                                      <div style={{ fontSize: 11.5, fontWeight: 700, color: color }}>{period.subject}</div>
                                      <div style={{ fontSize: 9.5, color: C.t2, marginTop: 2 }}>{period.room}</div>
                                      <div style={{ fontSize: 8.5, color: C.t3 }}>{period.teacher}</div>
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

              {/* Right: Monthly Calendar Preview */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ background: C.m800, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <button style={{ width: 24, height: 24, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={12} color="#fff" /></button>
                    <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>June 2025</span>
                    <button style={{ width: 24, height: 24, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={12} color="#fff" /></button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${C.borderMed}`, textAlign: "center" }}>
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                      <div key={i} style={{ padding: "6px 2px", fontSize: 9, fontWeight: 700, color: C.t3 }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#fcfdfd" }}>
                    {[...Array(35)].map((_, idx) => {
                      const r = Math.floor(idx / 7);
                      const col = idx % 7;
                      const day = r * 7 + col - 1;
                      const valid = day >= 1 && day <= 30;
                      const dayStr = `2025-06-${String(day).padStart(2, "0")}`;
                      const dayEvents = SCHOOL_EVENTS.filter(e => e.date === dayStr && (e.audience === "all" || e.audience === "students"));
                      const isToday = day === 10;

                      return (
                        <div key={idx} style={{ 
                          minHeight: 48, 
                          padding: 4, 
                          borderRight: `0.5px solid ${C.border}`, 
                          borderBottom: `0.5px solid ${C.border}`,
                          background: isToday ? C.m50 : "#fff",
                          boxSizing: "border-box"
                        }}>
                          {valid && (
                            <>
                              <div style={{ fontSize: 9.5, fontWeight: isToday ? 700 : 400, color: isToday ? C.m700 : col >= 5 ? C.t3 : C.t2 }}>{day}</div>
                              {dayEvents.map(ev => (
                                <div key={ev.id} title={ev.title} style={{ 
                                  fontSize: 7.5, 
                                  fontWeight: 700, 
                                  color: "#fff", 
                                  background: ev.color, 
                                  borderRadius: 2, 
                                  padding: "1px 3px", 
                                  marginTop: 2, 
                                  lineHeight: 1.2,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2
                                }}>
                                  <Lock size={6} /> {ev.title}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* School Events list for Students */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>School Events (🔒 Locked)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {SCHOOL_EVENTS.filter(e => e.audience === "all" || e.audience === "students").map(ev => (
                      <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ width: 3, height: 24, background: ev.color, borderRadius: 1.5, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                           <div style={{ fontSize: 10.5, fontWeight: 700, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                           <div style={{ fontSize: 9, color: C.t3, marginTop: 1 }}>{ev.date}</div>
                        </div>
                        <Lock size={10} color={C.t3} style={{ flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

{/* 9. SETTINGS PAGE */}
          {tab === "settings" && (
            <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
              {/* Profile card change */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "18px 22px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <div style={{ width: 68, height: 68, borderRadius: 50, background: C.m600, border: `2.5px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: C.gold }}>SJ</span>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Juan Miguel Santos</div>
                <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Learner Reference Number: 100001</div>
                <button onClick={() => alert("Feature under administrative authorization restriction.")} style={{ marginTop: 12, background: C.m100, border: `1px solid rgba(139,30,30,0.15)`, padding: "6px 14px", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, color: C.m700 }}>Upload New Profile Photo</button>
              </div>

              {/* Security & Notification settings */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "18px 22px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 12 }}>Change Account Password</div>
                  <form onSubmit={e => { e.preventDefault(); alert("Password updated successfully!"); setOldPass(""); setNewPass(""); }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: C.t2, marginBottom: 4 }}>Current Password</label>
                        <input type="password" value={oldPass} onChange={e=>setOldPass(e.target.value)} style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 4, boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: C.t2, marginBottom: 4 }}>New Password</label>
                        <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 4, boxSizing: "border-box" }} />
                      </div>
                    </div>
                    <button type="submit" style={{ background: C.m700, color: "#fff", border: "none", padding: "7px 16px", borderRadius: 3, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Update Password</button>
                  </form>
                </div>

                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "18px 22px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 12 }}>Notification Alerts Preferences</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.t1, cursor: "pointer" }}>
                      <input type="checkbox" checked={smsAlerts} onChange={e=>setSmsAlerts(e.target.checked)} />
                      <span>SMS Broadcasts to Parent's Mobile Number (Emergency Tardiness logs)</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.t1, cursor: "pointer" }}>
                      <input type="checkbox" checked={emailAlerts} onChange={e=>setEmailAlerts(e.target.checked)} />
                      <span>Email weekly scholastic average summary and grading checklists</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Slide-in Right Side Notification Drawer ── */}
      {notifOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={() => setNotifOpen(false)}>
          <div style={{ width: 340, height: "100%", background: "#fff", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease-out" }} onClick={e => e.stopPropagation()}>
            <style>{`
              @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `}</style>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Notifications (3)</span>
              <button onClick={() => setNotifOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.t3, fontWeight: 600 }}>Close</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { title: "PTA General Assembly Meeting", from: "School Administration", desc: "PTA meeting at the school gymnasium on Friday, June 13, starting at 3:00 PM.", date: "Just now", color: C.blue, type: "announcement" },
                { title: "Form 137 Missing Documents", from: "Ms. Ana R. Soriano", desc: "You still need to turn in your junior high clearance card to officially complete compliance.", date: "2 hours ago", color: C.amber, type: "alert" },
                { title: "First Quarterly Assessment", from: "Registrar Office", desc: "First quarter checklist distribution will begin on Monday. Check with your class adviser.", date: "June 25", color: C.m700, type: "exam" }
              ].map((n, idx) => (
                <div key={idx} style={{ padding: 12, border: `1px solid ${C.borderMed}`, borderLeft: `4px solid ${n.color}`, borderRadius: 4, background: C.paper, display: "flex", gap: 12 }}>
                  {n.type === "exam" ? (
                    /* Calendar chip on the left */
                    <div style={{ width: 42, height: 42, background: C.m100, border: `1px solid ${C.m700}`, borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 7, fontWeight: 800, color: C.m700, textTransform: "uppercase" }}>June</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.m700, fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>25</span>
                    </div>
                  ) : (
                    /* Normal icon indicator */
                    <div style={{ width: 42, height: 42, background: n.color + "15", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Bell size={18} color={n.color} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{n.title}</div>
                      <span style={{ fontSize: 8, color: C.t3, fontWeight: 600 }}>{n.date}</span>
                    </div>
                    <div style={{ fontSize: 9, color: n.color, fontWeight: 700, marginBottom: 4 }}>{n.from}</div>
                    <p style={{ fontSize: 10.2, color: C.t2, margin: 0, lineHeight: 1.4 }}>{n.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers
function cardStatColor(s: string) {
  return s === "Submitted" ? C.green : s === "Pending" ? C.amber : C.red;
}
function cardStatBg(s: string) {
  return s === "Submitted" ? C.greenBg : s === "Pending" ? C.amberBg : C.redBg;
}
