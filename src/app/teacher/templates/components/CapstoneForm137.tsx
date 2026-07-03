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

  const Field = ({ label, value, flex = 1, width, labelStyle }: any) => (
    <div style={{ display: 'flex', alignItems: 'flex-end', flex: width ? 'none' : flex, width }}>
      <span style={{ whiteSpace: 'nowrap', ...labelStyle }}>{label}</span>
      <span style={{ flex: 1, borderBottom: '1px solid black', marginLeft: 4, minWidth: 20, height: 14, display: 'inline-block', color: '#000', fontWeight: 600, textAlign: 'center' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ background:"#fff", fontFamily:"Arial, sans-serif", width:"100%", maxWidth:900, margin:"0 auto", padding:"20px", boxSizing:"border-box", color:"#000", fontSize: 10, lineHeight: 1.2 }}>
      <style>{`
        .sf10-doc { color: #000; }
        .sf10-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .sf10-table th, .sf10-table td { border: 1px solid ${borderColor}; padding: 3px 4px; height: 18px; }
        .sf10-table th { background: #fff; font-weight: bold; text-align: center; }
        .sf10-row { display: flex; gap: 8px; margin-bottom: 6px; }
        @media print {
          .no-print { display: none !important; }
          .print-root { box-shadow: none !important; padding: 0 !important; }
          th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          div { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      
      <div className="sf10-doc">
        {/* Header */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <div style={{ position: "absolute", top: 0, left: 0, fontWeight: "bold", fontSize: 12 }}>SF10-JHS</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <div style={{ width: 80 }}>
              <div style={{ width:60, height:60, borderRadius:"50%", border:"1px solid #000", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9 }}>Logo</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 10 }}>Republic of the Philippines</div>
              <div style={{ fontSize: 10 }}>Department of Education</div>
              <div style={{ fontSize: 13, fontWeight: "bold", marginTop: 4 }}>Learner Permanent Record for Junior High School (SF10-JHS)</div>
              <div style={{ fontStyle: "italic", fontSize: 9 }}>(Formerly Form 137)</div>
            </div>
            <div style={{ width: 80, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
              <div style={{ fontSize: 24, fontWeight: "bold" }}>DepED</div>
            </div>
          </div>
        </div>

        {/* LEARNER'S INFORMATION */}
        <div style={{ border: "2px solid black", marginBottom: 8 }}>
          <div style={{ background: hBg, borderBottom: "2px solid black", textAlign: "center", fontWeight: "bold", padding: "3px 0", fontSize: 11 }}>LEARNER'S INFORMATION</div>
          <div style={{ padding: "6px 8px" }}>
            <div className="sf10-row">
              <Field label="LAST NAME:" value={s.name ? s.name.split(',')[0] : "Santos"} flex={2.5} />
              <Field label="FIRST NAME:" value={s.name ? s.name.split(',')[1]?.trim() : "Juan Miguel"} flex={2.5} />
              <Field label="NAME EXT. (Jr,I,II):" flex={1} />
              <Field label="MIDDLE NAME:" flex={2} />
            </div>
            <div className="sf10-row" style={{ marginBottom: 2 }}>
              <Field label="Learner Reference Number (LRN):" value={s.lrn || "100001"} flex={2} />
              <Field label="Birthdate (mm/dd/yyyy):" flex={2} />
              <Field label="Sex:" flex={1} />
            </div>
          </div>
        </div>

        {/* ELIGIBILITY FOR JHS ENROLMENT */}
        <div style={{ border: "2px solid black", marginBottom: 8 }}>
          <div style={{ background: hBg, borderBottom: "2px solid black", textAlign: "center", fontWeight: "bold", padding: "3px 0", fontSize: 11 }}>ELIGIBILITY FOR JHS ENROLMENT</div>
          <div style={{ padding: "6px 8px" }}>
            <div className="sf10-row" style={{ justifyContent: "center", marginBottom: 8 }}>
              <Field label="General Average:" width={200} />
              <div style={{ width: 40 }}></div>
              <Field label="Citation (if Any):" width={300} />
            </div>
            <div className="sf10-row">
              <Field label="Name of Elementary School:" flex={2.5} />
              <Field label="School ID:" flex={1} />
              <Field label="Address of School:" flex={2.5} />
            </div>
            <div style={{ marginTop: 6, marginBottom: 4 }}>Other Credential Presented</div>
            <div className="sf10-row">
              <Field label="PEPT Passer" labelStyle={{ marginRight: 8 }} value="" width={150} />
              <Field label="Rating:" width={100} />
              <Field label="ALS A & E Passer" labelStyle={{ marginRight: 8, marginLeft: 16 }} width={150} />
              <Field label="Rating:" width={100} />
              <Field label="Others (Pls. Specify):" flex={1} labelStyle={{ marginLeft: 16 }} />
            </div>
            <div className="sf10-row" style={{ marginTop: 6, marginBottom: 2 }}>
              <Field label="Date of Examination/Assessment (mm/dd/yyyy):" flex={1} />
              <Field label="Name and Address of Testing Center:" flex={1.5} labelStyle={{ marginLeft: 16 }} />
            </div>
          </div>
        </div>

        {/* SCHOLASTIC RECORD HEADER */}
        <div style={{ border: "2px solid black", background: hBg, textAlign: "center", fontWeight: "bold", padding: "3px 0", fontSize: 11, marginBottom: 4 }}>SCHOLASTIC RECORD</div>

        {/* GRADES BOXES */}
        {GRADES_DATA.map((gd, idx) => {
          return (
            <div key={idx} style={{ border: "2px solid black", marginBottom: 8 }}>
              <div style={{ padding: "6px 8px 4px 8px" }}>
                <div className="sf10-row">
                  <Field label="School:" value={gd.school} flex={2} />
                  <Field label="School ID:" value={gd.id} flex={1} />
                  <Field label="District:" value={gd.dist} flex={1} />
                  <Field label="Division:" value={gd.div} flex={1} />
                  <Field label="Region:" value={gd.reg} flex={1} />
                </div>
                <div className="sf10-row" style={{ marginBottom: 4 }}>
                  <Field label="Classified as Grade:" value={gd.grade ? gd.grade.toString() : ""} flex={1} />
                  <Field label="Section:" flex={1} />
                  <Field label="School Year:" value={gd.sy} flex={1} />
                  <Field label="Name of Adviser/Teacher:" value={gd.adviser} flex={2} />
                  <Field label="Signature:" flex={1} />
                </div>
              </div>

              <table className="sf10-table" style={{ borderLeft: "none", borderRight: "none" }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width:"35%", borderLeft: "none" }}>LEARNING AREAS</th>
                    <th colSpan={4}>Quarterly Rating</th>
                    <th rowSpan={2} style={{ width:"10%" }}>FINAL<br/>RATING</th>
                    <th rowSpan={2} style={{ width:"15%", borderRight: "none" }}>REMARKS</th>
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
                        <td style={{ paddingLeft: isIndent ? 20 : 4, fontStyle: isIndent ? "italic" : "normal", borderLeft: "none" }}>{subj}</td>
                        <td></td><td></td><td></td><td></td><td></td><td style={{ borderRight: "none" }}></td>
                      </tr>
                    );
                  })}
                  <tr><td style={{ borderLeft: "none" }}>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td style={{ borderRight: "none" }}></td></tr>
                  <tr><td style={{ borderLeft: "none" }}>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td style={{ borderRight: "none" }}></td></tr>
                  <tr><td style={{ borderLeft: "none" }}>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td style={{ borderRight: "none" }}></td></tr>
                  <tr>
                    <td style={{ textAlign: "center", fontWeight: "bold", borderLeft: "none" }}>General Average</td>
                    <td colSpan={4}></td>
                    <td style={{ textAlign: "center" }}></td>
                    <td style={{ borderRight: "none" }}></td>
                  </tr>
                </tbody>
              </table>
              
              <table className="sf10-table" style={{ borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
                <thead>
                  <tr>
                    <th colSpan={5} style={{ textAlign:"left", fontWeight:"normal", borderLeft: "none", borderRight: "none" }}>
                      <div className="sf10-row" style={{ margin: "4px 8px" }}>
                        <Field label="Remedial Classes" labelStyle={{ marginRight: 16 }} flex={0} />
                        <Field label="Conducted from (mm/dd/yyyy)" width={120} />
                        <Field label="to (mm/dd/yyyy)" width={120} />
                      </div>
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width:"35%", borderLeft: "none" }}>Learning Areas</th>
                    <th style={{ width:"15%" }}>Final Rating</th>
                    <th style={{ width:"20%" }}>Remedial Class Mark</th>
                    <th style={{ width:"15%" }}>Recomputed<br/>Final Grade</th>
                    <th style={{ width:"15%", borderRight: "none" }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td style={{ borderLeft: "none" }}>&nbsp;</td><td></td><td></td><td></td><td style={{ borderRight: "none" }}></td></tr>
                  <tr><td style={{ borderLeft: "none", borderBottom: "none" }}>&nbsp;</td><td style={{ borderBottom: "none" }}></td><td style={{ borderBottom: "none" }}></td><td style={{ borderBottom: "none" }}></td><td style={{ borderRight: "none", borderBottom: "none" }}></td></tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* CERTIFICATION */}
        <div style={{ border: "2px solid black", marginTop: 16 }}>
          <div style={{ background: hBg, borderBottom: "2px solid black", textAlign: "center", fontWeight: "bold", padding: "3px 0", fontSize: 11 }}>CERTIFICATION</div>
          <div style={{ padding: "8px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", lineHeight: 1.8, marginBottom: 8 }}>
              <span>I CERTIFY that this is a true record of</span>
              <span style={{ borderBottom: "1px solid black", flex: 1, minWidth: 200, margin: "0 8px" }}></span>
              <span>with LRN</span>
              <span style={{ borderBottom: "1px solid black", width: 120, margin: "0 8px" }}></span>
              <span>and that he/she is eligible for admission to Grade</span>
              <span style={{ borderBottom: "1px solid black", width: 60, marginLeft: 8 }}></span>
            </div>
            
            <div className="sf10-row" style={{ marginBottom: 32 }}>
              <Field label="Name of School:" flex={2.5} />
              <Field label="School ID:" flex={1} />
              <Field label="Last School Year Attended:" flex={2} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 20px" }}>
              <div style={{ width: 200, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid black", height: 14, width: "100%" }}></div>
                <div style={{ marginTop: 4 }}>Date</div>
              </div>
              <div style={{ width: 350, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid black", height: 14, width: "100%" }}></div>
                <div style={{ marginTop: 4 }}>Signature of Principal/School Head over Printed Name</div>
              </div>
              <div style={{ width: 200, textAlign: "center" }}>
                <div style={{ fontSize: 10 }}>(Affix School Seal Here)</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}