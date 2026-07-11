import React, { useState } from "react";
import { LayoutDashboard, Search, CalendarDays, Settings, HelpCircle, LogOut, ChevronDown, UserPlus, Package, ClipboardList } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { AdminScreen } from "../AdminApp";

interface AdminSidebarProps {
  activeScreen: AdminScreen;
  onNavigate: (s: AdminScreen) => void;
  onLogout: () => void;
}

export function AdminSidebar({ activeScreen, onNavigate, onLogout }: AdminSidebarProps) {
  const [showMenu, setShowMenu] = useState(false);
  const initials = "IT";

  return (
    <div style={{ width: 240, background: C.m900, borderRight: `1px solid ${C.borderHeavy}`, display: "flex", flexDirection: "column", color: "#fff", transition: "width 0.2s", position: "relative", overflow: "hidden", flexShrink: 0 }}>
      
      {/* Brand */}
      <div style={{ padding: "22px 24px", borderBottom: `1px solid ${C.borderHeavy}`, display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
        <img src="/school_seal.jpg" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} alt="School Logo" />
        <div>
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            DigiSkwela
          </div>
          <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.65)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.11em", marginTop: 2 }}>
            Admin / IT Portal
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", padding: "8px 14px 4px", userSelect: "none" }}>
            Operations
          </div>
          
          <NavItem 
            icon={LayoutDashboard} 
            label="System Overview" 
            active={activeScreen === "dashboard"} 
            onClick={() => onNavigate("dashboard")} 
          />
          <NavItem 
            icon={Search} 
            label="Student Data Search" 
            active={activeScreen === "search"} 
            onClick={() => onNavigate("search")} 
          />
          <NavItem 
            icon={Package} 
            label="Inventory Management" 
            active={activeScreen === "inventory"} 
            onClick={() => onNavigate("inventory")} 
          />
          <NavItem 
            icon={ClipboardList} 
            label="Leave Management" 
            active={activeScreen === "leaves"} 
            onClick={() => onNavigate("leaves")} 
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", padding: "8px 14px 4px", userSelect: "none" }}>
            Access Management
          </div>
          <NavItem 
            icon={UserPlus} 
            label="Provision Account" 
            active={activeScreen === "teacher-create"} 
            onClick={() => onNavigate("teacher-create")} 
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: 16, borderTop: `1px solid ${C.borderHeavy}`, position: "relative", zIndex: 1 }}>
        <div 
          onClick={() => setShowMenu(!showMenu)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", borderBottom: showMenu ? `1px solid ${C.borderHeavy}` : "none", cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 16, background: C.m700, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>System Administrator</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Admin / IT Operations</div>
          </div>
          <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)", transform: showMenu ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>

        {showMenu && (
          <div style={{ position: "absolute", bottom: "100%", left: 8, right: 8, marginBottom: 4, display: "flex", flexDirection: "column", gap: 4, padding: "6px", background: C.m800, borderRadius: 6, border: `1px solid ${C.borderHeavy}`, boxShadow: "0 -4px 16px rgba(0,0,0,0.3)", zIndex: 10 }}>
            <button onClick={() => setShowMenu(false)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Settings size={13} />
              <span style={{ fontSize: 11 }}>Settings</span>
            </button>
            <button onClick={() => setShowMenu(false)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <HelpCircle size={13} />
              <span style={{ fontSize: 11 }}>Help & Feedback</span>
            </button>
            <button onClick={onLogout}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <LogOut size={13} color="#f87171" />
              <span style={{ fontSize: 11, color: "#f87171" }}>Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "9px 14px",
        borderRadius: 4, background: active ? C.m700 : "transparent", border: "none", color: active ? "#fff" : "rgba(255,255,255,0.65)",
        cursor: "pointer", textAlign: "left", transition: "all 0.15s", boxSizing: "border-box"
      }}
      onMouseEnter={e => { if(!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => { if(!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={16} style={{ color: active ? '#fff' : 'rgba(255,255,255,0.65)' }} />
      <span style={{ fontSize: 12, fontWeight: active ? 600 : 400 }}>{label}</span>
    </button>
  );
}
