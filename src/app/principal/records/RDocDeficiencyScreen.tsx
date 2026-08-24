import React, { useState } from "react";
import {
  AlertTriangle, CheckCircle2, Search, Plus, X, Pencil,
  FileText, ChevronDown, ChevronUp, MessageSquare, ClipboardList
} from "lucide-react";
import { C } from "../../shared/constants/tokens";

// ── Types ──────────────────────────────────────────────────────────────────
type DocStatus = "Missing" | "Submitted" | "Received" | "For Follow-up";

type DocumentRequirement = {
  id: string;
  label: string;
  status: DocStatus;
  dueDate?: string;
  note?: string;
};

type StudentDeficiency = {
  id: string;
  name: string;
  lrn: string;
  grade: string;
  section: string;
  type: "New Student" | "Transferee" | "Returning";
  enrolledDate: string;
  requirements: DocumentRequirement[];
  overallNote?: string;
};

// ── Seed Data ───────────────────────────────────────────────────────────────
const SEED_DEFICIENCIES: StudentDeficiency[] = [
  {
    id: "SD-001", name: "Reyes, Sofia", lrn: "102301180034", grade: "Grade 8", section: "Newton",
    type: "Transferee", enrolledDate: "2026-06-22",
    overallNote: "From Sta. Rita National High School. Registrar confirmed docs are being processed.",
    requirements: [
      { id: "r1", label: "Form 137 (Permanent Record)", status: "Missing", dueDate: "2026-07-15", note: "Awaiting transmittal from previous school (Sta. Rita NHS)." },
      { id: "r2", label: "PSA Birth Certificate", status: "Submitted" },
      { id: "r3", label: "Certificate of Good Moral Character", status: "Received" },
      { id: "r4", label: "Medical / Health Certificate", status: "Missing", dueDate: "2026-07-10" },
    ]
  },
  {
    id: "SD-002", name: "Torres, Andrei", lrn: "102301180041", grade: "Grade 7", section: "Rizal",
    type: "New Student", enrolledDate: "2026-06-18",
    requirements: [
      { id: "r5", label: "PSA Birth Certificate", status: "Submitted" },
      { id: "r6", label: "Form 138 (Report Card – Grade 6)", status: "Missing", note: "Parents said they lost the original. Requested from Sto. Tomas Elementary." },
      { id: "r7", label: "Certificate of Good Moral Character", status: "For Follow-up", note: "Submitted photocopy; original needed." },
      { id: "r8", label: "Medical / Health Certificate", status: "Submitted" },
    ]
  },
  {
    id: "SD-003", name: "Manalo, Crisha Mae", lrn: "102301180058", grade: "Grade 9", section: "Curie",
    type: "Returning", enrolledDate: "2026-06-20",
    requirements: [
      { id: "r9", label: "PSA Birth Certificate", status: "Received" },
      { id: "r10", label: "Form 138 (Report Card – Grade 8)", status: "Missing", dueDate: "2026-07-30" },
      { id: "r11", label: "Medical / Health Certificate", status: "Missing" },
      { id: "r12", label: "Parent Consent Form", status: "Submitted" },
    ]
  },
  // ── Complete students (all docs received/submitted) ──
  {
    id: "SD-004", name: "Dela Cruz, Mateo", lrn: "102301180022", grade: "Grade 7", section: "Bonifacio",
    type: "New Student", enrolledDate: "2026-06-15",
    overallNote: "All documents verified and on file.",
    requirements: [
      { id: "r13", label: "PSA Birth Certificate", status: "Received" },
      { id: "r14", label: "Form 138 (Report Card – Grade 6)", status: "Received" },
      { id: "r15", label: "Certificate of Good Moral Character", status: "Received" },
      { id: "r16", label: "Medical / Health Certificate", status: "Submitted" },
    ]
  },
  {
    id: "SD-005", name: "Bautista, Liam", lrn: "102301180063", grade: "Grade 7", section: "Mabini",
    type: "New Student", enrolledDate: "2026-06-16",
    requirements: [
      { id: "r17", label: "PSA Birth Certificate", status: "Received" },
      { id: "r18", label: "Form 138 (Report Card – Grade 6)", status: "Received" },
      { id: "r19", label: "Certificate of Good Moral Character", status: "Received" },
      { id: "r20", label: "Medical / Health Certificate", status: "Received" },
    ]
  },
  {
    id: "SD-006", name: "Mendoza, Isabella", lrn: "102301180077", grade: "Grade 9", section: "Darwin",
    type: "Returning", enrolledDate: "2026-06-17",
    requirements: [
      { id: "r21", label: "PSA Birth Certificate", status: "Submitted" },
      { id: "r22", label: "Form 138 (Report Card – Grade 8)", status: "Submitted" },
      { id: "r23", label: "Medical / Health Certificate", status: "Received" },
      { id: "r24", label: "Parent Consent Form", status: "Received" },
    ]
  },
  {
    id: "SD-007", name: "Garcia, Jolo Marcus", lrn: "102301180089", grade: "Grade 8", section: "Einstein",
    type: "Transferee", enrolledDate: "2026-06-19",
    overallNote: "Transferred from Mabalacat City NHS. All docs transmitted electronically.",
    requirements: [
      { id: "r25", label: "Form 137 (Permanent Record)", status: "Received", note: "Electronically transmitted." },
      { id: "r26", label: "PSA Birth Certificate", status: "Received" },
      { id: "r27", label: "Certificate of Good Moral Character", status: "Received" },
      { id: "r28", label: "Medical / Health Certificate", status: "Submitted" },
    ]
  },
];

