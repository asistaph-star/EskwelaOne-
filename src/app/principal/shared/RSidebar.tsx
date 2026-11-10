import React from 'react';
import { RScreen } from '../../shared/types';
import { LayoutDashboard, Users, FileText, FolderOpen, Award, GraduationCap, CalendarDays, User } from 'lucide-react';
import { PortalSidebar, SidebarGroupConfig } from '../../shared/components/navigation/PortalSidebar';
import { useAppContext } from '../../shared/AppContext';

const R_NAV_GROUPS: SidebarGroupConfig<RScreen>[] = [
  { category: "Overview", items: [
    { id: "r-dashboard", label: "Dashboard Overview", icon: LayoutDashboard },
  ]},
  { category: "Admissions", items: [
    { id: "r-enrollment", label: "Student Enrollment", icon: Users },
  ]},
  { category: "Records Management", items: [
    { id: "r-doc-requests", label: "Document Requests", icon: FileText },
    { id: "r-records", label: "Academic Records (SF10)", icon: FolderOpen },
    { id: "r-report-cards", label: "Report Cards (SF9)", icon: Award },
  ]},
  { category: "Academic Hub", items: [
    { id: "r-sections", label: "Sections and Rosters", icon: GraduationCap },
    { id: "r-school-years", label: "School Years", icon: CalendarDays },
  ]},
  { category: "Account", items: [
    { id: "r-profile", label: "My Profile", icon: User },
  ]},
];

export function RSidebar({ active, onNav, onLogout, collapsed = false }: {
  active: RScreen;
  onNav: (s: RScreen) => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const { currentUser } = useAppContext();
  const fullName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.name;
  const userName = fullName && !fullName.includes("undefined") ? fullName : "Registrar Office";
  const userSubtitle = "Admissions and Records";
  const nameParts = userName.trim().split(/\s+/);
  const initials = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`
    : nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : "RE";

  return (
    <PortalSidebar
      groups={R_NAV_GROUPS}
      activeId={active}
      onNavigate={onNav}
      collapsed={collapsed}
      brandSubtitle="Registrar"
      brandLogoSize={48}
      userName={userName}
      userSubtitle={userSubtitle}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNav('r-profile')}
      theme="gold"
    />
  );
}
