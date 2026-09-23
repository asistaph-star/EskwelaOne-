import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { FileText, CheckCircle, XCircle, Clock, User, Filter, Calendar, Camera, Upload, Download } from 'lucide-react';
import { DocumentScanner } from '../../shared/components/scanner/DocumentScanner';
import type { DocRequestStatus } from '../../shared/AppContext';

export function PDocRequestsScreen() {
  const { documentRequests, updateDocumentRequest, addNotification, currentUser, getGenericDocument, saveGenericDocument } = useAppContext();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [pickupDates, setPickupDates] = useState<Record<string, string>>({});
  const [scannerReqId, setScannerReqId] = useState<string | null>(null);
  const [uploadReqId, setUploadReqId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const pendingRequests = documentRequests.filter(r => r.status === "Teacher Approved" || (r.status === "Submitted" && (r.responsibleRole === "REGISTRAR" || r.responsibleRole === "RECORDS_CUSTODIAN")));
  const processedRequests = documentRequests.filter(r => r.status !== "Submitted" && r.status !== "Teacher Approved" && r.status !== "Teacher Rejected");

  function handleApprove(id: string) {
    if (!pickupDates[id]) {
      alert("Please specify a ready/pickup date for the approved document.");
      return;
    }
    const dateObj = new Date(pickupDates[id]);
    const formattedDate = dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const req = documentRequests.find(r => r.id === id);
    const requiresPrincipal = req?.requiresPrincipalApproval !== false; // default true if undefined

    updateDocumentRequest(id, {
      status: requiresPrincipal ? "Principal Approved" : "Ready for Pickup",
      currentStage: requiresPrincipal ? 3 : 4,
      principalApprovedDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      principalRemarks: remarks[id] || (requiresPrincipal ? "Approved by Principal." : "Processed by Registrar."),
      readyDate: formattedDate
    });
    setRemarks(prev => ({ ...prev, [id]: "" }));
    setPickupDates(prev => ({ ...prev, [id]: "" }));
  }

  function handleReject(id: string) {
    if (!remarks[id]) {
      alert("Please provide a reason for rejection.");
      return;
    }
    updateDocumentRequest(id, {
      status: "Teacher Rejected",
      currentStage: 1,
      principalRemarks: remarks[id]
    });
    setRemarks(prev => ({ ...prev, [id]: "" }));
  }

  async function handleDownload(attachmentId: string, attachmentName: string) {
    try {
      const doc = await getGenericDocument(attachmentId);
      if (!doc || !doc.blob) {
        alert("Student attachment is missing or corrupted.");
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error("Failed to view attachment:", err);
      alert("Failed to retrieve the attachment. Please try again.");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadReqId) return;

    try {
      const savedDoc = await saveGenericDocument({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
        blob: file
      });

      updateDocumentRequest(uploadReqId, {
        status: "Completed",
        currentStage: 4,
        principalApprovedDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        readyDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        principalRemarks: "Document uploaded and attached securely.",
        attachedDocumentId: savedDoc.id
      });
    } catch (err) {
      console.error("Failed to upload document", err);
      alert("Failed to upload document. Please try again.");
    } finally {
      setUploadReqId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleMarkCompleted(id: string) {
    updateDocumentRequest(id, {
      status: "Completed",
      currentStage: 4
    });
  }

  function statusColor(s: DocRequestStatus) {
    if (s === "Principal Approved" || s === "Ready for Pickup" || s === "Completed") return C.green;
    if (s === "Teacher Approved") return C.blue;
    if (s === "Submitted") return "#f59e0b";
    return C.red;
  }
  function statusBg(s: DocRequestStatus) {
    if (s === "Principal Approved" || s === "Ready for Pickup" || s === "Completed") return C.greenBg;
    if (s === "Teacher Approved") return C.blueBg;
    if (s === "Submitted") return "#fef3c7";
    return C.redBg;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "32px 40px 100px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Document Request Approvals</h1>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Provide final approval and set pickup dates for verified student documents.</div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { label: "Pending Final Approval", val: pendingRequests.length.toString(), icon: Clock, color: C.blue, bg: C.blueBg },
            { label: "Ready / Completed", val: processedRequests.filter(r => r.status === "Principal Approved" || r.status === "Ready for Pickup" || r.status === "Completed").length.toString(), icon: CheckCircle, color: C.green, bg: C.greenBg },
            { label: "Total Handled", val: (pendingRequests.length + processedRequests.length).toString(), icon: FileText, color: C.m700, bg: C.m50 },
          ].map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className="hover-zoom" style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={18} color={kpi.color} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{kpi.val}</div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, borderBottom: `2px solid ${C.border}` }}>
          {[
            { id: "pending" as const, label: "Awaiting Principal Approval", count: pendingRequests.length },
            { id: "history" as const, label: "Approval History", count: 0 },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "12px 24px", background: "transparent", border: "none",
              borderBottom: activeTab === t.id ? `3px solid ${C.m700}` : "3px solid transparent",
              color: activeTab === t.id ? C.m700 : C.t3,
              fontSize: 13, fontWeight: activeTab === t.id ? 700 : 600, cursor: "pointer",
              transition: "all 0.15s", display: "flex", alignItems: "center", gap: 8, marginBottom: -2
            }}>
              {t.label}
              {t.count > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: C.red, borderRadius: 12, padding: "2px 8px" }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Pending Tab */}
        {activeTab === "pending" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pendingRequests.length === 0 ? (
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 60, textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
                <CheckCircle size={48} color={C.green} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: C.t2 }}>No requests awaiting final approval.</div>
                <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Teachers must verify requests first before they appear here.</div>
              </div>
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} data-purpose={req.purpose} style={{
                  background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "24px 28px",
                  display: "flex", flexDirection: "column", gap: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.03)", transition: "border-color 0.15s"
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.blue}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.borderMed}
                >
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 24, background: C.blueBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${C.blue}30` }}>
                        <FileText size={22} color={C.blue} />
                      </div>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif" }}>{req.documentType}</div>
                        <div style={{ fontSize: 12, color: C.t3, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                          <User size={13} /> <strong>{req.studentName}</strong> ({req.section})
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: C.blueBg, padding: "4px 12px", borderRadius: 12, border: `1px solid ${C.blue}20` }}>
                        {req.status === "Submitted" ? "Stage 1 · Registrar Review" : "Stage 2 · Final Approval Required"}
                      </span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: req.studentAttachmentId ? "1fr 1fr 1fr" : "1fr 1fr", gap: 16, background: C.paper, padding: 16, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, color: C.t2, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Purpose</div>
                        {req.purpose}
                      </div>
                      
                      {req.requiredInformation && Object.keys(req.requiredInformation).length > 0 && (
                        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Required Information</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
                            {Object.entries(req.requiredInformation).map(([key, value]) => (
                              <div key={key}>
                                <span style={{ fontWeight: 600, color: C.t2, marginRight: 6 }}>{key.replace(/([A-Z])/g, ' $1').trim()}:</span> 
                                <span style={{ color: C.t1 }}>{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {req.studentAttachmentId && (
                      <div style={{ fontSize: 12, color: C.t2 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Student Attachment</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: C.t1, marginBottom: 8, wordBreak: "break-word" }}>
                          <FileText size={14} color={C.t2} /> {req.studentAttachmentName || "Document Attached"}
                        </div>
                        <button onClick={() => handleDownload(req.studentAttachmentId!, req.studentAttachmentName || "attachment")} style={{
                          display: "flex", alignItems: "center", gap: 6, background: C.m700, color: "#fff", border: "none",
                          padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700, transition: "all 0.15s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                        >
                          <FileText size={14} /> View Request Letter
                        </button>
                      </div>
                    )}
                    {!req.responsibleRole || req.responsibleRole === "TEACHER" ? (
                      <div style={{ fontSize: 12, color: C.t2 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Teacher Verification</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: C.green, marginBottom: 2 }}>
                          <CheckCircle size={14} /> Verified by {req.teacherName} on {req.teacherApprovedDate}
                        </div>
                        <div style={{ fontStyle: "italic", fontSize: 11 }}>"{req.teacherRemarks}"</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: C.t2 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Routing</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: C.m700, marginBottom: 2 }}>
                          <CheckCircle size={14} /> Routed to {req.responsibleOffice}
                        </div>
                        <div style={{ fontStyle: "italic", fontSize: 11 }}>No prior teacher verification required.</div>
                      </div>
                    )}
                  </div>

                  {/* Remarks + Dates + Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.04em" }}>Pickup / Ready Date</label>
                        <input
                          type="date"
                          value={pickupDates[req.id] || ""}
                          onChange={e => setPickupDates(prev => ({ ...prev, [req.id]: e.target.value }))}
                          style={{ width: "100%", padding: "10px 14px", fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 8, boxSizing: "border-box", outline: "none" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.04em" }}>Principal Remarks (optional)</label>
                        <input
                          type="text"
                          value={remarks[req.id] || ""}
                          onChange={e => setRemarks(prev => ({ ...prev, [req.id]: e.target.value }))}
                          placeholder="E.g., Approved, ready for release."
                          style={{ width: "100%", padding: "10px 14px", fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 8, boxSizing: "border-box", outline: "none" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
                      <button onClick={() => handleReject(req.id)} style={{
                        display: "flex", alignItems: "center", gap: 6, background: "#fff", color: C.red, border: `1px solid ${C.red}`,
                        padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.15s"
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = C.redBg}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                      >
                        <XCircle size={14} /> Reject Request
                      </button>
                      <button 
                        onClick={() => handleApprove(req.id)} 
                        disabled={!pickupDates[req.id]}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, background: C.m700, color: "#fff", border: "none",
                          padding: "10px 20px", borderRadius: 6, cursor: !pickupDates[req.id] ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                          opacity: !pickupDates[req.id] ? 0.5 : 1
                        }}
                        onMouseEnter={e => { if (pickupDates[req.id]) e.currentTarget.style.background = C.m600; }}
                        onMouseLeave={e => { if (pickupDates[req.id]) e.currentTarget.style.background = C.m700; }}
                      >
                        <CheckCircle size={14} /> {req.requiresPrincipalApproval === false ? "Process & Set Pickup Date" : "Approve & Sign"}
                      </button>
                    </div>
                    
                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
                      <button onClick={() => { setUploadReqId(req.id); fileInputRef.current?.click(); }} style={{
                        display: "flex", alignItems: "center", gap: 6, background: C.paper, color: C.t2, border: `1px solid ${C.borderMed}`,
                        padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                      }}>
                        <Upload size={14} /> Upload PDF/Image
                      </button>
                      <button onClick={() => setScannerReqId(req.id)} style={{
                        display: "flex", alignItems: "center", gap: 6, background: C.blue, color: "#fff", border: "none",
                        padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                      }}>
                        <Camera size={14} /> Scan & Attach Digital Copy
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
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}`, background: C.paper }}>
                  {["Student", "Document Type", "Teacher", "Final Action Date", "Status", "Action"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 20px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processedRequests.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", fontSize: 12, color: C.t3 }}>No processed requests yet.</td></tr>
                ) : (
                  processedRequests.map(req => (
                    <tr key={req.id} data-purpose={req.purpose} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.paper}
                      onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                      <td style={{ padding: "14px 20px", fontSize: 12.5, fontWeight: 700, color: C.t1 }}>
                        {req.studentName}
                        <div style={{ fontSize: 10, color: C.t3, fontWeight: 500, marginTop: 2 }}>{req.section}</div>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.t2, fontWeight: 600 }}>{req.documentType}</td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.t2 }}>{req.teacherName}</td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.t2 }}>{req.principalApprovedDate || "—"}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(req.status), background: statusBg(req.status), padding: "4px 10px", borderRadius: 10 }}>{req.status}</span>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        {(req.status === "Principal Approved" || req.status === "Ready for Pickup") ? (
                          <button onClick={() => handleMarkCompleted(req.id)} style={{
                            padding: "6px 12px", background: "transparent", color: C.m700, border: `1px solid ${C.m700}`,
                            borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap"
                          }}>Mark Picked Up</button>
                        ) : (
                          <span style={{ fontSize: 11, color: C.t3 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,application/pdf"
        style={{ display: "none" }}
      />

      {scannerReqId && (
        <DocumentScanner
          onClose={() => setScannerReqId(null)}
          onSaveScan={async (file) => {
            try {
              // Convert dataUrl back to Blob for persistent binary storage
              const res = await fetch(file.dataUrl);
              const blob = await res.blob();
              
              const savedDoc = await saveGenericDocument({
                id: crypto.randomUUID(),
                name: file.name,
                mimeType: file.type,
                size: blob.size,
                createdAt: new Date().toISOString(),
                blob: blob
              });

              updateDocumentRequest(scannerReqId, {
                status: "Completed",
                currentStage: 4,
                principalApprovedDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
                readyDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
                principalRemarks: "Document digitized and attached securely.",
                attachedDocumentId: savedDoc.id
              });
            } catch (err) {
              console.error("Failed to save scanned document blob", err);
              alert("Failed to save scanned document. Please try again.");
            } finally {
              setScannerReqId(null);
            }
          }}
        />
      )}
    </div>
  );
}
