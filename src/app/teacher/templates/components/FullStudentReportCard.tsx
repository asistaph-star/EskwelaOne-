import React, { useState } from 'react';
import { C } from '../../../shared/constants/tokens';
import { GradeLevel, CurriculumType, GradeRecord } from '../../../shared/types';
import { FULL_ACADEMIC_HISTORY } from '../TemplateHubScreen';
import { gradeAvg, gradeColor } from '../../../shared/utils/helpers';
import { BookMarked, Printer, Download } from 'lucide-react';
import { Stamp } from '../../../shared/components/Stamp';
export function FullStudentReportCard({ student }: { student?: { name:string; lrn:string; grade:number; section:string; adviser:string } }) {
  const s = student ?? { name:"Santos, Juan Miguel", lrn:"100001", grade:10, section:"Pilot", adviser:"Ana R. Soriano" };
  const [focusLevel, setFocusLevel] = useState<GradeLevel>("gr10");
  const [printMode, setPrintMode]   = useState(false);

  const LEVELS: {key:GradeLevel; label:string; sy:string; curriculum:CurriculumType; color:string}[] = [
    { key:"gr7",  label:"Grade 7",  sy:"SY 2022–2023", curriculum:"old", color:"#166534" },
    { key:"gr8",  label:"Grade 8",  sy:"SY 2023–2024", curriculum:"new", color:"#92400E" },
    { key:"gr9",  label:"Grade 9",  sy:"SY 2024–2025", curriculum:"new", color:"#1E3A8A" },
    { key:"gr10", label:"Grade 10", sy:"SY 2025–2026", curriculum:"new", color:"#4C1D95" },
  ];
  const focused = LEVELS.find(l=>l.key===focusLevel)!;

  function LevelAvg(key:GradeLevel) {
    const vals = FULL_ACADEMIC_HISTORY.map(sg=>gradeAvg(sg[key])).filter(v=>v>0);
    return vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : 0;
  }

  function QHeaders(curriculum:CurriculumType) {
    return curriculum==="old"
      ? ["Q1","Q2","Q3","Q4"]
      : ["Q1","Q2","Q3"];
  }

  function QVals(rec?:GradeRecord): number[] {
    if(!rec) return [];
    return rec.curriculum==="old" ? [rec.q1,rec.q2,rec.q3,rec.q4!] : [rec.q1,rec.q2,rec.q3];
  }

  const focusedRec = FULL_ACADEMIC_HISTORY.map(sg=>sg[focusLevel]);
  const focusGenAvg = LevelAvg(focusLevel);
  const focusPassed = focusGenAvg>=75;

  return (
    <div style={{ background:"#fff", fontFamily:"'Inter',sans-serif", maxWidth:900, margin:"0 auto" }}>

      {/* ── Official document header ── */}
      <div style={{ background:C.m800, padding:"10px 24px", display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ width:40, height:40, borderRadius:8, background:"rgba(232,160,32,0.18)", border:`1.5px solid rgba(232,160,32,0.45)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <BookMarked size={18} color={C.gold} strokeWidth={2} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:2 }}>Republic of the Philippines · Department of Education · Region III</div>
          <div style={{ color:"#fff", fontSize:15, fontWeight:700, fontFamily:"'Fraunces',serif" }}>Information and Communication Technology High School</div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:10 }}>Sindalan, City of San Fernando, Pampanga</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"rgba(255,255,255,0.45)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Form 138</div>
          <div style={{ color:C.gold, fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif" }}>Student Report Card</div>
        </div>
      </div>

      {/* ── Student info ── */}
      <div style={{ borderBottom:`2px solid ${C.m700}`, padding:"10px 24px", background:C.m50 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"6px 20px" }}>
          {[["Full Name",s.name],["LRN",s.lrn],["Grade & Section",`Grade ${s.grade} - ${s.section}`],["Adviser",s.adviser],["School","Information and Communication Technology High School"],["School Year","SY 2025–2026"]].map(([l,v])=>(
            <div key={l} style={{ borderBottom:`0.5px solid ${C.borderMed}`, paddingBottom:4 }}>
              <div style={{ fontSize:8, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:1 }}>{l}</div>
              <div style={{ fontSize:12, fontWeight:600, color:C.t1, fontFamily:l==="LRN"?"'JetBrains Mono',monospace":undefined }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Grade level tabs ── */}
      <div style={{ padding:"10px 24px 0", borderBottom:`1px solid ${C.borderMed}`, background:"#fff", display:"flex", gap:3, alignItems:"flex-end" }}>
        {LEVELS.map(lv=>{
          const isAct = focusLevel===lv.key;
          const avg   = LevelAvg(lv.key);
          const pass  = avg>=75;
          return (
            <button key={lv.key} onClick={()=>setFocusLevel(lv.key)}
              style={{ padding:"8px 16px 10px", borderRadius:"4px 4px 0 0", cursor:"pointer", border:`1px solid ${isAct?lv.color:C.borderMed}`, borderBottom:isAct?"1px solid #fff":"none", marginBottom:isAct?-1:0, background:isAct?"#fff":C.paper, transition:"all 0.12s" }}>
              <div style={{ fontSize:11, fontWeight:isAct?700:500, color:isAct?lv.color:C.t2 }}>{lv.label}</div>
              <div style={{ fontSize:9, color:C.t3 }}>{lv.sy}</div>
              {avg>0 && <div style={{ fontSize:10, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:pass?lv.color:C.red, marginTop:2 }}>{avg.toFixed(1)}</div>}
            </button>
          );
        })}
        <div style={{ marginLeft:"auto", paddingBottom:8, display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:9, padding:"2px 8px", borderRadius:20, background:focused.curriculum==="old"?C.amberBg:C.blueBg, color:focused.curriculum==="old"?C.amber:C.blue, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>
            {focused.curriculum==="old"?"Old Curriculum (Q1–Q4)":"New Curriculum (Q1–Q3)"}
          </span>
          <button onClick={()=>setPrintMode(p=>!p)} style={{ fontSize:10, fontWeight:600, color:C.m700, background:C.m100, border:`1px solid rgba(139,30,30,0.2)`, borderRadius:4, padding:"4px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
            <Printer size={11}/> Print
          </button>
        </div>
      </div>

      {/* ── Grades table for the focused grade level ── */}
      <div style={{ borderBottom:`1px solid ${C.borderMed}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <colgroup>
            <col/>
            {QHeaders(focused.curriculum).map((_,i)=><col key={i} style={{ width:52 }}/>)}
            <col style={{ width:72 }}/>
            <col style={{ width:72 }}/>
          </colgroup>
          <thead>
            <tr style={{ background:focused.color }}>
              <th style={{ textAlign:"left", padding:"8px 16px", fontSize:9, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.09em" }}>Learning Area</th>
              {QHeaders(focused.curriculum).map(q=>(
                <th key={q} style={{ textAlign:"center", padding:"8px 4px", fontSize:9, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.07em", borderLeft:`0.5px solid rgba(255,255,255,0.15)` }}>{q}</th>
              ))}
              <th style={{ textAlign:"center", padding:"8px 6px", fontSize:9, fontWeight:700, color:C.gold, textTransform:"uppercase", letterSpacing:"0.07em", borderLeft:`1px solid rgba(255,255,255,0.25)` }}>Final Avg</th>
              <th style={{ textAlign:"center", padding:"8px 6px", fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.8)", textTransform:"uppercase", letterSpacing:"0.07em", borderLeft:`0.5px solid rgba(255,255,255,0.15)` }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {FULL_ACADEMIC_HISTORY.map((sg,i)=>{
              const rec = sg[focusLevel];
              const qs  = QVals(rec);
              const avg = gradeAvg(rec);
              const pass = avg>=75;
              if(!rec) return null;
              return (
                <tr key={sg.name} style={{ borderBottom:`0.5px solid ${C.border}`, background:!pass?`${C.redBg}50`:i%2===0?"#fff":C.paper }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=!pass?`${C.redBg}50`:i%2===0?"#fff":C.paper;}}>
                  <td style={{ padding:"9px 16px", fontSize:12, fontWeight:!pass?600:400, color:!pass?C.red:C.t1 }}>{sg.name}</td>
                  {qs.map((g,j)=>(
                    <td key={j} style={{ textAlign:"center", padding:"9px 4px", borderLeft:`0.5px solid ${C.border}` }}>
                      <span style={gradeColor(g)}>{g}</span>
                    </td>
                  ))}
                  <td style={{ textAlign:"center", padding:"9px 6px", borderLeft:`1px solid ${C.borderMed}`, background:!pass?C.redBg:"transparent" }}>
                    <span style={{ fontSize:14, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:!pass?C.red:avg>=90?C.green:C.t1 }}>{avg>0?avg.toFixed(1):"-"}</span>
                  </td>
                  <td style={{ textAlign:"center", padding:"9px 6px", borderLeft:`0.5px solid ${C.border}` }}>
                    {avg>0 && <Stamp label={pass?"PASSED":"FAILED"} color={pass?"#fff":C.red} bg={pass?focused.color:C.redBg} />}
                  </td>
                </tr>
              );
            })}
            {/* General Average row */}
            <tr style={{ background:focused.color, borderTop:`2px solid ${focused.color}` }}>
              <td style={{ padding:"11px 16px" }}>
                <span style={{ fontSize:12, fontWeight:700, color:"#fff", fontFamily:"'Fraunces',serif", textTransform:"uppercase", letterSpacing:"0.06em" }}>General Average</span>
              </td>
              {QHeaders(focused.curriculum).map((_,j)=>(
                <td key={j} style={{ borderLeft:`0.5px solid rgba(255,255,255,0.15)` }} />
              ))}
              <td colSpan={2} style={{ padding:"8px 10px", borderLeft:`1px solid rgba(255,255,255,0.25)` }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, justifyContent:"center" }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:2 }}>Final</div>
                    <div style={{ fontSize:28, fontWeight:800, color:focusPassed?C.gold:"#f87171", fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1 }}>{focusGenAvg.toFixed(1)}</div>
                  </div>
                  <div style={{ width:1, height:32, background:"rgba(255,255,255,0.15)" }}/>
                  <Stamp label={focusPassed?"PROMOTED":"RETAINED"} color={focusPassed?focused.color:"#fff"} bg={focusPassed?C.gold:C.red} />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Summary across all grade levels ── */}
      <div style={{ padding:"10px 24px", background:C.paper, borderBottom:`1px solid ${C.borderMed}` }}>
        <div style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Academic Summary - All Grade Levels</div>
        <div style={{ display:"flex", gap:3 }}>
          {LEVELS.map(lv=>{
            const avg  = LevelAvg(lv.key);
            const pass = avg>=75;
            return (
              <div key={lv.key} style={{ flex:1, padding:"8px 10px", border:`1px solid ${lv.color}30`, borderRadius:4, background:focusLevel===lv.key?lv.color+"15":"#fff", cursor:"pointer" }} onClick={()=>setFocusLevel(lv.key)}>
                <div style={{ fontSize:9, color:lv.color, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>{lv.label}</div>
                <div style={{ fontSize:18, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:avg>0?(pass?lv.color:C.red):"#ccc", lineHeight:1.2 }}>{avg>0?avg.toFixed(1):"-"}</div>
                <div style={{ fontSize:9, color:C.t3 }}>{lv.sy}</div>
                {avg>0 && <Stamp label={pass?"Passed":"Failed"} color={pass?lv.color:C.red} bg={pass?lv.color+"15":C.redBg} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Certification ── */}
      <div style={{ padding:"12px 24px", background:C.paper }}>
        <div style={{ fontSize:10, color:C.t2, marginBottom:14, fontStyle:"italic" }}>
          I certify that the above report is a true record of the academic performance of the learner named.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:24 }}>
          {[["Prepared by","Ana R. Soriano","Class Adviser"],["Noted by","Dr. Maria Santos","Principal"],["Parent/Guardian","(Signature over printed name)",""]].map(([lbl,name,role])=>(
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

/* ─── TemplateHubScreen ──────────────────────────────────────── */
