import React, { useState } from 'react';
import { PScreen, GradeCardInfo } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import { PTableHeader } from '../shared/PTableHeader';
import { TRAFFIC } from '../../shared/utils/helpers';
import { BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, CalendarCheck, BarChart2, Sparkles, Building2, AlertCircle, Activity, GraduationCap, BookMarked, Stethoscope, Package } from 'lucide-react';
import { P_TEACHERS, P_GATE_LOG, P_WELFARE } from '../../shared/constants/seedData';
import { useAppContext } from '../../shared/AppContext';
import { Send } from 'lucide-react';

function Stamp({ label, color, bg }: { label:string; color:string; bg:string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, background: bg }}>
      {label}
    </span>
  );
}

export function PDashboard({ onNav, onShowGradeCard }: { onNav:(s:PScreen)=>void; onShowGradeCard:(info:GradeCardInfo)=>void }) {
  const [aiDone, setAiDone] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  
  const { addAnnouncement } = useAppContext();
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annAudience, setAnnAudience] = useState("All");

  const [actionTab, setActionTab] = useState("Critical");
  const [timelineTab, setTimelineTab] = useState("Recent");

  function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!annTitle || !annBody) return;
    addAnnouncement({
      id: "ann-" + Date.now(),
      author: "Dr. Roberto Santos (Principal)",
      title: annTitle,
      body: annBody,
      audience: annAudience,
      timestamp: "Just now"
    });
    setAnnTitle("");
    setAnnBody("");
    alert("Announcement broadcasted successfully!");
  }

  const KPI_CARDS = [
    {
      v: "342 Enrolled",
      l: "Total Students",
      sub: "Male: 180 · Female: 162",
      subColor: C.t3,
      color: C.m700,
      bg: C.m100,
      icon: Users,
      dest: "p-monitoring"
    },
    {
      v: "18 Faculty",
      l: "Total Teachers",
      sub: "Full-Time JHS Staff",
      subColor: C.t3,
      color: C.m700,
      bg: C.m100,
      icon: GraduationCap,
      dest: "p-teachers"
    },
    {
      v: "8 Staff",
      l: "Total Staff",
      sub: "Support & Administration",
      subColor: C.t3,
      color: C.m700,
      bg: C.m100,
      icon: Building2,
      dest: "p-teachers"
    },
    {
      v: "12 Sections",
      l: "Total Active Sections",
      sub: "Grades 7 to 10",
      subColor: C.t3,
      color: C.m700,
      bg: C.m100,
      icon: BookMarked,
      dest: "p-templates"
    },
    {
      v: "94.2%",
      l: "Overall Attendance Rate Today",
      sub: "▲ +1.3% vs yesterday",
      subColor: C.green,
      color: C.green,
      bg: C.greenBg,
      icon: Activity,
      dest: "p-monitoring"
    },
    {
      v: "319 Inside",
      l: "Students Currently Inside School",
      sub: "Live QR Feed verified",
      subColor: C.green,
      color: C.green,
      bg: C.greenBg,
      icon: CalendarCheck,
      dest: "p-monitoring"
    },
    {
      v: "17 / 18",
      l: "Teachers Present Today",
      sub: "▼ -1 on leave (Pedro M.)",
      subColor: C.amber,
      color: C.amber,
      bg: C.amberBg,
      icon: GraduationCap,
      dest: "p-teachers"
    },
    {
      v: "6 Active",
      l: "Active Clinic Cases",
      sub: "2 resting in clinic",
      subColor: C.teal,
      color: C.teal,
      bg: C.tealBg,
      icon: Stethoscope,
      dest: "p-welfare"
    },
    {
      v: "2 Pending",
      l: "Pending Discipline Cases",
      sub: "Truancy & vandalism alerts",
      subColor: C.red,
      color: C.red,
      bg: C.redBg,
      icon: AlertCircle,
      dest: "p-welfare"
    }
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.paper, padding: "20px 24px" }}>
      
      {/* 1. TOP KPI CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div 
              key={kpi.l} 
              className="hover-zoom"
              onClick={() => onNav(kpi.dest as PScreen)}
              style={{ 
                background: "#fff", 
                border: `1.5px solid ${C.borderMed}`, 
                borderLeft: `5px solid ${kpi.color}`, 
                borderRadius: 4, 
                padding: "12px 18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{kpi.l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>{kpi.v}</div>
                <div style={{ fontSize: 10, color: kpi.subColor, fontWeight: 600, marginTop: 4 }}>{kpi.sub}</div>
              </div>
              <div style={{ background: kpi.bg, width: 34, height: 34, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color={kpi.color} />
              </div>
            </div>
          );
        })}
      </div>
      {/* ── Main Layout (Pro Restructure) ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* TOP SECTION: AI Executive Summary (Sleek Banner) */}
        <div className="hover-zoom" style={{ background: "linear-gradient(to right, #ffffff, #fdfbf7)", border: `1px solid ${C.borderMed}`, borderLeft: `4px solid ${C.gold}`, padding: "18px 24px", borderRadius: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Sparkles size={16} color={C.gold} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>AI School Executive Summary</span>
            <Stamp label="Automated" color={C.gold} bg={C.goldLight} />
          </div>
          <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0 }}>
              Good morning, Principal. Today's attendance is <strong style={{color: C.t1}}>94.2%</strong> (▲ 1.3%). One teacher is absent. Four students require immediate intervention. There are two behavior incidents requiring review. No emergency clinic cases have been reported.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button style={{ fontSize: 11, background: C.gold, color: "#fff", border: "none", padding: "6px 14px", borderRadius: 4, fontWeight: 600, cursor: "pointer" }}>Review Grade 9 Attendance</button>
              <button style={{ fontSize: 11, background: "#fff", color: C.gold, border: `1px solid ${C.gold}`, padding: "6px 14px", borderRadius: 4, fontWeight: 600, cursor: "pointer" }}>Follow up 2 interventions</button>
              <button style={{ fontSize: 11, background: "#fff", color: C.gold, border: `1px solid ${C.gold}`, padding: "6px 14px", borderRadius: 4, fontWeight: 600, cursor: "pointer" }}>Approve 1 leave request</button>
            </div>
          </div>
        </div>

        {/* 2-COLUMN PRO LAYOUT */}
        <div style={{ display: "grid", gridTemplateColumns: "65fr 35fr", gap: 24, alignItems: "start" }}>
          
          {/* LEFT COLUMN: Action Center & Broadcast */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* ACTION CENTER (Tabbed) */}
            <div className="hover-zoom" style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.m50 }}>
                {["Critical Alerts (6)", "Needs Attention (5)", "Pending Approvals (5)"].map(tab => {
                   const tabKey = tab.split(" ")[0];
                   const isActive = actionTab === tabKey;
                   return (
                     <button key={tab} onClick={() => setActionTab(tabKey)} style={{ flex: 1, padding: "14px 0", background: isActive ? "#fff" : "transparent", border: "none", borderBottom: isActive ? `2px solid ${C.m800}` : "2px solid transparent", color: isActive ? C.m800 : C.t3, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
                       {tab}
                     </button>
                   )
                })}
              </div>
              <div style={{ padding: 16, minHeight: 320 }}>
                {actionTab === "Critical" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { text: "Emergency Clinic Case: Student Aguilar, Liza Marie (8-Rizal) sent home with high fever", color: C.red, badge: "🔴 Critical" },
                      { text: "Urgent Intervention Needed: Ocampo, Renz Adrian (10-Pilot) skipped class 5 times consecutively", color: C.red, badge: "🔴 Critical" },
                      { text: "Severe Discipline Incident: Reyes, Carlo Jose (9-Einstein) reported for vandalism", color: C.amber, badge: "🟠 High" },
                      { text: "Teacher Absent: Navarro, Pedro M. (Master Teacher I) on leave today", color: "#B45309", badge: "🟡 Medium" },
                      { text: "Missing Attendance: Grade 8 Rizal (Soriano, A.) not yet submitted", color: C.blue, badge: "🔵 Info" },
                      { text: "Pending Grade Submissions: 12 teachers have not yet submitted Q1 grades", color: C.amber, badge: "🟠 High" }
                    ].map((alert, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 10, padding: "10px 14px", background: alert.badge.includes("🔴") ? `${C.redBg}50` : alert.badge.includes("🟠") ? `${C.amberBg}40` : alert.badge.includes("🟡") ? "#FEF3C7" : C.blueBg, border: `1px solid ${alert.color || C.borderMed}`, borderRadius: 4, alignItems: "center" }}>
                        <div style={{ flex: 1, fontSize: 11.5, color: C.t1, fontWeight: 500 }}>{alert.text}</div>
                        <Stamp label={alert.badge} color={alert.color || C.t1} bg="#fff" />
                      </div>
                    ))}
                  </div>
                )}
                {actionTab === "Needs" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { name: "Juan Dela Cruz", gr: "Grade 10", sec: "10-Pilot", issue: "5 Consecutive Absences", badge: "🔴 URGENT", color: C.red, bg: C.redBg },
                      { name: "Maria Santos", gr: "Grade 8", sec: "8-Rizal", issue: "Failing Mathematics", badge: "🟠 HIGH", color: C.amber, bg: C.amberBg },
                      { name: "James Reyes", gr: "Grade 9", sec: "9-Einstein", issue: "Guidance Referral", badge: "🟡 MONITOR", color: C.blue, bg: C.blueBg },
                      { name: "Ocampo, Renz Adrian", gr: "Grade 10", sec: "10-Pilot", issue: "Skipping Class (Behavioral)", badge: "🔴 URGENT", color: C.red, bg: C.redBg },
                      { name: "Aguilar, Liza Marie", gr: "Grade 8", sec: "8-Rizal", issue: "High Fever (Clinic emergency)", badge: "🔵 CLINIC", color: C.teal, bg: C.tealBg }
                    ].map((s, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: idx < 4 ? `1px solid ${C.border}` : "none" }}>
                        <div>
                          <button onClick={() => onShowGradeCard({ name: s.name, section: s.sec, grade: 8 })} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, textDecoration: "underline dotted" }}>{s.name}</span>
                          </button>
                          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{s.gr} &middot; {s.sec} &middot; <strong style={{ color: C.t2 }}>{s.issue}</strong></div>
                        </div>
                        <Stamp label={s.badge} color={s.color} bg={s.bg} />
                      </div>
                    ))}
                  </div>
                )}
                {actionTab === "Pending" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { type: "Teacher Leave Request", name: "Navarro, Pedro M. (1 Day Absent)", deadline: "Today, 5:00 PM" },
                      { type: "Schedule Swaps", name: "Gr. 9 Science Lab Swapping Request", deadline: "Tomorrow, 12:00 PM" },
                      { type: "Incident Report Signoff", name: "Carlo Jose Reyes Vandalism Review", deadline: "July 3, 2026" },
                      { type: "Inventory Acquisition", name: "Computer Lab Printer Toner Order", deadline: "July 5, 2026" },
                      { type: "Student Transfer Request", name: "Cruz, Maria L. Transfer out proposal", deadline: "July 7, 2026" }
                    ].map((app, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: idx < 4 ? `1px solid ${C.border}` : "none" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{app.type}</div>
                          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Submitted by: {app.name} &middot; <span style={{ color: C.red }}>{app.deadline}</span></div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => alert("Approved successfully!")} style={{ fontSize: 10, padding: "5px 10px", background: C.greenBg, border: `1px solid ${C.green}30`, color: C.green, cursor: "pointer", fontWeight: 700, borderRadius: 3 }}>Approve</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* BROADCAST ANNOUNCEMENT */}
            <div className="hover-zoom" style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", marginBottom: 16 }}>Broadcast Announcement</div>
              <form onSubmit={handleBroadcast} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: C.t2, marginBottom: 4 }}>Title</label>
                  <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} type="text" placeholder="e.g. Early Dismissal Tomorrow" style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: C.t2, marginBottom: 4 }}>Message Body</label>
                  <textarea value={annBody} onChange={e => setAnnBody(e.target.value)} placeholder="Type announcement details here..." style={{ width: "100%", height: 60, padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none", resize: "none" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: C.t2, marginBottom: 4 }}>Target Audience</label>
                    <select value={annAudience} onChange={e => setAnnAudience(e.target.value)} style={{ padding: "6px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 11, outline: "none" }}>
                      <option value="All">All Staff & Students</option>
                      <option value="Teachers">Teachers Only</option>
                      <option value="Students">Students Only</option>
                    </select>
                  </div>
                  <button type="submit" style={{ background: C.m700, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-end" }}>
                    <Send size={12} /> Broadcast
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: Metrics & Timelines */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* COMPACT METRICS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
               <div className="hover-zoom" style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                 <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, textTransform: "uppercase" }}>Attendance Today</div>
                 <div style={{ fontSize: 26, fontWeight: 800, color: C.green, marginTop: 4 }}>94.2%</div>
                 <div style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>▲ +1.3%</div>
               </div>
               <div className="hover-zoom" style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                 <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, textTransform: "uppercase" }}>Passing Rate</div>
                 <div style={{ fontSize: 26, fontWeight: 800, color: C.t1, marginTop: 4 }}>83.9%</div>
                 <div style={{ fontSize: 10, color: C.t3, fontWeight: 600 }}>Q1 Average: 82.1%</div>
               </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="hover-zoom" style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", marginBottom: 12 }}>Principal Quick Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => onNav("p-reports")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px", border: `1px solid ${C.borderMed}`, borderRadius: 4, background: "#fff", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.m50}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#fff"}>
                  <div style={{ background: C.greenBg, color: C.green, width: 26, height: 26, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center" }}><BookMarked size={12}/></div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>Generate School Report</div>
                  </div>
                </button>
                <button onClick={() => onNav("p-welfare")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px", border: `1px solid ${C.borderMed}`, borderRadius: 4, background: "#fff", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.m50}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#fff"}>
                  <div style={{ background: C.redBg, color: C.red, width: 26, height: 26, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center" }}><AlertCircle size={12}/></div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>Review Disciplinary Log</div>
                  </div>
                </button>
              </div>
            </div>

            {/* TIMELINE (Tabbed) */}
            <div className="hover-zoom" style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.m50 }}>
                {["Recent Activities", "Upcoming Events"].map(tab => {
                   const tabKey = tab.split(" ")[0];
                   const isActive = timelineTab === tabKey;
                   return (
                     <button key={tab} onClick={() => setTimelineTab(tabKey)} style={{ flex: 1, padding: "12px 0", background: isActive ? "#fff" : "transparent", border: "none", borderBottom: isActive ? `2px solid ${C.m800}` : "2px solid transparent", color: isActive ? C.m800 : C.t3, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
                       {tab}
                     </button>
                   )
                })}
              </div>
              <div style={{ padding: 16 }}>
                 {timelineTab === "Recent" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {[
                        { icon: BookMarked, color: C.green, text: "Teacher Maria submitted Q1 grades.", time: "10 mins ago" },
                        { icon: Activity, color: C.blue, text: "Student Juan scanned attendance.", time: "15 mins ago" },
                        { icon: Package, color: C.amber, text: "Inventory updated: 5 new Projectors.", time: "1 hour ago" },
                        { icon: Users, color: C.purple, text: "Parent profile updated for Cruz family.", time: "2 hours ago" },
                        { icon: AlertCircle, color: C.red, text: "Guidance record added for R. Ocampo.", time: "3 hours ago" }
                      ].map((act, idx) => {
                        const Icon = act.icon;
                        return (
                          <div key={idx} style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                            <div style={{ width: 28, height: 28, borderRadius: 14, background: `${act.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2, border: `1px solid ${act.color}30` }}>
                              <Icon size={12} color={act.color} />
                            </div>
                            <div style={{ flex: 1, paddingBottom: 14, borderBottom: idx < 4 ? `1px solid ${C.border}` : "none" }}>
                              <div style={{ fontSize: 11, color: C.t1, lineHeight: 1.4, fontWeight: 500 }}>{act.text}</div>
                              <div style={{ fontSize: 9, color: C.t3, marginTop: 4 }}>{act.time}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                 )}
                 {timelineTab === "Upcoming" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { date: "Jul 02", title: "Quarterly Examination" },
                        { date: "Jul 04", title: "PTA Meeting" },
                        { date: "Jul 07", title: "Faculty Meeting" },
                        { date: "Jul 10", title: "Recognition Day" }
                      ].map((ev, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center", paddingBottom: idx < 3 ? 10 : 0, borderBottom: idx < 3 ? `1px solid ${C.border}` : "none" }}>
                          <div style={{ background: C.m100, width: 36, height: 36, borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: C.m800 }}>{ev.date.split(" ")[1]}</span>
                            <span style={{ fontSize: 7, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>{ev.date.split(" ")[0]}</span>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{ev.title}</div>
                        </div>
                      ))}
                    </div>
                 )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
