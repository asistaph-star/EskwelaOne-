import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { BookMarked, Eye, ChevronLeft, ArrowRight, X, ChevronDown, Loader2, AlertCircle, FileSpreadsheet, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { AuthenticCalulutSf9Viewer } from '../../shared/components/AuthenticCalulutSf9Viewer';
import { ReportCardReleaseConsole } from '../../shared/components/ReportCardReleaseConsole';
import { apiClient } from '../../../api/client';

export interface SectionOption {
  id: string;
  name: string;
  grade_level: number;
  label: string;
}

export interface StudentOption {
  id: string;
  lrn: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender?: string;
  gradeLevel: number;
  section: string;
}

export function TemplateHubScreen({ role = "teacher" }: { role?: "teacher" | "registrar" }) {
  const [modal, setModal] = useState<"rc" | null>(null);

  // QA / Test Environment Flag: strictly opt-in via VITE_IS_UAT or URL query parameter ?uat=true
  const isUatMode = import.meta.env.VITE_IS_UAT === 'true' || 
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('uat') === 'true');

  // Academic Sections State
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [loadingSections, setLoadingSections] = useState<boolean>(true);

  // Section Roster State
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Report Card State
  const [rcData, setRcData] = useState<any>(null);
  const [loadingRc, setLoadingRc] = useState<boolean>(false);
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

  // 1. Fetch authorized academic sections
  useEffect(() => {
    async function loadSections() {
      setLoadingSections(true);
      try {
        if (role === 'teacher') {
          const res = await apiClient.get<any[]>('/academic/my-classes');
          if (Array.isArray(res) && res.length > 0) {
            const mapped: SectionOption[] = res
              .filter((c: any) => c.sectionId)
              .map((c: any) => ({
                id: c.sectionId,
                name: c.section || `Grade ${c.grade}`,
                grade_level: c.grade || 7,
                label: `Grade ${c.grade || 7} - ${c.section || 'Assigned Section'}`,
              }));
            // Deduplicate by sectionId
            const unique = Array.from(new Map(mapped.map((s) => [s.id, s])).values());
            setSections(unique);
            if (unique.length > 0) {
              setSelectedSectionId(unique[0].id);
            }
          } else {
            setSections([]);
          }
        } else {
          // Registrar / Principal: Fetch active academic year sections
          const yearsRes = await apiClient.get<any[]>('/academic/years');
          const activeYear = Array.isArray(yearsRes) ? yearsRes.find((y: any) => y.is_active) || yearsRes[0] : null;
          if (activeYear) {
            const secRes = await apiClient.get<any>(`/academic/years/${activeYear.id}/sections`);
            const secList = Array.isArray(secRes?.data) ? secRes.data : Array.isArray(secRes) ? secRes : [];
            const formatted: SectionOption[] = secList.map((s: any) => ({
              id: s.id,
              name: s.name,
              grade_level: s.grade_level || 7,
              label: `Grade ${s.grade_level || 7} - ${s.name}`,
            }));
            setSections(formatted);
            if (formatted.length > 0) {
              setSelectedSectionId(formatted[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load sections', err);
        setSections([]);
      } finally {
        setLoadingSections(false);
      }
    }
    loadSections();
  }, [role]);

  // 2. Fetch enrolled students whenever selectedSectionId changes
  useEffect(() => {
    if (!selectedSectionId) {
      setStudents([]);
      setSelectedStudentId('');
      return;
    }

    async function fetchRoster() {
      setLoadingStudents(true);
      try {
        const res = await apiClient.get<any>(`/academic/sections/${selectedSectionId}/roster`);
        const roster = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const currentSection = sections.find((s) => s.id === selectedSectionId);

        const list: StudentOption[] = roster.map((item: any) => {
          const s = item.student || item;
          const u = s.user || item.user || {};
          const last = u.last_name || '';
          const first = u.first_name || '';
          return {
            id: s.id || item.id,
            lrn: u.lrn || s.lrn || 'Pending',
            firstName: first,
            lastName: last,
            fullName: last && first ? `${last}, ${first}` : (u.name || 'Enrolled Learner'),
            gender: u.gender || s.gender,
            gradeLevel: s.current_section?.grade_level || currentSection?.grade_level || 7,
            section: s.current_section?.name || currentSection?.name || 'Assigned Section',
          };
        });

        // Sort alphabetically by last name, first name
        list.sort((a, b) => a.fullName.localeCompare(b.fullName));
        setStudents(list);
        setSelectedStudentId(''); // Never preselect default learner; require deliberate user choice
      } catch (err) {
        console.error('Failed to load section roster', err);
        setStudents([]);
        setSelectedStudentId('');
      } finally {
        setLoadingStudents(false);
      }
    }

    fetchRoster();
  }, [selectedSectionId, sections]);

  async function handleView() {
    if (!selectedStudentId) return;

    setLoadingRc(true);
    setRcError(null);

    const sel = students.find((s) => s.id === selectedStudentId);
    const initialStudentData = {
      student: {
        id: selectedStudentId,
        name: sel?.fullName || 'Enrolled Learner',
        first_name: sel?.firstName,
        last_name: sel?.lastName,
        lrn: sel?.lrn || 'Pending',
        gender: sel?.gender,
      },
      enrollment: {
        gradeLevel: sel?.gradeLevel || 7,
        section: sel?.section || 'Assigned Section',
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

  const selectedSection = sections.find((s) => s.id === selectedSectionId);

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

          {/* Card 2: QA / Staff Verification Preview — STRICTLY OPT-IN in UAT Mode */}
          {isUatMode && (
            <div
              style={{ background: "#fff", border: "1px solid #bae6fd", borderTop: "3px solid #0284c7", borderRadius: 6, padding: "24px", textAlign: "left", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 36, lineHeight: 1 }}>🧪</div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#0369a1", background: "#e0f2fe", padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" }}>
                  QA Fixture Only
                </span>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 8 }}>
                  Synthetic SF9 Template Inspection
                </div>
                <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.6 }}>
                  Isolated test fixture: inspects authentic Calulut SF9 layout populated with synthetic baseline learner (Juan Dela Cruz, Grade 7 Agoncillo). Not for official school records.
                </div>
              </div>
              <div style={{ marginTop: "auto", display: "flex", gap: 10 }}>
                <button
                  onClick={() => setViewing("qa-preview")}
                  style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", borderRadius: 4, background: "#0284c7", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}
                >
                  <Sparkles size={14} /> Inspect Synthetic Fixture <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Student Selection Modal */}
      {modal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,8,8,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div style={{ background: "#fff", borderRadius: 6, width: "100%", maxWidth: 460, overflow: "hidden", boxShadow: "0 20px 60px rgba(74,10,16,0.4)" }}>
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
              {/* Section Selector */}
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Academic Section
                </label>
                {loadingSections ? (
                  <div style={{ fontSize: 13, color: C.t3, padding: "9px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                    <Loader2 size={14} className="animate-spin" /> Loading assigned sections...
                  </div>
                ) : sections.length === 0 ? (
                  <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
                    No assigned academic sections found for this account.
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <select
                      value={selectedSectionId}
                      onChange={e => setSelectedSectionId(e.target.value)}
                      style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "9px 28px 9px 10px", fontSize: 13, color: C.t1, background: "#fff", outline: "none", appearance: "none", cursor: "pointer" }}
                    >
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.t3, pointerEvents: "none" }} />
                  </div>
                )}
              </div>

              {/* Learner Selector */}
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Enrolled Learner
                </label>
                {loadingStudents ? (
                  <div style={{ fontSize: 13, color: C.t3, padding: "9px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                    <Loader2 size={14} className="animate-spin" /> Loading section roster...
                  </div>
                ) : sections.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.t3, padding: "4px 0" }}>
                    Assign a section to select learners.
                  </div>
                ) : students.length === 0 ? (
                  <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
                    No learners currently enrolled in {selectedSection?.label || 'this section'}.
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <select
                      value={selectedStudentId}
                      onChange={e => setSelectedStudentId(e.target.value)}
                      style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "9px 28px 9px 10px", fontSize: 13, color: C.t1, background: "#fff", outline: "none", appearance: "none", cursor: "pointer" }}
                    >
                      <option value="">-- Select an Enrolled Learner --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.fullName} (LRN: {s.lrn})
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

              {/* QA Preview Option — ONLY visible in explicit UAT mode */}
              {isUatMode && (
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setModal(null);
                      setViewing("qa-preview");
                    }}
                    style={{ fontSize: 11, color: "#0284c7", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
                  >
                    ⚡ Open Synthetic QA Preview instead (UAT)
                  </button>
                </div>
              )}
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
                style={{
                  padding: "9px 22px",
                  background: selectedStudentId ? C.m700 : "#cbd5e1",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: selectedStudentId ? "pointer" : "not-allowed",
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
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
