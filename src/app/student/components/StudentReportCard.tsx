import { BookMarked } from 'lucide-react';
import React from 'react';
import { C } from '../../shared/constants/tokens';
import { gradeColor } from '../../shared/utils/helpers';
import { useSchoolSettings } from '../../shared/context/SchoolSettingsContext';

function Stamp({ label, color, bg, border }: { label: string; color: string; bg: string; border?: string }) {
  return (
    <span style={{ 
      display: "inline-block", 
      padding: "2.5px 8px", 
      borderRadius: 4, 
      fontSize: 8.5, 
      fontWeight: 800, 
      textTransform: "uppercase", 
      letterSpacing: "0.08em", 
      color, 
      background: bg,
      border: border ? `1px solid ${border}` : undefined,
      WebkitPrintColorAdjust: "exact",
      printColorAdjust: "exact",
      whiteSpace: "nowrap"
    }}>
      {label}
    </span>
  );
}

export const RC_SUBJECTS: SubjectGradeItem[] = [
  { name: "Filipino", short: "Filipino", term1: 0, term2: 0, term3: 0 },
  { name: "English", short: "English", term1: 0, term2: 0, term3: 0 },
  { name: "Mathematics", short: "Math", term1: 0, term2: 0, term3: 0 },
  { name: "Science", short: "Science", term1: 0, term2: 0, term3: 0 },
  { name: "Araling Panlipunan", short: "A.P.", term1: 0, term2: 0, term3: 0 },
  { name: "Technology & Livelihood Educ.", short: "TLE", term1: 0, term2: 0, term3: 0 },
  { name: "MAPEH", short: "MAPEH", term1: 0, term2: 0, term3: 0 },
  { name: "Edukasyon sa Pagpapakatao", short: "EsP", term1: 0, term2: 0, term3: 0 },
];

export interface RCStudent {
  surname: string;
  first: string;
  lrn: string;
  grade: number;
  section: string;
  adviser: string;
  gender: string;
  avg?: number;
}

export interface SubjectGradeItem {
  name: string;
  short?: string;
  term1: number | null;
  term2: number | null;
  term3: number | null;
  term4?: number | null;
}

