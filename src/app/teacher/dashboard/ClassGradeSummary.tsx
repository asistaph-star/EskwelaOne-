import React from 'react';
import { C } from '../../shared/constants/tokens';

export function ClassGradeSummary({ onStudentClick }: { onStudentClick:(id:number)=>void }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Students Needing Attention</div>
      </div>
      <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", boxShadow: "0 6px 20px rgba(139,30,30,0.06)", padding: "40px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: C.t3, fontWeight: 500 }}>
          Student Analytics Coming Soon
        </div>
        <div style={{ fontSize: 11, color: C.t4, marginTop: 8 }}>
          Advanced at-risk identification and analytics will be available in a future phase.
        </div>
      </div>
    </div>
  );
}
