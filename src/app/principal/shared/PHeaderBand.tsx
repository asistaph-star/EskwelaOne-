import React from 'react';
import { LogOut, Settings } from 'lucide-react';
import { C } from '../../shared/constants/tokens';

export function PHeaderBand({ title, sub, onMenu, onLogout, onSettings }: { title:string; sub?:string; onMenu?:()=>void; onLogout?:()=>void; onSettings?:()=>void }) {
  return (
    <div style={{ background:"#fff", borderBottom:`2px solid ${C.m700}`, padding:"0 24px", height:56, display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
      {onMenu && (
        <button onClick={onMenu} style={{ background:"none", border:"none", cursor:"pointer", color:C.m700 }}>
          <span style={{ fontSize:18 }}>☰</span>
        </button>
      )}
      <div style={{ flex:1 }}>
        <h1 style={{ fontSize:15, fontWeight:800, color:C.t1, fontFamily:"'Fraunces',serif" }}>{title}</h1>
        {sub && <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}