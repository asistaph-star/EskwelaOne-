import React, { useState } from 'react';
import { TScreen, Role } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import {
  LayoutDashboard, Calendar, Users, FileText, Stethoscope, BookMarked,
  Wrench, Sparkles, GraduationCap, HelpCircle, LogOut, Archive, ChevronDown, Settings, MessageSquare, User, ShieldAlert
} from 'lucide-react';

const T_NAV_GROUPS = [
  { category: "Overview", items: [
    { id:"dashboard",          label:"Dashboard",         icon:LayoutDashboard },
    { id:"calendar",           label:"Calendar",          icon:Calendar },
    ]},
  { category: "Teaching", items: [
    { id:"classroom",          label:"Classroom Hub",     icon:Users },
    { id:"grades-direct",      label:"Grades",            icon:FileText },
    { id:"attendance-direct",  label:"Attendance",        icon:Users },
  ]},
  { category: "Records", items: [
    { id:"clinic-visits",      label:"Clinic Visits",     icon:Stethoscope },
    { id:"behavior",           label:"Behavioral Reports", icon:ShieldAlert },
    { id:"templates",          label:"Forms and Records", icon:BookMarked },
  ]},
  { category: "Tools & Growth", items: [
    { id:"pro-dev",            label:"Professional Development", icon:GraduationCap },
    { id:"ai-tools",           label:"AI Insights & Reports",    icon:Sparkles },
    { id:"leave-requests",     label:"My Leave Requests",        icon:Calendar },
  ]},
];

export function TSidebar({ active, onNav, onLogout, collapsed=false }: {
  active: TScreen;
  onNav: (s: TScreen) => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const user = { name: "Ana R. Soriano", sub: "Adviser, Grade 10 - Pilot" };
  const initials = "AS";

  return (
    <div style={{ width: collapsed ? 70 : 240, background: C.m900, borderRight: `1px solid ${C.borderHeavy}`, display: "flex", flexDirection: "column", color: "#fff", transition: "width 0.2s", position: "relative", overflow: "hidden" }}>
      <div style={{ padding: collapsed ? "20px 0" : "22px 24px", borderBottom: `1px solid ${C.borderHeavy}`, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 12, position: "relative", zIndex: 1 }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/school_seal.png" alt="CIS Logo" style={{ width: 52, height: 52, objectFit: "contain", flexShrink: 0 }} onError={(e) => (e.currentTarget.style.display = 'none')} />
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", justifyContent: "center" }}>
              <div style={{ color: "#ffffff", fontSize: 19, fontWeight: 700, fontFamily: "'Fraunces', serif", letterSpacing: "-0.01em", lineHeight: 1, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                Calulut
              </div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 3, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", lineHeight: 1 }}>
                Integrated School
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", position: "relative", zIndex: 1 }}>
        {T_NAV_GROUPS.map(group => (
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
                <button key={item.id} onClick={() => onNav(item.id as TScreen)}
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

      <div style={{ padding: 16, borderTop: `1px solid ${C.borderHeavy}`, position: "relative", zIndex: 1 }}>
        {!collapsed && (
          <div 
            onClick={() => setShowMenu(!showMenu)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", borderBottom: showMenu ? `1px solid ${C.borderHeavy}` : "none", cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
            <button onClick={() => { onNav('settings' as TScreen); setShowMenu(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <User size={13} />
              {!collapsed && <span style={{ fontSize: 11 }}>My Profile</span>}
            </button>

            <button onClick={() => { onNav('help' as TScreen); setShowMenu(false); }}
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