const ALL_POSSIBLE_DOCS = [
  "Form 137 (Permanent Record)",
  "Form 138 (Report Card)",
  "PSA Birth Certificate",
  "Certificate of Good Moral Character",
  "Medical / Health Certificate",
  "Parent Consent Form",
  "Baptismal Certificate",
  "Certificate of Completion (Elem)",
  "Transferee Clearance Form",
];

// ── Status helpers ──────────────────────────────────────────────────────────
function statusColor(s: DocStatus): string {
  if (s === "Received") return C.green;
  if (s === "Submitted") return "#2563eb";
  if (s === "For Follow-up") return "#d97706";
  return C.red;
}
function statusBg(s: DocStatus): string {
  if (s === "Received") return C.greenBg;
  if (s === "Submitted") return "#eff6ff";
  if (s === "For Follow-up") return "#fef3c7";
  return C.redBg;
}

// ── Main Component ──────────────────────────────────────────────────────────
export function RDocDeficiencyScreen() {
  const [students, setStudents] = useState<StudentDeficiency[]>(SEED_DEFICIENCIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "Incomplete" | "Complete">("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{ studentId: string; reqId?: string; text: string } | null>(null);
  const [addDocModal, setAddDocModal] = useState<string | null>(null); // student id
  const [newDocLabel, setNewDocLabel] = useState("");
  const [newDocDue, setNewDocDue] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = students.filter(s => {
    const query = searchQuery.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(query) || s.lrn.includes(query) || s.section.toLowerCase().includes(query);
    const hasMissing = s.requirements.some(r => r.status === "Missing" || r.status === "For Follow-up");
    const matchFilter = filterStatus === "All" || (filterStatus === "Incomplete" && hasMissing) || (filterStatus === "Complete" && !hasMissing);
    return matchSearch && matchFilter;
  });

  // ── Actions ──────────────────────────────────────────────────────────────
  function cycleStatus(studentId: string, reqId: string) {
    const cycle: DocStatus[] = ["Missing", "For Follow-up", "Submitted", "Received"];
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      return {
        ...s, requirements: s.requirements.map(r => {
          if (r.id !== reqId) return r;
          const idx = cycle.indexOf(r.status);
          return { ...r, status: cycle[(idx + 1) % cycle.length] };
        })
      };
    }));
  }

  function saveNote(studentId: string, reqId: string | undefined, text: string) {
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      if (!reqId) return { ...s, overallNote: text };
      return { ...s, requirements: s.requirements.map(r => r.id === reqId ? { ...r, note: text } : r) };
    }));
    setEditingNote(null);
    showToast("Note saved successfully.");
  }

  function addDocument(studentId: string) {
    if (!newDocLabel.trim()) return;
    const newReq: DocumentRequirement = {
      id: `req-${Date.now()}`, label: newDocLabel, status: "Missing", dueDate: newDocDue || undefined
    };
    setStudents(prev => prev.map(s => s.id !== studentId ? s : { ...s, requirements: [...s.requirements, newReq] }));
    setNewDocLabel(""); setNewDocDue(""); setAddDocModal(null);
    showToast("Document requirement added.");
  }

  function removeRequirement(studentId: string, reqId: string) {
    setStudents(prev => prev.map(s => s.id !== studentId ? s : { ...s, requirements: s.requirements.filter(r => r.id !== reqId) }));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // ── Summary counts ────────────────────────────────────────────────────────
  const totalMissing = students.reduce((sum, s) => sum + s.requirements.filter(r => r.status === "Missing").length, 0);
  const totalFollowUp = students.reduce((sum, s) => sum + s.requirements.filter(r => r.status === "For Follow-up").length, 0);
  const studentsWithIssues = students.filter(s => s.requirements.some(r => r.status === "Missing" || r.status === "For Follow-up")).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", paddingBottom: 100, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Header */}
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>
            Document Deficiency Tracker
          </h1>
          <p style={{ fontSize: 13, color: C.t3, margin: "6px 0 0", lineHeight: 1.5 }}>
            Track enrolled students with missing or incomplete school documents (Form 137, PSA, etc.). Flag, annotate, and update statuses as documents are received.
          </p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { label: "Students with Issues", value: studentsWithIssues, color: C.red, bg: C.redBg, icon: AlertTriangle },
            { label: "Missing Documents", value: totalMissing, color: "#d97706", bg: "#fef3c7", icon: FileText },
            { label: "For Follow-up", value: totalFollowUp, color: "#2563eb", bg: "#eff6ff", icon: ClipboardList },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={22} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.t1, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <Search size={14} color={C.t3} style={{ position: "absolute", left: 12, top: 11 }} />
            <input
              type="text" placeholder="Search name, LRN, or section..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["All", "Incomplete", "Complete"] as const).map(f => (
              <button key={f} onClick={() => setFilterStatus(f)} style={{
                padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: filterStatus === f ? C.m800 : "#fff",
                color: filterStatus === f ? "#fff" : C.t2,
                border: `1px solid ${filterStatus === f ? C.m800 : C.borderMed}`,
              }}>{f}</button>
            ))}
          </div>
        </div>

        {/* Student Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.length === 0 && (
            <div style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 48, textAlign: "center", color: C.t3, fontSize: 14 }}>
              No students found matching your criteria.
            </div>
          )}

          {filtered.map(student => {
            const isExpanded = expandedId === student.id;
            const missingCount = student.requirements.filter(r => r.status === "Missing").length;
            const followUpCount = student.requirements.filter(r => r.status === "For Follow-up").length;
            const hasIssues = missingCount > 0 || followUpCount > 0;

            return (
              <div key={student.id} style={{
                background: "#fff",
                border: `1px solid ${hasIssues ? C.red + "40" : C.borderLight}`,
                borderLeft: `4px solid ${hasIssues ? C.red : C.green}`,
                borderRadius: 12, overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
              }}>
                {/* Card Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : student.id)}
                  style={{ padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 20, background: hasIssues ? C.redBg : C.greenBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {hasIssues ? <AlertTriangle size={18} color={C.red} /> : <CheckCircle2 size={18} color={C.green} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{student.name}</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2, display: "flex", gap: 8 }}>
                        <span>LRN: {student.lrn}</span>
                        <span>•</span>
                        <span>{student.grade} – {student.section}</span>
                        <span>•</span>
                        <span>{student.type}</span>
                        <span>•</span>
                        <span>Enrolled: {student.enrolledDate}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {missingCount > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: C.redBg, padding: "4px 10px", borderRadius: 12, border: `1px solid ${C.red}30` }}>
                        {missingCount} Missing
                      </span>
                    )}
                    {followUpCount > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fef3c7", padding: "4px 10px", borderRadius: 12, border: "1px solid #fcd34d" }}>
                        {followUpCount} Follow-up
                      </span>
                    )}
                    {!hasIssues && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: C.greenBg, padding: "4px 10px", borderRadius: 12 }}>
                        Complete
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} color={C.t3} /> : <ChevronDown size={16} color={C.t3} />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Overall Note */}
                    <div style={{ background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 10, padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                          <MessageSquare size={12} /> Registrar Notes (General)
                        </div>
                        <button
                          onClick={() => setEditingNote({ studentId: student.id, reqId: undefined, text: student.overallNote || "" })}
                          style={{ background: "none", border: "none", cursor: "pointer", color: C.m700, display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}
                        >
                          <Pencil size={11} /> Edit
                        </button>
                      </div>
                      <div style={{ fontSize: 12.5, color: student.overallNote ? C.t1 : C.t3, lineHeight: 1.6, fontStyle: student.overallNote ? "normal" : "italic" }}>
                        {student.overallNote || "No general notes yet. Click Edit to add."}
                      </div>
                    </div>

                    {/* Documents List */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                        Document Requirements ({student.requirements.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {student.requirements.map(req => (
                          <div key={req.id} style={{
                            background: statusBg(req.status),
                            border: `1px solid ${statusColor(req.status)}30`,
                            borderRadius: 8, padding: "12px 16px"
                          }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: req.note ? 6 : 0 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{req.label}</span>
                                  {req.dueDate && (
                                    <span style={{ fontSize: 10, color: C.t3, fontStyle: "italic" }}>Due: {req.dueDate}</span>
                                  )}
                                </div>
                                {req.note && (
                                  <div style={{ fontSize: 11.5, color: C.t2, lineHeight: 1.5, fontStyle: "italic" }}>
                                    📝 {req.note}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                {/* Status Toggle Button */}
                                <button
                                  onClick={() => cycleStatus(student.id, req.id)}
                                  title="Click to cycle status"
                                  style={{
                                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                                    background: "#fff", color: statusColor(req.status),
                                    border: `1px solid ${statusColor(req.status)}`,
                                    transition: "all 0.15s"
                                  }}
                                >
                                  {req.status}
                                </button>
                                <button
                                  onClick={() => setEditingNote({ studentId: student.id, reqId: req.id, text: req.note || "" })}
                                  style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.borderMed}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.t3 }}
                                  title="Add/edit note"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => removeRequirement(student.id, req.id)}
                                  style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.borderMed}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.red }}
                                  title="Remove requirement"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Document Button */}
                      <button
                        onClick={() => setAddDocModal(student.id)}
                        style={{
                          marginTop: 10, padding: "9px 18px", background: "none", border: `1px dashed ${C.borderMed}`,
                          borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.t3, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "center",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.m500; e.currentTarget.style.color = C.m700; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderMed; e.currentTarget.style.color = C.t3; }}
                      >
                        <Plus size={14} /> Add Missing Document
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Note Edit Modal */}
      {editingNote && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 440, maxWidth: "90%", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <MessageSquare size={18} color={C.m700} />
              {editingNote.reqId ? "Edit Document Note" : "Edit General Note"}
            </div>
            <textarea
              autoFocus
              value={editingNote.text}
              onChange={e => setEditingNote({ ...editingNote, text: e.target.value })}
              rows={4}
              placeholder="e.g. Awaiting transmittal from Sta. Rita NHS. Contact: 0917-xxx-xxxx"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setEditingNote(null)} style={{ padding: "9px 16px", background: "none", border: `1px solid ${C.borderMed}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.t2, cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={() => saveNote(editingNote.studentId, editingNote.reqId, editingNote.text)}
                style={{ padding: "9px 18px", background: C.m800, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {addDocModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 440, maxWidth: "90%", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={18} color={C.m700} /> Add Missing Document Requirement
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.t2, display: "block", marginBottom: 6 }}>Document Name *</label>
                <input
                  list="doc-suggestions"
                  type="text"
                  placeholder="e.g. Form 137 (Permanent Record)"
                  value={newDocLabel}
                  onChange={e => setNewDocLabel(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, boxSizing: "border-box" }}
                />
                <datalist id="doc-suggestions">
                  {ALL_POSSIBLE_DOCS.map(d => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.t2, display: "block", marginBottom: 6 }}>Deadline / Due Date (Optional)</label>
                <input
                  type="date"
                  value={newDocDue}
                  onChange={e => setNewDocDue(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => { setAddDocModal(null); setNewDocLabel(""); setNewDocDue(""); }} style={{ padding: "9px 16px", background: "none", border: `1px solid ${C.borderMed}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.t2, cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={() => addDocument(addDocModal)}
                disabled={!newDocLabel.trim()}
                style={{ padding: "9px 18px", background: newDocLabel.trim() ? C.m800 : C.borderMed, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: newDocLabel.trim() ? "pointer" : "not-allowed" }}
              >
                Add Requirement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 36, right: 36, background: "#1f2937", color: "#fff",
          padding: "13px 20px", borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 2000, fontSize: 13, fontWeight: 500
        }}>
          <CheckCircle2 size={18} color={C.green} />
          {toast}
        </div>
      )}
    </div>
  );
}
