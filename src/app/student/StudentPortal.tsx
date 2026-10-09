import React, { useState } from 'react';
import { useHashRouter } from '../shared/utils/useHashRouter';
import { useAppContext } from '../shared/AppContext';
import { useLayout } from '../App';
import { C } from '../shared/constants/tokens';
import { NotificationDropdown } from '../shared/components/NotificationDropdown';
import { X, Search, Bell } from 'lucide-react';
import { SSidebar, SScreen } from './shared/SSidebar';

import { StudentDashboard } from './screens/StudentDashboard';
import { StudentAcademics } from './screens/StudentAcademics';
import { StudentAttendance } from './screens/StudentAttendance';
import { StudentAssignments } from './screens/StudentAssignments';
import { StudentClinic } from './screens/StudentClinic';
import { StudentSettings } from './screens/StudentSettings';
import { StudentCalendar } from './screens/StudentCalendar';
import { StudentAnnouncements } from './screens/StudentAnnouncements';
import { StudentAppointments } from './screens/StudentAppointments';
import { StudentDocRequests } from './screens/StudentDocRequests';

const STUDENT_TAB_METADATA: Record<string, { title: string; sub: string }> = {
  dashboard: { title: "Student Dashboard", sub: "Overview & Quick Actions" },
  academics: { title: "Grades & Performance", sub: "Scholastic History & Grades" },
  attendance: { title: "Gate Attendance", sub: "Daily Logs & excuse submissions" },
  assignments: { title: "My Assignments", sub: "Tasks & Submissions" },
  announcements: { title: "Announcements", sub: "School Bulletin Board" },
  calendar: { title: "Calendar & Schedule", sub: "Academic Events & Classes" },
  appointments: { title: "Book Appointment", sub: "Parent-Teacher Meeting Requests" },
  "doc-requests": { title: "Request Documents", sub: "School Certificates & Records" },
  settings: { title: "Account Settings", sub: "Profile & Security Configuration" },
  clinic: { title: "Clinic & Health", sub: "Health records and visits" }
};

export function StudentPortal({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useHashRouter<SScreen>("student", "dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  
  const { isMobile, isTablet } = useLayout();
  const { notifications, currentUser } = useAppContext();
  const unreadCount = notifications.filter(n => n.recipientId === currentUser?.id && !n.isRead).length;

  const currentMeta = STUDENT_TAB_METADATA[tab] || STUDENT_TAB_METADATA.dashboard;

  const nav = (s: SScreen) => {
    setTab(s);
    setMenuOpen(false);
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: C.paper, fontFamily: "'Inter',sans-serif" }}>
      {!isMobile && <SSidebar active={tab} onNav={nav} onLogout={onLogout} collapsed={isTablet} />}

      {isMobile && menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div onClick={() => setMenuOpen(false)} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ width: 280 }}>
            <SSidebar active={tab} onNav={nav} onLogout={onLogout} />
          </div>
          <button onClick={() => setMenuOpen(false)}
            style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="#fff" />
          </button>
        </div>
      )}

      <div className="watermark-bg" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: `2px solid ${C.m700}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, position: "relative", zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {isMobile && (
              <button onClick={() => setMenuOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: C.m700 }}>
                <span style={{ fontSize: 18 }}>☰</span>
              </button>
            )}
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>
                {currentMeta.title}
              </h1>
              {currentMeta.sub && <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{currentMeta.sub}</div>}
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
                  <div style={{ fontSize:13, fontWeight:700, color:C.t1, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1.2 }}>
                    {currentUser?.name || "Student User"}
                  </div>
                  <div style={{ marginTop:3 }}>
                    <span style={{ fontSize:9, fontWeight:700, color:C.m700, background:C.m50, padding:"2px 8px", borderRadius:10, border:`1px solid ${C.m100}`, letterSpacing:"0.05em", textTransform: "uppercase" }}>
                      {currentUser?.role || "Student"}
                    </span>
                  </div>
                </div>
                <div style={{ width:1, height:32, background:C.border }} />
                <div style={{ position: "relative" }}>
                  <button onClick={() => setNotifOpen(!notifOpen)}
                    style={{ background: notifOpen ? C.m50 : "transparent", border: "none", borderRadius: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, position: "relative", transition: "background 0.2s" }}>
                    <Bell size={18} color={notifOpen ? C.m700 : C.t2} />
                    {unreadCount > 0 && (
                      <div style={{ position: "absolute", top: 2, right: 2, background: C.red, color: "#fff", fontSize: 8, fontWeight: 700, borderRadius: 10, width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fff" }}>{unreadCount}</div>
                    )}
                  </button>
                  <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "24px", WebkitOverflowScrolling: "touch" }}>
            {tab === "dashboard" && <StudentDashboard setTab={setTab} currentUser={currentUser} />}
            {tab === "academics" && <StudentAcademics setTab={setTab} currentUser={currentUser} />}
            {tab === "attendance" && <StudentAttendance setTab={setTab} currentUser={currentUser} />}
            {tab === "assignments" && <StudentAssignments setTab={setTab} currentUser={currentUser} />}
            {tab === "announcements" && <StudentAnnouncements setTab={setTab} />}
            {tab === "calendar" && <StudentCalendar setTab={setTab} currentUser={currentUser} />}
            {tab === "appointments" && <StudentAppointments setTab={setTab} currentUser={currentUser} />}
            {tab === "doc-requests" && <StudentDocRequests setTab={setTab} currentUser={currentUser} />}
            {tab === "clinic" && <StudentClinic setTab={setTab} currentUser={currentUser} />}
            {tab === "settings" && <StudentSettings setTab={setTab} currentUser={currentUser} />}
          </div>
        </div>
      </div>
    </div>
  );
}
