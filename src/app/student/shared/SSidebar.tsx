import React from 'react';
import { useAppContext } from '../../shared/AppContext';
import {
  LayoutDashboard, Calendar, Stethoscope, FileText,
  BookOpen, CheckSquare, User, UserCheck, Bell, BookMarked, History
} from 'lucide-react';
import { PortalSidebar, SidebarGroupConfig } from '../../shared/components/navigation/PortalSidebar';

export type SScreen = "dashboard" | "profile" | "academics" | "attendance" | "academic-history" | "assignments" | "clinic" | "settings" | "calendar" | "announcements" | "appointments" | "doc-requests";

const S_NAV_GROUPS: SidebarGroupConfig<SScreen>[] = [
  {
    category: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "profile", label: "Personal Records", icon: UserCheck },
      { id: "calendar", label: "Calendar", icon: Calendar }
    ]
  },
  {
    category: "Services",
    items: [
      { id: "clinic", label: "Health Clinic", icon: Stethoscope },
      { id: "doc-requests", label: "Request Documents", icon: FileText }
    ]
  },
  {
    category: "Academics",
    items: [
      { id: "academics", label: "Grades and Report Card", icon: BookOpen },
      { id: "attendance", label: "Attendance", icon: User },
      { id: "academic-history", label: "Academic History", icon: History },
      { id: "assignments", label: "Assignments", icon: CheckSquare }
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
      onProfileClick={() => onNav('profile')}
    />
  );
}
