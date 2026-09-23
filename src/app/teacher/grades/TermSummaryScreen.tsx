import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { ChevronDown, Download, FileText, ArrowRight, BarChart2 } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { academicApi, TeacherAssignment, StudentEnrollment } from '../../../api/academic.api';
import { gradebookApi, Gradebook, GradebookColumn } from '../../../api/gradebook.api';

export function TermSummaryScreen() {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [sectionId, setSectionId] = useState<string>("");
  const [roster, setRoster] = useState<StudentEnrollment[]>([]);
  const [gradebooks, setGradebooks] = useState<Record<string, Gradebook>>({});
  
  const activeTerms = ["T1", "T2", "T3", "T4"];

  useEffect(() => {
    academicApi.getMyAssignments('AY2025').then(res => {
      if (res && res.length > 0) {
        setAssignments(res);
        setSectionId(res[0].section_id);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!sectionId) return;
    academicApi.getSectionRoster(sectionId).then(res => {
      if (res) {
        setRoster(res);
      }
    }).catch(console.error);

    const assignment = assignments.find(a => a.section_id === sectionId);
    if (assignment && assignment.gradebooks) {
      assignment.gradebooks.forEach((gb: any) => {
        gradebookApi.getGradebook(gb.id).then(res => {
          if (res) {
            setGradebooks(prev => ({ ...prev, [gb.term.key]: res }));
          }
        }).catch(console.error);
      });
    }
  }, [sectionId, assignments]);

  const psFor = (studentEnrollmentId: string, gb: Gradebook | undefined, type: string) => {
    if (!gb) return 0;
    const items = gb.columns?.filter(c => c.type === type) || [];
    let sumS = 0;
    let sumM = 0;
    items.forEach(it => {
      const e = gb.entries?.find(e => e.student_enrollment_id === studentEnrollmentId && e.column_id === it.id && !e.is_superseded);
      if (e) sumS += e.score;
      sumM += it.max_score;
    });
    return sumM > 0 ? Math.round((sumS / sumM) * 1000) / 10 : 0;
  };

  const termGradeFor = (studentEnrollmentId: string, termKey: string) => {
    const gb = gradebooks[termKey];
    if (!gb) return 0;
    const weights = { ww: 25, pt: 50, qa: 25 }; // Mock weights
    const wwPS = psFor(studentEnrollmentId, gb, 'WW');
    const ptPS = psFor(studentEnrollmentId, gb, 'PT');
    
    let qaPS = 0;
    const qaItem = gb.columns?.find(c => c.type === 'QA');
    if (qaItem) {
      const e = gb.entries?.find(e => e.student_enrollment_id === studentEnrollmentId && e.column_id === qaItem.id && !e.is_superseded);
      if (e) qaPS = Math.round((e.score / qaItem.max_score) * 1000) / 10;
    }
    
    return Math.round((wwPS * (weights.ww / 100) + ptPS * (weights.pt / 100) + qaPS * (weights.qa / 100)) * 10) / 10;
  };

  function getTermAccent(t: string) { return C.m700; }

  const finals = roster.map(s => {
    const grades = activeTerms.map(t => termGradeFor(s.id, t));
    if (grades.some(g => g <= 0)) return 0;
    const sum = grades.reduce((a, b) => a + b, 0);
    return Math.round((sum / grades.length) * 10) / 10;
  }).filter(g => g > 0);
  
  const passing = finals.filter(g => g >= 75).length;
  const failing = finals.filter(g => g > 0 && g < 75).length;
  const classAvg = finals.filter(g => g > 0).length
    ? (finals.filter(g => g > 0).reduce((a, b) => a + b, 0) / finals.filter(g => g > 0).length).toFixed(1)
    : "-";

  const selectedAssignment = assignments.find(a => a.section_id === sectionId);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "transparent" }}>
      <div style={{ background: "#fff", borderBottom: `1px solid ${C.borderMed}`, padding: "9px 18px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, color: C.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em" }}>Section</span>
          <div style={{ position: "relative" }}>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)}
              style={{ border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "4px 22px 4px 7px", fontSize: 12, color: C.t1, background: "#fff", outline: "none", appearance: "none", cursor: "pointer" }}>
              {assignments.map(a => (
                <option key={a.section_id} value={a.section_id}>Gr. {a.section.grade_level} {a.section.name}</option>
              ))}
            </select>
            <ChevronDown size={11} style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", color: C.t3, pointerEvents: "none" }} />
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: C.m700, color: "#fff", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            <Download size={13} /> Export Excel
          </button>
        </div>
      </div>

      <div style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}`, padding: "7px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <FileText size={13} color={C.m700} />
        <span style={{ fontSize: 11, color: C.t2 }}>
          Read-only summary for <strong>Form 138 (Report Card)</strong>. To edit scores, go to <strong>Gradebook</strong>.
        </span>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%", fontSize: 12 }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 200 }} />
            {activeTerms.map(t => <col key={t} style={{ width: 100 }} />)}
            <col style={{ width: 120 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={{ border: `1px solid rgba(255,255,255,0.15)`, background: C.m900, color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: 700, padding: "6px 2px", textAlign: "center", position: "sticky", top: 0, left: 0, zIndex: 6 }}>#</th>
              <th rowSpan={2} style={{ border: `1px solid rgba(255,255,255,0.15)`, background: C.m800, color: "#fff", fontSize: 11, fontWeight: 700, padding: "7px 10px", textAlign: "left", position: "sticky", top: 0, left: 36, zIndex: 6 }}>STUDENT NAME</th>
              {activeTerms.map(t => (
                <th key={t} style={{ border: `1px solid rgba(255,255,255,0.15)`, background: getTermAccent(t), color: "#fff", fontSize: 11, fontWeight: 700, padding: "7px 4px", textAlign: "center", position: "sticky", top: 0, zIndex: 4 }}>
                  {t}
                </th>
              ))}
              <th style={{ border: `1px solid rgba(255,255,255,0.15)`, background: C.gold, color: C.m900, fontSize: 11, fontWeight: 800, padding: "7px 4px", textAlign: "center", position: "sticky", top: 0, zIndex: 4 }}>FINAL AVG</th>
              <th style={{ border: `1px solid rgba(255,255,255,0.15)`, background: C.m700, color: "#fff", fontSize: 10, fontWeight: 700, padding: "7px 4px", textAlign: "center", position: "sticky", top: 0, zIndex: 4 }}>STATUS</th>
            </tr>
            <tr>
              {activeTerms.map(t => (
                <th key={t} style={{ border: `0.5px solid ${C.border}`, background: C.m50, padding: "4px 4px", textAlign: "center", position: "sticky", top: 34, zIndex: 3 }}>
                  <span style={{ fontSize: 9, color: C.t3, fontWeight: 600 }}>Term Grade</span>
                </th>
              ))}
              <th style={{ border: `0.5px solid ${C.border}`, background: C.goldLight, padding: "4px", textAlign: "center", position: "sticky", top: 34, zIndex: 3 }}>
                <span style={{ fontSize: 9, color: C.gold, fontWeight: 600 }}>Avg of 4</span>
              </th>
              <th style={{ border: `0.5px solid ${C.border}`, background: C.m50, padding: "4px", textAlign: "center", position: "sticky", top: 34, zIndex: 3 }} />
            </tr>
          </thead>
          <tbody>
            {roster.map((student, idx) => {
              const grades = activeTerms.map(t => termGradeFor(student.id, t));
              const fa = grades.some(g => g <= 0) ? 0 : grades.reduce((a, b) => a + b, 0) / grades.length;
              const passed = fa >= 75;
              const rowBg = idx % 2 === 0 ? "#fff" : C.paper;

              function gradeCell(g: number) {
                const fail = g > 0 && g < 75, high = g >= 90;
                return (
                  <td style={{ border: `0.5px solid ${C.border}`, padding: "9px 6px", textAlign: "center", background: fail ? C.redBg : rowBg }}>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: g <= 0 ? "#ccc" : fail ? C.red : high ? C.green : C.t1 }}>
                      {g > 0 ? g.toFixed(1) : "-"}
                    </span>
                  </td>
                );
              }

              return (
                <tr key={student.id} style={{ background: rowBg }}>
                  <td style={{ border: `0.5px solid ${C.border}`, padding: "9px 3px", textAlign: "center", fontSize: 10, color: C.t3, background: "#F8F5F4", position: "sticky", left: 0, zIndex: 1 }}>{idx + 1}</td>
                  <td style={{ border: `0.5px solid ${C.border}`, padding: "9px 10px", fontSize: 12, fontWeight: 600, color: C.t1, background: "#fff", position: "sticky", left: 36, zIndex: 1, borderRight: `2px solid ${C.borderMed}`, whiteSpace: "nowrap" }}>
                    {student.student.user.last_name}, {student.student.user.first_name}
                  </td>
                  {activeTerms.map((t, i) => <React.Fragment key={t}>{gradeCell(grades[i])}</React.Fragment>)}
                  <td style={{ border: `1px solid ${C.borderMed}`, padding: "9px 6px", textAlign: "center", background: fa > 0 && fa < 75 ? C.redBg : C.goldLight }}>
                    <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: fa <= 0 ? "#ccc" : fa < 75 ? C.red : fa >= 90 ? C.green : C.t1 }}>
                      {fa > 0 ? fa.toFixed(1) : "-"}
                    </span>
                  </td>
                  <td style={{ border: `0.5px solid ${C.border}`, padding: "9px 6px", textAlign: "center", background: rowBg }}>
                    {fa > 0 && <Stamp label={passed ? "PASSED" : "FAILED"} color={passed ? "#fff" : C.red} bg={passed ? C.green : C.redBg} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ background: C.m800, borderTop: `2px solid ${C.m700}`, padding: "8px 18px", display: "flex", alignItems: "center", gap: 24, flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase" }}>Final Average Summary</span>
        {([["Students", roster.length, "rgba(255,255,255,0.7)"], ["Passed", passing, C.gold], ["Failed", failing, "#FCA5A5"], ["Class avg", classAvg, "#fff"]] as [string, number | string, string][])
          .map(([l, v, col]) => (
            <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>{l}</span>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: col }}>{v}</span>
            </div>
          ))}
        <div style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
          <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{selectedAssignment?.subject.name || "Subject"} · Gr. {selectedAssignment?.section.grade_level} {selectedAssignment?.section.name} · SY 2025–2026</span>
        </div>
      </div>
    </div>
  );
}
