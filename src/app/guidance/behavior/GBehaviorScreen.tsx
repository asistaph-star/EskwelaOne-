import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { ShieldAlert, CheckCircle, Search, Filter, AlertTriangle, FileText, Mail, X } from 'lucide-react';
import type { BehaviorLog } from '../../shared/AppContext';

export function GBehaviorScreen() {
  const { behaviorLogs, addBehaviorLog, updateBehaviorLog } = useAppContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState("");
  const [newSection, setNewSection] = useState("");
  const [newType, setNewType] = useState("Misconduct");
  const [newNote, setNewNote] = useState("");
  const [newStatus, setNewStatus] = useState("Under investigation");

  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editNote, setEditNote] = useState("");

  const filteredLogs = behaviorLogs.filter(l => 
    l.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.trim() || !newSection.trim() || !newNote.trim()) return;

    addBehaviorLog({
      id: "log-" + Math.random().toString(36).substr(2, 9),
      studentName: newStudent,
      section: newSection,
      type: newType,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: newStatus,
      note: newNote,
    });
    
    setIsModalOpen(false);
    setNewStudent("");
    setNewSection("");
    setNewType("Misconduct");
    setNewNote("");
    setNewStatus("Under investigation");
  };

  const openManageModal = (log: BehaviorLog) => {
    setEditingLogId(log.id);
    setEditStatus(log.status);
    setEditNote(log.note);
    setIsManageModalOpen(true);
  };

  const handleUpdateLog = (e: React.FormEvent) => {
    e.preventDefault();
    updateBehaviorLog(editingLogId, { status: editStatus, note: editNote });
    setIsManageModalOpen(false);
  };

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
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{
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
                      <button onClick={() => openManageModal(log)} style={{ background: "transparent", color: C.m700, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Manage</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", width: 500, borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ margin: 0, fontSize: 18, color: C.t1, fontFamily: "'Fraunces', serif" }}>Log New Incident</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.t3} /></button>
            </div>
            <form onSubmit={handleAddLog} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Student Name</label>
                  <input type="text" value={newStudent} onChange={e => setNewStudent(e.target.value)} required style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Section</label>
                  <input type="text" value={newSection} onChange={e => setNewSection(e.target.value)} required style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Incident Type</label>
                  <select value={newType} onChange={e => setNewType(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", boxSizing: "border-box" }}>
                    <option value="Misconduct">Misconduct</option>
                    <option value="Disruption">Disruption</option>
                    <option value="Tardiness">Tardiness</option>
                    <option value="Bullying">Bullying</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Status</label>
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", boxSizing: "border-box" }}>
                    <option value="Under investigation">Under investigation</option>
                    <option value="Parent notified">Parent notified</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Notes</label>
                <textarea value={newNote} onChange={e => setNewNote(e.target.value)} required rows={4} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", boxSizing: "border-box", resize: "none" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: "10px 20px", background: "none", border: "none", color: C.t3, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "10px 20px", background: C.m700, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>Save Incident</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isManageModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", width: 500, borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ margin: 0, fontSize: 18, color: C.t1, fontFamily: "'Fraunces', serif" }}>Manage Incident</h2>
              <button onClick={() => setIsManageModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.t3} /></button>
            </div>
            <form onSubmit={handleUpdateLog} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", boxSizing: "border-box" }}>
                  <option value="Under investigation">Under investigation</option>
                  <option value="Parent notified">Parent notified</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Notes</label>
                <textarea value={editNote} onChange={e => setEditNote(e.target.value)} required rows={4} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", boxSizing: "border-box", resize: "none" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setIsManageModalOpen(false)} style={{ padding: "10px 20px", background: "none", border: "none", color: C.t3, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "10px 20px", background: C.m700, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
