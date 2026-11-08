import React, { useState, useEffect } from "react";
import {
  AlertTriangle, CheckCircle2, Search, Plus, X, Pencil,
  FileText, ChevronDown, ChevronUp, MessageSquare, ClipboardList, Loader2, RefreshCw, ShieldAlert
} from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { apiClient } from "../../../api/client";
import { Applicant } from "../../shared/types";

// ── Types ──────────────────────────────────────────────────────────────────
type DocStatus = "Missing" | "Submitted" | "Received" | "For Follow-up";

type DocumentRequirement = {
  id: string;
  label: string;
  status: DocStatus;
  dueDate?: string;
  note?: string;
};

type StudentDeficiency = {
  id: string;
  name: string;
  lrn: string;
  grade: string;
  section: string;
  type: "New Student" | "Transferee" | "Returning";
  enrolledDate: string;
  requirements: DocumentRequirement[];
  overallNote?: string;
};

export function RDocDeficiencyScreen() {
  const [students, setStudents] = useState<StudentDeficiency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "Incomplete" | "Complete">("All");
  const [filterGrade, setFilterGrade] = useState("All");
  const [toast, setToast] = useState<string | null>(null);

  const fetchDeficiencies = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Applicant[]>('/admin/enrollment-applications');
      const apps = Array.isArray(res) ? res : [];
      
      const mapped: StudentDeficiency[] = apps.map(app => {
        const reqs: DocumentRequirement[] = [
          { id: 'birth_cert', label: 'PSA Birth Certificate', status: app.documents?.birthCert ? 'Received' : 'Missing' },
          { id: 'form138', label: 'Form 138 (Report Card)', status: app.documents?.form138 ? 'Received' : 'Missing' },
          { id: 'good_moral', label: 'Certificate of Good Moral Character', status: app.documents?.goodMoral ? 'Received' : 'Missing' },
          { id: 'medical', label: 'Medical Certificate', status: app.documents?.medical ? 'Received' : 'Missing' },
        ];
        return {
          id: app.id,
          name: app.name,
          lrn: app.id,
          grade: app.gradeLevel,
          section: 'Admissions Pool',
          type: (app.type as any) || 'New Student',
          enrolledDate: app.dateApplied,
          requirements: reqs,
          overallNote: `Application status: ${app.status}`
        };
      });

      setStudents(mapped);
    } catch (err: any) {
      console.error("Failed to load applicants for deficiency tracker", err);
      setError("Failed to load applicant records from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeficiencies();
  }, []);
  // ── Actions ──────────────────────────────────────────────────────────────
  const toggleDocumentStatus = async (studentId: string, reqId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const currentReq = student.requirements.find(r => r.id === reqId);
    const newStatus: DocStatus = currentReq?.status === "Received" ? "Missing" : "Received";
    const isNowReceived = newStatus === "Received";

    const updatedRequirements = student.requirements.map(r => 
      r.id === reqId ? { ...r, status: newStatus } : r
    );

    const docPayload: any = {
      birthCert: updatedRequirements.find(r => r.id === 'birth_cert')?.status === 'Received',
      form138: updatedRequirements.find(r => r.id === 'form138')?.status === 'Received',
      goodMoral: updatedRequirements.find(r => r.id === 'good_moral')?.status === 'Received',
      medical: updatedRequirements.find(r => r.id === 'medical')?.status === 'Received',
    };

    const allReceived = Object.values(docPayload).every(Boolean);
    const newAppStatus = allReceived ? 'Pending Review' : 'Missing Documents';

    try {
      await apiClient.patch(`/admin/enrollment-applications/${studentId}`, {
        documents: docPayload,
        status: newAppStatus
      });

      setStudents(prev => prev.map(s => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          requirements: updatedRequirements,
          overallNote: `Application status: ${newAppStatus}`
        };
      }));

      showToast(`Updated ${currentReq?.label}: ${newStatus}`);
    } catch (err: any) {
      console.error(err);
      showToast(`Failed to update requirement: ${err?.message || 'Server error'}`);
    }
  };

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const statusColor = (status: DocStatus) => {
    switch (status) {
      case "Received": return C.green;
      case "Missing": return C.red;
      case "Submitted": return C.blue;
      case "For Follow-up": return "#d97706";
      default: return C.t2;
    }
  };

  const statusBg = (status: DocStatus) => {
    switch (status) {
      case "Received": return C.greenBg;
      case "Missing": return C.redBg;
      case "Submitted": return C.blueBg;
      case "For Follow-up": return "#fef3c7";
      default: return C.paper;
    }
  };

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = students.filter(s => {
    const query = searchQuery.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(query) || s.lrn.toLowerCase().includes(query);
    const hasMissing = s.requirements.some(r => r.status === "Missing" || r.status === "For Follow-up");
    const matchFilter = filterStatus === "All" || (filterStatus === "Incomplete" && hasMissing) || (filterStatus === "Complete" && !hasMissing);
    return matchSearch && matchFilter;
  });

  // ── Summary counts ────────────────────────────────────────────────────────
  const totalMissing = students.reduce((sum, s) => sum + s.requirements.filter(r => r.status === "Missing").length, 0);
  const totalReceived = students.reduce((sum, s) => sum + s.requirements.filter(r => r.status === "Received").length, 0);
  const studentsWithIssues = students.filter(s => s.requirements.some(r => r.status === "Missing" || r.status === "For Follow-up")).length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", paddingBottom: 100, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Header */}
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>
            Document Deficiencies
          </h1>
          <p style={{ fontSize: 13, color: C.t3, margin: "6px 0 0", lineHeight: 1.5 }}>
            Review and track missing DepEd enrollment requirements (PSA Birth Certificate, Form 138, Good Moral Certificate, Medical Certificate).
          </p>
        </div>

        {/* Informative DepEd Scope Notice */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
          <ShieldAlert size={20} color="#1d4ed8" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
            <strong>Authoritative DepEd Admission Deficiencies:</strong> Actively auditing documentary requirements for enrollment applicants. Post-enrollment annual credential audits for already-enrolled students are governed under SF10 permanent records.
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 20, background: '#fff', borderRadius: 10, border: `1px solid ${C.borderMed}` }}>
            <Loader2 size={18} className="spin" color={C.m500} />
            <span style={{ fontSize: 13, color: C.t2 }}>Loading live applicant documentary records from database...</span>
          </div>
        )}

        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { label: "Applicants with Deficiencies", value: studentsWithIssues, color: C.red, bg: C.redBg, icon: AlertTriangle },
            { label: "Total Missing Documents", value: totalMissing, color: "#d97706", bg: "#fef3c7", icon: FileText },
            { label: "Verified Documents", value: totalReceived, color: C.green, bg: C.greenBg, icon: CheckCircle2 },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={22} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.t1, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <Search size={14} color={C.t3} style={{ position: "absolute", left: 12, top: 11 }} />
            <input
              type="text" placeholder="Search name, LRN, or section..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["All", "Incomplete", "Complete"] as const).map(f => (
              <button key={f} onClick={() => setFilterStatus(f)} style={{
                padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: filterStatus === f ? C.m800 : "#fff",
                color: filterStatus === f ? "#fff" : C.t2,
                border: `1px solid ${filterStatus === f ? C.m800 : C.borderMed}`,
              }}>{f}</button>
            ))}
          </div>
        </div>

        {/* Student Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.length === 0 && (
            <div style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 48, textAlign: "center", color: C.t3, fontSize: 14 }}>
              No students found matching your criteria.
            </div>
          )}

          {filtered.map(student => {
            const isExpanded = expandedId === student.id;
            const missingCount = student.requirements.filter(r => r.status === "Missing").length;
            const followUpCount = student.requirements.filter(r => r.status === "For Follow-up").length;
            const hasIssues = missingCount > 0 || followUpCount > 0;

            return (
              <div key={student.id} style={{
                background: "#fff",
                border: `1px solid ${hasIssues ? C.red + "40" : C.borderLight}`,
                borderLeft: `4px solid ${hasIssues ? C.red : C.green}`,
                borderRadius: 12, overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
              }}>
                {/* Card Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : student.id)}
                  style={{ padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 20, background: hasIssues ? C.redBg : C.greenBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {hasIssues ? <AlertTriangle size={18} color={C.red} /> : <CheckCircle2 size={18} color={C.green} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{student.name}</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2, display: "flex", gap: 8 }}>
                        <span>LRN: {student.lrn}</span>
                        <span>•</span>
                        <span>{student.grade}, {student.section}</span>
                        <span>•</span>
                        <span>{student.type}</span>
                        <span>•</span>
                        <span>Enrolled: {student.enrolledDate}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {missingCount > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: C.redBg, padding: "4px 10px", borderRadius: 12, border: `1px solid ${C.red}30` }}>
                        {missingCount} Missing
                      </span>
                    )}
                    {followUpCount > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fef3c7", padding: "4px 10px", borderRadius: 12, border: "1px solid #fcd34d" }}>
                        {followUpCount} Follow-up
                      </span>
                    )}
                    {!hasIssues && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: C.greenBg, padding: "4px 10px", borderRadius: 12 }}>
                        Complete
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} color={C.t3} /> : <ChevronDown size={16} color={C.t3} />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Overall Note */}
                    <div style={{ background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 10, padding: "14px 18px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <MessageSquare size={12} /> Enrollment Application Status
                      </div>
                      <div style={{ fontSize: 12.5, color: student.overallNote ? C.t1 : C.t3, lineHeight: 1.6 }}>
                        {student.overallNote || "Application status: Pending Review"}
                      </div>
                    </div>

                    {/* Documents List */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                        Official DepEd Document Requirements ({student.requirements.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {student.requirements.map(req => (
                          <div key={req.id} style={{
                            background: statusBg(req.status),
                            border: `1px solid ${statusColor(req.status)}30`,
                            borderRadius: 8, padding: "12px 16px"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{req.label}</span>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                {/* Status Toggle Button */}
                                <button
                                  onClick={() => toggleDocumentStatus(student.id, req.id)}
                                  title="Click to toggle Received / Missing status (persists to PostgreSQL)"
                                  style={{
                                    padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                                    background: "#fff", color: statusColor(req.status),
                                    border: `1px solid ${statusColor(req.status)}`,
                                    transition: "all 0.15s"
                                  }}
                                >
                                  {req.status} (Click to toggle)
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 36, right: 36, background: "#1f2937", color: "#fff",
          padding: "13px 20px", borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 2000, fontSize: 13, fontWeight: 500
        }}>
          <CheckCircle2 size={18} color={C.green} />
          {toast}
        </div>
      )}
    </div>
  );
}
