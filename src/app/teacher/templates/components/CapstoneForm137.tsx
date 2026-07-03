import React from 'react';
import { C } from '../../../shared/constants/tokens';
import { GradeLevel } from '../../../shared/types';
import { FULL_ACADEMIC_HISTORY } from '../TemplateHubScreen';

/* ─── Full StudentReportCard (Modern SF10-JHS format) ─── */
/* ─── Full StudentReportCard (Modern SF10-JHS format) ─── */
export function CapstoneForm137({ student }: { student?: { name:string; lrn:string; grade:number; section:string; adviser:string } }) {
  const s = student ?? { name:"", lrn:"", grade:0, section:"", adviser:"" };
  
  const GRADES_DATA = [
    { grade: 7, sy: "", school: "", id: "", dist: "", div: "", reg: "", adviser: "" },
    { grade: 8, sy: "", school: "", id: "", dist: "", div: "", reg: "", adviser: "" },
    { grade: 9, sy: "", school: "", id: "", dist: "", div: "", reg: "", adviser: "" },
    { grade: 10, sy: "", school: "", id: "", dist: "", div: "", reg: "", adviser: "" }
  ];

  const BLANK_SUBJECTS = [
    "Filipino", "English", "Mathematics", "Science", "Araling Panlipunan (AP)",
    "Edukasyon sa Pagpapakatao (EsP)", "Technology and Livelihood Education (TLE)",
    "MAPEH", "Music", "Arts", "Physical Education", "Health"
  ];

  const hBg = "#d8e1cc"; // light green background for headers
  const borderColor = "#000";

  return (
    <div style={{ background:"#fff", fontFamily:"Arial, sans-serif", width:"100%", maxWidth:900, margin:"0 auto", padding:"20px", boxSizing:"border-box", color:"#000" }}>
      <style>{`
        .sf10-doc { font-size: 10px; line-height: 1.3; color: #000; }
        .sf10-doc .bold { font-weight: 700; }
        .sf10-doc .text-center { text-align: center; }
        .sf10-title { background: ${hBg}; color: #000; font-weight: 700; text-align: center; padding: 4px; font-size: 11px; margin: 4px 0; border: 2px solid ${borderColor}; }
        .sf10-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; font-size: 9px; }
        .sf10-table th, .sf10-table td { border: 1px solid ${borderColor}; padding: 3px 4px; }
        .sf10-table th { background: #fff; font-weight: 700; text-align: center; color: #000; }
        .sf10-input { border-bottom: 1px solid #000; display: inline-block; padding: 0 4px; font-weight: 600; color: #000; font-size: 11px; white-space: nowrap; height: 14px; }
        .sf10-row { display: flex; align-items: flex-end; margin-bottom: 4px; gap: 8px; color: #000; }
        .sf10-box { border: 2px solid ${borderColor}; padding: 4px; margin-bottom: 8px; }
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
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, position: "relative" }}>
          <div style={{ width:70 }}>
            {/* Kagawaran ng Edukasyon Logo Placeholder */}
            <div style={{ width:60, height:60, border:"1px solid #000", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, textAlign:"center" }}>Logo</div>
          </div>
          <div className="text-center" style={{ flex: 1 }}>
            <div style={{ fontSize: 9 }}>Republic of the Philippines</div>
            <div style={{ fontSize: 10 }}>Department of Education</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>Learner Permanent Record for Junior High School (SF10-JHS)</div>
            <div style={{ fontStyle: "italic", fontSize: 9 }}>(Formerly Form 137)</div>
          </div>
          <div style={{ width:70, display: "flex", justifyContent: "flex-end" }}>
            {/* DepEd Logo Placeholder */}
            <div style={{ fontSize:20, fontWeight:"bold", color:"#000" }}>DepED</div>
          </div>
          <div style={{ position: "absolute", top: 0, left: 0, fontSize: 11, fontWeight: "bold" }}>SF10-JHS</div>
        </div>

        {/* LEARNER'S INFORMATION */}
        <div className="sf10-title">LEARNER'S INFORMATION</div>
        <div className="sf10-row">
          <div style={{ flex:2 }}>LAST NAME: <span className="sf10-input" style={{ width:"calc(100% - 70px)" }}>{s.name.split(',')[0] || ""}</span></div>
          <div style={{ flex:2 }}>FIRST NAME: <span className="sf10-input" style={{ width:"calc(100% - 75px)" }}>{s.name.split(',')[1]?.trim() || ""}</span></div>
          <div style={{ flex:1 }}>NAME EXT. (Jr,I,II): <span className="sf10-input" style={{ width:"calc(100% - 110px)" }}></span></div>
          <div style={{ flex:1.5 }}>MIDDLE NAME: <span className="sf10-input" style={{ width:"calc(100% - 85px)" }}></span></div>
        </div>
        <div className="sf10-row" style={{ marginBottom: 8 }}>
          <div style={{ flex:2 }}>Learner Reference Number (LRN): <span className="sf10-input" style={{ width:"calc(100% - 180px)" }}>{s.lrn}</span></div>
          <div style={{ flex:2.5 }}>Birthdate (mm/dd/yyyy): <span className="sf10-input" style={{ width:"calc(100% - 130px)" }}></span></div>
          <div style={{ flex:1.5 }}>Sex: <span className="sf10-input" style={{ width:"calc(100% - 30px)" }}></span></div>
        </div>

        {/* ELIGIBILITY FOR JHS ENROLMENT */}
        <div className="sf10-title">ELIGIBILITY FOR JHS ENROLMENT</div>
        <div className="sf10-box">
          <div className="sf10-row" style={{ justifyContent: "center" }}>
            <div style={{ marginRight: 40 }}>General Average: <span className="sf10-input" style={{ width:80 }}></span></div>
            <div>Citation (if Any): <span className="sf10-input" style={{ width:200 }}></span></div>
          </div>
          <div className="sf10-row">
            <div style={{ flex:2 }}>Name of Elementary School: <span className="sf10-input" style={{ width:"calc(100% - 150px)" }}></span></div>
            <div style={{ flex:1 }}>School ID: <span className="sf10-input" style={{ width:"calc(100% - 60px)" }}></span></div>
            <div style={{ flex:2 }}>Address of School: <span className="sf10-input" style={{ width:"calc(100% - 110px)" }}></span></div>
          </div>
          <div style={{ marginTop: 4 }}>Other Credential Presented</div>
          <div className="sf10-row">
            <div style={{ flex:1.2 }}>PEPT Passer &nbsp; Rating: <span className="sf10-input" style={{ width:60 }}></span></div>
            <div style={{ flex:1.2 }}>ALS A & E Passer &nbsp; Rating: <span className="sf10-input" style={{ width:60 }}></span></div>
            <div style={{ flex:2 }}>Others (Pls. Specify): <span className="sf10-input" style={{ width:"calc(100% - 120px)" }}></span></div>
          </div>
          <div className="sf10-row" style={{ marginTop: 4 }}>
            <div style={{ flex: 1 }}>Date of Examination/Assessment (mm/dd/yyyy): <span className="sf10-input" style={{ width:"calc(100% - 260px)" }}></span></div>
            <div style={{ flex: 1 }}>Name and Address of Testing Center: <span className="sf10-input" style={{ width:"calc(100% - 200px)" }}></span></div>
          </div>
        </div>

        <div className="sf10-title" style={{ marginBottom: 0 }}>SCHOLASTIC RECORD</div>

        {/* Render Scholastic Records (2 per row for real size, but we'll stack them as in PDF) */}
        {GRADES_DATA.map((gd, idx) => {
          return (
            <div key={idx} className="sf10-box" style={{ marginTop: -2, borderTop: "none" }}>
              <div className="sf10-row">
                <div style={{ flex:2 }}>School: <span className="sf10-input" style={{ width:"calc(100% - 45px)" }}>{gd.school}</span></div>
                <div style={{ flex:1 }}>School ID: <span className="sf10-input" style={{ width:"calc(100% - 60px)" }}>{gd.id}</span></div>
                <div style={{ flex:1 }}>District: <span className="sf10-input" style={{ width:"calc(100% - 45px)" }}>{gd.dist}</span></div>
                <div style={{ flex:1 }}>Division: <span className="sf10-input" style={{ width:"calc(100% - 50px)" }}>{gd.div}</span></div>
                <div style={{ flex:1 }}>Region: <span className="sf10-input" style={{ width:"calc(100% - 45px)" }}>{gd.reg}</span></div>
              </div>
              <div className="sf10-row" style={{ marginBottom: 4 }}>
                <div style={{ flex:1 }}>Classified as Grade: <span className="sf10-input" style={{ width:"calc(100% - 110px)" }}>{gd.grade || ""}</span></div>
                <div style={{ flex:0.7 }}>Section: <span className="sf10-input" style={{ width:"calc(100% - 55px)" }}></span></div>
                <div style={{ flex:1 }}>School Year: <span className="sf10-input" style={{ width:"calc(100% - 75px)" }}>{gd.sy}</span></div>
                <div style={{ flex:1.5 }}>Name of Adviser/Teacher: <span className="sf10-input" style={{ width:"calc(100% - 140px)" }}>{gd.adviser}</span></div>
                <div style={{ flex:1 }}>Signature: <span className="sf10-input" style={{ width:"calc(100% - 60px)" }}></span></div>
              </div>

              <table className="sf10-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width:"40%" }}>LEARNING AREAS</th>
                    <th colSpan={4}>Quarterly Rating</th>
                    <th rowSpan={2} style={{ width:"10%" }}>FINAL<br/>RATING</th>
                    <th rowSpan={2} style={{ width:"15%" }}>REMARKS</th>
                  </tr>
                  <tr>
                    <th style={{ width:"8%" }}>1</th>
                    <th style={{ width:"8%" }}>2</th>
                    <th style={{ width:"8%" }}>3</th>
                    <th style={{ width:"8%" }}>4</th>
                  </tr>
                </thead>
                <tbody>
                  {BLANK_SUBJECTS.map((subj, sIdx) => {
                    const isIndent = ["Music", "Arts", "Physical Education", "Health"].includes(subj);
                    return (
                      <tr key={sIdx}>
                        <td style={{ paddingLeft: isIndent ? 16 : 4, fontStyle: isIndent ? "italic" : "normal" }}>{subj}</td>
                        <td></td><td></td><td></td><td></td><td></td><td></td>
                      </tr>
                    );
                  })}
                  {/* Extra blank rows */}
                  <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                  <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                  <tr>
                    <td colSpan={5} className="bold text-center">General Average</td>
                    <td className="text-center bold"></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              
              {/* Remedial Classes */}
              <table className="sf10-table">
                <thead>
                  <tr>
                    <th colSpan={5} style={{ textAlign:"left", fontWeight:"normal", borderBottom:"none" }}>
                      <div className="sf10-row" style={{ margin: 2 }}>
                        <div style={{ flex:1 }}>Remedial Classes &nbsp;&nbsp;&nbsp;&nbsp; Conducted from (mm/dd/yyyy) <span className="sf10-input" style={{ width:120 }}></span></div>
                        <div style={{ flex:1 }}>to (mm/dd/yyyy) <span className="sf10-input" style={{ width:120 }}></span></div>
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
                  <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* CERTIFICATION */}
        <div className="sf10-title" style={{ marginTop:16 }}>CERTIFICATION</div>
        <div className="sf10-box">
          <div style={{ margin: "8px 0", lineHeight: 1.8 }}>
            I CERTIFY that this is a true record of <span className="sf10-input text-center" style={{ width:300 }}></span> with LRN <span className="sf10-input text-center" style={{ width:150 }}></span> and that he/she is eligible for admission to Grade <span className="sf10-input text-center" style={{ width:80 }}></span>.
          </div>
          <div className="sf10-row">
            <div style={{ flex:2 }}>Name of School: <span className="sf10-input" style={{ width:"calc(100% - 100px)" }}></span></div>
            <div style={{ flex:1 }}>School ID: <span className="sf10-input" style={{ width:"calc(100% - 65px)" }}></span></div>
            <div style={{ flex:2 }}>Last School Year Attended: <span className="sf10-input" style={{ width:"calc(100% - 150px)" }}></span></div>
          </div>
          <div style={{ marginTop:40, display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
            <div className="text-center" style={{ width: 200 }}>
              <div className="sf10-input" style={{ width:"100%" }}></div>
              <div style={{ marginTop:4 }}>Date</div>
            </div>
            <div className="text-center" style={{ width: 350 }}>
              <div className="sf10-input" style={{ width:"100%" }}></div>
              <div style={{ marginTop:4 }}>Signature of Principal/School Head over Printed Name</div>
            </div>
            <div className="text-center" style={{ width: 200 }}>
              <div style={{ fontSize:10 }}>(Affix School Seal Here)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}