import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Search, Filter, CheckCircle, XCircle, FileText, AlertTriangle, UserPlus } from 'lucide-react';

type EnrollmentStatus = "Pending Review" | "Missing Documents" | "Enrolled" | "Rejected";

type Applicant = {
  id: string;
  name: string;
  gradeLevel: string;
  type: "New Student" | "Transferee" | "Returning";
  dateApplied: string;
  status: EnrollmentStatus;
  documents: {
    birthCert: boolean;
    form138: boolean; // Report card
    goodMoral: boolean;
    medical: boolean;
  };
};

const MOCK_APPLICANTS: Applicant[] = [
  { id: "APP-001", name: "Dela Cruz, Mateo", gradeLevel: "Grade 7", type: "New Student", dateApplied: "2026-06-15", status: "Pending Review", documents: { birthCert: true, form138: true, goodMoral: true, medical: true } },
  { id: "APP-002", name: "Reyes, Sofia", gradeLevel: "Grade 8", type: "Transferee", dateApplied: "2026-06-18", status: "Missing Documents", documents: { birthCert: true, form138: false, goodMoral: true, medical: false } },
  { id: "APP-003", name: "Bautista, Liam", gradeLevel: "Grade 7", type: "New Student", dateApplied: "2026-06-20", status: "Enrolled", documents: { birthCert: true, form138: true, goodMoral: true, medical: true } },
  { id: "APP-004", name: "Mendoza, Isabella", gradeLevel: "Grade 9", type: "Returning", dateApplied: "2026-06-21", status: "Pending Review", documents: { birthCert: true, form138: true, goodMoral: true, medical: true } },
];

