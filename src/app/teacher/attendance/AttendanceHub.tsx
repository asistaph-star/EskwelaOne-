import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { AStatus, AttSub } from '../../shared/types';
import { sColor, sBg } from '../../shared/utils/helpers';
import { CalendarCheck, QrCode, FileDown, Plus, Search, Download, Printer, CheckCircle, FileSpreadsheet, Clock, UserCheck, Calendar, Activity } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { DocPanel } from '../../shared/components/DocPanel';
import { ATT_DATES, ATT_STATUS_SEED, QR_LOG } from '../../shared/constants/seedData';
import { STUDENTS_GR8 } from '../../App';
export function AttendanceHub({ students }: { students: typeof STUDENTS_GR8 }) {
  const [sub, setSub] = useState<AttSub>("daily");

  /* per-student per-date status — starts from seed */
  const [attData, setAttData] = useState<Record<number,Record<number,AStatus>>>(ATT_STATUS_SEED as any);
  const [selectedDate, setSelectedDate] = useState(10); /* June 10 */
  const [month, setMonth] = useState(0); /* 0 = June 2025 */
  const [sf2Exported, setSf2Exported] = useState(false);

  function setStatus(sid:number, date:number, s:AStatus) {
    setAttData(p=>({...p,[sid]:{...(p[sid]||{}),[date]:s}}));
  }
  function getStatus(sid:number, date:number): AStatus {
    return (attData[sid]?.[date]) ?? "P";
  }
  function countFor(sid:number, s:AStatus) {
    return ATT_DATES.filter(d=>getStatus(sid,d)===s).length;
  }
  function classCount(s:AStatus) {
    return students.filter(st=>getStatus(st.id,selectedDate)===s).length;
  }

  const MONTHS = ["June 2025","July 2025","August 2025"];

  const SUB_BTNS: {id:AttSub, label:string, icon:React.ElementType}[] = [
    { id:"daily",  label:"Daily Attendance",    icon:CalendarCheck },
    { id:"qr",     label:"QR Attendance Records", icon:QrCode },
    { id:"manual", label:"Manual Attendance",   icon:UserCheck },
    { id:"late",   label:"Late Monitoring",     icon:Clock },
    { id:"sf2",    label:"SF2 Export",          icon:FileDown },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>

      {/* ── Sub-module nav bar ── */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {SUB_BTNS.map(b=>{
          const Icon = b.icon;
          const act = sub===b.id;
          return (
            <button key={b.id} onClick={()=>setSub(b.id)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 13px", borderRadius:4, cursor:"pointer", fontSize:12, fontWeight:act?700:500, transition:"all 0.12s",
                border: act?`1.5px solid ${C.m700}`:`1px solid ${C.borderMed}`,
                background: act?C.m700:"#fff",
                color: act?"#fff":C.t2 }}>
              <Icon size={13}/> {b.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════ 1. DAILY ATTENDANCE */}
      {sub==="daily" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 240px", gap:14 }}>
          <DocPanel title={`Daily Attendance — June ${selectedDate}, 2025`} icon={CalendarCheck}
            action={
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <button onClick={()=>setSelectedDate(d=>Math.max(2,d-1))} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:3, padding:"3px 7px", cursor:"pointer", color:"#fff", fontSize:11 }}>‹</button>
                <span style={{ color:"rgba(255,255,255,0.85)", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>Jun {selectedDate}</span>
                <button onClick={()=>setSelectedDate(d=>Math.min(31,d+1))} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:3, padding:"3px 7px", cursor:"pointer", color:"#fff", fontSize:11 }}>›</button>
              </div>
            }>
            {/* Quick stats bar */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderBottom:`1px solid ${C.border}` }}>
              {(["P","A","L","E"] as AStatus[]).map(s=>(
                <div key={s} style={{ padding:"8px", textAlign:"center", borderRight:`0.5px solid ${C.border}`, background:sBg(s)+"60" }}>
                  <div style={{ fontSize:18, fontWeight:700, color:sColor(s), fontFamily:"'JetBrains Mono',monospace" }}>{classCount(s)}</div>
                  <div style={{ fontSize:9, color:sColor(s), textTransform:"uppercase", letterSpacing:"0.07em" }}>{s==="P"?"Present":s==="A"?"Absent":s==="L"?"Late":"Excused"}</div>
                </div>
              ))}
            </div>
            {/* Student list with status toggle */}
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                  {["#","Student Name","LRN","Status","Action"].map(h=>(
                    <th key={h} style={{ textAlign:h==="Status"||h==="#"||h==="Action"?"center":"left", padding:"8px 12px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((st,i)=>{
                  const cur = getStatus(st.id, selectedDate);
                  return (
                    <tr key={st.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}>
                      <td style={{ padding:"8px 12px", textAlign:"center", fontSize:10, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{i+1}</td>
                      <td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color:C.t1 }}>{st.surname}, {st.first}</td>
                      <td style={{ padding:"8px 12px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{st.lrn}</td>
                      <td style={{ padding:"8px 12px", textAlign:"center" }}>
                        <Stamp label={cur} color={sColor(cur)} bg={sBg(cur)} />
                      </td>
                      <td style={{ padding:"8px 12px" }}>
                        <div style={{ display:"flex", gap:4, justifyContent:"center" }}>
                          {(["P","A","L","E"] as AStatus[]).map(s=>(
                            <button key={s} onClick={()=>setStatus(st.id,selectedDate,s)}
                              style={{ width:26, height:22, borderRadius:3, fontSize:9, fontWeight:700, cursor:"pointer", transition:"all 0.1s",
                                border: cur===s?`1.5px solid ${sColor(s)}`:`1px solid ${C.borderMed}`,
                                background: cur===s?sBg(s):"#fff",
                                color: cur===s?sColor(s):C.t3 }}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button style={{ fontSize:11, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:4, padding:"6px 16px", cursor:"pointer" }}>
                Save attendance
              </button>
            </div>
          </DocPanel>

          {/* Right: monthly mini-calendar */}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <DocPanel title="June 2025" icon={Calendar}>
              <div style={{ padding:12 }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:4 }}>
                  {["M","T","W","T","F"].map((d,i)=><div key={i} style={{ textAlign:"center", fontSize:9, fontWeight:700, color:C.t3 }}>{d}</div>)}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3 }}>
                  {ATT_DATES.map(d=>{
                    const classP = students.filter(st=>getStatus(st.id,d)==="P").length;
                    const pct = Math.round(classP/students.length*100);
                    const dotCol = pct>=90?C.green:pct>=75?C.amber:C.red;
                    return (
                      <button key={d} onClick={()=>setSelectedDate(d)}
                        style={{ borderRadius:3, padding:"5px 2px", textAlign:"center", cursor:"pointer", border:selectedDate===d?`1.5px solid ${C.m700}`:`0.5px solid ${C.border}`, background:selectedDate===d?C.m50:"#fff" }}>
                        <div style={{ fontSize:10, color:selectedDate===d?C.m700:C.t2, fontWeight:selectedDate===d?700:400 }}>{d}</div>
                        <div style={{ width:6, height:6, borderRadius:10, background:dotCol, margin:"2px auto 0" }} />
                      </button>
                    );
                  })}
                </div>
                <div style={{ display:"flex", gap:10, marginTop:10, justifyContent:"center" }}>
                  {[[C.green,"≥90%"],[C.amber,"≥75%"],[C.red,"<75%"]].map(([c,l])=>(
                    <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <div style={{ width:7, height:7, borderRadius:10, background:c }} />
                      <span style={{ fontSize:9, color:C.t3 }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </DocPanel>
            <DocPanel title="June Summary" icon={Activity}>
              {[["Present","18",C.green],["Absent","4",C.red],["Late","5",C.amber],["Excused","0",C.teal]].map(([l,v,c])=>(
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 14px", borderBottom:`0.5px solid ${C.border}` }}>
                  <span style={{ fontSize:12, color:C.t2 }}>{l}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</span>
                </div>
              ))}
              <div style={{ padding:"10px 14px" }}>
                <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>Class rate</div>
                <div style={{ fontSize:22, fontWeight:700, color:C.green, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>91.0%</div>
                <Stamp label="Good Standing" color={C.green} bg={C.greenBg} />
              </div>
            </DocPanel>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ 2. QR ATTENDANCE RECORDS */}
      {sub==="qr" && (
        <DocPanel title="QR Attendance Records — June 10, 2025" icon={QrCode}
          action={<span style={{ fontSize:10, color:"rgba(255,255,255,0.6)" }}>{QR_LOG.length} scans today</span>}>
          <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, background:C.paper, border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"5px 10px", flex:1 }}>
              <Search size={12} color={C.t3} />
              <input placeholder="Search by name or LRN…" style={{ border:"none", background:"transparent", outline:"none", fontSize:12, color:C.t1, flex:1 }} />
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {(["All","Tap in","Tap out"] as const).map(f=>(
                <button key={f} style={{ padding:"4px 10px", borderRadius:4, fontSize:11, fontWeight:500, cursor:"pointer", border:`1px solid ${C.borderMed}`, background:"#fff", color:C.t2 }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                {["Time","Student Name","LRN","Scan Type","Status"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"8px 14px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QR_LOG.map((r,i)=>(
                <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.t2, whiteSpace:"nowrap" }}>{r.time}</td>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{r.name}</td>
                  <td style={{ padding:"9px 14px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{r.lrn}</td>
                  <td style={{ padding:"9px 14px" }}>
                    <Stamp label={r.type} color={r.type==="Tap in"?C.blue:C.t2} bg={r.type==="Tap in"?C.blueBg:C.ledger} />
                  </td>
                  <td style={{ padding:"9px 14px" }}>
                    <Stamp label={r.status} color={sColor(r.status)} bg={sBg(r.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:11, color:C.t3 }}>{QR_LOG.length} scan entries · June 10, 2025</span>
            <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:4, padding:"5px 12px", cursor:"pointer" }}>
              <Download size={12}/> Export log
            </button>
          </div>
        </DocPanel>
      )}

      {/* ══════════════════════════════════════════ 3. MANUAL ATTENDANCE */}
      {sub==="manual" && (
        <DocPanel title="Manual Attendance — Monthly Grid" icon={UserCheck}
          action={
            <div style={{ display:"flex", gap:5, alignItems:"center" }}>
              <button onClick={()=>setMonth(m=>Math.max(0,m-1))} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:3, padding:"3px 7px", cursor:"pointer", color:"#fff", fontSize:11 }}>‹</button>
              <span style={{ color:"rgba(255,255,255,0.85)", fontSize:11 }}>{MONTHS[month]}</span>
              <button onClick={()=>setMonth(m=>Math.min(MONTHS.length-1,m+1))} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:3, padding:"3px 7px", cursor:"pointer", color:"#fff", fontSize:11 }}>›</button>
            </div>
          }>
          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"collapse", fontSize:11 }}>
              <colgroup>
                <col style={{ width:160 }}/>
                {ATT_DATES.map(d=><col key={d} style={{ width:34 }}/>)}
                <col style={{ width:46 }}/><col style={{ width:46 }}/><col style={{ width:46 }}/><col style={{ width:52 }}/>
              </colgroup>
              <thead>
                <tr style={{ background:C.m800 }}>
                  <th style={{ textAlign:"left", padding:"7px 10px", fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.7)", textTransform:"uppercase", letterSpacing:"0.07em", position:"sticky", left:0, background:C.m800 }}>Student Name</th>
                  {ATT_DATES.map(d=>(
                    <th key={d} style={{ textAlign:"center", padding:"7px 2px", fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.7)", borderLeft:`0.5px solid rgba(255,255,255,0.08)` }}>{d}</th>
                  ))}
                  {["P","A","L","Rate"].map(h=>(
                    <th key={h} style={{ textAlign:"center", padding:"7px 4px", fontSize:9, fontWeight:700, color:h==="P"?"#86efac":h==="A"?"#fca5a5":h==="L"?"#fcd34d":"rgba(255,255,255,0.7)", borderLeft:`1.5px solid rgba(255,255,255,0.15)` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((st,i)=>{
                  const p=countFor(st.id,"P"), a=countFor(st.id,"A"), l=countFor(st.id,"L");
                  const rate=Math.round((p/(ATT_DATES.length))*100);
                  return (
                    <tr key={st.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}>
                      <td style={{ padding:"6px 10px", fontSize:11, fontWeight:600, color:C.t1, position:"sticky", left:0, background:i%2===0?"#fff":C.paper, whiteSpace:"nowrap", borderRight:`1px solid ${C.borderMed}` }}>
                        {st.surname}, {st.first.split(" ")[0]}
                      </td>
                      {ATT_DATES.map(d=>{
                        const s=getStatus(st.id,d);
                        return (
                          <td key={d} style={{ textAlign:"center", padding:"4px 1px", borderLeft:`0.5px solid ${C.border}` }}>
                            <button onClick={()=>setStatus(st.id,d,s==="P"?"A":s==="A"?"L":s==="L"?"E":"P")}
                              style={{ width:22, height:20, borderRadius:2, fontSize:8, fontWeight:700, cursor:"pointer", border:`0.5px solid ${sColor(s)}30`, background:sBg(s)+"80", color:sColor(s) }}>
                              {s}
                            </button>
                          </td>
                        );
                      })}
                      <td style={{ textAlign:"center", padding:"6px 4px", borderLeft:`1.5px solid ${C.borderMed}`, fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:600, color:C.green }}>{p}</td>
                      <td style={{ textAlign:"center", padding:"6px 4px", borderLeft:`0.5px solid ${C.border}`, fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:600, color:a>0?C.red:C.t3 }}>{a}</td>
                      <td style={{ textAlign:"center", padding:"6px 4px", borderLeft:`0.5px solid ${C.border}`, fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:600, color:l>0?C.amber:C.t3 }}>{l}</td>
                      <td style={{ textAlign:"center", padding:"6px 4px", borderLeft:`1.5px solid ${C.borderMed}`, fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, color:rate>=90?C.green:rate>=75?C.amber:C.red }}>{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:10, color:C.t3 }}>Click any cell to cycle: P → A → L → E → P</span>
            <button style={{ fontSize:11, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:4, padding:"6px 16px", cursor:"pointer" }}>Save changes</button>
          </div>
        </DocPanel>
      )}

      {/* ══════════════════════════════════════════ 4. LATE MONITORING */}
      {sub==="late" && (
        <DocPanel title="Late Monitoring — June 2025" icon={Clock}>
          <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, background:C.paper, border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"5px 10px", flex:1 }}>
              <Search size={12} color={C.t3} />
              <input placeholder="Search student…" style={{ border:"none", background:"transparent", outline:"none", fontSize:12, color:C.t1, flex:1 }} />
            </div>
            <Stamp label={`${students.filter(s=>countFor(s.id,"L")>0).length} students late this month`} color={C.amber} bg={C.amberBg} />
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                {["Student","LRN","Late Count","Late Dates","Threshold","Action"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"8px 14px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((st,i)=>{
                const lateCount = countFor(st.id,"L");
                const lateDates = ATT_DATES.filter(d=>getStatus(st.id,d)==="L");
                const threshold = lateCount>=5?"Critical":lateCount>=3?"Warning":"Good";
                return (
                  <tr key={st.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                    <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{st.surname}, {st.first}</td>
                    <td style={{ padding:"9px 14px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{st.lrn}</td>
                    <td style={{ padding:"9px 14px" }}>
                      <span style={{ fontSize:16, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:lateCount>=3?C.amber:lateCount>0?"#D97706":C.t3 }}>{lateCount}</span>
                    </td>
                    <td style={{ padding:"9px 14px" }}>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {lateDates.length===0
                          ? <span style={{ fontSize:11, color:C.t3 }}>—</span>
                          : lateDates.map(d=>(
                              <span key={d} style={{ fontSize:10, background:C.amberBg, color:C.amber, padding:"1px 6px", borderRadius:3, fontFamily:"'JetBrains Mono',monospace" }}>Jun {d}</span>
                            ))
                        }
                      </div>
                    </td>
                    <td style={{ padding:"9px 14px" }}>
                      <Stamp label={threshold} color={threshold==="Critical"?C.red:threshold==="Warning"?C.amber:C.green} bg={threshold==="Critical"?C.redBg:threshold==="Warning"?C.amberBg:C.greenBg} />
                    </td>
                    <td style={{ padding:"9px 14px" }}>
                      {lateCount>=3 && (
                        <button style={{ fontSize:10, fontWeight:600, color:C.m700, background:C.m100, border:`1px solid rgba(139,30,30,0.2)`, borderRadius:4, padding:"4px 8px", cursor:"pointer" }}>
                          Notify parent
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:11, color:C.t3 }}>3 lates = Warning · 5 lates = Critical (requires parent notification)</span>
            <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:4, padding:"5px 12px", cursor:"pointer" }}>
              <Download size={12}/> Export late report
            </button>
          </div>
        </DocPanel>
      )}

      {/* ══════════════════════════════════════════ 5. SF2 EXPORT */}
      {sub==="sf2" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* SF2 header */}
          <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>School Form 2 (SF2) — Learner's Attendance Record</div>
              <div style={{ fontSize:12, color:C.t3, marginTop:2 }}>Grade 8 — Rizal · Mathematics 8 · June 2025 · Q1</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, color:C.t2, background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"7px 14px", cursor:"pointer" }}>
                <Printer size={13}/> Print preview
              </button>
              <button onClick={()=>setSf2Exported(true)} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:700, color:C.m900, background:C.gold, border:"none", borderRadius:4, padding:"8px 18px", cursor:"pointer" }}>
                <FileDown size={14}/> Export SF2
              </button>
            </div>
          </div>

          {sf2Exported && (
            <div style={{ background:C.greenBg, border:`1px solid rgba(22,101,52,0.25)`, borderRadius:4, padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
              <CheckCircle size={14} color={C.green} />
              <span style={{ fontSize:12, color:C.green, fontWeight:600 }}>SF2 exported successfully · June 2025 · Grade 8 Rizal</span>
              <button onClick={()=>setSf2Exported(false)} style={{ marginLeft:"auto", fontSize:10, color:C.green, background:"none", border:"none", cursor:"pointer" }}>✕</button>
            </div>
          )}

          {/* SF2 document preview */}
          <DocPanel title="SF2 Document Preview" icon={FileSpreadsheet}>
            <div style={{ padding:"16px 20px 12px", borderBottom:`1px solid ${C.border}`, textAlign:"center" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:"0.07em" }}>Republic of the Philippines · Department of Education</div>
              <div style={{ fontSize:15, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginTop:3 }}>Sindalan National High School</div>
              <div style={{ fontSize:11, color:C.t2 }}>School Form 2 (SF2) — Learner's Attendance Record</div>
              <div style={{ display:"flex", justifyContent:"center", gap:24, marginTop:8, fontSize:11, color:C.t2 }}>
                {[["School Year","SY 2025–2026"],["Grade & Section","Grade 8 — Rizal"],["Month","June 2025"],["Subject","Mathematics 8"]].map(([l,v])=>(
                  <div key={l} style={{ borderBottom:`1px solid ${C.borderMed}`, paddingBottom:4 }}>
                    <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:C.t1 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ overflowX:"auto", padding:"8px 0" }}>
              <table style={{ borderCollapse:"collapse", fontSize:10, margin:"0 12px" }}>
                <colgroup>
                  <col style={{ width:30 }}/><col style={{ width:160 }}/>
                  {ATT_DATES.map(d=><col key={d} style={{ width:26 }}/>)}
                  <col style={{ width:36 }}/><col style={{ width:36 }}/><col style={{ width:36 }}/><col style={{ width:46 }}/>
                </colgroup>
                <thead>
                  <tr style={{ background:C.m800 }}>
                    <th style={{ padding:"5px 3px", color:"rgba(255,255,255,0.7)", textAlign:"center", fontSize:8 }}>#</th>
                    <th style={{ padding:"5px 8px", color:"rgba(255,255,255,0.7)", textAlign:"left", fontSize:8, letterSpacing:"0.06em" }}>LEARNER'S NAME</th>
                    {ATT_DATES.map(d=><th key={d} style={{ padding:"5px 1px", color:"rgba(255,255,255,0.7)", textAlign:"center", fontSize:8, borderLeft:`0.5px solid rgba(255,255,255,0.1)` }}>{d}</th>)}
                    {["P","A","L","RATE"].map(h=><th key={h} style={{ padding:"5px 3px", color:h==="P"?"#86efac":h==="A"?"#fca5a5":h==="L"?"#fcd34d":"rgba(255,255,255,0.7)", textAlign:"center", fontSize:8, borderLeft:`1px solid rgba(255,255,255,0.2)` }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {students.map((st,i)=>{
                    const p=countFor(st.id,"P"), a=countFor(st.id,"A"), l=countFor(st.id,"L");
                    const rate=Math.round((p/ATT_DATES.length)*100);
                    return (
                      <tr key={st.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}>
                        <td style={{ padding:"5px 3px", textAlign:"center", fontSize:9, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{i+1}</td>
                        <td style={{ padding:"5px 8px", fontSize:10, fontWeight:600, color:C.t1, whiteSpace:"nowrap" }}>{st.surname}, {st.first}</td>
                        {ATT_DATES.map(d=>{
                          const s=getStatus(st.id,d);
                          return <td key={d} style={{ textAlign:"center", borderLeft:`0.5px solid ${C.border}`, padding:"3px 1px" }}>
                            <span style={{ fontSize:8, fontWeight:700, color:sColor(s) }}>{s}</span>
                          </td>;
                        })}
                        <td style={{ textAlign:"center", borderLeft:`1px solid ${C.borderMed}`, padding:"5px 3px", fontSize:10, fontWeight:600, color:C.green, fontFamily:"'JetBrains Mono',monospace" }}>{p}</td>
                        <td style={{ textAlign:"center", borderLeft:`0.5px solid ${C.border}`, padding:"5px 3px", fontSize:10, fontWeight:600, color:a>0?C.red:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{a}</td>
                        <td style={{ textAlign:"center", borderLeft:`0.5px solid ${C.border}`, padding:"5px 3px", fontSize:10, fontWeight:600, color:l>0?C.amber:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{l}</td>
                        <td style={{ textAlign:"center", borderLeft:`1px solid ${C.borderMed}`, padding:"5px 3px", fontSize:10, fontWeight:700, color:rate>=90?C.green:rate>=75?C.amber:C.red, fontFamily:"'JetBrains Mono',monospace" }}>{rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"10px 20px", borderTop:`1px solid ${C.border}`, display:"grid", gridTemplateColumns:"1fr 1fr", gap:32 }}>
              {[["Prepared by","Ana R. Soriano","Class Adviser"],["Noted by","Dr. Maria Santos","Principal"]].map(([lbl,name,role])=>(
                <div key={lbl}>
                  <div style={{ fontSize:9, color:C.t3, marginBottom:16 }}>{lbl}:</div>
                  <div style={{ borderTop:`1px solid ${C.t1}`, paddingTop:4 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.t1 }}>{name}</div>
                    <div style={{ fontSize:10, color:C.t3 }}>{role}</div>
                  </div>
                </div>
              ))}
            </div>
          </DocPanel>
        </div>
      )}
    </div>
  );
}
