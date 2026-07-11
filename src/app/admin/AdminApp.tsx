import React, { useState } from "react";
import { AdminSidebar } from "./shared/AdminSidebar";
import { AdminDashboard } from "./dashboard/AdminDashboard";
import { CreateTeacher } from "./operations/CreateTeacher";
import { InventoryManagement } from "./operations/InventoryManagement";
import { AttendanceSummary } from "./reports/AttendanceSummary";
import { PHeaderBand } from "../principal/shared/PHeaderBand";
import { C } from "../shared/constants/tokens";

export type AdminScreen = "dashboard" | "attendance" | "teacher-create" | "inventory";

export function AdminApp({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<AdminScreen>("dashboard");

  const getTitle = () => {
    switch (screen) {
      case "dashboard": return "System Overview";
      case "attendance": return "Attendance Summaries";
      case "teacher-create": return "Provision Account";
      case "inventory": return "Inventory Management";
      default: return "";
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: C.paper, fontFamily: "'Inter', sans-serif" }}>
      <AdminSidebar activeScreen={screen} onNavigate={setScreen} onLogout={onLogout} />
      
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        <PHeaderBand title={getTitle()} />
        
        <main style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
          
          {screen === "dashboard" && <AdminDashboard onNavigate={setScreen} />}
          {screen === "teacher-create" && <CreateTeacher />}
          {screen === "inventory" && <InventoryManagement />}
        </main>
      </div>
    </div>
  );
}
