import React, { useState } from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { C } from '../../shared/constants/tokens';
import { ROLE_USER } from '../../App';
import { NotificationDropdown } from '../../shared/components/NotificationDropdown';

export function PHeaderBand({ title, sub, onMenu, onLogout, onSettings }: { title:string; sub?:string; onMenu?:()=>void; onLogout?:()=>void; onSettings?:()=>void }) {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div style={{ background:"#fff", borderBottom:`2px solid ${C.m700}`, padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        {onMenu && (
          <button onClick={onMenu} style={{ background:"none", border:"none", cursor:"pointer", color:C.m700 }}>
            <span style={{ fontSize:18 }}>☰</span>
          </button>
        )}
        <div>
          <h1 style={{ fontSize:15, fontWeight:800, color:C.t1, fontFamily:"'Fraunces',serif", margin:0 }}>{title}</h1>
          {sub && <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", marginTop:2 }}>{sub}</div>}
        </div>
      </div>

      {/* Right Area: Search, Theme sun, Notification Bell & Profile dropdown */}
      {!onMenu && (
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Search bar mockup */}
          <div style={{ display: "flex", alignItems: "center", position: "relative", width: 220 }}>
            <Search size={13} color={C.t3} style={{ position: "absolute", left: 10 }} />
            <input 
              type="text" 
              placeholder="Search..." 
              style={{
                width: "100%",
                padding: "6px 12px 6px 30px",
                fontSize: 11,
                color: C.t1,
                background: C.m50,
                border: "1.5px solid " + C.borderMed,
                borderRadius: 20,
                outline: "none",
                transition: "all 0.15s"
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = C.m700;
                e.currentTarget.style.background = "#fff";
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = C.borderMed;
                e.currentTarget.style.background = C.m50;
              }}
            />
          </div>

          {/* Action buttons and Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>

            {/* Notification Bell */}
            <div style={{ position: "relative" }}>
              <button 
                onClick={() => setNotifOpen(true)}
                style={{
                  background: notifOpen ? C.m50 : "transparent",
                  border: "none",
                  borderRadius: 16,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  position: "relative",
                  transition: "background 0.2s"
                }}
              >
                <Bell size={18} color={notifOpen ? C.m700 : C.t2} />
                <div style={{
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
                  border: "1.5px solid #fff"
                }}>8</div>
              </button>
              <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>

            {/* User Profile display */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: `1px solid ${C.borderMed}`, paddingLeft: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, overflow: "hidden", background: C.m100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.m700 }}>
                {ROLE_USER.Principal.initials}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{ROLE_USER.Principal.name}</div>
                <div style={{ fontSize: 9, color: C.t3, marginTop: 1 }}>{ROLE_USER.Principal.sub}</div>
              </div>
              <ChevronDown size={12} color={C.t3} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}