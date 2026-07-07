import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, Plus, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';

export function TLeaveScreen() {
  const [modal, setModal] = useState(false);

  const leaves = [
    { date: "2025-06-11", type: "Sick Leave", duration: "2 days (Jun 12-13)", status: "Pending", submittedOn: "Jun 11, 2025" },
    { date: "2025-02-14", type: "Vacation Leave", duration: "1 day (Feb 14)", status: "Approved", submittedOn: "Feb 01, 2025" },
  ];

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", background: "transparent" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>My Leave Requests</h2>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Submit and track your leave of absence requests.</div>
        </div>
        <button onClick={() => setModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: C.m700, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={14} /> Request Leave
        </button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
              {["Submitted On", "Leave Type", "Duration", "Status"].map((c, i) => (
                <th key={c} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaves.map((l, i) => (
              <tr key={i} style={{ borderBottom: i < leaves.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <td style={{ padding: "14px", fontSize: 12, color: C.t2 }}>{l.submittedOn}</td>
                <td style={{ padding: "14px", fontSize: 12, fontWeight: 600, color: C.t1 }}>{l.type}</td>
                <td style={{ padding: "14px", fontSize: 12, color: C.t2 }}>{l.duration}</td>
                <td style={{ padding: "14px" }}>
                  <Stamp label={l.status} color={l.status === "Approved" ? C.green : l.status === "Rejected" ? C.red : C.amber} bg={l.status === "Approved" ? C.greenBg : l.status === "Rejected" ? C.redBg : C.amberBg} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,8,8,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ background: "#fff", borderRadius: 6, width: "100%", maxWidth: 400, overflow: "hidden" }}>
            <div style={{ background: C.m800, padding: "16px 20px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Fraunces',serif" }}>Submit Leave Request</div>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Leave Type</label>
                <select style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12 }}>
                  <option>Sick Leave</option>
                  <option>Vacation Leave</option>
                  <option>Maternity/Paternity Leave</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Dates</label>
                <input type="text" placeholder="e.g. Jun 12-13, 2025" style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Reason / Remarks</label>
                <textarea rows={3} style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box", resize: "none" }}></textarea>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button onClick={() => setModal(false)} style={{ padding: "8px 16px", background: C.m50, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: C.t2, cursor: "pointer" }}>Cancel</button>
                <button onClick={() => { alert("Leave Request Submitted (Mock)"); setModal(false); }} style={{ padding: "8px 16px", background: C.m700, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Submit Request</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
