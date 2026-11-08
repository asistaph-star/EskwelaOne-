import React from "react";
import { CalendarDays, LayoutDashboard, Package, Users, MonitorPlay, ShieldCheck, Award, GraduationCap, User, UserPlus, Palette } from "lucide-react";
import { AdminScreen } from "../AdminApp";
import { PortalSidebar, SidebarGroupConfig } from "../../shared/components/navigation/PortalSidebar";
import { useAppContext } from "../../shared/AppContext";

const ADMIN_NAV_GROUPS: SidebarGroupConfig<AdminScreen>[] = [
  { category: "Operations", items: [
    { id: "dashboard", label: "Operations Overview", icon: LayoutDashboard },
    { id: "sections", label: "Sections and Rosters", icon: GraduationCap },
    { id: "school-years", label: "School Years", icon: CalendarDays },
    { id: "report-cards", label: "Report Cards (SF9)", icon: Award },
    { id: "inventory", label: "Inventory Management", icon: Package },
    { id: "campus-media", label: "Campus Media", icon: MonitorPlay },
  ]},
  { category: "Staff & Records", items: [
    { id: "teacher-create", label: "Create Account", icon: UserPlus },
    { id: "accounts", label: "Staff Accounts", icon: Users },
    { id: "customization", label: "School Customization", icon: Palette },
    { id: "audit-logs", label: "Operations Audit Logs", icon: ShieldCheck },
  ]},
  { category: "Account", items: [
    { id: "profile", label: "My Profile", icon: User },
  ]}
];

interface AdminSidebarProps {
  activeScreen: AdminScreen;
  onNavigate: (s: AdminScreen) => void;
  onLogout: () => void;
}

export function AdminSidebar({ activeScreen, onNavigate, onLogout }: AdminSidebarProps) {
  const { currentUser } = useAppContext();
  const fullName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.name;
  const userName = fullName && !fullName.includes("undefined") ? fullName : "School Administrator";
  const userSubtitle = "School Operations";
  const nameParts = userName.trim().split(/\s+/);
  const initials = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`
    : nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : "AD";

  return (
    <PortalSidebar
      groups={ADMIN_NAV_GROUPS}
      activeId={activeScreen}
      onNavigate={onNavigate}
      collapsed={false}
      brandSubtitle="School Admin"
      userName={userName}
      userSubtitle={userSubtitle}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNavigate('profile')}
    />
  );
}
