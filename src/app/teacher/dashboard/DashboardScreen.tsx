import React, { useState } from 'react';
import { TScreen, GradeCardInfo } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import { TODAY_SCHED, UPCOMING, STUDENTS_GR8, MY_CLASSES } from '../../App';
import { CalendarCheck, FileText, Users, AlertCircle, BarChart2, Bell, Search, ChevronDown, ChevronLeft, ChevronRight, Building2, ArrowRight, Calendar, Wrench, FileDown, Download } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { StatBox } from '../../shared/components/StatBox';
import { DocPanel } from '../../shared/components/DocPanel';
import { ClassGradeSummary } from './ClassGradeSummary';
import { SECTION_GRADES } from '../../shared/constants/seedData';
import { StudentDetailOverlay } from '../../shared/components/StudentDetailOverlay';
import { useAppContext } from '../../shared/AppContext';

export function DashboardScreen({ onNav, onClassClick, onShowGradeCard }: { onNav:(s:TScreen)=>void, onClassClick:(id:number)=>void, onShowGradeCard:(info:GradeCardInfo)=>void }) {
  const [detailStudent, setDetailStudent] = useState<typeof SECTION_GRADES[string][0]|null>(null);
  const { excuseLetters, updateExcuseLetter } = useAppContext();
  
  return (
    <div style={{ flex:1, overflowY:"auto", background:C.paper, padding: "24px 32px" }}>
      <div style={{ width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
        
        {/* Official header block */}
        <div style={{ background:C.m800, borderRadius:4, overflow:"hidden", marginBottom:20 }}>
          <div style={{ background:`linear-gradient(90deg, ${C.m900} 0%, ${C.m800} 50%, ${C.m700} 100%)`, padding:"18px 24px 14px", display:"flex", alignItems:"center", gap:18 }}>
            <div style={{ width:52, height:52, borderRadius:10, background:"rgba(200,134,10,0.18)", border:`1.5px solid rgba(200,134,10,0.45)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Building2 size={22} color={C.gold} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:"rgba(255,255,255,0.5)", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:3 }}>Republic of the Philippines · Department of Education</div>
              <div style={{ color:"#fff", fontSize:18, fontWeight:700, fontFamily:"'Fraunces',serif", lineHeight:1.2 }}>Sindalan National High School</div>
              <div style={{ color:"rgba(255,255,255,0.55)", fontSize:11, marginTop:4 }}>Sindalan, City of San Fernando, Pampanga · Division of San Fernando City</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:"rgba(255,255,255,0.6)", fontSize:10, letterSpacing:"0.06em" }}>GOOD MORNING</div>
              <div style={{ color:"#fff", fontSize:16, fontWeight:700, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Ms. Ana R. Soriano</div>
              <div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, marginTop:2, marginBottom:6 }}>Tuesday, June 10, 2025 &middot; Week 3, Q1</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:6, fontSize:10, color:"rgba(255,255,255,0.6)" }}>
                <span style={{ background:"rgba(34,197,94,0.15)", color:"#4ADE80", padding:"2px 8px", borderRadius:12, fontWeight:600, border:"1px solid rgba(34,197,94,0.3)" }}>
                  Teacher I
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI metrics strip */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:14, marginBottom:20 }}>
          {[
            { label: "Assigned Sections", val: "3", sub: "Gr. 8, 9, 10", icon: Users, color: C.m700, bg: C.m50 },
            { label: "Total Students",    val: "107", sub: "Across all sections", icon: Users, color: C.m700, bg: C.m50 },
            { label: "Today's Schedule",  val: "4 Classes", sub: "Classes today", icon: CalendarCheck, color: C.blue, bg: "#eff6ff" },
            { label: "Pending Grades",    val: "12 Items", sub: "Items to encode", icon: AlertCircle, color: "#f59e0b", bg: "#fefbeb" },
            { label: "Attendance Status", val: "94.2%", sub: "Schoolwide today", icon: BarChart2, color: C.green, bg: "#f0fdf4" },
            { label: "Upcoming Events",   val: "5", sub: "Events this week", icon: Bell, color: C.purple, bg: "#faf5ff" }
          ].map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className="hover-zoom" style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 6px 16px rgba(139,30,30,0.05)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)" }}>
                    <Icon size={14} color={kpi.color} />
                  </div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1.2 }}>{kpi.label}</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{kpi.val}</div>
                  <div style={{ fontSize: 10, color: kpi.color, fontWeight: 600, marginTop: 4 }}>{kpi.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Layout - 2 Column Masonry-style */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          
          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* Assigned Sections */}
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>My Assigned Sections — SY 2025–2026</div>
                <button onClick={()=>onNav("classroom")} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, fontWeight:600, color:C.m700, background:C.m100, border:`1px solid rgba(139,30,30,0.2)`, padding:"4px 10px", borderRadius:4, cursor:"pointer" }}>
                  Classroom Hub <ArrowRight size={10} />
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                {MY_CLASSES.map(cls => (
                  <button key={cls.id} className="hover-zoom" onClick={()=>onClassClick(cls.id)}
                    style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", cursor:"pointer", textAlign:"left", padding: 18, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 6px 20px rgba(139,30,30,0.05)" }}
                    onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.borderColor=C.m500; }}
                    onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.borderColor=C.border; }}>
                    
                    {/* Header Section */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:C.m700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{cls.subject}</div>
                        <div style={{ color:C.t1, fontSize:20, fontWeight:800, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1 }}>{cls.section}</div>
                      </div>
                      <Stamp label={`Gr. ${cls.grade}`} color={C.m800} bg={C.m50} />
                    </div>
                    
                    {/* Ledger fields */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#fafafa", padding: 10, borderRadius: 6, border: `1px solid ${C.border}`, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.02)" }}>
                      {[["Enrolled",`${cls.students}`],["Term",cls.semester],["Role",cls.adviser?"Class Adviser":"Subject Only"]].map(([l,v]) => (
                        <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems: "center" }}>
                          <span style={{ fontSize:9.5, color:C.t3, fontWeight:600 }}>{l}</span>
                          <span style={{ fontSize:10, color:cls.adviser&&l==="Role"?C.m700:C.t1, fontWeight:700 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Progress Bar */}
                    <div style={{ marginTop: "auto" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.05em", fontWeight: 700 }}>Completion</span>
                        <span style={{ fontSize:10, color:C.m700, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{cls.completion}%</span>
                      </div>
                      <div style={{ height:4, background:C.m100, borderRadius:2, overflow: "hidden" }}>
                        <div style={{ height:"100%", width:`${cls.completion}%`, background:C.m700, borderRadius:2 }} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Students Needing Attention */}
            <ClassGradeSummary onStudentClick={id=>{
              const all = Object.values(SECTION_GRADES).flat();
              const found = all.find(s=>s.id===id);
              if(found) {
                let sec = "Rizal"; let gr = 8;
                if (found.subject.includes("9")) { sec = "Einstein"; gr = 9; }
                if (found.subject.includes("10")) { sec = "Pilot"; gr = 10; }
                onShowGradeCard({ name:`${found.surname}, ${found.first}`, section:sec, grade:gr });
              }
            }} />

            {/* Tasks & Grades Split */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Excuse Letters Queue */}
              <DocPanel title="Excuse Letters Queue" icon={FileText}>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                  {excuseLetters.map((letter) => (
                    <div key={letter.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px", background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{letter.studentName}</div>
                          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{letter.section} • {letter.dates}</div>
                        </div>
                        <Stamp 
                          label={letter.status} 
                          color={letter.status === "Approved" ? C.green : letter.status === "Rejected" ? C.red : C.amber} 
                          bg={letter.status === "Approved" ? C.greenBg : letter.status === "Rejected" ? C.redBg : C.amberBg} 
                        />
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.m700, background: C.m50, padding: "6px 10px", borderRadius: 4, cursor: "pointer", alignSelf: "flex-start", fontWeight: 600 }}>
                        <FileText size={10}/> {letter.filename}
                      </div>

                      {letter.status === "Pending Review" && (
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <button onClick={() => updateExcuseLetter(letter.id, "Approved")} style={{ flex: 1, background: C.green, color: "#fff", border: "none", padding: "6px 0", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                          <button onClick={() => updateExcuseLetter(letter.id, "Rejected")} style={{ flex: 1, background: C.red, color: "#fff", border: "none", padding: "6px 0", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {excuseLetters.length === 0 && (
                    <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: C.t3 }}>No excuse letters in queue.</div>
                  )}
                </div>
              </DocPanel>

              {/* Pending Grades */}
              <DocPanel title="Pending Grades" icon={AlertCircle}>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                  {[
                    { sub: "Mathematics 8", sec: "8-Rizal", period: "Q1", status: "Missing 12 students" },
                    { sub: "Science 9", sec: "9-Einstein", period: "Q1", status: "Missing 5 students" },
                    { sub: "Filipino 10", sec: "10-Pilot", period: "Q1", status: "Missing 1 student" },
                  ].map((g, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4 }}>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{g.sub}</div>
                        <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{g.sec} • {g.period}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <Stamp label={g.status} color={C.amber} bg={C.amberBg} />
                        <button style={{ fontSize: 9, fontWeight: 700, background: C.m100, color: C.m700, border: "none", padding: "3px 8px", borderRadius: 4, cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e=>(e.target as HTMLElement).style.background=C.m200} onMouseLeave={e=>(e.target as HTMLElement).style.background=C.m100}>Continue Grading</button>
                      </div>
                    </div>
                  ))}
                </div>
              </DocPanel>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Next Class Countdown */}
            <div style={{ background: C.m800, borderRadius: 10, padding: "16px 20px", color: "#fff", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 6px 16px rgba(139,30,30,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CalendarCheck size={18} color={C.gold} />
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.7)" }}>Next Class Starts In</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 2 }}>Mathematics 8</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>8-Rizal • Rm 101</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.gold, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>00:42:15</div>
              </div>
            </div>

            {/* Today's Schedule */}
            <DocPanel title="Today's Schedule" icon={Calendar}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                    <th style={{ textAlign:"left", padding:"8px 12px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.06em" }}>Class</th>
                    <th style={{ textAlign:"right", padding:"8px 12px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.06em" }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { sub: "Mathematics 8", sec: "8-Rizal", time: "7:30 AM", status: "Done" },
                    { sub: "Science 9", sec: "9-Einstein", time: "9:00 AM", status: "Done" },
                    { sub: "Filipino 10", sec: "10-Pilot", time: "1:00 PM", status: "Upcoming" },
                  ].map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < 2 ? `1px solid ${C.border}` : "none", background: idx % 2 === 0 ? "#fff" : C.paper }}>
                      <td style={{ padding: "8px 12px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{s.sub}</div>
                        <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>{s.sec}</div>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: s.status==="Done"?C.green:C.t2 }}>{s.time}</div>
                        <div style={{ fontSize: 8.5, fontWeight: 600, color: C.t3, marginTop: 2, textTransform: "uppercase" }}>{s.status}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button style={{ width:"100%", padding:"8px", background:"#fff", borderTop:`1px solid ${C.border}`, borderBottom:"none", borderLeft:"none", borderRight:"none", fontSize:10, fontWeight:600, color:C.m700, cursor:"pointer", transition:"background 0.15s" }} onMouseEnter={e=>(e.target as HTMLElement).style.background=C.m50} onMouseLeave={e=>(e.target as HTMLElement).style.background="#fff"}>
                View Full Schedule
              </button>
            </DocPanel>

            {/* Quick Actions */}
            <DocPanel title="Quick Actions" icon={Wrench}>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon:CalendarCheck, label:"Take Attendance", color:C.green,  bg:C.greenBg,  action: () => onNav("attendance-direct") },
                  { icon:FileText,      label:"Encode Grades",      color:C.m700,   bg:C.m100,     action: () => onNav("grades-direct") },
                  { icon:AlertCircle,   label:"Add Student Note",   color:C.amber,  bg:C.amberBg,  action: () => {} },
                  { icon:BarChart2,     label:"Generate Report",    color:C.blue,   bg:C.blueBg,   action: () => onNav("templates") },
                  { icon:Download,      label:"Print SF10",         color:C.purple, bg:C.purpleBg, action: () => onNav("templates") }
                ].map((a, idx) => {
                  const Icon = a.icon;
                  return (
                    <button key={idx} onClick={a.action}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", border:`1px solid ${C.borderMed}`, borderRadius:6, background:"#fff", cursor:"pointer", transition:"all 0.15s", width:"100%" }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50; (e.currentTarget as HTMLElement).style.borderColor=C.borderHeavy;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#fff"; (e.currentTarget as HTMLElement).style.borderColor=C.borderMed;}}>
                      <div style={{ width:28, height:28, borderRadius:6, background:a.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon size={14} color={a.color} /></div>
                      <span style={{ fontSize:11.5, fontWeight:600, color:C.t2 }}>{a.label}</span>
                      <ChevronRight size={14} color={C.t3} style={{ marginLeft: "auto" }} />
                    </button>
                  );
                })}
              </div>
            </DocPanel>

          </div>
        </div>
      </div>
      
      {/* Student Detail overlay */}
      {detailStudent && (
        <StudentDetailOverlay student={detailStudent} onClose={()=>setDetailStudent(null)} />
      )}
    </div>
  );
}


