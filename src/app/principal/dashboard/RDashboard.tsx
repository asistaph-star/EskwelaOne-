import React from 'react';
import { C } from '../../shared/constants/tokens';
import { Users, FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../../shared/AppContext';

export function RDashboard() {
  const { documentRequests } = useAppContext();

  // Basic mock data for enrollment metrics
  const ENROLLMENT_STATS = {
    totalEnrolled: 1450,
    targetEnrollment: 1500,
    pendingApplications: 124,
    missingDocuments: 45
  };

  const pendingDocs = documentRequests.filter(r => r.status === "Submitted" || r.status === "Teacher Approved").length;

  return (
    <div style={{ padding: "32px 40px", overflowY: "auto", flex: 1, paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Registrar Overview</h1>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Monitor student enrollment, admissions, and academic record requests.</div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { label: "Total Enrolled", val: ENROLLMENT_STATS.totalEnrolled, sub: `Target: ${ENROLLMENT_STATS.targetEnrollment}`, icon: Users, color: C.green, bg: C.greenBg },
            { label: "Pending Admissions", val: ENROLLMENT_STATS.pendingApplications, sub: "Awaiting review", icon: Clock, color: C.blue, bg: C.blueBg },
            { label: "Missing Documents", val: ENROLLMENT_STATS.missingDocuments, sub: "Follow-up required", icon: AlertTriangle, color: C.red, bg: C.redBg },
            { label: "Doc Requests", val: pendingDocs, sub: "In processing pipeline", icon: FileText, color: C.m700, bg: C.m50 },
          ].map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className="hover-zoom" style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={20} color={kpi.color} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{kpi.val}</div>
                </div>
                <div style={{ fontSize: 11, color: C.t3 }}>{kpi.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Enrollment Progress */}
        <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "24px 32px", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Enrollment Progress (SY 2026-2027)</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
              {Math.round((ENROLLMENT_STATS.totalEnrolled / ENROLLMENT_STATS.targetEnrollment) * 100)}% of Target
            </div>
          </div>
          
          <div style={{ width: "100%", height: 16, background: C.borderMed, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ 
              width: `${(ENROLLMENT_STATS.totalEnrolled / ENROLLMENT_STATS.targetEnrollment) * 100}%`, 
              height: "100%", 
              background: C.green, 
              borderRadius: 8,
              transition: "width 1s ease-in-out"
            }} />
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12, color: C.t2 }}>
            <div><strong>{ENROLLMENT_STATS.totalEnrolled}</strong> Currently Enrolled</div>
            <div><strong>{ENROLLMENT_STATS.targetEnrollment}</strong> Target Capacity</div>
          </div>
        </div>

      </div>
    </div>
  );
}
