import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Stethoscope, ChevronDown, Search, X } from 'lucide-react';


import { GradebookFullScreen } from '../grades/GradebookFullScreen';
import { Stamp } from '../../shared/components/Stamp';
import { gradeColor } from '../../shared/utils/helpers';
import { RC_SUBJECTS } from '../../shared/constants/seedData';

import { apiClient } from '../../../api/client';

/* ─── StudentGradeCard - right-side drawer, no navigation ──── */
interface GradeCardInfo { name:string; section:string; grade:number; }

function StudentGradeCard({ student, onClose }:{ student:GradeCardInfo, onClose:()=>void }) {
  const subs = RC_SUBJECTS;
  function fa(sg:{term1:number,term2:number,term3:number}) { return Math.round((sg.term1+sg.term2+sg.term3)/3*10)/10; }
  const genAvg = Math.round(subs.reduce((s,sg)=>s+fa(sg),0)/subs.length*10)/10;
  const allPassed = genAvg >= 75;
  const initials = student.name.split(",")[0]?.[0] ?? "S";

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(10,5,5,0.45)" }} />

      {/* Drawer panel */}
      <div style={{ position:"fixed", top:0, right:0, bottom:0, zIndex:401, width:440, background:"#fff", display:"flex", flexDirection:"column", boxShadow:"-8px 0 40px rgba(74,10,16,0.25)", overflow:"hidden" }}>

        {/* Header band */}
        <div style={{ background:C.m800, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <div style={{ width:42, height:42, borderRadius:30, background:C.m600, border:`2px solid ${C.gold}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ fontSize:13, fontWeight:800, color:C.gold }}>{initials}</span>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:"#fff", fontSize:15, fontWeight:700, fontFamily:"'Fraunces',serif", lineHeight:1.2 }}>{student.name}</div>
            <div style={{ color:"rgba(255,255,255,0.55)", fontSize:10, marginTop:2 }}>Grade {student.grade} - {student.section} · SY 2025–2026</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:4, background:"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.7)", flexShrink:0 }}>
            <X size={16}/>
          </button>
        </div>

        {/* General average band */}
        <div style={{ background:allPassed?C.greenBg:C.redBg, borderBottom:`1px solid ${allPassed?"rgba(22,101,52,0.2)":"rgba(153,27,27,0.2)"}`, padding:"10px 16px", display:"flex", alignItems:"center", gap:14 }}>
          <div>
            <div style={{ fontSize:9, color:allPassed?C.green:C.red, textTransform:"uppercase", letterSpacing:"0.09em", fontWeight:700, marginBottom:2 }}>General Average</div>
            <div style={{ fontSize:32, fontWeight:800, color:allPassed?C.green:C.red, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1 }}>{genAvg.toFixed(1)}</div>
          </div>
          <div style={{ width:1, height:40, background:allPassed?"rgba(22,101,52,0.2)":"rgba(153,27,27,0.2)" }}/>
          <div>
            <Stamp label={allPassed?"PROMOTED":"AT RISK"} color={allPassed?"#fff":C.red} bg={allPassed?C.green:C.redBg} />
            <div style={{ fontSize:10, color:allPassed?C.green:C.red, marginTop:5 }}>{subs.filter(sg=>fa(sg)<75).length} failing subject{subs.filter(sg=>fa(sg)<75).length!==1?"s":""}</div>
          </div>
          <div style={{ marginLeft:"auto", fontSize:9, color:allPassed?C.green:C.red, fontStyle:"italic" }}>Read-only view</div>
        </div>

        {/* Subject grades table */}
        <div style={{ flex:1, minHeight: 0, overflowY:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead style={{ position:"sticky", top:0, zIndex:2 }}>
              <tr style={{ background:C.m700 }}>
                <th style={{ textAlign:"left", padding:"8px 14px", fontSize:9, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.09em" }}>Subject</th>
                {["T1","T2","T3"].map(q=>(
                  <th key={q} style={{ textAlign:"center", padding:"8px 6px", fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.85)", textTransform:"uppercase", letterSpacing:"0.07em", borderLeft:`0.5px solid rgba(255,255,255,0.15)` }}>{q}</th>
                ))}
                <th style={{ textAlign:"center", padding:"8px 8px", fontSize:9, fontWeight:700, color:C.gold, textTransform:"uppercase", letterSpacing:"0.07em", borderLeft:`1px solid rgba(255,255,255,0.25)` }}>Final Avg</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sg,i)=>{
                const avg = fa(sg);
                const fail = avg < 75;
                return (
                  <tr key={sg.name} style={{ borderBottom:`0.5px solid ${C.border}`, background:fail?`${C.redBg}60`:i%2===0?"#fff":C.paper }}>
                    <td style={{ padding:"9px 14px" }}>
                      <div style={{ fontSize:12, fontWeight:fail?600:400, color:fail?C.red:C.t1 }}>{sg.name}</div>
                    </td>
                    {[sg.term1,sg.term2,sg.term3].map((g,j)=>(
                      <td key={j} style={{ textAlign:"center", padding:"9px 6px", borderLeft:`0.5px solid ${C.border}` }}>
                        <span style={gradeColor(g)}>{g}</span>
                      </td>
                    ))}
                    <td style={{ textAlign:"center", padding:"9px 8px", borderLeft:`1px solid ${C.borderMed}` }}>
                      <span style={{ fontSize:14, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:fail?C.red:avg>=90?C.green:C.t1 }}>{avg.toFixed(1)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer note */}
          <div style={{ padding:"12px 14px", borderTop:`1px solid ${C.borderMed}`, background:C.paper }}>
            <div style={{ fontSize:10, color:C.t3, fontStyle:"italic" }}>To edit grades, use the <strong>Grades</strong> tab and select the subject's ledger. This panel is for quick reference only.</div>
          </div>
        </div>
      </div>
    </>
  );
}



/* ─── ClinicVisitsScreen ─────────────────────────────────── */
export function ClinicVisitsScreen() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("All sections");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<{ id: string, name: string, section: string, lrn: string } | null>(null);

  React.useEffect(() => {
    apiClient.get('/student-services/clinic')
      .then(res => {
        setRecords(res || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  
  const filtered = records.filter(r => {
    const studentName = r.student ? `${r.student.last_name}, ${r.student.first_name}` : "Unknown Student";
    // We don't have section natively on clinic records without joining more data, we'll just mock section for now or ignore
    const matchSearch = !search || studentName.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background: "transparent" }}>
      {/* Controls */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.borderMed}`, padding:"9px 18px", display:"flex", alignItems:"center", gap:12, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ position:"relative" }}>
          <select value={section} onChange={e=>setSection(e.target.value)}
            style={{ border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"5px 26px 5px 9px", fontSize:12, color:C.t1, background:"#fff", outline:"none", appearance:"none", cursor:"pointer" }}>
            <option>All sections</option>
            <option>Gr. 8 Rizal</option>
            <option>Gr. 9 Einstein</option>
            <option>Gr. 10 Pilot</option>
          </select>
          <ChevronDown size={11} style={{ position:"absolute", right:7, top:"50%", transform:"translateY(-50%)", color:C.t3, pointerEvents:"none" }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:7, background: "transparent", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"5px 10px", flex:1, maxWidth:260 }}>
          <Search size={12} color={C.t3} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student…" style={{ border:"none", background:"transparent", outline:"none", fontSize:12, color:C.t1, flex:1 }} />
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <Stamp label="Read-only - clinic records are managed by the school nurse" color={C.teal} bg={C.tealBg} />
        </div>
      </div>

      {/* Table */}
      <div style={{ flex:1, overflow:"auto" }}>
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, margin:16, overflow:"hidden" }}>
          {/* Doc header */}
          <div style={{ background:C.m800, padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
            <Stethoscope size={14} color="rgba(255,255,255,0.7)" />
            <span style={{ color:"#fff", fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif", flex:1 }}>Clinic Visit Records - {section}</span>
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{filtered.length} records · June 2025</span>
          </div>

          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                {["Student","Date & Time","Symptoms","Diagnosis","Treatments","Nurse","Vitals","Action"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"8px 12px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={9} style={{ padding:"28px", textAlign:"center", fontSize:12, color:C.t3 }}>No clinic visit records for this section.</td></tr>
              ) : filtered.map((r,i) => {
                const studentName = r.student ? `${r.student.last_name}, ${r.student.first_name}` : "Unknown";
                const dateStr = new Date(r.date).toLocaleDateString();
                const timeStr = r.time ? new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                
                return (
                  <tr key={r.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                    <td style={{ padding:"9px 12px", fontWeight:600, color:C.t1, fontSize:12, whiteSpace:"nowrap" }}>{studentName}</td>
                    <td style={{ padding:"9px 12px", fontSize:11, color:C.t2, fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap" }}>{dateStr} {timeStr}</td>
                    <td style={{ padding:"9px 12px", fontSize:12, color:C.t2, maxWidth:200 }}>{r.symptoms || "-"}</td>
                    <td style={{ padding:"9px 12px", fontSize:11, color:C.t2, maxWidth:180 }}>{r.diagnosis || "-"}</td>
                    <td style={{ padding:"9px 12px", fontSize:11, color:C.t2, maxWidth:180 }}>{r.treatments || "-"}</td>
                    <td style={{ padding:"9px 12px", fontSize:11, color:C.t3 }}>{r.recorded_by || "Nurse"}</td>
                    <td style={{ padding:"9px 12px" }}>
                      {(r.temperature || r.blood_pressure || r.heart_rate) ? (
                        <div style={{ fontSize: 10, color: C.t2 }}>
                          {r.temperature && <div>Temp: {r.temperature}°C</div>}
                          {r.blood_pressure && <div>BP: {r.blood_pressure}</div>}
                          {r.heart_rate && <div>HR: {r.heart_rate}bpm</div>}
                        </div>
                      ) : "-"}
                    </td>
                    <td style={{ padding:"9px 12px" }}>
                      <button onClick={()=>setSelectedStudent({id: r.student_id, name: studentName, section: "Grade 10", lrn: r.student?.lrn || ""})} style={{ fontSize:10, fontWeight:600, color:C.teal, background:C.tealBg, border:`1px solid rgba(20,184,166,0.3)`, borderRadius:4, padding:"4px 8px", cursor:"pointer", whiteSpace:"nowrap" }}>History</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Summary footer */}
          <div style={{ background:C.m50, borderTop:`1px solid ${C.borderMed}`, padding:"8px 14px", display:"flex", gap:20, alignItems:"center" }}>
            <span style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em" }}>Summary</span>
            {[
              ["Total visits", records.length, C.t2],
            ].map(([l,v,c])=>(
              <div key={l as string} style={{ display:"flex", gap:5, alignItems:"baseline" }}>
                <span style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.07em" }}>{l as string}</span>
                <span style={{ fontSize:15, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:c as string }}>{v}</span>
              </div>
            ))}
            <span style={{ marginLeft:"auto", fontSize:10, color:C.t3, fontStyle:"italic" }}>Data managed by school nurse · View only</span>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {selectedStudent && (
        <StudentMedicalHistoryCard student={selectedStudent} onClose={()=>setSelectedStudent(null)} />
      )}
    </div>
  );
}

/* ─── StudentMedicalHistoryCard ────────────────────────────── */
function StudentMedicalHistoryCard({ student, onClose }:{ student:{ id: string, name: string, section: string, lrn: string }, onClose:()=>void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  React.useEffect(() => {
    // Fetch the real history for this specific student
    apiClient.get(`/student-services/clinic/${student.id}`)
      .then(res => setHistory(res || []))
      .catch(console.error);
    
    // Attempt to fetch profile (if we had a student-specific profile endpoint, but we don't, so we'll mock profile or leave it blank if not current user)
    // For now we'll just show the history.
  }, [student.id]);

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(10,5,5,0.45)" }} />
      <div style={{ position:"fixed", top:0, right:0, bottom:0, zIndex:401, width:480, background:"#fff", display:"flex", flexDirection:"column", boxShadow:"-8px 0 40px rgba(74,10,16,0.25)", overflow:"hidden" }}>
        <div style={{ background:C.teal, padding:"16px 20px", display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <div style={{ width:46, height:46, borderRadius:23, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Stethoscope size={22} color={C.teal} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:"#fff", fontSize:18, fontWeight:700, fontFamily:"'Fraunces',serif", lineHeight:1.2 }}>{student.name}</div>
            <div style={{ color:"rgba(255,255,255,0.7)", fontSize:11, marginTop:2 }}>{student.lrn ? `LRN: ${student.lrn} · ` : ''}{student.section}</div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:16, background:"rgba(255,255,255,0.2)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", flexShrink:0 }}>
            <X size={18}/>
          </button>
        </div>
        <div style={{ padding:"20px", borderBottom:`1px solid ${C.borderMed}`, background:C.paper }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.t1, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:12 }}>Medical Profile</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div>
              <div style={{ fontSize:10, color:C.t3, marginBottom:4 }}>Allergies</div>
              <div style={{ fontSize:13, fontWeight:600, color:profile.allergies!=="None known"?C.red:C.t1 }}>{profile.allergies}</div>
            </div>
            <div>
              <div style={{ fontSize:10, color:C.t3, marginBottom:4 }}>Blood Type</div>
              <div style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{profile.bloodType}</div>
            </div>
            <div style={{ gridColumn:"1 / -1" }}>
              <div style={{ fontSize:10, color:C.t3, marginBottom:4 }}>Emergency Contact</div>
              <div style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{profile.contact}</div>
            </div>
          </div>
        </div>
        <div style={{ flex:1, minHeight: 0, overflowY:"auto", padding:"20px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.t1, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:16 }}>Clinic Visit History</div>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {history.map((h, i) => {
              const dateStr = new Date(h.date).toLocaleDateString();
              const timeStr = h.time ? new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              return (
              <div key={i} style={{ borderLeft:`2px solid ${C.borderMed}`, paddingLeft:16, position:"relative" }}>
                <div style={{ position:"absolute", left:-6, top:0, width:10, height:10, borderRadius:5, background:C.teal, border:"2px solid #fff" }} />
                <div style={{ fontSize:10, fontWeight:700, color:C.t2, fontFamily:"'JetBrains Mono',monospace", marginBottom:4 }}>{dateStr} · {timeStr}</div>
                <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:6, padding:"12px" }}>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.t3, marginBottom:2 }}>Symptoms</div>
                    <div style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{h.symptoms || "None recorded"}</div>
                  </div>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.t3, marginBottom:2 }}>Diagnosis & Treatments</div>
                    <div style={{ fontSize:12, color:C.t1 }}>
                      {h.diagnosis && <div>Diagnosis: {h.diagnosis}</div>}
                      {h.treatments && <div>Treatments: {h.treatments}</div>}
                      {h.medications && <div>Medications: {h.medications}</div>}
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10, paddingTop:10, borderTop:`1px solid ${C.borderMed}` }}>
                    <div style={{ fontSize:11, color:C.t3 }}>Attended by: <span style={{ fontWeight:600, color:C.t2 }}>{h.recorded_by || "Nurse"}</span></div>
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>
    </>
  );
}