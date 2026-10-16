import React from 'react';
import { PScreen } from '../../shared/types';
import {
  LayoutDashboard, Monitor, BarChart2, Users, Package,
  FileText, Calendar, ShieldAlert, ClipboardList, Scan
} from 'lucide-react';
import { PortalSidebar, SidebarGroupConfig } from '../../shared/components/navigation/PortalSidebar';
import { useAppContext } from '../../shared/AppContext';

const P_NAV_GROUPS: SidebarGroupConfig<PScreen>[] = [
  { category: "Overview", items: [
    { id: "p-dashboard",  label: "Dashboard Overview", icon: LayoutDashboard },
  ]},
  { category: "Administration", items: [
    { id: "p-analytics",  label: "Academic Analytics",  icon: BarChart2 },
    { id: "p-teachers",   label: "Teacher Management",  icon: Users },
    { id: "p-events",     label: "School Events",       icon: Calendar },
    { id: "p-announcements", label: "Announcements",    icon: ClipboardList },
    { id: "p-leaves",     label: "Leave Management",    icon: ClipboardList },
    { id: "p-doc-requests", label: "Document Requests", icon: FileText },
  ]},
  { category: "Operations", items: [
    { id: "p-monitoring", label: "Gate Attendance Monitoring", icon: Monitor },
    { id: "p-inventory",  label: "Inventory",           icon: Package },
    { id: "p-behavior",   label: "Behavioral Reports",  icon: ShieldAlert },
  ]},
];

// Flat export for external consumers
export const P_NAV = P_NAV_GROUPS.flatMap(g => g.items);

export function PSidebar({ active, onNav, onLogout, collapsed = false }: {
  active: PScreen;
  onNav: (s: PScreen) => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const { currentUser } = useAppContext();

  const displayName = currentUser?.name?.trim() || "Principal";
  const userSubtitle = currentUser?.role ? `${currentUser.role}` : "School Administrator";
  const initials = displayName
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "P";

  return (
    <PortalSidebar
      groups={P_NAV_GROUPS}
      activeId={active}
      onNavigate={onNav}
      collapsed={collapsed}
      brandSubtitle="Integrated School"
      userName={displayName}
      userSubtitle={userSubtitle}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNav('p-settings' as PScreen)}
    />
  );
}