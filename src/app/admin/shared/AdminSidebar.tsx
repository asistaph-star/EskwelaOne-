import React from "react";
import { LayoutDashboard, UserPlus, Package, Users, MonitorPlay } from "lucide-react";
import { AdminScreen } from "../AdminApp";
import { PortalSidebar, SidebarGroupConfig } from "../../shared/components/navigation/PortalSidebar";

const ADMIN_NAV_GROUPS: SidebarGroupConfig<AdminScreen>[] = [
  { category: "Operations", items: [
    { id: "dashboard", label: "System Overview", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory Management", icon: Package },
    { id: "campus-media", label: "Campus Media", icon: MonitorPlay },
  ]},
  { category: "Access Management", items: [
    { id: "teacher-create", label: "Provision Account", icon: UserPlus },
    { id: "accounts", label: "Account Management", icon: Users },
  ]}
];

interface AdminSidebarProps {
  activeScreen: AdminScreen;
  onNavigate: (s: AdminScreen) => void;
  onLogout: () => void;
}

export function AdminSidebar({ activeScreen, onNavigate, onLogout }: AdminSidebarProps) {
  const initials = "IT";

  return (
    <PortalSidebar
      groups={ADMIN_NAV_GROUPS}
      activeId={activeScreen}
      onNavigate={onNavigate}
      collapsed={false}
      brandSubtitle="Admin / IT Portal"
      userName="System Administrator"
      userSubtitle="Admin / IT Operations"
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => {}} // No profile click mapped currently, can just be undefined
    />
  );
}
