import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { BookMarked, Eye, ChevronLeft, ArrowRight, X, ChevronDown, Loader2, AlertCircle, FileSpreadsheet, ShieldCheck, Sparkles } from 'lucide-react';
import { AuthenticCalulutSf9Viewer } from '../../shared/components/AuthenticCalulutSf9Viewer';
import { ReportCardReleaseConsole } from '../../shared/components/ReportCardReleaseConsole';
import { apiClient } from '../../../api/client';

export function TemplateHubScreen({ role = "teacher" }: { role?: "teacher" | "registrar" }) {
  const [modal, setModal] = useState<"rc" | null>(null);

  // Real workflow: fetch authorized students
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  // Report Card State
  const [rcData, setRcData] = useState<any>(null);
  const [loadingRc, setLoadingRc] = useState(false);
  const [rcError, setRcError] = useState<string | null>(null);
  const [showConsole, setShowConsole] = useState<boolean>(false);

  const [viewing, setViewing] = useState<"rc" | "qa-preview" | null>(null);

  const TEMPLATES = [
    {
      id: "rc" as const,
      emoji: "📋",
      title: "Report Card (SF9 / Form 138)",
      badge: "DepEd JHS Standard",
      desc: "Authentic Calulut Integrated School SF9 (Form 138). Generates the official report card for authorized enrolled learners using the official school Excel format.",
    }
  ];

  useEffect(() => {
    // Fetch authorized students for this teacher
    async function fetchStudents() {
      setLoadingStudents(true);
      try {
        const data = await apiClient.get<any[]>('/student-services/appointments/students');
        setStudents(data);
        if (data.length > 0) {
          setSelectedStudentId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to load students", err);
      } finally {
        setLoadingStudents(false);
      }
    }
    fetchStudents();
  }, []);

  async function handleView() {
    if (!selectedStudentId) return;

    setLoadingRc(true);
    setRcError(null);

    const sel = students.find((s) => s.id === selectedStudentId);
    const initialStudentData = {
      student: {
        id: selectedStudentId,
        name: sel?.user ? `${sel.user.last_name}, ${sel.user.first_name}` : 'Enrolled Learner',
        first_name: sel?.user?.first_name,
        last_name: sel?.user?.last_name,
        lrn: sel?.user?.lrn || sel?.lrn || 'Pending',
        gender: sel?.user?.gender || sel?.gender,
      },
      enrollment: {
        gradeLevel: sel?.gradeLevel || sel?.current_section?.grade_level || 7,
        section: sel?.current_section?.name || 'Assigned Section',
      },
    };

    setRcData(initialStudentData);
    setViewing("rc");
    setModal(null);

    try {
      const data = await apiClient.get<any>(`/academic/report-card/${selectedStudentId}`);
      if (data) {
        setRcData(data);
      }
    } catch (err: any) {
      setRcError(err.message || "An unexpected error occurred.");
    } finally {
      setLoadingRc(false);
    }
  }

  if (showConsole) {
    return (
      <ReportCardReleaseConsole
        portal={role === "registrar" ? "Registrar" : "Teacher"}
        onBack={() => setShowConsole(false)}
      />
    );
  }

  // Active Document Viewer View
  if (viewing === "qa-preview") {
    return (
      <AuthenticCalulutSf9Viewer
        mode="qa-preview"
        onBack={() => setViewing(null)}
      />
    );
  }

  if (viewing === "rc") {
    return (
      <AuthenticCalulutSf9Viewer
        mode="student"
        studentData={rcData}
        onBack={() => {
          setViewing(null);
          setRcData(null);
          setRcError(null);
        }}
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "transparent" }}>
      <div style={{ maxWidth: 840, margin: "0 auto", padding: 40 }}>
        {/* Screen Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 6 }}>
            Forms and Records
          </div>
          <div style={{ fontSize: 13, color: C.t3 }}>
            Official school document templates and DepEd scholastic records for Calulut Integrated School.
          </div>

          <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fdf4", borderRadius: 6, border: "1px solid #bbf7d0", fontSize: 12, color: "#166534", display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck size={18} color="#15803d" style={{ flexShrink: 0 }} />
            <span>
              <strong>Authentic SF9 Master Template:</strong> Connected to <code>SF9 7-Agoncillo (SY 2026-2027).xlsx</code> (Sheet <code>SF9 - GRADE 4-10</code>). All generated reports use the authentic school format.
            </span>
          </div>

          <div style={{ marginTop: 14, padding: "14px 18px", background: "#fff", borderRadius: 8, border: `1px solid ${C.borderMed}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Section Report Cards &amp; Release Console</div>
              <div style={{ fontSize: 11.5, color: C.t3, marginTop: 2 }}>Review published subject ratings, verify adviser remarks, issue sealed SF9s, and authorize release to the student portal.</div>
            </div>
            <button
              type="button"
              onClick={() => setShowConsole(true)}
              style={{ padding: "8px 16px", background: C.m700, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Open Section Console →
            </button>
          </div>
        </div>

        {/* Template Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 28 }}>
          {/* Card 1: Official Learner SF9 */}
          {TEMPLATES.map(t => (
            <div
              key={t.id}
              style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderTop: `3px solid ${C.m700}`, borderRadius: 6, padding: "24px", textAlign: "left", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 36, lineHeight: 1 }}>{t.emoji}</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.m700, background: C.m100, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" }}>
                  {t.badge}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 8 }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.6 }}>
                  {t.desc}
                </div>
              </div>
              <div style={{ marginTop: "auto", display: "flex", gap: 10 }}>
                <button
                  onClick={() => setModal(t.id)}
                  style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", borderRadius: 4, background: C.m700, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}
                >
                  <Eye size={14} /> View Learner Record <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}

          {/* Card 2: QA / Staff Verification Preview */}
          <div
            style={{ background: "#fff", border: "1px solid #bae6fd", borderTop: "3px solid #0284c7", borderRadius: 6, padding: "24px", textAlign: "left", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 36, lineHeight: 1 }}>📊</div>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#0369a1", background: "#e0f2fe", padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" }}>
                Staff QA Preview
              </span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 8 }}>
                Authentic SF9 Template Inspection
              </div>
              <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.6 }}>
                View the authentic Calulut SF9 layout populated with the verified synthetic baseline (Juan Dela Cruz, Grade 7 Agoncillo). Preserves all 76 formulas, 3 terms, 11-month attendance, and school seals.
              </div>
            </div>
            <div style={{ marginTop: "auto", display: "flex", gap: 10 }}>
              <button
                onClick={() => setViewing("qa-preview")}
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", borderRadius: 4, background: "#0284c7", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}
              >
                <Sparkles size={14} /> Inspect Authentic Template <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Student Selection Modal */}
      {modal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,8,8,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div style={{ background: "#fff", borderRadius: 6, width: "100%", maxWidth: 440, overflow: "hidden", boxShadow: "0 20px 60px rgba(74,10,16,0.4)" }}>
            <div style={{ background: C.m800, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Calulut Integrated School</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Fraunces',serif" }}>Select Learner for SF9 Report Card</div>
              </div>
              <button onClick={() => setModal(null)} style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Select Enrolled Learner
                </label>
                {loadingStudents ? (
                  <div style={{ fontSize: 13, color: C.t3, padding: "9px 10px" }}>Loading students...</div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <select
                      value={selectedStudentId}
                      onChange={e => setSelectedStudentId(e.target.value)}
                      style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "9px 28px 9px 10px", fontSize: 13, color: C.t1, background: "#fff", outline: "none", appearance: "none", cursor: "pointer" }}
                    >
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.user?.last_name}, {s.user?.first_name} ({s.current_section?.name || 'Section'})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.t3, pointerEvents: "none" }} />
                  </div>
                )}
              </div>

              <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0", fontSize: 11, color: "#475569" }}>
                <strong>Academic Gating:</strong> If trimester ratings are draft or incomplete, the official document will remain in protected pending status in accordance with DepEd policy.
              </div>

              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    setModal(null);
                    setViewing("qa-preview");
                  }}
                  style={{ fontSize: 11, color: "#0284c7", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
                >
                  ⚡ Open Synthetic QA Preview instead
                </button>
              </div>
            </div>

            <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.borderMed}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setModal(null)}
                style={{ padding: "9px 18px", background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 500, color: C.t2 }}
              >
                Cancel
              </button>
              <button
                onClick={handleView}
                disabled={!selectedStudentId}
                style={{ padding: "9px 22px", background: selectedStudentId ? C.m700 : C.borderMed, color: "#fff", border: "none", borderRadius: 4, cursor: selectedStudentId ? "pointer" : "default", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
              >
                <Eye size={14} /> Open Learner SF9
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
