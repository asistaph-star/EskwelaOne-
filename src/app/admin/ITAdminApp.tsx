import React, { useState, useEffect } from "react";
import { ITAdminSidebar } from "./shared/ITAdminSidebar";
import { PrincipalAIAssistant } from "../principal/ai/PrincipalAIAssistant";
import { AdminDashboard } from "./dashboard/AdminDashboard";
import { CreateTeacher } from "./operations/CreateTeacher";
import { AccountManagement } from "./operations/AccountManagement";
import { GateTerminalsManagement } from "./operations/GateTerminalsManagement";
import { SchoolCustomization } from "./operations/SchoolCustomization";
import { AuditLogsScreen } from "./operations/AuditLogsScreen";
import { SecurityAccessScreen } from "./operations/SecurityAccessScreen";
import { SystemHealthScreen } from "./operations/SystemHealthScreen";
import { RolesPermissionsScreen } from "./operations/RolesPermissionsScreen";
import { AdminProfileScreen } from "./operations/AdminProfileScreen";
import { PHeaderBand, QuickNavItem } from "../principal/shared/PHeaderBand";
import { C } from "../shared/constants/tokens";

export type ITAdminScreen = "dashboard" | "profile" | "teacher-create" | "accounts" | "terminals" | "customization" | "audit-logs" | "security-access" | "system-health" | "roles-permissions";

const IT_QUICK_NAV: QuickNavItem[] = [
  { id: "dashboard", label: "System Overview", category: "Infrastructure & Terminals" },
  { id: "terminals", label: "Gate Terminals", category: "Infrastructure & Terminals" },
  { id: "teacher-create", label: "Create Account", category: "Access Management" },
  { id: "accounts", label: "Account Management", category: "Access Management" },
  { id: "roles-permissions", label: "Roles and Permissions", category: "Access Management" },
  { id: "customization", label: "School Customization", category: "System & Security" },
  { id: "security-access", label: "Security and Access", category: "System & Security" },
  { id: "system-health", label: "System Health", category: "System & Security" },
  { id: "audit-logs", label: "System Audit Logs", category: "System & Security" },
  { id: "profile", label: "My Profile", category: "System & Security" },
];

export function ITAdminApp({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<ITAdminScreen>("dashboard");
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

  const handleNavigate = (s: ITAdminScreen, extra?: any) => {
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
      case "terminals": return "Gate Terminals";
      case "teacher-create": return "Create Account";
      case "accounts": return "Account Management";
      case "roles-permissions": return "Roles and Permissions";
      case "customization": return "School Customization";
      case "security-access": return "Security and Access";
      case "system-health": return "System Health";
      case "audit-logs": return "System Audit Logs";
      default: return "";
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: C.paper, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      {!isCompactViewport && (
        <ITAdminSidebar activeScreen={screen} onNavigate={handleNavigate} onLogout={onLogout} />
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
            <ITAdminSidebar activeScreen={screen} onNavigate={handleNavigate} onLogout={onLogout} />
          </div>
        </div>
      )}
      
      <div
        className={screen === "dashboard" ? "" : "watermark-bg"}
        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#F8FAFC" }}
      >
        <PHeaderBand
          title={getTitle()}
          sub="IT Administrator, Calulut Integrated School"
          onMenu={isCompactViewport ? () => setMobileMenuOpen(v => !v) : undefined}
          quickNavItems={IT_QUICK_NAV}
          onQuickNavigate={handleNavigate}
        />
        
        <main style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative" }}>
          {screen === "dashboard" && <AdminDashboard onNavigate={handleNavigate} portal="ITAdmin" />}
          {screen === "profile" && <AdminProfileScreen />}
          {screen === "terminals" && <GateTerminalsManagement />}
          {screen === "teacher-create" && <CreateTeacher onNavigate={handleNavigate} />}
          {screen === "accounts" && <AccountManagement initialTab={accountsTab} initialRoleFilter={accountsRoleFilter} />}
          {screen === "roles-permissions" && <RolesPermissionsScreen />}
          {screen === "customization" && <SchoolCustomization />}
          {screen === "security-access" && <SecurityAccessScreen onNavigate={setScreen} />}
          {screen === "system-health" && <SystemHealthScreen />}
          {screen === "audit-logs" && <AuditLogsScreen />}
        </main>
      </div>
      <PrincipalAIAssistant portal="ITAdmin" role="ITAdmin" />
    </div>
  );
}

