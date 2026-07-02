import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { SECTION_GRADES } from '../../shared/constants/seedData';
import { Stamp } from '../../shared/components/Stamp';

export function ClassGradeSummary({ onStudentClick }: { onStudentClick:(id:number)=>void }) {
  const [section, setSection] = useState(Object.keys(SECTION_GRADES)[0]);
  const rows = [...(SECTION_GRADES[section]||[])].filter(s => s.status !== "Passed").sort((a,b)=>{
    if(a.status==="Failing"&&b.status!=="Failing") return -1;
    if(b.status==="Failing"&&a.status!=="Failing") return 1;
    return a.avg-b.avg;
  });
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Students Needing Attention</div>
        <div style={{ display:"flex", gap:4 }}>
          {Object.keys(SECTION_GRADES).map(s=>(
            <button key={s} onClick={()=>setSection(s)}
              style={{ padding:"4px 11px", borderRadius:4, fontSize:11, fontWeight:section===s?700:400, cursor:"pointer", transition:"all 0.15s",
                border: section===s?`1.5px solid ${C.m700}`:`1px solid ${C.borderMed}`,
                background: section===s?C.m700:"#fff", color: section===s?"#fff":C.t2 }}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, overflow:"hidden" }}>
        {/* Header */}
        <div style={{ background:C.m800, display:"grid", gridTemplateColumns:"2fr 1fr 1fr 90px 90px", padding:"7px 14px", gap:16 }}>
          {["Student Name", "Missing Tasks", "Absences", "Gen. Avg", "Status"].map(h=>(
            <span key={h} style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.6)", textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</span>
          ))}
        </div>
        {rows.map((r,i)=>{
          const failing = r.status==="Failing";
          const atRisk = r.status==="At Risk";
          const rowBg = failing ? `${C.redBg}80` : atRisk ? `${C.amberBg}80` : i%2===0?"#fff":C.paper;
          const statusColor = failing ? C.red : C.amber;
          const statusBg = failing ? C.redBg : C.amberBg;
          return (
            <div key={r.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 90px 90px", padding:"8px 14px", borderBottom:`0.5px solid ${C.border}`, background:rowBg, alignItems:"center", gap:16 }}
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
              
              <div style={{ fontSize:11, fontWeight:500, color:C.t2 }}>{failing ? 3 + (r.id%3) : 1 + (r.id%2)} Missing tasks</div>
              <div style={{ fontSize:11, fontWeight:500, color:C.t2 }}>{failing ? 5 + (r.id%4) : 2 + (r.id%3)} Days absent</div>

              <span style={{ fontSize:14, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:statusColor }}>{r.avg.toFixed(1)}</span>
              <div><Stamp label={r.status} color={statusColor} bg={statusBg} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
