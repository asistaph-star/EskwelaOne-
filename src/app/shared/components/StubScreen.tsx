import React from 'react';
import { C } from '../constants/tokens';

export function StubScreen({ icon: Icon, label, desc }: { icon: React.ElementType; label: string; desc: string }) {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, background:C.paper, padding:32, textAlign:"center" }}>
      <div style={{ width:64, height:64, borderRadius:32, background:`${C.m700}10`, display:"flex", alignItems:"center", justifyContent:"center", color:C.m700 }}>
        <Icon size={28} />
      </div>
      <div>
        <h3 style={{ fontSize:16, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:4 }}>{label}</h3>
        <p style={{ fontSize:12, color:C.t3, maxWidth:300, margin:"0 auto", lineHeight:1.5 }}>{desc}</p>
      </div>
    </div>
  );
}