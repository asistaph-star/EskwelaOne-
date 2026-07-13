import React, { useState } from "react";
import { Users, FileText, ChevronRight, ChevronDown, Printer } from "lucide-react";
import { C } from "../../shared/constants/tokens";

// Mock Data structure for Attendance
// Note: Month assumed to have 21 school days
const ATTENDANCE_DATA = [
  {
    grade: 7,
    sections: [
      { name: "Mabini", male: { enrolled: 22, present: 450, absent: 12 }, female: { enrolled: 24, present: 480, absent: 24 } },
      { name: "Bonifacio", male: { enrolled: 21, present: 420, absent: 21 }, female: { enrolled: 23, present: 460, absent: 23 } },
    ]
  },
  {
    grade: 8,
    sections: [
      { name: "Rizal", male: { enrolled: 19, present: 380, absent: 19 }, female: { enrolled: 20, present: 410, absent: 10 } }, // Total: 39 enrolled
      { name: "Luna", male: { enrolled: 20, present: 405, absent: 15 }, female: { enrolled: 22, present: 455, absent: 7 } },
    ]
  },
  {
    grade: 9,
    sections: [
      { name: "Einstein", male: { enrolled: 18, present: 360, absent: 18 }, female: { enrolled: 18, present: 370, absent: 8 } }, // Total: 36 enrolled
      { name: "Newton", male: { enrolled: 19, present: 385, absent: 14 }, female: { enrolled: 21, present: 430, absent: 11 } },
    ]
  },
  {
    grade: 10,
    sections: [
      { name: "Pilot", male: { enrolled: 16, present: 325, absent: 11 }, female: { enrolled: 16, present: 330, absent: 6 } }, // Total: 32 enrolled
      { name: "Galileo", male: { enrolled: 18, present: 365, absent: 13 }, female: { enrolled: 20, present: 410, absent: 10 } },
    ]
  }
];

