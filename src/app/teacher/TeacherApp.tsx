import React, { useState } from "react";
import { X, Search, Bell, BookMarked } from "lucide-react";
import { TScreen, GradeCardInfo } from "../shared/types";
import { C } from "../shared/constants/tokens";

import { useLayout, MY_CLASSES, STUDENTS_GR8 } from "../App"; 

import { TSidebar } from "./shared/TSidebar";
import { DashboardScreen } from "./dashboard/DashboardScreen";
import { ClassroomHub } from "./classroom/ClassroomHub";
import { GradebookFullScreen } from "./grades/GradebookFullScreen";
import { QuarterlySummaryScreen } from "./grades/QuarterlySummaryScreen";
import { GradesDirectScreen } from "./grades/GradesDirectScreen";
import { AttendanceDirectScreen } from "./attendance/AttendanceDirectScreen";
import { ClinicVisitsScreen } from "./clinic/ClinicVisitsScreen";
import { AIToolsScreen } from "./ai-tools/AIToolsScreen";
import { ProDevScreen } from "./pro-dev/ProDevScreen";
import { CalendarScreen } from "./calendar/CalendarScreen";
import { TemplateHubScreen } from "./templates/TemplateHubScreen";
import { TLeaveScreen } from "./leaves/TLeaveScreen";
import { TProfileScreen } from "./profile/TProfileScreen";
import { BehavioralReports } from "../shared/reports/BehavioralReports";
import { StubScreen } from "../shared/components/StubScreen";
import { StudentDetailOverlay } from "../shared/components/StudentDetailOverlay";
import { NotificationDropdown } from "../shared/components/NotificationDropdown";
import { AIAssistantWidget } from "../shared/components/AIAssistantWidget";
import { AppointmentsScreen } from "./appointments/AppointmentsScreen";
import { DocRequestsScreen } from "./documents/DocRequestsScreen";
import { CamScannerScreen } from "../shared/components/CamScannerScreen";

