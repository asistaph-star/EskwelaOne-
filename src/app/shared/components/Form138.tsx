import React from 'react';
import { C } from '../constants/tokens';
import { BookMarked } from 'lucide-react';
import { gradeColor } from '../utils/helpers';

export interface Form138Student {
  name: string;
  lrn: string;
  grade: number;
  section: string;
  gender: string;
  age: number;
  adviser: string;
}

export interface Form138Grades {
  subjects: { name: string; grade: number; remarks: string }[];
  generalAverage: number;
}

export interface Form138Attendance {
  daysOfSchool: number;
  daysPresent: number;
  daysAbsent: number;
}

export function Form138({
  student,
  quarter = 1,
  sy = "2025–2026",
  grades,
  attendance,
}: {
  student: Form138Student;
  quarter?: number;
  sy?: string;
  grades: Form138Grades;
  attendance: Form138Attendance;
}) {
  const qStr = ["First", "Second", "Third", "Fourth"][quarter - 1] + " Quarter";

  return (
    <div style={{ background: "#fff", fontFamily: "'Inter', sans-serif", maxWidth: 850, margin: "0 auto", border: `1px solid ${C.borderMed}`, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}>
      
      {/* ── Header ── */}
      <div style={{ padding: "30px 40px", borderBottom: `2px solid ${C.m700}`, textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: 30, left: 40, width: 60, height: 60, borderRadius: 30, background: "rgba(232,160,32,0.18)", border: `2px solid rgba(232,160,32,0.45)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BookMarked size={28} color={C.gold} strokeWidth={2} />
        </div>
        
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.t2, marginBottom: 4 }}>
          Republic of the Philippines • Department of Education • Region III
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Fraunces', serif", color: C.m900, marginBottom: 2 }}>
          SINDALAN NATIONAL HIGH SCHOOL
        </div>
        <div style={{ fontSize: 11, color: C.t3, marginBottom: 16 }}>
          Sindalan, City of San Fernando, Pampanga
        </div>

        <div style={{ display: "inline-block", background: C.m50, border: `1px solid ${C.m700}`, padding: "6px 24px", borderRadius: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.m800, letterSpacing: "0.05em" }}>REPORT CARD (SF-9)</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginTop: 8 }}>{qStr} • SY {sy}</div>
      </div>

      {/* ── Learner's Information ── */}
      <div style={{ padding: "20px 40px", background: C.paper, borderBottom: `1px solid ${C.borderMed}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr", gap: "12px 24px" }}>
          <div style={{ borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 9, color: C.t3, textTransform: "uppercase" }}>Name:</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{student.name}</div>
          </div>
          <div style={{ borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 9, color: C.t3, textTransform: "uppercase" }}>Age / Sex:</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{student.age} / {student.gender}</div>
          </div>
          <div style={{ borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 9, color: C.t3, textTransform: "uppercase" }}>Grade & Section:</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{student.grade} - {student.section}</div>
          </div>
          <div style={{ borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 9, color: C.t3, textTransform: "uppercase" }}>LRN:</span>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: C.t1 }}>{student.lrn}</div>
          </div>
          <div style={{ gridColumn: "2 / -1", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 9, color: C.t3, textTransform: "uppercase" }}>Adviser:</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{student.adviser}</div>
          </div>
        </div>
      </div>

      {/* ── Content Body (Grades & Attendance side-by-side) ── */}
      <div style={{ display: "flex" }}>
        
        {/* Left: Grades Table */}
        <div style={{ flex: 2, padding: "30px 40px", borderRight: `1px dashed ${C.borderMed}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.m800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Academic Performance</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.m700 }}>
                <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: "#fff", textTransform: "uppercase" }}>Learning Area</th>
                <th style={{ textAlign: "center", padding: "8px 12px", fontSize: 10, color: "#fff", textTransform: "uppercase", borderLeft: "1px solid rgba(255,255,255,0.2)" }}>Quarter Grade</th>
                <th style={{ textAlign: "center", padding: "8px 12px", fontSize: 10, color: "#fff", textTransform: "uppercase", borderLeft: "1px solid rgba(255,255,255,0.2)" }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {grades.subjects.map((sub, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                  <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: C.t1 }}>{sub.name}</td>
                  <td style={{ textAlign: "center", padding: "10px 12px", fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: sub.grade < 75 ? C.red : C.t1, borderLeft: `1px solid ${C.borderLight}` }}>
                    {sub.grade}
                  </td>
                  <td style={{ textAlign: "center", padding: "10px 12px", fontSize: 10, fontWeight: 700, color: sub.grade < 75 ? C.red : C.green, borderLeft: `1px solid ${C.borderLight}` }}>
                    {sub.remarks}
                  </td>
                </tr>
              ))}
              <tr style={{ background: C.m50, borderTop: `2px solid ${C.m700}` }}>
                <td style={{ padding: "12px", fontSize: 11, fontWeight: 800, color: C.m900, textTransform: "uppercase" }}>General Average</td>
                <td style={{ textAlign: "center", padding: "12px", fontSize: 16, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: grades.generalAverage < 75 ? C.red : C.m900, borderLeft: `1px solid ${C.borderLight}` }}>
                  {grades.generalAverage.toFixed(1)}
                </td>
                <td style={{ textAlign: "center", padding: "12px", fontSize: 11, fontWeight: 800, color: grades.generalAverage < 75 ? C.red : C.green, borderLeft: `1px solid ${C.borderLight}` }}>
                  {grades.generalAverage >= 75 ? "PASSED" : "FAILED"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right: Attendance & Signatures */}
        <div style={{ flex: 1.2, padding: "30px 40px", display: "flex", flexDirection: "column", gap: 30 }}>
          
          {/* Attendance */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.m800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Attendance Record</div>
            <div style={{ border: `1px solid ${C.borderMed}`, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: `1px solid ${C.borderMed}`, background: C.paper }}>
                <div style={{ flex: 2, padding: "8px 12px", fontSize: 10, fontWeight: 600, color: C.t2 }}>Days of School</div>
                <div style={{ flex: 1, padding: "8px 12px", fontSize: 12, fontWeight: 700, textAlign: "center", color: C.t1, borderLeft: `1px solid ${C.borderMed}` }}>{attendance.daysOfSchool}</div>
              </div>
              <div style={{ display: "flex", borderBottom: `1px solid ${C.borderMed}` }}>
                <div style={{ flex: 2, padding: "8px 12px", fontSize: 10, fontWeight: 600, color: C.t2 }}>Days Present</div>
                <div style={{ flex: 1, padding: "8px 12px", fontSize: 12, fontWeight: 700, textAlign: "center", color: C.green, borderLeft: `1px solid ${C.borderMed}` }}>{attendance.daysPresent}</div>
              </div>
              <div style={{ display: "flex" }}>
                <div style={{ flex: 2, padding: "8px 12px", fontSize: 10, fontWeight: 600, color: C.t2 }}>Days Absent</div>
                <div style={{ flex: 1, padding: "8px 12px", fontSize: 12, fontWeight: 700, textAlign: "center", color: attendance.daysAbsent > 0 ? C.red : C.t1, borderLeft: `1px solid ${C.borderMed}` }}>{attendance.daysAbsent}</div>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.m800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 20 }}>Signatures</div>
            
            <div style={{ marginBottom: 24 }}>
              <div style={{ borderBottom: `1px solid ${C.t1}`, height: 30 }} />
              <div style={{ fontSize: 9, color: C.t3, textAlign: "center", marginTop: 4, textTransform: "uppercase" }}>Parent / Guardian's Signature</div>
            </div>
            
            <div>
              <div style={{ borderBottom: `1px solid ${C.t1}`, height: 30, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>{student.adviser}</span>
              </div>
              <div style={{ fontSize: 9, color: C.t3, textAlign: "center", marginTop: 4, textTransform: "uppercase" }}>Teacher / Adviser</div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
