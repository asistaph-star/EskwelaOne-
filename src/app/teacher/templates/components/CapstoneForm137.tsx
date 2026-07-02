import React from 'react';
import { C } from '../../../shared/constants/tokens';
import { GradeLevel } from '../../../shared/types';
import { FULL_ACADEMIC_HISTORY } from '../TemplateHubScreen';

/* ─── Full StudentReportCard (Modern SF10-JHS format) ─── */
/* ─── Full StudentReportCard (Modern SF10-JHS format) ─── */
export function CapstoneForm137({ student }: { student?: { name:string; lrn:string; grade:number; section:string; adviser:string } }) {
  const s = student ?? { name:"SANTOS, JUAN MIGUEL", lrn:"100001", grade:10, section:"PILOT", adviser:"ANA R. SORIANO" };
  
  const GRADES_DATA = [
    { grade:7, sy:"2022-2023", school:"Sindalan NHS", id:"300854", dist:"San Fernando", div:"San Fernando", reg:"III", adviser:"Ana R. Soriano" },
    { grade:8, sy:"2023-2024", school:"Sindalan NHS", id:"300854", dist:"San Fernando", div:"San Fernando", reg:"III", adviser:"Ana R. Soriano" },
    { grade:9, sy:"2024-2025", school:"Sindalan NHS", id:"300854", dist:"San Fernando", div:"San Fernando", reg:"III", adviser:"Ana R. Soriano" },
    { grade:10, sy:"2025-2026", school:"Sindalan NHS", id:"300854", dist:"San Fernando", div:"San Fernando", reg:"III", adviser:s.adviser }
  ];

  const mColor = "#8b1e1e";

  return (
    <div style={{ background:"#fff", fontFamily:"'Inter', sans-serif", width:"100%", maxWidth:900, margin:"0 auto", padding:"20px", boxSizing:"border-box", color:"#333", borderTop:`6px solid ${mColor}`, boxShadow:"0 4px 20px rgba(0,0,0,0.05)" }}>
      <style>{`
        .sf10-doc { font-size: 10px; line-height: 1.3; }
        .sf10-doc .bold { font-weight: 700; color: #111; }
        .sf10-doc .text-center { text-align: center; }
        .sf10-title { background: ${mColor}; color: #fff; font-weight: 700; text-align: center; padding: 5px; font-size: 11px; margin: 8px 0; letter-spacing: 0.05em; border-radius: 3px; }
        .sf10-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9px; }
        .sf10-table th, .sf10-table td { border: 1px solid rgba(139, 30, 30, 0.2); padding: 4px 6px; }
        .sf10-table th { background: rgba(139, 30, 30, 0.05); font-weight: 700; text-align: center; color: ${mColor}; text-transform: uppercase; letter-spacing: 0.03em; }
        .sf10-input { border-bottom: 1px solid rgba(139, 30, 30, 0.4); display: inline-block; padding: 0 4px; font-weight: 600; color: #111; font-family: 'JetBrains Mono', monospace; font-size: 11px; white-space: nowrap; }
        .sf10-row { display: flex; align-items: flex-end; margin-bottom: 5px; gap: 8px; color: #555; }
        @media print {
          .no-print { display: none !important; }
          .print-root { box-shadow: none !important; padding: 0 !important; }
          .sf10-title { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .sf10-table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          div { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      
      <div className="sf10-doc">
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ width:60, height:60, border:`1px solid ${mColor}40`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, textAlign:"center", background:`${mColor}10`, color:mColor, fontWeight:600 }}>Kagawaran<br/>ng<br/>Edukasyon</div>
          <div className="text-center">
            <div style={{ color:mColor, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", fontSize:9 }}>Republic of the Philippines</div>
            <div style={{ color:mColor, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", fontSize:9 }}>Department of Education</div>
            <div style={{ fontSize:15, fontWeight:800, marginTop:6, color:"#111", fontFamily:"'Fraunces', serif" }}>Learner Permanent Record for Junior High School (SF10-JHS)</div>
            <div style={{ fontStyle:"italic", color:"#666", marginTop:2 }}>(Formerly Form 137)</div>
          </div>
          <div style={{ width:60, height:60, border:`1px solid ${mColor}40`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:"bold", textAlign:"center", color:"#fff", background:mColor }}>DepED</div>
        </div>

        {/* LEARNER'S INFORMATION */}
        <div className="sf10-title">LEARNER'S INFORMATION</div>
        <div className="sf10-row">
          <div style={{ flex:1.5 }}>LAST NAME: <span className="sf10-input" style={{ width:"calc(100% - 65px)" }}>{s.name.split(',')[0]}</span></div>
          <div style={{ flex:1.5 }}>FIRST NAME: <span className="sf10-input" style={{ width:"calc(100% - 70px)" }}>{s.name.split(',')[1]?.trim()}</span></div>
          <div style={{ flex:0.8 }}>NAME EXT. (Jr,I,II): <span className="sf10-input" style={{ width:"calc(100% - 105px)" }}></span></div>
          <div style={{ flex:1 }}>MIDDLE NAME: <span className="sf10-input" style={{ width:"calc(100% - 80px)" }}></span></div>
        </div>
        <div className="sf10-row" style={{ marginBottom: 12 }}>
          <div style={{ flex:1.5 }}>Learner Reference Number (LRN): <span className="sf10-input" style={{ width:"calc(100% - 175px)" }}>{s.lrn}</span></div>
          <div style={{ flex:1 }}>Birthdate (mm/dd/yyyy): <span className="sf10-input" style={{ width:"calc(100% - 120px)" }}>05/12/2010</span></div>
          <div style={{ flex:1 }}>Sex: <span className="sf10-input" style={{ width:"calc(100% - 30px)" }}>MALE</span></div>
        </div>

        {/* ELIGIBILITY FOR JHS ENROLMENT */}
        <div className="sf10-title">ELIGIBILITY FOR JHS ENROLMENT</div>
        <div className="sf10-row" style={{ justifyContent: "center", margin:"10px 0" }}>
          <div style={{ display:"flex", gap:30 }}>
            <div>General Average: <span className="sf10-input" style={{ width:60, textAlign:"center", color:mColor }}>89.5</span></div>
            <div>Citation (if Any): <span className="sf10-input" style={{ width:150 }}></span></div>
          </div>
        </div>
        <div className="sf10-row">
          <div style={{ flex:1.5 }}>Name of Elementary School: <span className="sf10-input" style={{ width:"calc(100% - 145px)" }}>Sindalan Elem. School</span></div>
          <div style={{ flex:0.7 }}>School ID: <span className="sf10-input" style={{ width:"calc(100% - 55px)" }}>106294</span></div>
          <div style={{ flex:1.5 }}>Address of School: <span className="sf10-input" style={{ width:"calc(100% - 105px)" }}>Sindalan, CSFP</span></div>
        </div>
        <div style={{ marginTop:8, fontWeight:600, color:"#111" }}>Other Credential Presented</div>
        <div className="sf10-row" style={{ marginBottom: 16 }}>
          <div style={{ flex:1 }}>PEPT Passer &nbsp; Rating: <span className="sf10-input" style={{ width:50 }}></span></div>
          <div style={{ flex:1 }}>ALS A & E Passer &nbsp; Rating: <span className="sf10-input" style={{ width:50 }}></span></div>
          <div style={{ flex:1 }}>Others (Pls. Specify): <span className="sf10-input" style={{ width:"calc(100% - 115px)" }}></span></div>
        </div>

        {/* SCHOLASTIC RECORD */}
        {GRADES_DATA.map((gd, idx) => {
          const sg = FULL_ACADEMIC_HISTORY.map(h => ({ name:h.name, ...h[`gr${gd.grade}` as GradeLevel] }));
          const validSg = sg.filter(x => x.q1 !== undefined);
          const hasGrades = validSg.length > 0;
          
          let genAvg = 0;
          if(hasGrades) {
            const sum = validSg.reduce((a,b) => a + ((b.q1||0)+(b.q2||0)+(b.q3||0)+(b.q4||0))/(b.q4?4:3), 0);
            genAvg = Math.round(sum / validSg.length);
          }

          return (
            <div key={idx} style={{ marginBottom: 20 }}>
              <div className="sf10-title">SCHOLASTIC RECORD</div>
              <div className="sf10-row">
                <div style={{ flex:2.5 }}>School: <span className="sf10-input" style={{ width:"calc(100% - 45px)" }}>{hasGrades ? gd.school : ""}</span></div>
                <div style={{ flex:1 }}>School ID: <span className="sf10-input" style={{ width:"calc(100% - 55px)" }}>{hasGrades ? gd.id : ""}</span></div>
                <div style={{ flex:1.5 }}>District: <span className="sf10-input" style={{ width:"calc(100% - 45px)" }}>{hasGrades ? gd.dist : ""}</span></div>
                <div style={{ flex:1.5 }}>Division: <span className="sf10-input" style={{ width:"calc(100% - 50px)" }}>{hasGrades ? gd.div : ""}</span></div>
                <div style={{ flex:1 }}>Region: <span className="sf10-input" style={{ width:"calc(100% - 45px)" }}>{hasGrades ? gd.reg : ""}</span></div>
              </div>
              <div className="sf10-row" style={{ marginBottom: 10 }}>
                <div style={{ flex:1.2 }}>Classified as Grade: <span className="sf10-input" style={{ width:"calc(100% - 105px)", color:mColor }}>{hasGrades ? gd.grade : ""}</span></div>
                <div style={{ flex:0.7 }}>Section: <span className="sf10-input" style={{ width:"calc(100% - 50px)" }}>{hasGrades ? (gd.grade===s.grade ? s.section : "A") : ""}</span></div>
                <div style={{ flex:1.4 }}>School Year: <span className="sf10-input" style={{ width:"calc(100% - 70px)" }}>{hasGrades ? gd.sy : ""}</span></div>
                <div style={{ flex:2.2 }}>Name of Adviser/Teacher: <span className="sf10-input" style={{ width:"calc(100% - 135px)" }}>{hasGrades ? gd.adviser : ""}</span></div>
                <div style={{ flex:1.2 }}>Signature: <span className="sf10-input" style={{ width:"calc(100% - 60px)" }}></span></div>
              </div>

              <table className="sf10-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width:"35%", background:mColor, color:"#fff", border:`1px solid rgba(255,255,255,0.4)` }}>LEARNING AREAS</th>
                    <th colSpan={4} style={{ background:mColor, color:"#fff", border:`1px solid rgba(255,255,255,0.4)` }}>Quarterly Rating</th>
                    <th rowSpan={2} style={{ width:"10%", background:mColor, color:"#fff", border:`1px solid rgba(255,255,255,0.4)` }}>FINAL<br/>RATING</th>
                    <th rowSpan={2} style={{ width:"15%", background:mColor, color:"#fff", border:`1px solid rgba(255,255,255,0.4)` }}>REMARKS</th>
                  </tr>
                  <tr>
                    <th style={{ width:"10%", background:`${mColor}dd`, color:"#fff", border:`1px solid rgba(255,255,255,0.4)` }}>1</th>
                    <th style={{ width:"10%", background:`${mColor}dd`, color:"#fff", border:`1px solid rgba(255,255,255,0.4)` }}>2</th>
                    <th style={{ width:"10%", background:`${mColor}dd`, color:"#fff", border:`1px solid rgba(255,255,255,0.4)` }}>3</th>
                    <th style={{ width:"10%", background:`${mColor}dd`, color:"#fff", border:`1px solid rgba(255,255,255,0.4)` }}>4</th>
                  </tr>
                </thead>
                <tbody>
                  {FULL_ACADEMIC_HISTORY.map((subj, sIdx) => {
                    const r = subj[`gr${gd.grade}` as GradeLevel];
                    let avgStr = "";
                    let rem = "";
                    if (r && r.q1) {
                      const qCount = r.q4 ? 4 : 3;
                      const a = Math.round(((r.q1||0)+(r.q2||0)+(r.q3||0)+(r.q4||0))/qCount);
                      avgStr = a.toString();
                      rem = a >= 75 ? "Passed" : "Failed";
                    }
                    return (
                      <tr key={sIdx} style={{ background: sIdx%2===0?"#fff":`${mColor}06` }}>
                        <td style={{ textAlign:"left", paddingLeft:8, fontWeight:600, color:"#222" }}>{subj.name}</td>
                        <td className="text-center font-mono">{r?.q1 || ""}</td>
                        <td className="text-center font-mono">{r?.q2 || ""}</td>
                        <td className="text-center font-mono">{r?.q3 || ""}</td>
                        <td className="text-center font-mono">{r?.q4 || ""}</td>
                        <td className="text-center bold" style={{ fontSize:10, color:mColor }}>{avgStr}</td>
                        <td className="text-center" style={{ color: rem==="Failed"?"#ef4444":"#10b981", fontWeight:600 }}>{rem}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background:`${mColor}15` }}>
                    <td colSpan={5} style={{ textAlign:"right", paddingRight:16, color:mColor }} className="bold">General Average</td>
                    <td className="text-center bold" style={{ fontSize:11, color:mColor }}>{hasGrades ? genAvg : ""}</td>
                    <td className="text-center bold" style={{ color: (genAvg >= 75 || !hasGrades) ? mColor : "#ef4444" }}>{hasGrades ? (genAvg >= 75 ? "Promoted" : "Retained") : ""}</td>
                  </tr>
                </tbody>
              </table>
              
              {/* Remedial Classes */}
              <table className="sf10-table" style={{ marginTop:-8, borderTop:"none" }}>
                <thead>
                  <tr>
                    <th colSpan={5} style={{ textAlign:"left", background:"#fff", borderBottom:"none", borderTop:"none", fontWeight:"normal", paddingBottom:8 }}>
                      <div className="sf10-row" style={{ marginTop:6 }}>
                        <div style={{ flex:1 }}>Remedial Classes &nbsp;&nbsp;&nbsp;&nbsp; Conducted from (mm/dd/yyyy) <span className="sf10-input" style={{ width:100 }}></span></div>
                        <div style={{ flex:1 }}>to (mm/dd/yyyy) <span className="sf10-input" style={{ width:100 }}></span></div>
                      </div>
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width:"35%" }}>Learning Areas</th>
                    <th style={{ width:"15%" }}>Final Rating</th>
                    <th style={{ width:"20%" }}>Remedial Class Mark</th>
                    <th style={{ width:"15%" }}>Recomputed<br/>Final Grade</th>
                    <th style={{ width:"15%" }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* CERTIFICATION */}
        <div className="sf10-title" style={{ marginTop:30 }}>CERTIFICATION</div>
        <div style={{ marginTop:12, lineHeight: 1.6 }}>
          I CERTIFY that this is a true record of <span className="sf10-input text-center" style={{ width:250, color:mColor }}>{s.name}</span> with LRN <span className="sf10-input text-center" style={{ width:120, color:mColor }}>{s.lrn}</span> and that he/she is eligible for admission to Grade <span className="sf10-input text-center" style={{ width:50, color:mColor }}>11</span>.
        </div>
        <div className="sf10-row" style={{ marginTop:16 }}>
          <div style={{ flex:1 }}>Name of School: <span className="sf10-input" style={{ width:"calc(100% - 95px)" }}>Sindalan National High School</span></div>
          <div style={{ flex:0.7 }}>School ID: <span className="sf10-input" style={{ width:"calc(100% - 60px)" }}>300854</span></div>
          <div style={{ flex:1 }}>Last School Year Attended: <span className="sf10-input" style={{ width:"calc(100% - 135px)" }}>2025-2026</span></div>
        </div>
        <div style={{ marginTop:50, display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div className="text-center" style={{ width: 180 }}>
            <div className="sf10-input" style={{ width:"100%" }}></div>
            <div style={{ marginTop:4, color:"#555" }}>Date</div>
          </div>
          <div className="text-center" style={{ width: 300 }}>
            <div className="sf10-input" style={{ width:"100%", color:mColor, fontSize:14 }}>{s.adviser}</div>
            <div style={{ marginTop:4, color:"#555" }}>Signature of Principal/School Head over Printed Name</div>
          </div>
          <div className="text-center" style={{ width: 180 }}>
            <div style={{ width:100, height:100, border:`2px dashed ${mColor}50`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px", color:`${mColor}50`, fontSize:10 }}>(Affix School Seal Here)</div>
          </div>
        </div>

      </div>
    </div>
  );
}