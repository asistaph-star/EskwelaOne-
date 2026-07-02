import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { PTableHeader } from '../shared/PTableHeader';
import { teacherTraffic } from '../../shared/utils/helpers';
import { P_TEACHERS } from '../../shared/constants/seedData';
import { Stamp } from '../../shared/components/Stamp';
export function PTeachers() {
  return (
    <div style={{ flex:1, overflowY:"auto", background:C.paper, padding:24 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
        {/* Faculty attendance today */}
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
          <div style={{ background:C.m800, padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color:"#fff", fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif", flex:1 }}>Faculty Attendance Today</span>
            {[["18","Present",C.green],["0","Absent",C.red],["2","Late",C.amber]].map(([v,l,c])=>(
              <span key={l} style={{ fontSize:10, color:"rgba(255,255,255,0.7)", marginLeft:10 }}><span style={{ fontWeight:700, color:"#fff" }}>{v}</span> {l}</span>
            ))}
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><PTableHeader cols={["Teacher","Rank","Status","Time In"]} /></thead>
            <tbody>
              {P_TEACHERS.map((t,i)=>{
                const statuses = ["Present","Present","Late","Present","Present","Late","Present","Present"];
                const times = ["7:05","7:08","7:42","7:10","7:07","7:38","7:12","7:09"];
                const s = statuses[i], time = times[i];
                return (
                  <tr key={t.name} style={{ borderBottom:`0.5px solid ${C.border}` }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                    <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{t.name}</td>
                    <td style={{ padding:"9px 14px", fontSize:10, color:C.t3 }}>{t.rank}</td>
                    <td style={{ padding:"9px 14px" }}><Stamp label={s} color={s==="Present"?C.green:s==="Late"?C.amber:C.red} bg={s==="Present"?C.greenBg:s==="Late"?C.amberBg:C.redBg} /></td>
                    <td style={{ padding:"9px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{time} AM</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Promotion tracker */}
        <div>
          <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:12 }}>
            <div style={{ background:C.m800, padding:"10px 16px" }}>
              <span style={{ color:"#fff", fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif" }}>DepEd Rank Distribution</span>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><PTableHeader cols={["Rank","Count"]} /></thead>
              <tbody>
                {[["Teacher I","3"],["Teacher II","4"],["Teacher III","3"],["Master Teacher I","1"],["Master Teacher II","1"]].map(([r,c],i)=>(
                  <tr key={r} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                    <td style={{ padding:"9px 14px", fontSize:12, color:C.t1 }}>{r}</td>
                    <td style={{ padding:"9px 14px", fontSize:14, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:C.m700 }}>{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
            <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Promotion Eligibility</div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><PTableHeader cols={["Teacher","Rank","Years","Status"]} /></thead>
              <tbody>
                {P_TEACHERS.map((t,i)=>{
                  const tr = teacherTraffic(t.status);
                  return (
                    <tr key={t.name} style={{ borderBottom:i<P_TEACHERS.length-1?`0.5px solid ${C.border}`:"none" }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                      <td style={{ padding:"8px 14px", fontSize:11, fontWeight:600, color:C.t1 }}>{t.name}</td>
                      <td style={{ padding:"8px 14px", fontSize:10, color:C.t3 }}>{t.rank}</td>
                      <td style={{ padding:"8px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.t2 }}>{t.years}</td>
                      <td style={{ padding:"8px 14px" }}><Stamp label={tr.label} color={tr.color} bg={tr.bg} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Subject load */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
        <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Subject Load Monitoring</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><PTableHeader cols={["Teacher","Sections","Subjects","Total Load"]} /></thead>
          <tbody>
            {P_TEACHERS.map((t,i)=>(
              <tr key={t.name} style={{ borderBottom:i<P_TEACHERS.length-1?`0.5px solid ${C.border}`:"none" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{t.name}</td>
                <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>{t.sections.join(", ")}</td>
                <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>{t.subjects.join(", ")}</td>
                <td style={{ padding:"9px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.m700, fontWeight:600 }}>{t.sections.length * 5}h/wk</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══ SCREEN 5 — Student Welfare ══ */