import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { AStatus, AttSub } from '../../shared/types';
import { sColor, sBg } from '../../shared/utils/helpers';
import { CalendarCheck, QrCode, FileDown, Plus, Search, Download, Printer, CheckCircle, FileSpreadsheet, Clock, UserCheck, Calendar, Activity, FileText, Loader2, Paperclip } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { DocPanel } from '../../shared/components/DocPanel';
import { useAppContext } from '../../shared/AppContext';
import { useAttendance } from '../shared/useAttendance';
import { useBlocker } from 'react-router';
import { academicApi } from '../../../api/academic.api';
import { studentApi } from '../../../api/student.api';
import { EmptyState } from '../../shared/components/EmptyState';

export function AttendanceHub({ classId }: { classId: string }) {
  const { gateAttendance } = useAppContext();
  const { records, roster, isLoading, isSaving, saveBulkAttendance } = useAttendance(classId);

  const [sub, setSub] = useState<AttSub>("daily");

  /* per-student per-date status: { enrollmentId: { dateNumber: status } } */
  const [attData, setAttData] = useState<Record<string,Record<number,AStatus>>>({});
  
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); 
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const ATT_DATES = Array.from({length: daysInMonth}, (_, i) => i + 1);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const monthNameOnly = currentDate.toLocaleString('default', { month: 'long' });
  const monthStr = (month + 1).toString().padStart(2, '0');

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return (today.getFullYear() === year && today.getMonth() === month) ? today.getDate() : 1;
  });
  const [sf2Exported, setSf2Exported] = useState(false);

  const [excuses, setExcuses] = useState<any[]>([]);
  const [loadingExcuses, setLoadingExcuses] = useState(false);
  const [excuseError, setExcuseError] = useState("");

  useEffect(() => {
    if (sub === "excuses") {
      setLoadingExcuses(true);
      academicApi.getMyExcuseLetters()
        .then(data => setExcuses(data))
        .catch(err => setExcuseError(err?.response?.data?.error || "Failed to load excuse letters"))
        .finally(() => setLoadingExcuses(false));
    }
  }, [sub]);

  const handleUpdateExcuse = async (id: string, newStatus: string) => {
    try {
      await academicApi.updateExcuseStatus(id, newStatus);
      setExcuses(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
    } catch (err) {
      alert("Failed to update status");
    }
  };

  useEffect(() => {
    const newData: Record<string,Record<number,AStatus>> = {};
    records.forEach(r => {
      // Assuming r.date is ISO format like 2025-06-10T00:00:00.000Z
      const day = new Date(r.date).getUTCDate(); 
      if (!newData[r.enrollment_id]) newData[r.enrollment_id] = {};
      newData[r.enrollment_id][day] = r.status;
    });
    setAttData(newData);
  }, [records]);

  function setStatus(enrollmentId:string, date:number, s:AStatus) {
    // Optimistic UI update
    setAttData(p=>({...p,[enrollmentId]:{...(p[enrollmentId]||{}),[date]:s}}));
    
    // Auto-save silently in background
    const dateStr = `${year}-${monthStr}-${date.toString().padStart(2,'0')}`;
    saveBulkAttendance([{ studentEnrollmentId: enrollmentId, date: dateStr, status: s }], true)
      .catch(e => console.error("Auto-save failed", e));
  }
  function getStatus(enrollmentId:string, date:number): AStatus {
    return (attData[enrollmentId]?.[date]) ?? "P";
  }
  function countFor(enrollmentId:string, s:AStatus) {
    return ATT_DATES.filter(d=>getStatus(enrollmentId,d)===s).length;
  }
  function classCount(s:AStatus) {
    return roster.filter(st=>getStatus(st.id,selectedDate)===s).length;
  }

  const handleSaveDaily = async () => {
    const updates = roster.map(st => ({
      studentEnrollmentId: st.id,
      date: `${year}-${monthStr}-${selectedDate.toString().padStart(2,'0')}`,
      status: getStatus(st.id, selectedDate)
    }));
    await saveBulkAttendance(updates);
    alert('Attendance saved successfully!');
  };

  const handleSaveManual = async () => {
    const updates: {studentEnrollmentId:string, date:string, status:AStatus}[] = [];
    roster.forEach(st => {
      ATT_DATES.forEach(d => {
        updates.push({
          studentEnrollmentId: st.id,
          date: `${year}-${monthStr}-${d.toString().padStart(2,'0')}`,
          status: getStatus(st.id, d)
        });
      });
    });
    await saveBulkAttendance(updates);
    alert('Monthly attendance saved successfully!');
  };

  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));

  const handleExportSF2 = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Learner's Name,";
    for (let i = 1; i <= 31; i++) csvContent += `${i},`;
    csvContent += "Total Absent,Total Tardy\n";
    
    roster.forEach(st => {
      let row = `"${st.student.last_name}, ${st.student.first_name}",`;
      let aCount = 0;
      let lCount = 0;
      for (let i = 1; i <= daysInMonth; i++) {
        // For mockup, if day is not in ATT_DATES, we might just put blank or standard P. 
        // We'll put the recorded status or blank if not recorded.
        const s = attData[st.id]?.[i] || "";
        if (s === "A") aCount++;
        if (s === "L") lCount++;
        row += `${s},`;
      }
      row += `${aCount},${lCount}\n`;
      csvContent += row;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SF2_Export_${monthName.replace(" ", "")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSf2Exported(true);
  };

  const SUB_BTNS: {id:AttSub, label:string, icon:React.ElementType}[] = [
    { id:"daily",  label:"Daily Attendance",    icon:CalendarCheck },
    { id:"qr",     label:"QR Attendance Records", icon:QrCode },
    { id:"manual", label:"Manual Attendance",   icon:UserCheck },
    { id:"late",   label:"Late Monitoring",     icon:Clock },
    { id:"sf2",    label:"SF2 Export",          icon:FileDown },
    { id:"excuses" as any, label:"Excuse Letters", icon:FileText },
  ];

  if (isLoading) {
    return <div style={{ padding: 40, display:"flex", justifyContent:"center" }}><Loader2 className="animate-spin text-gray-400" size={24}/></div>;
  }

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
          <DocPanel title={`Daily Attendance - ${monthNameOnly} ${selectedDate}, ${year}`} icon={CalendarCheck}
            action={
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <button onClick={()=>setSelectedDate(d=>Math.max(2,d-1))} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:3, padding:"3px 7px", cursor:"pointer", color:"#fff", fontSize:11 }}>‹</button>
                <span style={{ color:"rgba(255,255,255,0.85)", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{monthNameOnly.substring(0,3)} {selectedDate}</span>
                <button onClick={()=>setSelectedDate(d=>Math.min(daysInMonth,d+1))} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:3, padding:"3px 7px", cursor:"pointer", color:"#fff", fontSize:11 }}>›</button>
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
                {roster.map((st,i)=>{
                  const cur = getStatus(st.id, selectedDate);
                  return (
                    <tr key={st.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}>
                      <td style={{ padding:"8px 12px", textAlign:"center", fontSize:10, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{i+1}</td>
                      <td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color:C.t1 }}>{st.student.last_name}, {st.student.first_name}</td>
                      <td style={{ padding:"8px 12px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{st.student.lrn}</td>
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
            <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:10, color:C.t3 }}>Changes are saved automatically.</span>
              <div style={{ fontSize:11, fontWeight:600, color:isSaving ? C.amber : C.green, display:"flex", alignItems:"center", gap:6 }}>
                {isSaving && <Loader2 size={12} className="animate-spin" />}
                {isSaving ? "Saving..." : "All changes saved"}
              </div>
            </div>
          </DocPanel>

          {/* Right: monthly mini-calendar */}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <DocPanel title={monthName} icon={Calendar}>
              <div style={{ padding:12 }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:4 }}>
                  {["M","T","W","T","F"].map((d,i)=><div key={i} style={{ textAlign:"center", fontSize:9, fontWeight:700, color:C.t3 }}>{d}</div>)}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3 }}>
                  {ATT_DATES.map(d=>{
                    const classP = roster.filter(st=>getStatus(st.id,d)==="P").length;
                    const pct = roster.length > 0 ? Math.round(classP/roster.length*100) : 0;
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
              </div>
            </DocPanel>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ 3. MANUAL ATTENDANCE */}
      {sub==="manual" && (
        <DocPanel title="Manual Attendance - Monthly Grid" icon={UserCheck}
          action={
            <div style={{ display:"flex", gap:5, alignItems:"center" }}>
              <button onClick={prevMonth} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:3, padding:"3px 7px", cursor:"pointer", color:"#fff", fontSize:11 }}>‹</button>
              <span style={{ color:"rgba(255,255,255,0.85)", fontSize:11 }}>{monthName}</span>
              <button onClick={nextMonth} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:3, padding:"3px 7px", cursor:"pointer", color:"#fff", fontSize:11 }}>›</button>
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
                {roster.map((st,i)=>{
                  const p=countFor(st.id,"P"), a=countFor(st.id,"A"), l=countFor(st.id,"L");
                  const rate=Math.round((p/(ATT_DATES.length))*100);
                  return (
                    <tr key={st.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}>
                      <td style={{ padding:"6px 10px", fontSize:11, fontWeight:600, color:C.t1, position:"sticky", left:0, background:i%2===0?"#fff":C.paper, whiteSpace:"nowrap", borderRight:`1px solid ${C.borderMed}` }}>
                        {st.student.last_name}, {st.student.first_name.split(" ")[0]}
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
            <span style={{ fontSize:10, color:C.t3 }}>Click any cell to cycle: P → A → L → E → P (Saved automatically)</span>
            <div style={{ fontSize:11, fontWeight:600, color:isSaving ? C.amber : C.green, display:"flex", alignItems:"center", gap:6 }}>
                {isSaving && <Loader2 size={12} className="animate-spin" />}
                {isSaving ? "Saving..." : "All changes saved"}
            </div>
          </div>
        </DocPanel>
      )}

      {/* ══════════════════════════════════════════ 4. LATE MONITORING */}
      {sub==="late" && (
        <DocPanel title={`Late Monitoring - ${monthName}`} icon={Clock}>
          <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, background: "transparent", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"5px 10px", flex:1 }}>
              <Search size={12} color={C.t3} />
              <input placeholder="Search student…" style={{ border:"none", background:"transparent", outline:"none", fontSize:12, color:C.t1, flex:1 }} />
            </div>
            <Stamp label={`${roster.filter(s=>countFor(s.id,"L")>0).length} students late this month`} color={C.amber} bg={C.amberBg} />
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
              {roster.map((st,i)=>{
                const lateCount = countFor(st.id,"L");
                const lateDates = ATT_DATES.filter(d=>getStatus(st.id,d)==="L");
                const threshold = lateCount>=5?"Critical":lateCount>=3?"Warning":"Good";
                return (
                  <tr key={st.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                    <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{st.student.last_name}, {st.student.first_name}</td>
                    <td style={{ padding:"9px 14px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{st.student.lrn}</td>
                    <td style={{ padding:"9px 14px" }}>
                      <span style={{ fontSize:16, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:lateCount>=3?C.amber:lateCount>0?"#D97706":C.t3 }}>{lateCount}</span>
                    </td>
                    <td style={{ padding:"9px 14px" }}>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {lateDates.length===0
                          ? <span style={{ fontSize:11, color:C.t3 }}>-</span>
                          : lateDates.map(d=>(
                              <span key={d} style={{ fontSize:10, background:C.amberBg, color:C.amber, padding:"1px 6px", borderRadius:3, fontFamily:"'JetBrains Mono',monospace" }}>{monthNameOnly.substring(0,3)} {d}</span>
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
        <DocPanel title="School Form 2 (SF2) - Daily Attendance Report" icon={FileDown}>
          <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:16, alignItems:"center", textAlign:"center", background:C.m50 }}>
            <FileSpreadsheet size={48} color={C.m700} style={{ opacity:0.8 }} />
            <div>
              <h2 style={{ fontSize:16, fontWeight:700, color:C.t1, margin:0, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>DepEd SF2 Generation Ready</h2>
              <p style={{ fontSize:12, color:C.t2, margin:"4px 0 0 0", maxWidth:400 }}>
                This tool automatically compiles the daily attendance logs into the standard DepEd School Form 2 format. You can export it as a CSV file to open in Excel.
              </p>
            </div>
            
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, width:"100%", maxWidth:400, marginTop:10 }}>
              <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:6, padding:"12px" }}>
                <div style={{ fontSize:24, fontWeight:800, color:C.t1, fontFamily:"'JetBrains Mono',monospace" }}>{roster.length}</div>
                <div style={{ fontSize:10, color:C.t3, textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:700 }}>Total Learners</div>
              </div>
              <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:6, padding:"12px" }}>
                <div style={{ fontSize:24, fontWeight:800, color:C.t1, fontFamily:"'JetBrains Mono',monospace" }}>{monthNameOnly}</div>
                <div style={{ fontSize:10, color:C.t3, textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:700 }}>Report Month</div>
              </div>
            </div>

            <button onClick={handleExportSF2} style={{ marginTop:10, display:"flex", alignItems:"center", gap:8, fontSize:13, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:6, padding:"10px 24px", cursor:"pointer", transition:"all 0.15s", boxShadow:"0 4px 12px rgba(37,99,235,0.2)" }}
              onMouseEnter={e=>(e.currentTarget.style.transform="translateY(-1px)")}
              onMouseLeave={e=>(e.currentTarget.style.transform="translateY(0)")}>
              <Download size={16}/> Download SF2 (CSV)
            </button>
            
            {sf2Exported && (
              <div style={{ display:"flex", alignItems:"center", gap:6, color:C.green, fontSize:12, fontWeight:600, marginTop:4 }}>
                <CheckCircle size={14} /> Download initiated successfully!
              </div>
            )}
          </div>
        </DocPanel>
      )}

      {/* ══════════════════════════════════════════ 6. EXCUSE LETTERS */}
      {sub==="excuses" && (
        <DocPanel title="Excuse Letters" icon={FileText}>
          {loadingExcuses ? (
            <div style={{ padding: 40, display:"flex", justifyContent:"center" }}><Loader2 className="animate-spin text-gray-400" size={24}/></div>
          ) : excuseError ? (
            <div style={{ padding: 20, textAlign: "center", color: C.red, fontSize: 12 }}>{excuseError}</div>
          ) : excuses.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No excuse letters"
              description="There are no excuse letters submitted to you at this time."
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
                    {["Student", "Dates", "Reason", "Status", "Actions"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excuses.map((excuse, i) => (
                    <tr key={excuse.id} style={{ borderBottom: `1px solid ${C.borderMed}`, background: i % 2 === 0 ? "#fff" : C.paper }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>
                          {excuse.student?.user?.last_name}, {excuse.student?.user?.first_name}
                        </div>
                        <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{excuse.student?.current_section?.name || "N/A"}</div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 11, color: C.t1 }}>
                        {new Date(excuse.start_date).toLocaleDateString()} to {new Date(excuse.end_date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 11, color: C.t2, maxWidth: 300, whiteSpace: "normal" }}>
                        {excuse.reason}
                        {excuse.document_id && (
                          <div style={{ marginTop: 8 }}>
                            <button 
                              onClick={async () => {
                                try {
                                  const presignRes: any = await studentApi.getPresignedDownloadUrl(excuse.document_id);
                                  const url = presignRes?.url || presignRes?.data?.url;
                                  if (url) {
                                    window.open(url.startsWith('http') ? url : `http://localhost:5000${url}`, '_blank');
                                  } else {
                                    alert("Failed to load attachment");
                                  }
                                } catch (e) {
                                  alert("Failed to load attachment");
                                }
                              }}
                              type="button"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.blue, fontSize: 10, fontWeight: 600, padding: 0, cursor: "pointer" }}
                            >
                              <Paperclip size={10} /> View Attachment
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <Stamp
                          label={excuse.status}
                          color={excuse.status === 'Approved' ? C.green : excuse.status === 'Rejected' ? C.red : C.amber}
                          bg={excuse.status === 'Approved' ? C.greenBg : excuse.status === 'Rejected' ? C.redBg : C.amberBg}
                        />
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {excuse.status === "Pending Review" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => handleUpdateExcuse(excuse.id, "Approved")} style={{ background: C.greenBg, color: C.green, border: `1px solid ${C.green}30`, padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 600 }}>
                              Approve
                            </button>
                            <button onClick={() => handleUpdateExcuse(excuse.id, "Rejected")} style={{ background: C.redBg, color: C.red, border: `1px solid ${C.red}30`, padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 600 }}>
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DocPanel>
      )}
    </div>
  );
}