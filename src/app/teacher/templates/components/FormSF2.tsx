import React from 'react';
import { C } from '../../../shared/constants/tokens';
import { ATT_DATES, ATT_STATUS_SEED, SECTION_GRADES } from '../../../shared/constants/seedData';

interface FormSF2Props {
  section: string;
  month: string;
  sy: string;
}

export function FormSF2({ section, month, sy }: FormSF2Props) {
  // Resolve section name to map to seed data keys
  const sectionKey = section.includes("Rizal") ? "Rizal (Gr.8)" :
                     section.includes("Einstein") ? "Einstein (Gr.9)" :
                     section.includes("Pilot") ? "Pilot (Gr.10)" : "Rizal (Gr.8)";

  const rawStudents = SECTION_GRADES[sectionKey] || [];

  // Helper to determine gender for listing grouping (DepEd standard splits Male/Female)
  function getGender(surname: string, first: string): "Male" | "Female" {
    const femaleNames = [
      "Liza Marie", "Trisha Ann", "Hannah Grace", "Angelica", 
      "Bianca", "Chloe", "Ana Kristine", "Hannah", "Trisha", "Angelica", "Maria"
    ];
    const isFemale = femaleNames.some(name => first.includes(name) || surname.includes(name));
    return isFemale ? "Female" : "Male";
  }

  // Group and sort students alphabetically by surname
  const studentsWithGender = rawStudents.map(st => ({
    ...st,
    gender: getGender(st.surname, st.first)
  }));

  const males = studentsWithGender.filter(s => s.gender === "Male").sort((a, b) => a.surname.localeCompare(b.surname));
  const females = studentsWithGender.filter(s => s.gender === "Female").sort((a, b) => a.surname.localeCompare(b.surname));

  // Attendance lookup logic (with deterministic mock generator for grades 9 and 10)
  function getStatus(studentId: number, date: number): "P" | "A" | "L" {
    // Grade 8 Rizal (ids 1-8) has seed data
    if (studentId >= 1 && studentId <= 8) {
      return (ATT_STATUS_SEED[studentId]?.[date]) ?? "P";
    }
    // Gr 9 (9-12) & Gr 10 (13-16) have deterministic generated values
    const hash = (studentId * 13 + date * 37) % 100;
    if (hash < 4) return "A";
    if (hash < 9) return "L";
    return "P";
  }

  // Count attendance stats
  const totalDays = ATT_DATES.length;

  const getStats = (stList: typeof studentsWithGender) => {
    let totalPresentDays = 0;
    let totalAbsentDays = 0;
    let totalLateDays = 0;

    const listStats = stList.map(st => {
      let p = 0;
      let a = 0;
      let l = 0;
      ATT_DATES.forEach(d => {
        const s = getStatus(st.id, d);
        if (s === "P") p++;
        else if (s === "A") a++;
        else if (s === "L") l++;
      });
      
      const presentOrLate = p + l; // Late counts as present for daily stats
      totalPresentDays += presentOrLate;
      totalAbsentDays += a;
      totalLateDays += l;

      return {
        ...st,
        p,
        a,
        l,
        presentOrLate,
        rate: totalDays > 0 ? Math.round((presentOrLate / totalDays) * 100) : 0
      };
    });

    const avgDailyAttendance = totalDays > 0 ? (totalPresentDays / totalDays) : 0;
    const pctAttendance = stList.length > 0 && totalDays > 0 
      ? Math.round((totalPresentDays / (stList.length * totalDays)) * 100) 
      : 0;

    return {
      listStats,
      avgDailyAttendance,
      pctAttendance,
      totalEnrolment: stList.length
    };
  };

  const maleStatsResult = getStats(males);
  const femaleStatsResult = getStats(females);
  const allStatsResult = getStats(studentsWithGender);

  // Colors for rendering
  const sColor = (s: "P" | "A" | "L") => {
    if (s === "P") return "#16a34a"; // Green
    if (s === "A") return "#dc2626"; // Red
    return "#d97706"; // Amber
  };

  return (
    <div style={{ background: "#fff", fontFamily: "Arial, sans-serif", width: "100%", maxWidth: 1050, margin: "0 auto", padding: "20px", boxSizing: "border-box", color: "#000", fontSize: 10, lineHeight: 1.2 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .sf2-table { width: 100%; border-collapse: collapse; font-size: 9px; }
        .sf2-table th, .sf2-table td { border: 1px solid #000; padding: 3px 2px; text-align: center; }
        .sf2-table th { font-weight: bold; background: #f3f4f6; }
        .sf2-gender-hdr { text-align: left !important; font-weight: bold; background: #e5e7eb; padding-left: 8px !important; }
        .sf2-summary-box { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 9px; }
        .sf2-summary-box th, .sf2-summary-box td { border: 1px solid #000; padding: 4px; text-align: center; }
        .sf2-summary-box th { background: #f3f4f6; }
        
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-doc-area, .printable-doc-area * {
            visibility: visible;
          }
          .printable-doc-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
          .sf2-table th {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sf2-gender-hdr {
            background-color: #e5e7eb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      ` }} />

      {/* DepEd SF2 Header */}
      <div style={{ textAlign: "center", position: "relative", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: 60, display: "flex", justifyContent: "center" }}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Department_of_Education_%28DepEd%29_Seal.svg/240px-Department_of_Education_%28DepEd%29_Seal.svg.png" alt="DepEd Seal" style={{ width: 45, height: 45, objectFit: "contain" }} />
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: "bold", textTransform: "uppercase" }}>School Form 2 (SF2) Daily Attendance Report of Learners</div>
            <div style={{ fontSize: 8, fontStyle: "italic", margin: "2px 0" }}>
              (This replaces Form 1, Form 2 & STS Form 4 - Daily Attendance Record of Learners)
            </div>
          </div>
          <div style={{ width: 60, display: "flex", justifyContent: "center" }}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Department_of_Education_%28DepEd%29.svg/320px-Department_of_Education_%28DepEd%29.svg.png" alt="DepEd Logo" style={{ width: 55, objectFit: "contain" }} />
          </div>
        </div>
      </div>

      {/* Metadata Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, border: "1px solid #000", padding: "6px 10px", marginBottom: 10, background: "#fafafa" }}>
        <div>
          <span style={{ fontWeight: "bold", fontSize: 8 }}>School ID:</span>{" "}
          <span style={{ borderBottom: "1px solid #000", paddingBottom: 1, fontFamily: "monospace" }}>300762</span>
        </div>
        <div>
          <span style={{ fontWeight: "bold", fontSize: 8 }}>School Name:</span>{" "}
          <span style={{ borderBottom: "1px solid #000", paddingBottom: 1, fontWeight: 600 }}>ICT High School</span>
        </div>
        <div>
          <span style={{ fontWeight: "bold", fontSize: 8 }}>Grade & Section:</span>{" "}
          <span style={{ borderBottom: "1px solid #000", paddingBottom: 1, fontWeight: 600 }}>{sectionKey.replace(" (Gr.", " - Grade ").replace(")", "")}</span>
        </div>
        <div>
          <span style={{ fontWeight: "bold", fontSize: 8 }}>Month / SY:</span>{" "}
          <span style={{ borderBottom: "1px solid #000", paddingBottom: 1, fontWeight: 600 }}>{month} · {sy}</span>
        </div>
      </div>

      {/* Main Table */}
      <table className="sf2-table">
        <colgroup>
          <col style={{ width: "2%" }} />
          <col style={{ width: "20%" }} />
          {ATT_DATES.map(d => (
            <col key={d} style={{ width: `${68 / ATT_DATES.length}%` }} />
          ))}
          <col style={{ width: "2.5%" }} />
          <col style={{ width: "2.5%" }} />
          <col style={{ width: "2.5%" }} />
          <col style={{ width: "2.5%" }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={{ fontSize: 8 }}>#</th>
            <th rowSpan={2} style={{ textAlign: "left", paddingLeft: 6, fontSize: 8 }}>LEARNER'S NAME</th>
            <th colSpan={ATT_DATES.length} style={{ fontSize: 8 }}>DAILY ATTENDANCE FOR THE MONTH</th>
            <th colSpan={4} style={{ fontSize: 8 }}>TOTAL FOR MONTH</th>
          </tr>
          <tr>
            {ATT_DATES.map(d => (
              <th key={d} style={{ fontSize: 7, padding: "1px 0" }}>{d}</th>
            ))}
            <th style={{ fontSize: 7, color: "#16a34a" }}>P</th>
            <th style={{ fontSize: 7, color: "#dc2626" }}>A</th>
            <th style={{ fontSize: 7, color: "#d97706" }}>L</th>
            <th style={{ fontSize: 7 }}>%</th>
          </tr>
        </thead>
        <tbody>
          {/* I. MALE SECTION */}
          <tr>
            <td className="sf2-gender-hdr" colSpan={ATT_DATES.length + 6}>I. MALE</td>
          </tr>
          {maleStatsResult.listStats.map((st, i) => (
            <tr key={st.id}>
              <td style={{ fontFamily: "monospace" }}>{i + 1}</td>
              <td style={{ textAlign: "left", paddingLeft: 6, fontWeight: 600 }}>{st.surname}, {st.first}</td>
              {ATT_DATES.map(d => {
                const s = getStatus(st.id, d);
                return (
                  <td key={d} style={{ color: sColor(s), fontWeight: s !== "P" ? "bold" : "normal" }}>
                    {s === "P" ? "•" : s}
                  </td>
                );
              })}
              <td style={{ color: "#16a34a", fontWeight: "bold", fontFamily: "monospace" }}>{st.p}</td>
              <td style={{ color: st.a > 0 ? "#dc2626" : "#666", fontWeight: st.a > 0 ? "bold" : "normal", fontFamily: "monospace" }}>{st.a}</td>
              <td style={{ color: st.l > 0 ? "#d97706" : "#666", fontWeight: st.l > 0 ? "bold" : "normal", fontFamily: "monospace" }}>{st.l}</td>
              <td style={{ fontWeight: "bold", fontFamily: "monospace" }}>{st.rate}%</td>
            </tr>
          ))}
          <tr style={{ background: "#f9fafb", fontWeight: "bold" }}>
            <td colSpan={2} style={{ textAlign: "right", paddingRight: 8 }}>MALE SUBTOTAL:</td>
            <td colSpan={ATT_DATES.length}></td>
            <td colSpan={4} style={{ textAlign: "center" }}>
              Enrolled: {maleStatsResult.totalEnrolment} | Avg: {maleStatsResult.avgDailyAttendance.toFixed(1)} | {maleStatsResult.pctAttendance}%
            </td>
          </tr>

          {/* II. FEMALE SECTION */}
          <tr>
            <td className="sf2-gender-hdr" colSpan={ATT_DATES.length + 6}>II. FEMALE</td>
          </tr>
          {femaleStatsResult.listStats.map((st, i) => (
            <tr key={st.id}>
              <td style={{ fontFamily: "monospace" }}>{i + 1}</td>
              <td style={{ textAlign: "left", paddingLeft: 6, fontWeight: 600 }}>{st.surname}, {st.first}</td>
              {ATT_DATES.map(d => {
                const s = getStatus(st.id, d);
                return (
                  <td key={d} style={{ color: sColor(s), fontWeight: s !== "P" ? "bold" : "normal" }}>
                    {s === "P" ? "•" : s}
                  </td>
                );
              })}
              <td style={{ color: "#16a34a", fontWeight: "bold", fontFamily: "monospace" }}>{st.p}</td>
              <td style={{ color: st.a > 0 ? "#dc2626" : "#666", fontWeight: st.a > 0 ? "bold" : "normal", fontFamily: "monospace" }}>{st.a}</td>
              <td style={{ color: st.l > 0 ? "#d97706" : "#666", fontWeight: st.l > 0 ? "bold" : "normal", fontFamily: "monospace" }}>{st.l}</td>
              <td style={{ fontWeight: "bold", fontFamily: "monospace" }}>{st.rate}%</td>
            </tr>
          ))}
          <tr style={{ background: "#f9fafb", fontWeight: "bold" }}>
            <td colSpan={2} style={{ textAlign: "right", paddingRight: 8 }}>FEMALE SUBTOTAL:</td>
            <td colSpan={ATT_DATES.length}></td>
            <td colSpan={4} style={{ textAlign: "center" }}>
              Enrolled: {femaleStatsResult.totalEnrolment} | Avg: {femaleStatsResult.avgDailyAttendance.toFixed(1)} | {femaleStatsResult.pctAttendance}%
            </td>
          </tr>

          {/* COMBINED TOTALS */}
          <tr style={{ background: "#f3f4f6", fontWeight: "bold" }}>
            <td colSpan={2} style={{ textAlign: "right", paddingRight: 8 }}>COMBINED TOTALS:</td>
            <td colSpan={ATT_DATES.length}></td>
            <td colSpan={4} style={{ textAlign: "center" }}>
              Total Enrolled: {allStatsResult.totalEnrolment} | Class Attendance Avg: {allStatsResult.pctAttendance}%
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer statistics & Signature Area */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 30, marginTop: 14 }}>
        {/* Summary Statistics Table */}
        <div>
          <div style={{ fontWeight: "bold", fontSize: 8, marginBottom: 4, textTransform: "uppercase" }}>Summary for the Month</div>
          <table className="sf2-summary-box">
            <thead>
              <tr>
                <th>Gender</th>
                <th>Enrolment</th>
                <th>Avg Daily Att.</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: "bold" }}>MALE</td>
                <td>{maleStatsResult.totalEnrolment}</td>
                <td>{maleStatsResult.avgDailyAttendance.toFixed(2)}</td>
                <td style={{ fontWeight: "bold" }}>{maleStatsResult.pctAttendance}%</td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold" }}>FEMALE</td>
                <td>{femaleStatsResult.totalEnrolment}</td>
                <td>{femaleStatsResult.avgDailyAttendance.toFixed(2)}</td>
                <td style={{ fontWeight: "bold" }}>{femaleStatsResult.pctAttendance}%</td>
              </tr>
              <tr style={{ background: "#f3f4f6", fontWeight: "bold" }}>
                <td>TOTAL</td>
                <td>{allStatsResult.totalEnrolment}</td>
                <td>{allStatsResult.avgDailyAttendance.toFixed(2)}</td>
                <td>{allStatsResult.pctAttendance}%</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 7.5, color: "#555", marginTop: 6, fontStyle: "italic" }}>
            * Note: Daily tardiness is recorded in the table as (L) but counts as present in daily attendance aggregates.
          </div>
        </div>

        {/* Signatures */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 8, color: "#555", marginBottom: 20 }}>Prepared by:</div>
              <div style={{ borderBottom: "1px solid #000", paddingBottom: 2, fontWeight: "bold", textAlign: "center" }}>Ana R. Soriano</div>
              <div style={{ fontSize: 8, color: "#666", textAlign: "center" }}>Class Adviser</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: "#555", marginBottom: 20 }}>Reviewed / Noted by:</div>
              <div style={{ borderBottom: "1px solid #000", paddingBottom: 2, fontWeight: "bold", textAlign: "center" }}>Dr. Maria Santos</div>
              <div style={{ fontSize: 8, color: "#666", textAlign: "center" }}>School Principal</div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: "#666", border: "1px dashed #ccc", padding: 6, borderRadius: 3, marginTop: 10 }}>
            <strong>Generating Agency:</strong> DigiSkwela Forms & Records Core Module.<br />
            <strong>DepEd Compliance:</strong> Matches formatting and computation guidelines for Philippine Public Schools.
          </div>
        </div>
      </div>
    </div>
  );
}
