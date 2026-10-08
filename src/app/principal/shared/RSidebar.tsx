import React from 'react';
import { RScreen } from '../../shared/types';
import { LayoutDashboard, Users, FileText, FolderOpen, AlertTriangle, Search } from 'lucide-react';
import { PortalSidebar, SidebarGroupConfig } from '../../shared/components/navigation/PortalSidebar';

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
    { id: "r-deficiency", label: "Document Deficiency", icon: AlertTriangle },
    { id: "r-search", label: "Student Data Search", icon: Search },
  ]},
];

export function RSidebar({ active, onNav, onLogout, collapsed = false }: {
  active: RScreen;
  onNav: (s: RScreen) => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const user = { name: "Registrar Office", sub: "Admissions & Records" };
  const initials = "RE";

  return (
    <PortalSidebar
      groups={R_NAV_GROUPS}
      activeId={active}
      onNavigate={onNav}
      collapsed={collapsed}
      brandSubtitle="Registrar"
      brandLogoSize={48}
      userName={user.name}
      userSubtitle={user.sub}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNav('r-settings' as RScreen)}
      theme="gold"
    />
  );
}
