import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { ShieldAlert, CheckCircle, Search, Filter, AlertTriangle, FileText, Mail } from 'lucide-react';
import type { BehaviorLog } from '../../shared/AppContext';

export function GBehaviorScreen() {
  const { behaviorLogs, addBehaviorLog } = useAppContext();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = behaviorLogs.filter(l => 
    l.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function statusColor(s: string) {
    if (s === "Resolved") return C.green;
    if (s === "Parent notified") return C.blue;
    return C.red;
  }

  function statusBg(s: string) {
    if (s === "Resolved") return C.greenBg;
    if (s === "Parent notified") return C.blueBg;
    return C.redBg;
  }

  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Behavioral Reports</h1>
            <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Track and manage student disciplinary cases and behavioral logs.</div>
          </div>
          <button style={{
            background: C.m700, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6,
            fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}>
            <ShieldAlert size={14} /> Log New Incident
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={16} color={C.t3} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input 
              type="text" 
              placeholder="Search by student name or incident type..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: "100%", padding: "12px 14px 12px 40px", fontSize: 13, border: `1px solid ${C.borderMed}`, borderRadius: 8, boxSizing: "border-box", outline: "none" }}
            />
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 20px", background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.t2 }}>
            <Filter size={16} /> Filter
          </button>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.paper, borderBottom: `2px solid ${C.border}` }}>
                {["Student", "Incident Type", "Date", "Notes", "Status", "Action"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "14px 20px", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", fontSize: 13, color: C.t3 }}>No behavioral logs found.</td></tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.paper}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                  >
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{log.studentName}</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{log.section}</div>
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: 12, fontWeight: 600, color: C.t2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertTriangle size={14} color={C.red} /> {log.type}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: 12, color: C.t3 }}>{log.date}</td>
                    <td style={{ padding: "16px 20px", fontSize: 12, color: C.t2, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.note}</td>
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(log.status), background: statusBg(log.status), padding: "4px 10px", borderRadius: 12 }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px", display: "flex", gap: 12 }}>
                      <button onClick={() => alert(`Drafting email to parent of ${log.studentName}...`)} style={{ background: "transparent", color: C.blue, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <Mail size={14} /> Email Parent
                      </button>
                      <button style={{ background: "transparent", color: C.m700, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Manage</button>
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
