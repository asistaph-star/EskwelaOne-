import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { FileText, CheckCircle, XCircle, Clock, User, Filter, MessageSquare, ChevronRight, AlertCircle } from 'lucide-react';
import type { DocRequestStatus } from '../../shared/AppContext';

export function DocRequestsScreen() {
  const { documentRequests, updateDocumentRequest } = useAppContext();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const teacherName = "Ana R. Soriano";
  const pendingRequests = documentRequests.filter(r => r.status === "Submitted" && r.teacherName === teacherName);
  const processedRequests = documentRequests.filter(r => r.status !== "Submitted" && r.teacherName === teacherName);

  function handleApprove(id: string) {
    updateDocumentRequest(id, {
      status: "Teacher Approved",
      currentStage: 2,
      teacherApprovedDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      teacherRemarks: remarks[id] || "Verified and approved. Forwarding to Principal for final approval."
    });
    setRemarks(prev => ({ ...prev, [id]: "" }));
    alert("✅ Document request approved and forwarded to the Principal for final approval.");
  }

  function handleReject(id: string) {
    if (!remarks[id]) {
      alert("Please provide a reason for rejection.");
      return;
    }
    updateDocumentRequest(id, {
      status: "Teacher Rejected",
      currentStage: 1,
      teacherRemarks: remarks[id]
    });
    setRemarks(prev => ({ ...prev, [id]: "" }));
    alert("Request has been rejected. The student will be notified.");
  }

  function statusColor(s: DocRequestStatus) {
    if (s === "Teacher Approved" || s === "Principal Approved" || s === "Ready for Pickup" || s === "Completed") return C.green;
    if (s === "Submitted") return "#f59e0b";
    return C.red;
  }
  function statusBg(s: DocRequestStatus) {
    if (s === "Teacher Approved" || s === "Principal Approved" || s === "Ready for Pickup" || s === "Completed") return C.greenBg;
    if (s === "Submitted") return "#fef3c7";
    return C.redBg;
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 100px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Document Request Verification</h1>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>Review and verify student certificate/document requests before forwarding to the Principal.</div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "Pending Verification", val: pendingRequests.length.toString(), icon: Clock, color: "#f59e0b", bg: "#fef3c7" },
            { label: "Approved by You", val: documentRequests.filter(r => r.teacherName === teacherName && (r.status === "Teacher Approved" || r.status === "Principal Approved" || r.status === "Ready for Pickup" || r.status === "Completed")).length.toString(), icon: CheckCircle, color: C.green, bg: C.greenBg },
            { label: "Total Requests", val: documentRequests.filter(r => r.teacherName === teacherName).length.toString(), icon: FileText, color: C.m700, bg: C.m50 },
          ].map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={14} color={kpi.color} />
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{kpi.val}</div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${C.border}` }}>
          {[
            { id: "pending" as const, label: "Pending Verification", count: pendingRequests.length },
            { id: "history" as const, label: "Processed History", count: 0 },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "10px 20px", background: "transparent", border: "none",
              borderBottom: activeTab === t.id ? `2px solid ${C.m700}` : "2px solid transparent",
              color: activeTab === t.id ? C.m700 : C.t3,
              fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500, cursor: "pointer",
              transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6, marginBottom: -2
            }}>
              {t.label}
              {t.count > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: C.red, borderRadius: 10, padding: "1px 6px" }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Pending Tab */}
        {activeTab === "pending" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {pendingRequests.length === 0 ? (
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 40, textAlign: "center" }}>
                <CheckCircle size={32} color={C.green} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: C.t3 }}>No pending document requests. All caught up!</div>
              </div>
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} style={{
                  background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: "20px 24px",
                  display: "flex", flexDirection: "column", gap: 16, transition: "border-color 0.15s"
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.m700}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.borderMed}
                >
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div style={{ width: 42, height: 42, borderRadius: 21, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1.5px solid #f59e0b20" }}>
                        <FileText size={18} color="#f59e0b" />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{req.documentType}</div>
                        <div style={{ fontSize: 11, color: C.t3, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                          <User size={11} /> {req.studentName} · {req.section}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "#fef3c7", padding: "3px 10px", borderRadius: 10, border: "1px solid #f59e0b20" }}>
                        Stage 1 · Awaiting Your Verification
                      </span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ fontSize: 11, color: C.t2 }}><strong>Purpose:</strong> {req.purpose}</div>
                    <div style={{ fontSize: 11, color: C.t2 }}><strong>Submitted:</strong> {req.submittedDate}</div>
                  </div>

                  {/* Stage Progress */}
                  <div style={{ padding: "12px 16px", background: C.paper, borderRadius: 6, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Approval Pipeline</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                      {[
                        { label: "Submitted", done: true, date: req.submittedDate },
                        { label: "Teacher Verification", done: false, active: true },
                        { label: "Principal Approval", done: false },
                        { label: "Ready for Pickup", done: false },
                      ].map((step, i) => (
                        <React.Fragment key={i}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: 12,
                              background: step.done ? C.green : step.active ? C.m700 : C.border,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: step.active ? "0 0 0 4px rgba(29,78,216,0.15)" : "none",
                              transition: "all 0.3s"
                            }}>
                              {step.done ? <CheckCircle size={12} color="#fff" /> : step.active ? <Clock size={12} color="#fff" /> : <div style={{ width: 8, height: 8, borderRadius: 4, background: "#fff" }} />}
                            </div>
                            <span style={{ fontSize: 8.5, fontWeight: step.active ? 700 : 500, color: step.done ? C.green : step.active ? C.m700 : C.t3, textAlign: "center" }}>{step.label}</span>
                            {step.date && <span style={{ fontSize: 7.5, color: C.t3 }}>{step.date}</span>}
                          </div>
                          {i < 3 && <div style={{ flex: 0.5, height: 2, background: step.done ? C.green : C.border, marginTop: -16 }} />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Remarks + Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4, letterSpacing: "0.04em" }}>Remarks (optional for approval, required for rejection)</label>
                      <textarea
                        value={remarks[req.id] || ""}
                        onChange={e => setRemarks(prev => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder="Add your verification notes..."
                        rows={2}
                        style={{ width: "100%", padding: "8px 12px", fontSize: 11.5, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif" }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleApprove(req.id)} style={{
                        display: "flex", alignItems: "center", gap: 6, background: C.green, color: "#fff", border: "none",
                        padding: "9px 18px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700, transition: "all 0.15s"
                      }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                      >
                        <CheckCircle size={13} /> Verify & Forward to Principal
                      </button>
                      <button onClick={() => handleReject(req.id)} style={{
                        display: "flex", alignItems: "center", gap: 6, background: "#fff", color: C.red, border: `1.5px solid ${C.red}`,
                        padding: "9px 18px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700, transition: "all 0.15s"
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = C.redBg}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                      >
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  {["Student", "Document Type", "Submitted", "Your Action", "Status", "Stage"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processedRequests.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", fontSize: 11, color: C.t3 }}>No processed requests yet.</td></tr>
                ) : (
                  processedRequests.map(req => (
                    <tr key={req.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.paper}
                      onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                      <td style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 600, color: C.t1 }}>{req.studentName}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: C.t2 }}>{req.documentType}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: C.t2 }}>{req.submittedDate}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: C.t2 }}>{req.teacherApprovedDate || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(req.status), background: statusBg(req.status), padding: "3px 10px", borderRadius: 10 }}>{req.status}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: C.t2 }}>Stage {req.currentStage} of 4</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
