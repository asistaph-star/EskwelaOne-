import React, { useState } from "react";
import { AdminSidebar } from "./shared/AdminSidebar";
import { PrincipalAIAssistant } from "../principal/ai/PrincipalAIAssistant";
import { AdminDashboard } from "./dashboard/AdminDashboard";
import { CreateTeacher } from "./operations/CreateTeacher";
import { InventoryManagement } from "./operations/InventoryManagement";
import { AccountManagement } from "./operations/AccountManagement";
import { PHeaderBand } from "../principal/shared/PHeaderBand";
import { C } from "../shared/constants/tokens";

import { CampusMediaManagement } from "./operations/CampusMediaManagement";
import { GateTerminalsManagement } from "./operations/GateTerminalsManagement";
import { SchoolCustomization } from "./operations/SchoolCustomization";
import { AuditLogsScreen } from "./operations/AuditLogsScreen";
import { SecurityAccessScreen } from "./operations/SecurityAccessScreen";
import { SystemHealthScreen } from "./operations/SystemHealthScreen";
import { RolesPermissionsScreen } from "./operations/RolesPermissionsScreen";

export type AdminScreen = "dashboard" | "attendance" | "teacher-create" | "inventory" | "accounts" | "campus-media" | "terminals" | "customization" | "audit-logs" | "security-access" | "system-health" | "roles-permissions";

export function AdminApp({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<AdminScreen>("dashboard");

  const getTitle = () => {
    switch (screen) {
      case "dashboard": return "System Overview";
      case "attendance": return "Attendance Summaries";
      case "teacher-create": return "Provision Account";
      case "inventory": return "Inventory Management";
      case "accounts": return "Account Management";
      case "campus-media": return "Campus Media Management";
      case "terminals": return "Gate Terminals";
      case "customization": return "School Customization";
      case "audit-logs": return "Audit Logs";
      case "security-access": return "Security & Access";
      case "system-health": return "System Health";
      case "roles-permissions": return "Roles & Permissions";
      default: return "";
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: C.paper, fontFamily: "'Inter', sans-serif" }}>
      <AdminSidebar activeScreen={screen} onNavigate={setScreen} onLogout={onLogout} />
      
      <div className="watermark-bg" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        <PHeaderBand title={getTitle()} />
        
        <main style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative" }}>
          
          {screen === "dashboard" && <AdminDashboard onNavigate={setScreen} />}
          {screen === "teacher-create" && <CreateTeacher />}
          {screen === "inventory" && <InventoryManagement />}
          {screen === "accounts" && <AccountManagement />}
          {screen === "campus-media" && <CampusMediaManagement />}
          {screen === "terminals" && <GateTerminalsManagement />}
          {screen === "customization" && <SchoolCustomization />}
          {screen === "audit-logs" && <AuditLogsScreen />}
          {screen === "security-access" && <SecurityAccessScreen onNavigate={setScreen} />}
          {screen === "system-health" && <SystemHealthScreen />}
          {screen === "roles-permissions" && <RolesPermissionsScreen />}
        </main>
      </div>
      <PrincipalAIAssistant portal="Admin" role="Admin" />
    </div>
  );
}

