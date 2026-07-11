import React, { useState } from 'react';
import { TScreen, GradeCardInfo } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import { TODAY_SCHED, UPCOMING, STUDENTS_GR8, MY_CLASSES } from '../../App';
import { CalendarCheck, FileText, Users, AlertCircle, BarChart2, Bell, Search, ChevronDown, ChevronLeft, ChevronRight, Building2, ArrowRight, Calendar, Wrench, FileDown, Download, BookMarked } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { StatBox } from '../../shared/components/StatBox';
import { DocPanel } from '../../shared/components/DocPanel';
import { ClassGradeSummary } from './ClassGradeSummary';
import { SECTION_GRADES } from '../../shared/constants/seedData';
import { StudentDetailOverlay } from '../../shared/components/StudentDetailOverlay';
import { useAppContext } from '../../shared/AppContext';

export function DashboardScreen({ onNav, onGradebookClick, onHubClick, onShowGradeCard }: { onNav:(s:TScreen)=>void, onGradebookClick:(id:number)=>void, onHubClick:(id:number)=>void, onShowGradeCard:(info:GradeCardInfo)=>void }) {
  const [detailStudent, setDetailStudent] = useState<typeof SECTION_GRADES[string][0]|null>(null);
  const { excuseLetters, updateExcuseLetter, announcements } = useAppContext();
  
  return (
    <div style={{ flex:1, overflowY:"auto", background: "transparent", padding: "24px 32px" }}>
      <div style={{ width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
        


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
                <div style={{ fontSize:14, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>My Assigned Sections</div>
                <button onClick={()=>onNav("classroom")} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, fontWeight:600, color:C.m700, background:C.m100, border:`1px solid rgba(139,30,30,0.2)`, padding:"4px 10px", borderRadius:4, cursor:"pointer" }}>
                  Classroom Hub <ArrowRight size={10} />
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                {MY_CLASSES.map(cls => (
                  <div key={cls.id} style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", display: "flex", flexDirection: "column", boxShadow: "0 6px 20px rgba(139,30,30,0.05)" }}>
                    
                    {/* Main Card Body -> Routes to Gradebook */}
                    <button className="hover-zoom" onClick={()=>onGradebookClick(cls.id)}
                      style={{ padding: 18, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}
                      onMouseEnter={e=>{ (e.currentTarget.parentElement as HTMLElement).style.borderColor=C.m500; }}
                      onMouseLeave={e=>{ (e.currentTarget.parentElement as HTMLElement).style.borderColor=C.border; }}>
                      
                      {/* Header Section */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:C.m700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{cls.subject}</div>
                          <div style={{ color:C.t1, fontSize:20, fontWeight:800, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1 }}>{cls.section}</div>
                        </div>
                      </div>
                      
                      {/* Ledger fields (School Year, Grade, Section emphasize) */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#fafafa", padding: 10, borderRadius: 6, border: `1px solid ${C.border}`, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.02)" }}>
                        {[["School Year","SY 2025–2026"],["Grade Level",`Grade ${cls.grade}`],["Section",cls.section]].map(([l,v]) => (
                          <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems: "center" }}>
                            <span style={{ fontSize:9.5, color:C.t3, fontWeight:600 }}>{l}</span>
                            <span style={{ fontSize:10, color:C.t1, fontWeight:700 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </button>

                    {/* Secondary actions */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `1px solid ${C.border}` }}>
                      <button onClick={()=>onGradebookClick(cls.id)} style={{ padding: "8px", background: C.paper, border: "none", borderRight: `1px solid ${C.border}`, cursor: "pointer", fontSize: 10, fontWeight: 700, color: C.m700, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "background 0.12s" }} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=C.m50} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=C.paper}>
                        <FileText size={12} /> Gradebook
                      </button>
                      <button onClick={()=>onHubClick(cls.id)} style={{ padding: "8px", background: C.paper, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, color: C.t2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "background 0.12s" }} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=C.m50} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=C.paper}>
                        <Users size={12} /> Open Hub
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
            
            {/* Announcements */}
            <div style={{ marginBottom: 16 }}>
              <DocPanel title="School Announcements" icon={BookMarked}>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {announcements.map((a, i) => (
                    <div key={i} style={{ background: C.paper, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.m800 }}>{a.title}</div>
                        <div style={{ fontSize: 9, color: C.t3 }}>{a.timestamp.split(',')[0]}</div>
                      </div>
                      <div style={{ fontSize: 10, color: C.t2, lineHeight: 1.4 }}>{a.body}</div>
                    </div>
                  ))}
                </div>
              </DocPanel>
            </div>


          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            


            {/* Quick Actions */}
            <DocPanel title="Quick Actions" icon={Wrench} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
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
                      style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px", border:`1px solid ${C.borderMed}`, borderRadius:8, background:"#fff", cursor:"pointer", transition:"all 0.15s", width:"100%", flex: 1 }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50; (e.currentTarget as HTMLElement).style.borderColor=C.borderHeavy;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#fff"; (e.currentTarget as HTMLElement).style.borderColor=C.borderMed;}}>
                      <div style={{ width:32, height:32, borderRadius:8, background:a.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Icon size={16} color={a.color} /></div>
                      <span style={{ fontSize:12.5, fontWeight:600, color:C.t2 }}>{a.label}</span>
                      <ChevronRight size={16} color={C.t3} style={{ marginLeft: "auto" }} />
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


