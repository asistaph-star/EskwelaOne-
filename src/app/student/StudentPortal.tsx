import React, { useState, useEffect } from 'react';
import { useHashRouter } from '../shared/utils/useHashRouter';
import { useAppContext } from '../shared/AppContext';
import { studentApi } from '../../api/student.api';
import { C } from '../shared/constants/tokens';
import { MobileDrawer } from '../shared/components/MobileDrawer';
import { NotificationDropdown } from '../shared/components/NotificationDropdown';
import {
  LogOut, Calendar, FileText, LayoutDashboard, Stethoscope, 
  Settings, CheckSquare, Bell, ChevronDown, Menu, BookOpen, User, BookMarked
} from 'lucide-react';

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

const STUDENT_NAV_GROUPS = [
  {
    title: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "calendar", label: "Calendar", icon: Calendar }
    ]
  },
  {
    title: "Services",
    items: [
      { id: "clinic", label: "Clinic & Health", icon: Stethoscope },
      { id: "doc-requests", label: "Request Documents", icon: FileText }
    ]
  },
  {
    title: "Academics",
    items: [
      { id: "academics", label: "Grades & Performance", icon: BookOpen },
      { id: "assignments", label: "Assignments", icon: CheckSquare },
      { id: "attendance", label: "Gate Attendance", icon: User }
    ]
  },
  {
    title: "Communication",
    items: [
      { id: "announcements", label: "Announcements", icon: Bell },
      { id: "appointments", label: "Appointments", icon: BookMarked }
    ]
  }
];

const STUDENT_TAB_METADATA: Record<string, { title: string; sub: string }> = {
  dashboard: { title: "Student Portal", sub: "Overview & Quick Actions" },
  academics: { title: "Grades & Performance", sub: "Scholastic History & Grades" },
  attendance: { title: "Gate Attendance", sub: "Daily Logs & excuse submissions" },
  assignments: { title: "My Assignments", sub: "Tasks & Submissions" },
  announcements: { title: "Announcements", sub: "School Bulletin Board" },
  calendar: { title: "Calendar & Schedule", sub: "Academic Events & Classes" },
  appointments: { title: "Book Appointment", sub: "Parent-Teacher Meeting Requests" },
  "doc-requests": { title: "Request Documents", sub: "School Certificates & Records" },
  settings: { title: "Account Settings", sub: "Profile & Security Configuration" }
};

type SScreen = "dashboard" | "academics" | "attendance" | "assignments" | "clinic" | "settings" | "calendar" | "announcements" | "appointments" | "doc-requests";

export function StudentPortal({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useHashRouter<SScreen>("student", "dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentUser } = useAppContext();

  const [notifOpen, setNotifOpen] = useState(false);
  const currentMeta = STUDENT_TAB_METADATA[tab] || STUDENT_TAB_METADATA.dashboard;

  const renderSidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 8px" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.m700}, ${C.m900})`,
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18
        }}>D</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.t1, letterSpacing: "-0.02em" }}>DigiSkwela</div>
          <div style={{ fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Student Portal</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, paddingRight: 4 }}>
        {STUDENT_NAV_GROUPS.map(g => (
          <div key={g.title}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, paddingLeft: 12 }}>{g.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {g.items.map(item => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setTab(item.id as SScreen);
                      setIsMobileMenuOpen(false);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", width: "100%",
                      background: active ? C.m50 : "transparent", color: active ? C.m800 : C.t2,
                      border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
                      fontWeight: active ? 600 : 500, transition: "all 0.2s"
                    }}
                  >
                    <item.icon size={18} style={{ color: active ? C.m700 : C.t3 }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        <button
          onClick={() => { setTab("settings"); setIsMobileMenuOpen(false); }}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", width: "100%",
            background: tab === "settings" ? C.m50 : "transparent", color: tab === "settings" ? C.m800 : C.t2,
            border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", fontWeight: tab === "settings" ? 600 : 500
          }}
        >
          <Settings size={18} style={{ color: tab === "settings" ? C.m700 : C.t3 }} />
          Settings
        </button>
        <button
          onClick={onLogout}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", width: "100%",
            background: "transparent", color: C.red, border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", fontWeight: 500
          }}
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: C.paper, overflow: "hidden", fontFamily: "Inter, sans-serif" }}>
      {/* Desktop Sidebar */}
      <div className="desktop-sidebar" style={{
        width: 260, background: "#fff", borderRight: `1px solid ${C.border}`, padding: "24px 16px",
        display: "none", flexDirection: "column", height: "100%", flexShrink: 0
      }}>
        {renderSidebarContent()}
      </div>

      <MobileDrawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)}>
        {renderSidebarContent()}
      </MobileDrawer>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
        <header style={{
          background: "#fff", borderBottom: `1px solid ${C.border}`, padding: "16px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 100
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              style={{ background: "transparent", border: "none", cursor: "pointer", display: "none", color: C.t2, padding: 4 }}
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.t1, letterSpacing: "-0.01em" }}>{currentMeta.title}</h1>
              <div style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>{currentMeta.sub}</div>
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: "50%",
                  color: C.t2, position: "relative"
                }}
              >
                <Bell size={20} />
              </button>
              <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "4px 8px", borderRadius: 8 }}>
              <div style={{ textAlign: "right", display: "none" }} className="desktop-profile-text">
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{currentUser?.name || "Student"}</div>
                <div style={{ fontSize: 12, color: C.t3 }}>Student</div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.m100, display: "flex", alignItems: "center", justifyContent: "center", color: C.m700, fontWeight: 600 }}>
                {currentUser?.name?.charAt(0) || "S"}
              </div>
              <ChevronDown size={16} color={C.t3} />
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: "24px", WebkitOverflowScrolling: "touch" }}>
          {tab === "dashboard" && <StudentDashboard setTab={setTab} currentUser={currentUser} />}
          {tab === "academics" && <StudentAcademics setTab={setTab} currentUser={currentUser} />}
          {tab === "attendance" && <StudentAttendance setTab={setTab} currentUser={currentUser} />}
          {tab === "assignments" && <StudentAssignments setTab={setTab} currentUser={currentUser} />}
          {tab === "announcements" && <StudentAnnouncements setTab={setTab} currentUser={currentUser} />}
          {tab === "calendar" && <StudentCalendar setTab={setTab} currentUser={currentUser} />}
          {tab === "appointments" && <StudentAppointments setTab={setTab} currentUser={currentUser} />}
          {tab === "doc-requests" && <StudentDocRequests setTab={setTab} currentUser={currentUser} />}
          {tab === "clinic" && <StudentClinic setTab={setTab} currentUser={currentUser} />}
          {tab === "settings" && <StudentSettings setTab={setTab} currentUser={currentUser} />}
        </main>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media (min-width: 900px) {
          .desktop-sidebar { display: flex !important; }
          .desktop-profile-text { display: block !important; }
        }
        @media (max-width: 899px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}} />
    </div>
  );
}