export function REnrollmentScreen() {
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "Pending Review" | "Missing Documents" | "Enrolled">("All");

  const filtered = applicants.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "All" || a.status === activeTab;
    return matchesSearch && matchesTab;
  });

  function handleStatusChange(id: string, newStatus: EnrollmentStatus) {
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
  }

  function toggleDocument(id: string, doc: keyof Applicant["documents"]) {
    setApplicants(prev => prev.map(a => {
      if (a.id !== id) return a;
      const updatedDocs = { ...a.documents, [doc]: !a.documents[doc] };
      // Auto-update status if all docs are now present and it was previously missing docs
      const allPresent = Object.values(updatedDocs).every(v => v);
      let newStatus = a.status;
      if (allPresent && a.status === "Missing Documents") newStatus = "Pending Review";
      else if (!allPresent && a.status !== "Enrolled") newStatus = "Missing Documents";
      
      return { ...a, documents: updatedDocs, status: newStatus };
    }));
  }

  function statusColor(s: EnrollmentStatus) {
    if (s === "Enrolled") return C.green;
    if (s === "Missing Documents") return C.red;
    if (s === "Pending Review") return "#f59e0b";
    return C.t2;
  }
  function statusBg(s: EnrollmentStatus) {
    if (s === "Enrolled") return C.greenBg;
    if (s === "Missing Documents") return C.redBg;
    if (s === "Pending Review") return "#fef3c7";
    return C.m50;
  }

  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Student Enrollment & Admissions</h1>
            <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Process applications, track submitted forms, and finalize enrollments.</div>
          </div>
          <button style={{
            background: C.m700, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6,
            fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}>
            <UserPlus size={14} /> Add Manual Application
          </button>
        </div>

        {/* Toolbar & Tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={16} color={C.t3} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="text" 
                placeholder="Search by student name or application ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: "100%", padding: "12px 14px 12px 40px", fontSize: 13, border: `1px solid ${C.borderMed}`, borderRadius: 8, boxSizing: "border-box", outline: "none" }}
              />
            </div>
            <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 20px", background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.t2 }}>
              <Filter size={16} /> Filter by Grade
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, borderBottom: `2px solid ${C.border}` }}>
            {(["All", "Pending Review", "Missing Documents", "Enrolled"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: "10px 20px", background: "transparent", border: "none",
                borderBottom: activeTab === t ? `2px solid ${C.m700}` : "2px solid transparent",
                color: activeTab === t ? C.m700 : C.t3,
                fontSize: 12, fontWeight: activeTab === t ? 700 : 600, cursor: "pointer",
                transition: "all 0.15s", marginBottom: -2
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Applications List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filtered.length === 0 ? (
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 60, textAlign: "center" }}>
              <FileText size={40} color={C.borderMed} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: C.t2 }}>No applications found.</div>
            </div>
          ) : (
            filtered.map(app => (
              <div key={app.id} style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                
                {/* Header */}
                <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 22, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.borderMed}` }}>
                      <UserPlus size={20} color={C.m700} />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{app.name}</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>ID: {app.id}</span> • <span>{app.gradeLevel}</span> • <span>{app.type}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 11, color: C.t3 }}>Applied: {app.dateApplied}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(app.status), background: statusBg(app.status), padding: "4px 12px", borderRadius: 12, border: `1px solid ${statusColor(app.status)}30` }}>
                      {app.status}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  
                  {/* Documents Column */}
                  <div style={{ padding: "20px 24px", borderRight: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Required Documents</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { key: "birthCert" as const, label: "PSA Birth Certificate" },
                        { key: "form138" as const, label: "Form 138 (Report Card)" },
                        { key: "goodMoral" as const, label: "Certificate of Good Moral" },
                        { key: "medical" as const, label: "Medical Clearance" },
                      ].map(doc => (
                        <div key={doc.key} onClick={() => toggleDocument(app.id, doc.key)} style={{ 
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", 
                          background: app.documents[doc.key] ? C.greenBg : C.paper,
                          border: `1px solid ${app.documents[doc.key] ? C.green : C.borderMed}`,
                          borderRadius: 6, cursor: "pointer", transition: "all 0.15s"
                        }}>
                          {app.documents[doc.key] ? <CheckCircle size={14} color={C.green} /> : <AlertTriangle size={14} color={C.t3} />}
                          <span style={{ fontSize: 12, fontWeight: app.documents[doc.key] ? 600 : 500, color: app.documents[doc.key] ? C.green : C.t2 }}>{doc.label}</span>
                          <span style={{ marginLeft: "auto", fontSize: 10, color: app.documents[doc.key] ? C.green : C.t3 }}>
                            {app.documents[doc.key] ? "Submitted" : "Missing"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                     <div style={{ fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Admissions Action</div>
                     <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                       <button 
                         disabled={app.status === "Missing Documents" || app.status === "Enrolled"}
                         onClick={() => handleStatusChange(app.id, "Enrolled")}
                         style={{ 
                           width: "100%", padding: "12px", background: app.status === "Missing Documents" ? C.paper : C.m700, 
                           color: app.status === "Missing Documents" ? C.t3 : "#fff", 
                           border: app.status === "Missing Documents" ? `1px solid ${C.borderMed}` : "none", 
                           borderRadius: 8, cursor: app.status === "Missing Documents" || app.status === "Enrolled" ? "not-allowed" : "pointer", 
                           fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 
                         }}
                       >
                         <CheckCircle size={16} /> Finalize Enrollment
                       </button>
                       {app.status === "Missing Documents" && (
                         <div style={{ fontSize: 11, color: C.red, textAlign: "center" }}>Cannot enroll student until all documents are submitted.</div>
                       )}
                       {app.status === "Pending Review" && (
                         <button 
                           onClick={() => handleStatusChange(app.id, "Rejected")}
                           style={{ 
                             width: "100%", padding: "12px", background: "#fff", 
                             color: C.red, border: `1px solid ${C.red}`, 
                             borderRadius: 8, cursor: "pointer", 
                             fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 
                           }}
                         >
                           <XCircle size={16} /> Reject Application
                         </button>
                       )}
                     </div>
                  </div>
                  
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
