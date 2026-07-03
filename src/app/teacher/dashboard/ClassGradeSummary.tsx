import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { SECTION_GRADES } from '../../shared/constants/seedData';
import { Stamp } from '../../shared/components/Stamp';

export function ClassGradeSummary({ onStudentClick }: { onStudentClick:(id:number)=>void }) {
  // Aggregate students across all sections
  const rows = Object.entries(SECTION_GRADES).flatMap(([section, students]) => students.map(s => ({ ...s, section }))).filter(s => s.status !== "Passed").sort((a,b)=>{
    if(a.status==="Failing"&&b.status!=="Failing") return -1;
    if(b.status==="Failing"&&a.status!=="Failing") return 1;
    return a.avg-b.avg;
  });
  
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Students Needing Attention</div>
      </div>
      <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", boxShadow: "0 6px 20px rgba(139,30,30,0.06)" }}>
        {/* Header */}
        <div style={{ background:"#fafafa", borderBottom: `1px solid ${C.border}`, display:"grid", gridTemplateColumns:"2fr 1.5fr 1fr 1fr 90px 90px", padding:"6px 12px", gap:12 }}>
          {["Student Name", "Section", "Missing Tasks", "Absences", "Gen. Avg", "Status"].map(h=>(
            <span key={h} style={{ fontSize:9, fontWeight:800, color:C.t3, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</span>
          ))}
        </div>
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {rows.map((r,i)=>{
            const failing = r.status==="Failing";
            const atRisk = r.status==="At Risk";
            const rowBg = failing ? `${C.redBg}80` : atRisk ? `${C.amberBg}80` : i%2===0?"#fff":C.paper;
            const statusColor = failing ? C.red : C.amber;
            const statusBg = failing ? C.redBg : C.amberBg;
            return (
              <div key={r.id} style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 1fr 1fr 90px 90px", padding:"4px 12px", borderBottom:`0.5px solid ${C.border}`, background:rowBg, alignItems:"center", gap:12 }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=failing?`${C.redBg}AA`:atRisk?`${C.amberBg}AA`:C.m50;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=rowBg;}}>
                <button onClick={()=>onStudentClick(r.id)} style={{ background:"none", border:"none", cursor:"pointer", textAlign:"left", padding:0, display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:6, height:6, borderRadius:3, background:statusColor, flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:600, color:statusColor, textDecoration:"underline", textDecorationColor:"transparent" }}
                    onMouseEnter={e=>{(e.target as HTMLElement).style.textDecorationColor=statusColor;}}
                    onMouseLeave={e=>{(e.target as HTMLElement).style.textDecorationColor="transparent";}}>
                    {r.surname}, {r.first}
                  </span>
              </button>
              
              <div style={{ fontSize:11, fontWeight:600, color:C.t2 }}>{r.section}</div>
              <div style={{ fontSize:11, fontWeight:500, color:C.t2 }}>{failing ? 3 + (r.id%3) : 1 + (r.id%2)} Missing tasks</div>
              <div style={{ fontSize:11, fontWeight:500, color:C.t2 }}>{failing ? 5 + (r.id%4) : 2 + (r.id%3)} Days absent</div>

              <span style={{ fontSize:13, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:statusColor }}>{r.avg.toFixed(1)}</span>
              <div><Stamp label={r.status} color={statusColor} bg={statusBg} /></div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
