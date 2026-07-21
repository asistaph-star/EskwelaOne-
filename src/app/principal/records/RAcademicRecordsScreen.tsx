import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Search, FileText, Printer, ChevronRight, User } from 'lucide-react';

type StudentRecord = {
  id: string;
  name: string;
  gradeLevel: string;
  section: string;
  lrn: string;
  status: "Active" | "Graduated" | "Transferred";
};

const MOCK_STUDENTS: StudentRecord[] = [
  { id: "STU-2023-001", name: "Santos, Juan Miguel", gradeLevel: "Grade 10", section: "Pilot", lrn: "100001", status: "Active" },
  { id: "STU-2022-045", name: "Reyes, Maria Clara", gradeLevel: "Grade 12", section: "Rizal", lrn: "100045", status: "Graduated" },
  { id: "STU-2024-112", name: "Cruz, Diego", gradeLevel: "Grade 8", section: "Mabini", lrn: "100112", status: "Transferred" },
];

export function RAcademicRecordsScreen() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  const filtered = MOCK_STUDENTS.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.lrn.includes(searchTerm)
  );

  function handlePrintSF10() {
    alert(`Generating Form 137 / SF10 for ${selectedStudent?.name}... \n(This would trigger a PDF download)`);
  }

  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Academic Records (SF10)</h1>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Manage and generate permanent student records (Form 137).</div>
        </div>

        {selectedStudent ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <button onClick={() => setSelectedStudent(null)} style={{ background: "none", border: "none", color: C.m700, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
              ← Back to Student List
            </button>

            {/* Student Profile Header */}
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: 32, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.borderMed}` }}>
                  <User size={28} color={C.m700} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.t1 }}>{selectedStudent.name}</div>
                  <div style={{ fontSize: 13, color: C.t2, marginTop: 4, display: "flex", gap: 16 }}>
                    <span><strong>LRN:</strong> {selectedStudent.lrn}</span>
                    <span><strong>Grade:</strong> {selectedStudent.gradeLevel}</span>
                    <span><strong>Section:</strong> {selectedStudent.section}</span>
                  </div>
                </div>
              </div>
              <button onClick={handlePrintSF10} style={{ background: C.m700, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <Printer size={16} /> Print SF10 (Form 137)
              </button>
            </div>

            {/* Historical Grades Stub */}
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: "0 0 16px" }}>Scholastic Record</h3>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: C.paper, borderBottom: `2px solid ${C.border}` }}>
                      {["School Year", "Grade Level", "General Average", "Remarks"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.t1 }}>2025-2026</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.t1 }}>Grade 10</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: C.green }}>91.50</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: C.t2 }}>Passed</td>
                    </tr>
                    <tr style={{ background: C.paper }}>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.t1 }}>2024-2025</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.t1 }}>Grade 9</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: C.green }}>90.25</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: C.t2 }}>Passed</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Search */}
            <div style={{ position: "relative", maxWidth: 600 }}>
              <Search size={16} color={C.t3} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="text" 
                placeholder="Search by student name or LRN..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: "100%", padding: "12px 14px 12px 40px", fontSize: 13, border: `1px solid ${C.borderMed}`, borderRadius: 8, boxSizing: "border-box", outline: "none" }}
              />
            </div>

            {/* List */}
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.paper, borderBottom: `2px solid ${C.border}` }}>
                    {["LRN", "Student Name", "Grade & Section", "Status", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "14px 20px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", fontSize: 13, color: C.t3 }}>No students found.</td></tr>
                  ) : (
                    filtered.map(stu => (
                      <tr key={stu.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s", cursor: "pointer" }}
                        onClick={() => setSelectedStudent(stu)}
                        onMouseEnter={e => e.currentTarget.style.background = C.paper}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                      >
                        <td style={{ padding: "16px 20px", fontSize: 12, color: C.t2, fontWeight: 600 }}>{stu.lrn}</td>
                        <td style={{ padding: "16px 20px", fontSize: 13, fontWeight: 700, color: C.t1 }}>{stu.name}</td>
                        <td style={{ padding: "16px 20px", fontSize: 12, color: C.t2 }}>{stu.gradeLevel} - {stu.section}</td>
                        <td style={{ padding: "16px 20px" }}>
                          <span style={{ 
                            fontSize: 10, fontWeight: 700, 
                            color: stu.status === "Active" ? C.green : stu.status === "Graduated" ? C.blue : C.t3, 
                            background: stu.status === "Active" ? C.greenBg : stu.status === "Graduated" ? C.blueBg : C.m50, 
                            padding: "4px 10px", borderRadius: 12 
                          }}>
                            {stu.status}
                          </span>
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                          <ChevronRight size={16} color={C.t3} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
