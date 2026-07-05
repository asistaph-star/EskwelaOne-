import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { TScreen, GradeCardInfo } from '../../shared/types';
import { STUDENTS_GR8, MY_CLASSES, GRADEBOOK } from '../../App';
import { AttendanceHub } from '../attendance/AttendanceHub';
import { GradebookFullScreen } from '../grades/GradebookFullScreen';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, AreaChart, Area } from 'recharts';
import { ArrowRight, Sparkles, Users, CalendarCheck, FileText, BarChart2, ChevronRight, Printer, Download, Target, X, ClipboardList, Activity } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { DocPanel } from '../../shared/components/DocPanel';
import { gradeColor, calcGrade } from '../../shared/utils/helpers';
import { BAR_DATA, PIE_DATA, TREND_DATA } from '../../shared/constants/seedData';
import { StudentReportCard } from '../../student/components/StudentReportCard';

type HubTab = "students" | "attendance" | "assignments" | "gradebook" | "analytics";
export function ClassroomHub({ classId, onBack, onShowGradeCard }: { classId:number, onBack:()=>void, onShowGradeCard?:(info:GradeCardInfo)=>void }) {
  const [tab, setTab] = useState<HubTab>("students");
  const cls = MY_CLASSES.find(c=>c.id===classId) ?? MY_CLASSES[0];
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [profileStudent, setProfileStudent] = useState<typeof STUDENTS_GR8[0]|null>(null);

  const TABS: { id:HubTab, label:string, icon:React.ElementType }[] = [
    { id:"students",   label:"Students",   icon:Users },
    { id:"attendance", label:"Attendance", icon:CalendarCheck },
    { id:"assignments",label:"Assignments",icon:ClipboardList },
    { id:"gradebook",  label:"Gradebook",  icon:FileText },
    { id:"analytics",  label:"Analytics",  icon:BarChart2 },
  ];

  return (
    <div style={{ flex:1, overflowY:"auto", background:C.paper }}>
      {/* Section header */}
      <div style={{ background:"#fff", borderBottom:`2px solid ${C.m700}`, padding:"12px 24px" }}>
        <div style={{ display:"flex", gap:5, alignItems:"center", fontSize:11, color:C.t3, marginBottom:8 }}>
          <button onClick={onBack} style={{ color:C.m700, background:"none", border:"none", cursor:"pointer", fontWeight:600, fontSize:11 }}>Dashboard</button>
          <ChevronRight size={11} color={C.t3} />
          <span style={{ color:C.t1, fontWeight:600 }}>Grade {cls.grade} — {cls.section}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Classroom Hub — Grade {cls.grade} {cls.section}</div>
            <div style={{ fontSize:12, color:C.t3, marginTop:2 }}>{cls.subject} · {cls.students} students · {cls.semester} · SY 2025–2026</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Stamp label={`Grade ${cls.grade}`} color="#fff" bg={C.m700} />
            <Stamp label={`${cls.completion}% Complete`} color={C.green} bg={C.greenBg} />
            {cls.adviser && <Stamp label="Class Adviser" color={C.gold} bg={C.goldLight} />}
          </div>
        </div>
        {/* 5-module quick stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginTop:12 }}>
          {[
            { icon:Users,       label:"Students",   value:`${cls.students}`, sub:"enrolled", color:C.m700 },
            { icon:CalendarCheck,label:"Attendance", value:"94.2%",          sub:"this week", color:C.green },
            { icon:ClipboardList,label:"Assignments",value:"3 Active",       sub:"this week", color:C.teal },
            { icon:FileText,    label:"Gradebook",  value:"Q1 Open",        sub:"12 pending", color:C.amber },
            { icon:BarChart2,   label:"Analytics",  value:"82.4",           sub:"class avg",  color:C.purple },
          ].map((s,i) => {
            const Icon = s.icon;
            return (
              <button key={i} onClick={()=>setTab(TABS[i].id)}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:4, border:`1px solid ${tab===TABS[i].id?s.color+"60":C.border}`, background:tab===TABS[i].id?C.m50:"transparent", cursor:"pointer", transition:"all 0.12s" } as React.CSSProperties}>
                <div style={{ width:28, height:28, borderRadius:5, background:`${s.color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon size={13} color={s.color} />
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.t1, fontFamily:"'JetBrains Mono',monospace" }}>{s.value}</div>
                  <div style={{ fontSize:9, color:C.t3 }}>{s.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.borderMed}`, display:"flex", padding:"0 24px" }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const act = tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"11px 18px", background:"none", border:"none", cursor:"pointer", borderBottom:act?`2px solid ${C.m700}`:"2px solid transparent", color:act?C.m700:C.t3, fontSize:12, fontWeight:act?700:400, marginBottom:-1, transition:"color 0.12s" }}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding:24 }}>

        {/* ── STUDENTS TAB ── */}
        {tab==="students" && (
          <DocPanel title="Student Roster — Grade 8 Rizal" icon={Users}
            action={<div style={{ display:"flex", gap:6 }}>
              <button style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.7)", background:"rgba(255,255,255,0.12)", border:"none", borderRadius:4, padding:"4px 10px", cursor:"pointer" }}>Student QR</button>
              <button style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.7)", background:"rgba(255,255,255,0.12)", border:"none", borderRadius:4, padding:"4px 10px", cursor:"pointer" }}>Parent Contacts</button>
              <button style={{ fontSize:10, fontWeight:600, color:C.m900, background:C.gold, border:"none", borderRadius:4, padding:"4px 10px", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>+ Add Student</button>
            </div>}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                  {["#","LRN","Student Name","Gen. Avg","Attendance","Status","Action"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"9px 14px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STUDENTS_GR8.map((s,i) => (
                  <tr key={s.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                    <td style={{ padding:"10px 14px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{i+1}</td>
                    <td style={{ padding:"10px 14px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{s.lrn}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{s.surname}, {s.first}</div>
                    </td>
                    <td style={{ padding:"10px 14px" }}><span style={gradeColor(s.avg)}>{s.avg}</span></td>
                    <td style={{ padding:"10px 14px" }}>
                      <Stamp label={s.att} color={s.att==="Good Standing"?C.green:s.att==="At Risk"?C.amber:C.red} bg={s.att==="Good Standing"?C.greenBg:s.att==="At Risk"?C.amberBg:C.redBg} />
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <Stamp label={s.status} color={s.status==="Passed"?C.green:C.red} bg={s.status==="Passed"?C.greenBg:C.redBg} />
                    </td>
                    <td style={{ padding:"10px 14px", display:"flex", gap:5 }}>
                      <button onClick={()=>onShowGradeCard?.({name:`${s.surname}, ${s.first}`,section:cls.section,grade:cls.grade})} style={{ fontSize:10, color:C.m700, background:C.m100, border:"none", borderRadius:4, padding:"4px 8px", cursor:"pointer" }}>Grades</button>
                      <button onClick={()=>setProfileStudent(s)} style={{ fontSize:10, color:C.t2, background:C.paper, border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 8px", cursor:"pointer" }}>Profile</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DocPanel>
        )}

        {/* ── ATTENDANCE TAB ── */}
        {tab==="attendance" && <AttendanceHub students={STUDENTS_GR8} />}

        {/* ── ASSIGNMENTS TAB ── */}
        {tab==="assignments" && (
          <DocPanel title="Class Assignments" icon={ClipboardList}
            action={<button style={{ fontSize:10, fontWeight:600, color:C.m900, background:C.gold, border:"none", borderRadius:4, padding:"4px 10px", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>+ Create Assignment</button>}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                  {["Title","Type","Due Date","Completion","Status"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"9px 14px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { title:"Chapter 3 Practice Exercises", type:"Written Work", due:"Tomorrow, 11:59 PM", comp:85, status:"Active" },
                  { title:"Science Project Proposal", type:"Performance Task", due:"Jun 15, 2025", comp:40, status:"Active" },
                  { title:"Weekly Quiz 1", type:"Assessment", due:"Jun 8, 2025", comp:100, status:"Closed" },
                ].map((a,i) => (
                  <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                    <td style={{ padding:"10px 14px", fontSize:13, fontWeight:600, color:C.t1 }}>{a.title}</td>
                    <td style={{ padding:"10px 14px", fontSize:11, color:C.t2 }}>{a.type}</td>
                    <td style={{ padding:"10px 14px", fontSize:11, color:C.t3 }}>{a.due}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ flex:1, height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
                          <div style={{ width:`${a.comp}%`, height:"100%", background:a.comp===100?C.green:C.teal }} />
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:C.t1 }}>{a.comp}%</span>
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <Stamp label={a.status} color={a.status==="Active"?C.teal:C.t3} bg={a.status==="Active"?C.tealBg:C.m50} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DocPanel>
        )}

        {/* ── GRADEBOOK TAB ── */}
        {tab==="gradebook" && (
          <div>
            {/* DepEd weight configurator */}
            <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"10px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>DepEd Component Weights</div>
              {[["Written Works (WW)","25"],["Performance Tasks (PT)","50"],["Quarterly Assessment (QA)","25"]].map(([l,v]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:11, color:C.t2 }}>{l}</span>
                  <div style={{ display:"flex", alignItems:"center", border:`1px solid ${C.borderMed}`, borderRadius:4, overflow:"hidden" }}>
                    <input defaultValue={v} style={{ width:36, textAlign:"center", border:"none", padding:"4px 6px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.t1, outline:"none" }} />
                    <span style={{ background:C.m50, color:C.t3, fontSize:11, padding:"4px 6px", borderLeft:`1px solid ${C.borderMed}` }}>%</span>
                  </div>
                </div>
              ))}
              <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
                <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:C.t2, background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"5px 10px", cursor:"pointer" }}><Printer size={11} /> Print</button>
                <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:4, padding:"5px 12px", cursor:"pointer" }}><Download size={11} /> Export Excel</button>
              </div>
            </div>

            <DocPanel title="Scholastic Record Ledger — Grade 8 Rizal · Mathematics 8 · Q1" icon={FileText}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:800 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign:"left", padding:"8px 14px", fontSize:9, fontWeight:700, color:"#fff", background:C.m700, borderRight:`1px solid rgba(255,255,255,0.15)`, minWidth:180 }}>Student Name</th>
                      <th colSpan={5} style={{ textAlign:"center", padding:"8px", fontSize:9, fontWeight:700, color:"#fff", background:"hsl(220,55%,32%)", borderRight:`1px solid rgba(255,255,255,0.15)` }}>WRITTEN WORKS (25%)</th>
                      <th colSpan={3} style={{ textAlign:"center", padding:"8px", fontSize:9, fontWeight:700, color:"#fff", background:"hsl(160,50%,28%)", borderRight:`1px solid rgba(255,255,255,0.15)` }}>PERFORMANCE TASKS (50%)</th>
                      <th style={{ textAlign:"center", padding:"8px", fontSize:9, fontWeight:700, color:"#fff", background:C.amber, borderRight:`1px solid rgba(255,255,255,0.15)`, whiteSpace:"nowrap" }}>QA (25%)</th>
                      <th style={{ textAlign:"center", padding:"8px", fontSize:9, fontWeight:700, color:C.m900, background:C.gold, whiteSpace:"nowrap" }}>Q-AVG</th>
                    </tr>
                    <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                      <th style={{ textAlign:"left", padding:"7px 14px", fontSize:9, color:C.t3, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>Name</th>
                      {["WW1","WW2","WW3","WW4","WW5"].map(h => <th key={h} style={{ textAlign:"center", padding:"7px 10px", fontSize:9, color:"hsl(220,55%,38%)", fontWeight:700, borderLeft:`0.5px solid ${C.border}` }}>{h}</th>)}
                      {["PT1","PT2","PT3"].map(h => <th key={h} style={{ textAlign:"center", padding:"7px 10px", fontSize:9, color:"hsl(160,50%,28%)", fontWeight:700, borderLeft:`0.5px solid ${C.border}` }}>{h}</th>)}
                      <th style={{ textAlign:"center", padding:"7px 10px", fontSize:9, color:C.amber, fontWeight:700, borderLeft:`0.5px solid ${C.border}` }}>Score</th>
                      <th style={{ textAlign:"center", padding:"7px 10px", fontSize:9, color:C.m700, fontWeight:700, borderLeft:`0.5px solid ${C.border}` }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GRADEBOOK.map((s,i) => {
                      const avg = parseFloat(calcGrade(s.ww, s.pt, s.qa));
                      return (
                        <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                          <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{s.name}</td>
                          {s.ww.map((g,j) => <td key={j} style={{ padding:"9px 10px", textAlign:"center", borderLeft:`0.5px solid ${C.border}` }}><span style={gradeColor(g)}>{g}</span></td>)}
                          {s.pt.map((g,j) => <td key={j} style={{ padding:"9px 10px", textAlign:"center", borderLeft:`0.5px solid ${C.border}` }}><span style={gradeColor(g)}>{g}</span></td>)}
                          <td style={{ padding:"9px 10px", textAlign:"center", borderLeft:`0.5px solid ${C.border}` }}><span style={gradeColor(s.qa)}>{s.qa}</span></td>
                          <td style={{ padding:"9px 10px", textAlign:"center", borderLeft:`0.5px solid ${C.border}` }}>
                            <span style={{ ...gradeColor(avg), fontWeight:700, fontSize:13 }}>{avg}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DocPanel>
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab==="analytics" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {/* Subject Performance */}
            <DocPanel title="Subject Performance Index" icon={BarChart2}>
              <div style={{ padding:16 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <RBarChart data={BAR_DATA} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis type="number" domain={[60,100]} tick={{fontSize:10,fill:C.t3,fontFamily:"'JetBrains Mono',monospace"}} />
                    <YAxis type="category" dataKey="subject" tick={{fontSize:10,fill:C.t2}} width={52} />
                    <Tooltip formatter={(v:number)=>[`${v}`,"Avg"]} contentStyle={{fontSize:12,borderRadius:4,border:`1px solid ${C.borderMed}`}} />
                    <Bar dataKey="avg" radius={[0,3,3,0]}>
                      {BAR_DATA.map((e,i) => <Cell key={`bar-${i}`} fill={e.avg<75?C.red:e.avg>=90?C.green:C.m700} />)}
                    </Bar>
                  </RBarChart>
                </ResponsiveContainer>
              </div>
            </DocPanel>

            {/* Grade distribution */}
            <DocPanel title="Grade Distribution" icon={Target}>
              <div style={{ padding:16, display:"flex", alignItems:"center", gap:16 }}>
                <PieChart width={130} height={130}>
                  <Pie data={PIE_DATA} cx={60} cy={60} innerRadius={38} outerRadius={58} paddingAngle={2} dataKey="value">
                    {PIE_DATA.map((e,i) => <Cell key={`pie-${i}`} fill={e.color} />)}
                  </Pie>
                </PieChart>
                <div>
                  {PIE_DATA.map((d,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:d.color, flexShrink:0 }} />
                      <span style={{ fontSize:11, color:C.t2, flex:1 }}>{d.name}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:d.color, fontFamily:"'JetBrains Mono',monospace" }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </DocPanel>

            {/* Attendance trend */}
            <DocPanel title="Attendance Trend (6 Weeks)" icon={CalendarCheck}>
              <div style={{ padding:16 }}>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={TREND_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="week" tick={{fontSize:10,fill:C.t3}} />
                    <YAxis domain={[80,100]} tick={{fontSize:10,fill:C.t3,fontFamily:"'JetBrains Mono',monospace"}} unit="%" />
                    <Tooltip formatter={(v:number)=>[`${v}%`,"Attendance"]} contentStyle={{fontSize:12,borderRadius:4}} />
                    <Line type="monotone" dataKey="att" stroke={C.m700} strokeWidth={2} dot={{fill:C.m700,r:3}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </DocPanel>

            {/* Assignment Completion Rates */}
            <DocPanel title="Assignment Completion Rates" icon={ClipboardList}>
              <div style={{ padding:16 }}>
                <ResponsiveContainer width="100%" height={160}>
                  <RBarChart data={[{name:"W1",rate:95},{name:"W2",rate:88},{name:"W3",rate:92},{name:"W4",rate:85}]}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize:10,fill:C.t3}} axisLine={false} tickLine={false} />
                    <YAxis domain={[0,100]} tick={{fontSize:10,fill:C.t3,fontFamily:"'JetBrains Mono',monospace"}} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip formatter={(v:number)=>[`${v}%`,"Completion"]} cursor={{fill:"rgba(0,0,0,0.05)"}} contentStyle={{fontSize:12,borderRadius:4}} />
                    <Bar dataKey="rate" fill={C.teal} radius={[3,3,0,0]} />
                  </RBarChart>
                </ResponsiveContainer>
              </div>
            </DocPanel>

            {/* Classroom Activity */}
            <DocPanel title="Classroom Activity" icon={Activity}>
              <div style={{ padding:16 }}>
                <div style={{ fontSize:10, color:C.t3, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:700 }}>Daily Active Students</div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={[{day:"Mon",val:38},{day:"Tue",val:40},{day:"Wed",val:39},{day:"Thu",val:41},{day:"Fri",val:37}]}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.purple} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={C.purple} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="day" tick={{fontSize:10,fill:C.t3}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{fontSize:12,borderRadius:4}} />
                    <Area type="monotone" dataKey="val" stroke={C.purple} fillOpacity={1} fill="url(#colorVal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </DocPanel>

            {/* AI Executive Summary */}
            <DocPanel title="AI Executive Summary" icon={Sparkles}>
              <div style={{ padding:16 }}>
                <div style={{ borderLeft:`3px solid ${C.gold}`, paddingLeft:12, marginBottom:14 }}>
                  <div style={{ fontSize:10, color:C.gold, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4, display:"flex", alignItems:"center", gap:5 }}><Sparkles size={10} color={C.gold} /> AI Diagnostic Report · June 10, 2025</div>
                  {aiDone ? (
                    <p style={{ fontSize:12, color:C.t1, lineHeight:1.7, margin:0 }}>
                      <strong>Class Average:</strong> 82.4 — above the passing threshold.<br/>
                      <strong>Students at Risk (below 75):</strong> Espino, Hannah Grace (68.5), Hernandez, Mark Ryan (71.0), Bondoc, Ramon Jr. (74.2) — recommend immediate remediation in fractions and algebraic expressions.<br/>
                      <strong>Attendance concern:</strong> Espino (3 lates), Hernandez (2 absences) — coordinate with parents.<br/>
                      <strong>Teaching strategy:</strong> Introduce peer-mentoring pairs; assign Cruz, Ferrer as math tutors for identified students.
                    </p>
                  ) : (
                    <p style={{ fontSize:12, color:C.t3, lineHeight:1.7, margin:0, fontStyle:"italic" }}>Click "Generate Report" to produce an AI-powered diagnostic summary of your class, naming struggling students and recommending intervention strategies.</p>
                  )}
                </div>
                <button onClick={()=>{ setAiLoading(true); setTimeout(()=>{setAiLoading(false);setAiDone(true);},1800); }}
                  style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 16px", background:aiDone?C.m50:C.m700, color:aiDone?C.m700:"#fff", border:aiDone?`1px solid ${C.borderMed}`:"none", borderRadius:4, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                  <Sparkles size={12} />
                  {aiLoading?"Generating…":aiDone?"Regenerate":"Generate AI Report"}
                </button>
                <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[["Espino, Hannah",68.5,"red"],["Hernandez, Mark",71.0,"red"],["Bondoc, Ramon",74.2,"amber"],["Delos Reyes, Daniel",81.7,"—"]].map(([n,avg,risk]) => (
                    <div key={n} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 10px", background:risk==="red"?C.redBg:risk==="amber"?C.amberBg:C.paper, borderRadius:4, border:`0.5px solid ${C.border}` }}>
                      <span style={{ fontSize:11, color:C.t1, fontWeight:500 }}>{n}</span>
                      <span style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:risk==="red"?C.red:risk==="amber"?C.amber:C.t2, fontWeight:600 }}>{avg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </DocPanel>
          </div>
        )}
      </div>

      {/* ── Student Profile overlay (Report Card) ── */}
      {profileStudent && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(15,8,8,0.6)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"24px 20px", overflowY:"auto" }}
          onClick={e=>{ if(e.target===e.currentTarget) setProfileStudent(null); }}>
          <div style={{ width:"100%", maxWidth:900, borderRadius:4, overflow:"hidden", boxShadow:"0 20px 60px rgba(74,10,16,0.4)", background:"#fff" }}>
            {/* Overlay controls */}
            <div style={{ background:C.m900, padding:"8px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ color:"rgba(255,255,255,0.7)", fontSize:11 }}>Student Report Card — {profileStudent.surname}, {profileStudent.first}</span>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.7)", background:"rgba(255,255,255,0.1)", border:"none", borderRadius:3, padding:"4px 10px", cursor:"pointer" }}>
                  <Printer size={11}/> Print
                </button>
                <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.7)", background:"rgba(255,255,255,0.1)", border:"none", borderRadius:3, padding:"4px 10px", cursor:"pointer" }}>
                  <Download size={11}/> PDF
                </button>
                <button onClick={()=>setProfileStudent(null)} style={{ width:26, height:26, borderRadius:3, background:"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <X size={14}/>
                </button>
              </div>
            </div>
            <StudentReportCard student={{ surname:profileStudent.surname, first:profileStudent.first, lrn:profileStudent.lrn, grade:(profileStudent as any).grade ?? 8, section:(profileStudent as any).section ?? "Rizal", adviser:"Ana R. Soriano", gender:(profileStudent as any).gender ?? "male" } as any} />
          </div>
        </div>
      )}
    </div>
  );
}