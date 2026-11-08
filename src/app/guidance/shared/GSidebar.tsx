import React from 'react';
import { GScreen } from '../../shared/types';
import { LayoutDashboard, ShieldAlert, HeartHandshake, FileSearch } from 'lucide-react';
import { PortalSidebar, SidebarGroupConfig } from '../../shared/components/navigation/PortalSidebar';
import { useAppContext } from '../../shared/AppContext';

const G_NAV_GROUPS: SidebarGroupConfig<GScreen>[] = [
  { category: "Overview", items: [
    { id: "g-dashboard", label: "Guidance Overview", icon: LayoutDashboard },
  ]},
  { category: "Student Services", items: [
    { id: "g-records", label: "Student Records", icon: FileSearch },
    { id: "g-behavior", label: "Behavioral Reports", icon: ShieldAlert },
    { id: "g-counseling", label: "Counseling Sessions", icon: HeartHandshake },
  ]},
];

export function GSidebar({ active, onNav, onLogout, collapsed = false }: {
  active: GScreen;
  onNav: (s: GScreen) => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const { currentUser } = useAppContext();
  const displayName = currentUser?.name?.trim() || "Guidance Counselor";
  const initials = displayName.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "GC";
  const user = { name: displayName, sub: "Guidance Counselor" };

  return (
    <PortalSidebar
      groups={G_NAV_GROUPS}
      activeId={active}
      onNavigate={onNav}
      collapsed={collapsed}
      brandSubtitle="Guidance"
      brandLogoSize={48}
      userName={user.name}
      userSubtitle={user.sub}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNav('g-settings' as GScreen)}
      theme="gold"
    />
  );
}
