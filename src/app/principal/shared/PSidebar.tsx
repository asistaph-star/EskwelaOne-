import React, { useState } from 'react';
import { PScreen, Role } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import {
  LayoutDashboard, Monitor, BarChart2, Users, AlertCircle, Package,
  FileSpreadsheet, FileText, BookMarked, Settings, HelpCircle, LogOut, ChevronDown, Calendar, MessageSquare, ShieldAlert
} from 'lucide-react';

const P_NAV_GROUPS = [
  { category: "Overview", items: [
    { id: "p-dashboard" as PScreen,  label: "Dashboard Overview", icon: LayoutDashboard },
    { id: "p-monitoring" as PScreen, label: "Real-Time Monitoring", icon: Monitor },
  ]},
  { category: "Administration", items: [
    { id: "p-analytics" as PScreen,  label: "Academic Analytics",  icon: BarChart2 },
    { id: "p-attendance" as PScreen, label: "Student Attendance",  icon: Users },
    { id: "p-teachers" as PScreen,   label: "Teacher Management",  icon: Users },
    { id: "p-events" as PScreen,     label: "School Events",       icon: Calendar },
  ]},
  { category: "Operations", items: [
    { id: "p-inventory" as PScreen,  label: "Inventory",           icon: Package },
    { id: "p-reports" as PScreen,    label: "Reports",             icon: FileText },
    { id: "p-templates" as PScreen,  label: "Forms & Records",     icon: BookMarked },
    { id: "p-faculty-attendance" as PScreen, label: "Live Faculty Attendance", icon: Monitor },
    { id: "p-behavior" as PScreen, label: "Behavioral Reports", icon: ShieldAlert },
  ]},
];

// Flat export for external consumers
export const P_NAV = P_NAV_GROUPS.flatMap(g => g.items);
export function PSidebar({ active, onNav, onLogout, collapsed = false }: {
  active: PScreen;
  onNav: (s: PScreen) => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const user = { name: "Dr. Roberto Santos", sub: "School Administrator" };
  const initials = "RS";

  return (
    <div style={{ width: collapsed ? 70 : 240, background: C.m900, borderRight: `1px solid ${C.borderHeavy}`, display: "flex", flexDirection: "column", color: "#fff", transition: "width 0.2s", position: "relative", overflow: "hidden" }}>
      {/* School campus building - decorative background */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, top: 0,
        backgroundImage: "url(/school_bg.jpg)",
        backgroundSize: "cover", backgroundPosition: "bottom center",
        backgroundRepeat: "no-repeat",
        opacity: 0.45,
        pointerEvents: "none", zIndex: 0
      }} />
      {/* Sidebar Brand Logo */}
      <div style={{ padding: collapsed ? "20px 0" : "22px 24px", borderBottom: `1px solid ${C.borderHeavy}`, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 12, position: "relative", zIndex: 1 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: `linear-gradient(135deg, ${C.m600} 0%, ${C.m800} 100%)`,
          border: "1.5px solid rgba(200, 134, 10, 0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif", letterSpacing: "-0.02em" }}>E1</span>
        </div>
        {!collapsed && (
          <div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              EskwelaOne<sup style={{ color: C.gold, fontSize: "0.6em" }}>+</sup>
            </div>
            <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.65)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.11em", marginTop: 2 }}>
              Sindalan National High School
            </div>
          </div>
        )}
      </div>

      {/* Nav List - grouped by category */}
      <div style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", position: "relative", zIndex: 1 }}>
        {P_NAV_GROUPS.map(group => (
          <div key={group.category} style={{ marginBottom: 8 }}>
            {!collapsed && (
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", padding: "8px 14px 4px", userSelect: "none" }}>
                {group.category}
              </div>
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button key={item.id} onClick={() => onNav(item.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 12, padding: "9px 14px",
                    borderRadius: 4, background: isActive ? C.m700 : "transparent", border: "none", color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s", boxSizing: "border-box"
                  }}
                  onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'transparent'; }}>
                  <Icon size={16} color={isActive ? '#fff' : 'rgba(255,255,255,0.65)'} />
                  {!collapsed && <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Info & Footer buttons */}
      <div style={{ padding: 16, borderTop: `1px solid ${C.borderHeavy}`, position: "relative", zIndex: 1 }}>
        {!collapsed && (
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
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.sub}</div>
            </div>
            <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)", transform: showMenu ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </div>
        )}

        {collapsed && (
          <div 
            onClick={() => setShowMenu(!showMenu)}
            style={{ width: 36, height: 36, borderRadius: 18, background: C.m700, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", margin: "0 auto 12px", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = C.m600}
            onMouseLeave={e => e.currentTarget.style.background = C.m700}
          >
            {initials}
          </div>
        )}

        {showMenu && (
          <div style={{ position: "absolute", bottom: "100%", left: 8, right: 8, marginBottom: 4, display: "flex", flexDirection: "column", gap: 4, padding: "6px", background: C.m800, borderRadius: 6, border: `1px solid ${C.borderHeavy}`, boxShadow: "0 -4px 16px rgba(0,0,0,0.3)", zIndex: 10 }}>
            <button onClick={() => { onNav('p-settings'); setShowMenu(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Settings size={13} />
              {!collapsed && <span style={{ fontSize: 11 }}>Settings</span>}
            </button>
            <button onClick={() => { onNav('p-help'); setShowMenu(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <HelpCircle size={13} />
              {!collapsed && <span style={{ fontSize: 11 }}>Help & Feedback</span>}
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