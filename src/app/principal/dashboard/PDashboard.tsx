import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';
import { PScreen, GradeCardInfo } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import { Sparkles, Users, CalendarCheck, Activity, GraduationCap, BookMarked, Stethoscope, AlertCircle, Building2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function Stamp({ label, color, bg }: { label:string; color:string; bg:string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, background: bg }}>
      {label}
    </span>
  );
}

export function PDashboard({ onNav, onShowGradeCard }: { onNav:(s:PScreen)=>void; onShowGradeCard:(info:GradeCardInfo)=>void }) {
  const [dashData, setDashData] = useState<any>(null);
  const [teacherLeaves, setTeacherLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get('/admin/dashboard').catch(() => null),
      apiClient.get('/admin/leaves').catch(() => [])
    ]).then(([dData, lData]: any) => {
      if (!dData) setError(true);
      else setDashData(dData.data || dData);
      
      setTeacherLeaves(lData?.data || lData || []);
      setLoading(false);
    });
  }, []);

  const pendingLeavesList = teacherLeaves.filter(l => l.status === "Pending");
  
  const scansToday = dashData?.gateToday || 0;
  const enrolled = dashData?.enrolledStudents || 0;
  const teachers = dashData?.totalTeachers || 0;
  const pendingApprovalsCount = dashData?.pendingApprovals || 0;

  const KPI_CARDS = [
    { v: loading ? "..." : `${enrolled} Enrolled`, l: "Total Students", sub: "Active Current Year", subColor: C.t3, color: C.m700, bg: C.m100, icon: Users, dest: "p-monitoring" },
    { v: loading ? "..." : `${teachers} Faculty`, l: "Total Teachers", sub: "Registered Profiles", subColor: C.t3, color: C.m700, bg: C.m100, icon: GraduationCap, dest: "p-teachers" },
    { v: loading ? "..." : "0 Staff", l: "Total Staff", sub: "Support & Administration", subColor: C.t3, color: C.m700, bg: C.m100, icon: Building2, dest: "p-teachers" },
    { v: loading ? "..." : "0 Sections", l: "Total Active Sections", sub: "Grades 7 to 10", subColor: C.t3, color: C.m700, bg: C.m100, icon: BookMarked, dest: "p-templates" },
    { v: loading ? "..." : "0%", l: "Overall Attendance Rate", sub: "No data available", subColor: C.t3, color: C.green, bg: C.greenBg, icon: Activity, dest: "p-monitoring" },
    { v: loading ? "..." : `${scansToday} Scans`, l: "Gate Scans Today", sub: "Live QR Feed verified", subColor: C.green, color: C.green, bg: C.greenBg, icon: CalendarCheck, dest: "p-monitoring" },
    { v: loading ? "..." : "0 / 0", l: "Teachers Present Today", sub: "Attendance module unavailable", subColor: C.t3, color: C.amber, bg: C.amberBg, icon: GraduationCap, dest: "p-teachers" },
    { v: loading ? "..." : "0 Active", l: "Active Clinic Cases", sub: "Clinic module unavailable", subColor: C.t3, color: C.teal, bg: C.tealBg, icon: Stethoscope, dest: "p-welfare" },
    { v: loading ? "..." : "0 Pending", l: "Pending Discipline Cases", sub: "Welfare module unavailable", subColor: C.t3, color: C.red, bg: C.redBg, icon: AlertCircle, dest: "p-welfare" }
  ];

  if (error) {
    return <div style={{ padding: 40, textAlign: "center", color: C.red }}>Failed to load dashboard data.</div>;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "transparent", padding: "20px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.l} onClick={() => onNav(kpi.dest as PScreen)} style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderLeft: `5px solid ${kpi.color}`, borderRadius: 4, padding: "12px 18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "65fr 35fr", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderLeft: `4px solid ${C.gold}`, padding: "18px 22px", borderRadius: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles size={16} color={C.gold} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>AI School Executive Summary</span>
            </div>
            <div style={{ fontSize: 12, color: C.t3 }}>AI Insights are currently unavailable.</div>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>Critical Alerts</span>
            </div>
            <div style={{ padding: "16px 12px", fontSize: 12, color: C.t3, textAlign: "center" }}>No critical alerts at this time.</div>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>Students Requiring Attention</span>
            </div>
            <div style={{ padding: "16px 12px", fontSize: 12, color: C.t3, textAlign: "center" }}>No students flagged.</div>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
              Pending Leave Approvals ({pendingApprovalsCount})
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingLeavesList.length === 0 ? (
                <div style={{ padding: "16px 12px", fontSize: 12, color: C.t3, textAlign: "center" }}>No pending leave requests.</div>
              ) : pendingLeavesList.slice(0,5).map((app, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>Leave Request</div>
                    <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{new Date(app.start_date).toLocaleDateString()} to {new Date(app.end_date).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
              Attendance Overview
            </div>
            <div style={{ padding: "16px 12px", fontSize: 12, color: C.t3, textAlign: "center" }}>Student attendance analytics module unavailable.</div>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
              Academic Health
            </div>
            <div style={{ padding: "16px 12px", fontSize: 12, color: C.t3, textAlign: "center" }}>Academic health analytics module unavailable.</div>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
              Upcoming Events
            </div>
            <div style={{ padding: "16px 12px", fontSize: 12, color: C.t3, textAlign: "center" }}>No upcoming events scheduled.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