export function AttendanceSummary() {
  const [expandedGrade, setExpandedGrade] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("August");

  const toggleGrade = (g: number) => {
    setExpandedGrade(expandedGrade === g ? null : g);
  };

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
      
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: #fff !important; }
          @page { margin: 0.5in; }
          .print-card { border: 1px solid #000 !important; box-shadow: none !important; margin-bottom: 20px !important; break-inside: avoid; }
        }
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 8, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Attendance Summaries</h1>
          <p style={{ fontSize: 13, color: C.t3 }}>View and print aggregated attendance data by Grade Level, Gender, and Section.</p>
        </div>
        
        <div style={{ display: "flex", gap: 16 }}>
          <select 
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, color: C.t2, background: "#fff", cursor: "pointer" }}
          >
            {["August", "September", "October", "November"].map(m => (
              <option key={m} value={m}>{m} 2025</option>
            ))}
          </select>
          
          <button 
            onClick={() => window.print()}
            style={{ background: C.m700, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            <Printer size={16} /> Print Report
          </button>
        </div>
      </div>

      <div className="print-only" style={{ display: "none", marginBottom: 32, textAlign: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}></h2>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Monthly Attendance Summary - {selectedMonth} 2025</h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {ATTENDANCE_DATA.map((gradeData) => {
          // Calculate aggregates for the grade level
          let totalMaleEnrolled = 0, totalMalePresent = 0, totalMaleAbsent = 0;
          let totalFemaleEnrolled = 0, totalFemalePresent = 0, totalFemaleAbsent = 0;
          
          gradeData.sections.forEach(sec => {
            totalMaleEnrolled += sec.male.enrolled;
            totalMalePresent += sec.male.present;
            totalMaleAbsent += sec.male.absent;
            totalFemaleEnrolled += sec.female.enrolled;
            totalFemalePresent += sec.female.present;
            totalFemaleAbsent += sec.female.absent;
          });

          const isExpanded = expandedGrade === gradeData.grade;

          return (
            <div key={gradeData.grade} className="print-card" style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.borderLight}`, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              {/* Grade Level Header */}
              <div 
                className="no-print"
                onClick={() => toggleGrade(gradeData.grade)}
                style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: isExpanded ? C.m50 : "#fff", transition: "background 0.2s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: C.m700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>
                    {gradeData.grade}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Grade {gradeData.grade}</div>
                    <div style={{ fontSize: 12, color: C.t3 }}>Total Attendance Overview</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6" }}>MALE</div>
                    <div style={{ fontSize: 12, color: C.t2, display: "flex", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>Enrolled: {totalMaleEnrolled}</span>
                      <span style={{ color: C.t3 }}>(Days Pres: {totalMalePresent} &bull; Abs: {totalMaleAbsent})</span>
                    </div>
                  </div>
                  <div style={{ width: 1, height: 30, background: C.borderMed }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ec4899" }}>FEMALE</div>
                    <div style={{ fontSize: 12, color: C.t2, display: "flex", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>Enrolled: {totalFemaleEnrolled}</span>
                      <span style={{ color: C.t3 }}>(Days Pres: {totalFemalePresent} &bull; Abs: {totalFemaleAbsent})</span>
                    </div>
                  </div>
                  
                  <div style={{ marginLeft: 16, color: C.t3 }}>
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                </div>
              </div>

              {/* Print-only Grade Header */}
              <div className="print-only" style={{ display: "none", padding: "16px", borderBottom: `2px solid ${C.m700}`, background: "#f8fafc" }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Grade {gradeData.grade} Overview</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                  Male: {totalMaleEnrolled} Enrolled (Pres: {totalMalePresent}, Abs: {totalMaleAbsent} days) | Female: {totalFemaleEnrolled} Enrolled (Pres: {totalFemalePresent}, Abs: {totalFemaleAbsent} days)
                </p>
              </div>

              {/* Drill-down / Sections */}
              {(isExpanded || window.matchMedia("print").matches) && (
                <div style={{ padding: "20px 24px", borderTop: `1px solid ${C.borderLight}` }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "12px 16px", background: "#f8fafc", borderBottom: `1px solid ${C.borderMed}`, color: C.t2, fontWeight: 600 }}>Section</th>
                        <th style={{ textAlign: "center", padding: "12px 16px", background: "#eff6ff", borderBottom: `1px solid ${C.borderMed}`, color: "#1d4ed8", fontWeight: 600 }} colSpan={3}>MALE</th>
                        <th style={{ textAlign: "center", padding: "12px 16px", background: "#fdf2f8", borderBottom: `1px solid ${C.borderMed}`, color: "#be185d", fontWeight: 600 }} colSpan={3}>FEMALE</th>
                      </tr>
                      <tr>
                        <th style={{ borderBottom: `1px solid ${C.borderLight}`, padding: "8px 16px" }}></th>
                        <th style={{ background: "#eff6ff", borderBottom: `1px solid ${C.borderLight}`, padding: "8px 16px", color: C.t3, fontWeight: 500, fontSize: 11 }}>Enrolled</th>
                        <th style={{ background: "#eff6ff", borderBottom: `1px solid ${C.borderLight}`, padding: "8px 16px", color: C.t3, fontWeight: 500, fontSize: 11 }}>Days Pres</th>
                        <th style={{ background: "#eff6ff", borderBottom: `1px solid ${C.borderLight}`, padding: "8px 16px", color: C.t3, fontWeight: 500, fontSize: 11 }}>Days Abs</th>
                        <th style={{ background: "#fdf2f8", borderBottom: `1px solid ${C.borderLight}`, padding: "8px 16px", color: C.t3, fontWeight: 500, fontSize: 11 }}>Enrolled</th>
                        <th style={{ background: "#fdf2f8", borderBottom: `1px solid ${C.borderLight}`, padding: "8px 16px", color: C.t3, fontWeight: 500, fontSize: 11 }}>Days Pres</th>
                        <th style={{ background: "#fdf2f8", borderBottom: `1px solid ${C.borderLight}`, padding: "8px 16px", color: C.t3, fontWeight: 500, fontSize: 11 }}>Days Abs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeData.sections.map(sec => (
                        <tr key={sec.name} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: C.t1 }}>{sec.name}</td>
                          <td style={{ padding: "12px 16px", textAlign: "center", color: C.t2, fontWeight: 600 }}>{sec.male.enrolled}</td>
                          <td style={{ padding: "12px 16px", textAlign: "center", color: C.t3 }}>{sec.male.present}</td>
                          <td style={{ padding: "12px 16px", textAlign: "center", color: C.t3 }}>{sec.male.absent}</td>
                          <td style={{ padding: "12px 16px", textAlign: "center", color: C.t2, fontWeight: 600 }}>{sec.female.enrolled}</td>
                          <td style={{ padding: "12px 16px", textAlign: "center", color: C.t3 }}>{sec.female.present}</td>
                          <td style={{ padding: "12px 16px", textAlign: "center", color: C.t3 }}>{sec.female.absent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
    </div>
  );
}
