import React from 'react';
import { C } from '../constants/tokens';

export function DocPanel({ title, icon:Icon, children, action }: {
  title:string, icon?:React.ElementType, children:React.ReactNode, action?:React.ReactNode
}) {
  return (
    <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:8, overflow:"hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
      <div style={{ background:"#fff", borderBottom: `1px solid ${C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", gap:8 }}>
        {Icon && <Icon size={15} color={C.m700} strokeWidth={2} />}
        <span style={{ color:C.t1, fontSize:13, fontWeight:700, fontFamily:"'Fraunces',serif", letterSpacing:"0.02em", flex:1 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
