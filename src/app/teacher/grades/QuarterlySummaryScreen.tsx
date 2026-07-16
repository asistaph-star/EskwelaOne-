import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { QKey, QData, GbItem, GbGrades } from '../../shared/types';
import { ChevronDown, Download, FileText, ArrowRight, BarChart2 } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { Q_SEED, GB_ROSTER } from '../../shared/constants/seedData';
export function QuarterlySummaryScreen() {
  const ROSTER = (() => {
    try {
      const saved = localStorage.getItem('hub_students');
      if (saved) {
        const stored = JSON.parse(saved);
        // Start from GB_ROSTER (the original 8 students with numeric IDs)
        // then append any extra students that were added via the form
        const newStudents = stored
          .filter((s:any) => typeof s.id === 'string' && s.id.startsWith('s'))
          .map((s:any, i:number) => ({
            id: 100 + i,
            surname: s.surname || s.name || '',
            first: s.first || ''
          }));
        return [...GB_ROSTER, ...newStudents];
      }
    } catch(e) {}
    return GB_ROSTER;
  })();

  const [weights]  = useState({ww:25,pt:50,qa:25});
  const [section, setSection] = useState("Gr. 8 Rizal");
  const [quarter, setQuarter] = useState<QKey>("Q1");
  const [qCount, setQCount] = useState<number>(3);
  const activeQuarters = Array.from({length: qCount}, (_, i) => `Q${i+1}`);

  /* use the same seed data as the gradebook */
  const allData = (() => {
    try {
      const saved = localStorage.getItem('eskwela_grades');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return Q_SEED;
  })();

  function psFor(sid:number|string, items:GbItem[], g:GbGrades) {
    const sg = g[sid] ?? {};
    const sumS = items.reduce((s,it)=>s+(parseFloat(sg[it.id])||0),0);
    const sumM = items.reduce((s,it)=>s+it.max,0);
    return sumM>0 ? Math.round((sumS/sumM)*1000)/10 : 0;
  }
  function qGradeFor(sid:number|string, d:QData) {
    if (!d) return 0;
    const g = d.grades[sid] ?? {};
    const wwPS = psFor(sid, d.wwItems, d.grades);
    const ptPS = psFor(sid, d.ptItems, d.grades);
    const qaPS = d.qaMax>0 ? Math.round(((parseFloat(g.qa)||0)/d.qaMax)*1000)/10 : 0;
    return Math.round((wwPS*(weights.ww/100)+ptPS*(weights.pt/100)+qaPS*(weights.qa/100))*10)/10;
  }

  function getQAccent(q: string) { return C.m700; }

  const finals = ROSTER.map(s=>{
    const grades = activeQuarters.map(q => qGradeFor(s.id, allData[q]));
    if (grades.some(g => g <= 0)) return 0;
    const sum = grades.reduce((acc, val) => acc + val, 0);
    return Math.round((sum/grades.length)*10)/10;
  });
  const passing = finals.filter(g=>g>=75).length;
  const failing  = finals.filter(g=>g>0&&g<75).length;
  const classAvg = finals.filter(g=>g>0).length
    ? (finals.filter(g=>g>0).reduce((a,b)=>a+b,0)/finals.filter(g=>g>0).length).toFixed(1)
    : "-";

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background: "transparent"}}>

      {/* Controls */}
      <div style={{background:"#fff",borderBottom:`1px solid ${C.borderMed}`,padding:"9px 18px",
        display:"flex",alignItems:"center",gap:12,flexShrink:0,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:9,color:C.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.09em"}}>Section</span>
          <div style={{position:"relative"}}>
            <select value={section} onChange={e=>setSection(e.target.value)}
              style={{border:`1px solid ${C.borderMed}`,borderRadius:4,padding:"4px 22px 4px 7px",fontSize:12,color:C.t1,background:"#fff",outline:"none",appearance:"none",cursor:"pointer"}}>
              <option>Gr. 8 Rizal</option><option>Gr. 9 Einstein</option><option>Gr. 10 Pilot</option>
            </select>
            <ChevronDown size={11} style={{position:"absolute",right:5,top:"50%",transform:"translateY(-50%)",color:C.t3,pointerEvents:"none"}}/>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:9,color:C.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.09em"}}>Subject</span>
          <div style={{position:"relative"}}>
            <select style={{border:`1px solid ${C.borderMed}`,borderRadius:4,padding:"4px 22px 4px 7px",fontSize:12,color:C.t1,background:"#fff",outline:"none",appearance:"none",cursor:"pointer"}}>
              <option>Mathematics 8</option><option>Science 9</option><option>Filipino 10</option>
            </select>
            <ChevronDown size={11} style={{position:"absolute",right:5,top:"50%",transform:"translateY(-50%)",color:C.t3,pointerEvents:"none"}}/>
          </div>
        </div>
        {/* Quarter highlight */}
        <div style={{display:"flex",gap:2}}>
          {activeQuarters.map(q=>(
            <button key={q} onClick={()=>setQuarter(q)}
              style={{padding:"4px 13px",borderRadius:4,cursor:"pointer",fontSize:12,fontWeight:700,
                transition:"all 0.12s",
                border:quarter===q?`1.5px solid ${getQAccent(q)}`:`1px solid ${C.borderMed}`,
                background:quarter===q?getQAccent(q):"#fff",
                color:quarter===q?"#fff":C.t2}}>
              {q}
            </button>
          ))}
          {true && (
            <button onClick={() => setQCount(c => c+1)} style={{padding:"4px 8px",borderRadius:4,cursor:"pointer",fontSize:12,fontWeight:700,border:`1px solid ${C.borderMed}`,background:"#fff",color:C.t2}} title="Add Quarter">+</button>
          )}
          {qCount > 1 && (
            <button onClick={() => {
              if (quarter === `Q${qCount}`) setQuarter(`Q${qCount-1}` as QKey);
              setQCount(c => c-1);
            }} style={{padding:"4px 8px",borderRadius:4,cursor:"pointer",fontSize:12,fontWeight:700,border:`1px solid ${C.borderMed}`,background:"#fff",color:C.t2}} title="Remove Quarter">-</button>
          )}
        </div>
        <span style={{fontSize:11,color:C.t3,marginLeft:4}}>
          Highlight a quarter to compare · Weights: WW {weights.ww}% · PT {weights.pt}% · QA {weights.qa}%
        </span>
        <div style={{marginLeft:"auto"}}>
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",background:C.m700,color:"#fff",borderRadius:4,border:"none",cursor:"pointer",fontSize:12,fontWeight:700}}>
            <Download size={13}/> Export Excel
          </button>
        </div>
      </div>

      {/* Explanatory banner */}
      <div style={{background:C.m50,borderBottom:`1px solid ${C.borderMed}`,padding:"7px 20px",
        display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <FileText size={13} color={C.m700}/>
        <span style={{fontSize:11,color:C.t2}}>
          Read-only summary for <strong>Form 138 (Report Card)</strong>. To edit scores, go to{" "}
          <strong>Gradebook</strong>.
        </span>
      </div>

      {/* Table */}
      <div style={{flex:1,overflow:"auto"}}>
        <table style={{borderCollapse:"collapse",tableLayout:"fixed",width:"100%",fontSize:12}}>
          <colgroup>
            <col style={{width:36}}/>
            <col style={{width:200}}/>
            {activeQuarters.map(q => <col key={q} style={{width:100}}/>)}
            <col style={{width:120}}/>
            <col style={{width:90}}/>
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={{border:`1px solid rgba(255,255,255,0.15)`,background:C.m900,color:"rgba(255,255,255,0.55)",
                fontSize:9,fontWeight:700,padding:"6px 2px",textAlign:"center",
                position:"sticky",top:0,left:0,zIndex:6,letterSpacing:"0.07em"}}>#</th>
              <th rowSpan={2} style={{border:`1px solid rgba(255,255,255,0.15)`,background:C.m800,color:"#fff",
                fontSize:11,fontWeight:700,padding:"7px 10px",textAlign:"left",
                position:"sticky",top:0,left:36,zIndex:6,fontFamily:"'Fraunces',serif",letterSpacing:"0.04em"}}>
                STUDENT NAME
              </th>
              {activeQuarters.map(q=>(
                <th key={q} style={{border:`1px solid rgba(255,255,255,0.15)`,
                  background: quarter===q ? getQAccent(q) : `${getQAccent(q)}BB`,
                  color:"#fff",fontSize:11,fontWeight:700,padding:"7px 4px",textAlign:"center",
                  position:"sticky",top:0,zIndex:4,letterSpacing:"0.08em",
                  outline: quarter===q ? `2px solid ${getQAccent(q)}` : "none",
                  outlineOffset:-2}}>
                  {q}{quarter===q && <span style={{fontSize:9,marginLeft:4,opacity:0.7}}>▲</span>}
                </th>
              ))}
              <th style={{border:`1px solid rgba(255,255,255,0.15)`,background:C.gold,color:C.m900,
                fontSize:11,fontWeight:800,padding:"7px 4px",textAlign:"center",
                position:"sticky",top:0,zIndex:4,fontFamily:"'Fraunces',serif",letterSpacing:"0.06em"}}>
                FINAL AVG
              </th>
              <th style={{border:`1px solid rgba(255,255,255,0.15)`,background:C.m700,color:"#fff",
                fontSize:10,fontWeight:700,padding:"7px 4px",textAlign:"center",
                position:"sticky",top:0,zIndex:4,letterSpacing:"0.08em"}}>
                STATUS
              </th>
            </tr>
            <tr>
              {activeQuarters.map(q=>(
                <th key={q} style={{border:`0.5px solid ${C.border}`,
                  background: quarter===q ? `${getQAccent(q)}20` : C.m50,
                  padding:"4px",textAlign:"center",position:"sticky",top:34,zIndex:3}}>
                  <span style={{fontSize:9,color:quarter===q?getQAccent(q):C.t3,fontWeight:600,
                    textTransform:"uppercase",letterSpacing:"0.07em"}}>Qrtly Grade</span>
                </th>
              ))}
                <th style={{border:`0.5px solid ${C.border}`,background:C.goldLight,
                  padding:"4px",textAlign:"center",position:"sticky",top:34,zIndex:3}}>
                  <span style={{fontSize:9,color:C.gold,fontWeight:600,
                    textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{activeQuarters.join('+')} ÷ {qCount}</span>
                </th>
              <th style={{border:`0.5px solid ${C.border}`,background:C.m50,
                padding:"4px",textAlign:"center",position:"sticky",top:34,zIndex:3}}/>
            </tr>
          </thead>
          <tbody>
            {ROSTER.map((student,idx)=>{
              const fa  = finals[idx];
              const passed = fa>=75;
              const rowBg  = idx%2===0?"#fff":C.paper;

              function gradeCell(g:number, isActive:boolean) {
                const fail = g>0&&g<75, high = g>=90;
                return (
                  <td style={{border:`0.5px solid ${C.border}`,padding:"9px 6px",textAlign:"center",
                    background: isActive?(fail?C.redBg:`${getQAccent(quarter)}10`):(fail?C.redBg:rowBg),
                    outline: isActive?`1.5px solid ${getQAccent(quarter)}50`:"none",outlineOffset:-1}}>
                    <span style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",
                      color: g<=0?"#ccc":fail?C.red:high?C.green:C.t1}}>
                      {g>0 ? g.toFixed(1) : "-"}
                    </span>
                  </td>
                );
              }

              return (
                <tr key={student.id}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.ledger;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=rowBg;}}>
                  <td style={{border:`0.5px solid ${C.border}`,padding:"9px 3px",textAlign:"center",fontSize:10,
                    color:C.t3,fontFamily:"'JetBrains Mono',monospace",background:"#F8F5F4",
                    position:"sticky",left:0,zIndex:1}}>{idx+1}</td>
                  <td style={{border:`0.5px solid ${C.border}`,padding:"9px 10px",fontSize:12,fontWeight:600,
                    color:C.t1,background:"#fff",position:"sticky",left:36,zIndex:1,
                    borderRight:`2px solid ${C.borderMed}`,whiteSpace:"nowrap"}}>
                    {student.surname}, {student.first}
                  </td>
                  {activeQuarters.map(q => {
                    const g = qGradeFor(student.id, allData[q]);
                    return <React.Fragment key={q}>{gradeCell(g, quarter===q)}</React.Fragment>;
                  })}
                  <td style={{border:`1px solid ${C.borderMed}`,padding:"9px 6px",textAlign:"center",
                    background: fa>0&&fa<75?C.redBg:C.goldLight}}>
                    <span style={{fontSize:15,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",
                      color: fa<=0?"#ccc":fa<75?C.red:fa>=90?C.green:C.t1}}>
                      {fa>0 ? fa.toFixed(1) : "-"}
                    </span>
                  </td>
                  <td style={{border:`0.5px solid ${C.border}`,padding:"9px 6px",textAlign:"center",background:rowBg}}>
                    {fa>0 && <Stamp label={passed?"PASSED":"FAILED"} color={passed?"#fff":C.red} bg={passed?C.green:C.redBg}/>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      <div style={{background:C.m800,borderTop:`2px solid ${C.m700}`,padding:"8px 18px",
        display:"flex",alignItems:"center",gap:24,flexShrink:0}}>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em"}}>Final Average Summary</span>
        {([["Students",ROSTER.length,"rgba(255,255,255,0.7)"],["Passed",passing,C.gold],["Failed",failing,"#FCA5A5"],["Class avg",classAvg,"#fff"]] as [string,number|string,string][])
          .map(([l,v,col])=>(
            <div key={l} style={{display:"flex",alignItems:"baseline",gap:5}}>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</span>
              <span style={{fontSize:16,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:col}}>{v}</span>
            </div>
          ))}
        <div style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,0.35)"}}>
          <span style={{fontWeight:700,color:"rgba(255,255,255,0.7)"}}>Mathematics 8 · {section} · SY 2025–2026</span>
        </div>
      </div>
    </div>
  );
}

/* ─── GradebookFullScreen ───────────────────────────────────── */
