import React, { useState } from 'react';
import { C } from '../shared/constants/tokens';
import { StudentReportCard } from './components/StudentReportCard';
import { NotificationDropdown } from '../shared/components/NotificationDropdown';
import {
  LogOut, BookOpen, Calendar, Award, BookMarked, Printer, Download,
  LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles
} from 'lucide-react';
import { Stamp } from '../shared/components/Stamp';
import { StatBox } from '../shared/components/StatBox';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { SCHOOL_EVENTS, CLASS_SCHEDULE, SUBJECT_COLORS } from '../shared/data/calendarData';
import { useAppContext } from '../shared/AppContext';

const STUDENT_NAV_GROUPS = [
  {
    title: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "calendar", label: "Calendar", icon: Calendar }
    ]
  },
  {
    title: "Academics",
    items: [
      { id: "academics", label: "Grades", icon: BookOpen },
      { id: "attendance", label: "Attendance", icon: Calendar },
      { id: "assignments", label: "Assignments", icon: ClipboardList },
      ]
  },
  {
    title: "Communication",
    items: [
      { id: "announcements", label: "Announcements", icon: Bell },
      ]
  },
  {
    title: "Services",
    items: [
      { id: "requests", label: "Documents", icon: FolderOpen },
      ]
  }
];

const STUDENT_TAB_METADATA: Record<string, { title: string; sub: string }> = {
  dashboard: { title: "Student Portal", sub: "Overview & Quick Actions" },
  academics: { title: "Grades & Performance", sub: "Scholastic History & Grades" },
  attendance: { title: "Gate Attendance", sub: "Daily Logs & excuse submissions" },
  assignments: { title: "My Assignments", sub: "Tasks & Submissions" },
  announcements: { title: "Announcements", sub: "School Bulletin Board" },
  requests: { title: "Document Requests", sub: "Administrative Services" },
  calendar: { title: "Calendar & Schedule", sub: "Academic Events & Classes" },
  settings: { title: "Account Settings", sub: "Profile & Security Configuration" }
};

