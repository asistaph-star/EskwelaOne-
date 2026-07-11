import React from "react";
import { Search, UserPlus, Package } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { AdminScreen } from "../AdminApp";



export function AdminDashboard({ onNavigate }: { onNavigate: (s: AdminScreen) => void }) {
  return (
    <div style={{ padding: "40px", maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32, alignItems: "stretch", minHeight: "100%", overflowY: "auto" }}>
      
      {/* Header Area */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>Welcome to the IT Operations Portal</h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: C.t3, maxWidth: 500, lineHeight: 1.5, marginLeft: "auto", marginRight: "auto" }}>
          Manage system access, oversee physical assets, and retrieve specific student data from the school database.
        </p>
      </div>

      {/* Buttons Area */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, width: "100%" }}>
        
        <button 
          onClick={() => onNavigate("search")}
          style={{ 
            background: "#fff", padding: "32px 24px", borderRadius: 16, border: `1px solid ${C.borderLight}`, 
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)", transition: "all 0.2s" 
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = C.m700; e.currentTarget.style.boxShadow = "0 12px 24px rgba(139, 30, 30, 0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = C.borderLight; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.03)"; }}
        >
          <div style={{ width: 64, height: 64, borderRadius: 16, background: `${C.m700}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Search size={32} color={C.m700} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Student Data Search</div>
            <div style={{ fontSize: 12, color: C.t3 }}>Search by LRN or Name to view detailed student profiles, academic records, and print documents.</div>
          </div>
        </button>

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

      </div>


    </div>
  );
}
