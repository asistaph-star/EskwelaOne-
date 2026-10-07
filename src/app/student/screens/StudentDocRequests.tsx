import { useAppContext } from '../../shared/AppContext';
import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';

import { studentApi } from '../../../api/student.api';
import { useEffect } from 'react';

export function StudentDocRequests({ setTab, currentUser }: any) {
  const [apiDocRequests, setApiDocRequests] = React.useState<any[]>([]);
  const fetchDocRequests = async () => {
    if (currentUser?.id) {
      try {
        const data = await studentApi.getDocumentRequests(currentUser.id);
        setApiDocRequests(data as any[]);
      } catch (err) {
        console.error(err);
      }
    }
  };
  React.useEffect(() => {
    fetchDocRequests();
  }, [currentUser?.id]);
  const [docFilter, setDocFilter] = React.useState('All');
  const [docType, setDocType] = React.useState<string>("");
  const [docPurpose, setDocPurpose] = React.useState("");
  const [docSubmitting, setDocSubmitting] = React.useState(false);
  const [docError, setDocError] = React.useState("");
  const [docSuccess, setDocSuccess] = React.useState("");
  const [expandedDocSteps, setExpandedDocSteps] = React.useState<Record<string, boolean>>({});
  const myRequests = apiDocRequests;
            const totalCount = myRequests.length;
            const submittedCount = myRequests.filter(r => r.current_stage === 1).length;
            const inProgressCount = myRequests.filter(r => r.current_stage >= 2 && r.current_stage < 4 && !r.status.includes("Rejected")).length;
            const completedCount = myRequests.filter(r => r.status === "Completed" || r.status === "Ready for Pickup").length;

            const filteredRequests = docFilter === "all" ? myRequests :
              docFilter === "Submitted" ? myRequests.filter(r => r.current_stage === 1) :
              docFilter === "Teacher Approved" ? myRequests.filter(r => r.current_stage >= 2 && r.current_stage < 4) :
              myRequests.filter(r => r.status === "Completed" || r.status === "Ready for Pickup");

            return (
            <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-8 w-full">
              {/* LEFT SIDEBAR: Request Form */}
              <div style={{ position: "sticky", top: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.borderMed}`, overflow: "hidden", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={16} color={C.m700} /></div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>New Request</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.t3, marginLeft: 36, marginBottom: 20 }}>Request official school documents</div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!docType || !docPurpose) {
                      setDocError("Please select a document type and state the purpose.");
                      return;
                    }
                    setDocSubmitting(true);
                    
                    try {
                      await studentApi.createDocumentRequest({
                        studentId: currentUser?.id || "",
                        studentName: currentUser?.name || "",
                        section: currentUser?.section || "",
                        documentType: docType,
                        purpose: docPurpose,
                      });
                      
                      await fetchDocRequests();
                      
                      setDocType("");
                      setDocPurpose("");
                      setDocError("");
                      setDocSubmitting(false);
                    } catch (err) {
                      console.error(err);
                      setDocError("Failed to submit request.");
                      setDocSubmitting(false);
                    }
                  }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {docError && (
                      <div style={{ padding: "10px 14px", background: C.redBg, border: `1px solid ${C.red}40`, borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <XCircle size={14} /> {docError}
                      </div>
                    )}
                    {docSuccess && (
                      <div style={{ padding: "10px 14px", background: C.greenBg, border: `1px solid ${C.green}40`, borderRadius: 6, color: C.green, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle size={14} /> Document request submitted successfully!
                      </div>
                    )}

                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Document Type</label>
                      <select
                        value={docType}
                        onChange={e => {
                          const val = e.target.value;
                          setDocType(val);
                        }}
                        disabled={docSubmitting}
                        style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", color: C.t1, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                      >
                        <option value="">ΓÇö Select Document ΓÇö</option>
                        <option value="Certificate of Good Moral">Certificate of Good Moral</option>
                        <option value="Certificate of Enrollment">Certificate of Enrollment</option>
                        <option value="Form 137 (Permanent Record)">Form 137 (Permanent Record)</option>
                        <option value="Diploma Copy">Diploma Copy</option>
                        <option value="Honorable Dismissal">Honorable Dismissal</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Purpose of Request</label>
                      <textarea
                        value={docPurpose}
                        onChange={e => setDocPurpose(e.target.value)}
                        disabled={docSubmitting}
                        placeholder="Why do you need this document?"
                        rows={4}
                        maxLength={300}
                        style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif", background: "#f9fafb" }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                        <div style={{ fontSize: 10, color: C.t3 }}>{docPurpose.length} / 300</div>
                      </div>
                    </div>

                    <button type="submit" disabled={docSubmitting} style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      background: docSubmitting ? C.borderMed : C.m700, color: docSubmitting ? C.t3 : "#fff", border: "none",
                      padding: "10px 18px", borderRadius: 6, cursor: docSubmitting ? "not-allowed" : "pointer",
                      fontSize: 12, fontWeight: 700, width: "100%",
                      boxShadow: docSubmitting ? "none" : "0 2px 8px rgba(29,78,216,0.25)",
                      transition: "all 0.15s"
                    }}>
                      {docSubmitting ? "Submitting..." : "Submit Request"}
                    </button>
                  </form>
                </div>
                </div>
              </div>

              {/* RIGHT MAIN: Request Tracker */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Tracker Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Activity size={18} color={C.m700} />
                  <span style={{ fontSize: 18, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Request Tracker</span>
                  <span style={{ fontSize: 11, color: C.t3, marginLeft: 4 }}>{totalCount} total records on file</span>
                </div>

                {/* Stats Cards */}
                <div style={{ display: "flex", gap: 12 }}>
                  {[
                    { label: "Total", count: totalCount, color: C.t1, bg: "#fff", borderColor: C.borderMed },
                    { label: "Submitted", count: submittedCount, color: "#f59e0b", bg: "#fef3c7", borderColor: "#fde68a" },
                    { label: "In Progress", count: inProgressCount, color: "#f59e0b", bg: "#fffbeb", borderColor: "#fef3c7" },
                    { label: "Completed", count: completedCount, color: C.green, bg: C.greenBg, borderColor: `${C.green}30` },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: s.bg, border: `1px solid ${s.borderColor}`, borderRadius: 12, padding: "14px 18px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: "'Fraunces', serif" }}>{s.count}</div>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 700, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Request Cards Grid */}
                {filteredRequests.length === 0 ? (
                  <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 48, textAlign: "center" }}>
                    <FileText size={36} color={C.t3} style={{ opacity: 0.4, marginBottom: 10 }} />
                    <div style={{ fontSize: 13, color: C.t3 }}>No document requests found.</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
                    {filteredRequests.map(req => {
                      const isExpanded = expandedDocSteps[req.id] || false;
                      const doneCount = req.status.includes("Rejected") ? 0 : [1,2,3,4].filter(s => req.current_stage > s || (req.current_stage === 4 && s === 4)).length;
                      const progressPct = Math.round((doneCount / 4) * 100);
                      const isCompletedOrApproved = req.status === "Completed" || req.status === "Ready for Pickup" || req.status.includes("Approved");
                      const isRejected = req.status.includes("Rejected");
                      const statusColor = isCompletedOrApproved ? C.green : isRejected ? C.red : "#f59e0b";
                      const statusBg = isCompletedOrApproved ? C.greenBg : isRejected ? C.redBg : "#fef3c7";
                      const statusBorderColor = isCompletedOrApproved ? `${C.green}40` : isRejected ? `${C.red}40` : "#fde68a";
                      
                      return (
                        <div key={req.id} style={{
                          background: "#fff", border: `1px solid ${C.borderMed}`, 
                          borderLeft: `4px solid ${statusColor}`, 
                          borderRadius: 12, overflow: "hidden",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                          transition: "all 0.2s"
                        }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = `${C.m700}40`; }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = C.borderMed; }}
                        >
                          {/* Card Header */}
                          <div style={{ padding: "16px 18px 14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, lineHeight: 1.3 }}>{req.document_type}</div>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 10, flexShrink: 0,
                                color: statusColor, background: statusBg, border: `1px solid ${statusBorderColor}`,
                                display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                              }}><div style={{ width: 5, height: 5, borderRadius: 3, background: statusColor }} />{req.status}</span>
                            </div>
                            <div style={{ fontSize: 10.5, color: C.t3 }}>Requested {new Date(req.submitted_date).toLocaleDateString()}</div>

                            {/* Progress Bar */}
                            <div style={{ marginTop: 14 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 500, color: C.t3 }}>Progress</span>
                                <span style={{ fontSize: 10, fontWeight: 600, color: C.t2 }}>{doneCount}/4 steps</span>
                              </div>
                              <div style={{ height: 5, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${progressPct}%`, background: statusColor, borderRadius: 3, transition: "width 0.5s ease" }} />
                              </div>
                            </div>
                          </div>

                          {/* Collapsible Steps */}
                          <div style={{ borderTop: `1px solid ${C.border}` }}>
                            <button onClick={() => setExpandedDocSteps(prev => ({ ...prev, [req.id]: !prev[req.id] }))} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                              padding: "10px 18px", background: isExpanded ? "#fff" : "#f9fafb", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: C.t3,
                              transition: "background 0.15s"
                            }}
                              onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                              onMouseLeave={e => e.currentTarget.style.background = isExpanded ? "#fff" : "#f9fafb"}
                            >
                              <span>View steps</span>
                              <ChevronDown size={14} style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                            </button>
                            {isExpanded && (
                              <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column" }}>
                                {req.status.includes("Rejected") ? (
                                  <div style={{ textAlign: "center", color: C.red, fontSize: 12, fontWeight: 600, padding: "12px 0" }}>
                                    <XCircle size={20} style={{ marginBottom: 6 }} />
                                    <div>Request was rejected.</div>
                                    <div style={{ fontSize: 11, color: C.t2, fontWeight: 400, marginTop: 4 }}>
                                      {req.teacherRemarks || req.principalRemarks || "No remarks provided."}
                                    </div>
                                  </div>
                                ) : (
                                  [{stage:1,label:"Submitted",desc:new Date(req.submitted_date).toLocaleDateString()},
                                   {stage:2,label:"Teacher Verified",desc:""},
                                   {stage:3,label:"Principal Approved",desc:""},
                                   {stage:4,label:"Ready for Pickup",desc:""}
                                  ].map((step, i, arr) => {
                                    const isDone = req.current_stage > step.stage || (req.current_stage === 4 && step.stage === 4);
                                    const isActive = req.current_stage === step.stage;
  return (
                                      <div key={i} style={{ display: "flex", gap: 14, position: "relative", paddingBottom: i === arr.length - 1 ? 0 : 16 }}>
                                        {i < arr.length - 1 && (
                                          <div style={{ position: "absolute", left: 10, top: 22, bottom: -2, width: 2, background: isDone ? C.green : C.borderMed, zIndex: 1 }} />
                                        )}
                                        <div style={{
                                          width: 22, height: 22, borderRadius: 11, zIndex: 2, flexShrink: 0, marginTop: 1,
                                          background: isDone ? C.green : isActive ? "#f59e0b" : "#fff",
                                          border: `2px solid ${isDone ? C.green : isActive ? "#f59e0b" : C.borderMed}`,
                                          display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                          {isDone ? <CheckCircle size={11} color="#fff" /> : isActive ? <Clock size={11} color="#fff" /> : <div style={{ width: 5, height: 5, borderRadius: 3, background: C.borderMed }} />}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                          <span style={{ fontSize: 11.5, fontWeight: isDone || isActive ? 700 : 500, color: isDone ? C.green : isActive ? "#f59e0b" : C.t3 }}>{step.label}</span>
                                          {step.desc && <span style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>{step.desc}</span>}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>

                          {/* Purpose Footer */}
                          <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Purpose:</div>
                            <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5 }}>{req.purpose}</div>
                            {req.status === "Completed" && (
                              <button onClick={() => alert("Downloading " + req.document_type)} style={{
                                display: "flex", alignItems: "center", gap: 6, background: C.green, color: "#fff", border: "none",
                                padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, marginTop: 10,
                                transition: "all 0.15s", boxShadow: "0 2px 6px rgba(16,185,129,0.25)"
                              }}
                                onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                              >
                                <FileText size={12} /> View Document
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
  );
}
