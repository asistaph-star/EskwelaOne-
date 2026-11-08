import React, { useState, useEffect } from "react";
import { AdminSidebar } from "./shared/AdminSidebar";
import { PrincipalAIAssistant } from "../principal/ai/PrincipalAIAssistant";
import { AdminDashboard } from "./dashboard/AdminDashboard";
import { InventoryManagement } from "./operations/InventoryManagement";
import { CreateAccount as CreateTeacher } from "./operations/CreateTeacher";
import { AccountManagement } from "./operations/AccountManagement";
import { CampusMediaManagement } from "./operations/CampusMediaManagement";
import { SchoolCustomization } from "./operations/SchoolCustomization";
import { AuditLogsScreen } from "./operations/AuditLogsScreen";
import { ReportCardReleaseConsole } from "../shared/components/ReportCardReleaseConsole";
import { SectionsManagement } from "./operations/SectionsManagement";
import { AdminProfileScreen } from "./operations/AdminProfileScreen";
import { SchoolYearManagementScreen } from "../shared/components/SchoolYearManagementScreen";
import { PHeaderBand, QuickNavItem } from "../principal/shared/PHeaderBand";
import { C } from "../shared/constants/tokens";

export type AdminScreen = "dashboard" | "profile" | "inventory" | "teacher-create" | "accounts" | "campus-media" | "customization" | "audit-logs" | "report-cards" | "sections" | "school-years";

const ADMIN_QUICK_NAV: QuickNavItem[] = [
  { id: "dashboard", label: "Operations Overview", category: "Operations" },
  { id: "sections", label: "Sections and Rosters", category: "Operations" },
  { id: "school-years", label: "School Years", category: "Operations" },
  { id: "report-cards", label: "Report Cards (SF9)", category: "Operations" },
  { id: "inventory", label: "Inventory Management", category: "Operations" },
  { id: "campus-media", label: "Campus Media", category: "Operations" },
  { id: "teacher-create", label: "Create Account", category: "Staff & Records" },
  { id: "accounts", label: "Staff Accounts", category: "Staff & Records" },
  { id: "customization", label: "School Customization (Read-Only)", category: "Staff & Records" },
  { id: "audit-logs", label: "Operations Audit Logs", category: "Staff & Records" },
  { id: "profile", label: "My Profile", category: "Account" },
];

export function AdminApp({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<AdminScreen>("dashboard");
  const [accountsTab, setAccountsTab] = useState<"accounts" | "unprovisioned">("accounts");
  const [accountsRoleFilter, setAccountsRoleFilter] = useState<string>("All");
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const onResize = () => {
      const compact = window.innerWidth < 1024;
      setIsCompactViewport(compact);
      if (!compact) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleNavigate = (s: AdminScreen, extra?: any) => {
    setScreen(s);
    setMobileMenuOpen(false);
    if (extra?.tab) {
      setAccountsTab(extra.tab);
    } else if (s === "accounts") {
      setAccountsTab("accounts");
    }
    if (extra?.role) {
      setAccountsRoleFilter(extra.role);
    } else if (s === "accounts") {
      setAccountsRoleFilter("All");
    }
  };

  const getTitle = () => {
    switch (screen) {
      case "dashboard": return "";
      case "profile": return "My Profile";
      case "report-cards": return "Report Cards (SF9)";
      case "sections": return "Sections and Rosters";
      case "school-years": return "School Years";
      case "inventory": return "Inventory Management";
      case "campus-media": return "Campus Media";
      case "teacher-create": return "Create Account";
      case "accounts": return "Staff Accounts";
      case "customization": return "School Customization";
      case "audit-logs": return "Operations Audit Logs";
      default: return "";
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: C.paper, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      {!isCompactViewport && (
        <AdminSidebar activeScreen={screen} onNavigate={handleNavigate} onLogout={onLogout} />
      )}

      {isCompactViewport && mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "flex",
            backgroundColor: "rgba(15, 23, 42, 0.45)",
          }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ height: "100%", display: "flex" }}>
            <AdminSidebar activeScreen={screen} onNavigate={handleNavigate} onLogout={onLogout} />
          </div>
        </div>
      )}
      
      <div
        className={screen === "dashboard" ? "" : "watermark-bg"}
        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#F8FAFC" }}
      >
        <PHeaderBand
          title={getTitle()}
          sub="School Administrator, Calulut Integrated School"
          onMenu={isCompactViewport ? () => setMobileMenuOpen(v => !v) : undefined}
          quickNavItems={ADMIN_QUICK_NAV}
          onQuickNavigate={handleNavigate}
        />
        
        <main style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative" }}>
          {screen === "dashboard" && <AdminDashboard onNavigate={handleNavigate} portal="Admin" />}
          {screen === "profile" && <AdminProfileScreen />}
          {screen === "report-cards" && <ReportCardReleaseConsole portal="Admin" />}
          {screen === "sections" && <SectionsManagement />}
          {screen === "school-years" && <SchoolYearManagementScreen portal="Admin" />}
          {screen === "inventory" && <InventoryManagement />}
          {screen === "campus-media" && <CampusMediaManagement />}
          {screen === "teacher-create" && <CreateTeacher onNavigate={handleNavigate} />}
          {screen === "accounts" && <AccountManagement initialTab={accountsTab} initialRoleFilter={accountsRoleFilter} />}
          {screen === "customization" && <SchoolCustomization />}
          {screen === "audit-logs" && <AuditLogsScreen />}
        </main>
      </div>
      <PrincipalAIAssistant portal="Admin" role="Admin" />
    </div>
  );
}
