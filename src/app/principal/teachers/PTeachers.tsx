import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { PTableHeader } from '../shared/PTableHeader';
import { teacherTraffic } from '../../shared/utils/helpers';
import { useAppContext } from '../../shared/AppContext';
import { Stamp } from '../../shared/components/Stamp';
import { UserPlus, Calendar as CalendarIcon, CheckCircle, XCircle } from 'lucide-react';
import { TeacherProfileModal } from "./TeacherProfileModal";
import PRankingScreen from "../ranking/PRankingScreen";

export function PTeachers() {
  const { teachers, addTeacher } = useAppContext();
  const [tab, setTab] = useState<"overview"|"ranking">("overview");
  const [createModal, setCreateModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [days, setDays] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");

  const handleCreateTeacher = async () => {
    if (!newTeacherName.trim()) return;
    await addTeacher({
      name: newTeacherName,
      role: "Teacher",
      section: "Unassigned"
    });
    setCreateModal(false);
    setNewTeacherName("");
    setNewTeacherEmail("");
  };

  return (
    <div style={{ flex:1, minHeight: 0, overflowY:"auto", background: "transparent", padding:24, display:"flex", flexDirection:"column" }}>
      
      {/* Top Header & Actions */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Teacher Management</div>
          <div style={{ fontSize:12, color:C.t3, marginTop:4 }}>Oversee faculty attendance, subject loads, and leave requests.</div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => setCreateModal(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:6, fontSize:11, fontWeight:700, color:C.m700, cursor:"pointer" }}>
            <UserPlus size={14} /> Create Teacher Account
          </button>
          <button onClick={() => setAssignModal(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", background:C.m700, border:"none", borderRadius:6, fontSize:11, fontWeight:700, color:"#fff", cursor:"pointer" }}>
            <CalendarIcon size={14} /> Assign Schedule
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:20, borderBottom:`1px solid ${C.borderMed}`, marginBottom:20 }}>
        {[
          { id:"overview", label:"Overview & Subject Load" },
          { id:"ranking", label:"Career Progression (Evaluations)" }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding:"10px 4px", border:"none", background:"none", cursor:"pointer", fontSize:12, fontWeight:tab === t.id ? 700 : 500, color:tab === t.id ? C.m700 : C.t3, borderBottom:tab === t.id ? `2px solid ${C.m700}` : "2px solid transparent", marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display:"flex", flexDirection:"column" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            {/* Faculty attendance today */}
            <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
              <div style={{ background:C.m800, padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:"#fff", fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif", flex:1 }}>Faculty Attendance Today</span>
                {[["18","Present",C.green],["0","Absent",C.red],["2","Late",C.amber]].map(([v,l,c])=>(
                  <span key={l} style={{ fontSize:10, color:"rgba(255,255,255,0.7)", marginLeft:10 }}><span style={{ fontWeight:700, color:"#fff" }}>{v}</span> {l}</span>
                ))}
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><PTableHeader cols={["Teacher","Rank","Status","Time In"]} /></thead>
                <tbody>
                  {teachers.map((t,i)=>{
                    const statuses = ["Present","Present","Late","Present","Present","Late","Present","Present"];
                    const times = ["7:05","7:08","7:42","7:10","7:07","7:38","7:12","7:09"];
                    const s = statuses[i % statuses.length], time = times[i % times.length];
                    return (
                      <tr key={t.id} style={{ borderBottom:`0.5px solid ${C.border}` }}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                        <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{t.name}</td>
                        <td style={{ padding:"9px 14px", fontSize:10, color:C.t3 }}>{"Teacher I"}</td>
                        <td style={{ padding:"9px 14px" }}><Stamp label={s} color={s==="Present"?C.green:s==="Late"?C.amber:C.red} bg={s==="Present"?C.greenBg:s==="Late"?C.amberBg:C.redBg} /></td>
                        <td style={{ padding:"9px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{time} AM</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Promotion tracker */}
            <div>
              <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:12 }}>
                <div style={{ background:C.m800, padding:"10px 16px" }}>
                  <span style={{ color:"#fff", fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif" }}>DepEd Rank Distribution</span>
                </div>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><PTableHeader cols={["Rank","Count"]} /></thead>
                  <tbody>
                    {[["Teacher I","3"],["Teacher II","4"],["Teacher III","3"],["Master Teacher I","1"],["Master Teacher II","1"]].map(([r,c],i)=>(
                      <tr key={r} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                        <td style={{ padding:"9px 14px", fontSize:12, color:C.t1 }}>{r}</td>
                        <td style={{ padding:"9px 14px", fontSize:14, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:C.m700 }}>{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
                <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Promotion Eligibility</div>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><PTableHeader cols={["Teacher","Rank","Years","Status","Profile"]} /></thead>
                  <tbody>
                    {teachers.map((t,i)=>{
                      const tr = teacherTraffic("Good");
                      return (
                        <tr key={t.id} style={{ borderBottom:i<teachers.length-1?`0.5px solid ${C.border}`:"none" }}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                          <td style={{ padding:"8px 14px", fontSize:11, fontWeight:600, color:C.t1 }}>{t.name}</td>
                          <td style={{ padding:"8px 14px", fontSize:10, color:C.t3 }}>{"Teacher I"}</td>
                          <td style={{ padding:"8px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.t2 }}>{"3 Yrs"}</td>
                          <td style={{ padding:"8px 14px" }}><Stamp label={tr.label} color={tr.color} bg={tr.bg} /></td>
                          <td style={{ padding:"8px 14px", textAlign: "right" }}>
                            <button onClick={() => setSelectedProfile(t.name)} style={{ padding: "4px 8px", background: "none", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 10, fontWeight: 600, color: C.m700, cursor: "pointer" }}>View Profile</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {/* Subject load */}
          <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
            <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Subject Load Monitoring</div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><PTableHeader cols={["Teacher","Days","Sections","Subjects","Total Load"]} /></thead>
              <tbody>
                {teachers.map((t: any,i)=>(
                  <tr key={t.id} style={{ borderBottom:i<teachers.length-1?`0.5px solid ${C.border}`:"none" }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                    <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{t.name}</td>
                    <td style={{ padding:"9px 14px", fontSize:11, color:C.t3 }}>{"M/W/F"}</td>
                    <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>{t.section || "Grade 10 - Pilot"}</td>
                    <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>{"Mathematics"}</td>
                    <td style={{ padding:"9px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.m700, fontWeight:600 }}>{15}h/wk</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {selectedProfile && <TeacherProfileModal teacherName={selectedProfile} onClose={() => setSelectedProfile(null)} />}
      
      {tab === "ranking" && (
        <PRankingScreen inTab={true} />
      )}
      
      {/* Create Teacher Modal */}
      {createModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,8,8,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setCreateModal(false); }}>
          <div style={{ background: "#fff", borderRadius: 6, width: "100%", maxWidth: 400, overflow: "hidden" }}>
            <div style={{ background: C.m800, padding: "16px 20px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Fraunces',serif" }}>Create Teacher Account</div>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Full Name</label>
                <input value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} type="text" placeholder="e.g. Dela Cruz, Juan M." style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Email</label>
                <input value={newTeacherEmail} onChange={(e) => setNewTeacherEmail(e.target.value)} type="email" placeholder="e.g. jdelacruz@eskwelaone.edu.ph" style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Rank</label>
                  <select style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12 }}>
                    <option>Teacher I</option>
                    <option>Teacher II</option>
                    <option>Teacher III</option>
                    <option>Master Teacher I</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Default Password</label>
                  <input type="text" value="eskwela2026" readOnly style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box", background: C.m50 }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button onClick={() => setCreateModal(false)} style={{ padding: "8px 16px", background: C.m50, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: C.t2, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleCreateTeacher} style={{ padding: "8px 16px", background: C.m700, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Create Account</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Schedule Modal */}
      {assignModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,8,8,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setAssignModal(false); }}>
          <div style={{ background: "#fff", borderRadius: 6, width: "100%", maxWidth: 400, overflow: "hidden" }}>
            <div style={{ background: C.m800, padding: "16px 20px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Fraunces',serif" }}>Assign Class Schedule</div>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Teacher</label>
                <select style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12 }}>
                  <option>Soriano, Ana R.</option>
                  <option>Reyes, Maria L.</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Subject & Section</label>
                <select style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12 }}>
                  <option>Mathematics - Gr. 8 Rizal</option>
                  <option>Science - Gr. 9 Einstein</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Days</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {['M', 'T', 'W', 'Th', 'F'].map(d => (
                    <button key={d} onClick={() => setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d])}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 4, border: `1px solid ${days.includes(d) ? C.m700 : C.borderMed}`, background: days.includes(d) ? C.m50 : "#fff", color: days.includes(d) ? C.m700 : C.t2, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Time</label>
                <input type="text" placeholder="e.g. 7:30 - 8:30" style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button onClick={() => setAssignModal(false)} style={{ padding: "8px 16px", background: C.m50, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: C.t2, cursor: "pointer" }}>Cancel</button>
                <button onClick={() => setAssignModal(false)} style={{ padding: "8px 16px", background: C.m700, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Assign Schedule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}