import React from 'react';
import {
  LayoutDashboard, FileText, BookMarked,
  Wrench, Sparkles
} from 'lucide-react';
import { PortalSidebar, SidebarGroupConfig } from '../../shared/components/navigation/PortalSidebar';

export type NScreen =
  | "n-dashboard" | "n-messages"
  | "n-inventory" | "n-reports"
  | "n-tools" | "n-ai" | "n-pro-dev" | "n-settings" | "n-help";

const N_NAV_GROUPS: SidebarGroupConfig<NScreen>[] = [
  { category: "Overview", items: [
    { id: "n-dashboard",        label: "Clinic Dashboard",  icon: LayoutDashboard },
  ]},
  { category: "Health & Welfare", items: [
    { id: "n-inventory",        label: "Clinic Inventory",  icon: BookMarked },
    { id: "n-reports",          label: "Medical Reports",   icon: FileText },
  ]},
  { category: "Tools & Growth", items: [
    { id: "n-ai",               label: "Clinic Analytics",  icon: Sparkles },
    { id: "n-tools",            label: "Health Tools",      icon: Wrench },
  ]},
];

export function NSidebar({ active, onNav, onLogout, collapsed=false }: {
  active: NScreen;
  onNav: (s: NScreen) => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const user = { name: "Maria Clara", sub: "School Nurse, Clinic Staff" };
  const initials = "MC";

  return (
    <PortalSidebar
      groups={N_NAV_GROUPS}
      activeId={active}
      onNavigate={onNav}
      collapsed={collapsed}
      brandSubtitle="Integrated School"
      userName={user.name}
      userSubtitle={user.sub}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNav('n-settings')}
    />
  );
}