export function StudentReportCard({ 
  student, 
  subjects,
  statuses, 
  configuredTerms,
  compact = false 
}: { 
  student: RCStudent; 
  subjects?: SubjectGradeItem[];
  statuses?: { term1: string; term2: string; term3: string }; 
  configuredTerms?: ('T1' | 'T2' | 'T3' | 'T4')[];
  compact?: boolean; 
}) {
  const { settings } = useSchoolSettings();
  const schoolDisplayName = settings.schoolName || "DigiSkwela Official Academic Record";
  const schoolAddressDisplay = settings.address || "";

  // Strictly legitimate saved grades — no synthetic random generation
  const rawSubs = subjects && subjects.length > 0 ? subjects : RC_SUBJECTS;

  // Source of truth for configured terms:
  // If configuredTerms is provided, use it.
  // Fallback: If any subject has term4 defined (even if null), it is a 4-term year. Otherwise, 3-term year.
  const activeTerms: ('T1' | 'T2' | 'T3' | 'T4')[] = (configuredTerms && configuredTerms.length > 0)
    ? configuredTerms
    : (rawSubs.some(s => s.term4 !== undefined) ? ['T1', 'T2', 'T3', 'T4'] : ['T1', 'T2', 'T3']);

  const musicItem = rawSubs.find(s => /music/i.test(s.name));
  const peItem = rawSubs.find(s => /physical education|\bpe\b/i.test(s.name));
  const subs: SubjectGradeItem[] = (musicItem && peItem)
    ? [
        ...rawSubs.filter(s => s !== musicItem && s !== peItem),
        {
          name: "MAPEH",
          short: "MAPEH",
          term1: (typeof musicItem.term1 === 'number' && musicItem.term1 > 0 && typeof peItem.term1 === 'number' && peItem.term1 > 0) ? Math.round((musicItem.term1 + peItem.term1) / 2) : null,
          term2: (typeof musicItem.term2 === 'number' && musicItem.term2 > 0 && typeof peItem.term2 === 'number' && peItem.term2 > 0) ? Math.round((musicItem.term2 + peItem.term2) / 2) : null,
          term3: (typeof musicItem.term3 === 'number' && musicItem.term3 > 0 && typeof peItem.term3 === 'number' && peItem.term3 > 0) ? Math.round((musicItem.term3 + peItem.term3) / 2) : null,
          term4: (typeof musicItem.term4 === 'number' && musicItem.term4 > 0 && typeof peItem.term4 === 'number' && peItem.term4 > 0) ? Math.round((musicItem.term4 + peItem.term4) / 2) : null,
        }
      ]
    : rawSubs;

  /**
   * DepEd Form 138 / SF9-JHS authoritative formula:
   * All configured terms must be completed (> 0).
   * Missing or unpublished terms return null (incomplete).
   */
  function calcSubAvg(sg: { term1?: number | null; term2?: number | null; term3?: number | null; term4?: number | null }): number | null {
    const termMap: Record<string, number | null | undefined> = {
      T1: sg.term1,
      T2: sg.term2,
      T3: sg.term3,
      T4: sg.term4,
    };
    for (const t of activeTerms) {
      const val = termMap[t];
      if (typeof val !== 'number' || val <= 0) {
        return null; // Incomplete: missing or unpublished term
      }
    }
    const sum = activeTerms.reduce((acc, t) => acc + (termMap[t] as number), 0);
    return Math.round(sum / activeTerms.length);
  }

  const termLabels: Record<string, string> = {
    T1: 'Term 1',
    T2: 'Term 2',
    T3: 'Term 3',
    T4: 'Term 4',
  };

  const allAvgs = subs.map(s => calcSubAvg(s));
  const hasAllSubjects = subs.length > 0 && allAvgs.every((a): a is number => a !== null && a > 0);
  // General Average: integer rounded average of all completed learning areas
  const genAvg = hasAllSubjects ? Math.round((allAvgs as number[]).reduce((a, b) => a + b, 0) / allAvgs.length) : null;
  const failedCount = allAvgs.filter((a): a is number => a !== null && a < 75).length;

  const isPromoted = genAvg !== null && genAvg >= 75;
  const finalRemark = genAvg !== null ? (isPromoted ? (failedCount === 0 ? "PROMOTED" : "CONDITIONAL") : "RETAINED") : "PENDING";


  return (
    <div style={{ 
      background: "#fff", 
      fontFamily: "'Inter', sans-serif",
      width: "100%",
      margin: "0 auto",
      boxSizing: "border-box",
      border: `1.5px solid ${C.m800}`,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      WebkitPrintColorAdjust: "exact",
      printColorAdjust: "exact"
    }}>

      {/* ── Official Document Header (No title wrapping) ── */}
      <div style={{ 
        background: C.m800, 
        padding: "10px 18px", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        borderBottom: `2.5px solid ${C.gold}`,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ 
            width: 36, 
            height: 36, 
            borderRadius: 6, 
            background: "rgba(245,158,11,0.15)", 
            border: `1.5px solid rgba(245,158,11,0.45)`, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            flexShrink: 0 
          }}>
            <BookMarked size={20} color={C.gold} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1, whiteSpace: "nowrap" }}>
              Republic of the Philippines · Department of Education · Region III
            </div>
            <div style={{ color: "#fff", fontSize: 14.5, fontWeight: 800, fontFamily: "'Fraunces', serif", whiteSpace: "nowrap" }}>
              {schoolDisplayName}
            </div>
            {schoolAddressDisplay && (
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 8.5, whiteSpace: "nowrap" }}>
                {schoolAddressDisplay}
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
            Portal Scholastic Overview (Unofficial Preview)
          </div>
          <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, fontFamily: "'Fraunces', serif", whiteSpace: "nowrap" }}>
            Learner's Academic Progress Overview
          </div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 9, whiteSpace: "nowrap" }}>
            School Year 2026–2027
          </div>
        </div>
      </div>

      {/* ── Unofficial Web Portal Notice ── */}
      <div style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a", padding: "6px 18px", fontSize: "8pt", color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notice:</span>
        <span>This view is an unofficial progress summary. Official DepEd SF9 Form 138 report cards for Calulut Integrated School are issued in the school's authorized 3-term Excel format by the Class Adviser or Registrar.</span>
      </div>

      {/* ── Student Information Bar ── */}
      <div style={{ 
        borderBottom: `1.5px solid ${C.m700}`, 
        padding: "8px 18px", 
        background: C.m50,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.8fr 1fr 1fr", gap: "6px 14px", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: C.t3, textTransform: "uppercase" }}>Full Name</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, whiteSpace: "nowrap" }}>{student.surname}, {student.first}</div>
          </div>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: C.t3, textTransform: "uppercase" }}>Grade & Section</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, whiteSpace: "nowrap" }}>Grade {student.grade} - {student.section}</div>
          </div>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: C.t3, textTransform: "uppercase" }}>LRN</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{student.lrn}</div>
          </div>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: C.t3, textTransform: "uppercase" }}>Gender / Track</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, whiteSpace: "nowrap" }}>{student.gender === "female" ? "Female" : "Male"} · Academic</div>
          </div>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: C.t3, textTransform: "uppercase" }}>Class Adviser</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, whiteSpace: "nowrap" }}>{student.adviser}</div>
          </div>
        </div>
      </div>

      {/* ── Main Scholastic Grades Table ── */}
      <div style={{ borderBottom: `1px solid ${C.borderMed}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <colgroup>
            <col style={{ width: activeTerms.length === 4 ? "30%" : "34%" }} />
            {activeTerms.map(t => (
              <col key={t} style={{ width: activeTerms.length === 4 ? "9.5%" : "11%" }} />
            ))}
            <col style={{ width: activeTerms.length === 4 ? "14%" : "15%" }} />
            <col style={{ width: activeTerms.length === 4 ? "18%" : "18%" }} />
          </colgroup>
          <thead>
            <tr style={{ 
              background: C.m700,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact"
            }}>
              <th style={{ textAlign: "left", padding: "7px 18px", fontSize: 8.5, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                Learning Area / Subject
              </th>
              {activeTerms.map(t => (
                <th key={t} style={{ textAlign: "center", padding: "7px 4px", fontSize: 8.5, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1px solid rgba(255,255,255,0.2)`, whiteSpace: "nowrap" }}>
                  {termLabels[t] || t}
                </th>
              ))}
              <th style={{ textAlign: "center", padding: "7px 6px", fontSize: 8.5, fontWeight: 800, color: C.gold, textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1.5px solid rgba(255,255,255,0.3)`, whiteSpace: "nowrap" }}>Final Rating</th>
              <th style={{ textAlign: "center", padding: "7px 6px", fontSize: 8.5, fontWeight: 800, color: "rgba(255,255,255,0.95)", textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1px solid rgba(255,255,255,0.2)`, whiteSpace: "nowrap" }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((sg, i) => {
              const avg = calcSubAvg(sg);
              const passed = avg !== null && avg >= 75;
              return (
                <tr key={sg.name}
                  style={{ 
                    borderBottom: `1px solid ${C.border}`, 
                    background: i % 2 === 0 ? "#ffffff" : C.paper,
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact"
                  }}
                >
                  <td style={{ padding: "6px 18px", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, whiteSpace: "nowrap" }}>{sg.name}</div>
                  </td>
                  {activeTerms.map((tKey) => {
                    const val = tKey === 'T1' ? sg.term1 : tKey === 'T2' ? sg.term2 : tKey === 'T3' ? sg.term3 : sg.term4;
                    return (
                      <td key={tKey} style={{ textAlign: "center", padding: "6px 4px", borderLeft: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                        <span style={{ 
                          fontSize: 11.5, 
                          fontWeight: 700, 
                          fontFamily: "'JetBrains Mono',monospace",
                          color: val && val >= 90 ? "#15803d" : val && val >= 85 ? "#1e40af" : val && val >= 75 ? "#0f172a" : "#b91c1c"
                        }}>
                          {val && val > 0 ? (Number.isInteger(val) ? val : val.toFixed(1)) : "-"}
                        </span>
                      </td>
                    );
                  })}
                  {/* Final Rating */}
                  <td style={{ textAlign: "center", padding: "6px 6px", borderLeft: `1.5px solid ${C.borderMed}`, background: avg !== null ? (passed ? "#f8fafc" : C.redBg) : "transparent", whiteSpace: "nowrap" }}>
                    <span style={{ 
                      fontSize: 12.5, 
                      fontWeight: 800, 
                      fontFamily: "'JetBrains Mono',monospace", 
                      color: avg !== null && avg < 75 ? "#b91c1c" : avg !== null && avg >= 90 ? "#15803d" : C.t1 
                    }}>
                      {avg !== null ? avg : "-"}
                    </span>
                  </td>
                  {/* Remarks Badge */}
                  <td style={{ textAlign: "center", padding: "6px 6px", borderLeft: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                    {avg !== null ? (
                      <Stamp 
                        label={passed ? "PASSED" : "FAILED"} 
                        color={passed ? "#15803d" : "#b91c1c"} 
                        bg={passed ? "#dcfce7" : "#fee2e2"} 
                        border={passed ? "#bbf7d0" : "#fecaca"}
                      />
                    ) : (
                      <span style={{ color: C.t3, fontSize: 10 }}>-</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* General Average Row */}
            <tr style={{ 
              background: C.m800, 
              borderTop: `2px solid ${C.m700}`,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact"
            }}>
              <td style={{ padding: "8px 18px", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", fontFamily: "'Fraunces',serif", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>General Average (GPA)</span>
              </td>
              {activeTerms.map((tKey) => {
                const field = tKey === 'T1' ? 'term1' : tKey === 'T2' ? 'term2' : tKey === 'T3' ? 'term3' : 'term4';
                const termVals = subs.map(s => (s as any)[field]).filter((t): t is number => typeof t === 'number' && t > 0);
                const avgStr = termVals.length > 0 ? Math.round(termVals.reduce((a, b) => a + b, 0) / termVals.length).toString() : "-";
                return (
                  <td key={tKey} style={{ textAlign: "center", padding: "8px 4px", borderLeft: `1px solid rgba(255,255,255,0.2)` }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "'JetBrains Mono',monospace" }}>{avgStr}</span>
                  </td>
                );
              })}
              {/* General Average Score & Promotion Stamp */}
              <td colSpan={2} style={{ padding: "6px 14px", borderLeft: `1.5px solid rgba(255,255,255,0.3)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Final Rating</div>
                    <div style={{ fontSize: 19, fontWeight: 800, color: (genAvg !== null && genAvg >= 75) ? C.gold : (genAvg !== null ? "#f87171" : "rgba(255,255,255,0.4)"), fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>
                      {genAvg !== null ? genAvg : "-"}
                    </div>
                  </div>
                  <div style={{ width: 1.5, height: 24, background: "rgba(255,255,255,0.2)" }} />
                  <div>
                    {genAvg !== null ? (
                      <Stamp 
                        label={finalRemark} 
                        color={isPromoted ? C.m900 : "#fff"} 
                        bg={isPromoted ? C.gold : C.red} 
                      />
                    ) : (
                      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>Pending</span>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Horizontal 3-Box Footer Panel: Attendance, Scale, and Signatures (Side-by-Side) ── */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr 1.35fr", 
        borderBottom: `1px solid ${C.borderMed}`,
        background: C.paper,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact"
      }}>
        {/* 1. Attendance Summary */}
        <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.borderMed}` }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: C.m700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
            Attendance Summary (SY 2025–2026)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, background: "#fff", padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.borderMed}`, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 7, color: C.t3, textTransform: "uppercase", fontWeight: 700 }}>Days</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.t1 }}>180</div>
            </div>
            <div>
              <div style={{ fontSize: 7, color: C.t3, textTransform: "uppercase", fontWeight: 700 }}>Present</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#15803d" }}>176</div>
            </div>
            <div>
              <div style={{ fontSize: 7, color: C.t3, textTransform: "uppercase", fontWeight: 700 }}>Absent</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.t1 }}>4</div>
            </div>
            <div>
              <div style={{ fontSize: 7, color: C.t3, textTransform: "uppercase", fontWeight: 700 }}>Rate</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.m700 }}>97.8%</div>
            </div>
          </div>
        </div>

        {/* 2. Grading Scale (DepEd DO 015, s. 2026) */}
        <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.borderMed}` }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: C.m700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
            Descriptors & Grading Scale (DepEd DO 015, s. 2026)
          </div>
          <div style={{ fontSize: 7.5, color: C.t2, lineHeight: 1.35, background: "#fff", padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.borderMed}` }}>
            <div><strong>90–100:</strong> Advancing (A) · <strong>80–89:</strong> Benchmarking (B)</div>
            <div><strong>75–79:</strong> Connecting (C) · <strong>65–74:</strong> Developing (D) · <strong>&lt;75:</strong> Failed</div>
          </div>
        </div>

        {/* 3. Official Signatures (Teacher, Principal, Parent) */}
        <div style={{ padding: "10px 14px", background: "#fff" }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: C.m700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
            Official Signatures & Certification
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {/* Adviser */}
            <div style={{ textAlign: "center" }}>
              <div style={{ borderTop: `1px solid ${C.t1}`, paddingTop: 3, marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.t1, whiteSpace: "nowrap" }}>{student.adviser}</div>
                <div style={{ fontSize: 7.5, color: C.t3, whiteSpace: "nowrap" }}>Class Adviser</div>
              </div>
            </div>

            {/* Principal */}
            <div style={{ textAlign: "center" }}>
              <div style={{ borderTop: `1px solid ${C.t1}`, paddingTop: 3, marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.t1, whiteSpace: "nowrap" }}>Dr. Roberto Santos</div>
                <div style={{ fontSize: 7.5, color: C.t3, whiteSpace: "nowrap" }}>School Principal</div>
              </div>
            </div>

            {/* Parent */}
            <div style={{ textAlign: "center" }}>
              <div style={{ borderTop: `1px solid ${C.t1}`, paddingTop: 3, marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.t1, whiteSpace: "nowrap" }}>Parent / Guardian</div>
                <div style={{ fontSize: 7.5, color: C.t3, whiteSpace: "nowrap" }}>Conforme</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Security & Verification Strip ── */}
      <div style={{ 
        padding: "5px 18px", 
        background: C.m50, 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        fontSize: 8,
        color: C.t3,
        borderTop: `1px solid ${C.borderMed}`,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact"
      }}>
        <div style={{ whiteSpace: "nowrap" }}>Official DepEd Form 138-JHS (SF9) · {schoolDisplayName} · DigiSkwela Security Verified</div>
        <div style={{ display: "flex", gap: 14, whiteSpace: "nowrap" }}>
          <span>LRN: <strong>{student.lrn}</strong></span>
          <span>Date Issued: <strong>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</strong></span>
        </div>
      </div>

    </div>
  );
}
