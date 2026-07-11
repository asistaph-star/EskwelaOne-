import React from 'react';
import { C } from '../constants/tokens';

export function DocPanel({ title, icon:Icon, children, action, style }: {
  title:string, icon?:React.ElementType, children:React.ReactNode, action?:React.ReactNode, style?:React.CSSProperties
}) {
  return (
    <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", boxShadow: "0 6px 20px rgba(139,30,30,0.06)", ...style }}>
      <div style={{ background:"#fff", borderBottom: `1px solid ${C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", gap:8 }}>
        {Icon && <Icon size={15} color={C.m700} strokeWidth={2} />}
        <span style={{ color:C.t1, fontSize:13, fontWeight:700, fontFamily:"'Fraunces',serif", letterSpacing:"0.02em", flex:1 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
