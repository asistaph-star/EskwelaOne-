import { BookMarked } from 'lucide-react';
import { gradeColor } from '../../shared/utils/helpers';
import React from 'react';

import { C } from '../../shared/constants/tokens';
import { fa } from '../../shared/utils/helpers';

function Stamp({ label, color, bg }: { label:string; color:string; bg:string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, background: bg }}>
      {label}
    </span>
  );
}

const RC_SUBJECTS = [
  { name:"Filipino",                      short:"Filipino",  q1:85, q2:88, q3:86 },
  { name:"English",                       short:"English",   q1:88, q2:90, q3:87 },
  { name:"Mathematics",                   short:"Math",      q1:74, q2:78, q3:71 },
  { name:"Science",                       short:"Science",   q1:91, q2:93, q3:90 },
  { name:"Araling Panlipunan",            short:"A.P.",      q1:90, q2:92, q3:91 },
  { name:"Technology & Livelihood Educ.", short:"TLE",       q1:88, q2:90, q3:87 },
  { name:"MAPEH",                         short:"MAPEH",     q1:92, q2:94, q3:93 },
  { name:"Edukasyon sa Pagpapakatao",     short:"EsP",       q1:95, q2:96, q3:94 },
];

interface RCStudent {
  surname: string; first: string; lrn: string;
  grade: number; section: string; adviser: string;
  gender: string;
}

