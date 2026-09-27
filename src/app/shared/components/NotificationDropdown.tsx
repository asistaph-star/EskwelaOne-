import React, { useRef, useEffect } from 'react';
import { C } from '../constants/tokens';
import { Bell, AlertCircle, Megaphone, Calendar as CalendarIcon } from 'lucide-react';
import { useAppContext } from '../AppContext';

export function NotificationDropdown({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { notifications, currentUser, markNotificationsRead, markSingleNotificationRead } = useAppContext();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }
      onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  
  const myNotifications = notifications
    .filter(n => n.recipientId === currentUser?.id)
    .sort((a, b) => b.id.localeCompare(a.id));

  const unreadCount = myNotifications.filter(n => !n.isRead).length;

  const handleNotificationClick = (notif: any) => {
    // 1. Mark as read if it isn't
    if (!notif.isRead && markSingleNotificationRead) {
      markSingleNotificationRead(notif.id);
    }
    
    // 2. Close dropdown
    onClose();

    // 3. Determine routing based on user role and notification content
    if (!currentUser) return;
    const roleStr = currentUser.role.toLowerCase();
    const title = notif.title.toLowerCase();
    
    let destScreen = 'dashboard';
    
    if (title.includes('announcement') || notif.iconType === 'megaphone') {
      if (roleStr === 'principal') destScreen = 'p-announcements';
      else if (roleStr === 'admin') destScreen = 'a-announcements';
      else destScreen = 'announcements';
    } else if (title.includes('appointment')) {
      if (roleStr === 'principal') destScreen = 'p-dashboard';
      else destScreen = 'appointments';
    } else if (title.includes('document')) {
      if (roleStr === 'principal') destScreen = 'p-doc-requests';
      else if (roleStr === 'registrar') destScreen = 'r-doc-requests';
      else destScreen = 'doc-requests';
    } else if (title.includes('leave')) {
      if (roleStr === 'principal') destScreen = 'p-leaves';
      else destScreen = 'leave-requests';
    } else if (title.includes('enrollment')) {
      if (roleStr === 'registrar') destScreen = 'r-enrollment';
    }
    
    if (destScreen === 'dashboard') {
      if (roleStr === 'principal') destScreen = 'p-dashboard';
      else if (roleStr === 'admin') destScreen = 'a-dashboard';
      else if (roleStr === 'registrar') destScreen = 'r-dashboard';
      else if (roleStr === 'guidance') destScreen = 'g-dashboard';
    }
    
    window.location.hash = `#/${roleStr}/${destScreen}`;
  };

  return (
    <div ref={dropdownRef}>
      <style>{`
        .notif-item {
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .notif-item:hover {
          background: #f9f9f9 !important;
        }
        .notif-item.unread:hover {
          background: rgba(139,30,30,0.06) !important;
        }
        .notif-arrow {
          position: absolute;
          top: -6px;
          right: 18px;
          width: 12px;
          height: 12px;
          background: ${C.paper};
          transform: rotate(45deg);
          border-left: 1px solid ${C.borderMed};
          border-top: 1px solid ${C.borderMed};
          z-index: 201;
        }
        @keyframes popIn {
          0% { opacity: 0; transform: translateY(8px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      
      <div 
        style={{ 
          position: 'absolute', 
          top: '100%', 
          right: -10, 
          marginTop: 14, 
          width: 360, 
          background: '#fff', 
          borderRadius: 12, 
          boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 2px 10px rgba(0,0,0,0.05)', 
          border: `1px solid ${C.borderMed}`, 
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left',
          animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div className="notif-arrow" />
        
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderMed}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.paper, borderTopLeftRadius: 12, borderTopRightRadius: 12, position: "relative", zIndex: 202 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={16} color={C.m700} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif" }}>Notifications {unreadCount > 0 && `(${unreadCount})`}</h3>
          </div>
          {unreadCount > 0 && (
            <span onClick={() => currentUser && markNotificationsRead(currentUser.id)} style={{ fontSize: 11, color: C.m700, fontWeight: 700, cursor: 'pointer' }}>Mark all read</span>
          )}
        </div>
        
        <div style={{ maxHeight: 380, overflowY: 'auto', position: "relative", zIndex: 202, background: "#fff" }}>
          
          {myNotifications.length === 0 ? (
             <div style={{ padding: '24px 20px', textAlign: 'center', color: C.t3, fontSize: 12 }}>No new notifications</div>
          ) : (
            myNotifications.map((notif) => (
              <div 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif)}
                className={!notif.isRead ? "notif-item unread" : "notif-item"} 
                style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', gap: 14, background: !notif.isRead ? 'rgba(139,30,30,0.03)' : 'transparent' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 18, background: notif.iconType === "alert" ? C.redBg : notif.iconType === "document" ? C.blueBg : C.greenBg, border: `1px solid rgba(0,0,0,0.05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {notif.iconType === "alert" ? <AlertCircle size={16} color={C.red} /> : notif.iconType === "document" ? <AlertCircle size={16} color={C.blue} /> : <Megaphone size={16} color={C.green} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: !notif.isRead ? 800 : 700, color: C.t1 }}>{notif.title}</div>
                    {!notif.isRead && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.m700, marginTop: 4 }} />}
                  </div>
                  <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.4, marginBottom: 6 }}>{notif.body}</div>
                  <div style={{ fontSize: 10, color: C.t3, fontWeight: 600 }}>{notif.timestamp}</div>
                </div>
              </div>
            ))
          )}
          
        </div>
        
        <div 
          className="notif-item"
          style={{ padding: 14, textAlign: 'center', borderTop: `1px solid ${C.borderMed}`, background: '#fafafa', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, position: "relative", zIndex: 202 }}
        >
          <span style={{ fontSize: 12, fontWeight: 800, color: C.m700 }}>View All Notifications</span>
        </div>
      </div>
    </div>
  );
}