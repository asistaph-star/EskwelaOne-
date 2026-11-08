import React from 'react';
import {
  LayoutDashboard, FileText, BookMarked,
  Wrench, Sparkles
} from 'lucide-react';
import { PortalSidebar, SidebarGroupConfig } from '../../shared/components/navigation/PortalSidebar';
import { useAppContext } from '../../shared/AppContext';

export type NScreen =
  | "n-dashboard" | "n-messages"
  | "n-inventory" | "n-reports"
  | "n-tools" | "n-ai" | "n-pro-dev" | "n-settings" | "n-help";

const N_NAV_GROUPS: SidebarGroupConfig<NScreen>[] = [
  { category: "Overview", items: [
    { id: "n-dashboard",        label: "Clinic Overview",   icon: LayoutDashboard },
  ]},
  { category: "Health Services", items: [
    { id: "n-inventory",        label: "Clinic Inventory",  icon: BookMarked },
    { id: "n-reports",          label: "Medical Reports",   icon: FileText },
  ]},
  { category: "Analytics and Tools", items: [
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
  const { currentUser } = useAppContext();
  const displayName = currentUser?.name?.trim() || "School Nurse";
  const initials = displayName.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "SN";
  const user = { name: displayName, sub: "School Nurse" };

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
