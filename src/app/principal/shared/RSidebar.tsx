import React from 'react';
import { RScreen } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import { LayoutDashboard, Users, FileText, FolderOpen, Settings, HelpCircle, LogOut } from 'lucide-react';

const R_NAV_GROUPS = [
  { category: "Overview", items: [
    { id: "r-dashboard" as RScreen, label: "Dashboard Overview", icon: LayoutDashboard },
  ]},
  { category: "Admissions", items: [
    { id: "r-enrollment" as RScreen, label: "Student Enrollment", icon: Users },
  ]},
  { category: "Records Management", items: [
    { id: "r-doc-requests" as RScreen, label: "Document Requests", icon: FileText },
    { id: "r-records" as RScreen, label: "Academic Records (SF10)", icon: FolderOpen },
  ]},
];

export function RSidebar({ active, onNav, onLogout, collapsed = false }: {
  active: RScreen;
  onNav: (s: RScreen) => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const user = { name: "Registrar Office", sub: "Admissions & Records" };
  const initials = "RE";

  return (
    <div style={{ width: collapsed ? 70 : 240, background: C.m900, borderRight: `1px solid ${C.borderHeavy}`, display: "flex", flexDirection: "column", color: "#fff", transition: "width 0.2s", overflow: "hidden" }}>
      {/* Brand */}
      <div style={{ padding: collapsed ? "20px 0" : "22px 24px", borderBottom: `1px solid ${C.borderHeavy}`, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 12 }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/school_seal.png" alt="CIS Logo" style={{ width: 48, height: 48, objectFit: "contain", flexShrink: 0 }} onError={(e) => (e.currentTarget.style.display = 'none')} />
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, fontFamily: "'Fraunces', serif", whiteSpace: "nowrap" }}>Calulut</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 3 }}>Registrar</div>
            </div>
          </div>
        )}
        {collapsed && <img src="/school_seal.png" alt="CIS Logo" style={{ width: 36, height: 36, objectFit: "contain" }} onError={(e) => (e.currentTarget.style.display = 'none')} />}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: "auto", padding: collapsed ? "16px 8px" : "24px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
        {R_NAV_GROUPS.map(g => (
          <div key={g.category}>
            {!collapsed && <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, paddingLeft: 12 }}>{g.category}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {g.items.map(item => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button key={item.id} onClick={() => onNav(item.id)} title={collapsed ? item.label : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%", padding: collapsed ? "10px" : "10px 12px",
                      background: isActive ? C.m800 : "transparent", color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                      border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: isActive ? 600 : 500,
                      justifyContent: collapsed ? "center" : "flex-start", transition: "all 0.15s"
                    }}
                    onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <Icon size={18} style={{ color: isActive ? C.gold : "inherit" }} />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Nav */}
      <div style={{ padding: collapsed ? "16px 8px" : "16px", borderTop: `1px solid ${C.borderHeavy}`, display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { id: "r-settings", label: "Settings", icon: Settings },
          { id: "r-help", label: "Help & Support", icon: HelpCircle },
        ].map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => onNav(item.id as RScreen)} title={collapsed ? item.label : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", padding: collapsed ? "10px" : "10px 12px",
                background: isActive ? C.m800 : "transparent", color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: isActive ? 600 : 500,
                justifyContent: collapsed ? "center" : "flex-start", transition: "all 0.15s"
              }}
              onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <Icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* User Profile */}
      <div style={{ padding: collapsed ? "16px 8px" : "20px", borderTop: `1px solid ${C.borderHeavy}`, display: "flex", alignItems: "center", gap: 12, justifyContent: collapsed ? "center" : "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", color: C.m900, fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
            {initials}
          </div>
          {!collapsed && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{user.sub}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button onClick={onLogout} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 4 }} title="Logout"
            onMouseEnter={e => e.currentTarget.style.color = C.red}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}>
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
