import React, { useEffect, useState } from "react";
import { UserPlus, Package, Users, Activity, Clock } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { AdminScreen } from "../AdminApp";
import { apiClient } from "../../../api/client";

export function AdminDashboard({ onNavigate }: { onNavigate: (s: AdminScreen) => void }) {
  const [stats, setStats] = useState<{ totalUsers: number, newUsersLast7Days: number, recentSystemEvents: number } | null>(null);

  useEffect(() => {
    apiClient.get('/admin/system-stats')
      .then((res: any) => setStats(res.data || res))
      .catch(err => console.error("Failed to load admin stats", err));
  }, []);

  return (
    <div style={{ padding: "40px", maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32, alignItems: "stretch", minHeight: "100%", overflowY: "auto" }}>
      
      {/* Header Area */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>Welcome to the IT Operations Portal</h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: C.t3, maxWidth: 500, lineHeight: 1.5, marginLeft: "auto", marginRight: "auto" }}>
          Manage system access, oversee physical assets, and monitor system health and activity.
        </p>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.t3, marginBottom: 12 }}>
              <Users size={16} />
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Registered Accounts</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {stats.totalUsers}
            </div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.t3, marginBottom: 12 }}>
              <Clock size={16} />
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>New Accounts (7 Days)</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: C.green, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              +{stats.newUsersLast7Days}
            </div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.t3, marginBottom: 12 }}>
              <Activity size={16} />
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recent System Events (24h)</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: C.m700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {stats.recentSystemEvents}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Areas */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.t2, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 12, marginTop: 16 }}>Quick Actions</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, width: "100%" }}>
        
        <button 
          onClick={() => onNavigate("inventory")}
          style={{ 
            background: "#fff", padding: "32px 24px", borderRadius: 16, border: `1px solid ${C.borderLight}`, 
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)", transition: "all 0.2s" 
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = C.m700; e.currentTarget.style.boxShadow = "0 12px 24px rgba(139, 30, 30, 0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = C.borderLight; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.03)"; }}
        >
          <div style={{ width: 64, height: 64, borderRadius: 16, background: `${C.m700}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={32} color={C.m700} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Inventory Management</div>
            <div style={{ fontSize: 12, color: C.t3 }}>Manage and edit school assets, update repair statuses, and log borrowed or damaged equipment.</div>
          </div>
        </button>

        <button 
          onClick={() => onNavigate("teacher-create")}
          style={{ 
            background: "#fff", padding: "32px 24px", borderRadius: 16, border: `1px solid ${C.borderLight}`, 
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)", transition: "all 0.2s" 
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = C.m700; e.currentTarget.style.boxShadow = "0 12px 24px rgba(139, 30, 30, 0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = C.borderLight; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.03)"; }}
        >
          <div style={{ width: 64, height: 64, borderRadius: 16, background: `${C.m700}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UserPlus size={32} color={C.m700} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Provision Account</div>
            <div style={{ fontSize: 12, color: C.t3 }}>Create new teacher/faculty accounts and provision initial system access and credentials.</div>
          </div>
        </button>

        <button 
          onClick={() => onNavigate("accounts")}
          style={{ 
            background: "#fff", padding: "32px 24px", borderRadius: 16, border: `1px solid ${C.borderLight}`, 
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)", transition: "all 0.2s" 
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = C.m700; e.currentTarget.style.boxShadow = "0 12px 24px rgba(139, 30, 30, 0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = C.borderLight; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.03)"; }}
        >
          <div style={{ width: 64, height: 64, borderRadius: 16, background: `${C.red}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={32} color={C.red} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Account Management</div>
            <div style={{ fontSize: 12, color: C.t3 }}>Manage existing system accounts. View, reset passwords, or delete users from the system.</div>
          </div>
        </button>

      </div>

    </div>
  );
}
