import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { QKey, QData, GbItem, GbGrades } from '../../shared/types';
import { ChevronDown, FileText, ChevronLeft, Plus, Download, Eye } from 'lucide-react';
import { Q_SEED, GB_ROSTER } from '../../shared/constants/seedData';
import { MY_CLASSES } from '../../App';
import { Stamp } from '../../shared/components/Stamp';
export function GradebookFullScreen({ classId=1, onBack, hideBack=false }:{ classId?:number, onBack:()=>void, hideBack?:boolean }) {
  /* ── per-quarter data (each quarter has its own activities + scores) ── */
  const [allData, setAllData] = useState<Record<QKey,QData>>(Q_SEED);
  const [quarter, setQuarter] = useState<QKey>("Q1");
  const [view,    setView]    = useState<"ledger"|"summary">("ledger");

  /* ── shared settings ── */
  const [weights, setWeights] = useState({ww:25,pt:50,qa:25});
  const cls = MY_CLASSES.find(c=>c.id===classId) ?? MY_CLASSES[0];
  const section = `Gr. ${cls.grade} ${cls.section}`;

  /* ── edit states ── */
  const [activeCell, setActiveCell] = useState<string|null>(null);
  const [editMaxId,  setEditMaxId]  = useState<string|null>(null);

  /* ── convenience accessors for the active quarter ── */
  const qd       = allData[quarter];
  const wwItems  = qd.wwItems;
  const ptItems  = qd.ptItems;
  const qaMax    = qd.qaMax;
  const grades   = qd.grades;

  /* ── computation (accepts any QData so summary can compute all quarters) ── */
  function psFor(sid:number, items:GbItem[], g:GbGrades) {
    const sg = g[sid] ?? {};
    const sumS = items.reduce((s,it)=>s+(parseFloat(sg[it.id])||0), 0);
    const sumM = items.reduce((s,it)=>s+it.max, 0);
    return sumM>0 ? Math.round((sumS/sumM)*1000)/10 : 0;
  }
  function qGradeFor(sid:number, d:QData) {
    const g = d.grades[sid] ?? {};
    const wwPS = psFor(sid, d.wwItems, d.grades);
    const ptPS = psFor(sid, d.ptItems, d.grades);
    const qaPS = d.qaMax>0 ? Math.round(((parseFloat(g.qa)||0)/d.qaMax)*1000)/10 : 0;
    return Math.round((wwPS*(weights.ww/100)+ptPS*(weights.pt/100)+qaPS*(weights.qa/100))*10)/10;
  }
  /* active quarter shortcuts */
  const getPS      = (sid:number, items:GbItem[]) => psFor(sid, items, grades);
  const getQGrade  = (sid:number)                 => qGradeFor(sid, qd);

  /* ── update cell value (writes into active quarter) ── */
  function setCell(sid:number, iid:string, val:string) {
    setAllData(prev=>({
      ...prev,
      [quarter]:{
        ...prev[quarter],
        grades:{...prev[quarter].grades,[sid]:{...(prev[quarter].grades[sid]??{}),[iid]:val.replace(/[^\d.]/g,"")}}
      }
    }));
  }

  /* ── add activity columns (adds to active quarter only) ── */
  function addWW() {
    const n = wwItems.length+1;
    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],wwItems:[...prev[quarter].wwItems,{id:`ww${n}`,label:`WW ${n}`,max:100}]}}));
  }
  function addPT() {
    const n = ptItems.length+1;
    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],ptItems:[...prev[quarter].ptItems,{id:`pt${n}`,label:`PT ${n}`,max:100}]}}));
  }
  /* ── update max for an activity in the active quarter ── */
  function updateWWMax(id:string, max:number) {
    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],wwItems:prev[quarter].wwItems.map(x=>x.id===id?{...x,max}:x)}}));
  }
  function updatePTMax(id:string, max:number) {
    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],ptItems:prev[quarter].ptItems.map(x=>x.id===id?{...x,max}:x)}}));
  }

  /* ── summary stats ── */
  const allGrades   = GB_ROSTER.map(s=>getQGrade(s.id)).filter(g=>g>0);
  const passing     = allGrades.filter(g=>g>=75).length;
  const failing     = allGrades.filter(g=>g<75).length;
  const classAvg    = allGrades.length ? (allGrades.reduce((a,b)=>a+b,0)/allGrades.length).toFixed(1) : "—";
  const weightsOk   = weights.ww+weights.pt+weights.qa === 100;

  /* ── column widths ── */
  const W = { num:36, name:188, act:52, add:34, ps:58, qa:56, avg:70 };

  /* ── editable data cell ── */
  function Cell(sid:number, iid:string, max:number) {
    const key   = `${sid}:${iid}`;
    const val   = grades[sid]?.[iid] ?? "";
    const isAct = activeCell===key;
    const num   = parseFloat(val);
    const pct   = (!isNaN(num)&&max>0&&val!=="") ? num/max*100 : null;
    const fail  = pct!==null && pct<75;
    const over  = !isNaN(num) && num>max && val!=="";
    return (
      <td key={iid}
        style={{width:W.act,minWidth:W.act,maxWidth:W.act,border:`0.5px solid ${C.border}`,padding:0,
          background:isAct?"#EFF6FF":fail?C.redBg:"#fff",
          outline:isAct?`2px solid #3B82F6`:"none",outlineOffset:-2,cursor:"cell"}}
        onClick={()=>{ if(!isAct) setActiveCell(key); }}>
        {isAct
          ? <input autoFocus value={val}
              onChange={e=>setCell(sid,iid,e.target.value)}
              onBlur={()=>setActiveCell(null)}
              onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")setActiveCell(null);}}
              style={{width:"100%",height:"100%",minHeight:30,border:"none",outline:"none",
                textAlign:"center",fontSize:12,fontFamily:"'JetBrains Mono',monospace",
                background:"transparent",padding:"4px",boxSizing:"border-box"}} />
          : <div style={{padding:"7px 3px",textAlign:"center",fontSize:12,
              fontFamily:"'JetBrains Mono',monospace",
              color:over?C.amber:fail?C.red:C.t1,
              minHeight:30,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {val}
            </div>}
      </td>
    );
  }

  /* ── read-only computed cell ── */
  function ROCell(val:number|string, opts:{red?:boolean,bold?:boolean,bg?:string,color?:string}={}) {
    const num = typeof val==="number" ? val : parseFloat(val as string);
    const isRed = opts.red && !isNaN(num) && num<75 && num>0;
    return (
      <td style={{border:`0.5px solid ${C.border}`,padding:"7px 4px",textAlign:"center",
        fontSize:12,fontFamily:"'JetBrains Mono',monospace",
        fontWeight:opts.bold?700:400,
        color:opts.color||(isRed?C.red:C.t2),background:opts.bg||"transparent",
        whiteSpace:"nowrap"}}>
        {typeof val==="number" ? (val>0?val.toFixed(1):"—") : val}
      </td>
    );
  }

  /* ── editable max score in header ── */
  function MaxInput(item:GbItem, updateMax:(id:string,max:number)=>void) {
    return editMaxId===item.id
      ? <input autoFocus type="number" defaultValue={item.max}
          onBlur={e=>{updateMax(item.id, parseInt(e.target.value)||item.max); setEditMaxId(null);}}
          onKeyDown={e=>{if(e.key==="Enter")(e.target as HTMLInputElement).blur();}}
          style={{width:32,textAlign:"center",border:`1px solid rgba(255,255,255,0.5)`,borderRadius:2,
            fontSize:9,padding:"1px 3px",fontFamily:"'JetBrains Mono',monospace",
            background:"rgba(255,255,255,0.15)",color:"#fff",outline:"none"}} />
      : <span onClick={()=>setEditMaxId(item.id)}
          style={{fontSize:9,color:"rgba(255,255,255,0.6)",fontFamily:"'JetBrains Mono',monospace",
            cursor:"pointer",textDecoration:"underline dotted"}}
          title="Click to change max score">/{item.max}</span>;
  }

  /* ── header th for a sub-column ── */
  const subTH = (children:React.ReactNode, bg:string, color="#fff", top=34, key?:string) => (
    <th key={key} style={{border:`0.5px solid rgba(255,255,255,0.15)`,background:bg,padding:"5px 3px",
      textAlign:"center",position:"sticky",top,zIndex:3,color,verticalAlign:"middle"}}>
      {children}
    </th>
  );

  /* ── quarter color palette (WW/PT/QA header colors match per-quarter accent) ── */
  const Q_ACCENT: Record<QKey,string> = {Q1:C.m700, Q2:"hsl(220,50%,30%)", Q3:"hsl(160,45%,28%)"};
  const activeAccent = Q_ACCENT[quarter];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background: "transparent"}}>

      {/* ── Controls bar ── */}
      <div style={{background:"#fff",borderBottom:`1px solid ${C.borderMed}`,padding:"9px 18px",
        display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>

        {!hideBack && <>
          <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,
            fontWeight:600,color:C.m700,background:C.m100,border:`1px solid rgba(139,30,30,0.2)`,
            padding:"5px 10px",borderRadius:4,cursor:"pointer"}}>
            <ChevronLeft size={12}/> Back
          </button>
          <div style={{width:1,height:22,background:C.border}}/>
        </>}

        {/* View toggle: Grade entry / Quarterly summary */}
        <div style={{display:"flex",gap:1,background:C.m50,borderRadius:5,padding:2,border:`1px solid ${C.borderMed}`}}>
          {(["ledger","summary"] as const).map(v=>(
            <button key={v} onClick={()=>setView(v)}
              style={{padding:"4px 12px",borderRadius:3,border:"none",cursor:"pointer",fontSize:11,
                fontWeight:view===v?700:400,
                background:view===v?C.m700:"transparent",
                color:view===v?"#fff":C.t2,
                transition:"all 0.12s"}}>
              {v==="ledger" ? "Grade entry" : "Quarterly summary"}
            </button>
          ))}
        </div>

        <div style={{width:1,height:22,background:C.border}}/>

        {/* Section */}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:9,color:C.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.09em"}}>Section</span>
          <div style={{padding:"4px 12px", fontSize:12, fontWeight:700, color:C.m700, background:C.m50, borderRadius:4, border:`1px solid ${C.m100}`}}>
            Grade {cls.grade} — {cls.section}
          </div>
        </div>

        {/* Subject */}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:9,color:C.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.09em"}}>Subject</span>
          <div style={{padding:"4px 12px", fontSize:12, fontWeight:700, color:C.m700, background:C.m50, borderRadius:4, border:`1px solid ${C.m100}`}}>
            {cls.subject}
          </div>
        </div>

        {/* Quarter tabs — always visible; active quarter = which ledger OR which column is highlighted in summary */}
        <div style={{display:"flex",gap:2}}>
          {(["Q1","Q2","Q3"] as QKey[]).map(q=>{
            const isAct = quarter===q;
            const acc = Q_ACCENT[q];
            return (
              <button key={q} onClick={()=>setQuarter(q)}
                style={{padding:"4px 13px",borderRadius:4,cursor:"pointer",fontSize:12,fontWeight:700,
                  transition:"all 0.12s",
                  border:isAct?`1.5px solid ${acc}`:`1px solid ${C.borderMed}`,
                  background:isAct?acc:"#fff",
                  color:isAct?"#fff":C.t2}}>
                {q}
              </button>
            );
          })}
        </div>

        <div style={{width:1,height:22,background:C.border,flexShrink:0}}/>

        {/* Weight inputs — only shown in grade entry view */}
        {view==="ledger" && (
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:9,color:C.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.09em"}}>Weights:</span>
            {([["WW",weights.ww,(v:number)=>setWeights(p=>({...p,ww:v})),C.m700],
               ["PT",weights.pt,(v:number)=>setWeights(p=>({...p,pt:v})),"hsl(220,50%,34%)"],
               ["QA",weights.qa,(v:number)=>setWeights(p=>({...p,qa:v})),"hsl(25,55%,34%)"]] as [string,number,(v:number)=>void,string][])
              .map(([l,v,set,accent])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:11,fontWeight:700,color:accent}}>{l}</span>
                  <div style={{display:"flex",alignItems:"center",border:`1px solid ${C.borderMed}`,borderRadius:3,overflow:"hidden"}}>
                    <input type="number" min={0} max={100} value={v}
                      onChange={e=>set(Math.max(0,Math.min(100,parseInt(e.target.value)||0)))}
                      style={{width:32,textAlign:"center",border:"none",padding:"3px 4px",
                        fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:C.t1,outline:"none"}}/>
                    <span style={{background:C.m50,color:C.t3,fontSize:11,padding:"3px 5px",borderLeft:`1px solid ${C.borderMed}`}}>%</span>
                  </div>
                </div>
            ))}
            <span style={{fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",
              color:weightsOk?C.green:C.red}}>
              = {weights.ww+weights.pt+weights.qa}%
            </span>
            {!weightsOk && <span style={{fontSize:9,color:C.red}}>must equal 100%</span>}
          </div>
        )}

        <div style={{marginLeft:"auto"}}>
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",
            background:C.m700,color:"#fff",borderRadius:4,border:"none",cursor:"pointer",
            fontSize:12,fontWeight:700}}>
            <Download size={13}/> Export Excel
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          QUARTERLY SUMMARY VIEW
          ══════════════════════════════════════════════════════════ */}
      {view==="summary" && (
        <div style={{flex:1,overflow:"auto"}}>
          {/* Explanatory banner */}
          <div style={{background:C.m50,borderBottom:`1px solid ${C.borderMed}`,padding:"8px 20px",
            display:"flex",alignItems:"center",gap:10}}>
            <FileText size={13} color={C.m700}/>
            <span style={{fontSize:11,color:C.t2}}>
              Quarterly summary — read-only reference for <strong>Form 138 (Report Card)</strong>.
              Edit scores in <button onClick={()=>setView("ledger")} style={{color:C.m700,background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,padding:0,textDecoration:"underline"}}>Grade entry</button>.
            </span>
            <span style={{marginLeft:"auto",fontSize:10,color:C.t3}}>
              Weights applied: WW {weights.ww}% · PT {weights.pt}% · QA {weights.qa}%
            </span>
          </div>

          <table style={{borderCollapse:"collapse",tableLayout:"fixed",width:"100%",fontSize:12}}>
            <colgroup>
              <col style={{width:36}}/>{/* # */}
              <col style={{width:200}}/>{/* Name */}
              <col style={{width:90}}/>{/* Q1 */}
              <col style={{width:90}}/>{/* Q2 */}
              <col style={{width:90}}/>{/* Q3 */}
              <col style={{width:110}}/>{/* Final Avg */}
              <col style={{width:90}}/>{/* Status */}
            </colgroup>

            <thead>
              <tr>
                <th rowSpan={2} style={{border:`1px solid rgba(255,255,255,0.15)`,background:C.m900,
                  color:"rgba(255,255,255,0.55)",fontSize:9,fontWeight:700,padding:"6px 2px",
                  textAlign:"center",position:"sticky",top:0,left:0,zIndex:6,letterSpacing:"0.07em"}}>#</th>
                <th rowSpan={2} style={{border:`1px solid rgba(255,255,255,0.15)`,background:C.m800,
                  color:"#fff",fontSize:11,fontWeight:700,padding:"7px 10px",textAlign:"left",
                  position:"sticky",top:0,left:36,zIndex:6,
                  fontFamily:"'Fraunces',serif",letterSpacing:"0.04em"}}>STUDENT NAME</th>
                {/* Quarter column headers */}
                {(["Q1","Q2","Q3"] as QKey[]).map(q=>(
                  <th key={q} style={{border:`1px solid rgba(255,255,255,0.15)`,
                    background: quarter===q ? Q_ACCENT[q] : `${Q_ACCENT[q]}CC`,
                    color:"#fff",fontSize:11,fontWeight:700,padding:"7px 4px",textAlign:"center",
                    position:"sticky",top:0,zIndex:4,letterSpacing:"0.08em",
                    outline: quarter===q ? `2px solid ${Q_ACCENT[q]}` : "none",
                    outlineOffset:-2}}>
                    {q}{quarter===q && <span style={{fontSize:9,marginLeft:5,opacity:0.7}}>▲</span>}
                  </th>
                ))}
                <th style={{border:`1px solid rgba(255,255,255,0.15)`,background:C.gold,
                  color:C.m900,fontSize:11,fontWeight:800,padding:"7px 4px",textAlign:"center",
                  position:"sticky",top:0,zIndex:4,
                  fontFamily:"'Fraunces',serif",letterSpacing:"0.06em"}}>FINAL AVG</th>
                <th style={{border:`1px solid rgba(255,255,255,0.15)`,background:C.m700,
                  color:"#fff",fontSize:10,fontWeight:700,padding:"7px 4px",textAlign:"center",
                  position:"sticky",top:0,zIndex:4,letterSpacing:"0.08em"}}>STATUS</th>
              </tr>
              {/* Sub-header: labels */}
              <tr>
                {(["Q1","Q2","Q3"] as QKey[]).map(q=>(
                  <th key={q} style={{border:`0.5px solid ${C.border}`,
                    background: quarter===q ? `${Q_ACCENT[q]}22` : C.m50,
                    padding:"4px 4px",textAlign:"center",position:"sticky",top:34,zIndex:3}}>
                    <span style={{fontSize:9,color:quarter===q?Q_ACCENT[q]:C.t3,fontWeight:600,
                      textTransform:"uppercase",letterSpacing:"0.07em"}}>
                      Qrtly Grade
                    </span>
                  </th>
                ))}
                <th style={{border:`0.5px solid ${C.border}`,background:C.goldLight,
                  padding:"4px",textAlign:"center",position:"sticky",top:34,zIndex:3}}>
                  <span style={{fontSize:9,color:C.gold,fontWeight:600,
                    textTransform:"uppercase",letterSpacing:"0.07em"}}>Q1+Q2+Q3 ÷ 3</span>
                </th>
                <th style={{border:`0.5px solid ${C.border}`,background:C.m50,
                  padding:"4px",textAlign:"center",position:"sticky",top:34,zIndex:3}}/>
              </tr>
            </thead>

            <tbody>
              {GB_ROSTER.map((student,idx)=>{
                const q1g = qGradeFor(student.id, allData.Q1);
                const q2g = qGradeFor(student.id, allData.Q2);
                const q3g = qGradeFor(student.id, allData.Q3);
                const allFilled = q1g>0 && q2g>0 && q3g>0;
                const finalAvg = allFilled ? Math.round(((q1g+q2g+q3g)/3)*10)/10 : 0;
                const passed = finalAvg>=75;
                const rowBg = idx%2===0 ? "#fff" : C.paper;

                function gradeCell(g:number, isActive:boolean) {
                  const failing = g>0 && g<75;
                  const high = g>=90;
                  return (
                    <td style={{border:`0.5px solid ${C.border}`,padding:"9px 6px",textAlign:"center",
                      background: isActive ? (failing?C.redBg:`${Q_ACCENT[quarter]}10`) : (failing?C.redBg:rowBg),
                      outline: isActive ? `1.5px solid ${Q_ACCENT[quarter]}50` : "none",
                      outlineOffset:-1}}>
                      <span style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",
                        color: g<=0?"#ccc" : failing?C.red : high?C.green : C.t1}}>
                        {g>0 ? g.toFixed(1) : "—"}
                      </span>
                    </td>
                  );
                }

                return (
                  <tr key={student.id}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.ledger;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=rowBg;}}>
                    {/* # */}
                    <td style={{border:`0.5px solid ${C.border}`,padding:"9px 3px",textAlign:"center",
                      fontSize:10,color:C.t3,fontFamily:"'JetBrains Mono',monospace",
                      background:"#F8F5F4",position:"sticky",left:0,zIndex:1}}>
                      {idx+1}
                    </td>
                    {/* Name */}
                    <td style={{border:`0.5px solid ${C.border}`,padding:"9px 10px",
                      fontSize:12,fontWeight:600,color:C.t1,background:"#fff",
                      position:"sticky",left:36,zIndex:1,
                      borderRight:`2px solid ${C.borderMed}`,whiteSpace:"nowrap"}}>
                      {student.surname}, {student.first}
                    </td>
                    {gradeCell(q1g, quarter==="Q1")}
                    {gradeCell(q2g, quarter==="Q2")}
                    {gradeCell(q3g, quarter==="Q3")}
                    {/* Final Average */}
                    <td style={{border:`1px solid ${C.borderMed}`,padding:"9px 6px",textAlign:"center",
                      background: finalAvg>0&&finalAvg<75 ? C.redBg : C.goldLight}}>
                      <span style={{fontSize:15,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",
                        color: finalAvg<=0?"#ccc" : finalAvg<75?C.red : finalAvg>=90?C.green : C.t1}}>
                        {finalAvg>0 ? finalAvg.toFixed(1) : "—"}
                      </span>
                    </td>
                    {/* Status stamp */}
                    <td style={{border:`0.5px solid ${C.border}`,padding:"9px 6px",textAlign:"center",background:rowBg}}>
                      {finalAvg>0 && <Stamp
                        label={passed?"PASSED":"FAILED"}
                        color={passed?"#fff":C.red}
                        bg={passed?C.green:C.redBg}/>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Summary footer */}
          <div style={{background:C.m800,borderTop:`2px solid ${C.m700}`,padding:"8px 18px",
            display:"flex",alignItems:"center",gap:24}}>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700,
              textTransform:"uppercase",letterSpacing:"0.1em"}}>Final Average Summary</span>
            {(()=>{
              const finals = GB_ROSTER.map(s=>{
                const q1=qGradeFor(s.id,allData.Q1), q2=qGradeFor(s.id,allData.Q2), q3=qGradeFor(s.id,allData.Q3);
                return (q1>0&&q2>0&&q3>0) ? Math.round(((q1+q2+q3)/3)*10)/10 : 0;
              }).filter(g=>g>0);
              const pass=finals.filter(g=>g>=75).length, fail=finals.filter(g=>g<75).length;
              const avg=finals.length?(finals.reduce((a,b)=>a+b,0)/finals.length).toFixed(1):"—";
              return (
                <>
                  {([["Students",GB_ROSTER.length,"rgba(255,255,255,0.7)"],
                     ["Passed",pass,C.gold],
                     ["Failed",fail,"#FCA5A5"],
                     ["Class avg",avg,"#fff"]] as [string,number|string,string][]).map(([l,v,col])=>(
                    <div key={l} style={{display:"flex",alignItems:"baseline",gap:5}}>
                      <span style={{fontSize:9,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</span>
                      <span style={{fontSize:16,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:col}}>{v}</span>
                    </div>
                  ))}
                </>
              );
            })()}
            <div style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,0.35)"}}>
              <span style={{fontWeight:700,color:"rgba(255,255,255,0.7)"}}>
                {cls.subject} · Grade {cls.grade} {cls.section} · SY 2025–2026
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          GRADE ENTRY LEDGER VIEW
          ══════════════════════════════════════════════════════════ */}
      {view==="ledger" && (
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:1,overflow:"auto",position:"relative"}}>
        <table style={{borderCollapse:"collapse",tableLayout:"fixed",fontSize:12,
          minWidth:"max-content",width:"100%"}}>

          <colgroup>
            <col style={{width:W.num}}/>
            <col style={{width:W.name}}/>
            {wwItems.map(it=><col key={it.id} style={{width:W.act}}/>)}
            <col style={{width:W.add}}/>
            <col style={{width:W.ps}}/>
            {ptItems.map(it=><col key={it.id} style={{width:W.act}}/>)}
            <col style={{width:W.add}}/>
            <col style={{width:W.ps}}/>
            <col style={{width:W.qa}}/>
            <col style={{width:W.avg}}/>
          </colgroup>

          <thead>
            {/* ── Row 1: category group headers ── */}
            <tr>
              <th rowSpan={2} style={{border:`1px solid rgba(255,255,255,0.15)`,background:C.m900,
                color:"rgba(255,255,255,0.6)",fontSize:9,fontWeight:700,padding:"5px 2px",
                textAlign:"center",position:"sticky",top:0,left:0,zIndex:6,letterSpacing:"0.07em"}}>
                #
              </th>
              <th rowSpan={2} style={{border:`1px solid rgba(255,255,255,0.15)`,background:C.m800,
                color:"#fff",fontSize:11,fontWeight:700,padding:"7px 10px",textAlign:"left",
                position:"sticky",top:0,left:W.num,zIndex:6,
                fontFamily:"'Fraunces',serif",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>
                STUDENT NAME
              </th>
              {/* WW */}
              <th colSpan={wwItems.length+2} style={{border:`1px solid rgba(255,255,255,0.15)`,
                background:activeAccent,color:"#fff",fontSize:10,fontWeight:700,padding:"7px 6px",
                textAlign:"center",position:"sticky",top:0,zIndex:4,letterSpacing:"0.07em"}}>
                WRITTEN WORKS
                <span style={{fontFamily:"'JetBrains Mono',monospace",color:"rgba(255,255,255,0.6)",
                  fontSize:11,marginLeft:8}}>{weights.ww}%</span>
              </th>
              {/* PT */}
              <th colSpan={ptItems.length+2} style={{border:`1px solid rgba(255,255,255,0.15)`,
                background:"hsl(220,50%,30%)",color:"#fff",fontSize:10,fontWeight:700,padding:"7px 6px",
                textAlign:"center",position:"sticky",top:0,zIndex:4,letterSpacing:"0.07em"}}>
                PERFORMANCE TASKS
                <span style={{fontFamily:"'JetBrains Mono',monospace",color:"rgba(255,255,255,0.6)",
                  fontSize:11,marginLeft:8}}>{weights.pt}%</span>
              </th>
              {/* QA */}
              <th rowSpan={2} style={{border:`1px solid rgba(255,255,255,0.15)`,
                background:"hsl(25,55%,28%)",color:"#fff",fontSize:10,fontWeight:700,padding:"5px 4px",
                textAlign:"center",position:"sticky",top:0,zIndex:4,letterSpacing:"0.07em",lineHeight:1.4}}>
                QRTLY<br/>ASSESS<br/>
                <span style={{fontFamily:"'JetBrains Mono',monospace",color:"rgba(255,255,255,0.6)",fontSize:9}}>{weights.qa}%</span>
              </th>
              {/* Q-AVG */}
              <th rowSpan={2} style={{border:`1px solid rgba(255,255,255,0.15)`,
                background:C.gold,color:C.m900,fontSize:10,fontWeight:800,padding:"5px 4px",
                textAlign:"center",position:"sticky",top:0,right:0,zIndex:6,
                fontFamily:"'Fraunces',serif",letterSpacing:"0.07em",lineHeight:1.4}}>
                QRTLY<br/>AVG
              </th>
            </tr>

            {/* ── Row 2: activity sub-headers ── */}
            <tr>
              {/* WW activity columns — key passed as 5th arg */}
              {wwItems.map(it=>
                subTH(<div style={{lineHeight:1.4}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#fff",letterSpacing:"0.04em"}}>{it.label}</div>
                  {MaxInput(it, updateWWMax)}
                </div>, activeAccent, "#fff", 34, it.id)
              )}
              {/* +Add WW */}
              {subTH(
                <button onClick={addWW} title="Add Written Works activity"
                  style={{width:"100%",height:"100%",minHeight:34,background:"none",border:"none",
                    cursor:"pointer",color:"rgba(255,255,255,0.7)",display:"flex",
                    alignItems:"center",justifyContent:"center"}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.12)";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                  <Plus size={12}/>
                </button>, activeAccent, "#fff", 34, "add-ww"
              )}
              {/* WW PS header */}
              {subTH(<div style={{lineHeight:1.4}}>
                <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.85)",letterSpacing:"0.06em"}}>WW PS</div>
                <div style={{fontSize:8,color:"rgba(255,255,255,0.5)"}}>%</div>
              </div>, activeAccent, "#fff", 34, "ww-ps")}

              {/* PT activity columns — key passed as 5th arg */}
              {ptItems.map(it=>
                subTH(<div style={{lineHeight:1.4}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#fff",letterSpacing:"0.04em"}}>{it.label}</div>
                  {MaxInput(it, updatePTMax)}
                </div>, "hsl(220,50%,30%)", "#fff", 34, it.id)
              )}
              {/* +Add PT */}
              {subTH(
                <button onClick={addPT} title="Add Performance Task activity"
                  style={{width:"100%",height:"100%",minHeight:34,background:"none",border:"none",
                    cursor:"pointer",color:"rgba(255,255,255,0.7)",display:"flex",
                    alignItems:"center",justifyContent:"center"}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.12)";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                  <Plus size={12}/>
                </button>, "hsl(220,50%,30%)", "#fff", 34, "add-pt"
              )}
              {/* PT PS header */}
              {subTH(<div style={{lineHeight:1.4}}>
                <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.85)",letterSpacing:"0.06em"}}>PT PS</div>
                <div style={{fontSize:8,color:"rgba(255,255,255,0.5)"}}>%</div>
              </div>, "hsl(220,50%,30%)", "#fff", 34, "pt-ps")}
            </tr>
          </thead>

          <tbody>
            {GB_ROSTER.map((student,idx)=>{
              const wwPS   = getPS(student.id, wwItems);
              const ptPS   = getPS(student.id, ptItems);
              const qGrade = getQGrade(student.id);
              const rowBg  = idx%2===0?"#fff":C.paper;
              return (
                <tr key={student.id}
                  onMouseEnter={e=>{ if(!activeCell)(e.currentTarget as HTMLElement).style.background=C.ledger; }}
                  onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background=rowBg; }}>
                  {/* Row number — sticky left */}
                  <td style={{border:`0.5px solid ${C.border}`,padding:"7px 3px",textAlign:"center",
                    fontSize:10,color:C.t3,fontFamily:"'JetBrains Mono',monospace",
                    background:"#F8F5F4",position:"sticky",left:0,zIndex:1,
                    borderRight:`1px solid ${C.borderMed}`}}>
                    {idx+1}
                  </td>
                  {/* Student name — sticky left */}
                  <td style={{border:`0.5px solid ${C.border}`,padding:"7px 10px",
                    fontSize:12,fontWeight:600,color:C.t1,
                    background:"#fff",position:"sticky",left:W.num,zIndex:1,
                    borderRight:`2px solid ${C.borderMed}`,whiteSpace:"nowrap"}}>
                    {student.surname}, {student.first}
                  </td>

                  {/* WW cells */}
                  {wwItems.map(it=>Cell(student.id, it.id, it.max))}
                  {/* +Add WW placeholder */}
                  <td style={{border:`0.5px solid ${C.border}`,background:"#F9F5F4"}}/>
                  {/* WW PS */}
                  {ROCell(wwPS, {red:true, bg:"#F0F5FF", color: wwPS>0&&wwPS<75?C.red:wwPS>=90?C.green:C.blue})}

                  {/* PT cells */}
                  {ptItems.map(it=>Cell(student.id, it.id, it.max))}
                  {/* +Add PT placeholder */}
                  <td style={{border:`0.5px solid ${C.border}`,background:"#F4F5F9"}}/>
                  {/* PT PS */}
                  {ROCell(ptPS, {red:true, bg:"#F0F5FF", color: ptPS>0&&ptPS<75?C.red:ptPS>=90?C.green:C.blue})}

                  {/* QA cell */}
                  {Cell(student.id, "qa", qaMax)}

                  {/* Q-AVG — sticky right */}
                  <td style={{border:`1px solid ${C.borderMed}`,padding:"7px 4px",textAlign:"center",
                    fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,
                    color: qGrade<=0?"#ccc" : qGrade<75?C.red : qGrade>=90?C.green : C.t1,
                    background: qGrade>0&&qGrade<75 ? C.redBg : C.goldLight,
                    position:"sticky",right:0,zIndex:1,
                    borderLeft:`2px solid ${C.borderMed}`}}>
                    {qGrade>0 ? qGrade.toFixed(1) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Bottom summary ledger strip ── */}
      <div style={{background:C.m800,borderTop:`2px solid ${C.m700}`,padding:"8px 18px",
        display:"flex",alignItems:"center",gap:24,flexShrink:0}}>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700,
          textTransform:"uppercase",letterSpacing:"0.1em"}}>Class Summary</span>
        {([
          ["Students",  GB_ROSTER.length,        "rgba(255,255,255,0.7)"],
          ["Passing",   passing,                  C.gold],
          ["Failing",   failing,                  "#FCA5A5"],
          ["Class avg", classAvg,                 "#fff"],
        ] as [string,number|string,string][]).map(([l,v,color])=>(
          <div key={l} style={{display:"flex",alignItems:"baseline",gap:5}}>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</span>
            <span style={{fontSize:16,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color}}>{v}</span>
          </div>
        ))}
        <div style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,0.35)"}}>
          <span style={{fontWeight:700,color:"rgba(255,255,255,0.7)"}}>
            {quarter} · {cls.subject} · Grade {cls.grade} {cls.section} · SY 2025–2026
          </span>
        </div>
      </div>
      </div>
      )}{/* end view==="ledger" */}
    </div>
  );
}

/* ─── Clinic visit seed data ───────────────────────────────── */