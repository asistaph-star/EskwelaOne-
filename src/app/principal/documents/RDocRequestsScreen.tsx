import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { FileText, CheckCircle, Printer, Search, Filter } from 'lucide-react';
import type { DocRequestStatus } from '../../shared/AppContext';

export function RDocRequestsScreen() {
  const { documentRequests, updateDocumentRequest } = useAppContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"Pending Prep" | "Ready for Pickup" | "Completed">("Pending Prep");

  // For the Registrar, "Pending Prep" means the Principal has approved it and it's time to print/prepare it.
  const requests = documentRequests.filter(r => {
    if (activeTab === "Pending Prep") return r.status === "Principal Approved";
    if (activeTab === "Ready for Pickup") return r.status === "Ready for Pickup";
    return r.status === "Completed";
  }).filter(r => 
    r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.documentType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleMarkReady(id: string) {
    updateDocumentRequest(id, {
      status: "Ready for Pickup",
      currentStage: 4
    });
    alert("Document marked as Ready for Pickup!");
  }

  function handleMarkCompleted(id: string) {
    updateDocumentRequest(id, {
      status: "Completed",
      currentStage: 4
    });
    alert("Document marked as Completed (Picked up).");
  }

  function statusColor(s: DocRequestStatus) {
    if (s === "Completed") return C.green;
    if (s === "Ready for Pickup") return C.blue;
    if (s === "Principal Approved") return "#f59e0b";
    return C.t2;
  }
  function statusBg(s: DocRequestStatus) {
    if (s === "Completed") return C.greenBg;
    if (s === "Ready for Pickup") return C.blueBg;
    if (s === "Principal Approved") return "#fef3c7";
    return C.m50;
  }

  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Document Fulfillment</h1>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Prepare and release approved student document requests.</div>
        </div>

        {/* Toolbar & Tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={16} color={C.t3} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="text" 
                placeholder="Search by student name or document type..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: "100%", padding: "12px 14px 12px 40px", fontSize: 13, border: `1px solid ${C.borderMed}`, borderRadius: 8, boxSizing: "border-box", outline: "none" }}
              />
            </div>
            <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 20px", background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.t2 }}>
              <Filter size={16} /> Filter
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, borderBottom: `2px solid ${C.border}` }}>
            {(["Pending Prep", "Ready for Pickup", "Completed"] as const).map(t => (
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

        {/* Table */}
        <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.paper, borderBottom: `2px solid ${C.border}` }}>
                {["Student", "Document Details", "Approvals", "Ready/Pickup Date", "Status", "Action"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "14px 20px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", fontSize: 13, color: C.t3 }}>No requests in this stage.</td></tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.paper}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                  >
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{req.studentName}</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{req.section}</div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, display: "flex", alignItems: "center", gap: 6 }}>
                        <FileText size={14} color={C.blue} /> {req.documentType}
                      </div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 4, maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{req.purpose}</div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 11, color: C.green, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                        <CheckCircle size={12} /> {req.teacherName} (Verify)
                      </div>
                      <div style={{ fontSize: 11, color: C.green, display: "flex", alignItems: "center", gap: 4, fontWeight: 600, marginTop: 4 }}>
                        <CheckCircle size={12} /> Principal (Approve)
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{req.readyDate || "Not set"}</div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(req.status), background: statusBg(req.status), padding: "4px 10px", borderRadius: 12 }}>
                        {req.status}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      {req.status === "Principal Approved" && (
                        <button onClick={() => handleMarkReady(req.id)} style={{ background: C.m700, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                          <Printer size={14} /> Prepare & Print
                        </button>
                      )}
                      {req.status === "Ready for Pickup" && (
                        <button onClick={() => handleMarkCompleted(req.id)} style={{ background: "transparent", color: C.m700, border: `1px solid ${C.m700}`, padding: "8px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Mark Picked Up
                        </button>
                      )}
                      {req.status === "Completed" && (
                        <span style={{ fontSize: 11, color: C.t3 }}>Released</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
