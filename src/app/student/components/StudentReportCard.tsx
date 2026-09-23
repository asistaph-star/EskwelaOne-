import { BookMarked } from 'lucide-react';
import React from 'react';
import { C } from '../../shared/constants/tokens';
import { gradeColor } from '../../shared/utils/helpers';

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

export const RC_SUBJECTS = [
  { name: "Filipino", short: "Filipino", term1: 89.5, term2: 92.0, term3: 90.8 },
  { name: "English", short: "English", term1: 90.2, term2: 91.4, term3: 88.8 },
  { name: "Mathematics", short: "Math", term1: 83.0, term2: 85.2, term3: 82.6 },
  { name: "Science", short: "Science", term1: 95.0, term2: 96.5, term3: 94.0 },
  { name: "Araling Panlipunan", short: "A.P.", term1: 94.8, term2: 96.0, term3: 94.2 },
  { name: "Technology & Livelihood Educ.", short: "TLE", term1: 91.8, term2: 93.8, term3: 92.5 },
  { name: "MAPEH", short: "MAPEH", term1: 96.0, term2: 97.2, term3: 95.0 },
  { name: "Edukasyon sa Pagpapakatao", short: "EsP", term1: 97.8, term2: 98.8, term3: 96.8 },
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
  term1: number;
  term2: number;
  term3: number;
  term4?: number;
}

export function getDynamicGrades(surname: string, targetAvg: number) {
  return RC_SUBJECTS.map((s, i) => {
    const diff = (s.short === "Math" || s.short === "Science") ? -2 : (s.short === "MAPEH" || s.short === "EsP") ? +2 : 0;
    const rand = (surname.charCodeAt(0) + i * 7) % 7 - 3;
    const term1 = Math.max(60, Math.min(99, Math.round(targetAvg + diff + rand)));
    const term2 = Math.max(60, Math.min(99, Math.round(targetAvg + diff + (rand * -1) % 4)));
    const term3 = Math.max(60, Math.min(99, Math.round(targetAvg + diff + (rand + 1) % 4)));
    return { ...s, term1, term2, term3 };
  });
}

