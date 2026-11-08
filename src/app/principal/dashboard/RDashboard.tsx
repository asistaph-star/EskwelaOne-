import React, { useEffect, useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Users, FileText, CheckCircle, Clock, AlertTriangle, Loader } from 'lucide-react';
import { apiClient } from "../../../api/client";
import { documentsApi } from "../../../api/documents.api";
import { DocumentRequest } from '../../shared/types';

export function RDashboard() {
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalEnrolled: number;
    targetEnrollment: number | null;
    pendingAdmissions: number;
    missingDocuments: number;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, docReqsRes] = await Promise.all([
        apiClient.get<any>('/admin/enrollment-stats').catch(err => {
          console.error("Failed to load enrollment stats", err);
          return null;
        }),
        documentsApi.getAllRequests().catch(err => {
          console.error("Failed to load doc requests", err);
          return [];
        })
      ]);

      if (statsRes) {
        setStats(statsRes);
      } else {
        // Fallback default state with 0s if stats could not be computed
        setStats({
          totalEnrolled: 0,
          targetEnrollment: null,
          pendingAdmissions: 0,
          missingDocuments: 0
        });
      }
      setDocumentRequests(docReqsRes || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingDocs = documentRequests.filter(r => r.status === "Submitted" || r.status === "Teacher Approved" || r.status === "Principal Approved").length;

  return (
    <div style={{ padding: "32px 40px", overflowY: "auto", flex: 1, minHeight: 0, paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Registrar Overview</h1>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Monitor student enrollment, admissions, and academic record requests for Calulut Integrated School.</div>
        </div>

        {/* Error State */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: C.redBg, borderRadius: 10, border: `1px solid ${C.red}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} color={C.red} />
              <span style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>{error}</span>
            </div>
            <button 
              onClick={loadData}
              style={{ padding: '6px 14px', background: '#fff', border: `1px solid ${C.red}50`, borderRadius: 6, fontSize: 12, fontWeight: 700, color: C.red, cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !stats ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 24, background: '#fff', borderRadius: 12, border: `1px solid ${C.borderMed}` }}>
            <Loader size={18} className="spin" color={C.m500} />
            <span style={{ fontSize: 13, color: C.t2, fontWeight: 500 }}>Loading live registrar statistics from database...</span>
          </div>
        ) : stats ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Total Enrolled", val: stats.totalEnrolled, sub: stats.targetEnrollment ? `Target: ${stats.targetEnrollment}` : "Target not set", icon: Users, color: C.green, bg: C.greenBg },
                { label: "Pending Admissions", val: stats.pendingAdmissions, sub: "Awaiting review", icon: Clock, color: C.blue, bg: C.blueBg },
                { label: "Missing Documents", val: stats.missingDocuments, sub: "Follow-up required", icon: AlertTriangle, color: C.red, bg: C.redBg },
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
            {stats.targetEnrollment ? (
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "24px 32px", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Enrollment Progress (SY 2026-2027)</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
                    {Math.round((stats.totalEnrolled / stats.targetEnrollment) * 100)}% of Target
                  </div>
                </div>
                <div style={{ height: 8, background: C.borderLight, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min((stats.totalEnrolled / stats.targetEnrollment) * 100, 100)}%`, background: C.green, borderRadius: 4 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12, color: C.t2 }}>
                  <div><strong>{stats.totalEnrolled}</strong> Currently Enrolled</div>
                  <div><strong>{stats.targetEnrollment}</strong> Target Capacity</div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
