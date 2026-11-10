import React from "react";
import {
  CalendarDays,
  LayoutDashboard,
  Package,
  Users,
  MonitorPlay,
  ShieldCheck,
  Award,
  GraduationCap,
  User,
  UserPlus,
  Palette,
  FolderOpen,
  FileText
} from "lucide-react";
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
  { category: "Admissions and Records", items: [
    { id: "enrollment", label: "Student Enrollment", icon: Users },
    { id: "records-sf10", label: "Academic Records (SF10)", icon: FolderOpen },
    { id: "doc-requests", label: "Document Fulfillment", icon: FileText },
  ]},
  { category: "Staff and Administration", items: [
    { id: "teacher-create", label: "Create Account", icon: UserPlus },
    { id: "accounts", label: "Staff Accounts", icon: Users },
    { id: "customization", label: "School Customization", icon: Palette },
    { id: "audit-logs", label: "Operations Audit Logs", icon: ShieldCheck },
  ]},
  { category: "Account", items: [
    { id: "profile", label: "My Profile", icon: User },
  ]}
];

const REGISTRAR_NAV_GROUPS: SidebarGroupConfig<AdminScreen>[] = [
  { category: "Operations", items: [
    { id: "dashboard", label: "Operations Overview", icon: LayoutDashboard },
    { id: "sections", label: "Sections and Rosters", icon: GraduationCap },
    { id: "school-years", label: "School Years", icon: CalendarDays },
    { id: "report-cards", label: "Report Cards (SF9)", icon: Award },
  ]},
  { category: "Admissions and Records", items: [
    { id: "enrollment", label: "Student Enrollment", icon: Users },
    { id: "records-sf10", label: "Academic Records (SF10)", icon: FolderOpen },
    { id: "doc-requests", label: "Document Fulfillment", icon: FileText },
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
  const isRegistrar = currentUser?.role === "Registrar";

  const fullName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.name;
  const userName = fullName && !fullName.includes("undefined")
    ? fullName
    : (isRegistrar ? "Registrar Officer" : "School Administrator");
  const userSubtitle = isRegistrar ? "Admissions and Records" : "School Operations";
  const brandSubtitle = isRegistrar ? "Registrar" : "School Admin";
  const groups = isRegistrar ? REGISTRAR_NAV_GROUPS : ADMIN_NAV_GROUPS;

  const nameParts = userName.trim().split(/\s+/);
  const initials = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`
    : nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (isRegistrar ? "RE" : "AD");

  return (
    <PortalSidebar
      groups={groups}
      activeId={activeScreen}
      onNavigate={onNavigate}
      collapsed={false}
      brandSubtitle={brandSubtitle}
      userName={userName}
      userSubtitle={userSubtitle}
      userInitials={initials}
      onLogout={onLogout}
      onProfileClick={() => onNavigate('profile')}
    />
  );
}
