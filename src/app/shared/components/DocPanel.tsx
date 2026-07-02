import React from 'react';
import { C } from '../constants/tokens';

export function DocPanel({ title, icon:Icon, children, action }: {
  title:string, icon?:React.ElementType, children:React.ReactNode, action?:React.ReactNode
}) {
  return (
    <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, overflow:"hidden" }}>
      <div style={{ background:C.m800, padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
        {Icon && <Icon size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} />}
        <span style={{ color:"#fff", fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif", letterSpacing:"0.04em", flex:1 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
