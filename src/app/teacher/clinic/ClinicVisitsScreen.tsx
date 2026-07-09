import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Stethoscope, ChevronDown, Search, X } from 'lucide-react';
import { STUDENTS_GR8 } from '../../App';
import { AttendanceHub } from '../attendance/AttendanceHub';
import { GradebookFullScreen } from '../grades/GradebookFullScreen';
import { Stamp } from '../../shared/components/Stamp';
import { gradeColor } from '../../shared/utils/helpers';
import { RC_SUBJECTS } from '../../shared/constants/seedData';

const CLINIC_DATA = [
  { id:"200001", name:"Aguilar, Liza Marie",  section:"Gr. 8 Rizal",    date:"Jun 10 · 9:14 AM",  complaint:"Headache, dizziness",       action:"Rest given, paracetamol",      by:"Nurse Reyes", status:"Discharged", excused:true  },
  { id:"200005", name:"Espino, Hannah Grace", section:"Gr. 8 Rizal",    date:"Jun 10 · 10:02 AM", complaint:"Stomach ache",              action:"Rest, warm compress",          by:"Nurse Reyes", status:"Monitoring", excused:false },
  { id:"200002", name:"Bondoc, Ramon Jr.",    section:"Gr. 8 Rizal",    date:"Jun 9 · 2:30 PM",   complaint:"Cuts from PE activity",     action:"First aid, bandaged",          by:"Nurse Reyes", status:"Discharged", excused:false },
  { id:"200008", name:"Hernandez, Mark Ryan", section:"Gr. 8 Rizal",   date:"Jun 8 · 11:20 AM",  complaint:"Fever, flu-like symptoms",  action:"Advised to go home",           by:"Nurse Reyes", status:"Sent home",  excused:true  },
  { id:"200011", name:"Torres, Bea Angelica", section:"Gr. 9 Einstein", date:"Jun 7 · 8:45 AM",   complaint:"Severe migraine",           action:"Rest in clinic, called parent",by:"Nurse Reyes", status:"Sent home",  excused:true  },
  { id:"200014", name:"Reyes, Carlo Jose",    section:"Gr. 9 Einstein", date:"Jun 5 · 1:15 PM",   complaint:"Sprained ankle",           action:"Ice pack, wrapped",            by:"Nurse Reyes", status:"Discharged", excused:false },
  { id:"200021", name:"Santos, Juan Miguel",  section:"Gr. 10 Pilot",   date:"Jun 3 · 9:00 AM",   complaint:"Allergic reaction",        action:"Antihistamine given, rest",    by:"Nurse Reyes", status:"Discharged", excused:false },
];

/* ─── StudentGradeCard - right-side drawer, no navigation ──── */
interface GradeCardInfo { name:string; section:string; grade:number; }

