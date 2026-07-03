import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { BookMarked, Eye, ChevronLeft, Printer, Download, ArrowRight, X, ChevronDown } from 'lucide-react';
import { CapstoneForm137 } from './components/CapstoneForm137';
import { FullStudentReportCard } from './components/FullStudentReportCard';
export type CurriculumType = "new" | "old";  /* new = Q1-Q3, old = Q1-Q4 */
export interface GradeRecord { q1:number; q2:number; q3:number; q4?:number; curriculum:CurriculumType; }
export interface SubjectHistory {
  name: string;
  gr7?: GradeRecord;
  gr8?: GradeRecord;
  gr9?: GradeRecord;
  gr10?: GradeRecord;
}

export const FULL_ACADEMIC_HISTORY: SubjectHistory[] = [
  { name:"Filipino",                      gr7:{q1:88,q2:86,q3:89,q4:87,curriculum:"old"}, gr8:{q1:89,q2:90,q3:88,q4:89,curriculum:"old"}, gr9:{q1:91,q2:92,q3:90,q4:91,curriculum:"old"}, gr10:{q1:92,q2:94,q3:93,curriculum:"new"} },
  { name:"English",                       gr7:{q1:85,q2:84,q3:86,q4:88,curriculum:"old"}, gr8:{q1:87,q2:88,q3:87,q4:89,curriculum:"old"}, gr9:{q1:88,q2:90,q3:89,q4:91,curriculum:"old"}, gr10:{q1:90,q2:91,q3:89,curriculum:"new"} },
  { name:"Mathematics",                   gr7:{q1:74,q2:76,q3:73,q4:75,curriculum:"old"}, gr8:{q1:76,q2:78,q3:75,q4:79,curriculum:"old"}, gr9:{q1:78,q2:80,q3:79,q4:82,curriculum:"old"}, gr10:{q1:83,q2:85,q3:82,curriculum:"new"} },
  { name:"Science",                       gr7:{q1:91,q2:90,q3:92,q4:93,curriculum:"old"}, gr8:{q1:92,q2:93,q3:91,q4:94,curriculum:"old"}, gr9:{q1:93,q2:94,q3:95,q4:96,curriculum:"old"}, gr10:{q1:95,q2:96,q3:94,curriculum:"new"} },
  { name:"Araling Panlipunan",            gr7:{q1:90,q2:89,q3:91,q4:90,curriculum:"old"}, gr8:{q1:91,q2:92,q3:90,q4:92,curriculum:"old"}, gr9:{q1:92,q2:93,q3:94,q4:95,curriculum:"old"}, gr10:{q1:95,q2:96,q3:94,curriculum:"new"} },
  { name:"Technology & Livelihood Educ.", gr7:{q1:88,q2:87,q3:89,q4:88,curriculum:"old"}, gr8:{q1:89,q2:90,q3:88,q4:90,curriculum:"old"}, gr9:{q1:90,q2:91,q3:92,q4:93,curriculum:"old"}, gr10:{q1:92,q2:94,q3:93,curriculum:"new"} },
  { name:"MAPEH",                         gr7:{q1:92,q2:91,q3:93,q4:94,curriculum:"old"}, gr8:{q1:93,q2:94,q3:92,q4:95,curriculum:"old"}, gr9:{q1:94,q2:95,q3:96,q4:97,curriculum:"old"}, gr10:{q1:96,q2:97,q3:95,curriculum:"new"} },
  { name:"Edukasyon sa Pagpapakatao",     gr7:{q1:95,q2:94,q3:96,q4:95,curriculum:"old"}, gr8:{q1:96,q2:97,q3:95,q4:96,curriculum:"old"}, gr9:{q1:97,q2:98,q3:96,q4:98,curriculum:"old"}, gr10:{q1:98,q2:99,q3:97,curriculum:"new"} }
];

