import React, { useState } from 'react';
import { RScreen } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import { LayoutDashboard, Users, FileText, FolderOpen, Settings, HelpCircle, LogOut, ChevronDown, User } from 'lucide-react';

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
  const [showMenu, setShowMenu] = useState(false);
  const user = { name: "Registrar Office", sub: "Admissions & Records" };
  const initials = "RE";

  return (
    <div style={{ width: collapsed ? 70 : 240, background: C.m900, borderRight: `1px solid ${C.borderHeavy}`, display: "flex", flexDirection: "column", color: "#fff", transition: "width 0.2s", position: "relative", overflow: "hidden" }}>
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

      <div style={{ padding: 16, borderTop: `1px solid ${C.borderHeavy}`, position: "relative", zIndex: 1 }}>
        {!collapsed && (
          <div 
            onClick={() => setShowMenu(!showMenu)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", borderBottom: showMenu ? `1px solid ${C.borderHeavy}` : "none", cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 32, height: 32, borderRadius: 16, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", color: C.m900, fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.sub}</div>
            </div>
            <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)", transform: showMenu ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </div>
        )}
        
        {collapsed && (
          <div 
            onClick={() => setShowMenu(!showMenu)}
            style={{ width: 36, height: 36, borderRadius: 18, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", color: C.m900, fontSize: 11, fontWeight: 800, cursor: "pointer", margin: "0 auto 12px", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.8)"}
            onMouseLeave={e => e.currentTarget.style.background = C.gold}
          >
            {initials}
          </div>
        )}

        {showMenu && (
          <div style={{ position: "absolute", bottom: "100%", left: 8, right: 8, marginBottom: 4, display: "flex", flexDirection: "column", gap: 4, padding: "6px", background: C.m800, borderRadius: 6, border: `1px solid ${C.borderHeavy}`, boxShadow: "0 -4px 16px rgba(0,0,0,0.3)", zIndex: 10 }}>
            <button onClick={() => { onNav('r-settings' as RScreen); setShowMenu(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <User size={13} />
              {!collapsed && <span style={{ fontSize: 11 }}>My Profile</span>}
            </button>

            <button onClick={onLogout}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <LogOut size={13} color="#f87171" />
              {!collapsed && <span style={{ fontSize: 11, color: "#f87171" }}>Logout</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
