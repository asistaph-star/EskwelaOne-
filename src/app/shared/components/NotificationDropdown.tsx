import React from 'react';
import { C } from '../constants/tokens';
import { Bell } from 'lucide-react';

export function NotificationDropdown({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <>
      <div 
        onClick={onClose} 
        style={{ position: 'fixed', inset: 0, zIndex: 199 }} 
      />
      <div 
        style={{ 
          position: 'absolute', 
          top: '100%', 
          right: -10, 
          marginTop: 12, 
          width: 320, 
          background: '#fff', 
          borderRadius: 12, 
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', 
          border: `1px solid ${C.borderMed}`, 
          zIndex: 200,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left'
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderMed}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.m50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={16} color={C.m700} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Notifications</h3>
          </div>
          <span style={{ fontSize: 11, color: C.m700, fontWeight: 700, cursor: 'pointer' }}>Mark all read</span>
        </div>
        
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {/* Notification Items */}
          <div style={{ padding: 16, borderBottom: `1px solid ${C.borderLight}`, display: 'flex', gap: 12, background: 'rgba(139,30,30,0.03)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: C.m700, marginTop: 4, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginBottom: 4 }}>System Maintenance</div>
              <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.4 }}>The portal will be undergoing scheduled maintenance this weekend from 10 PM to 2 AM.</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 6 }}>2 hours ago</div>
            </div>
          </div>
          <div style={{ padding: 16, borderBottom: `1px solid ${C.borderLight}`, display: 'flex', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: 'transparent', marginTop: 4, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginBottom: 4 }}>New Announcement</div>
              <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.4 }}>Q1 Grading deadline has been extended to Jun 16.</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 6 }}>1 day ago</div>
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: 'transparent', marginTop: 4, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Welcome to EskwelaOne+</div>
              <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.4 }}>Explore the new features available in your dashboard.</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 6 }}>3 days ago</div>
            </div>
          </div>
        </div>
        
        <div style={{ padding: 12, textAlign: 'center', borderTop: `1px solid ${C.borderMed}`, background: '#fafafa', cursor: 'pointer' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.m700 }}>View All Notifications</span>
        </div>
      </div>
    </>
  );
}
