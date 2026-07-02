import React from 'react';
import { C } from '../constants/tokens';

export function StatBox({ label, value, sub, accent }: { label:string, value:string|number, sub?:string, accent:string }) {
  return (
    <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"14px 16px", borderTop:`3px solid ${accent}` }}>
      <div style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:700, color:C.t1, lineHeight:1, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.t3, marginTop:5 }}>{sub}</div>}
    </div>
  );
}