export function TeacherApp({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<TScreen>("dashboard");
  const [classId, setClassId] = useState<number | null>(null);
  const [gradeCard, setGradeCard] = useState<GradeCardInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { isMobile, isTablet } = useLayout();
  const nav = (s: TScreen) => { setScreen(s); setMenuOpen(false); };
  const showGradeCard = (info: GradeCardInfo) => setGradeCard(info);

  const topbars: Record<TScreen, { title: string, sub?: string }> = {
    dashboard: { title: "Teacher Dashboard", sub: "Overview & Quick Actions" },
    classroom: { title: "Classroom Hub", sub: "Manage sections & grades" },
    gradebook: { title: "Gradebook Entry", sub: "Class activity records" },
    "quarterly-summary": { title: "Quarterly Summary", sub: "Final ratings overview" },
    "grades-direct": { title: "Gradebooks Quick Access" },
    "attendance-direct": { title: "Attendance Quick Access" },
    "clinic-visits": { title: "Student Clinic Logs", sub: " Health Unit" },
    "behavior": { title: "Behavioral Reports", sub: "Track student behavior" },
    "ai-tools": { title: "AI Assistant Tools", sub: "Smart teaching aids" },
    "pro-dev": { title: "Professional Development", sub: "LAC sessions & Certificate vault" },
    calendar: { title: "Calendar & Schedule" },
    templates: { title: "Forms & Records", sub: "School Document Templates" },
    "leave-requests": { title: "My Leave Requests", sub: "Track absences & approvals" },
    tutorials: { title: "System Tutorials", sub: "Self-paced training & user guides" },
    tools: { title: "System Utilities", sub: "Calculators & formatting tools" },
    help: { title: "Help & Feedback", sub: "Contact IT operations support" },
    settings: { title: "My Profile", sub: "Personal Data Sheet & Tracking" },
    appointments: { title: "Appointments", sub: "Parent-Teacher Meeting Requests" },
    "doc-requests": { title: "Document Requests", sub: "Student Certificate Approvals" },
    "scanner": { title: "Document Scanner", sub: "Scan and digitize documents" },
  };

  const bar = topbars[screen] || { title: "Teacher Portal" };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: C.paper, fontFamily: "'Inter',sans-serif" }}>
      {!isMobile && <TSidebar active={screen} onNav={nav} onLogout={onLogout} collapsed={isTablet} />}

      {isMobile && menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div onClick={() => setMenuOpen(false)} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ width: 280 }}>
            <TSidebar active={screen} onNav={(s) => { nav(s); setMenuOpen(false); }} onLogout={onLogout} />
          </div>
          <button onClick={() => setMenuOpen(false)}
            style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="#fff" />
          </button>
        </div>
      )}

      <div className="watermark-bg" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
          
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", position: "relative", width: 220 }}>
                <Search size={13} color={C.t3} style={{ position: "absolute", left: 10 }} />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  style={{
                    width: "100%", padding: "6px 12px 6px 30px", fontSize: 11, color: C.t1,
                    background: C.m50, border: "1.5px solid " + C.borderMed, borderRadius: 20, outline: "none", transition: "all 0.15s"
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = C.m700; e.currentTarget.style.background = "#fff"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.borderMed; e.currentTarget.style.background = C.m50; }}
                />
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.t1, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1.2 }}>Ms. Ana R. Soriano</div>
                  <div style={{ marginTop:3 }}>
                    <span style={{ fontSize:9, fontWeight:700, color:"#16a34a", background:"#dcfce7", padding:"2px 8px", borderRadius:10, border:"1px solid #bbf7d0", letterSpacing:"0.05em" }}>Teacher I</span>
                  </div>
                </div>
                <div style={{ width:1, height:32, background:C.border }} />
                <div style={{ position: "relative" }}>
                  <button onClick={() => setNotifOpen(true)}
                    style={{ background: notifOpen ? C.m50 : "transparent", border: "none", borderRadius: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, position: "relative", transition: "background 0.2s" }}>
                    <Bell size={18} color={notifOpen ? C.m700 : C.t2} />
                    <div style={{ position: "absolute", top: 2, right: 2, background: C.red, color: "#fff", fontSize: 8, fontWeight: 700, borderRadius: 10, width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fff" }}>5</div>
                  </button>
                  <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 }}>
          
          {screen === "dashboard" && <DashboardScreen 
            onNav={nav} 
            onGradebookClick={(id) => { setClassId(id); setScreen("gradebook"); }} 
            onHubClick={(id) => { setClassId(id); setScreen("classroom"); }} 
            onShowGradeCard={showGradeCard} 
          />}
          {screen === "classroom" && <ClassroomHub classId={classId || 1} onBack={() => setScreen("dashboard")} onShowGradeCard={showGradeCard} />}
          {screen === "gradebook" && <GradebookFullScreen classId={classId || 1} onBack={() => setScreen("dashboard")} />}
          {screen === "quarterly-summary" && <QuarterlySummaryScreen />}
          {screen === "grades-direct" && <GradesDirectScreen />}
          {screen === "attendance-direct" && <AttendanceDirectScreen />}
          {screen === "clinic-visits" && <ClinicVisitsScreen />}
          {screen === "behavior" && <div style={{ flex: 1, overflowY: "auto", position: "relative" }}><BehavioralReports /></div>}
          {screen === "scanner" && <CamScannerScreen />}
          {screen === "ai-tools" && <AIToolsScreen />}
          {screen === "pro-dev" && <ProDevScreen />}
          {screen === "calendar" && <CalendarScreen />}
          {screen === "templates" && <TemplateHubScreen />}
          {screen === "leave-requests" && <TLeaveScreen />}
          {screen === "settings" && <TProfileScreen />}
          {screen === "appointments" && <AppointmentsScreen />}
          {screen === "doc-requests" && <DocRequestsScreen />}
          {(screen === "tutorials" || screen === "tools" || screen === "help") && (
            <StubScreen icon={BookMarked} label={bar.title} desc="This module will be expanded with full school interactive resources." />
          )}
        </div>
      </div>

      {gradeCard && (
        <StudentDetailOverlay student={{ id: STUDENTS_GR8.find(s => s.first.includes(gradeCard.name.split(',')[1]?.trim() || ''))?.id || 1, surname: gradeCard.name.split(',')[0], first: gradeCard.name.split(',')[1]?.trim() || '', avg: STUDENTS_GR8.find(s => s.first.includes(gradeCard.name.split(',')[1]?.trim() || ''))?.avg || 85, status: STUDENTS_GR8.find(s => s.first.includes(gradeCard.name.split(',')[1]?.trim() || ''))?.status || 'Passed' }} onClose={() => setGradeCard(null)} />
      )}
      <AIAssistantWidget role="Teacher" />
    </div>
  );
}
