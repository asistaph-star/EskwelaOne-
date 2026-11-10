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
import { REnrollmentScreen } from "../principal/enrollment/REnrollmentScreen";
import { RAcademicRecordsScreen } from "../principal/records/RAcademicRecordsScreen";
import { RDocRequestsScreen } from "../principal/documents/RDocRequestsScreen";
import { PHeaderBand, QuickNavItem } from "../principal/shared/PHeaderBand";
import { C } from "../shared/constants/tokens";
import { useAppContext } from "../shared/AppContext";
import { ShieldAlert } from "lucide-react";

export type AdminScreen =
  | "dashboard"
  | "profile"
  | "inventory"
  | "teacher-create"
  | "accounts"
  | "campus-media"
  | "customization"
  | "audit-logs"
  | "report-cards"
  | "sections"
  | "school-years"
  | "enrollment"
  | "records-sf10"
  | "doc-requests";

const ADMIN_QUICK_NAV: QuickNavItem[] = [
  { id: "dashboard", label: "Operations Overview", category: "Operations" },
  { id: "sections", label: "Sections and Rosters", category: "Operations" },
  { id: "school-years", label: "School Years", category: "Operations" },
  { id: "report-cards", label: "Report Cards (SF9)", category: "Operations" },
  { id: "inventory", label: "Inventory Management", category: "Operations" },
  { id: "campus-media", label: "Campus Media", category: "Operations" },
  { id: "enrollment", label: "Student Enrollment", category: "Admissions and Records" },
  { id: "records-sf10", label: "Academic Records (SF10)", category: "Admissions and Records" },
  { id: "doc-requests", label: "Document Fulfillment", category: "Admissions and Records" },
  { id: "teacher-create", label: "Create Account", category: "Staff and Administration" },
  { id: "accounts", label: "Staff Accounts", category: "Staff and Administration" },
  { id: "customization", label: "School Customization (Read-Only)", category: "Staff and Administration" },
  { id: "audit-logs", label: "Operations Audit Logs", category: "Staff and Administration" },
  { id: "profile", label: "My Profile", category: "Account" },
];

const REGISTRAR_QUICK_NAV: QuickNavItem[] = [
  { id: "dashboard", label: "Operations Overview", category: "Operations" },
  { id: "sections", label: "Sections and Rosters", category: "Operations" },
  { id: "school-years", label: "School Years", category: "Operations" },
  { id: "report-cards", label: "Report Cards (SF9)", category: "Operations" },
  { id: "enrollment", label: "Student Enrollment", category: "Admissions and Records" },
  { id: "records-sf10", label: "Academic Records (SF10)", category: "Admissions and Records" },
  { id: "doc-requests", label: "Document Fulfillment", category: "Admissions and Records" },
  { id: "profile", label: "My Profile", category: "Account" },
];

const SCHOOL_ADMIN_ONLY_SCREENS: AdminScreen[] = [
  "inventory",
  "campus-media",
  "teacher-create",
  "accounts",
  "customization",
  "audit-logs",
];

export function AdminApp({ onLogout }: { onLogout: () => void }) {
  const { currentUser } = useAppContext();
  const isRegistrar = currentUser?.role === "Registrar";

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
    (window as any).__setAdminScreen = (s: AdminScreen) => handleNavigate(s);
    return () => {
      window.removeEventListener("resize", onResize);
      delete (window as any).__setAdminScreen;
    };
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
      case "enrollment": return "Student Enrollment";
      case "records-sf10": return "Academic Records (SF10)";
      case "doc-requests": return "Document Fulfillment";
      case "teacher-create": return "Create Account";
      case "accounts": return "Staff Accounts";
      case "customization": return "School Customization";
      case "audit-logs": return "Operations Audit Logs";
      default: return "";
    }
  };

  const isRestrictedForRegistrar = isRegistrar && SCHOOL_ADMIN_ONLY_SCREENS.includes(screen);

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
          sub={isRegistrar ? "Registrar Office, Calulut Integrated School" : "School Administrator, Calulut Integrated School"}
          onMenu={isCompactViewport ? () => setMobileMenuOpen(v => !v) : undefined}
          quickNavItems={isRegistrar ? REGISTRAR_QUICK_NAV : ADMIN_QUICK_NAV}
          onQuickNavigate={handleNavigate}
        />
        
        <main style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative" }}>
          {isRestrictedForRegistrar ? (
            <div
              data-testid="registrar-access-restricted-card"
              style={{
                padding: "36px 28px",
                maxWidth: 600,
                margin: "50px auto",
                textAlign: "center",
                background: "#FFFFFF",
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <ShieldAlert size={28} color="#DC2626" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t1, margin: "0 0 8px" }}>
                Access Restricted to School Administration
              </h3>
              <p style={{ fontSize: 13, color: C.t3, lineHeight: 1.55, margin: "0 0 24px" }}>
                This module is restricted to School Administrator roles. Your Registrar account is authorized for Student Admissions, Learner Academic Records (SF10), Document Fulfillment, Class Rosters, and Academic Year transitions.
              </p>
              <button
                type="button"
                data-testid="restricted-back-to-dashboard-btn"
                onClick={() => handleNavigate("dashboard")}
                style={{
                  background: C.m700,
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Return to Operations Overview
              </button>
            </div>
          ) : (
            <>
              {screen === "dashboard" && (
                <AdminDashboard
                  onNavigate={handleNavigate}
                  portal={isRegistrar ? "Registrar" : "Admin"}
                />
              )}
              {screen === "profile" && <AdminProfileScreen />}
              {screen === "report-cards" && (
                <ReportCardReleaseConsole portal={isRegistrar ? "Registrar" : "Admin"} />
              )}
              {screen === "sections" && <SectionsManagement readOnly={isRegistrar} />}
              {screen === "school-years" && (
                <SchoolYearManagementScreen portal={isRegistrar ? "Registrar" : "Admin"} />
              )}
              {screen === "inventory" && <InventoryManagement />}
              {screen === "campus-media" && <CampusMediaManagement />}
              {screen === "enrollment" && <REnrollmentScreen />}
              {screen === "records-sf10" && <RAcademicRecordsScreen />}
              {screen === "doc-requests" && <RDocRequestsScreen />}
              {screen === "teacher-create" && <CreateTeacher onNavigate={handleNavigate} />}
              {screen === "accounts" && (
                <AccountManagement initialTab={accountsTab} initialRoleFilter={accountsRoleFilter} />
              )}
              {screen === "customization" && <SchoolCustomization />}
              {screen === "audit-logs" && <AuditLogsScreen />}
            </>
          )}
        </main>
      </div>
      <PrincipalAIAssistant
        portal={isRegistrar ? "Registrar" : "Admin"}
        role={isRegistrar ? "Registrar" : "Admin"}
      />
    </div>
  );
}
