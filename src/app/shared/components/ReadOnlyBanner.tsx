import React from 'react';
import { Shield } from 'lucide-react';
import { C } from '../constants/tokens';

export function ReadOnlyBanner() {
  return (
    <div style={{ background:`${C.gold}15`, borderBottom:`1px solid ${C.gold}30`, padding:"8px 24px", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
      <Shield size={12} color={C.gold}/>
      <span style={{ fontSize:10, fontWeight:600, color:C.gold, textTransform:"uppercase", letterSpacing:"0.05em" }}>Principal Oversight Mode</span>
      <span style={{ fontSize:10, color:C.t2 }}>— You are viewing real-time dashboard data. Editing is disabled.</span>
    </div>
  );
}