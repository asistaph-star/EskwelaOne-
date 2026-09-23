import React, { useState } from "react";
import { X, FileText, CheckCircle, Clock } from "lucide-react";
import { C } from "../../../shared/constants/tokens";
import { TeacherRankingRecord, TeacherCriteriaScore } from "../../../shared/types";
import { TEACHER_EVALUATION_CRITERIA } from "../../../shared/constants/teacherPositions";
import { useAppContext } from "../../../shared/AppContext";

export default function RankingDetailModal({ record, onClose }: { record: any, onClose: () => void }) {
  // Use existing scores if they exist, otherwise map from the default criteria
  const [scores, setScores] = useState<TeacherCriteriaScore[]>(() => {
    if (record.criteriaScores && record.criteriaScores.length > 0) return [...record.criteriaScores];
    return TEACHER_EVALUATION_CRITERIA.map(c => ({
      criteriaName: c.name,
      score: 0,
      maxScore: c.maxScore,
      remarks: ""
    }));
  });

  const [assessmentInfo, setAssessmentInfo] = useState(record.assessment_info || "");
  const [remarks, setRemarks] = useState(record.remarks || "");
  const [status, setStatus] = useState(record.status);
  const [isSaving, setIsSaving] = useState(false);

  const totalScore = scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0);

  const handleScoreChange = (idx: number, val: string) => {
    const num = Math.min(Math.max(Number(val) || 0, 0), scores[idx].maxScore);
    const newScores = [...scores];
    newScores[idx].score = num;
    setScores(newScores);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const { apiClient } = await import("../../../../api/client");
      await apiClient.patch(`/admin/rankings/${record.id}`, {
        criteria_scores: scores,
        assessment_info: assessmentInfo,
        remarks,
        status
      });
      onClose();
    } catch (err) {
      console.error('Failed to save ranking details', err);
      alert('Failed to save. Check inputs.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: "#fff", width: 800, maxHeight: "90vh", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* HEADER */}
        <div style={{ padding: "16px 24px", background: C.m800, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.8, marginBottom: 4 }}>Comparative Assessment</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{record.teacherName}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}><X size={20}/></button>
        </div>

        {/* BODY */}
        <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
          
          <div style={{ display: "flex", gap: 32 }}>
            {/* Meta Info */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Progression</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{record.current_position} → {record.target_position}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Evaluation Period</div>
                <div style={{ fontSize: 13, color: C.t1 }}>{record.evaluationPeriod}</div>
              </div>
            </div>
            
            {/* Documents */}
            <div style={{ flex: 1, borderLeft: `1px solid ${C.borderMed}`, paddingLeft: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 8 }}>Supporting Documents</div>
              {record.supportingDocuments && record.supportingDocuments.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {record.supportingDocuments.map((doc, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.blue, cursor: "pointer" }}>
                      <FileText size={14} /> <u>{doc}</u>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.t3, fontStyle: "italic" }}>No documents attached by teacher.</div>
              )}
            </div>
          </div>

          <hr style={{ border: "none", borderTop: `1px solid ${C.borderMed}`, margin: 0 }} />

          {/* SCORING FORM */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 16 }}>Criteria Breakdown</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f9fa", borderBottom: `1px solid ${C.borderMed}` }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, color: C.t3, textTransform: "uppercase" }}>Criteria</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, color: C.t3, textTransform: "uppercase", width: 120 }}>Max Score</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, color: C.t3, textTransform: "uppercase", width: 120 }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${C.borderMed}` }}>
                    <td style={{ padding: "12px", fontSize: 13, color: C.t1, fontWeight: 500 }}>{s.criteriaName}</td>
                    <td style={{ padding: "12px", textAlign: "center", fontSize: 13, color: C.t2 }}>{s.maxScore}</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <input 
                        type="number" 
                        min={0} max={s.maxScore}
                        value={s.score}
                        onChange={e => handleScoreChange(idx, e.target.value)}
                        style={{ width: 60, padding: "6px", textAlign: "center", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 14, fontWeight: 600 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 12px", background: "#f8f9fa", borderBottom: `1px solid ${C.borderMed}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.t2, textTransform: "uppercase" }}>Total Score</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: C.m700 }}>{totalScore}</span>
              </div>
            </div>
          </div>

          {/* ASSESSMENT DETAILS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t3, marginBottom: 6 }}>Assessment Information</div>
              <textarea 
                value={assessmentInfo}
                onChange={e => setAssessmentInfo(e.target.value)}
                placeholder="Enter overall assessment details..."
                style={{ width: "100%", height: 80, padding: 12, border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, resize: "none", fontFamily: "inherit" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t3, marginBottom: 6 }}>Principal's Remarks</div>
              <textarea 
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Enter final remarks or recommendations..."
                style={{ width: "100%", height: 60, padding: 12, border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, resize: "none", fontFamily: "inherit" }}
              />
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div style={{ padding: "16px 24px", background: "#f8f9fa", borderTop: `1px solid ${C.borderMed}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Evaluation Status:</span>
            <select 
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              style={{ padding: "6px 12px", borderRadius: 4, border: `1px solid ${C.borderMed}`, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: status === "Completed" ? C.greenBg : status === "Under Review" ? C.blueBg : C.amberBg,
                color: status === "Completed" ? C.green : status === "Under Review" ? C.blue : C.amber
              }}
            >
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.borderMed}`, padding: "8px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, color: C.t2, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={handleSave} style={{ background: C.m800, border: "none", color: "#fff", padding: "8px 24px", borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Save Evaluation
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
