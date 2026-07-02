import React from 'react';
import { C } from '../../shared/constants/tokens';
import { PTableHeader } from '../shared/PTableHeader';
import { P_WELFARE } from '../../shared/constants/seedData';
import { Stamp } from '../../shared/components/Stamp';
export function PWelfare() {
  return (
    <div style={{ flex:1, overflowY:"auto", background:C.paper, padding:24 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
        {/* Behavior */}
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
          <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Behavior Incidents</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><PTableHeader cols={["Student","Section","Type","Date","Status"]} /></thead>
            <tbody>
              {[["Ocampo, Renz A.","10-Pilot","Misconduct","Jun 10","Under investigation"],["Reyes, Carlo J.","9-Einstein","Tardiness","Jun 9","Warning issued"],["Bautista, Ryan P.","10-Pilot","Disruption","Jun 8","Parent notified"],["Bondoc, Ramon Jr.","8-Rizal","Truancy","Jun 7","Counseling"]].map(([n,s,t,d,st],i)=>(
                <tr key={n} style={{ borderBottom:i<3?`0.5px solid ${C.border}`:"none" }}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{n}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t3 }}>{s}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t2 }}>{t}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{d}</td>
                  <td style={{ padding:"9px 14px" }}><Stamp label={st} color={C.amber} bg={C.amberBg} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Guidance */}
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
          <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Guidance Referrals</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><PTableHeader cols={["Student","Referred By","Reason","Date","Status"]} /></thead>
            <tbody>
              {[["Espino, Hannah G.","Soriano, A.","Attendance","Jun 9","Pending"],["Bondoc, Ramon Jr.","Soriano, A.","Academic","Jun 7","Counseling"],["Torres, Bea A.","Santiago, R.","Family issue","Jun 5","Follow-up"]].map(([n,r,re,d,st],i)=>(
                <tr key={n} style={{ borderBottom:i<2?`0.5px solid ${C.border}`:"none" }}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{n}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t2 }}>{r}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t2 }}>{re}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{d}</td>
                  <td style={{ padding:"9px 14px" }}><Stamp label={st} color={C.blue} bg={C.blueBg} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Clinic + Intervention */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
          <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Clinic Visits</span>
            <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:C.teal }}>6 today · 18 this week</span>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><PTableHeader cols={["Student","Date","Reason","Returned"]} /></thead>
            <tbody>
              {[["Reyes, Carlo J.","Jun 10 9:14","Headache","Yes"],["Mendoza, Lea G.","Jun 10 10:02","Stomach ache","No"],["Santos, Juan M.","Jun 9 2:30","Cuts (PE)","Yes"],["Torres, Bea A.","Jun 8 11:20","Fever","No"]].map(([n,d,r,ret],i)=>(
                <tr key={n} style={{ borderBottom:i<3?`0.5px solid ${C.border}`:"none" }}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{n}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{d}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t2 }}>{r}</td>
                  <td style={{ padding:"9px 14px" }}><Stamp label={ret} color={ret==="Yes"?C.green:C.red} bg={ret==="Yes"?C.greenBg:C.redBg} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
          <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Students Requiring Intervention</div>
          {P_WELFARE.map((w,i)=>(
            <div key={w.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:i<P_WELFARE.length-1?`0.5px solid ${C.border}`:"none", background:w.urgency==="urgent"?`${C.redBg}50`:`${C.amberBg}40` }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:w.urgency==="urgent"?C.red:C.amber }}>{w.name}</div>
                <div style={{ fontSize:10, color:C.t3 }}>{w.section} · {w.reason}</div>
              </div>
              <Stamp label={w.urgency==="urgent"?"URGENT":"MONITORING"} color={w.urgency==="urgent"?"#fff":C.amber} bg={w.urgency==="urgent"?C.red:C.amberBg} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══ SCREEN 6 — Inventory ══ */