export function StudentReportCard({ 
  student, 
  subjects,
  statuses, 
  compact = false 
}: { 
  student: RCStudent; 
  subjects?: SubjectGradeItem[];
  statuses?: { term1: string; term2: string; term3: string }; 
  compact?: boolean; 
}) {
  const subs = subjects && subjects.length > 0
    ? subjects
    : student.avg
      ? getDynamicGrades(student.surname, student.avg)
      : RC_SUBJECTS;

  function calcSubAvg(sg: { term1?: number; term2?: number; term3?: number; term4?: number }) {
    const terms = [sg.term1, sg.term2, sg.term3].filter((t): t is number => typeof t === 'number' && t > 0);
    if (terms.length === 0) return 0;
    const sum = terms.reduce((a, b) => a + b, 0);
    return Math.round((sum / terms.length) * 10) / 10;
  }

  const term1List = subs.map(s => s.term1).filter((t): t is number => typeof t === 'number' && t > 0);
  const term2List = subs.map(s => s.term2).filter((t): t is number => typeof t === 'number' && t > 0);
  const term3List = subs.map(s => s.term3).filter((t): t is number => typeof t === 'number' && t > 0);

  const t1Avg = term1List.length > 0 ? (term1List.reduce((a, b) => a + b, 0) / term1List.length).toFixed(1) : "-";
  const t2Avg = term2List.length > 0 ? (term2List.reduce((a, b) => a + b, 0) / term2List.length).toFixed(1) : "-";
  const t3Avg = term3List.length > 0 ? (term3List.reduce((a, b) => a + b, 0) / term3List.length).toFixed(1) : "-";

  const allAvgs = subs.map(s => calcSubAvg(s)).filter(a => a > 0);
  const genAvg = allAvgs.length > 0 ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 10) / 10 : 0;
  const failedCount = allAvgs.filter(a => a < 75).length;

  const isPromoted = genAvg >= 75;
  const finalRemark = isPromoted ? (failedCount === 0 ? "PROMOTED" : "CONDITIONAL") : "RETAINED";

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
              Calulut Integrated School
            </div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 8.5, whiteSpace: "nowrap" }}>
              Sindalan, City of San Fernando, Pampanga · Division of San Fernando City · School ID: 300941
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
            DepEd Form 138 / SF9-JHS
          </div>
          <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, fontFamily: "'Fraunces', serif", whiteSpace: "nowrap" }}>
            Learner's Official Progress Report Card
          </div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 9, whiteSpace: "nowrap" }}>
            School Year 2025–2026
          </div>
        </div>
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
            <col style={{ width: "34%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "18%" }} />
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
              {["Term 1", "Term 2", "Term 3"].map(t => (
                <th key={t} style={{ textAlign: "center", padding: "7px 4px", fontSize: 8.5, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1px solid rgba(255,255,255,0.2)`, whiteSpace: "nowrap" }}>{t}</th>
              ))}
              <th style={{ textAlign: "center", padding: "7px 6px", fontSize: 8.5, fontWeight: 800, color: C.gold, textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1.5px solid rgba(255,255,255,0.3)`, whiteSpace: "nowrap" }}>Final Rating</th>
              <th style={{ textAlign: "center", padding: "7px 6px", fontSize: 8.5, fontWeight: 800, color: "rgba(255,255,255,0.95)", textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1px solid rgba(255,255,255,0.2)`, whiteSpace: "nowrap" }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((sg, i) => {
              const avg = calcSubAvg(sg);
              const passed = avg >= 75;
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
                  {[
                    sg.term1,
                    sg.term2,
                    sg.term3
                  ].map((val, j) => (
                    <td key={j} style={{ textAlign: "center", padding: "6px 4px", borderLeft: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                      <span style={{ 
                        fontSize: 11.5, 
                        fontWeight: 700, 
                        fontFamily: "'JetBrains Mono',monospace",
                        color: val && val >= 90 ? "#15803d" : val && val >= 85 ? "#1e40af" : val && val >= 75 ? "#0f172a" : "#b91c1c"
                      }}>
                        {val && val > 0 ? val.toFixed(1) : "-"}
                      </span>
                    </td>
                  ))}
                  {/* Final Rating */}
                  <td style={{ textAlign: "center", padding: "6px 6px", borderLeft: `1.5px solid ${C.borderMed}`, background: avg > 0 ? (passed ? "#f8fafc" : C.redBg) : "transparent", whiteSpace: "nowrap" }}>
                    <span style={{ 
                      fontSize: 12.5, 
                      fontWeight: 800, 
                      fontFamily: "'JetBrains Mono',monospace", 
                      color: avg < 75 && avg > 0 ? "#b91c1c" : avg >= 90 ? "#15803d" : C.t1 
                    }}>
                      {avg > 0 ? avg.toFixed(1) : "-"}
                    </span>
                  </td>
                  {/* Remarks Badge */}
                  <td style={{ textAlign: "center", padding: "6px 6px", borderLeft: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                    {avg > 0 ? (
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
              {[t1Avg, t2Avg, t3Avg].map((avgVal, j) => (
                <td key={j} style={{ textAlign: "center", padding: "8px 4px", borderLeft: `1px solid rgba(255,255,255,0.2)` }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "'JetBrains Mono',monospace" }}>{avgVal}</span>
                </td>
              ))}
              {/* General Average Score & Promotion Stamp */}
              <td colSpan={2} style={{ padding: "6px 14px", borderLeft: `1.5px solid rgba(255,255,255,0.3)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Final Rating</div>
                    <div style={{ fontSize: 19, fontWeight: 800, color: genAvg >= 75 ? C.gold : "#f87171", fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>
                      {genAvg > 0 ? genAvg.toFixed(1) : "-"}
                    </div>
                  </div>
                  <div style={{ width: 1.5, height: 24, background: "rgba(255,255,255,0.2)" }} />
                  <div>
                    {genAvg > 0 ? (
                      <Stamp 
                        label={finalRemark} 
                        color={isPromoted ? C.m900 : "#fff"} 
                        bg={isPromoted ? C.gold : C.red} 
                      />
                    ) : (
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>-</span>
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

        {/* 2. Grading Scale */}
        <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.borderMed}` }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: C.m700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
            Descriptors & Grading Scale
          </div>
          <div style={{ fontSize: 7.5, color: C.t2, lineHeight: 1.35, background: "#fff", padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.borderMed}` }}>
            <div><strong>90–100:</strong> Outstanding · <strong>85–89:</strong> Very Satisfactory</div>
            <div><strong>80–84:</strong> Satisfactory · <strong>75–79:</strong> Fairly Satisfactory · <strong>&lt;75:</strong> Failed</div>
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
        <div style={{ whiteSpace: "nowrap" }}>Official DepEd Form 138-JHS (SF9) · Calulut Integrated School · DigiSkwela Security Verified</div>
        <div style={{ display: "flex", gap: 14, whiteSpace: "nowrap" }}>
          <span>LRN: <strong>{student.lrn}</strong></span>
          <span>Date Issued: <strong>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</strong></span>
        </div>
      </div>

    </div>
  );
}
