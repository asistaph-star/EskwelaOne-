import React from 'react';
import { C } from '../constants/tokens';
import { Bell, AlertCircle, Megaphone, Calendar as CalendarIcon } from 'lucide-react';
import { useAppContext } from '../AppContext';

export function NotificationDropdown({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { notifications, currentUser, markNotificationsRead } = useAppContext();
  if (!isOpen) return null;
  
  const myNotifications = notifications
    .filter(n => n.recipientId === currentUser?.id)
    .sort((a, b) => b.id.localeCompare(a.id)); // sort by timestamp/id descending

  const unreadCount = myNotifications.filter(n => !n.isRead).length;

  return (
    <>
      <style>{`
        .notif-item {
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .notif-item:hover {
          background: #f9f9f9;
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
        onClick={onClose} 
        style={{ position: 'fixed', inset: 0, zIndex: 199 }} 
      />
      
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
              <div key={notif.id} className={!notif.isRead ? "notif-item unread" : "notif-item"} style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', gap: 14, background: !notif.isRead ? 'rgba(139,30,30,0.03)' : 'transparent' }}>
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
    </>
  );
}
