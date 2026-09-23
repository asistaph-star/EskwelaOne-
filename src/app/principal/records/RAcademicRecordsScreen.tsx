import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { Search, FileText, Printer, ChevronRight, User, Loader2 } from 'lucide-react';
import { useAppContext } from '../../shared/AppContext';
import { apiClient } from '../../../api/client';

type StudentRecord = {
  id: string; // The User ID
  studentProfileId: string; // The Student profile ID
  name: string;
  gradeLevel: string;
  section: string;
  lrn: string;
  status: "Active" | "Graduated" | "Transferred";
};

type SF10Subject = {
  id: string;
  name: string;
  T1: number | null;
  T2: number | null;
  T3: number | null;
  T4: number | null;
  finalRating: number | null;
  remarks: 'PASSED' | 'FAILED' | null;
};

type SF10AcademicYear = {
  academicYearId: string;
  academicYearName: string;
  gradeLevel: number | null;
  section: string | null;
  subjects: SF10Subject[];
  generalAverage: number | null;
};

type SF10Data = {
  student: {
    id: string;
    name: string;
    lrn: string;
    gender: string;
    dateOfBirth: string | null;
  };
  academicYears: SF10AcademicYear[];
};

export function RAcademicRecordsScreen() {
  const { students } = useAppContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  const [sf10Data, setSf10Data] = useState<SF10Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map AppContext User to StudentRecord, providing fallbacks for missing fields
  const mappedStudents: StudentRecord[] = students.map(s => {
    const studentProf = (s as any).student;
    const latestEnrollment = studentProf?.enrollments?.[0];
    const sectionName = latestEnrollment?.section?.name || "Unassigned";
    const gradeLevel = latestEnrollment?.section?.grade_level ? `Grade ${latestEnrollment.section.grade_level}` : "N/A";
    
    return {
      id: s.id,
      studentProfileId: studentProf?.id || s.id,
      name: s.name,
      gradeLevel,
      section: sectionName,
      lrn: studentProf?.lrn || s.id.replace(/\D/g, '').padEnd(12, '0').slice(0, 12),
      status: "Active"
    };
  });

  const filtered = mappedStudents.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.lrn.includes(searchTerm)
  );

  useEffect(() => {
    if (selectedStudent) {
      setLoading(true);
      setError(null);
      setSf10Data(null);
      
      apiClient.get<SF10Data>(`/academic/sf10/${selectedStudent.studentProfileId}`)
        .then(data => {
          setSf10Data(data);
        })
        .catch(err => {
          setError(err.message || 'Failed to load scholastic record');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [selectedStudent]);

  function handlePrintSF10() {
    window.print();
  }

  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        
        <div className="no-print">
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Academic Records (SF10)</h1>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Manage and generate permanent student records (Form 137).</div>
        </div>

        {selectedStudent ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <button className="no-print" onClick={() => setSelectedStudent(null)} style={{ background: "none", border: "none", color: C.m700, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
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
              <button className="no-print" onClick={handlePrintSF10} style={{ background: C.m700, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <Printer size={16} /> Print SF10 (Form 137)
              </button>
            </div>

            {/* Historical Grades */}
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: "0 0 16px" }}>Scholastic Record</h3>
              
              {loading && (
                <div style={{ padding: 40, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <Loader2 size={32} color={C.m500} style={{ animation: "spin 1s linear infinite" }} />
                  <div style={{ fontSize: 13, color: C.t2 }}>Loading authoritative records...</div>
                </div>
              )}

              {error && (
                <div style={{ padding: 20, background: C.redBg, color: C.red, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              {!loading && !error && sf10Data && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {sf10Data.academicYears.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", fontSize: 14, color: C.t3, background: C.paper, borderRadius: 8, border: `1px dashed ${C.borderMed}` }}>
                      No scholastic records available for this student.
                    </div>
                  ) : (
                    sf10Data.academicYears.map(year => (
                      <div key={year.academicYearId} style={{ border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden" }}>
                        {/* Year Header */}
                        <div style={{ background: C.m50, padding: "12px 16px", borderBottom: `1px solid ${C.borderMed}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{year.academicYearName}</span>
                            <span style={{ fontSize: 13, color: C.t2 }}>{year.gradeLevel ? `Grade ${year.gradeLevel}` : "N/A"} • {year.section || "Unassigned"}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
                            Gen. Avg: <span style={{ color: year.generalAverage ? (year.generalAverage >= 75 ? C.green : C.red) : C.t3, marginLeft: 4 }}>
                              {year.generalAverage !== null ? year.generalAverage : "N/A"}
                            </span>
                          </div>
                        </div>

                        {/* Subjects Table */}
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "#fff", borderBottom: `2px solid ${C.border}` }}>
                              <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Learning Area</th>
                              <th style={{ textAlign: "center", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>T1</th>
                              <th style={{ textAlign: "center", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>T2</th>
                              <th style={{ textAlign: "center", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>T3</th>
                              <th style={{ textAlign: "center", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>T4</th>
                              <th style={{ textAlign: "center", padding: "10px 16px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Final</th>
                              <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {year.subjects.map(subject => (
                              <tr key={subject.id} style={{ borderBottom: `1px solid ${C.border}`, background: "#fff" }}>
                                <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: C.t1 }}>{subject.name}</td>
                                <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, color: subject.T1 !== null ? C.t1 : C.t3 }}>{subject.T1 ?? "-"}</td>
                                <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, color: subject.T2 !== null ? C.t1 : C.t3 }}>{subject.T2 ?? "-"}</td>
                                <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, color: subject.T3 !== null ? C.t1 : C.t3 }}>{subject.T3 ?? "-"}</td>
                                <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, color: subject.T4 !== null ? C.t1 : C.t3 }}>{subject.T4 ?? "-"}</td>
                                <td style={{ padding: "10px 16px", textAlign: "center", fontSize: 13, fontWeight: 700, color: subject.finalRating !== null ? C.t1 : C.t3 }}>{subject.finalRating ?? "-"}</td>
                                <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: subject.remarks === 'PASSED' ? C.green : (subject.remarks === 'FAILED' ? C.red : C.t3) }}>
                                  {subject.remarks ?? "-"}
                                </td>
                              </tr>
                            ))}
                            {year.subjects.length === 0 && (
                              <tr>
                                <td colSpan={7} style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.t3 }}>No grades recorded for this year.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}
                </div>
              )}
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
