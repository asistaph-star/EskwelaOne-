import React from 'react';
import { useAppContext } from '../../shared/AppContext';
import {
  LayoutDashboard, Calendar, Stethoscope, FileText,
  BookOpen, CheckSquare, User, Bell, BookMarked
} from 'lucide-react';
import { PortalSidebar, SidebarGroupConfig } from '../../shared/components/navigation/PortalSidebar';

export type SScreen = "dashboard" | "academics" | "attendance" | "assignments" | "clinic" | "settings" | "calendar" | "announcements" | "appointments" | "doc-requests";

const S_NAV_GROUPS: SidebarGroupConfig<SScreen>[] = [
  {
    category: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "calendar", label: "Calendar", icon: Calendar }
    ]
  },
  {
    category: "Services",
    items: [
      { id: "clinic", label: "Clinic & Health", icon: Stethoscope },
      { id: "doc-requests", label: "Request Documents", icon: FileText }
    ]
  },
  {
    category: "Academics",
    items: [
      { id: "academics", label: "Grades & Performance", icon: BookOpen },
      { id: "assignments", label: "Assignments", icon: CheckSquare },
      { id: "attendance", label: "Gate Attendance", icon: User }
    ]
  },
  {
    category: "Communication",
    items: [
      { id: "announcements", label: "Announcements", icon: Bell },
      { id: "appointments", label: "Appointments", icon: BookMarked }
    ]
  }
];

export function SSidebar({ active, onNav, onLogout, collapsed = false }: {
  active: SScreen;
  onNav: (s: SScreen) => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const { currentUser } = useAppContext();
  const showName = currentUser?.name || "Student User";
  const showSub = "Student";
  const initials = showName.split(" ").map(n => n[0]).join("").substring(0, 2) || "S";

  return (
    <PortalSidebar
      groups={S_NAV_GROUPS}
      activeId={active}
      onNavigate={onNav}
      collapsed={collapsed}
      brandSubtitle="Integrated School"
      userName={showName}
      userSubtitle={showSub}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNav('settings')}
    />
  );
}
