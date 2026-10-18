import React, { useState, useEffect, useMemo } from 'react';
import { C } from '../../shared/constants/tokens';
import { apiClient } from '../../../api/client';
import { PTableHeader } from '../shared/PTableHeader';
import { useAppContext } from '../../shared/AppContext';
import { UserPlus, Calendar as CalendarIcon, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { TeacherProfileModal } from "./TeacherProfileModal";
import PRankingScreen from "../ranking/PRankingScreen";
import { AssignScheduleModal } from "./AssignScheduleModal";
import { FacultyAttendanceTable } from "./FacultyAttendanceTable";

export function PTeachers() {
  const { teachers, addTeacher } = useAppContext();
  const [tab, setTab] = useState<"overview"|"ranking">("overview");
  const [createModal, setCreateModal] = useState(false);
  const [assignScheduleModal, setAssignScheduleModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [rankings, setRankings] = useState<any[]>([]);

  // ─── 1. INDEPENDENT STATE: PROMOTION TRACKING / ROSTER ───────
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterFilter, setRosterFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [rosterPage, setRosterPage] = useState(1);
  const rosterPageSize = 6;

  // ─── 2. INDEPENDENT STATE: SUBJECT LOAD MONITORING ───────────
  const [loadSearch, setLoadSearch] = useState("");
  const [loadFilter, setLoadFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [loadPage, setLoadPage] = useState(1);
  const loadPageSize = 6;

  // Rank Distribution calculation (derived objectively from real database records)
  const rankDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    (teachers || []).forEach((t: any) => {
      const pos = t.teacher?.position?.trim();
      if (pos) {
        counts[pos] = (counts[pos] || 0) + 1;
      } else {
        counts['Unassigned'] = (counts['Unassigned'] || 0) + 1;
      }
    });

    const standardRanks = ["Teacher I", "Teacher II", "Teacher III", "Master Teacher I", "Master Teacher II"];
    const rows: [string, number][] = standardRanks.map(r => [r, counts[r] || 0]);

    if (counts['Unassigned']) {
      rows.push(['Unassigned', counts['Unassigned']]);
    }
    Object.keys(counts).forEach(k => {
      if (!standardRanks.includes(k) && k !== 'Unassigned') {
        rows.push([k, counts[k]]);
      }
    });
    return rows;
  }, [teachers]);

  useEffect(() => {
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

  // Shared aggregate counts from real records
  const totalAssignedCount = useMemo(() => {
    return (teachers || []).filter((t: any) => (t.teacher?.assignments?.length || 0) > 0).length;
  }, [teachers]);

  const totalUnassignedCount = useMemo(() => {
    return (teachers || []).length - totalAssignedCount;
  }, [teachers, totalAssignedCount]);

  // ─── FILTER & PAGINATION: PROMOTION TRACKING (INDEPENDENT) ───
  const filteredRoster = useMemo(() => {
    let list = [...(teachers || [])];

    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase().trim();
      list = list.filter((t: any) =>
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.teacher?.position && t.teacher.position.toLowerCase().includes(q))
      );
    }

    if (rosterFilter === "assigned") {
      list = list.filter((t: any) => (t.teacher?.assignments?.length || 0) > 0);
    } else if (rosterFilter === "unassigned") {
      list = list.filter((t: any) => (t.teacher?.assignments?.length || 0) === 0);
    }

    // Objective sorting: alphabetical by name
    list.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [teachers, rosterSearch, rosterFilter]);

  const rosterTotalPages = Math.ceil(filteredRoster.length / rosterPageSize) || 1;
  const pagedRoster = useMemo(() => {
    const start = (rosterPage - 1) * rosterPageSize;
    return filteredRoster.slice(start, start + rosterPageSize);
  }, [filteredRoster, rosterPage, rosterPageSize]);

  // ─── FILTER & PAGINATION: SUBJECT LOAD MONITORING (INDEPENDENT)
  const filteredLoad = useMemo(() => {
    let list = [...(teachers || [])];

    if (loadSearch.trim()) {
      const q = loadSearch.toLowerCase().trim();
      list = list.filter((t: any) =>
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.teacher?.position && t.teacher.position.toLowerCase().includes(q))
      );
    }

    if (loadFilter === "assigned") {
      list = list.filter((t: any) => (t.teacher?.assignments?.length || 0) > 0);
    } else if (loadFilter === "unassigned") {
      list = list.filter((t: any) => (t.teacher?.assignments?.length || 0) === 0);
    }

    // Objective sorting: alphabetical by name
    list.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [teachers, loadSearch, loadFilter]);

  const loadTotalPages = Math.ceil(filteredLoad.length / loadPageSize) || 1;
  const pagedLoad = useMemo(() => {
    const start = (loadPage - 1) * loadPageSize;
    return filteredLoad.slice(start, start + loadPageSize);
  }, [filteredLoad, loadPage, loadPageSize]);

  const getStatusBadge = (rankingStatus?: string) => {
    if (rankingStatus === "Completed" || rankingStatus === "Approved") {
      return { label: "Approved", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
    }
    if (rankingStatus === "Pending" || rankingStatus === "Under Review") {
      return { label: "Under Review", bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
    }
    return { label: "No Application", bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" };
  };

  return (
    <div style={{ flex:1, minHeight: 0, overflowY:"auto", background: "transparent", padding:24, display:"flex", flexDirection:"column" }}>
      
      {/* Top Header & Actions */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Teacher Management</div>
          <div style={{ fontSize:12, color:C.t3, marginTop:4 }}>Oversee faculty attendance, subject loads, and promotion tracking.</div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => setAssignScheduleModal(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:6, fontSize:11, fontWeight:700, color:C.m700, cursor:"pointer" }}>
            <CalendarIcon size={14} /> Assign Schedule
          </button>
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
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {/* PRIN-014 Faculty Attendance Table */}
          <FacultyAttendanceTable />

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            
            {/* ─── LEFT COLUMN: RANK DISTRIBUTION & PROMOTION TRACKING ─── */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* DepEd Rank Distribution */}
              <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
                <div style={{ background:C.m800, padding:"10px 16px" }}>
                  <span style={{ color:"#fff", fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif" }}>DepEd Rank Distribution</span>
                </div>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><PTableHeader cols={["Rank","Count"]} /></thead>
                  <tbody>
                    {rankDistribution.map(([r, c]) => (
                      <tr key={r} style={{ borderBottom: `0.5px solid ${C.border}` }}>
                        <td style={{ padding: "8px 14px", fontSize: 12, color: C.t1 }}>{r}</td>
                        <td style={{ padding: "8px 14px", fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: C.m700 }}>{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Promotion Tracking Table (Independent Controls & Pagination) */}
              <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                {/* Section Header */}
                <div style={{ padding:"10px 14px", borderBottom:`0.5px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                  <div>
                    <span style={{ fontSize:12, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Promotion Tracking</span>
                    <span style={{ fontSize:10, color:C.t3, marginLeft:8 }}>({filteredRoster.length} total)</span>
                  </div>
                  {/* Independent Search */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, background:"#f8fafc", border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 8px", width:170 }}>
                    <Search size={12} style={{ color:C.t3 }} />
                    <input
                      type="text"
                      placeholder="Search roster..."
                      value={rosterSearch}
                      onChange={e => { setRosterSearch(e.target.value); setRosterPage(1); }}
                      style={{ border:"none", background:"transparent", outline:"none", fontSize:11, color:C.t1, width:"100%" }}
                    />
                    {rosterSearch && (
                      <button onClick={() => { setRosterSearch(""); setRosterPage(1); }} style={{ border:"none", background:"none", cursor:"pointer", padding:0, color:C.t3 }}>
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Independent Filter Pills */}
                <div style={{ padding:"6px 14px", background:"#fafafa", borderBottom:`0.5px solid ${C.border}`, display:"flex", gap:4 }}>
                  {[
                    { id: "all", label: `All (${teachers.length})` },
                    { id: "assigned", label: `Assigned (${totalAssignedCount})` },
                    { id: "unassigned", label: `Unassigned (${totalUnassignedCount})` }
                  ].map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => { setRosterFilter(btn.id as any); setRosterPage(1); }}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 12,
                        border: rosterFilter === btn.id ? `1px solid ${C.m700}` : `1px solid ${C.borderMed}`,
                        background: rosterFilter === btn.id ? C.m800 : "#fff",
                        color: rosterFilter === btn.id ? "#fff" : C.t2,
                        fontSize: 10,
                        fontWeight: rosterFilter === btn.id ? 700 : 500,
                        cursor: "pointer"
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Table Body */}
                <div style={{ flex:1, overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead><PTableHeader cols={["Teacher","Rank","Years","Status","Profile"]} /></thead>
                    <tbody>
                      {pagedRoster.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: "20px 14px", textAlign: "center", color: C.t3, fontSize: 11 }}>
                            No teachers match current filter.
                          </td>
                        </tr>
                      ) : (
                        pagedRoster.map((t: any, i)=>{
                          const ranking = rankings.find(r => r.teacher_id === t.teacher?.id);
                          const statusBadge = getStatusBadge(ranking?.status);
                          
                          const hiredDate = t.teacher?.date_hired ? new Date(t.teacher.date_hired) : null;
                          const years = hiredDate ? Math.floor((new Date().getTime() - hiredDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 0;
                          const rankDisplay = t.teacher?.position || "Teacher I";
                          
                          return (
                            <tr key={t.id} style={{ borderBottom: i < pagedRoster.length - 1 ? `0.5px solid ${C.border}` : "none" }}
                              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                              <td style={{ padding:"8px 14px", fontSize:11, fontWeight:600, color:C.t1 }}>
                                <div>{t.name}</div>
                                {t.email && <div style={{ fontSize: 9, color: C.t3, fontWeight: 400 }}>{t.email}</div>}
                              </td>
                              <td style={{ padding:"8px 14px", fontSize:10, color:C.t3 }}>{rankDisplay}</td>
                              <td style={{ padding:"8px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t2 }}>{`${years} Yrs`}</td>
                              <td style={{ padding:"8px 14px" }}>
                                <span style={{
                                  display: "inline-block",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontSize: 9,
                                  fontWeight: 600,
                                  background: statusBadge.bg,
                                  color: statusBadge.color,
                                  border: `1px solid ${statusBadge.border}`,
                                  whiteSpace: "nowrap"
                                }}>
                                  {statusBadge.label}
                                </span>
                              </td>
                              <td style={{ padding:"8px 14px", textAlign: "right" }}>
                                <button onClick={() => setSelectedProfile(t)} style={{ padding: "3px 6px", background: "none", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 10, fontWeight: 600, color: C.m700, cursor: "pointer" }}>View Profile</button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Independent Pagination Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "#f8fafc", borderTop: `1px solid ${C.borderMed}`, fontSize: 11 }}>
                  <span style={{ color: C.t3 }}>
                    {filteredRoster.length === 0 ? "0 records" : `Showing ${(rosterPage - 1) * rosterPageSize + 1}–${Math.min(rosterPage * rosterPageSize, filteredRoster.length)} of ${filteredRoster.length}`}
                  </span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      disabled={rosterPage <= 1}
                      onClick={() => setRosterPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: "3px 8px",
                        background: rosterPage <= 1 ? "#f1f5f9" : "#fff",
                        border: `1px solid ${C.borderMed}`,
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        color: rosterPage <= 1 ? C.t3 : C.t1,
                        cursor: rosterPage <= 1 ? "not-allowed" : "pointer"
                      }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.t2, minWidth: 28, textAlign: "center" }}>
                      {rosterPage} / {rosterTotalPages}
                    </span>
                    <button
                      disabled={rosterPage >= rosterTotalPages}
                      onClick={() => setRosterPage(p => Math.min(rosterTotalPages, p + 1))}
                      style={{
                        padding: "3px 8px",
                        background: rosterPage >= rosterTotalPages ? "#f1f5f9" : "#fff",
                        border: `1px solid ${C.borderMed}`,
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        color: rosterPage >= rosterTotalPages ? C.t3 : C.t1,
                        cursor: rosterPage >= rosterTotalPages ? "not-allowed" : "pointer"
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── RIGHT COLUMN: SUBJECT LOAD MONITORING (INDEPENDENT) ─── */}
            <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", display: "flex", flexDirection: "column" }}>
              {/* Section Header */}
              <div style={{ padding:"10px 14px", borderBottom:`0.5px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                <div>
                  <span style={{ fontSize:12, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Subject Load Monitoring</span>
                  <span style={{ fontSize:10, color:C.t3, marginLeft:8 }}>({filteredLoad.length} total)</span>
                </div>
                {/* Independent Search */}
                <div style={{ display:"flex", alignItems:"center", gap:6, background:"#f8fafc", border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 8px", width:170 }}>
                  <Search size={12} style={{ color:C.t3 }} />
                  <input
                    type="text"
                    placeholder="Search loads..."
                    value={loadSearch}
                    onChange={e => { setLoadSearch(e.target.value); setLoadPage(1); }}
                    style={{ border:"none", background:"transparent", outline:"none", fontSize:11, color:C.t1, width:"100%" }}
                  />
                  {loadSearch && (
                    <button onClick={() => { setLoadSearch(""); setLoadPage(1); }} style={{ border:"none", background:"none", cursor:"pointer", padding:0, color:C.t3 }}>
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Independent Filter Pills */}
              <div style={{ padding:"6px 14px", background:"#fafafa", borderBottom:`0.5px solid ${C.border}`, display:"flex", gap:4 }}>
                {[
                  { id: "all", label: `All (${teachers.length})` },
                  { id: "assigned", label: `Assigned (${totalAssignedCount})` },
                  { id: "unassigned", label: `Unassigned (${totalUnassignedCount})` }
                ].map(btn => (
                  <button
                    key={btn.id}
                    onClick={() => { setLoadFilter(btn.id as any); setLoadPage(1); }}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 12,
                      border: loadFilter === btn.id ? `1px solid ${C.m700}` : `1px solid ${C.borderMed}`,
                      background: loadFilter === btn.id ? C.m800 : "#fff",
                      color: loadFilter === btn.id ? "#fff" : C.t2,
                      fontSize: 10,
                      fontWeight: loadFilter === btn.id ? 700 : 500,
                      cursor: "pointer"
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Table Body */}
              <div style={{ flex: 1, overflowX: "auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><PTableHeader cols={["Teacher","Days","Sections","Subjects","Assignments"]} /></thead>
                  <tbody>
                    {pagedLoad.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "20px 14px", textAlign: "center", color: C.t3, fontSize: 11 }}>
                          No teachers match current filter.
                        </td>
                      </tr>
                    ) : (
                      pagedLoad.map((t: any, i)=>{
                        const assignments = t.teacher?.assignments || [];
                        const sections = assignments.map((a: any) => a.section?.name).filter(Boolean).join(', ') || 'Unassigned';
                        const subjects = Array.from(new Set(assignments.map((a: any) => a.subject?.name).filter(Boolean))).join(', ') || 'None';
                        
                        // Collect unique schedule days
                        const days = Array.from(new Set(assignments.map((a: any) => a.days).filter(Boolean))).join(' / ') || '—';
                        
                        const loadCount = assignments.length;
                        return (
                          <tr key={t.id} style={{ borderBottom: i < pagedLoad.length - 1 ? `0.5px solid ${C.border}` : "none" }}
                            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                            <td style={{ padding:"8px 14px", fontSize:11, fontWeight:600, color:C.t1 }}>
                              <div>{t.name}</div>
                              {t.email && <div style={{ fontSize: 9, color: C.t3, fontWeight: 400 }}>{t.email}</div>}
                            </td>
                            <td style={{ padding:"8px 14px", fontSize:11, color: days === '—' ? C.t3 : C.t1 }}>{days}</td>
                            <td style={{ padding:"8px 14px", fontSize:11, color: sections === 'Unassigned' ? C.t3 : C.t2, fontStyle: sections === 'Unassigned' ? 'italic' : 'normal' }}>{sections}</td>
                            <td style={{ padding:"8px 14px", fontSize:11, color: subjects === 'None' ? C.t3 : C.t2, fontStyle: subjects === 'None' ? 'italic' : 'normal' }}>{subjects}</td>
                            <td style={{ padding:"8px 14px" }}>
                              {loadCount > 0 ? (
                                <span style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  fontFamily: "'JetBrains Mono',monospace",
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  border: "1px solid #bfdbfe"
                                }}>
                                  {loadCount} subject{loadCount !== 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: 11,
                                  color: C.t3,
                                  fontFamily: "'JetBrains Mono',monospace"
                                }}>
                                  0 subjects
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Independent Pagination Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "#f8fafc", borderTop: `1px solid ${C.borderMed}`, fontSize: 11 }}>
                <span style={{ color: C.t3 }}>
                  {filteredLoad.length === 0 ? "0 records" : `Showing ${(loadPage - 1) * loadPageSize + 1}–${Math.min(loadPage * loadPageSize, filteredLoad.length)} of ${filteredLoad.length}`}
                </span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    disabled={loadPage <= 1}
                    onClick={() => setLoadPage(p => Math.max(1, p - 1))}
                    style={{
                      padding: "3px 8px",
                      background: loadPage <= 1 ? "#f1f5f9" : "#fff",
                      border: `1px solid ${C.borderMed}`,
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      color: loadPage <= 1 ? C.t3 : C.t1,
                      cursor: loadPage <= 1 ? "not-allowed" : "pointer"
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.t2, minWidth: 28, textAlign: "center" }}>
                    {loadPage} / {loadTotalPages}
                  </span>
                  <button
                    disabled={loadPage >= loadTotalPages}
                    onClick={() => setLoadPage(p => Math.min(loadTotalPages, p + 1))}
                    style={{
                      padding: "3px 8px",
                      background: loadPage >= loadTotalPages ? "#f1f5f9" : "#fff",
                      border: `1px solid ${C.borderMed}`,
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      color: loadPage >= loadTotalPages ? C.t3 : C.t1,
                      cursor: loadPage >= loadTotalPages ? "not-allowed" : "pointer"
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {selectedProfile && <TeacherProfileModal teacherUser={selectedProfile} onClose={() => setSelectedProfile(null)} />}
      
      {assignScheduleModal && <AssignScheduleModal onClose={() => setAssignScheduleModal(false)} onSuccess={() => { setAssignScheduleModal(false); window.location.reload(); }} />}
      
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