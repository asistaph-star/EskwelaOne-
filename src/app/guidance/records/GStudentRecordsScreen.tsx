import React, { useState, useMemo } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import type { StudentRecord, CounselingLog, CounselingLogType } from '../../shared/AppContext';
import {
  Search, Users, Sparkles, AlertTriangle, CheckCircle, Target,
  Clock, BookOpen, ShieldAlert, UserCheck, MessageSquare, CalendarCheck,
  ChevronRight, ArrowLeft, FileText, Mail, Phone
} from 'lucide-react';

/* ── Log type styling ────────────────────────── */
function logTypeStyle(type: CounselingLogType) {
  switch (type) {
    case "Counseling Session":
      return { color: C.blue, bg: C.blueBg, icon: MessageSquare };
    case "Disciplinary Incident":
      return { color: C.red, bg: C.redBg, icon: ShieldAlert };
    case "Academic Review":
      return { color: C.purple, bg: C.purpleBg, icon: BookOpen };
    case "Attendance Check-in":
      return { color: C.amber, bg: C.amberBg, icon: Clock };
    case "Parent Conference":
      return { color: C.teal, bg: C.tealBg, icon: CalendarCheck };
    default:
      return { color: C.t2, bg: C.paper, icon: FileText };
  }
}

function statusStyle(status: string) {
  switch (status) {
    case "Active monitoring":
      return { color: C.blue, bg: C.blueBg };
    case "Needs follow-up":
      return { color: C.amber, bg: C.amberBg };
    case "Case resolved":
      return { color: C.green, bg: C.greenBg };
    case "New case":
      return { color: C.purple, bg: C.purpleBg };
    default:
      return { color: C.t2, bg: C.paper };
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ── Main Component ──────────────────────────── */
export function GStudentRecordsScreen() {
  const { studentRecords, counselingLogs } = useAppContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiTyping, setAiTyping] = useState(false);

  // Filter students by search
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return studentRecords;
    const q = searchTerm.toLowerCase();
    return studentRecords.filter(s =>
      s.fullName.toLowerCase().includes(q) ||
      s.lrn.includes(q) ||
      s.section.toLowerCase().includes(q) ||
      s.grade.toLowerCase().includes(q)
    );
  }, [searchTerm, studentRecords]);

  const selected = studentRecords.find(s => s.id === selectedId) || null;
  const selectedLogs = useMemo(() => {
    if (!selectedId) return [];
    return counselingLogs
      .filter(l => l.studentId === selectedId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedId, counselingLogs]);

  // Simulate AI "thinking" animation when selecting a student
  function handleSelect(id: string) {
    setSelectedId(id);
    setAiTyping(true);
    setTimeout(() => setAiTyping(false), 1200);
  }

  /* ── Student List View ── */
  if (!selected) {
    return (
      <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", paddingBottom: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Header */}
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Student Records</h1>
            <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Search and review student guidance history, behavioral patterns, and AI-generated case insights.</div>
          </div>

          {/* Search Bar */}
          <div style={{ position: "relative" }}>
            <Search size={18} color={C.t3} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
            <input
              id="student-search"
              type="text"
              placeholder="Search by student name, LRN, grade, or section..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: "100%", padding: "14px 14px 14px 46px", fontSize: 14,
                border: `1.5px solid ${C.borderMed}`, borderRadius: 12,
                boxSizing: "border-box", outline: "none", background: "#fff",
                fontFamily: "'Inter', sans-serif", transition: "border-color 0.2s",
              }}
              onFocus={e => e.currentTarget.style.borderColor = C.m600}
              onBlur={e => e.currentTarget.style.borderColor = C.borderMed}
            />
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 60, textAlign: "center" }}>
              <Users size={40} color={C.t3} style={{ opacity: 0.25, marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: C.t2 }}>No students found</div>
              <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Try searching by name, LRN, or section.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{filtered.length} student{filtered.length !== 1 ? "s" : ""} found</div>
              {filtered.map(student => {
                const st = statusStyle(student.currentStatus);
                return (
                  <button
                    key={student.id}
                    id={`student-card-${student.id}`}
                    onClick={() => handleSelect(student.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 16,
                      background: "#fff", border: `1px solid ${C.borderMed}`,
                      borderRadius: 12, padding: "18px 24px",
                      cursor: "pointer", textAlign: "left",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                      transition: "all 0.2s", width: "100%",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = C.m500;
                      e.currentTarget.style.boxShadow = "0 4px 16px rgba(29,78,216,0.08)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = C.borderMed;
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.02)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 24,
                      background: `linear-gradient(135deg, ${C.m700}, ${C.m500})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 800, fontSize: 15, flexShrink: 0,
                      letterSpacing: "0.02em"
                    }}>
                      {student.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{student.fullName}</div>
                      <div style={{ fontSize: 12, color: C.t3, marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span>LRN: {student.lrn}</span>
                        <span>•</span>
                        <span>{student.grade} – {student.section}</span>
                      </div>
                    </div>

                    {/* Status + Arrow */}
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: st.color, background: st.bg,
                      padding: "5px 12px", borderRadius: 12, whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      {student.currentStatus}
                    </span>
                    <ChevronRight size={18} color={C.t3} style={{ flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Student Detail View ── */
  const stStatus = statusStyle(selected.currentStatus);

  return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 40px", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Back Button */}
        <button
          id="back-to-list"
          onClick={() => setSelectedId(null)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: C.m700,
            padding: 0, marginBottom: -8,
          }}
          onMouseEnter={e => e.currentTarget.style.color = C.m500}
          onMouseLeave={e => e.currentTarget.style.color = C.m700}
        >
          <ArrowLeft size={16} /> Back to Student List
        </button>

        {/* Student Info Header */}
        <div style={{
          background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 16,
          padding: "28px 32px", display: "flex", alignItems: "center", gap: 24,
          boxShadow: "0 4px 16px rgba(0,0,0,0.03)"
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32,
            background: `linear-gradient(135deg, ${C.m700}, ${C.m500})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 22, flexShrink: 0
          }}>
            {selected.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif" }}>{selected.fullName}</div>
            <div style={{ fontSize: 13, color: C.t3, marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span><strong style={{ color: C.t2 }}>LRN:</strong> {selected.lrn}</span>
              <span>•</span>
              <span><strong style={{ color: C.t2 }}>Grade & Section:</strong> {selected.grade} – {selected.section}</span>
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: stStatus.color, background: stStatus.bg,
            padding: "6px 16px", borderRadius: 12, flexShrink: 0, letterSpacing: "0.02em"
          }}>
            {selected.currentStatus}
          </span>
        </div>

        {/* Parent / Guardian Contact Info */}
        <div style={{
          background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 14,
          padding: "20px 28px", display: "flex", alignItems: "center", gap: 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)", flexWrap: "wrap",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Users size={18} color={C.amber} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Parent / Guardian</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{selected.parentName}</div>
            <div style={{ display: "flex", gap: 20, marginTop: 6, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.t2 }}>
                <Mail size={13} color={C.t3} />
                <a href={`mailto:${selected.parentEmail}`} style={{ color: C.m700, textDecoration: "none", fontWeight: 600 }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                >{selected.parentEmail}</a>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.t2 }}>
                <Phone size={13} color={C.t3} />
                <span style={{ fontWeight: 600 }}>{selected.parentPhone}</span>
              </div>
            </div>
          </div>
          <button
            id="email-parent-btn"
            onClick={() => {
              const subject = encodeURIComponent(`Guidance Update: ${selected.fullName} (${selected.grade} - ${selected.section})`);
              const body = encodeURIComponent(
                `Dear ${selected.parentName},\n\nThis is Counselor Perez from the Guidance Office of Calulut Integrated School. I am writing to provide you with an update regarding your child, ${selected.fullName} (LRN: ${selected.lrn}).\n\n[Please add your message here]\n\nPlease feel free to contact us if you have any questions or concerns.\n\nRespectfully,\nCounselor Perez\nGuidance Office`
              );
              window.open(`mailto:${selected.parentEmail}?subject=${subject}&body=${body}`, '_blank');
            }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: C.m700, color: "#fff", border: "none",
              padding: "10px 20px", borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              transition: "all 0.2s", flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.m600; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.m700; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <Mail size={14} /> Email Parent
          </button>
        </div>

        {/* AI Case Overview */}
        <div style={{
          background: "#fff",
          border: "1px solid transparent",
          borderRadius: 16,
          padding: 3,
          backgroundImage: `linear-gradient(#fff, #fff), linear-gradient(135deg, ${C.m500}40, ${C.purple}40, ${C.teal}40)`,
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          boxShadow: "0 4px 20px rgba(29,78,216,0.06)",
        }}>
          <div style={{ padding: "24px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.m100}, ${C.purpleBg})`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Sparkles size={16} color={C.m700} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>AI Case Overview</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, background: C.paper, padding: "3px 8px", borderRadius: 6 }}>AI-Generated</div>
            </div>

            {aiTyping ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 0" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: 4,
                      background: C.m500, opacity: 0.4,
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 13, color: C.t3, fontStyle: "italic" }}>Synthesizing case overview...</span>
                <style>{`@keyframes pulse { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }`}</style>
              </div>
            ) : (
              <p style={{
                fontSize: 13.5, lineHeight: 1.75, color: C.t2,
                margin: 0, fontFamily: "'Inter', sans-serif",
              }}>
                {selected.aiSummary}
              </p>
            )}
          </div>
        </div>

        {/* Key Trait & Pattern Highlights */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {/* Primary Concerns */}
          <div style={{
            background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 14,
            padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: C.redBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={14} color={C.red} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Primary Concerns</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selected.primaryConcerns.map((c, i) => (
                <div key={i} style={{ fontSize: 12.5, color: C.t1, fontWeight: 500, display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: 3, background: C.red, flexShrink: 0, marginTop: 6 }} />
                  {c}
                </div>
              ))}
            </div>
          </div>

          {/* Effective Strategies */}
          <div style={{
            background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 14,
            padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Target size={14} color={C.green} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Effective Strategies</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selected.effectiveStrategies.map((s, i) => (
                <div key={i} style={{ fontSize: 12.5, color: C.t1, fontWeight: 500, display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.4 }}>
                  <CheckCircle size={13} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Current Status */}
          <div style={{
            background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 14,
            padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: C.blueBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserCheck size={14} color={C.blue} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Current Status</div>
            </div>
            <div style={{
              fontSize: 16, fontWeight: 800, color: stStatus.color,
              marginBottom: 8, fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              {selected.currentStatus}
            </div>
            <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.5 }}>
              {selectedLogs.length} documented interaction{selectedLogs.length !== 1 ? "s" : ""} on record.
              {selected.currentStatus === "Active monitoring" && " Next review pending."}
              {selected.currentStatus === "Needs follow-up" && " Immediate attention recommended."}
              {selected.currentStatus === "Case resolved" && " No active concerns."}
            </div>
          </div>
        </div>

        {/* Historical Log Timeline */}
        <div style={{
          background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 16,
          overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
        }}>
          <div style={{
            padding: "18px 28px", borderBottom: `1px solid ${C.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif" }}>Historical Log Entries</div>
            <div style={{ fontSize: 12, color: C.t3, fontWeight: 600 }}>{selectedLogs.length} entries • Newest first</div>
          </div>

          <div style={{ padding: "12px 28px 28px" }}>
            {selectedLogs.map((log, idx) => {
              const lt = logTypeStyle(log.type);
              const Icon = lt.icon;
              const isLast = idx === selectedLogs.length - 1;

              return (
                <div key={log.id} style={{ display: "flex", gap: 20, position: "relative" }}>
                  {/* Timeline line */}
                  {!isLast && (
                    <div style={{
                      position: "absolute", left: 17, top: 42, bottom: -12,
                      width: 2, background: C.border,
                    }} />
                  )}

                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 18,
                    background: lt.bg, border: `2px solid ${lt.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, zIndex: 1, marginTop: 16,
                  }}>
                    <Icon size={16} color={lt.color} />
                  </div>

                  {/* Content */}
                  <div style={{
                    flex: 1, padding: "16px 0", borderBottom: !isLast ? `1px solid ${C.border}20` : "none",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{formatDate(log.date)}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: lt.color, background: lt.bg,
                          padding: "3px 10px", borderRadius: 10,
                        }}>
                          {log.type}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: C.t3 }}>by {log.counselor}</span>
                    </div>

                    {/* Summary */}
                    <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.65 }}>{log.summary}</div>

                    {/* Action Taken */}
                    <div style={{
                      fontSize: 12, color: C.t2, lineHeight: 1.6,
                      background: C.paper, padding: "10px 14px", borderRadius: 8,
                      border: `1px solid ${C.border}`,
                    }}>
                      <strong style={{ color: C.t1, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Action Taken:</strong>
                      <div style={{ marginTop: 4 }}>{log.actionTaken}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
