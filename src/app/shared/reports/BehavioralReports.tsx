import React, { useState } from "react";
import { AlertCircle, Filter, Search, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { useAppContext } from "../../shared/AppContext";

export function BehavioralReports() {
  const { behaviorLogs } = useAppContext();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = behaviorLogs.filter(log => 
    log.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.section.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 8, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Behavioral Reports</h1>
          <p style={{ fontSize: 13, color: C.t3 }}>Track and manage student behavioral incidents and disciplinary actions.</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} color={C.t3} style={{ position: "absolute", left: 16, top: 12 }} />
          <input 
            type="text" 
            placeholder="Search by student name, section, type, or status..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "10px 16px 10px 42px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14, color: C.t2, background: "#fff" }}
          />
        </div>
        <button style={{ padding: "0 20px", display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.t2, cursor: "pointer" }}>
          <Filter size={16} /> Filter
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}`, textAlign: "left", fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Date</th>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Student Name</th>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Section</th>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Incident Type</th>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "16px 20px", fontWeight: 700, textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", color: C.t3 }}>
                  <ShieldAlert size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>No behavior records found.</div>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isUrgent = log.status.toLowerCase().includes("urgent") || log.status.toLowerCase().includes("investigation");
                const isResolved = log.status.toLowerCase().includes("resolved");
                
                return (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${C.borderLight}`, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = C.m50} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "16px 20px", fontSize: 13, color: C.t3 }}>{log.date}</td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{log.studentName}</div>
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: 13, color: C.t2 }}>{log.section}</td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "inline-block", padding: "4px 8px", background: C.amberBg, color: C.amber, fontSize: 11, fontWeight: 700, borderRadius: 4 }}>
                        {log.type}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: isUrgent ? C.red : isResolved ? C.green : C.t2 }}>
                        {isUrgent && <AlertCircle size={14} />}
                        {isResolved && <CheckCircle2 size={14} />}
                        {log.status}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      <button style={{ background: "transparent", border: "none", color: C.m700, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <FileText size={14} /> View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
