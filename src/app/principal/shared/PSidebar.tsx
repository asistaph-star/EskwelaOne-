import React from 'react';
import { PScreen } from '../../shared/types';
import {
  LayoutDashboard, Monitor, BarChart2, Users, Package,
  FileText, Calendar, ShieldAlert, ClipboardList, Scan
} from 'lucide-react';
import { PortalSidebar, SidebarGroupConfig } from '../../shared/components/navigation/PortalSidebar';

const P_NAV_GROUPS: SidebarGroupConfig<PScreen>[] = [
  { category: "Overview", items: [
    { id: "p-dashboard",  label: "Dashboard Overview", icon: LayoutDashboard },
    { id: "p-monitoring", label: "Real-Time Monitoring", icon: Monitor },
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
    { id: "p-inventory",  label: "Inventory",           icon: Package },
    { id: "p-faculty-attendance", label: "Live Faculty Attendance", icon: Monitor },

    { id: "p-behavior", label: "Behavioral Reports", icon: ShieldAlert },
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
  const user = { name: "Dr. Roberto Santos", sub: "School Administrator" };
  const initials = "RS";

  return (
    <PortalSidebar
      groups={P_NAV_GROUPS}
      activeId={active}
      onNavigate={onNav}
      collapsed={collapsed}
      brandSubtitle="Integrated School"
      userName={user.name}
      userSubtitle={user.sub}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNav('p-settings' as PScreen)}
    />
  );
}