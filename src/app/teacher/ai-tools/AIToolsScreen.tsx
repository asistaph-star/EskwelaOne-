import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Sparkles, Activity, AlertTriangle, UserMinus, Lightbulb, FileText, Download, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { DocPanel } from '../../shared/components/DocPanel';
import { Stamp } from '../../shared/components/Stamp';

export function AIToolsScreen() {
  const [reportGenerating, setReportGenerating] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<string | null>(null);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "transparent", position: "relative" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={24} color={C.gold} />
          <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>AI Insights & Reports</div>
        </div>
        <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Automated diagnostic reporting and data-driven pedagogical insights.</div>
      </div>

      {/* Automated Class Diagnostics - Full Width */}
      <div style={{ marginBottom: 24 }}>
        <DocPanel title="Automated Class Diagnostics" icon={Activity}>
          <div style={{ padding: 20, display: "flex", gap: 24, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.t2, marginBottom: 8 }}>Overall Performance Status</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.green, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>On Track</div>
              <div style={{ fontSize: 13, color: C.t3, marginTop: 4, lineHeight: 1.6 }}>The majority of students across your assigned sections are meeting or exceeding the passing threshold. However, specific interventions are needed for isolated cases.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, borderLeft: `1px solid ${C.border}`, paddingLeft: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: C.t3, textTransform: "uppercase", fontWeight: 700 }}>Class Average</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, fontFamily: "'JetBrains Mono',monospace" }}>82.4%</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.t3, textTransform: "uppercase", fontWeight: 700 }}>Passing Threshold</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, fontFamily: "'JetBrains Mono',monospace" }}>75.0%</div>
              </div>
            </div>
          </div>
        </DocPanel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Granular At-Risk Alerts */}
          <DocPanel title="Granular At-Risk Alerts" icon={AlertTriangle}>
            <div style={{ padding: 16 }}>
              {[
                { name: "Espino, Hannah Grace", weak: "Fractions, Ratios", action: "Small group remediation" },
                { name: "Hernandez, Mark Ryan", weak: "Algebraic Expressions", action: "Subject tutoring" },
                { name: "Bondoc, Ramon Jr.", weak: "Reading Comprehension", action: "Peer mentoring" },
              ].map((s, i) => (
                <div key={i} style={{ padding: 12, border: `1px solid ${C.red}40`, background: C.redBg, borderRadius: 6, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{s.name}</div>
                    <Stamp label="Below 75%" color={C.red} bg="#fff" />
                  </div>
                  <div style={{ fontSize: 12, color: C.t2 }}><strong>Weak Learning Areas:</strong> {s.weak}</div>
                  <div style={{ fontSize: 12, color: C.t2, marginTop: 4 }}><strong>Suggested Intervention:</strong> {s.action}</div>
                </div>
              ))}
            </div>
          </DocPanel>

          {/* Behavioral & Attendance Tracking */}
          <DocPanel title="Behavioral & Attendance Tracking" icon={UserMinus}>
            <div style={{ padding: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.m50, borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: C.t3, textTransform: "uppercase" }}>Student Name</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: C.t3, textTransform: "uppercase" }}>Incident</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: C.t3, textTransform: "uppercase" }}>Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: C.t1 }}>Ocampo, Renz</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: C.amber, fontWeight: 600 }}>Frequent Tardiness</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: C.t2 }}>Parent-teacher conference</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: C.t1 }}>Dela Cruz, Juan</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: C.red, fontWeight: 600 }}>Excessive Absences (5 days)</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: C.t2 }}>Guidance referral & home visit</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DocPanel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Pedagogical Action Plans */}
          <DocPanel title="Pedagogical Action Plans" icon={Lightbulb}>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: C.t2, marginBottom: 16, lineHeight: 1.5 }}>Based on recent academic data, AI suggests the following classroom-level strategies. Click a plan to view implementation details.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { title: "Implement Peer Mentoring", target: "8 Rizal (Mathematics)", desc: "Pair high-performers with struggling students." },
                  { title: "Small Group Remediation", target: "9 Einstein (Science)", desc: "Focusing on basic chemical equations." },
                  { title: "Targeted Intervention Sessions", target: "10 Pilot (Filipino)", desc: "Fridays for students with missing requirements." },
                ].map((plan, idx) => (
                  <div key={idx} 
                    onClick={() => setActivePlan(plan.title)}
                    style={{ padding: 12, border: `1px solid ${C.borderMed}`, borderRadius: 6, cursor: "pointer", background: "#fff", transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.goldLight; (e.currentTarget as HTMLElement).style.borderColor = C.gold; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; (e.currentTarget as HTMLElement).style.borderColor = C.borderMed; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.m900 }}>{plan.title}</div>
                      <ChevronRight size={14} color={C.t3} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.m700, marginBottom: 4 }}>{plan.target}</div>
                    <div style={{ fontSize: 12, color: C.t2 }}>{plan.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </DocPanel>

          {/* AI Smart Report Generator */}
          <DocPanel title="AI Smart Report Generator" icon={FileText}>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: C.t2, marginBottom: 16, lineHeight: 1.5 }}>Generate structured analytical reports based on actual system data with a single click.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "Quarterly Class Performance Report",
                  "Attendance Summary",
                  "Grade Analysis",
                  "Student Performance Summary"
                ].map((report, idx) => (
                  <button key={idx} onClick={() => {
                    setReportGenerating(report);
                    setTimeout(() => {
                      setReportGenerating(null);
                      setPreviewReport(report);
                    }, 2000);
                  }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, cursor: "pointer" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.m50; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>
                      {reportGenerating === report ? "Generating..." : report}
                    </span>
                    <Download size={14} color={reportGenerating === report ? C.t3 : C.m700} />
                  </button>
                ))}
              </div>
              {reportGenerating && (
                <div style={{ marginTop: 16, padding: "8px 12px", background: C.goldLight, border: `1px solid ${C.gold}`, borderRadius: 4, color: C.m900, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={12} /> Synthesizing data for {reportGenerating}...
                </div>
              )}
            </div>
          </DocPanel>
        </div>
      </div>

      {/* AI Preview Modal */}
      {previewReport && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(15,8,8,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewReport(null); }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 600, borderRadius: 8, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ background: C.m900, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{previewReport}</div>
              <button onClick={() => setPreviewReport(null)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}><X size={16}/></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <Sparkles size={16} color={C.gold} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>AI-Generated Report Ready</span>
              </div>
              <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, background: C.paper, padding: 16, borderRadius: 4, border: `1px solid ${C.border}` }}>
                {previewReport === "Quarterly Class Performance Report" && (
                  <div>
                    <div style={{ fontWeight: 700, color: C.t1, marginBottom: 8, fontSize: 14 }}>Grade 8 - Rizal (Mathematics) - Q1 Summary</div>
                    <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <li><strong>Class Average:</strong> 82.4% (Pass Rate: 85%)</li>
                      <li><strong>Key Strengths:</strong> Geometry & Measurement (Avg: 88%)</li>
                      <li><strong>Weak Learning Areas:</strong> Fractions & Ratios (3 students scored below 75%)</li>
                      <li><strong>AI Recommendation:</strong> Implement small group remediation for Hannah Grace Espino and Mark Ryan Hernandez focusing on basic fractional operations before Q2.</li>
                    </ul>
                  </div>
                )}
                {previewReport === "Attendance Summary" && (
                  <div>
                    <div style={{ fontWeight: 700, color: C.t1, marginBottom: 8, fontSize: 14 }}>Cross-Section Attendance Report - Q1</div>
                    <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <li><strong>Overall Attendance Rate:</strong> 94.2% (Target: 95%)</li>
                      <li><strong>Chronic Absences:</strong> Juan Dela Cruz (5 days), Miguel Rivera (4 days)</li>
                      <li><strong>Tardiness Alerts:</strong> Renz Ocampo has been frequently tardy for 1st-period classes.</li>
                      <li><strong>AI Recommendation:</strong> Schedule an immediate Parent-Teacher Conference (PTC) and guidance referral for Juan Dela Cruz to address chronic absenteeism.</li>
                    </ul>
                  </div>
                )}
                {previewReport === "Grade Analysis" && (
                  <div>
                    <div style={{ fontWeight: 700, color: C.t1, marginBottom: 8, fontSize: 14 }}>Grade Distribution & Trend Analysis</div>
                    <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <li><strong>90-100 (Outstanding):</strong> 12 students (30%)</li>
                      <li><strong>85-89 (Very Satisfactory):</strong> 15 students (38%)</li>
                      <li><strong>80-84 (Satisfactory):</strong> 8 students (20%)</li>
                      <li><strong>75-79 (Fairly Satisfactory):</strong> 3 students (8%)</li>
                      <li><strong>Below 75 (Did Not Meet Expectations):</strong> 2 students (4%)</li>
                      <li><strong>AI Insight:</strong> Class average increased by 2.4% compared to previous diagnostic tests. High concentration of students in the Very Satisfactory tier indicates effective instructional delivery.</li>
                    </ul>
                  </div>
                )}
                {previewReport === "Student Performance Summary" && (
                  <div>
                    <div style={{ fontWeight: 700, color: C.t1, marginBottom: 8, fontSize: 14 }}>At-Risk & High-Performer Summary</div>
                    <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <li><strong>Hannah Grace Espino:</strong> Math (68.5) - Needs immediate intervention on Quarterly Assessments.</li>
                      <li><strong>Mark Ryan Hernandez:</strong> Math (71.0) - Failing due to missed Performance Tasks.</li>
                      <li><strong>Ramon Bondoc Jr.:</strong> Math (76.8) - Borderline passing, monitor closely in Q2.</li>
                      <li><strong>Trisha Ann Cruz:</strong> Math (93.1) - Excelling, recommended for peer-mentoring program.</li>
                      <li><strong>AI Recommendation:</strong> Pair Trisha Ann Cruz with Hannah Grace Espino for weekly peer-mentoring sessions.</li>
                    </ul>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                <button onClick={() => setPreviewReport(null)} style={{ padding: "8px 16px", borderRadius: 4, background: "transparent", border: `1px solid ${C.borderMed}`, color: C.t2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Close</button>
                <button onClick={() => { alert("Report downloaded successfully!"); setPreviewReport(null); }} style={{ padding: "8px 16px", borderRadius: 4, background: C.m700, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <Download size={14} /> Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* AI Action Plan Modal */}
      {activePlan && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(15,8,8,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setActivePlan(null); }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 600, borderRadius: 8, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ background: C.m900, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Proposed AI Action Plan</div>
              <button onClick={() => setActivePlan(null)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}><X size={16}/></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Lightbulb size={20} color={C.gold} />
                <span style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>{activePlan}</span>
              </div>
              
              <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, background: C.paper, padding: 16, borderRadius: 4, border: `1px solid ${C.border}` }}>
                {activePlan === "Implement Peer Mentoring" && (
                  <div>
                    <div style={{ marginBottom: 12 }}><strong>Rationale:</strong> 8 Rizal has a bimodal grade distribution in Mathematics. Pairing top performers with at-risk students has a 78% historical success rate in improving quarterly scores.</div>
                    <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <li><strong>Target Subject:</strong> Mathematics 8 (Fractions & Ratios)</li>
                      <li><strong>AI Suggested Matches:</strong> 
                        <ul style={{ paddingLeft: 16, marginTop: 4, color: C.t2 }}>
                          <li>Trisha Ann Cruz (93%) mentors Hannah Grace Espino (68%)</li>
                          <li>Joshua Ferrer (90%) mentors Mark Ryan Hernandez (71%)</li>
                        </ul>
                      </li>
                      <li><strong>Schedule:</strong> Tuesdays & Thursdays, 3:00 PM - 3:30 PM</li>
                    </ul>
                  </div>
                )}
                {activePlan === "Small Group Remediation" && (
                  <div>
                    <div style={{ marginBottom: 12 }}><strong>Rationale:</strong> 25% of 9 Einstein scored below the passing threshold on the recent diagnostic test for basic chemical equations. Immediate remediation is required to prevent falling behind in Q2.</div>
                    <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <li><strong>Target Subject:</strong> Science 9 (Chemical Equations)</li>
                      <li><strong>Targeted Students:</strong> Paulo Bautista (69.2%), Kevin Mendoza (77.5%)</li>
                      <li><strong>Material:</strong> Remedial Module 4A (Pre-generated by AI)</li>
                      <li><strong>Schedule:</strong> Wednesdays, 2:00 PM - 3:00 PM</li>
                    </ul>
                  </div>
                )}
                {activePlan === "Targeted Intervention Sessions" && (
                  <div>
                    <div style={{ marginBottom: 12 }}><strong>Rationale:</strong> Several students in 10 Pilot are at risk of failing Q1 due to missing requirements rather than poor test scores. An intervention session can help them catch up.</div>
                    <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <li><strong>Target Subject:</strong> Filipino 10 (Q1 Requirements)</li>
                      <li><strong>Targeted Students:</strong> Miguel Rivera (4 missing tasks), Renz Adrian Ocampo (2 missing tasks)</li>
                      <li><strong>Objective:</strong> Guided completion of Performance Task 2 and Quiz 3 makeup.</li>
                      <li><strong>Schedule:</strong> Fridays, 1:00 PM - 2:00 PM</li>
                    </ul>
                  </div>
                )}
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
                <button onClick={() => setActivePlan(null)} style={{ padding: "8px 16px", borderRadius: 4, background: "transparent", border: `1px solid ${C.borderMed}`, color: C.t2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Dismiss Plan</button>
                <button onClick={() => { alert("Action plan added to your Calendar and notifications sent to relevant students!"); setActivePlan(null); }} style={{ padding: "8px 16px", borderRadius: 4, background: C.m700, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={14} /> Approve & Implement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── SCREEN 5 - Professional Development ───────────────────── */