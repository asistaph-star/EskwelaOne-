import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { apiClient } from '../../../api/client';
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
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [rankings, setRankings] = useState<any[]>([]);

  useEffect(() => {
    // Only attempt to fetch rankings if the user has academic:read, or just gracefully catch
    apiClient.get('/admin/rankings')
      .then((data: any) => {
        if (Array.isArray(data)) {
          setRankings(data);
        }
      })
      .catch((err) => console.warn("Could not fetch rankings", err));
  }, []);

  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");

  const handleCreateTeacher = async () => {
    if (!newTeacherName.trim() || !newTeacherEmail.trim()) return;
    
    const [firstName, ...rest] = newTeacherName.split(' ');
    const lastName = rest.length ? rest.join(' ') : 'Unknown';
    
    try {
      await addTeacher({
        firstName,
        lastName,
        email: newTeacherEmail,
        roles: ["Teacher"],
        password: "password123"
      } as any);
      setCreateModal(false);
      setNewTeacherName("");
      setNewTeacherEmail("");
    } catch (err) {
      console.error("Failed to create teacher", err);
      alert("Failed to create teacher. Check permissions or inputs.");
    }
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
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>No Data Available</span>
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><PTableHeader cols={["Teacher","Rank","Status","Time In"]} /></thead>
                <tbody>
                  <tr>
                    <td colSpan={4} style={{ padding:"24px", textAlign: "center", fontSize: 12, color: C.t3 }}>
                      Faculty attendance tracking module is not currently available.
                    </td>
                  </tr>
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
                <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Promotion Tracking</div>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><PTableHeader cols={["Teacher","Rank","Years","Status","Profile"]} /></thead>
                  <tbody>
                    {teachers.map((t: any,i)=>{
                      const ranking = rankings.find(r => r.teacher_id === t.teacher?.id);
                      const statusLabel = ranking ? ranking.status : "No Application";
                      const tr = teacherTraffic(statusLabel === "Completed" ? "Excellent" : statusLabel === "Pending" || statusLabel === "Under Review" ? "Good" : "Warning");
                      
                      const hiredDate = t.teacher?.date_hired ? new Date(t.teacher.date_hired) : null;
                      const years = hiredDate ? Math.floor((new Date().getTime() - hiredDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 0;
                      const rankDisplay = t.teacher?.position || "Teacher I";
                      
                      return (
                        <tr key={t.id} style={{ borderBottom:i<teachers.length-1?`0.5px solid ${C.border}`:"none" }}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                          <td style={{ padding:"8px 14px", fontSize:11, fontWeight:600, color:C.t1 }}>{t.name}</td>
                          <td style={{ padding:"8px 14px", fontSize:10, color:C.t3 }}>{rankDisplay}</td>
                          <td style={{ padding:"8px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.t2 }}>{`${years} Yrs`}</td>
                          <td style={{ padding:"8px 14px" }}><Stamp label={statusLabel} color={tr.color} bg={tr.bg} /></td>
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
              <thead><PTableHeader cols={["Teacher","Days","Sections","Subjects","Assignments"]} /></thead>
              <tbody>
                {teachers.map((t: any,i)=>{
                  const assignments = t.teacher?.assignments || [];
                  const sections = assignments.map((a: any) => a.section.name).join(', ') || 'Unassigned';
                  const subjects = Array.from(new Set(assignments.map((a: any) => a.subject.name))).join(', ') || 'None';
                  const loadCount = assignments.length;
                  return (
                    <tr key={t.id} style={{ borderBottom:i<teachers.length-1?`0.5px solid ${C.border}`:"none" }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                      <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{t.name}</td>
                      <td style={{ padding:"9px 14px", fontSize:11, color:C.t3 }}>{"N/A"}</td>
                      <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>{sections}</td>
                      <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>{subjects}</td>
                      <td style={{ padding:"9px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.m700, fontWeight:600 }}>{loadCount} subjects</td>
                    </tr>
                  );
                })}
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

    </div>
  );
}