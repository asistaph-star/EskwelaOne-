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
export function DashboardScreen({ onNav, onClassClick, onShowGradeCard }: { onNav:(s:TScreen)=>void, onClassClick:(id:number)=>void, onShowGradeCard:(info:GradeCardInfo)=>void }) {
  const [detailStudent, setDetailStudent] = useState<typeof SECTION_GRADES[string][0]|null>(null);
  return (
    <div style={{ flex:1, overflowY:"auto", padding:24, background:C.paper }}>

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
              <span style={{ background:"rgba(234,179,8,0.15)", color:"#FDE047", padding:"2px 8px", borderRadius:12, fontWeight:600, border:"1px solid rgba(234,179,8,0.3)" }}>
                Teacher II
              </span>
              <span style={{ background:"rgba(59,130,246,0.15)", color:"#93C5FD", padding:"2px 8px", borderRadius:12, fontWeight:600, border:"1px solid rgba(59,130,246,0.3)" }}>
                Up for evaluation
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI metrics strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, marginBottom:20 }}>
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
            <div key={idx} style={{ background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "16px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

      {/* Main grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:14 }}>
        <div>
          {/* Class cards */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>My Assigned Sections — SY 2025–2026</div>
            <button onClick={()=>onNav("classroom")} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:C.m700, background:C.m100, border:`1px solid rgba(139,30,30,0.2)`, padding:"5px 11px", borderRadius:5, cursor:"pointer" }}>
              Classroom Hub <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:18 }}>
            {MY_CLASSES.map(cls => (
              <button key={cls.id} onClick={()=>onClassClick(cls.id)}
                style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:8, overflow:"hidden", cursor:"pointer", textAlign:"left", transition:"all 0.15s", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.m500; (e.currentTarget as HTMLElement).style.boxShadow=`0 4px 16px rgba(139,30,30,0.06)`;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.border; (e.currentTarget as HTMLElement).style.boxShadow="none";}}>
                
                {/* Header Section */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:C.m700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{cls.subject}</div>
                    <div style={{ color:C.t1, fontSize:20, fontWeight:800, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1 }}>{cls.section}</div>
                  </div>
                  <Stamp label={`Gr. ${cls.grade}`} color={C.m800} bg={C.m50} />
                </div>
                
                {/* Ledger fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#fafafa", padding: 10, borderRadius: 6, border: `1px solid ${C.border}` }}>
                  {[["Enrolled",`${cls.students}`],["Term",cls.semester],["Role",cls.adviser?"Class Adviser":"Subject Only"]].map(([l,v]) => (
                    <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems: "center" }}>
                      <span style={{ fontSize:9.5, color:C.t3, fontWeight:600 }}>{l}</span>
                      <span style={{ fontSize:10, color:cls.adviser&&l==="Role"?C.m700:C.t1, fontWeight:700 }}>{v}</span>
                    </div>
                  ))}
                </div>
                
                {/* Progress Bar */}
                <div style={{ marginTop: "auto" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
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

          {/* Class Grade Summary Widget — clicking a name opens grade drawer */}
          <ClassGradeSummary onStudentClick={id=>{
            const all = Object.values(SECTION_GRADES).flat();
            const found = all.find(s=>s.id===id);
            if(found) onShowGradeCard({ name:`${found.surname}, ${found.first}`, section:"Rizal", grade:8 });
          }} />
        </div>

        {/* RIGHT COLUMN */}
        <div>
          <DocPanel title="Today's Class Schedule" icon={Calendar}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                  <th style={{ textAlign:"left", padding:"8px 12px", fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em" }}>Subject &amp; Section</th>
                  <th style={{ textAlign:"right", padding:"8px 12px", fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em" }}>Time &amp; Room</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { sub: "Mathematics 8", sec: "8-Rizal", time: "7:30 AM - 8:30 AM", rm: "Bldg. A, Rm 101" },
                  { sub: "Science 9", sec: "9-Einstein", time: "9:00 AM - 10:00 AM", rm: "Bldg. A, Science Lab" },
                  { sub: "Filipino 10", sec: "10-Pilot", time: "10:30 AM - 11:30 AM", rm: "Bldg. B, Rm 204" },
                  { sub: "Mathematics 8", sec: "8-Rizal (Remedial)", time: "1:30 PM - 2:30 PM", rm: "Bldg. A, Rm 101" }
                ].map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: idx < 3 ? `1px solid ${C.border}` : "none", background: idx % 2 === 0 ? "#fff" : C.paper }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{s.sub}</div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Section: {s.sec}</div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.t2 }}>{s.time}</div>
                      <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>{s.rm}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DocPanel>

          {/* Quick Actions Panel */}
          <div style={{ height: 16 }} />
          <DocPanel title="Quick Actions" icon={Wrench}>
            <div style={{ padding:10, display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {[
                { icon:CalendarCheck, label:"Record Attendance", color:C.green,  bg:C.greenBg,  action: () => onNav("attendance-direct") },
                { icon:FileText,      label:"Enter Grades",      color:C.m700,   bg:C.m100,     action: () => onNav("grades-direct") },
                { icon:FileDown,      label:"Export SF2",        color:C.blue,   bg:C.blueBg,   action: () => onNav("templates") },
                { icon:Download,      label:"Download Form 138", color:C.purple, bg:C.purpleBg, action: () => onNav("templates") }
              ].map((a, idx) => {
                const Icon = a.icon;
                return (
                  <button key={idx} onClick={a.action}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", border:`1px solid ${C.borderMed}`, borderRadius:4, background:"#fff", cursor:"pointer", transition:"background 0.15s", width:"100%" }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#fff";}}>
                    <div style={{ width:24, height:24, borderRadius:4, background:a.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon size={12} color={a.color} /></div>
                    <span style={{ fontSize:11, fontWeight:500, color:C.t2 }}>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </DocPanel>
        </div>
      </div>

      {/* Student Detail overlay */}
      {detailStudent && (
        <StudentDetailOverlay student={detailStudent} onClose={()=>setDetailStudent(null)} />
      )}
    </div>
  );
}


