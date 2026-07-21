import React from 'react';
import { C } from '../../shared/constants/tokens';
import { ShieldAlert, HeartHandshake, Users, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { useAppContext } from '../../shared/AppContext';

export function GDashboard() {
  const { behaviorLogs, appointments } = useAppContext();

  // Simple KPI data
  const pendingCases = behaviorLogs.filter(b => b.status !== "Resolved").length;
  const todayAppointments = appointments.filter(a => a.status === "Confirmed").length; // Mock metric
  
  return (
    <div style={{ padding: "32px 40px", overflowY: "auto", flex: 1, paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Guidance Overview</h1>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Monitor student well-being, behavioral cases, and counseling schedules.</div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { label: "Active Behavioral Cases", val: pendingCases.toString(), icon: ShieldAlert, color: C.red, bg: C.redBg },
            { label: "Upcoming Sessions", val: todayAppointments.toString(), icon: Clock, color: C.blue, bg: C.blueBg },
            { label: "Total Students Guided", val: "142", icon: Users, color: C.green, bg: C.greenBg },
          ].map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className="hover-zoom" style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={20} color={kpi.color} />
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{kpi.val}</div>
              </div>
            );
          })}
        </div>

        {/* 2 Column Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          
          {/* Recent Behavioral Reports */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>Recent Behavioral Reports</div>
              <button style={{ background: "none", border: "none", color: C.m700, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>View All</button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {behaviorLogs.slice(0, 3).map(log => (
                <div key={log.id} style={{ display: "flex", gap: 16, alignItems: "center", padding: "12px", background: C.paper, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: C.redBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <AlertCircle size={18} color={C.red} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{log.studentName}</div>
                      <div style={{ fontSize: 11, color: C.t3 }}>{log.date}</div>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>{log.type} - {log.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Counseling Sessions */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>Upcoming Sessions</div>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {appointments.filter(a => a.status === "Confirmed").slice(0, 3).map(appt => (
                <div key={appt.id} style={{ display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 50, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.m700, textTransform: "uppercase" }}>{appt.date.split(" ")[0]}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>{appt.date.split(" ")[1]?.replace(",", "")}</div>
                  </div>
                  <div style={{ flex: 1, padding: 12, background: C.blueBg, borderRadius: 8, border: `1px solid ${C.blue}30` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{appt.studentName}</div>
                    <div style={{ fontSize: 11, color: C.t2, marginTop: 4 }}>{appt.time} • Counseling</div>
                  </div>
                </div>
              ))}
              {appointments.filter(a => a.status === "Confirmed").length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: C.t3, fontSize: 12 }}>No upcoming sessions.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
