import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { TermKey, TermData, GbItem, GbGrades, ExamItem } from '../../shared/types';
import { ChevronDown, FileText, ChevronLeft, Plus, Download, Save, Trash2, Edit2, Settings } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { useMyClasses } from '../shared/useMyClasses';
import {
  calculateStudentGrade,
  calculateAnnualFinalGrade,
  getPerformanceDescriptor,
  transmuteInitialGrade,
  StudentCalculationOutput
} from '../../shared/utils/gradingEngineFrontend';

export function GradebookFullScreen({ classId, onBack, hideBack = false }: { classId?: string; onBack: () => void; hideBack?: boolean }) {
  /* ── per-term data (each term has its own activities + scores) ── */
  const [ROSTER, setRoster] = useState<any[]>([]);
  const [allData, setAllData] = useState<Record<TermKey, TermData>>({} as any);
  const [term, setTerm] = useState<TermKey>("T1");
  const [view, setView] = useState<"ledger" | "summary">("ledger");
  const [tCount, setTCount] = useState<number>(3);
  const activeTerms = Array.from({ length: tCount }, (_, i) => `T${i + 1}`);
  const [isLoading, setIsLoading] = useState(true);
  const { myClasses, isLoading: isLoadingClasses } = useMyClasses();

  const cls = myClasses.find(c => c.id === classId) ?? myClasses[0];
  const section = cls ? `Gr. ${cls.grade} ${cls.section}` : '';
  const isTechnical = (cls?.subject && /tle|tech|tve|vocational|ict/i.test(cls.subject)) || false;
  const subjectType: 'CORE' | 'TECHNICAL' = isTechnical ? 'TECHNICAL' : 'CORE';

  /* ── verified weights from Calulut Integrated School workbook ── */
  const defaultWeights = isTechnical ? { ww: 20, pt: 60, qa: 20 } : { ww: 20, pt: 50, qa: 30 };
  const [weights, setWeights] = useState(defaultWeights);

  React.useEffect(() => {
    if (!classId) return;
    setIsLoading(true);
    import('../../../api/client').then(({ apiClient }) => {
      apiClient.get(`/gradebooks/ledger?classId=${classId}`)
        .then((res: any) => {
          if (res) {
            setAllData(res.terms || {});
            setRoster(res.roster || []);
            if (res.terms?.[term]?.customWeights) {
              setWeights(res.terms[term].customWeights);
            } else if (res.weights) {
              setWeights(res.weights);
            }
            const ts = Object.keys(res.terms || {}).filter(k => k.startsWith('T')).map(k => parseInt(k.substring(1))).filter(n => !isNaN(n));
            if (ts.length > 0) setTCount(Math.max(...ts, 3));
          }
        })
        .finally(() => setIsLoading(false));
    });
  }, [classId]);

  function getTAccent(t: string) {
    return C.m700;
  }

  /* ── edit states ── */
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [editMaxId, setEditMaxId] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [isEditingExamCategoryWeight, setIsEditingExamCategoryWeight] = useState(false);

  /* ── convenience accessors for the active term ── */
  const qd = allData[term] || { wwItems: [], ptItems: [], st1Max: 25, st2Max: 25, teMax: 50, qaMax: 50, grades: {} };
  const wwItems = qd.wwItems || [];
  const ptItems = qd.ptItems || [];
  const st1Max = qd.st1Max ?? 25;
  const st2Max = qd.st2Max ?? 25;
  const teMax = qd.teMax ?? (qd.qaMax ?? 50);
  const grades = qd.grades || {};

  const defaultExamItems: ExamItem[] = [
    { id: 'st1', label: 'ST 1', max: st1Max, weight: 30 },
    { id: 'st2', label: 'ST 2', max: st2Max, weight: 30 },
    { id: 'te',  label: 'TE',   max: teMax,  weight: 40 }
  ];
  const examItems: ExamItem[] = (qd.examItems && qd.examItems.length > 0) ? qd.examItems : defaultExamItems;

  const wwTotalMax = wwItems.reduce((s, it) => s + it.max, 0);
  const ptTotalMax = ptItems.reduce((s, it) => s + it.max, 0);

  /* ── authoritative student calculation per term ── */
  function studentCalcFor(sid: number | string, d: TermData): StudentCalculationOutput | null {
    if (!d) return null;
    const sg = d.grades?.[sid] ?? d.grades?.[sid.toString()] ?? {};
    const dExams = d.examItems && d.examItems.length > 0 ? d.examItems : [
      { id: 'st1', label: 'ST 1', max: d.st1Max ?? 25, weight: 30 },
      { id: 'st2', label: 'ST 2', max: d.st2Max ?? 25, weight: 30 },
      { id: 'te',  label: 'TE',   max: d.teMax ?? (d.qaMax ?? 50), weight: 40 }
    ];
    return calculateStudentGrade(
      sg,
      d.wwItems || [],
      d.ptItems || [],
      d.st1Max ?? 25,
      d.st2Max ?? 25,
      d.teMax ?? (d.qaMax ?? 50),
      subjectType,
      dExams,
      d.customWeights || weights
    );
  }

  function tGradeFor(sid: number | string, d: TermData): number {
    if (!d) return 0;
    const sidKey = sid.toString();
    if (d.computed && d.computed[sidKey]?.termGrade) {
      return d.computed[sidKey].termGrade!;
    }
    const calc = studentCalcFor(sid, d);
    if (!calc) return 0;
    return calc.termGrade ?? (calc.initialGrade !== null ? (transmuteInitialGrade(calc.initialGrade) ?? 0) : 0);
  }

  /* active term shortcuts */
  const getCalc = (sid: number | string) => studentCalcFor(sid, qd);
  const getQGrade = (sid: number | string) => tGradeFor(sid, qd);

  /* ── update cell value (writes into active term) ── */
  function setCell(sid: number | string, iid: string, val: string) {
    const cleanVal = val.replace(/[^\d.]/g, "");
    setAllData(prev => {
      const currentTerm = prev[term] || { wwItems: [], ptItems: [], st1Max: 25, st2Max: 25, teMax: 50, qaMax: 50, grades: {} };
      const currentStudentGrades = currentTerm.grades[sid] ?? {};
      const updatedScores = { ...currentStudentGrades, [iid]: cleanVal };
      if (iid === 'te') {
        updatedScores.qa = cleanVal;
      }
      return {
        ...prev,
        [term]: {
          ...currentTerm,
          grades: {
            ...currentTerm.grades,
            [sid]: updatedScores
          }
        }
      };
    });
  }

  /* ── add activity columns (adds to active term only) ── */
  function addWW() {
    const n = wwItems.length + 1;
    setAllData(prev => ({
      ...prev,
      [term]: {
        ...(prev[term] || { wwItems: [], ptItems: [], grades: {} }),
        wwItems: [...(prev[term]?.wwItems || []), { id: `ww${n}`, label: `WW ${n}`, max: 100 }]
      }
    }));
  }

  function deleteWW(id: string) {
    setAllData(prev => ({
      ...prev,
      [term]: {
        ...prev[term],
        wwItems: prev[term].wwItems.filter(x => x.id !== id),
        deletedColumnIds: [...(prev[term].deletedColumnIds || []), id]
      }
    }));
  }

  function addPT() {
    const n = ptItems.length + 1;
    setAllData(prev => ({
      ...prev,
      [term]: {
        ...(prev[term] || { wwItems: [], ptItems: [], grades: {} }),
        ptItems: [...(prev[term]?.ptItems || []), { id: `pt${n}`, label: `PT ${n}`, max: 100 }]
      }
    }));
  }

  function deletePT(id: string) {
    setAllData(prev => ({
      ...prev,
      [term]: {
        ...prev[term],
        ptItems: prev[term].ptItems.filter(x => x.id !== id),
        deletedColumnIds: [...(prev[term].deletedColumnIds || []), id]
      }
    }));
  }

  function updateWWMax(id: string, max: number) {
    setAllData(prev => ({
      ...prev,
      [term]: {
        ...prev[term],
        wwItems: prev[term].wwItems.map(x => x.id === id ? { ...x, max } : x)
      }
    }));
  }

  function updatePTMax(id: string, max: number) {
    setAllData(prev => ({
      ...prev,
      [term]: {
        ...prev[term],
        ptItems: prev[term].ptItems.map(x => x.id === id ? { ...x, max } : x)
      }
    }));
  }

  /* ── Dynamic Examination column management (Add, Delete, Rename, Weight, Max) ── */
  function addExam() {
    const currentExams = qd.examItems && qd.examItems.length > 0 ? qd.examItems : defaultExamItems;
    const n = currentExams.length + 1;
    const newExam: ExamItem = {
      id: `exam_${Date.now()}`,
      label: `ST ${n - 1}`,
      max: 25,
      weight: 20
    };
    setAllData(prev => {
      const curTerm = prev[term] || { wwItems: [], ptItems: [], grades: {} };
      const curExams = curTerm.examItems && curTerm.examItems.length > 0 ? curTerm.examItems : defaultExamItems;
      return {
        ...prev,
        [term]: {
          ...curTerm,
          examItems: [...curExams, newExam]
        }
      };
    });
  }

  function deleteExam(id: string) {
    setAllData(prev => {
      const curTerm = prev[term] || { wwItems: [], ptItems: [], grades: {} };
      const curExams = curTerm.examItems && curTerm.examItems.length > 0 ? curTerm.examItems : defaultExamItems;
      return {
        ...prev,
        [term]: {
          ...curTerm,
          examItems: curExams.filter(x => x.id !== id),
          deletedColumnIds: [...(curTerm.deletedColumnIds || []), id]
        }
      };
    });
  }

  function updateExamLabel(id: string, label: string) {
    const trimmed = label.trim() || 'Exam';
    setAllData(prev => {
      const curTerm = prev[term] || { wwItems: [], ptItems: [], grades: {} };
      const curExams = curTerm.examItems && curTerm.examItems.length > 0 ? curTerm.examItems : defaultExamItems;
      return {
        ...prev,
        [term]: {
          ...curTerm,
          examItems: curExams.map(x => x.id === id ? { ...x, label: trimmed } : x)
        }
      };
    });
    setEditingLabelId(null);
  }

  function updateExamMax(id: string, max: number) {
    const safeMax = Math.max(1, max);
    setAllData(prev => {
      const curTerm = prev[term] || { wwItems: [], ptItems: [], grades: {} };
      const curExams = curTerm.examItems && curTerm.examItems.length > 0 ? curTerm.examItems : defaultExamItems;
      return {
        ...prev,
        [term]: {
          ...curTerm,
          examItems: curExams.map(x => x.id === id ? { ...x, max: safeMax } : x),
          ...(id === 'st1' ? { st1Max: safeMax } : {}),
          ...(id === 'st2' ? { st2Max: safeMax } : {}),
          ...(id === 'te'  ? { teMax: safeMax, qaMax: safeMax } : {})
        }
      };
    });
  }

  function updateExamWeight(id: string, weight: number) {
    const safeWeight = Math.max(0, Math.min(100, weight));
    setAllData(prev => {
      const curTerm = prev[term] || { wwItems: [], ptItems: [], grades: {} };
      const curExams = curTerm.examItems && curTerm.examItems.length > 0 ? curTerm.examItems : defaultExamItems;
      return {
        ...prev,
        [term]: {
          ...curTerm,
          examItems: curExams.map(x => x.id === id ? { ...x, weight: safeWeight } : x)
        }
      };
    });
    setEditingWeightId(null);
  }

  function updateCategoryWeights(updater: (prev: { ww: number; pt: number; qa: number }) => { ww: number; pt: number; qa: number }) {
    setWeights(prev => {
      const updated = updater(prev);
      setAllData(all => ({
        ...all,
        [term]: {
          ...(all[term] || { wwItems: [], ptItems: [], grades: {} }),
          customWeights: updated
        }
      }));
      return updated;
    });
  }

  /* ── summary stats ── */
  const allGrades = ROSTER.map(s => getQGrade(s.id)).filter(g => g > 0);
  const passing = allGrades.filter(g => g >= 75).length;
  const failing = allGrades.filter(g => g < 75).length;
  const classAvg = allGrades.length ? Math.round(allGrades.reduce((a, b) => a + b, 0) / allGrades.length).toString() : "-";
  const weightsOk = weights.ww + weights.pt + weights.qa === 100;

  /* ── column widths ── */
  const W = {
    num: 36,
    name: 188,
    act: 50,
    add: 32,
    stat: 52,
    ps: 52,
    ws: 52,
    exam: 52,
    ig: 60,
    tg: 64,
    desc: 96
  };

  /* ── editable data cell ── */
  function Cell(sid: number | string, iid: string, max: number) {
    const key = `${sid}:${iid}`;
    const val = grades[sid]?.[iid] ?? "";
    const isAct = activeCell === key;
    const num = parseFloat(val);
    const pct = (!isNaN(num) && max > 0 && val !== "") ? num / max * 100 : null;
    const fail = pct !== null && pct < 75;
    const over = !isNaN(num) && num > max && val !== "";
    return (
      <td key={iid}
        style={{
          width: W.act, minWidth: W.act, maxWidth: W.act, border: `0.5px solid ${C.border}`, padding: 0,
          background: isAct ? "#EFF6FF" : fail ? C.redBg : "#fff",
          outline: isAct ? `2px solid #3B82F6` : "none", outlineOffset: -2, cursor: "cell"
        }}
        onClick={() => { if (!isAct) setActiveCell(key); }}>
        {isAct
          ? <input autoFocus value={val}
              onChange={e => setCell(sid, iid, e.target.value)}
              onBlur={() => setActiveCell(null)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setActiveCell(null); }}
              style={{
                width: "100%", height: "100%", minHeight: 30, border: "none", outline: "none",
                textAlign: "center", fontSize: 12, fontFamily: "'JetBrains Mono',monospace",
                background: "transparent", padding: "4px", boxSizing: "border-box"
              }} />
          : <div style={{
              padding: "7px 3px", textAlign: "center", fontSize: 12,
              fontFamily: "'JetBrains Mono',monospace",
              color: over ? C.amber : fail ? C.red : C.t1,
              minHeight: 30, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {val}
            </div>}
      </td>
    );
  }

  /* ── read-only computed cell ── */
  function ROCell(val: number | string | null | undefined, opts: { red?: boolean; bold?: boolean; bg?: string; color?: string; decimals?: number } = {}) {
    if (val === null || val === undefined || val === "") {
      return (
        <td style={{
          border: `0.5px solid ${C.border}`, padding: "7px 4px", textAlign: "center",
          fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: C.t3, background: opts.bg || "transparent"
        }}>
          -
        </td>
      );
    }
    const num = typeof val === "number" ? val : parseFloat(val as string);
    const isRed = opts.red && !isNaN(num) && num < 75 && num > 0;
    const formatted = typeof val === "number"
      ? (val > 0 ? (opts.decimals !== undefined ? val.toFixed(opts.decimals) : val.toFixed(1)) : "-")
      : val;
    return (
      <td style={{
        border: `0.5px solid ${C.border}`, padding: "7px 4px", textAlign: "center",
        fontSize: 12, fontFamily: "'JetBrains Mono',monospace",
        fontWeight: opts.bold ? 700 : 400,
        color: opts.color || (isRed ? C.red : C.t2), background: opts.bg || "transparent",
        whiteSpace: "nowrap"
      }}>
        {formatted}
      </td>
    );
  }

  /* ── editable max score in header ── */
  function MaxInput(item: GbItem, updateMax: (id: string, max: number) => void) {
    return editMaxId === item.id
      ? <input autoFocus type="number" defaultValue={item.max}
          onBlur={e => { updateMax(item.id, parseInt(e.target.value) || item.max); setEditMaxId(null); }}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={{
            width: 32, textAlign: "center", border: `1px solid rgba(255,255,255,0.5)`, borderRadius: 2,
            fontSize: 9, padding: "1px 3px", fontFamily: "'JetBrains Mono',monospace",
            background: "rgba(255,255,255,0.15)", color: "#fff", outline: "none"
          }} />
      : <span onClick={() => setEditMaxId(item.id)}
          style={{
            fontSize: 9, color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono',monospace",
            cursor: "pointer", textDecoration: "underline dotted"
          }}
          title="Click to change max score">/{item.max}</span>;
  }

  function ExamMaxInput(id: string, currentMax: number, updateMax: (max: number) => void) {
    return editMaxId === id
      ? <input autoFocus type="number" defaultValue={currentMax}
          onBlur={e => { updateMax(parseInt(e.target.value) || currentMax); setEditMaxId(null); }}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={{
            width: 32, textAlign: "center", border: `1px solid rgba(255,255,255,0.5)`, borderRadius: 2,
            fontSize: 9, padding: "1px 3px", fontFamily: "'JetBrains Mono',monospace",
            background: "rgba(255,255,255,0.15)", color: "#fff", outline: "none"
          }} />
      : <span onClick={() => setEditMaxId(id)}
          style={{
            fontSize: 9, color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono',monospace",
            cursor: "pointer", textDecoration: "underline dotted"
          }}
          title="Click to change max score">/{currentMax}</span>;
  }

  /* ── descriptor badge ── */
  function getDescriptorBadge(desc: string | null) {
    if (!desc) return <span style={{ color: C.t3, fontSize: 10 }}>-</span>;
    const colors: Record<string, { bg: string; color: string; border: string }> = {
      Advancing: { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
      Benchmarking: { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
      Connecting: { bg: "#fef3c7", color: "#b45309", border: "#fde68a" },
      Developing: { bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" },
      Emerging: { bg: "#fee2e2", color: "#b91c1c", border: "#fecaca" },
    };
    const s = colors[desc] || { bg: C.m50, color: C.t1, border: C.border };
    return (
      <span style={{
        display: "inline-block",
        fontSize: 9,
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 4,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap"
      }}>
        {desc}
      </span>
    );
  }

  /* ── header th for a sub-column ── */
  const subTH = (children: React.ReactNode, bg: string, color = "#fff", top = 34, key?: string) => (
    <th key={key} style={{
      border: `0.5px solid rgba(255,255,255,0.15)`, background: bg, padding: "5px 3px",
      textAlign: "center", position: "sticky", top, zIndex: 3, color, verticalAlign: "middle"
    }}>
      {children}
    </th>
  );

  const activeAccent = getTAccent(term);

  if (isLoadingClasses || !cls) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.t3, fontSize: 14 }}>
        {isLoadingClasses ? "Loading metadata..." : "Classroom not found"}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "transparent" }}>
      {isLoading && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ padding: "12px 24px", background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, fontSize: 14, fontWeight: 600, color: C.m700, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
            Loading Gradebook Data...
          </div>
        </div>
      )}

      {/* ── Controls bar ── */}
      <div style={{
        background: "#fff", borderBottom: `1px solid ${C.borderMed}`, padding: "9px 18px",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap"
      }}>

        {!hideBack && <>
          <button onClick={onBack} style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 11,
            fontWeight: 600, color: C.m700, background: C.m100, border: `1px solid rgba(139,30,30,0.2)`,
            padding: "5px 10px", borderRadius: 4, cursor: "pointer"
          }}>
            <ChevronLeft size={12} /> Back
          </button>
          <div style={{ width: 1, height: 22, background: C.border }} />
        </>}

        {/* View toggle: Grade entry / Termly summary */}
        <div style={{ display: "flex", gap: 1, background: C.m50, borderRadius: 5, padding: 2, border: `1px solid ${C.borderMed}` }}>
          {(["ledger", "summary"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: "4px 12px", borderRadius: 3, border: "none", cursor: "pointer", fontSize: 11,
                fontWeight: view === v ? 700 : 400,
                background: view === v ? C.m700 : "transparent",
                color: view === v ? "#fff" : C.t2,
                transition: "all 0.12s"
              }}>
              {v === "ledger" ? "Grade entry" : "Termly summary"}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 22, background: C.border }} />

        {/* Section */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, color: C.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em" }}>Section</span>
          <div style={{ padding: "4px 12px", fontSize: 12, fontWeight: 700, color: C.m700, background: C.m50, borderRadius: 4, border: `1px solid ${C.m100}` }}>
            Grade {cls.grade} - {cls.section}
          </div>
        </div>

        {/* Subject */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, color: C.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em" }}>Subject</span>
          <div style={{ padding: "4px 12px", fontSize: 12, fontWeight: 700, color: C.m700, background: C.m50, borderRadius: 4, border: `1px solid ${C.m100}` }}>
            {cls.subject} {isTechnical ? "(Technical)" : "(Core)"}
          </div>
        </div>

        {/* Term tabs */}
        <div style={{ display: "flex", gap: 2 }}>
          {activeTerms.map(q => {
            const isAct = term === q;
            const acc = getTAccent(q);
            return (
              <button key={q} onClick={() => setTerm(q as any)}
                style={{
                  padding: "4px 13px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 700,
                  transition: "all 0.12s",
                  border: isAct ? `1.5px solid ${acc}` : `1px solid ${C.borderMed}`,
                  background: isAct ? acc : "#fff",
                  color: isAct ? "#fff" : C.t2
                }}>
                {q}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 22, background: C.border, flexShrink: 0 }} />

        {/* Weight inputs - authoritative weights */}
        {view === "ledger" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 9, color: C.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em" }}>Weights:</span>
            {([["WW", weights.ww, (v: number) => updateCategoryWeights(p => ({ ...p, ww: v })), C.m700],
               ["PT", weights.pt, (v: number) => updateCategoryWeights(p => ({ ...p, pt: v })), "hsl(220,50%,34%)"],
               ["EX", weights.qa, (v: number) => updateCategoryWeights(p => ({ ...p, qa: v })), "hsl(25,55%,34%)"]] as [string, number, (v: number) => void, string][])
              .map(([l, v, set, accent]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>{l}</span>
                  <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.borderMed}`, borderRadius: 3, overflow: "hidden" }}>
                    <input type="number" min={0} max={100} value={v}
                      onChange={e => set(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      style={{
                        width: 32, textAlign: "center", border: "none", padding: "3px 4px",
                        fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: C.t1, outline: "none"
                      }} />
                    <span style={{ background: C.m50, color: C.t3, fontSize: 11, padding: "3px 5px", borderLeft: `1px solid ${C.borderMed}` }}>%</span>
                  </div>
                </div>
            ))}
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace",
              color: weightsOk ? C.green : C.red
            }}>
              = {weights.ww + weights.pt + weights.qa}%
            </span>
            {!weightsOk && <span style={{ fontSize: 9, color: C.red }}>must equal 100%</span>}
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button onClick={() => {
            const targetClassId = classId || cls?.id;
            if (!targetClassId) {
              alert("No valid class assignment identified to save grades.");
              return;
            }
            setIsLoading(true);
            const termsPayload: Record<string, any> = {};
            const termKeys = Array.from(new Set([...Object.keys(allData), term]));
            for (const t of termKeys) {
              const tData = allData[t as TermKey] || (t === term ? qd : { wwItems: [], ptItems: [], grades: {} });
              const rawExams = (tData.examItems && tData.examItems.length > 0)
                ? tData.examItems
                : (t === term ? examItems : [
                    { id: 'st1', label: 'ST 1', max: tData.st1Max ?? 25, weight: 30 },
                    { id: 'st2', label: 'ST 2', max: tData.st2Max ?? 25, weight: 30 },
                    { id: 'te',  label: 'TE',   max: tData.teMax ?? (tData.qaMax ?? 50), weight: 40 }
                  ]);
              const sanitizedExams = rawExams.map((ex: any) => ({
                id: String(ex.id || 'exam'),
                label: String(ex.label || 'Exam'),
                max: Math.max(1, Number(ex.max) || 25),
                weight: Math.max(0, Math.min(100, Number(ex.weight) || 0))
              }));
              const sanitizedWw = (tData.wwItems || []).map((it: any) => ({
                id: String(it.id),
                label: String(it.label || 'WW'),
                max: Math.max(1, Number(it.max) || 100)
              }));
              const sanitizedPt = (tData.ptItems || []).map((it: any) => ({
                id: String(it.id),
                label: String(it.label || 'PT'),
                max: Math.max(1, Number(it.max) || 100)
              }));
              termsPayload[t] = {
                ...tData,
                wwItems: sanitizedWw,
                ptItems: sanitizedPt,
                examItems: sanitizedExams,
                customWeights: tData.customWeights || weights,
                st1Max: Math.max(1, Number(tData.st1Max) || 25),
                st2Max: Math.max(1, Number(tData.st2Max) || 25),
                teMax: Math.max(1, Number(tData.teMax || tData.qaMax) || 50),
                qaMax: Math.max(1, Number(tData.teMax || tData.qaMax) || 50),
              };
            }
            import('../../../api/client').then(({ apiClient }) => {
              apiClient.post('/gradebooks/ledger', { classId: targetClassId.toString(), terms: termsPayload })
                .then(() => {
                  alert("Grades saved and synchronized to official records successfully!");
                  return apiClient.get(`/gradebooks/ledger?classId=${targetClassId}`);
                })
                .then((res: any) => {
                  if (res) {
                    setAllData(res.terms || {});
                    setRoster(res.roster || []);
                  }
                })
                .catch((err: any) => {
                  const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Unknown error';
                  alert("Failed to save grades: " + msg);
                })
                .finally(() => setIsLoading(false));
            });
          }} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
            background: C.m600, color: "#fff", borderRadius: 4, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700
          }}>
            <Save size={13} /> Save to Official Records
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
            background: C.m700, color: "#fff", borderRadius: 4, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700
          }}>
            <Download size={13} /> Export Excel
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Term summary VIEW
          ══════════════════════════════════════════════════════════ */}
      {view === "summary" && (
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{
            background: C.m50, borderBottom: `1px solid ${C.borderMed}`, padding: "8px 20px",
            display: "flex", alignItems: "center", gap: 10
          }}>
            <FileText size={13} color={C.m700} />
            <span style={{ fontSize: 11, color: C.t2 }}>
              Official 3-Term Summary — verified for <strong>DepEd Form 138 (SF9-JHS)</strong>.
              Edit raw scores in <button onClick={() => setView("ledger")} style={{ color: C.m700, background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0, textDecoration: "underline" }}>Grade entry</button>.
            </span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: C.t3 }}>
              Weights applied: WW {weights.ww}% · PT {weights.pt}% · EX {weights.qa}%
            </span>
          </div>

          <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%", fontSize: 12 }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 200 }} />
              {activeTerms.map(q => <col key={q} style={{ width: 90 }} />)}
              <col style={{ width: 110 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 90 }} />
            </colgroup>

            <thead>
              <tr>
                <th rowSpan={2} style={{
                  border: `1px solid rgba(255,255,255,0.15)`, background: C.m900,
                  color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: 700, padding: "6px 2px",
                  textAlign: "center", position: "sticky", top: 0, left: 0, zIndex: 6, letterSpacing: "0.07em"
                }}>#</th>
                <th rowSpan={2} style={{
                  border: `1px solid rgba(255,255,255,0.15)`, background: C.m800,
                  color: "#fff", fontSize: 11, fontWeight: 700, padding: "7px 10px", textAlign: "left",
                  position: "sticky", top: 0, left: 36, zIndex: 6,
                  fontFamily: "'Fraunces',serif", letterSpacing: "0.04em"
                }}>STUDENT NAME</th>
                {activeTerms.map(q => (
                  <th key={q} style={{
                    border: `1px solid rgba(255,255,255,0.15)`,
                    background: term === q ? getTAccent(q) : `${getTAccent(q)}CC`,
                    color: "#fff", fontSize: 11, fontWeight: 700, padding: "7px 4px", textAlign: "center",
                    position: "sticky", top: 0, zIndex: 4, letterSpacing: "0.08em"
                  }}>
                    {q}
                  </th>
                ))}
                <th style={{
                  border: `1px solid rgba(255,255,255,0.15)`, background: C.gold,
                  color: C.m900, fontSize: 11, fontWeight: 800, padding: "7px 4px", textAlign: "center",
                  position: "sticky", top: 0, zIndex: 4,
                  fontFamily: "'Fraunces',serif", letterSpacing: "0.06em"
                }}>FINAL RATING</th>
                <th style={{
                  border: `1px solid rgba(255,255,255,0.15)`, background: C.m800,
                  color: "#fff", fontSize: 10, fontWeight: 700, padding: "7px 4px", textAlign: "center",
                  position: "sticky", top: 0, zIndex: 4, letterSpacing: "0.08em"
                }}>DESCRIPTOR</th>
                <th style={{
                  border: `1px solid rgba(255,255,255,0.15)`, background: C.m700,
                  color: "#fff", fontSize: 10, fontWeight: 700, padding: "7px 4px", textAlign: "center",
                  position: "sticky", top: 0, zIndex: 4, letterSpacing: "0.08em"
                }}>STATUS</th>
              </tr>
              <tr>
                {activeTerms.map(q => (
                  <th key={q} style={{
                    border: `0.5px solid ${C.border}`,
                    background: term === q ? `${getTAccent(q)}22` : C.m50,
                    padding: "4px 4px", textAlign: "center", position: "sticky", top: 34, zIndex: 3
                  }}>
                    <span style={{ fontSize: 9, color: term === q ? getTAccent(q) : C.t3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Term Grade
                    </span>
                  </th>
                ))}
                <th style={{
                  border: `0.5px solid ${C.border}`, background: C.goldLight,
                  padding: "4px", textAlign: "center", position: "sticky", top: 34, zIndex: 3
                }}>
                  <span style={{ fontSize: 9, color: C.gold, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    ROUND(AVG, 0)
                  </span>
                </th>
                <th style={{ border: `0.5px solid ${C.border}`, background: C.m50, padding: "4px", textAlign: "center", position: "sticky", top: 34, zIndex: 3 }} />
                <th style={{ border: `0.5px solid ${C.border}`, background: C.m50, padding: "4px", textAlign: "center", position: "sticky", top: 34, zIndex: 3 }} />
              </tr>
            </thead>

            <tbody>
              {ROSTER.map((student, idx) => {
                const tGrades = activeTerms.map(q => tGradeFor(student.id, allData[q]));
                const finalObj = calculateAnnualFinalGrade(tGrades[0], tGrades[1], tGrades[2]);
                const finalGrade = finalObj.finalGrade;
                const passed = finalGrade !== null && finalGrade >= 75;
                const rowBg = idx % 2 === 0 ? "#fff" : C.paper;

                function gradeCell(g: number, isActive: boolean) {
                  const failing = g > 0 && g < 75;
                  const high = g >= 90;
                  return (
                    <td style={{
                      border: `0.5px solid ${C.border}`, padding: "9px 6px", textAlign: "center",
                      background: isActive ? (failing ? C.redBg : `${getTAccent(term)}10`) : (failing ? C.redBg : rowBg),
                      outline: isActive ? `1.5px solid ${getTAccent(term)}50` : "none",
                      outlineOffset: -1
                    }}>
                      <span style={{
                        fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace",
                        color: g <= 0 ? "#ccc" : failing ? C.red : high ? C.green : C.t1
                      }}>
                        {g > 0 ? g : "-"}
                      </span>
                    </td>
                  );
                }

                return (
                  <tr key={student.id}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.ledger; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}>
                    <td style={{
                      border: `0.5px solid ${C.border}`, padding: "9px 3px", textAlign: "center",
                      fontSize: 10, color: C.t3, fontFamily: "'JetBrains Mono',monospace",
                      background: "#F8F5F4", position: "sticky", left: 0, zIndex: 1
                    }}>
                      {idx + 1}
                    </td>
                    <td style={{
                      border: `0.5px solid ${C.border}`, padding: "9px 10px",
                      fontSize: 12, fontWeight: 600, color: C.t1, background: "#fff",
                      position: "sticky", left: 36, zIndex: 1,
                      borderRight: `2px solid ${C.borderMed}`, whiteSpace: "nowrap"
                    }}>
                      {student.surname}, {student.first}
                    </td>
                    {activeTerms.map((q, i) => (
                      <React.Fragment key={q}>{gradeCell(tGrades[i], term === q)}</React.Fragment>
                    ))}
                    {/* Final Grade */}
                    <td style={{
                      border: `1px solid ${C.borderMed}`, padding: "9px 6px", textAlign: "center",
                      background: finalGrade !== null && finalGrade < 75 ? C.redBg : C.goldLight
                    }}>
                      <span style={{
                        fontSize: 15, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace",
                        color: finalGrade === null ? "#ccc" : finalGrade < 75 ? C.red : finalGrade >= 90 ? C.green : C.t1
                      }}>
                        {finalGrade !== null ? finalGrade : "-"}
                      </span>
                    </td>
                    {/* Descriptor */}
                    <td style={{ border: `0.5px solid ${C.border}`, padding: "9px 6px", textAlign: "center", background: rowBg }}>
                      {getDescriptorBadge(finalObj.descriptor)}
                    </td>
                    {/* Status stamp */}
                    <td style={{ border: `0.5px solid ${C.border}`, padding: "9px 6px", textAlign: "center", background: rowBg }}>
                      {finalGrade !== null && <Stamp
                        label={passed ? "PASSED" : "FAILED"}
                        color={passed ? "#fff" : C.red}
                        bg={passed ? C.green : C.redBg} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{
            background: C.m800, borderTop: `2px solid ${C.m700}`, padding: "8px 18px",
            display: "flex", alignItems: "center", gap: 24
          }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Final Rating Summary
            </span>
            {(() => {
              const finals = ROSTER.map(s => {
                const tGrades = activeTerms.map(q => tGradeFor(s.id, allData[q]));
                return calculateAnnualFinalGrade(tGrades[0], tGrades[1], tGrades[2]).finalGrade;
              }).filter((g): g is number => g !== null && g > 0);
              const pass = finals.filter(g => g >= 75).length;
              const fail = finals.filter(g => g < 75).length;
              const avg = finals.length ? Math.round(finals.reduce((a, b) => a + b, 0) / finals.length).toString() : "-";
              return (
                <>
                  {([["Students", ROSTER.length, "rgba(255,255,255,0.7)"],
                     ["Passed", pass, C.gold],
                     ["Failed", fail, "#FCA5A5"],
                     ["Class avg", avg, "#fff"]] as [string, number | string, string][]).map(([l, v, col]) => (
                    <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: col }}>{v}</span>
                    </div>
                  ))}
                </>
              );
            })()}
            <div style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                {cls.subject} · Grade {cls.grade} {cls.section} · SY 2026–2027
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          GRADE ENTRY LEDGER VIEW (Verified Excel ECR Breakdown)
          ══════════════════════════════════════════════════════════ */}
      {view === "ledger" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
            <table style={{ borderCollapse: "collapse", tableLayout: "fixed", fontSize: 12, minWidth: "max-content", width: "100%" }}>
              <colgroup>
                <col style={{ width: W.num }} />
                <col style={{ width: W.name }} />
                {/* WW items + Add + Total + PS + WS */}
                {wwItems.map(it => <col key={it.id} style={{ width: W.act }} />)}
                <col style={{ width: W.add }} />
                <col style={{ width: W.stat }} />
                <col style={{ width: W.ps }} />
                <col style={{ width: W.ws }} />
                {/* PT items + Add + Total + PS + WS */}
                {ptItems.map(it => <col key={it.id} style={{ width: W.act }} />)}
                <col style={{ width: W.add }} />
                <col style={{ width: W.stat }} />
                <col style={{ width: W.ps }} />
                <col style={{ width: W.ws }} />
                {/* EX items + Add + PS + WS */}
                {examItems.map(it => <col key={it.id} style={{ width: W.exam }} />)}
                <col style={{ width: W.add }} />
                <col style={{ width: W.ps }} />
                <col style={{ width: W.ws }} />
                {/* Final computed columns */}
                <col style={{ width: W.ig }} />
                <col style={{ width: W.tg }} />
                <col style={{ width: W.desc }} />
              </colgroup>

              <thead>
                {/* ── Row 1: Category headers ── */}
                <tr>
                  <th rowSpan={2} style={{
                    border: `1px solid rgba(255,255,255,0.15)`, background: C.m900,
                    color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: 700, padding: "5px 2px",
                    textAlign: "center", position: "sticky", top: 0, left: 0, zIndex: 6, letterSpacing: "0.07em"
                  }}>
                    #
                  </th>
                  <th rowSpan={2} style={{
                    border: `1px solid rgba(255,255,255,0.15)`, background: C.m800,
                    color: "#fff", fontSize: 11, fontWeight: 700, padding: "7px 10px", textAlign: "left",
                    position: "sticky", top: 0, left: W.num, zIndex: 6,
                    fontFamily: "'Fraunces',serif", letterSpacing: "0.04em", whiteSpace: "nowrap"
                  }}>
                    STUDENT NAME
                  </th>
                  {/* WW Category Header */}
                  <th colSpan={wwItems.length + 4} style={{
                    border: `1px solid rgba(255,255,255,0.15)`,
                    background: activeAccent, color: "#fff", fontSize: 10, fontWeight: 700, padding: "7px 6px",
                    textAlign: "center", position: "sticky", top: 0, zIndex: 4, letterSpacing: "0.07em"
                  }}>
                    WRITTEN WORKS
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.7)", fontSize: 11, marginLeft: 8 }}>
                      {weights.ww}%
                    </span>
                  </th>
                  {/* PT Category Header */}
                  <th colSpan={ptItems.length + 4} style={{
                    border: `1px solid rgba(255,255,255,0.15)`,
                    background: "hsl(220,50%,30%)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "7px 6px",
                    textAlign: "center", position: "sticky", top: 0, zIndex: 4, letterSpacing: "0.07em"
                  }}>
                    PERFORMANCE TASKS
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.7)", fontSize: 11, marginLeft: 8 }}>
                      {weights.pt}%
                    </span>
                  </th>
                  {/* EX Category Header */}
                  <th colSpan={examItems.length + 3} style={{
                    border: `1px solid rgba(255,255,255,0.15)`,
                    background: "hsl(25,55%,28%)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "7px 6px",
                    textAlign: "center", position: "sticky", top: 0, zIndex: 4, letterSpacing: "0.07em"
                  }}>
                    <span>EXAMINATIONS</span>
                    {isEditingExamCategoryWeight ? (
                      <input
                        autoFocus
                        type="number"
                        defaultValue={weights.qa}
                        onBlur={e => {
                          const val = parseInt(e.target.value) || weights.qa;
                          updateCategoryWeights(p => ({ ...p, qa: val }));
                          setIsEditingExamCategoryWeight(false);
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            const val = parseInt((e.target as HTMLInputElement).value) || weights.qa;
                            updateCategoryWeights(p => ({ ...p, qa: val }));
                            setIsEditingExamCategoryWeight(false);
                          }
                          if (e.key === "Escape") setIsEditingExamCategoryWeight(false);
                        }}
                        style={{
                          width: 38, textAlign: "center", border: `1px solid rgba(255,255,255,0.7)`, borderRadius: 2,
                          fontSize: 11, padding: "1px 2px", fontFamily: "'JetBrains Mono',monospace",
                          background: "rgba(0,0,0,0.4)", color: "#FDE68A", outline: "none", marginLeft: 8
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => setIsEditingExamCategoryWeight(true)}
                        title="Click to edit Examination category weight percentage"
                        style={{
                          fontFamily: "'JetBrains Mono',monospace", color: "#FDE68A", fontSize: 11, marginLeft: 8,
                          cursor: "pointer", textDecoration: "underline dotted", background: "rgba(0,0,0,0.25)",
                          padding: "1px 6px", borderRadius: 3
                        }}
                      >
                        {weights.qa}%
                      </span>
                    )}
                  </th>
                  {/* Initial Grade */}
                  <th rowSpan={2} style={{
                    border: `1px solid rgba(255,255,255,0.15)`, background: C.m900,
                    color: "rgba(255,255,255,0.9)", fontSize: 9, fontWeight: 700, padding: "5px 4px",
                    textAlign: "center", position: "sticky", top: 0, zIndex: 4, letterSpacing: "0.06em", lineHeight: 1.3
                  }}>
                    INITIAL<br />GRADE
                  </th>
                  {/* Term Grade */}
                  <th rowSpan={2} style={{
                    border: `1px solid rgba(255,255,255,0.15)`,
                    background: C.gold, color: C.m900, fontSize: 10, fontWeight: 800, padding: "5px 4px",
                    textAlign: "center", position: "sticky", top: 0, right: W.desc, zIndex: 6,
                    fontFamily: "'Fraunces',serif", letterSpacing: "0.07em", lineHeight: 1.4
                  }}>
                    TERM<br />GRADE
                  </th>
                  {/* Descriptor */}
                  <th rowSpan={2} style={{
                    border: `1px solid rgba(255,255,255,0.15)`, background: C.m800,
                    color: "#fff", fontSize: 9, fontWeight: 700, padding: "5px 4px",
                    textAlign: "center", position: "sticky", top: 0, right: 0, zIndex: 6, letterSpacing: "0.06em"
                  }}>
                    DESCRIPTOR
                  </th>
                </tr>

                {/* ── Row 2: Sub-headers ── */}
                <tr>
                  {/* WW items */}
                  {wwItems.map(it =>
                    subTH(<div style={{ lineHeight: 1.4, position: "relative" }}>
                      <button onClick={() => deleteWW(it.id)} title="Delete column" style={{
                        position: "absolute", top: 2, right: 2, background: "transparent", border: "none",
                        color: "rgba(255,255,255,0.6)", width: 14, height: 14, display: "flex",
                        alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0
                      }} onMouseEnter={e => (e.currentTarget.style.color = "#FCA5A5")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}><Trash2 size={10} /></button>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>{it.label}</div>
                      {MaxInput(it, updateWWMax)}
                    </div>, activeAccent, "#fff", 34, it.id)
                  )}
                  {/* +Add WW */}
                  {subTH(
                    <button onClick={addWW} title="Add Written Works activity"
                      style={{
                        width: "100%", height: "100%", minHeight: 34, background: "none", border: "none",
                        cursor: "pointer", color: "rgba(255,255,255,0.7)", display: "flex",
                        alignItems: "center", justifyContent: "center"
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <Plus size={12} />
                    </button>, activeAccent, "#fff", 34, "add-ww"
                  )}
                  {/* WW Total */}
                  {subTH(<div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>TOTAL</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>/{wwTotalMax}</div>
                  </div>, activeAccent, "#fff", 34, "ww-total")}
                  {/* WW PS */}
                  {subTH(<div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>PS</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>%</div>
                  </div>, activeAccent, "#fff", 34, "ww-ps")}
                  {/* WW WS */}
                  {subTH(<div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>WS</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>{weights.ww}%</div>
                  </div>, activeAccent, "#fff", 34, "ww-ws")}

                  {/* PT items */}
                  {ptItems.map(it =>
                    subTH(<div style={{ lineHeight: 1.4, position: "relative" }}>
                      <button onClick={() => deletePT(it.id)} title="Delete column" style={{
                        position: "absolute", top: 2, right: 2, background: "transparent", border: "none",
                        color: "rgba(255,255,255,0.6)", width: 14, height: 14, display: "flex",
                        alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0
                      }} onMouseEnter={e => (e.currentTarget.style.color = "#FCA5A5")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}><Trash2 size={10} /></button>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>{it.label}</div>
                      {MaxInput(it, updatePTMax)}
                    </div>, "hsl(220,50%,30%)", "#fff", 34, it.id)
                  )}
                  {/* +Add PT */}
                  {subTH(
                    <button onClick={addPT} title="Add Performance Task activity"
                      style={{
                        width: "100%", height: "100%", minHeight: 34, background: "none", border: "none",
                        cursor: "pointer", color: "rgba(255,255,255,0.7)", display: "flex",
                        alignItems: "center", justifyContent: "center"
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <Plus size={12} />
                    </button>, "hsl(220,50%,30%)", "#fff", 34, "add-pt"
                  )}
                  {/* PT Total */}
                  {subTH(<div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>TOTAL</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>/{ptTotalMax}</div>
                  </div>, "hsl(220,50%,30%)", "#fff", 34, "pt-total")}
                  {/* PT PS */}
                  {subTH(<div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>PS</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>%</div>
                  </div>, "hsl(220,50%,30%)", "#fff", 34, "pt-ps")}
                  {/* PT WS */}
                  {subTH(<div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>WS</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>{weights.pt}%</div>
                  </div>, "hsl(220,50%,30%)", "#fff", 34, "pt-ws")}

                  {/* Dynamic Exam items */}
                  {examItems.map(it =>
                    subTH(
                      <div style={{ lineHeight: 1.3, position: "relative", minWidth: 60 }}>
                        {/* Delete button (if more than 1 exam) */}
                        {examItems.length > 1 && (
                          <button
                            onClick={() => deleteExam(it.id)}
                            title="Delete examination column"
                            style={{
                              position: "absolute", top: 2, right: 2, background: "transparent", border: "none",
                              color: "rgba(255,255,255,0.6)", width: 14, height: 14, display: "flex",
                              alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#FCA5A5")}
                            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                          >
                            <Trash2 size={10} />
                          </button>
                        )}

                        {/* Editable Name / Label */}
                        {editingLabelId === it.id ? (
                          <input
                            autoFocus
                            defaultValue={it.label}
                            onBlur={e => updateExamLabel(it.id, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") updateExamLabel(it.id, (e.target as HTMLInputElement).value);
                              if (e.key === "Escape") setEditingLabelId(null);
                            }}
                            style={{
                              width: "80%", textAlign: "center", border: `1px solid rgba(255,255,255,0.7)`, borderRadius: 2,
                              fontSize: 9, fontWeight: 700, padding: "1px 2px", fontFamily: "'JetBrains Mono',monospace",
                              background: "rgba(0,0,0,0.35)", color: "#fff", outline: "none", marginTop: 2
                            }}
                          />
                        ) : (
                          <div
                            onClick={() => setEditingLabelId(it.id)}
                            title="Click to rename examination"
                            style={{
                              fontSize: 9, fontWeight: 700, color: "#fff", cursor: "pointer",
                              textDecoration: "underline dotted", padding: "1px 2px", marginTop: 2
                            }}
                          >
                            {it.label}
                          </div>
                        )}

                        {/* Editable Max Score */}
                        {ExamMaxInput(it.id, it.max, val => updateExamMax(it.id, val))}

                        {/* Editable Weight % */}
                        <div style={{ marginTop: 2 }}>
                          {editingWeightId === it.id ? (
                            <input
                              autoFocus
                              type="number"
                              defaultValue={it.weight}
                              onBlur={e => updateExamWeight(it.id, parseFloat(e.target.value) || it.weight)}
                              onKeyDown={e => {
                                if (e.key === "Enter") updateExamWeight(it.id, parseFloat((e.target as HTMLInputElement).value) || it.weight);
                                if (e.key === "Escape") setEditingWeightId(null);
                              }}
                              style={{
                                width: 32, textAlign: "center", border: `1px solid #FDE68A`, borderRadius: 2,
                                fontSize: 8, padding: "0 1px", fontFamily: "'JetBrains Mono',monospace",
                                background: "rgba(0,0,0,0.4)", color: "#FDE68A", outline: "none"
                              }}
                            />
                          ) : (
                            <span
                              onClick={() => setEditingWeightId(it.id)}
                              title="Click to edit % weight of this examination"
                              style={{
                                fontSize: 8, color: "#FDE68A", cursor: "pointer",
                                fontWeight: 700, background: "rgba(0,0,0,0.25)",
                                borderRadius: 3, padding: "1px 4px", display: "inline-block",
                                textDecoration: "underline dotted"
                              }}
                            >
                              {it.weight}%
                            </span>
                          )}
                        </div>
                      </div>,
                      "hsl(25,55%,28%)",
                      "#fff",
                      34,
                      `exam-${it.id}`
                    )
                  )}

                  {/* +Add Exam Button */}
                  {subTH(
                    <button
                      onClick={addExam}
                      title="Add Examination (e.g. ST 3, Midterm, etc.)"
                      style={{
                        width: "100%", height: "100%", minHeight: 34, background: "none", border: "none",
                        cursor: "pointer", color: "rgba(255,255,255,0.85)", display: "flex",
                        alignItems: "center", justifyContent: "center"
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <Plus size={12} />
                    </button>,
                    "hsl(25,55%,28%)",
                    "#fff",
                    34,
                    "add-exam"
                  )}

                  {/* EX PS */}
                  {subTH(<div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>PS</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>%</div>
                  </div>, "hsl(25,55%,28%)", "#fff", 34, "ex-ps")}
                  {/* EX WS */}
                  {subTH(<div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>WS</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>{weights.qa}%</div>
                  </div>, "hsl(25,55%,28%)", "#fff", 34, "ex-ws")}
                </tr>
              </thead>

              <tbody>
                {ROSTER.map((student, idx) => {
                  const calc = getCalc(student.id);
                  const qGrade = getQGrade(student.id);
                  const rowBg = idx % 2 === 0 ? "#fff" : C.paper;
                  const desc = calc?.descriptor ?? getPerformanceDescriptor(qGrade);

                  return (
                    <tr key={student.id}
                      onMouseEnter={e => { if (!activeCell) (e.currentTarget as HTMLElement).style.background = C.ledger; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}>
                      {/* Row number - sticky left */}
                      <td style={{
                        border: `0.5px solid ${C.border}`, padding: "7px 3px", textAlign: "center",
                        fontSize: 10, color: C.t3, fontFamily: "'JetBrains Mono',monospace",
                        background: "#F8F5F4", position: "sticky", left: 0, zIndex: 1,
                        borderRight: `1px solid ${C.borderMed}`
                      }}>
                        {idx + 1}
                      </td>
                      {/* Student name - sticky left */}
                      <td style={{
                        border: `0.5px solid ${C.border}`, padding: "7px 10px",
                        fontSize: 12, fontWeight: 600, color: C.t1,
                        background: "#fff", position: "sticky", left: W.num, zIndex: 1,
                        borderRight: `2px solid ${C.borderMed}`, whiteSpace: "nowrap"
                      }}>
                        {student.surname}, {student.first}
                      </td>

                      {/* WW activity score cells */}
                      {wwItems.map(it => Cell(student.id, it.id, it.max))}
                      {/* WW + placeholder */}
                      <td style={{ border: `0.5px solid ${C.border}`, background: "#F9F5F4" }} />
                      {/* WW Total */}
                      {ROCell(calc ? calc.wwTotal : "-", { bold: true })}
                      {/* WW PS */}
                      {ROCell(calc ? calc.wwPS : "-", { color: calc && calc.wwPS > 0 && calc.wwPS < 75 ? C.red : C.t2 })}
                      {/* WW WS */}
                      {ROCell(calc ? calc.wwWS : "-", { bold: true, color: C.m700, decimals: 2 })}

                      {/* PT activity score cells */}
                      {ptItems.map(it => Cell(student.id, it.id, it.max))}
                      {/* PT + placeholder */}
                      <td style={{ border: `0.5px solid ${C.border}`, background: "#F4F5F9" }} />
                      {/* PT Total */}
                      {ROCell(calc ? calc.ptTotal : "-", { bold: true })}
                      {/* PT PS */}
                      {ROCell(calc ? calc.ptPS : "-", { color: calc && calc.ptPS > 0 && calc.ptPS < 75 ? C.red : C.t2 })}
                      {/* PT WS */}
                      {ROCell(calc ? calc.ptWS : "-", { bold: true, color: "hsl(220,50%,34%)", decimals: 2 })}

                      {/* EX score cells */}
                      {examItems.map(it => Cell(student.id, it.id, it.max))}
                      {/* EX + placeholder */}
                      <td style={{ border: `0.5px solid ${C.border}`, background: "#FDF8F5" }} />
                      {/* EX PS */}
                      {ROCell(calc?.exPS !== null && calc?.exPS !== undefined ? calc.exPS : "-", { color: calc && calc.exPS !== null && calc.exPS < 75 ? C.red : C.t2 })}
                      {/* EX WS */}
                      {ROCell(calc?.exWS !== null && calc?.exWS !== undefined ? calc.exWS : "-", { bold: true, color: "hsl(25,55%,34%)", decimals: 2 })}

                      {/* Initial Grade */}
                      {ROCell(calc?.initialGrade !== null && calc?.initialGrade !== undefined ? calc.initialGrade : "-", { bold: true, decimals: 2, bg: "#FAF5FF" })}

                      {/* Term Grade - transmuted integer */}
                      <td style={{
                        border: `1px solid ${C.borderMed}`, padding: "7px 4px", textAlign: "center",
                        fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 800,
                        color: qGrade <= 0 ? "#ccc" : qGrade < 75 ? C.red : qGrade >= 90 ? C.green : C.t1,
                        background: qGrade > 0 && qGrade < 75 ? C.redBg : C.goldLight,
                        position: "sticky", right: W.desc, zIndex: 1,
                        borderLeft: `2px solid ${C.borderMed}`
                      }}>
                        {qGrade > 0 ? qGrade : "-"}
                      </td>

                      {/* Descriptor */}
                      <td style={{
                        border: `1px solid ${C.borderMed}`, padding: "7px 4px", textAlign: "center",
                        position: "sticky", right: 0, zIndex: 1, background: "#fff"
                      }}>
                        {getDescriptorBadge(desc)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Bottom summary ledger strip ── */}
          <div style={{
            background: C.m800, borderTop: `2px solid ${C.m700}`, padding: "8px 18px",
            display: "flex", alignItems: "center", gap: 24, flexShrink: 0
          }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Class Summary ({term})
            </span>
            {([
              ["Students", ROSTER.length, "rgba(255,255,255,0.7)"],
              ["Passing", passing, C.gold],
              ["Failing", failing, "#FCA5A5"],
              ["Class avg", classAvg, "#fff"],
            ] as [string, number | string, string][]).map(([l, v, color]) => (
              <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</span>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color }}>{v}</span>
              </div>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                {term} · {cls.subject} · Grade {cls.grade} {cls.section} · SY 2026–2027
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