export function StudentPortal({ onLogout }: { onLogout: () => void }) {
  const { events } = useAppContext();
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  function formatTimeDisplay(timeStr?: string) {
    if (!timeStr) return "";
    let [h, m] = timeStr.split(":");
    let hr = parseInt(h);
    let ampm = hr >= 12 ? " PM" : " AM";
    hr = hr % 12 || 12;
    return `${hr}${m !== "00" ? ":" + m : ""}${ampm}`;
  }

  const { gradesStatus, behaviorLogs, announcements, messages, addMessage, excuseLetters, addExcuseLetter } = useAppContext();
  const q1Status = gradesStatus["Gr10Rizal-Q1"] || "Draft";
  const q2Status = gradesStatus["Gr10Rizal-Q2"] || "Draft";
  const q3Status = gradesStatus["Gr10Rizal-Q3"] || "Draft";

  const [tab, setTab] = useState<
    "dashboard" | "academics" | "attendance" | "assignments" | "resources" | "behavior" | "clinic" | "requests" | "settings" | "calendar" | "announcements" | "messages"
  >("dashboard");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

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
  const [notes, setNotes] = useState("");
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [activeConvId, setActiveConvId] = useState("t-ana");
  const [aiBuddyOpen, setAiBuddyOpen] = useState(false);

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
    
    addExcuseLetter({
      id: "exc-" + Date.now(),
      studentName: "Juan Dela Cruz",
      section: "Grade 10 - Rizal",
      dates: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      filename: excuseFile || "written_excuse.pdf",
      submittedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status: "Pending Review",
      reason: excuseText
    });
    
    setExcuseText("");
    setExcuseFile(null);
    alert("Excuse letter submitted to adviser!");
  }

  // Toggle To-Do Item
  function toggleTodo(id: number) {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  }

  return (
    <div style={{ height: "100vh", overflow: "hidden", background: C.paper, fontFamily: "'Inter',sans-serif", display: "flex" }}>
      {/* ── Left Sidebar Navigation ── */}
      <div style={{ width: 240, background: C.m900, borderRight: `1px solid ${C.borderHeavy}`, display: "flex", flexDirection: "column", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        {/* School campus building — decorative background */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, top: 0,
          backgroundImage: "url(/school_bg.jpg)",
          backgroundSize: "cover", backgroundPosition: "bottom center",
          backgroundRepeat: "no-repeat",
          opacity: 0.45,
          pointerEvents: "none", zIndex: 0
        }} />
        
        {/* Brand Header — matches teacher sidebar exactly */}
        <div style={{ padding: "22px 24px", borderBottom: `1px solid ${C.borderHeavy}`, display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.m600} 0%, ${C.m800} 100%)`,
            border: "1.5px solid rgba(200, 134, 10, 0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", letterSpacing: "-0.02em" }}>E1</span>
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              EskwelaOne<sup style={{ color: C.gold, fontSize: "0.6em" }}>+</sup>
            </div>
            <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.65)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.11em", marginTop: 2 }}>
              Sindalan National High School
            </div>
          </div>
        </div>

        {/* Navigation list with categories — matches teacher sidebar */}
        <div style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", position: "relative", zIndex: 1 }}>
          {STUDENT_NAV_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", padding: "8px 14px 4px", userSelect: "none" }}>
                {group.title}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const tabMap: Record<string, string> = {
                  dashboard: "dashboard", calendar: "calendar", academics: "academics",
                  attendance: "attendance", assignments: "assignments", resources: "resources",
                  announcements: "announcements", messages: "messages", requests: "requests",
                  behavior: "behavior"
                };
                const mappedTab = tabMap[item.id] || item.id;
                const isActive = tab === mappedTab;

                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(mappedTab as any)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "9px 14px",
                      borderRadius: 4, background: isActive ? C.m700 : "transparent", border: "none",
                      color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s", boxSizing: "border-box"
                    }}
                    onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Icon size={16} color={isActive ? '#fff' : 'rgba(255,255,255,0.65)'} />
                    <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Profile Popup — matches teacher sidebar exactly */}
        <div style={{ padding: 16, borderTop: `1px solid ${C.borderHeavy}`, position: "relative", zIndex: 1 }}>
          <div 
            onClick={() => setProfileOpen(!profileOpen)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", borderBottom: profileOpen ? `1px solid ${C.borderHeavy}` : "none", cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 32, height: 32, borderRadius: 16, background: C.m700, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>
              JS
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Juan Miguel Santos</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Grade 10 - Pilot Section</div>
            </div>
            <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)", transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </div>

          {profileOpen && (
            <div style={{ position: "absolute", bottom: "100%", left: 8, right: 8, marginBottom: 4, display: "flex", flexDirection: "column", gap: 4, padding: "6px", background: C.m800, borderRadius: 6, border: `1px solid ${C.borderHeavy}`, boxShadow: "0 -4px 16px rgba(0,0,0,0.3)", zIndex: 10 }}>
              <button onClick={() => { setTab("settings"); setProfileOpen(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Settings size={13} />
                <span style={{ fontSize: 11 }}>Settings</span>
              </button>
              <button onClick={() => { setProfileOpen(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <BookMarked size={13} />
                <span style={{ fontSize: 11 }}>Tutorials</span>
              </button>
              <button onClick={() => { setProfileOpen(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Heart size={13} />
                <span style={{ fontSize: 11 }}>Help & Feedback</span>
              </button>
              <button onClick={onLogout}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <LogOut size={13} color="#f87171" />
                <span style={{ fontSize: 11, color: "#f87171" }}>Logout</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── Main Content View Window ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* Top Header Band */}
        <div style={{
          background: "#fff",
          borderBottom: `2px solid ${C.m700}`,
          padding: "0 28px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0
        }}>
          {/* Hamburger + Dynamic Page Title/Subtitle */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Menu size={16} color={C.t3} style={{ cursor: "pointer" }} />
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>
                {STUDENT_TAB_METADATA[tab]?.title || "Student Portal"}
              </h1>
              <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>
                {STUDENT_TAB_METADATA[tab]?.sub || "OVERVIEW"}
              </div>
            </div>
          </div>
          
          {/* Right Area: Search, Theme sun, Notification Bell & Profile dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Search bar mockup */}
            <div style={{ display: "flex", alignItems: "center", position: "relative", width: 280 }}>
              <Search size={13} color={C.t3} style={{ position: "absolute", left: 10 }} />
              <input 
                type="text" 
                placeholder="Search..." 
                style={{
                  width: "100%",
                  padding: "6px 12px 6px 30px",
                  fontSize: 11,
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
            </div>

            {/* Action buttons and Profile */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>

              {/* ID Card Button */}
              <button 
                onClick={() => setShowQRModal(true)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32 }}
                title="View Digital ID Card"
              >
                <QrCode size={18} color={C.t2} />
              </button>

              {/* Notification Bell */}
              <div style={{ position: "relative" }}>
                <button 
                  onClick={() => setNotifOpen(true)}
                  style={{
                    background: notifOpen ? C.m50 : "transparent",
                    border: "none",
                    borderRadius: 16,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    position: "relative",
                    transition: "background 0.2s"
                  }}
                >
                  <Bell size={18} color={notifOpen ? C.m700 : C.t2} />
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
                <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
              </div>
            </div>

          </div>
        </div>

        {/* Inner Content Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 100px 28px" }}>

          {/* 1. MOCKUP STUDENT DASHBOARD */}
          {tab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* Official header block — same design as teacher dashboard */}
              <div style={{ background: C.m800, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ background: `linear-gradient(90deg, ${C.m900} 0%, ${C.m800} 50%, ${C.m700} 100%)`, padding: "18px 24px 14px", display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: "rgba(200,134,10,0.18)", border: "1.5px solid rgba(200,134,10,0.45)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <School size={22} color={C.gold} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>Republic of the Philippines · Department of Education</div>
                    <div style={{ color: "#fff", fontSize: 18, fontWeight: 700, fontFamily: "'Fraunces',serif", lineHeight: 1.2 }}>Sindalan National High School</div>
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 4 }}>Sindalan, City of San Fernando, Pampanga · Division of San Fernando City</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, letterSpacing: "0.06em" }}>GOOD MORNING</div>
                    <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Juan Miguel Santos</div>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2, marginBottom: 6 }}>Tuesday, June 10, 2025 &middot; Week 3, Q1</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
                      <span style={{ background: "rgba(255,255,255,0.1)", color: "#fff", padding: "2px 8px", borderRadius: 12, fontWeight: 600, border: "1px solid rgba(255,255,255,0.2)" }}>
                        ID: 1092-4819
                      </span>
                      <span style={{ background: "rgba(234,179,8,0.15)", color: "#FDE047", padding: "2px 8px", borderRadius: 12, fontWeight: 600, border: "1px solid rgba(234,179,8,0.3)" }}>
                        Grade 10 - Pilot
                      </span>
                      <button
                        onClick={() => setShowQRModal(true)}
                        style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(59,130,246,0.15)", color: "#93C5FD", padding: "2px 8px", borderRadius: 12, fontWeight: 600, border: "1px solid rgba(59,130,246,0.3)", cursor: "pointer", transition: "all 0.12s", fontSize: 10 }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.25)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(59,130,246,0.15)"}
                      >
                        <QrCode size={10} /> Show QR ID
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI metrics strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {[
                  { label: "Attendance Rate", val: "95.4%", sub: "▲ 2% from last month", icon: CheckCircle, color: C.green, bg: "#f0fdf4" },
                  { label: "Assignments Due", val: "2", sub: "Due Today", icon: ClipboardList, color: C.red, bg: "#fef2f2" },
                  { label: "Today's Classes", val: "4 Classes", sub: "Next: Math (9:00 AM)", icon: Clock, color: C.blue, bg: "#eff6ff" }
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 340px", gap: 20 }}>
                
                {/* Left Area: Contains Schedule, Assignments, and Announcements */}
                <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 20 }}>
                  
                  {/* Row 1: Schedule and Assignments side-by-side */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    {/* 1. Today's Schedule */}
                    <div className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Calendar size={16} color={C.m700} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Today's Schedule</span>
                        </div>
                        <button onClick={() => setTab("calendar")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View Full Schedule</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                        {[
                          { time: "8:00 AM", title: "Physical Education and Health", room: "Gymnasium", status: "Completed", color: C.green, bg: "#f0fdf4", icon: Activity },
                          { time: "9:00 AM", title: "Mathematics", room: "Room 204", status: "In Progress", color: "#f97316", bg: "#fff7ed", icon: ClipboardList },
                          { time: "10:30 AM", title: "English", room: "Room 105", status: "Upcoming", color: C.t3, bg: C.paper, icon: BookOpen },
                          { time: "1:00 PM", title: "Science", room: "Laboratory 1", status: "Upcoming", color: C.t3, bg: C.paper, icon: FileText },
                          { time: "2:30 PM", title: "Filipino", room: "Room 201", status: "Upcoming", color: C.t3, bg: C.paper, icon: BookMarked }
                        ].map((slot, idx) => {
                          const Icon = slot.icon;
                          return (
                            <div key={idx} style={{ 
                              display: "flex", 
                              gap: 12, 
                              alignItems: "center",
                              padding: "8px 12px",
                              background: slot.status === "In Progress" ? "rgba(139,30,30,0.03)" : "transparent",
                              borderLeft: `3px solid ${slot.status === "In Progress" ? C.m700 : slot.status === "Completed" ? C.green : C.border}`,
                              borderRadius: "0 6px 6px 0",
                              transition: "all 0.15s"
                            }}>
                              <span style={{ width: 56, fontSize: 10.5, fontWeight: 700, color: C.t2 }}>{slot.time}</span>
                              <div style={{ width: 28, height: 28, borderRadius: 14, background: slot.status === "In Progress" ? "rgba(139,30,30,0.08)" : C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Icon size={13} color={slot.status === "In Progress" ? C.m700 : C.t2} />
                              </div>
                            <div style={{ 
                              flex: 1, 
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginLeft: 4
                            }}>
                              <div>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: slot.status === "In Progress" ? C.m800 : C.t1 }}>{slot.title}</div>
                                <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>{slot.room}</div>
                              </div>
                              <span style={{ 
                                fontSize: 9.5, 
                                fontWeight: 700, 
                                color: slot.status === "Completed" ? C.green : slot.status === "In Progress" ? "#f97316" : C.t3,
                                display: "flex",
                                alignItems: "center",
                                gap: 3
                              }}>
                                {slot.status === "Completed" && "✓ "}
                                {slot.status === "In Progress" && "● "}
                                {slot.status}
                              </span>
                            </div>
                            </div>
                          );
                        })}
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
                        View Full Schedule
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
                              <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>{ass.desc}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: ass.color }}>{ass.due}</div>
                              <div style={{ fontSize: 8.5, color: C.t3, marginTop: 1 }}>{ass.time}</div>
                            </div>
                          </div>
                        ))}
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

                  {/* Row 2: Announcements spans the full width of the left section */}
                  <div className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Megaphone size={16} color={C.m700} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Announcements</span>
                      </div>
                      <button onClick={() => alert("All announcements can be viewed in detail.")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View All</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { title: "Quarter 4 Progress Check", desc: "Please be informed that the Q4 Progress Check will be on June 14, 2025.", date: "June 8, 2025 · Principal's Office" },
                        { title: "Library Orientation", desc: "All students are required to attend the library orientation this June 12.", date: "June 7, 2025 · Library Department" }
                      ].map((ann, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", border: `1px solid ${C.borderMed}`, borderRadius: 6, position: "relative" }}>
                          <div style={{ width: 28, height: 28, borderRadius: 14, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                            <Bell size={13} color={C.m700} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{ann.title}</div>
                            <p style={{ fontSize: 10.5, color: C.t2, margin: "4px 0", lineHeight: 1.4 }}>{ann.desc}</p>
                            <span style={{ fontSize: 9, color: C.t3 }}>{ann.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Right Area: Stacked Column for Grades and Academic Calendar */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
                  
                  {/* Removed Grades Summary */}                  {/* 5. Academic Calendar Widget */}
                  <div className="hover-zoom" style={{ flex: 1, background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={16} color={C.m700} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Academic Calendar</span>
                      </div>
                      <button onClick={() => setTab("calendar")} style={{ background: "none", border: "none", color: C.m700, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View Calendar</button>
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
          )}

          {/* ANNOUNCEMENTS SCREEN */}
          {tab === "announcements" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>School Announcements</h1>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Stay updated with the latest news, notices, and events.</div>
                </div>
              </div>

              <div style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                {announcements.map((ann, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", border: `1px solid ${C.borderMed}`, borderRadius: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Megaphone size={14} color={C.m700} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{ann.title}</div>
                        <span style={{ fontSize: 9.5, padding: "2px 8px", background: "#f0fdf4", color: C.green, borderRadius: 10, fontWeight: 700 }}>Announcement</span>
                      </div>
                      <p style={{ fontSize: 11.5, color: C.t2, margin: "6px 0", lineHeight: 1.5 }}>{ann.body}</p>
                      <span style={{ fontSize: 9.5, color: C.t3 }}>{ann.timestamp} &middot; {ann.author}</span>
                    </div>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: C.t3 }}>No new announcements.</div>
                )}
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
              <StudentReportCard 
                student={{ surname: "Dela Cruz", first: "Juan", lrn: "100001", grade: 10, section: "Rizal", adviser: "Ana R. Soriano", gender: "male" }} 
                statuses={{ q1: q1Status, q2: q2Status, q3: q3Status }}
              />

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
                
                {/* Quiz Grades Details */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4, gridColumn: "span 2" }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Recent Quiz Performance</div>
                  <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    {[
                      { s: "Mathematics", q: "Quiz 1: Algebra", score: "18/20", pct: 90 },
                      { s: "Science", q: "Quiz 2: Physics", score: "24/25", pct: 96 },
                      { s: "English", q: "Pop Quiz: Grammar", score: "9/10", pct: 90 },
                      { s: "Filipino", q: "Quiz 3: El Filibusterismo", score: "15/15", pct: 100 }
                    ].map((qz, idx) => (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 10, borderBottom: `1px dashed ${C.borderMed}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{qz.s} &middot; <span style={{ color: C.t2, fontWeight: 600 }}>{qz.q}</span></span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.m700 }}>{qz.score}</span>
                        </div>
                        <div style={{ width: "100%", height: 6, background: C.borderMed, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${qz.pct}%`, height: "100%", background: C.m700, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
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
                
                {/* Visual Attendance Trend line chart */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4, padding: "16px 20px" }}>
                   <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 12 }}>Attendance Trend (Current Quarter)</div>
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
                  {excuseLetters.map((log, i) => (
                    <div key={log.id} style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.t1 }}>{log.reason || "Absence Excuse"}</div>
                        <div style={{ fontSize: 10, color: C.t3, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><Paperclip size={10}/> {log.filename} &middot; {log.submittedDate}</div>
                      </div>
                      <Stamp label={log.status} color={log.status === "Approved" ? C.green : log.status === "Rejected" ? C.red : C.amber} bg={log.status === "Approved" ? C.greenBg : log.status === "Rejected" ? C.redBg : C.amberBg} />
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
                              {dayEvents.map(ev => {
                                const timeStr = formatTimeDisplay(ev.time);
                                const endStr = formatTimeDisplay(ev.endTime);
                                const fullTime = timeStr ? (endStr ? `${timeStr} - ${endStr}` : timeStr) : "All day";
                                return (
                                  <div key={ev.id} title={ev.title} 
                                    onClick={(e) => { e.stopPropagation(); alert(`Event: ${ev.title}\nDate: ${ev.date}${fullTime ? `\nTime: ${fullTime}` : ''}`); }}
                                    style={{ 
                                      fontSize: 7.5, 
                                      fontWeight: 700, 
                                      color: ev.color, 
                                      background: ev.color + "12", 
                                      borderRadius: 4, 
                                      padding: "2px 4px", 
                                      marginTop: 2, 
                                      lineHeight: 1.2,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      display: "flex",
                                      flexDirection: "column",
                                      cursor: "pointer",
                                      transition: "background 0.2s"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = ev.color + "20"}
                                    onMouseLeave={e => e.currentTarget.style.background = ev.color + "12"}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 2, filter: "brightness(0.75)", fontWeight: 800 }}>
                                      <Lock size={6} /> {ev.title}
                                    </div>
                                    {fullTime && <div style={{ fontSize: 6.5, color: ev.color, marginTop: 1, filter: "brightness(0.9)", opacity: 0.85 }}>{fullTime}</div>}
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

                {/* School Events list for Students */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>School Events (🔒 Locked)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {events.filter(e => e.audience === "all" || e.audience === "students").map(ev => (
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



      {/* AI ACADEMIC BUDDY */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 900, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
        {aiBuddyOpen && (
          <div style={{ width: 320, background: "#fff", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.15)", border: `1px solid ${C.m700}`, overflow: "hidden", animation: "popIn 0.2s ease-out" }}>
            <div style={{ background: "#fff", borderBottom: `1px solid ${C.borderMed}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: C.green }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.m800 }}>AI Support</div>
                  <div style={{ fontSize: 10, color: C.green }}>Online</div>
                </div>
              </div>
              <button onClick={() => setAiBuddyOpen(false)} style={{ background: "none", border: "none", color: C.t3, cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxHeight: 300, overflowY: "auto", background: C.paper }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ background: "#f3f4f6", padding: "10px 14px", borderRadius: "10px 10px 10px 0", fontSize: 11.5, color: C.t1, lineHeight: 1.4, maxWidth: "85%" }}>
                  Hi Miguel! I noticed you are struggling with Mathematics (74 Avg). Would you like to review Quadratic Functions?
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignSelf: "flex-end", maxWidth: "85%" }}>
                <div style={{ background: "#6366f1", padding: "10px 14px", borderRadius: "10px 10px 0 10px", fontSize: 11.5, color: "#fff", lineHeight: 1.4 }}>
                  Yes, please give me a summary.
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ background: "#f3f4f6", padding: "10px 14px", borderRadius: "10px 10px 10px 0", fontSize: 11.5, color: C.t1, lineHeight: 1.4, maxWidth: "85%" }}>
                  A quadratic function is a polynomial function with one or more variables in which the highest-degree term is of the second degree. The standard form is: <b>f(x) = ax² + bx + c</b>. Try this practice quiz: <a href="#" style={{ color: "#6366f1", fontWeight: 700 }}>Quadratic Functions Quiz</a>
                </div>
              </div>
            </div>
            <div style={{ padding: 12, borderTop: `1px solid ${C.borderMed}`, background: "#fff", display: "flex", gap: 8 }}>
              <input type="text" placeholder="Type your message..." style={{ flex: 1, padding: "8px 12px", borderRadius: 4, border: `1px solid ${C.borderMed}`, background: "#fff", fontSize: 11, outline: "none" }} />
              <button style={{ background: "#6366f1", border: "none", color: "#fff", width: 36, height: 36, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={16} /></button>
            </div>
            <div style={{ padding: "8px 12px", background: "#fff", borderTop: `1px solid ${C.borderMed}`, textAlign: "center", fontSize: 9, color: C.t3 }}>
              Powered by Asyntai
            </div>
          </div>
        )}
        <button 
          onClick={() => setAiBuddyOpen(!aiBuddyOpen)}
          style={{ padding: "0 20px", height: 48, borderRadius: 24, background: C.m700, border: "none", color: "#fff", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 6px 16px rgba(139,30,30,0.3)", cursor: "pointer", transition: "transform 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <Sparkles size={18} color="#fff" />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>AI Assistant</span>
        </button>
      </div>

      {/* 4. DIGITAL QR ID CARD MODAL */}
      {showQRModal && (
        <div 
          onClick={() => setShowQRModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
            animation: "fadeIn 0.2s ease-out",
            cursor: "pointer"
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: 340, cursor: "default" }}>

            {/* Premium ID Card Design */}
            <div style={{
              width: "100%",
              background: "#fff",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.1)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              animation: "popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            }}>
              <style>{`
                @keyframes popIn {
                  0% { opacity: 0; transform: translateY(20px) scale(0.95); }
                  100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes fadeIn {
                  0% { opacity: 0; }
                  100% { opacity: 1; }
                }
              `}</style>
              
              {/* Lanyard hole punch */}
              <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: 50, height: 8, borderRadius: 4, background: "rgba(0,0,0,0.15)", borderTop: "1px solid rgba(0,0,0,0.1)", borderBottom: "1px solid rgba(255,255,255,0.2)", zIndex: 10 }} />
              
              {/* Top Banner & Profile */}
              <div style={{ 
                background: `linear-gradient(135deg, ${C.m800} 0%, ${C.m600} 100%)`, 
                padding: "40px 24px 24px", 
                color: "#fff", 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center", 
                textAlign: "center",
                position: "relative"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <School size={16} color={C.gold} />
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", color: "#fff" }}>SINDALAN NATIONAL HIGH SCHOOL</span>
                </div>
                
                <div style={{ width: 100, height: 100, borderRadius: 50, border: "4px solid #fff", overflow: "hidden", marginBottom: 16, boxShadow: "0 8px 16px rgba(0,0,0,0.2)" }}>
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face" alt="Student Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Fraunces', serif" }}>Juan Miguel Santos</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 6, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700 }}>Digital Student ID</div>
              </div>
              
              {/* Bottom Info & QR */}
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, background: "#fafafa" }}>
                
                {/* Stats Row */}
                <div style={{ display: "flex", width: "100%", justifyContent: "space-between", borderBottom: `1px dashed ${C.borderMed}`, paddingBottom: 16 }}>
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Grade & Section</div>
                    <div style={{ fontSize: 13, color: C.t1, fontWeight: 800, marginTop: 4 }}>10 - Pilot</div>
                  </div>
                  <div style={{ width: 1, background: C.borderMed }} />
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Learner Ref No.</div>
                    <div style={{ fontSize: 13, color: C.t1, fontWeight: 800, marginTop: 4, fontFamily: "monospace" }}>100001</div>
                  </div>
                </div>

                {/* QR Code Graphic */}
                <div style={{ 
                  width: 150, 
                  height: 150, 
                  background: "#fff",
                  borderRadius: 12, 
                  padding: 10, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  border: `1px solid ${C.border}`
                }}>
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=EskwelaOne-Student-100001" alt="QR Code" style={{ width: "100%", height: "100%", display: "block" }} />
                </div>
                
                <div style={{ fontSize: 10, color: C.t3, textAlign: "center", lineHeight: 1.5 }}>
                  This acts as your official digital ID.<br/>Scan at school gate terminal for validation.
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600, letterSpacing: "0.02em", animation: "fadeIn 0.4s ease-out 0.2s both" }}>
              Tap anywhere to close
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
