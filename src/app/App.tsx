import React, { useState, useEffect } from "react";
import { X, Search, Bell, ChevronDown, BookMarked } from "lucide-react";
import { Role, TScreen, GradeCardInfo } from "./shared/types";
import { C } from "./shared/constants/tokens";

// 1. Export hooks and mock data needed by other components
export function useLayout() {
  const get = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    return { isMobile: w < 768, isTablet: w >= 768 && w < 1060 };
  };
  const [l, setL] = useState(get);
  useEffect(() => {
    const h = () => setL(get());
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return l;
}

export const ROLE_USER = {
  Admin: { initials: "RS", name: "Dr. Roberto Santos", sub: "School Administrator" },
  Teacher: { initials: "AS", name: "Ana R. Soriano", sub: "Adviser, Grade 10 - Pilot" },
  Student: { initials: "JM", name: "Juan Miguel Santos", sub: "Grade 10 - Pilot (LRN 100001)" },
  Parent: { initials: "PA", name: "Parent Portal", sub: "Student academic progress monitoring" },
  Registrar: { initials: "RE", name: "Registrar Office", sub: "Learner Permanent Records (SF10) Management" },
};

export const MY_CLASSES = [
  { id: 1, grade: 8, section: "Rizal", subject: "Mathematics 8", students: 39, completion: 72, semester: "1st Semester", adviser: true, imgHue: "hsl(220,60%,34%)" },
  { id: 2, grade: 9, section: "Einstein", subject: "Science 9", students: 36, completion: 85, semester: "1st Semester", adviser: false, imgHue: "hsl(160,55%,28%)" },
  { id: 3, grade: 10, section: "Pilot", subject: "Filipino 10", students: 32, completion: 91, semester: "1st Semester", adviser: true, imgHue: "hsl(345,55%,32%)" },
];

export const TODAY_SCHED = [
  { time: "7:30–8:30", subject: "Mathematics 8", section: "Gr. 8 Rizal", room: "Rm 101", status: "done" },
  { time: "8:30–9:30", subject: "Science 9", section: "Gr. 9 Einstein", room: "Rm 204", status: "done" },
  { time: "9:30–10:00", subject: "—", section: "Break", room: "", status: "break" },
  { time: "10:00–11:00", subject: "Filipino 10", section: "Gr. 10 Pilot", room: "Rm 312", status: "active" },
  { time: "11:00–12:00", subject: "Mathematics 8", section: "Gr. 8 Rizal", room: "Rm 101", status: "upcoming" },
  { time: "1:00–2:00", subject: "Advisory Period", section: "Gr. 8 Rizal", room: "Rm 101", status: "upcoming" },
];

export const UPCOMING = [
  { date: "Jun 13", label: "LAC Session — Numeracy", type: "lac", urgent: false },
  { date: "Jun 14", label: "Q1 Grading deadline", type: "deadline", urgent: true },
  { date: "Jun 17", label: "Regional seminar — ICT Tools", type: "seminar", urgent: false },
  { date: "Jun 20", label: "Parent-Teacher Conference", type: "ptc", urgent: false },
  { date: "Jun 25", label: "SF2 submission — Division", type: "deadline", urgent: true },
];

export const STUDENTS_GR8 = [
  { id: 1, lrn: "200001", surname: "Aguilar", first: "Liza Marie", gender: "F", avg: 88.1, att: "Good Standing", status: "Passed" },
  { id: 2, lrn: "200002", surname: "Bondoc", first: "Ramon Jr.", gender: "M", avg: 76.8, att: "At Risk", status: "At Risk" },
  { id: 3, lrn: "200003", surname: "Cruz", first: "Trisha Ann", gender: "F", avg: 93.1, att: "Good Standing", status: "Passed" },
  { id: 4, lrn: "200004", surname: "Delos Reyes", first: "Daniel", gender: "M", avg: 89.0, att: "Good Standing", status: "Passed" },
  { id: 5, lrn: "200005", surname: "Espino", first: "Hannah Grace", gender: "F", avg: 68.5, att: "Poor", status: "Failing" },
  { id: 6, lrn: "200006", surname: "Ferrer", first: "Joshua", gender: "M", avg: 90.3, att: "Good Standing", status: "Passed" },
  { id: 7, lrn: "200007", surname: "Gomez", first: "Angelica", gender: "F", avg: 91.2, att: "Good Standing", status: "Passed" },
  { id: 8, lrn: "200008", surname: "Hernandez", first: "Mark Ryan", gender: "M", avg: 71.0, att: "At Risk", status: "Failing" },
];

export const STUDENTS_GR9 = [
  { id: 9, lrn: "200009", surname: "Mendoza", first: "Kevin", gender: "M", avg: 77.5, att: "At Risk", status: "At Risk" },
  { id: 10, lrn: "200010", surname: "Tolentino", first: "Bianca", gender: "F", avg: 85.0, att: "Good Standing", status: "Passed" },
  { id: 11, lrn: "200011", surname: "Bautista", first: "Paulo", gender: "M", avg: 69.2, att: "Poor", status: "Failing" },
  { id: 12, lrn: "200012", surname: "Navarro", first: "Chloe", gender: "F", avg: 91.5, att: "Good Standing", status: "Passed" },
];

export const STUDENTS_GR10 = [
  { id: 13, lrn: "200013", surname: "Garcia", first: "Ana Kristine", gender: "F", avg: 95.2, att: "Good Standing", status: "Passed" },
  { id: 14, lrn: "200014", surname: "Santos", first: "Juan Miguel", gender: "M", avg: 89.5, att: "Good Standing", status: "Passed" },
  { id: 15, lrn: "200015", surname: "Ocampo", first: "Renz Adrian", gender: "M", avg: 75.2, att: "At Risk", status: "At Risk" },
  { id: 16, lrn: "200016", surname: "Rivera", first: "Miguel", gender: "M", avg: 68.0, att: "Poor", status: "Failing" },
];

export const GRADEBOOK = [
  { name: "Aguilar, Liza Marie", ww: [88, 90, 86, 92, 89], pt: [91, 94, 88], qa: 90 },
  { name: "Bondoc, Ramon Jr.", ww: [70, 72, 68, 74, 73], pt: [75, 73, 71], qa: 72 },
  { name: "Cruz, Trisha Ann", ww: [94, 96, 93, 97, 95], pt: [97, 98, 95], qa: 96 },
  { name: "Delos Reyes, Daniel", ww: [80, 83, 79, 84, 82], pt: [83, 86, 81], qa: 82 },
  { name: "Espino, Hannah Grace", ww: [62, 65, 58, 70, 64], pt: [68, 70, 60], qa: 65 },
  { name: "Ferrer, Joshua", ww: [90, 92, 88, 94, 91], pt: [92, 95, 90], qa: 90 },
  { name: "Gomez, Angelica", ww: [76, 78, 75, 80, 78], pt: [80, 82, 78], qa: 78 },
  { name: "Hernandez, Mark Ryan", ww: [68, 70, 65, 72, 70], pt: [72, 74, 68], qa: 70 },
];

export const GRADEBOOK_GR9 = [
  { name: "Mendoza, Kevin", ww: [70, 72, 68, 74, 73], pt: [75, 73, 71], qa: 72 },
  { name: "Tolentino, Bianca", ww: [82, 85, 80, 86, 84], pt: [85, 88, 83], qa: 85 },
  { name: "Bautista, Paulo", ww: [62, 65, 58, 70, 64], pt: [68, 70, 60], qa: 65 },
  { name: "Navarro, Chloe", ww: [90, 92, 88, 94, 91], pt: [92, 95, 90], qa: 90 },
];

export const GRADEBOOK_GR10 = [
  { name: "Garcia, Ana Kristine", ww: [94, 96, 93, 97, 95], pt: [97, 98, 95], qa: 96 },
  { name: "Santos, Juan Miguel", ww: [88, 90, 86, 92, 89], pt: [91, 94, 88], qa: 90 },
  { name: "Ocampo, Renz Adrian", ww: [70, 72, 68, 74, 73], pt: [75, 73, 71], qa: 72 },
  { name: "Rivera, Miguel", ww: [62, 65, 58, 70, 64], pt: [68, 70, 60], qa: 65 },
];

// 2. Import Modular Screen Components
import { LoginScreen } from "./auth/login/LoginScreen";
import { SimpleShell } from "./shared/components/SimpleShell";
import { StudentPortal } from "./student/StudentPortal";
import { AdminDashboard } from "./principal/AdminDashboard";
import { NurseApp } from "./nurse/NurseApp";
import { TSidebar } from "./teacher/shared/TSidebar";
import { DashboardScreen } from "./teacher/dashboard/DashboardScreen";
import { ClassroomHub } from "./teacher/classroom/ClassroomHub";
import { GradebookFullScreen } from "./teacher/grades/GradebookFullScreen";
import { QuarterlySummaryScreen } from "./teacher/grades/QuarterlySummaryScreen";
import { GradesDirectScreen } from "./teacher/grades/GradesDirectScreen";
import { AttendanceDirectScreen } from "./teacher/attendance/AttendanceDirectScreen";
import { ClinicVisitsScreen } from "./teacher/clinic/ClinicVisitsScreen";
import { AIToolsScreen } from "./teacher/ai-tools/AIToolsScreen";
import { ProDevScreen } from "./teacher/pro-dev/ProDevScreen";
import { CalendarScreen } from "./teacher/calendar/CalendarScreen";
import { TemplateHubScreen } from "./teacher/templates/TemplateHubScreen";
import { TInboxScreen } from "./teacher/messages/TInboxScreen";
import { StubScreen } from "./shared/components/StubScreen";
import { StudentDetailOverlay } from "./shared/components/StudentDetailOverlay";
import { NotificationDropdown } from "./shared/components/NotificationDropdown";

// 3. Main Routing App Shell Orchestrator
export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [screen, setScreen] = useState<TScreen>("dashboard");
  const [classId, setClassId] = useState<number | null>(null);
  const [gradeCard, setGradeCard] = useState<GradeCardInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { isMobile, isTablet } = useLayout();
  const logout = () => { setRole(null); setScreen("dashboard"); };
  const nav = (s: TScreen) => { setScreen(s); setMenuOpen(false); };
  const showGradeCard = (info: GradeCardInfo) => setGradeCard(info);

  const topbars: Record<TScreen, { title: string, sub?: string }> = {
    dashboard: { title: "Teacher Dashboard", sub: "Overview & Quick Actions" },
    classroom: { title: "Classroom Hub", sub: "Manage sections & grades" },
    gradebook: { title: "Gradebook Entry", sub: "Class activity records" },
    "quarterly-summary": { title: "Quarterly Summary", sub: "Final ratings overview" },
    "grades-direct": { title: "Gradebooks Quick Access" },
    "attendance-direct": { title: "Attendance Quick Access" },
    "clinic-visits": { title: "Student Clinic Logs", sub: "Sindalan NHS Health Unit" },
    "ai-tools": { title: "AI Assistant Tools", sub: "Smart teaching aids" },
    "pro-dev": { title: "Professional Development", sub: "LAC sessions & Certificate vault" },
    calendar: { title: "Calendar & Schedule" },
    templates: { title: "Forms & Records", sub: "School Document Templates" },
    messages: { title: "Teacher Inbox", sub: "Direct communications" },
    tutorials: { title: "System Tutorials", sub: "Self-paced training & user guides" },
    tools: { title: "System Utilities", sub: "Calculators & formatting tools" },
    help: { title: "Help & Feedback", sub: "Contact IT operations support" },
    settings: { title: "Account Settings", sub: "Profile & Security Configuration" },
  };

  // Login role check
  if (!role) {
    return <LoginScreen onLogin={setRole} />;
  }

  // Redirect for specific dashboards
  if (role === "Admin") {
    return <AdminDashboard onLogout={logout} />;
  }
  if (role === "Student") {
    return <StudentPortal onLogout={logout} />;
  }
  if (role === "Parent") {
    return <SimpleShell role={role} onLogout={logout} />;
  }
  if (role === "Nurse") {
    return <NurseApp onLogout={logout} />;
  }

  // Teacher portal dashboard render
  const bar = topbars[screen] || { title: "Teacher Portal" };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: C.paper, fontFamily: "'Inter',sans-serif" }}>
      {!isMobile && <TSidebar active={screen} onNav={nav} onLogout={logout} collapsed={isTablet} />}

      {isMobile && menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div onClick={() => setMenuOpen(false)} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ width: 280 }}>
            <TSidebar active={screen} onNav={(s) => { nav(s); setMenuOpen(false); }} onLogout={logout} />
          </div>
          <button onClick={() => setMenuOpen(false)}
            style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="#fff" />
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar navigation band */}
        <div style={{ background: "#fff", borderBottom: `2px solid ${C.m700}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {isMobile && (
              <button onClick={() => setMenuOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: C.m700 }}>
                <span style={{ fontSize: 18 }}>☰</span>
              </button>
            )}
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>
                {classId && screen === "classroom" ? `Classroom: Gr. ${MY_CLASSES.find(c => c.id === classId)?.grade} - ${MY_CLASSES.find(c => c.id === classId)?.section}` : bar.title}
              </h1>
              {bar.sub && <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{bar.sub}</div>}
            </div>
          </div>
          
          {/* Right Area: Search, Theme sun, Notification Bell & Profile dropdown */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* Search bar mockup */}
              <div style={{ display: "flex", alignItems: "center", position: "relative", width: 220 }}>
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
                    }}>5</div>
                  </button>
                  <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic page router */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {screen === "dashboard" && <DashboardScreen onNav={nav} onClassClick={(id) => { setClassId(id); setScreen("classroom"); }} onShowGradeCard={showGradeCard} />}
          {screen === "classroom" && <ClassroomHub classId={classId || 1} onBack={() => setScreen("dashboard")} onShowGradeCard={showGradeCard} />}
          {screen === "gradebook" && <GradebookFullScreen onBack={() => setScreen("dashboard")} />}
          {screen === "quarterly-summary" && <QuarterlySummaryScreen />}
          {screen === "grades-direct" && <GradesDirectScreen />}
          {screen === "attendance-direct" && <AttendanceDirectScreen />}
          {screen === "clinic-visits" && <ClinicVisitsScreen />}
          {screen === "ai-tools" && <AIToolsScreen />}
          {screen === "pro-dev" && <ProDevScreen />}
          {screen === "calendar" && <CalendarScreen />}
          {screen === "templates" && <TemplateHubScreen />}
          {screen === "messages" && <TInboxScreen />}
          {(screen === "tutorials" || screen === "tools" || screen === "help" || screen === "settings") && (
            <StubScreen icon={BookMarked} label={bar.title} desc="This module will be expanded with full school interactive resources." />
          )}
        </div>
      </div>

      {/* Slide-out Student Profile / Grades Drawer */}
      {gradeCard && (
        <StudentDetailOverlay student={{ id: [...STUDENTS_GR8,...STUDENTS_GR9,...STUDENTS_GR10].find(s => s.first.includes(gradeCard.name.split(',')[1]?.trim() || ''))?.id || 1, surname: gradeCard.name.split(',')[0], first: gradeCard.name.split(',')[1]?.trim() || '', avg: [...STUDENTS_GR8,...STUDENTS_GR9,...STUDENTS_GR10].find(s => s.first.includes(gradeCard.name.split(',')[1]?.trim() || ''))?.avg || 85, status: [...STUDENTS_GR8,...STUDENTS_GR9,...STUDENTS_GR10].find(s => s.first.includes(gradeCard.name.split(',')[1]?.trim() || ''))?.status || 'Passed', lrn: '100001', grade: gradeCard.grade, section: gradeCard.section, adviser: 'Ana R. Soriano', gender: 'male' }} onClose={() => setGradeCard(null)} />
      )}
    </div>
  );
}
