import React, { useState } from 'react';
import { C } from '../../constants/tokens';
import { ChevronDown, GraduationCap, LogOut, User } from 'lucide-react';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';

export type SidebarItemConfig<T extends string> = {
  id: T;
  label: string;
  icon: React.ElementType;
};

export type SidebarGroupConfig<T extends string> = {
  category: string;
  items: SidebarItemConfig<T>[];
};

export type PortalSidebarProps<T extends string> = {
  // Navigation
  groups: SidebarGroupConfig<T>[];
  activeId: T;
  onNavigate: (id: T) => void;
  
  // State
  collapsed?: boolean;
  
  // Branding
  brandSubtitle?: string;
  brandLogoSize?: number;
  
  // User Profile
  userName: string;
  userSubtitle: string;
  userInitials: string;
  onLogout: () => void;
  onProfileClick?: () => void;
  
  // Styling
  theme?: "default" | "gold";
};

export function PortalSidebar<T extends string>({
  groups,
  activeId,
  onNavigate,
  collapsed = false,
  brandSubtitle = "Integrated School",
  brandLogoSize = 52,
  userName,
  userSubtitle,
  userInitials,
  onLogout,
  onProfileClick,
  theme = "default"
}: PortalSidebarProps<T>) {
  const [showMenu, setShowMenu] = useState(false);
  const { settings } = useSchoolSettings();

  const isGold = theme === "gold";
  
  const activeIconColor = isGold ? C.gold : "#fff";
  const activeTextColor = "#fff";
  const inactiveColor = "rgba(255,255,255,0.7)";
  
  const activeBg = isGold ? C.m800 : C.m700;
  const hoverBg = "rgba(255,255,255,0.05)";
  
  const initialsBg = isGold ? C.gold : C.m700;
  const initialsColor = isGold ? C.m900 : "#fff";

  const schoolLogo = settings.logoUrl;
  const schoolDisplayName = settings.schoolShortName || settings.schoolName || "DigiSkwela";
  const sidebarBg = settings.primaryColor || C.m900;

  return (
    <div style={{ width: collapsed ? 70 : 240, background: sidebarBg, borderRight: `1px solid ${C.borderHeavy}`, display: "flex", flexDirection: "column", color: "#fff", transition: "width 0.2s", position: "relative", overflow: "hidden", flexShrink: 0 }}>
      {/* Brand */}
      <div style={{ padding: collapsed ? "20px 0" : "22px 24px", borderBottom: `1px solid ${C.borderHeavy}`, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 12, position: "relative", zIndex: 1 }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {schoolLogo ? (
              <img src={schoolLogo} alt={`${schoolDisplayName} Logo`} style={{ width: brandLogoSize, height: brandLogoSize, objectFit: "contain", flexShrink: 0 }} onError={(e) => (e.currentTarget.style.display = 'none')} />
            ) : (
              <div style={{ width: brandLogoSize, height: brandLogoSize, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <GraduationCap size={Math.round(brandLogoSize * 0.7)} color={isGold ? C.gold : "#fff"} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", justifyContent: "center" }}>
              <div style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, fontFamily: "'Fraunces', serif", letterSpacing: "-0.01em", lineHeight: 1, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                {schoolDisplayName}
              </div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 3, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", lineHeight: 1 }}>
                {brandSubtitle}
              </div>
            </div>
          </div>
        )}
        {collapsed && (
          schoolLogo ? (
            <img src={schoolLogo} alt={`${schoolDisplayName} Logo`} style={{ width: 36, height: 36, objectFit: "contain", flexShrink: 0 }} onError={(e) => (e.currentTarget.style.display = 'none')} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GraduationCap size={22} color={isGold ? C.gold : "#fff"} />
            </div>
          )
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: collapsed ? "16px 8px" : "16px 12px", display: "flex", flexDirection: "column", gap: isGold ? 24 : 2, overflowY: "auto", position: "relative", zIndex: 1 }}>
        {groups.map(group => (
          <div key={group.category} style={{ marginBottom: isGold ? 0 : 8 }}>
            {!collapsed && (
              <div style={{ fontSize: isGold ? 10 : 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: isGold ? "0.08em" : "0.12em", padding: isGold ? "0 0 8px 12px" : "8px 14px 4px", userSelect: "none" }}>
                {group.category}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: isGold ? 4 : 0 }}>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeId === item.id;
                
                return (
                  <button key={item.id} onClick={() => onNavigate(item.id)} title={collapsed ? item.label : undefined}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", 
                      gap: 12, padding: collapsed ? "10px" : (isGold ? "10px 12px" : "9px 14px"),
                      borderRadius: isGold ? 8 : 4, background: isActive ? activeBg : "transparent", border: "none", 
                      color: isActive ? activeTextColor : inactiveColor,
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s", boxSizing: "border-box"
                    }}
                    onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = hoverBg; }}
                    onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'transparent'; }}>
                    <Icon size={isGold ? 18 : 16} color={isActive ? activeIconColor : inactiveColor} />
                    {!collapsed && <span style={{ fontSize: isGold ? 12.5 : 12, fontWeight: isActive ? 600 : (isGold ? 500 : 400) }}>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Profile / Footer */}
      <div style={{ padding: 16, borderTop: `1px solid ${C.borderHeavy}`, position: "relative", zIndex: 1 }}>
        {!collapsed && (
          <div 
            data-testid="sidebar-user-menu-trigger"
            onClick={() => setShowMenu(!showMenu)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", borderBottom: showMenu ? `1px solid ${C.borderHeavy}` : "none", cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 16, background: initialsBg, display: "flex", alignItems: "center", justifyContent: "center", color: initialsColor, fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
              {userInitials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userSubtitle}</div>
            </div>
            <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)", transform: showMenu ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </div>
        )}

        {collapsed && (
          <div 
            data-testid="sidebar-user-menu-trigger"
            onClick={() => setShowMenu(!showMenu)}
            style={{ width: 36, height: 36, borderRadius: 18, background: initialsBg, display: "flex", alignItems: "center", justifyContent: "center", color: initialsColor, fontSize: 11, fontWeight: 800, cursor: "pointer", margin: "0 auto 12px", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = isGold ? "rgba(255,255,255,0.8)" : C.m600}
            onMouseLeave={e => e.currentTarget.style.background = initialsBg}
          >
            {userInitials}
          </div>
        )}

        {showMenu && (
          <div style={{ position: "absolute", bottom: "100%", left: 8, right: 8, marginBottom: 4, display: "flex", flexDirection: "column", gap: 4, padding: "6px", background: C.m800, borderRadius: 6, border: `1px solid ${C.borderHeavy}`, boxShadow: "0 -4px 16px rgba(0,0,0,0.3)", zIndex: 10 }}>
            {onProfileClick && (
              <button onClick={() => { onProfileClick(); setShowMenu(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <User size={13} />
                {!collapsed && <span style={{ fontSize: 11 }}>My Profile</span>}
              </button>
            )}
            <button 
              data-testid="sidebar-logout-button"
              onClick={onLogout}
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
