import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ArrowUpRight, Menu } from 'lucide-react';
import { C } from '../../shared/constants/tokens';
import { NotificationDropdown } from '../../shared/components/NotificationDropdown';
import { useAppContext } from '../../shared/AppContext';

export interface QuickNavItem {
  id: string;
  label: string;
  category?: string;
  description?: string;
}

export function PHeaderBand({
  title,
  sub,
  onMenu,
  onLogout,
  onSettings,
  quickNavItems,
  onQuickNavigate,
}: {
  title: string;
  sub?: string;
  onMenu?: () => void;
  onLogout?: () => void;
  onSettings?: () => void;
  quickNavItems?: QuickNavItem[];
  onQuickNavigate?: (id: any) => void;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { notifications, currentUser } = useAppContext();
  const unreadCount = notifications.filter(n => n.recipientId === currentUser?.id && !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredNavItems = React.useMemo(() => {
    if (!quickNavItems || !onQuickNavigate) return [];
    const q = query.trim().toLowerCase();
    if (!q) return quickNavItems;
    return quickNavItems.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [quickNavItems, onQuickNavigate, query]);

  const handleSelectNav = (id: string) => {
    if (onQuickNavigate) {
      onQuickNavigate(id);
      setQuery('');
      setSearchFocused(false);
    }
  };

  const hasTitle = Boolean(title && title.trim().length > 0);

  return (
    <header
      data-testid="portal-utility-header"
      style={{
        background: "#fff",
        borderBottom: "1px solid #E2E8F0",
        padding: "0 24px",
        height: hasTitle ? 54 : 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        position: "relative",
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {onMenu && (
          <button
            type="button"
            aria-label="Toggle navigation menu"
            data-testid="header-mobile-menu-btn"
            onClick={onMenu}
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 6,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: C.t1,
              flexShrink: 0,
            }}
          >
            <Menu size={16} />
          </button>
        )}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {hasTitle && (
            <h1
              data-testid="utility-header-title"
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: C.t1,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "-0.01em",
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </h1>
          )}
          {sub && (
            <div
              data-testid="utility-header-sub"
              style={{
                fontSize: hasTitle ? 10 : 10.5,
                fontWeight: hasTitle ? 500 : 600,
                color: C.t3,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginTop: hasTitle ? 1 : 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {sub}
            </div>
          )}
        </div>
      </div>

      {/* Right Area: Functional Quick Module Jump & Notification Bell */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        {quickNavItems && onQuickNavigate && (
          <div
            ref={searchContainerRef}
            style={{
              display: "flex",
              alignItems: "center",
              position: "relative",
              width: onMenu ? 148 : 230,
              maxWidth: "42vw",
            }}
          >
            <Search size={13} color={C.t3} style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
            <input
              type="text"
              value={query}
              aria-label="Jump to portal module"
              placeholder="Jump to module..."
              onChange={e => {
                setQuery(e.target.value);
                setSearchFocused(true);
              }}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && filteredNavItems.length > 0) {
                  e.preventDefault();
                  handleSelectNav(filteredNavItems[0].id);
                } else if (e.key === 'Escape') {
                  setSearchFocused(false);
                }
              }}
              style={{
                width: "100%",
                padding: "6px 12px 6px 30px",
                fontSize: 12,
                color: C.t1,
                background: searchFocused ? "#fff" : "#F8FAFC",
                border: `1px solid ${searchFocused ? C.m700 : "#CBD5E1"}`,
                borderRadius: 8,
                outline: "none",
                transition: "all 0.15s",
              }}
            />

            {searchFocused && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 280,
                  maxHeight: 300,
                  overflowY: "auto",
                  background: "#fff",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.12)",
                  padding: 6,
                  zIndex: 250,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.t3,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "4px 8px 6px",
                  }}
                >
                  Portal Modules ({filteredNavItems.length})
                </div>
                {filteredNavItems.length === 0 ? (
                  <div style={{ padding: "10px 8px", fontSize: 12, color: C.t3 }}>
                    No matching modules found.
                  </div>
                ) : (
                  filteredNavItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNav(item.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "7px 8px",
                        border: "none",
                        background: "transparent",
                        borderRadius: 6,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "#F1F5F9";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.t1 }}>{item.label}</div>
                        {item.category && (
                          <div style={{ fontSize: 10.5, color: C.t3 }}>{item.category}</div>
                        )}
                      </div>
                      <ArrowUpRight size={13} color={C.t3} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Notification Bell */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            aria-label="Open notifications"
            onClick={() => setNotifOpen(true)}
            style={{
              background: notifOpen ? C.m50 : "transparent",
              border: "1px solid transparent",
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              position: "relative",
              transition: "background 0.2s",
            }}
          >
            <Bell size={17} color={notifOpen ? C.m700 : C.t2} />
            {unreadCount > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  background: C.red,
                  color: "#fff",
                  fontSize: 8,
                  fontWeight: 700,
                  borderRadius: 10,
                  width: 14,
                  height: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1.5px solid #fff",
                }}
              >
                {unreadCount}
              </div>
            )}
          </button>
          <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
        </div>
      </div>
    </header>
  );
}
