import React from "react";
import { LayoutDashboard, ScanLine, UserPlus, Users, Shield, Palette, Lock, Activity, ShieldCheck, User } from "lucide-react";
import { ITAdminScreen } from "../ITAdminApp";
import { PortalSidebar, SidebarGroupConfig } from "../../shared/components/navigation/PortalSidebar";
import { useAppContext } from "../../shared/AppContext";

const IT_ADMIN_NAV_GROUPS: SidebarGroupConfig<ITAdminScreen>[] = [
  { category: "Infrastructure & Terminals", items: [
    { id: "dashboard", label: "System Overview", icon: LayoutDashboard },
    { id: "terminals", label: "Gate Terminals", icon: ScanLine },
  ]},
  { category: "Access Management", items: [
    { id: "teacher-create", label: "Create Account", icon: UserPlus },
    { id: "accounts", label: "Account Management", icon: Users },
    { id: "roles-permissions", label: "Roles and Permissions", icon: Shield },
  ]},
  { category: "System & Security", items: [
    { id: "customization", label: "School Customization", icon: Palette },
    { id: "security-access", label: "Security and Access", icon: Lock },
    { id: "system-health", label: "System Health", icon: Activity },
    { id: "audit-logs", label: "System Audit Logs", icon: ShieldCheck },
    { id: "profile", label: "My Profile", icon: User },
  ]}
];

interface ITAdminSidebarProps {
  activeScreen: ITAdminScreen;
  onNavigate: (s: ITAdminScreen) => void;
  onLogout: () => void;
}

export function ITAdminSidebar({ activeScreen, onNavigate, onLogout }: ITAdminSidebarProps) {
  const { currentUser } = useAppContext();
  const fullName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.name;
  const userName = fullName && !fullName.includes("undefined") ? fullName : "IT Administrator";
  const userSubtitle = "Technical Infrastructure";
  const nameParts = userName.trim().split(/\s+/);
  const initials = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`
    : nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : "IT";

  return (
    <PortalSidebar
      groups={IT_ADMIN_NAV_GROUPS}
      activeId={activeScreen}
      onNavigate={onNavigate}
      collapsed={false}
      brandSubtitle="IT Admin"
      userName={userName}
      userSubtitle={userSubtitle}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNavigate('profile')}
    />
  );
}

