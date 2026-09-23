import React from 'react';
import { C } from '../constants/tokens';
import { BookMarked } from 'lucide-react';
import { ReportCardDTO } from '../../../../../backend/src/academic/reportCard.service';

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

export function Form138({ data }: { data: ReportCardDTO }) {
  const { student, school, enrollment, scholastic, attendance, adviser, principal } = data;

  const isPromoted = scholastic.generalAverage !== null && scholastic.generalAverage >= 75;
  const hasFailed = scholastic.subjects.some(s => s.finalRating !== null && s.finalRating < 75);
  const finalRemark = isPromoted ? (hasFailed ? "CONDITIONAL" : "PROMOTED") : (scholastic.generalAverage !== null ? "RETAINED" : "");

  return (
    <div style={{ 
      background: "#fff", 
      fontFamily: "'Inter', sans-serif",
      width: "100%",
      maxWidth: 900,
      margin: "0 auto",
      boxSizing: "border-box",
      border: `1.5px solid ${C.m800}`,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      WebkitPrintColorAdjust: "exact",
      printColorAdjust: "exact"
    }}>

      {/* ── Official Document Header ── */}
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
              Republic of the Philippines · Department of Education · {school.region}
            </div>
            <div style={{ color: "#fff", fontSize: 14.5, fontWeight: 800, fontFamily: "'Fraunces', serif", whiteSpace: "nowrap" }}>
              {school.name}
            </div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 8.5, whiteSpace: "nowrap" }}>
              {school.district}, {school.division} · School ID: {school.schoolId}
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
            {school.academicYear}
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
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, whiteSpace: "nowrap" }}>{student.name}</div>
          </div>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: C.t3, textTransform: "uppercase" }}>Grade & Section</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, whiteSpace: "nowrap" }}>Grade {enrollment.gradeLevel} - {enrollment.section}</div>
          </div>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: C.t3, textTransform: "uppercase" }}>LRN</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{student.lrn}</div>
          </div>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: C.t3, textTransform: "uppercase" }}>Gender / Age</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, whiteSpace: "nowrap" }}>{student.gender} · Age {student.age !== null ? student.age : "N/A"}</div>
          </div>
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: C.t3, textTransform: "uppercase" }}>Class Adviser</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, whiteSpace: "nowrap" }}>{adviser || ""}</div>
          </div>
        </div>
      </div>

      {/* ── Main Scholastic Grades Table ── */}
      <div style={{ borderBottom: `1px solid ${C.borderMed}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <colgroup>
            <col style={{ width: "26%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "16%" }} />
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
              {["Term 1", "Term 2", "Term 3", "Term 4"].map(t => (
                <th key={t} style={{ textAlign: "center", padding: "7px 4px", fontSize: 8.5, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1px solid rgba(255,255,255,0.2)`, whiteSpace: "nowrap" }}>{t}</th>
              ))}
              <th style={{ textAlign: "center", padding: "7px 6px", fontSize: 8.5, fontWeight: 800, color: C.gold, textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1.5px solid rgba(255,255,255,0.3)`, whiteSpace: "nowrap" }}>Final Rating</th>
              <th style={{ textAlign: "center", padding: "7px 6px", fontSize: 8.5, fontWeight: 800, color: "rgba(255,255,255,0.95)", textTransform: "uppercase", letterSpacing: "0.06em", borderLeft: `1px solid rgba(255,255,255,0.2)`, whiteSpace: "nowrap" }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {scholastic.subjects.map((sub, i) => {
              const passed = sub.remarks === 'PASSED';
              return (
                <tr key={sub.id}
                  style={{ 
                    borderBottom: `1px solid ${C.border}`, 
                    background: i % 2 === 0 ? "#ffffff" : C.paper,
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact"
                  }}
                >
                  <td style={{ padding: "6px 18px", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, whiteSpace: "nowrap" }}>{sub.name}</div>
                  </td>
                  {[
                    sub.T1,
                    sub.T2,
                    sub.T3,
                    sub.T4
                  ].map((val, j) => (
                    <td key={j} style={{ textAlign: "center", padding: "6px 4px", borderLeft: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                      <span style={{ 
                        fontSize: 11.5, 
                        fontWeight: 700, 
                        fontFamily: "'JetBrains Mono',monospace",
                        color: val && val >= 90 ? "#15803d" : val && val >= 85 ? "#1e40af" : val && val >= 75 ? "#0f172a" : "#b91c1c"
                      }}>
                        {val !== null ? val : <span style={{ color: C.red }}>-</span>}
                      </span>
                    </td>
                  ))}
                  {/* Final Rating */}
                  <td style={{ textAlign: "center", padding: "6px 6px", borderLeft: `1.5px solid ${C.borderMed}`, background: sub.finalRating !== null ? (passed ? "#f8fafc" : C.redBg) : "transparent", whiteSpace: "nowrap" }}>
                    <span style={{ 
                      fontSize: 12.5, 
                      fontWeight: 800, 
                      fontFamily: "'JetBrains Mono',monospace", 
                      color: sub.finalRating !== null && sub.finalRating < 75 ? "#b91c1c" : sub.finalRating !== null && sub.finalRating >= 90 ? "#15803d" : C.t1 
                    }}>
                      {sub.finalRating !== null ? sub.finalRating : <span style={{ color: C.red }}>-</span>}
                    </span>
                  </td>
                  {/* Remarks Badge */}
                  <td style={{ textAlign: "center", padding: "6px 6px", borderLeft: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                    {sub.remarks !== null ? (
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
              <td colSpan={5} style={{ padding: "8px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.1em" }}>General Average (GPA)</div>
              </td>
              <td style={{ textAlign: "center", padding: "8px 6px", borderLeft: `1.5px solid rgba(255,255,255,0.2)` }}>
                <div style={{ color: C.gold, fontSize: 7, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Final Rating</div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: scholastic.generalAverage !== null && scholastic.generalAverage < 75 ? "#fca5a5" : "#fff" }}>
                  {scholastic.generalAverage !== null ? scholastic.generalAverage : <span style={{ color: C.red }}>-</span>}
                </div>
              </td>
              <td style={{ textAlign: "center", padding: "8px 6px", borderLeft: `1px solid rgba(255,255,255,0.2)` }}>
                {scholastic.generalAverage !== null ? (
                  <Stamp 
                    label={finalRemark} 
                    color={isPromoted ? "#15803d" : "#b91c1c"} 
                    bg={isPromoted ? "#dcfce7" : "#fee2e2"} 
                    border={isPromoted ? "#bbf7d0" : "#fecaca"}
                  />
                ) : <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>-</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div style={{ display: "flex", background: C.paper, padding: 12, gap: 12, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        
        {/* Descriptors */}
        <div style={{ flex: 1, border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: "8px 12px", background: "#fff" }}>
          <div style={{ fontSize: 7.5, fontWeight: 800, color: C.m700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Descriptors & Grading Scale</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 8.5, color: C.t2 }}>
            <div><strong>90-100:</strong> Outstanding</div>
            <div><strong>85-89:</strong> Very Satisfactory</div>
            <div><strong>80-84:</strong> Satisfactory</div>
            <div><strong>75-79:</strong> Fairly Satisfactory</div>
            <div><strong>&lt;75:</strong> Failed</div>
          </div>
        </div>

        {/* Signatures */}
        <div style={{ flex: 1.5, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "4px 8px" }}>
          <div style={{ fontSize: 7.5, fontWeight: 800, color: C.m700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Official Signatures & Certification</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            {/* Adviser */}
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ borderTop: `1px solid ${C.t1}`, paddingTop: 3, marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.t1, whiteSpace: "nowrap" }}>{adviser || ""}</div>
                <div style={{ fontSize: 7.5, color: C.t3, whiteSpace: "nowrap" }}>Class Adviser</div>
              </div>
            </div>
            {/* Principal */}
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ borderTop: `1px solid ${C.t1}`, paddingTop: 3, marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.t1, whiteSpace: "nowrap" }}>{principal || ""}</div>
                <div style={{ fontSize: 7.5, color: C.t3, whiteSpace: "nowrap" }}>School Principal</div>
              </div>
            </div>
            {/* Parent */}
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ borderTop: `1px solid ${C.t1}`, paddingTop: 3, marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.t1, whiteSpace: "nowrap" }}>&nbsp;</div>
                <div style={{ fontSize: 7.5, color: C.t3, whiteSpace: "nowrap" }}>Parent / Guardian<br/><span style={{ fontSize: 6.5 }}>Conforme</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ 
        padding: "8px 18px", 
        background: C.m50, 
        borderTop: `1px solid ${C.borderMed}`, 
        fontSize: 7.5, 
        color: C.t3,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ whiteSpace: "nowrap" }}>Official DepEd Form 138-JHS (SF9) · {school.name} · DigiSkwela Security Verified</div>
        <div style={{ display: "flex", gap: 14, whiteSpace: "nowrap" }}>
          <span>LRN: <strong>{student.lrn}</strong></span>
          <span>Date Issued: <strong>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</strong></span>
        </div>
      </div>

    </div>
  );
}