/* ─── Student Report Card (Form 138 style) ───────────────────── */
export function StudentReportCard({ student, compact=false }: { student: RCStudent, compact?:boolean }) {
  const subs = RC_SUBJECTS;
  function fa(sg:{q1:number,q2:number,q3:number}) { return Math.round((sg.q1+sg.q2+sg.q3)/3*10)/10; }

  const genAvg = Math.round(subs.reduce((s,sg)=>s+fa(sg),0)/subs.length*10)/10;
  const allPassed = subs.every(sg=>fa(sg)>=75);
  /* no trend chart — spec explicitly excludes it */

  return (
    <div style={{ background:"#fff", fontFamily:"'Inter',sans-serif" }}>

      {/* ── Document header band ── */}
      <div style={{ background:C.m800, padding:"10px 24px", display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ width:40, height:40, borderRadius:8, background:"rgba(232,160,32,0.18)", border:`1.5px solid rgba(232,160,32,0.45)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <BookMarked size={18} color={C.gold} strokeWidth={2} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ color:"rgba(255,255,255,0.55)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:2 }}>Republic of the Philippines · Department of Education · Region III</div>
          <div style={{ color:"#fff", fontSize:15, fontWeight:700, fontFamily:"'Fraunces',serif", lineHeight:1.2 }}>Sindalan National High School</div>
          <div style={{ color:"rgba(255,255,255,0.55)", fontSize:10, marginTop:1 }}>Sindalan, City of San Fernando, Pampanga · Division of San Fernando City</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"rgba(255,255,255,0.45)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.09em" }}>Form 138</div>
          <div style={{ color:C.gold, fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif" }}>Student Report Card</div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:10 }}>SY 2025–2026</div>
        </div>
      </div>

      {/* ── Student info block ── */}
      <div style={{ borderBottom:`2px solid ${C.m700}`, padding:"12px 24px", background:C.m50 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px 20px" }}>
          {[
            ["Full Name", `${student.surname}, ${student.first}`],
            ["Grade & Section", `Grade ${student.grade} — ${student.section}`],
            ["School Year", "SY 2025–2026"],
            ["LRN", student.lrn],
            ["Gender", student.gender === "male" ? "Male" : "Female"],
            ["Adviser", student.adviser],
          ].map(([l,v]) => (
            <div key={l} style={{ borderBottom:`0.5px solid ${C.borderMed}`, paddingBottom:5 }}>
              <div style={{ fontSize:8, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>{l}</div>
              <div style={{ fontSize:12, fontWeight:600, color:C.t1, fontFamily:l==="LRN"?"'JetBrains Mono',monospace":undefined }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main grades table (full width, no sidebar chart) ── */}
      <div style={{ borderBottom:`1px solid ${C.borderMed}` }}>
        <div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <colgroup>
              <col/><col style={{ width:52 }}/><col style={{ width:52 }}/><col style={{ width:52 }}/>
              <col style={{ width:66 }}/><col style={{ width:70 }}/>
            </colgroup>
            <thead>
              <tr style={{ background:C.m700 }}>
                <th style={{ textAlign:"left", padding:"8px 16px", fontSize:9, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.09em" }}>Learning Area</th>
                {["Q1","Q2","Q3"].map(q=>(
                  <th key={q} style={{ textAlign:"center", padding:"8px 4px", fontSize:9, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.07em", borderLeft:`0.5px solid rgba(255,255,255,0.15)` }}>{q}</th>
                ))}
                <th style={{ textAlign:"center", padding:"8px 6px", fontSize:9, fontWeight:700, color:C.gold, textTransform:"uppercase", letterSpacing:"0.07em", borderLeft:`1px solid rgba(255,255,255,0.25)` }}>Final Avg</th>
                <th style={{ textAlign:"center", padding:"8px 6px", fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.8)", textTransform:"uppercase", letterSpacing:"0.07em", borderLeft:`0.5px solid rgba(255,255,255,0.15)` }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sg,i)=>{
                const avg = fa(sg);
                const passed = avg>=75;
                return (
                  <tr key={sg.name}
                    style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                    <td style={{ padding:"9px 16px" }}>
                      <div style={{ fontSize:12, fontWeight:600, color:C.t1 }}>{sg.name}</div>
                    </td>
                    {[sg.q1,sg.q2,sg.q3].map((g,j)=>(
                      <td key={j} style={{ textAlign:"center", padding:"9px 4px", borderLeft:`0.5px solid ${C.border}` }}>
                        <span style={gradeColor(g)}>{g}</span>
                      </td>
                    ))}
                    {/* Final average — slightly emphasized */}
                    <td style={{ textAlign:"center", padding:"9px 6px", borderLeft:`1px solid ${C.borderMed}`, background:passed?"#fff":C.redBg }}>
                      <span style={{ fontSize:14, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:avg<75?C.red:avg>=90?C.green:C.t1 }}>
                        {avg.toFixed(1)}
                      </span>
                    </td>
                    {/* Remarks stamp */}
                    <td style={{ textAlign:"center", padding:"9px 6px", borderLeft:`0.5px solid ${C.border}` }}>
                      <Stamp label={passed?"PASSED":"FAILED"} color={passed?"#fff":C.red} bg={passed?C.green:C.redBg} />
                    </td>
                  </tr>
                );
              })}

              {/* General Average row */}
              <tr style={{ background:C.m800, borderTop:`2px solid ${C.m700}` }}>
                <td style={{ padding:"11px 16px" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#fff", fontFamily:"'Fraunces',serif", textTransform:"uppercase", letterSpacing:"0.06em" }}>General Average</span>
                </td>
                {[
                  Math.round(subs.reduce((s,sg)=>s+sg.q1,0)/subs.length*10)/10,
                  Math.round(subs.reduce((s,sg)=>s+sg.q2,0)/subs.length*10)/10,
                  Math.round(subs.reduce((s,sg)=>s+sg.q3,0)/subs.length*10)/10,
                ].map((avg,j)=>(
                  <td key={j} style={{ textAlign:"center", padding:"11px 4px", borderLeft:`0.5px solid rgba(255,255,255,0.15)` }}>
                    <span style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.7)", fontFamily:"'JetBrains Mono',monospace" }}>{avg.toFixed(1)}</span>
                  </td>
                ))}
                {/* The big General Average stamp */}
                <td colSpan={2} style={{ padding:"8px 10px", borderLeft:`1px solid rgba(255,255,255,0.25)` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"center" }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:2 }}>Final</div>
                      <div style={{ fontSize:26, fontWeight:800, color:allPassed?C.gold:"#f87171", fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1 }}>{genAvg.toFixed(1)}</div>
                    </div>
                    <div style={{ width:1, height:32, background:"rgba(255,255,255,0.15)" }}/>
                    <div>
                      <Stamp label={allPassed?"PROMOTED":"RETAINED"} color={allPassed?C.m900:"#fff"} bg={allPassed?C.gold:C.red} />
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Certification & signatures ── */}
      <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.borderMed}`, background:C.paper }}>
        <div style={{ fontSize:10, color:C.t2, marginBottom:14, fontStyle:"italic" }}>
          I certify that the above report is a true record of the academic performance of the learner named.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:24 }}>
          {[["Prepared by","Ana R. Soriano","Class Adviser"],["Noted by","Dr. Maria Santos","Principal"],["Parent/Guardian",`(Signature over printed name)`,""]] .map(([lbl,name,role])=>(
            <div key={lbl}>
              <div style={{ fontSize:9, color:C.t3, marginBottom:16 }}>{lbl}:</div>
              <div style={{ borderTop:`1px solid ${C.t1}`, paddingTop:5 }}>
                <div style={{ fontSize:11, fontWeight:600, color:C.t1 }}>{name}</div>
                {role && <div style={{ fontSize:10, color:C.t3 }}>{role}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Student Portal ────────────────────────────────────────── */