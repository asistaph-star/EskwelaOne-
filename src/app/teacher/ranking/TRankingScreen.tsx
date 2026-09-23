import React, { useState } from "react";
import { Award, ChevronRight, FileText, Upload, Clock, CheckCircle } from "lucide-react";
import { useAppContext } from "../../shared/AppContext";
import { C } from "../../shared/constants/tokens";
import { TeacherRankingRecord } from "../../shared/types";
import { DocumentScanner } from "../../shared/components/scanner/DocumentScanner";

export default function TRankingScreen() {
  const { teacherRankings, updateTeacherRanking, currentUser } = useAppContext();
  const [scannerRecordId, setScannerRecordId] = useState<string | null>(null);

  const CURRENT_TEACHER_ID = currentUser?.id || ""; 

  const myRankings = teacherRankings
    .filter(r => r.teacherId === CURRENT_TEACHER_ID)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeRanking = myRankings.find(r => r.status !== "Completed");
  const historicalRankings = myRankings.filter(r => r.status === "Completed");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8f9fa", overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      {/* HEADER BAND */}
      <div style={{ background: C.m800, padding: "24px 32px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8, marginBottom: 6 }}>Career Progression</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>Teacher Ranking</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            <FileText size={16} /> Guidelines
          </button>
        </div>
      </div>

      <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 32, maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        
        {/* ACTIVE RANKING SECTION */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 16, borderBottom: `1px solid ${C.borderMed}`, paddingBottom: 8 }}>Active Evaluation</h2>
          {activeRanking ? (
            <RankingCard record={activeRanking} isActive={true} onAttach={() => setScannerRecordId(activeRanking.id)} />
          ) : (
            <div style={{ background: "#fff", border: `1px dashed ${C.borderMed}`, borderRadius: 8, padding: 32, textAlign: "center", color: C.t3 }}>
              <Award size={48} color={C.m200} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>No Active Evaluation</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>You do not currently have a pending ranking or promotion application.</div>
            </div>
          )}
        </div>

        {/* HISTORICAL RANKINGS SECTION */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 16, borderBottom: `1px solid ${C.borderMed}`, paddingBottom: 8 }}>Career Progression History</h2>
          {historicalRankings.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {historicalRankings.map(r => (
                <RankingCard key={r.id} record={r} isActive={false} />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: C.t3, fontStyle: "italic" }}>No previous ranking records found.</div>
          )}
        </div>
      </div>
      {scannerRecordId && (
        <DocumentScanner
          onClose={() => setScannerRecordId(null)}
          onSaveScan={(file) => {
            updateTeacherRanking(scannerRecordId, {
              supportingDocuments: [...activeRanking!.supportingDocuments, file.name]
            });
            // In a real app, we would upload the file.dataUrl to the backend here
            setScannerRecordId(null);
          }}
        />
      )}
    </div>
  );
}

function RankingCard({ record, isActive, onAttach }: { record: TeacherRankingRecord, isActive: boolean, onAttach?: () => void }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending": return { c: C.amber, bg: C.amberBg };
      case "Under Review": return { c: C.blue, bg: C.blueBg };
      case "Completed": return { c: C.green, bg: C.greenBg };
      default: return { c: C.t2, bg: C.m50 };
    }
  };

  const statusStyle = getStatusColor(record.status);

  return (
    <div style={{ background: "#fff", border: `1px solid ${isActive ? C.m500 : C.borderMed}`, borderRadius: 8, overflow: "hidden", boxShadow: isActive ? "0 4px 12px rgba(139,30,30,0.08)" : "none" }}>
      {/* HEADER */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, background: isActive ? "#FDF8F8" : "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: C.t1 }}>
            {record.currentPosition} <ChevronRight size={16} color={C.t3} /> {record.targetPosition}
          </div>
          <div style={{ fontSize: 11, background: statusStyle.bg, color: statusStyle.c, padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
            {record.status}
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.t3, fontWeight: 500 }}>
          {record.evaluationPeriod}
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: 20, display: "flex", gap: 32 }}>
        
        {/* LEFT COLUMN: Criteria */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 12 }}>Comparative Assessment</div>
          
          {record.criteriaScores.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {record.criteriaScores.map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <div style={{ color: C.t2 }}>{c.criteriaName}</div>
                  <div style={{ fontWeight: 600, color: C.t1 }}>{c.score} <span style={{ color: C.t3, fontWeight: 400, fontSize: 11 }}>/ {c.maxScore}</span></div>
                </div>
              ))}
              <div style={{ borderTop: `1px dashed ${C.borderMed}`, marginTop: 4, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Total Score</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.m700 }}>{record.totalScore}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: C.t3, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>
              Scores will be published once the evaluation is complete.
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Details & Docs */}
        <div style={{ flex: 1, borderLeft: `1px solid ${C.borderMed}`, paddingLeft: 32, display: "flex", flexDirection: "column", gap: 20 }}>
          
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Evaluator(s)</div>
            <div style={{ fontSize: 13, color: C.t1 }}>{record.evaluators.join(", ")}</div>
          </div>
          
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Remarks</div>
            <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.5, background: C.m50, padding: 12, borderRadius: 4, borderLeft: `3px solid ${C.m200}` }}>
              {record.remarks || "No remarks provided yet."}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              Supporting Documents
              {isActive && <button onClick={onAttach} style={{ color: C.blue, background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Attach Scan</button>}
            </div>
            
            {record.supportingDocuments.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {record.supportingDocuments.map((doc, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.t2, background: "#f8f9fa", padding: "6px 10px", borderRadius: 4, border: `1px solid ${C.borderMed}` }}>
                    <FileText size={14} color={C.t3} /> {doc}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.t3, fontStyle: "italic" }}>
                {isActive ? "No documents attached. Attach IPCRF, Certificates, etc." : "No documents attached."}
              </div>
            )}
            
            {isActive && (
              <button style={{ marginTop: 12, width: "100%", background: "#fff", border: `1px dashed ${C.borderMed}`, padding: "8px 0", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.m700, cursor: "pointer" }}>
                <Upload size={14} /> Upload Scanned Document
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
