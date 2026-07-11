import React, { useState } from "react";
import { Search, Printer, FileText, User, Award, BookOpen } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { STUDENTS_GR8, STUDENTS_GR9, STUDENTS_GR10 } from "../../App";

export function StudentDataSearch() {
  const [query, setQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  const ALL_STUDENTS = [
    ...STUDENTS_GR8.map(s => ({ ...s, gradeLevel: 8, section: "Rizal" })),
    ...STUDENTS_GR9.map(s => ({ ...s, gradeLevel: 9, section: "Einstein" })),
    ...STUDENTS_GR10.map(s => ({ ...s, gradeLevel: 10, section: "Pilot" })),
  ];

  const results = query.trim().length > 0 
    ? ALL_STUDENTS.filter(s => 
        s.surname.toLowerCase().includes(query.toLowerCase()) || 
        s.first.toLowerCase().includes(query.toLowerCase()) ||
        s.lrn.includes(query)
      )
    : [];

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
      
      {/* Hide search UI when printing */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: #fff !important; }
          @page { margin: 0.5in; }
        }
      `}</style>

      <div className="no-print">
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 8, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Student Data Search</h1>
        <p style={{ fontSize: 13, color: C.t3, marginBottom: 32 }}>Search by Name or LRN to view and print student academic records (Form 137 alternate).</p>

        <div style={{ position: "relative", marginBottom: 32 }}>
          <Search size={18} color={C.t3} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
          <input 
            type="text" 
            placeholder="Search student name or LRN..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ 
              width: "100%", padding: "16px 16px 16px 48px", borderRadius: 12, border: `1.5px solid ${C.borderMed}`,
              fontSize: 15, fontFamily: "'Inter', sans-serif", outline: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
            }}
          />
          
          {query.trim().length > 0 && results.length > 0 && !selectedStudent && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", zIndex: 10, overflow: "hidden" }}>
              {results.map(s => (
                <button 
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", borderBottom: `1px solid ${C.borderLight}`, background: "#fff", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.m50}
                  onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{s.surname}, {s.first}</div>
                    <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>LRN: {s.lrn} &bull; Grade {s.gradeLevel} - {s.section}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedStudent && (
        <div>
          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button 
              onClick={() => setSelectedStudent(null)}
              style={{ background: "transparent", border: "none", color: C.m700, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              &larr; Back to search
            </button>
            <button 
              onClick={() => window.print()}
              style={{ background: C.m700, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 2px 6px rgba(185,28,28,0.2)" }}
            >
              <Printer size={16} /> Print Record
            </button>
          </div>

          {/* Printable Card */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 40, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 24, borderBottom: `2px solid ${C.m700}`, paddingBottom: 24, marginBottom: 32 }}>
              <div style={{ width: 80, height: 80, borderRadius: 12, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.borderMed}` }}>
                <User size={40} color={C.m700} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Learner Permanent Record</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif" }}>{selectedStudent.surname}, {selectedStudent.first}</div>
                <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
                  <div style={{ fontSize: 13, color: C.t2 }}><strong>LRN:</strong> {selectedStudent.lrn}</div>
                  <div style={{ fontSize: 13, color: C.t2 }}><strong>Gender:</strong> {selectedStudent.gender === 'M' ? 'Male' : 'Female'}</div>
                  <div style={{ fontSize: 13, color: C.t2 }}><strong>Current Grade:</strong> {selectedStudent.gradeLevel} - {selectedStudent.section}</div>
                </div>
              </div>
            </div>

            {/* Academic Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
              <div style={{ background: "#f8fafc", padding: 20, borderRadius: 12, border: `1px solid ${C.borderLight}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <Award size={18} color={C.m700} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>Academic Standing</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: selectedStudent.avg >= 75 ? "#16a34a" : "#dc2626", fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 4 }}>
                  {selectedStudent.avg.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: C.t3 }}>General Weighted Average</div>
              </div>

              <div style={{ background: "#f8fafc", padding: 20, borderRadius: 12, border: `1px solid ${C.borderLight}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <BookOpen size={18} color={C.m700} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>Status Recommendation</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                  {selectedStudent.status}
                </div>
                <div style={{ fontSize: 12, color: C.t3 }}>Attendance: {selectedStudent.att}</div>
              </div>
            </div>
            
            <div style={{ fontSize: 11, color: C.t3, textAlign: "center", marginTop: 40, paddingTop: 20, borderTop: `1px dotted ${C.borderMed}` }}>
              System Generated Document &bull; DigiSkwela Admin/IT Portal
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