export function TemplateHubScreen() {
  const [modal, setModal]     = useState<"rc"|"f137"|null>(null);
  const [student, setStudent] = useState("Santos, Juan Miguel");
  const [sy, setSy]           = useState("SY 2025–2026");
  /* viewing = the document is being shown full-screen inside the app */
  const [viewing, setViewing] = useState<"rc"|"f137"|null>(null);

  const TEMPLATES = [
    {
      id:"rc" as const, emoji:"📋",
      title:"Report Card",
      desc:"Form 138 — Complete academic history across Grade 7–10. Auto-detects Old Curriculum (Q1–Q4) for Grade 7 and New Curriculum (Q1–Q3) for Grade 8–10.",
    },
    {
      id:"f137" as const, emoji:"📄",
      title:"Form 137",
      desc:"Permanent Record — Official transfer document containing the student's complete scholastic record and personal information.",
    },
  ];

  function handleView() {
    /* Show the document full-screen inside the app */
    setViewing(modal);
    setModal(null);
  }

  /* ── Full-screen document view ── */
  if (viewing) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:C.paper }}>
        {/* Document topbar — looks like a screen inside the app */}
        <div style={{ background:"#fff", borderBottom:`2px solid ${C.m700}`, padding:"0 20px", height:54, display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <button onClick={()=>setViewing(null)}
            style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, color:C.m700, background:C.m100, border:`1px solid rgba(139,30,30,0.2)`, padding:"6px 12px", borderRadius:4, cursor:"pointer" }}>
            <ChevronLeft size={13}/> Back to Forms and Records
          </button>
          <div style={{ width:1, height:22, background:C.borderMed }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>
              {viewing==="rc" ? "Report Card — Form 138" : "Form 137 — Permanent Record"}
            </div>
            <div style={{ fontSize:10, color:C.t3 }}>
              {student} · {sy}
            </div>
          </div>
          <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:C.t2, background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"6px 12px", cursor:"pointer" }}>
            <Printer size={13}/> Print
          </button>
          <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:4, padding:"6px 14px", cursor:"pointer" }}>
            <Download size={13}/> Download PDF
          </button>
        </div>

        {/* Document content */}
        <div style={{ flex:1, overflowY:"auto", padding:24 }}>
          {viewing==="rc" ? (
            <FullStudentReportCard student={{ name:student, lrn:"100001", grade:10, section:"Pilot", adviser:"Ana R. Soriano" }} />
          ) : (
            <CapstoneForm137 student={{ name:student, lrn:"100001", grade:10, section:"Pilot", adviser:"Ana R. Soriano" }} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:C.paper }}>
      <div style={{ maxWidth:700, margin:"0 auto", padding:40 }}>
        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:20, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:6 }}>Forms and Records</div>
          <div style={{ fontSize:13, color:C.t3 }}>Select a document template to view the official DepEd form for a student.</div>
        </div>

        {/* Two template cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          {TEMPLATES.map(t=>(
            <button key={t.id} onClick={()=>setModal(t.id)}
              style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderTop:`3px solid ${C.m700}`, borderRadius:4, padding:"24px", textAlign:"left", cursor:"pointer", display:"flex", flexDirection:"column", gap:12, transition:"box-shadow 0.15s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow=`0 4px 20px rgba(139,30,30,0.14)`;}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow="none";}}>
              <div style={{ fontSize:40, lineHeight:1 }}>{t.emoji}</div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:8 }}>{t.title}</div>
                <div style={{ fontSize:12, color:C.t3, lineHeight:1.6 }}>{t.desc}</div>
              </div>
              <div style={{ marginTop:"auto", display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:4, background:C.m700, color:"#fff", fontSize:12, fontWeight:700 }}>
                View {t.title} <ArrowRight size={13}/>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal — appears when a template card is clicked */}
      {modal && (
        <div style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(15,8,8,0.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={e=>{ if(e.target===e.currentTarget) setModal(null); }}>
          <div style={{ background:"#fff", borderRadius:4, width:"100%", maxWidth:420, overflow:"hidden", boxShadow:"0 20px 60px rgba(74,10,16,0.4)" }}>
            {/* Modal header */}
            <div style={{ background:C.m800, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:2 }}>Generate document</div>
                <div style={{ fontSize:15, fontWeight:700, color:"#fff", fontFamily:"'Fraunces',serif" }}>
                  {modal==="rc" ? "Report Card" : "Form 137"}
                </div>
              </div>
              <button onClick={()=>setModal(null)} style={{ width:28, height:28, borderRadius:4, background:"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <X size={15}/>
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
              {modal==="rc" && (
                <div style={{ padding:"8px 12px", background:C.m50, border:`0.5px solid ${C.borderMed}`, borderRadius:4, fontSize:11, color:C.t2 }}>
                  <span style={{ fontWeight:600, color:C.m700 }}>Auto curriculum:</span>{" "}Grade 7 = Old (Q1–Q4) · Grade 8–10 = New (Q1–Q3)
                </div>
              )}

              {[
                { label:"Student", value:student, setter:setStudent, opts:["Santos, Juan Miguel","Garcia, Ana Kristine","Cruz, Trisha Ann","Espino, Hannah Grace","Ferrer, Joshua","Bondoc, Ramon Jr.","Ocampo, Renz Adrian","Hernandez, Mark Ryan"] },
                { label:"School Year", value:sy, setter:setSy, opts:["SY 2025–2026","SY 2024–2025","SY 2023–2024","SY 2022–2023"] },
              ].map(f=>(
                <div key={f.label}>
                  <label style={{ display:"block", fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>{f.label}</label>
                  <div style={{ position:"relative" }}>
                    <select value={f.value} onChange={e=>f.setter(e.target.value)}
                      style={{ width:"100%", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"9px 28px 9px 10px", fontSize:13, color:C.t1, background:"#fff", outline:"none", appearance:"none", cursor:"pointer" }}>
                      {f.opts.map(o=><option key={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={12} style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", color:C.t3, pointerEvents:"none" }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div style={{ padding:"14px 20px", borderTop:`1px solid ${C.borderMed}`, display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={()=>setModal(null)} style={{ padding:"9px 18px", background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, cursor:"pointer", fontSize:13, fontWeight:500, color:C.t2 }}>
                Cancel
              </button>
              <button onClick={handleView} style={{ padding:"9px 22px", background:C.m700, color:"#fff", border:"none", borderRadius:4, cursor:"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                <Eye size={14}/> View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── App ───────────────────────────────────────────────────── */