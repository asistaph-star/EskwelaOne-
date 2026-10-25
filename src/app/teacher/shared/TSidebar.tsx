import React from 'react';
import { TScreen } from '../../shared/types';
import { useAppContext } from '../../shared/AppContext';
import {
  LayoutDashboard, Calendar, Users, FileText, Stethoscope, BookMarked,
  Sparkles, GraduationCap, Scan, Award, ShieldAlert, CalendarCheck
} from 'lucide-react';
import { PortalSidebar, SidebarGroupConfig } from '../../shared/components/navigation/PortalSidebar';

const T_NAV_GROUPS: SidebarGroupConfig<TScreen>[] = [
  { category: "Overview", items: [
    { id: "dashboard",          label: "Dashboard",         icon: LayoutDashboard },
    { id: "calendar",           label: "Calendar",          icon: Calendar },
  ]},
  { category: "Teaching", items: [
    { id: "classroom",          label: "Classroom Hub",     icon: Users },
    { id: "student-create",     label: "Add New Student",   icon: GraduationCap },
    { id: "grades-direct",      label: "Grades",            icon: FileText },
    { id: "attendance-direct",  label: "Attendance",        icon: Users },
    { id: "appointments",       label: "Appointments",      icon: CalendarCheck },
  ]},
  { category: "Records", items: [
    { id: "clinic-visits",      label: "Clinic Visits",     icon: Stethoscope },
    { id: "behavior",           label: "Behavioral Reports", icon: ShieldAlert },
    { id: "doc-requests",       label: "Document Requests", icon: FileText },
    { id: "scanner",            label: "Document Scanner",  icon: Scan },
    { id: "templates",          label: "Forms and Records", icon: BookMarked },
  ]},
  { category: "Tools & Growth", items: [
    { id: "t-ranking",          label: "Career Progression", icon: Award },
    { id: "pro-dev",            label: "Professional Development", icon: GraduationCap },
    { id: "ai-tools",           label: "Student Support Insights",    icon: Sparkles },
    { id: "leave-requests",     label: "My Leave Requests",        icon: Calendar },
  ]},
];

export function TSidebar({ active, onNav, onLogout, collapsed=false }: {
  active: TScreen;
  onNav: (s: TScreen) => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const { currentUser } = useAppContext();
  const showName = currentUser?.name || "Teacher User";
  const showSub = currentUser?.section ? `Adviser, ${currentUser.section}` : currentUser?.role || "Teacher";
  const initials = showName.split(" ").map(n => n[0]).join("").substring(0, 2) || "T";

  return (
    <PortalSidebar
      groups={T_NAV_GROUPS}
      activeId={active}
      onNavigate={onNav}
      collapsed={collapsed}
      brandSubtitle="Integrated School"
      userName={showName}
      userSubtitle={showSub}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNav('settings' as TScreen)}
    />
  );
}