function StudentGradeCard({ student, onClose }:{ student:GradeCardInfo, onClose:()=>void }) {
  const subs = RC_SUBJECTS;
  function fa(sg:{q1:number,q2:number,q3:number}) { return Math.round((sg.q1+sg.q2+sg.q3)/3*10)/10; }
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
        <div style={{ flex:1, overflowY:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead style={{ position:"sticky", top:0, zIndex:2 }}>
              <tr style={{ background:C.m700 }}>
                <th style={{ textAlign:"left", padding:"8px 14px", fontSize:9, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.09em" }}>Subject</th>
                {["Q1","Q2","Q3"].map(q=>(
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
                    {[sg.q1,sg.q2,sg.q3].map((g,j)=>(
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

/* ─── GradesDirectScreen ──────────────────────────────────── */
function GradesDirectScreen() {
  return <GradebookFullScreen onBack={()=>{}} hideBack />;
}

/* ─── AttendanceDirectScreen ─────────────────────────────── */
function AttendanceDirectScreen() {
  const [section, setSection] = useState("Gr. 8 Rizal");
  const studentsForSection = section.includes("8") ? STUDENTS_GR8 : STUDENTS_GR8; // all use same dataset for demo
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background: "transparent" }}>
      {/* Section selector header */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.borderMed}`, padding:"9px 18px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <span style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em" }}>Section</span>
        <div style={{ position:"relative" }}>
          <select value={section} onChange={e=>setSection(e.target.value)}
            style={{ border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"5px 26px 5px 9px", fontSize:12, color:C.t1, background:"#fff", outline:"none", appearance:"none", cursor:"pointer" }}>
            <option>Gr. 8 Rizal</option>
            <option>Gr. 9 Einstein</option>
            <option>Gr. 10 Pilot</option>
          </select>
          <ChevronDown size={11} style={{ position:"absolute", right:7, top:"50%", transform:"translateY(-50%)", color:C.t3, pointerEvents:"none" }} />
        </div>
        <div style={{ width:1, height:22, background:C.border }} />
        <span style={{ fontSize:11, color:C.t3 }}>
          {studentsForSection.length} students · {section.includes("8")?"Mathematics 8":section.includes("9")?"Science 9":"Filipino 10"}
        </span>
      </div>
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <AttendanceHub students={studentsForSection} />
      </div>
    </div>
  );
}

/* ─── ClinicVisitsScreen ─────────────────────────────────── */
export function ClinicVisitsScreen() {
  const [section, setSection] = useState("All sections");
  const [search, setSearch] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<{name:string, section:string}|null>(null);
  
  const filtered = CLINIC_DATA.filter(r=>{
    const matchSec = section==="All sections" || r.section.includes(section.split(" ")[1]??section);
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
    return matchSec && matchSearch;
  });
  const statusColor = (s:string) => s==="Discharged"?C.green:s==="Sent home"?C.red:C.amber;
  const statusBg    = (s:string) => s==="Discharged"?C.greenBg:s==="Sent home"?C.redBg:C.amberBg;

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
                {["Student","Section","Date & Time","Complaint / Reason","Action Taken","Nurse","Status","Excused","Action"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"8px 12px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={9} style={{ padding:"28px", textAlign:"center", fontSize:12, color:C.t3 }}>No clinic visit records for this section.</td></tr>
              ) : filtered.map((r,i)=>(
                <tr key={r.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                  <td style={{ padding:"9px 12px", fontWeight:600, color:C.t1, fontSize:12, whiteSpace:"nowrap" }}>{r.name}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.t2 }}>{r.section}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.t2, fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap" }}>{r.date}</td>
                  <td style={{ padding:"9px 12px", fontSize:12, color:C.t2, maxWidth:200 }}>{r.complaint}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.t2, maxWidth:180 }}>{r.action}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.t3 }}>{r.by}</td>
                  <td style={{ padding:"9px 12px" }}>
                    <Stamp label={r.status} color={statusColor(r.status)} bg={statusBg(r.status)} />
                  </td>
                  <td style={{ padding:"9px 12px", textAlign:"center" }}>
                    {r.excused && <Stamp label="Excused" color={C.teal} bg={C.tealBg} />}
                  </td>
                  <td style={{ padding:"9px 12px" }}>
                    <button onClick={()=>setSelectedHistory({name:r.name, section:r.section})} style={{ fontSize:10, fontWeight:600, color:C.teal, background:C.tealBg, border:`1px solid rgba(20,184,166,0.3)`, borderRadius:4, padding:"4px 8px", cursor:"pointer", whiteSpace:"nowrap" }}>History</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary footer */}
          <div style={{ background:C.m50, borderTop:`1px solid ${C.borderMed}`, padding:"8px 14px", display:"flex", gap:20, alignItems:"center" }}>
            <span style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em" }}>Summary</span>
            {[
              ["Total visits", CLINIC_DATA.length, C.t2],
              ["Sent home",   CLINIC_DATA.filter(r=>r.status==="Sent home").length, C.red],
              ["Excused",     CLINIC_DATA.filter(r=>r.excused).length, C.teal],
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
      {selectedHistory && (
        <StudentMedicalHistoryCard studentName={selectedHistory.name} section={selectedHistory.section} onClose={()=>setSelectedHistory(null)} />
      )}
    </div>
  );
}

/* ─── StudentMedicalHistoryCard ────────────────────────────── */
function StudentMedicalHistoryCard({ studentName, section, onClose }:{ studentName:string, section:string, onClose:()=>void }) {
  const mockHistory = [
    { date: "Jun 10, 2025", time: "9:14 AM", complaint: "Headache, dizziness", action: "Rest given, paracetamol", status: "Discharged", nurse: "Nurse Reyes" },
    { date: "Mar 15, 2025", time: "11:30 AM", complaint: "Stomach ache", action: "Warm compress, rest for 30m", status: "Discharged", nurse: "Nurse Reyes" },
    { date: "Nov 02, 2024", time: "2:15 PM", complaint: "Fever (38.5°C)", action: "Called parent, sent home", status: "Sent home", nurse: "Nurse Reyes" }
  ];

  const profile = {
    allergies: studentName.includes("Santos") ? "Peanuts, Dust" : "None known",
    bloodType: "O+",
    contact: "0917-123-4567 (Mother)"
  };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(10,5,5,0.45)" }} />
      <div style={{ position:"fixed", top:0, right:0, bottom:0, zIndex:401, width:480, background:"#fff", display:"flex", flexDirection:"column", boxShadow:"-8px 0 40px rgba(74,10,16,0.25)", overflow:"hidden" }}>
        <div style={{ background:C.teal, padding:"16px 20px", display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <div style={{ width:46, height:46, borderRadius:23, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Stethoscope size={22} color={C.teal} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:"#fff", fontSize:18, fontWeight:700, fontFamily:"'Fraunces',serif", lineHeight:1.2 }}>{studentName}</div>
            <div style={{ color:"rgba(255,255,255,0.7)", fontSize:11, marginTop:2 }}>{section} · SY 2025–2026</div>
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
        <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.t1, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:16 }}>Clinic Visit History</div>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {mockHistory.map((h, i) => (
              <div key={i} style={{ borderLeft:`2px solid ${C.borderMed}`, paddingLeft:16, position:"relative" }}>
                <div style={{ position:"absolute", left:-6, top:0, width:10, height:10, borderRadius:5, background:C.teal, border:"2px solid #fff" }} />
                <div style={{ fontSize:10, fontWeight:700, color:C.t2, fontFamily:"'JetBrains Mono',monospace", marginBottom:4 }}>{h.date} · {h.time}</div>
                <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:6, padding:"12px" }}>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.t3, marginBottom:2 }}>Complaint</div>
                    <div style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{h.complaint}</div>
                  </div>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, color:C.t3, marginBottom:2 }}>Action Taken / Treatment</div>
                    <div style={{ fontSize:12, color:C.t1 }}>{h.action}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10, paddingTop:10, borderTop:`1px solid ${C.borderMed}` }}>
                    <div style={{ fontSize:11, color:C.t3 }}>Attended by: <span style={{ fontWeight:600, color:C.t2 }}>{h.nurse}</span></div>
                    <Stamp label={h.status} color={h.status==="Discharged"?C.green:h.status==="Sent home"?C.red:C.amber} bg={h.status==="Discharged"?C.greenBg:h.status==="Sent home"?C.redBg:C.amberBg} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}