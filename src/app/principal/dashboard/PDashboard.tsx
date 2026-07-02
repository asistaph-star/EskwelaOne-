import React, { useState } from 'react';
import { PScreen, GradeCardInfo } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import { PTableHeader } from '../shared/PTableHeader';
import { TRAFFIC } from '../../shared/utils/helpers';
import { BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, CalendarCheck, BarChart2, Sparkles, Building2, AlertCircle, Activity, GraduationCap, BookMarked, Stethoscope } from 'lucide-react';
import { P_TEACHERS, P_GATE_LOG, P_WELFARE } from '../../shared/constants/seedData';
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
              onClick={() => onNav(kpi.dest as PScreen)}
              style={{ 
                background: "#fff", 
                border: `1.5px solid ${C.borderMed}`, 
                borderLeft: `5px solid ${kpi.color}`, 
                borderRadius: 4, 
                padding: "12px 18px",
                cursor: "pointer",
                transition: "transform 0.12s, box-shadow 0.12s",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-2px)";
                el.style.boxShadow = "0 4px 12px rgba(139,30,30,0.08)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "none";
                el.style.boxShadow = "none";
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
      {/* ── Main 65/35 Split ── */}
      <div style={{ display: "grid", gridTemplateColumns: "65fr 35fr", gap: 24, alignItems: "start" }}>
        
        {/* LEFT COLUMN: AI Summary, Alerts, Students, Approvals */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* AI EXECUTIVE SUMMARY */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderLeft: `4px solid ${C.gold}`, padding: "18px 22px", borderRadius: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles size={16} color={C.gold} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>AI School Executive Summary</span>
              <Stamp label="Automated" color={C.gold} bg={C.goldLight} />
            </div>
            <div style={{ fontSize: 12, color: C.t1, lineHeight: 1.7 }}>
              <p style={{ margin: "0 0 10px 0" }}>
                Good morning, Principal. Today's attendance is <strong>94.2%</strong>, which is <strong>1.3% higher</strong> than yesterday. One teacher is absent. Four students require immediate intervention. There are two behavior incidents requiring review. No emergency clinic cases have been reported.
              </p>
              <div style={{ background: C.goldLight + "30", border: `1px solid ${C.gold}20`, borderRadius: 4, padding: "10px 14px", marginTop: 10 }}>
                <strong style={{ color: C.gold, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Recommended Actions:</strong>
                <ul style={{ margin: 0, paddingLeft: 16, color: C.t2 }}>
                  <li style={{ marginBottom: 4 }}>Review Grade 9 attendance.</li>
                  <li style={{ marginBottom: 4 }}>Follow up on two urgent intervention cases.</li>
                  <li style={{ marginBottom: 0 }}>Approve one pending teacher leave request.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* CRITICAL ALERTS */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>Critical Alerts</span>
              <button onClick={() => onNav("p-welfare")} style={{ fontSize: 10, background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.8, fontWeight: 600 }}>View All &rarr;</button>
            </div>
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { text: "Emergency Clinic Case: Student Aguilar, Liza Marie (8-Rizal) sent home with high fever", color: C.red, badge: "🔴 Critical" },
                { text: "Urgent Intervention Needed: Ocampo, Renz Adrian (10-Pilot) skipped class 5 times consecutively", color: C.red, badge: "🔴 Critical" },
                { text: "Severe Discipline Incident: Reyes, Carlo Jose (9-Einstein) reported for vandalism", color: C.amber, badge: "🟠 High" },
                { text: "Teacher Absent: Navarro, Pedro M. (Master Teacher I) on leave today", color: "#B45309", badge: "🟡 Medium" },
                { text: "Missing Attendance: Grade 8 Rizal (Soriano, A.) not yet submitted", color: C.blue, badge: "🔵 Info" },
              ].map((alert, idx) => (
                <div key={idx} style={{ display: "flex", gap: 10, padding: "10px 14px", background: alert.badge.includes("🔴") ? `${C.redBg}50` : alert.badge.includes("🟠") ? `${C.amberBg}40` : alert.badge.includes("🟡") ? "#FEF3C7" : C.blueBg, border: `1px solid ${alert.color || C.borderMed}`, borderRadius: 4, alignItems: "center" }}>
                  <div style={{ flex: 1, fontSize: 11.5, color: C.t1, fontWeight: 500 }}>{alert.text}</div>
                  <Stamp label={alert.badge} color={alert.color || C.t1} bg="#fff" />
                </div>
              ))}
            </div>
          </div>

          {/* STUDENTS REQUIRING ATTENTION */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>Students Requiring Attention</span>
              <button onClick={() => onNav("p-welfare")} style={{ fontSize: 10, background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.8, fontWeight: 600 }}>View All &rarr;</button>
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
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
          </div>

          {/* PENDING APPROVALS */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
              Pending Approvals
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
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
                    <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Submitted by: {app.name} &middot; Deadline: <strong style={{ color: C.red }}>{app.deadline}</strong></div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => alert("Approved successfully!")} style={{ fontSize: 10, padding: "5px 10px", background: C.greenBg, border: `1px solid ${C.green}30`, color: C.green, cursor: "pointer", fontWeight: 700, borderRadius: 3 }}>Approve</button>
                    <button onClick={() => onNav("p-reports")} style={{ fontSize: 10, padding: "5px 10px", background: "#f3f4f6", border: `1px solid #d1d5db`, color: C.t2, cursor: "pointer", fontWeight: 600, borderRadius: 3 }}>View</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Attendance Overview, Academic Health, Upcoming Events */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* ATTENDANCE OVERVIEW */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
              Attendance Overview
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", minHeight: 120 }}>
                {/* Donut Chart */}
                <div style={{ width: 100, height: 100, position: "relative", flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Present", value: 319, color: C.green },
                          { name: "Late", value: 14, color: C.amber },
                          { name: "Absent", value: 7, color: C.red },
                          { name: "Excused", value: 2, color: C.blue }
                        ]}
                        innerRadius={32}
                        outerRadius={44}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {[
                          { color: C.green },
                          { color: C.amber },
                          { color: C.red },
                          { color: C.blue }
                        ].map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text inside Donut */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>94.2%</span>
                    <span style={{ fontSize: 7, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>Present</span>
                  </div>
                </div>

                {/* Legend list */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { l: "Present Today", v: "319 students", pct: "93.3%", col: C.green },
                    { l: "Late Arrivals", v: "14 students", pct: "4.1%", col: C.amber },
                    { l: "Absent Today", v: "7 students", pct: "2.1%", col: C.red },
                    { l: "Excused Absence", v: "2 students", pct: "0.5%", col: C.blue }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 3.5, background: item.col }} />
                        <span style={{ fontWeight: 600, color: C.t1 }}>{item.l}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ color: C.t3, fontSize: 9.5 }}>{item.v}</span>
                        <span style={{ fontWeight: 700, color: item.col, fontFamily: "'JetBrains Mono',monospace", width: 38, textAlign: "right" }}>{item.pct}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Trend Footer */}
              <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.t3, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: C.green, fontWeight: 750 }}>▲ +1.3%</span> higher present rate compared to yesterday
              </div>
            </div>
          </div>

          {/* ACADEMIC HEALTH */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
              Academic Health
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "School Average", val: "82.1%", sub: "SY 2025–2026 Q1 average", col: C.t1 },
                { label: "Passing Rate", val: "83.9%", sub: "287 of 342 students passing", col: C.green },
                { label: "Students At Risk", val: "4 Students", sub: "Averages currently below 75%", col: C.red },
                { label: "Quarterly Performance Trend", val: "▲ +0.8%", sub: "Compared to Q1 last school year", col: C.green }
              ].map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: idx < 3 ? `1px solid ${C.border}` : "none", paddingBottom: idx < 3 ? 12 : 0 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</div>
                    <div style={{ fontSize: 9, color: C.t3, marginTop: 2 }}>{item.sub}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: item.col, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* UPCOMING EVENTS */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
              Upcoming Events
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { date: "Jul 02", title: "Quarterly Examination", desc: "School-wide exam schedules" },
                { date: "Jul 04", title: "PTA Meeting", desc: "General conference room" },
                { date: "Jul 07", title: "Faculty Meeting", desc: "Grade level team leads" },
                { date: "Jul 10", title: "Recognition Day", desc: "Gymnasium setup details" },
                { date: "Jul 15", title: "School Holiday", desc: "National declaration" }
              ].map((ev, idx) => (
                <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center", paddingBottom: idx < 4 ? 10 : 0, borderBottom: idx < 4 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ background: C.m100, width: 44, height: 44, borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.m800 }}>{ev.date.split(" ")[1]}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>{ev.date.split(" ")[0]}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{ev.title}</div>
                    <div style={{ fontSize: 9.5, color: C.t3, marginTop: 1 }}>{ev.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
