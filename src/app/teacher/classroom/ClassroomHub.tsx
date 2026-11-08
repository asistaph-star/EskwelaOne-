import React, { useState, useEffect, useCallback } from 'react';
import { C } from '../../shared/constants/tokens';
import { TScreen, GradeCardInfo } from '../../shared/types';
import { AttendanceHub } from '../attendance/AttendanceHub';
import { GradebookFullScreen } from '../grades/GradebookFullScreen';
import { ArrowRight, Sparkles, Users, CalendarCheck, FileText, BarChart2, ChevronRight, Printer, Download, Target, X, ClipboardList, Activity, FileSpreadsheet, UserPlus, Award } from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { DocPanel } from '../../shared/components/DocPanel';
import { gradeColor } from '../../shared/utils/helpers';
import { AuthenticCalulutSf9Viewer } from '../../shared/components/AuthenticCalulutSf9Viewer';
import { LearnerProfileModal } from './LearnerProfileModal';
import { AdviserAddLearnerModal } from './AdviserAddLearnerModal';
import { DepEdSf8Modal } from './DepEdSf8Modal';
import { AdvisoryAcademicOverviewModal } from './AdvisoryAcademicOverviewModal';
import { useMyClasses } from '../shared/useMyClasses';
import { apiClient } from '../../../api/client';
import { EmptyState } from '../../shared/components/EmptyState';


type HubTab = "students" | "attendance" | "assignments" | "gradebook" | "analytics";
export function ClassroomHub({ classId, onBack, onShowGradeCard, onSelectClass }: {
  classId?: string | null;
  onBack: () => void;
  onShowGradeCard?: (info: GradeCardInfo) => void;
  onSelectClass?: (id: string) => void;
}) {
  const [tab, setTab] = useState<HubTab>("students");
  const { myClasses, isLoading: isLoadingClasses } = useMyClasses();

  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (classId && classId !== "1") return classId;
    try {
      return localStorage.getItem('digiskwela_teacher_active_class_id') || '';
    } catch {
      return '';
    }
  });

  // Sync selectedClassId with incoming classId or default to the section with enrolled students / advisory
  useEffect(() => {
    if (classId && classId !== "1" && classId !== selectedClassId) {
      setSelectedClassId(classId);
    } else if ((!selectedClassId || !myClasses.some(c => c.id === selectedClassId)) && myClasses.length > 0) {
      const preferred =
        myClasses.find(c => c.adviser && c.students > 0) ||
        myClasses.find(c => c.students > 0) ||
        myClasses.find(c => c.adviser) ||
        myClasses[0];
      if (preferred) {
        setSelectedClassId(preferred.id);
        onSelectClass?.(preferred.id);
      }
    }
  }, [classId, myClasses, selectedClassId, onSelectClass]);

  const cls =
    myClasses.find(c => c.id === selectedClassId) ||
    myClasses.find(c => c.adviser && c.students > 0) ||
    myClasses.find(c => c.students > 0) ||
    myClasses[0];
  
  const [sf9Student, setSf9Student] = useState<any|null>(null);
  const [learnerProfileStudent, setLearnerProfileStudent] = useState<any|null>(null);
  const [isAddLearnerOpen, setIsAddLearnerOpen] = useState(false);
  const [isSf8ModalOpen, setIsSf8ModalOpen] = useState(false);
  const [isAdvisoryOverviewOpen, setIsAdvisoryOverviewOpen] = useState(false);
  
  const [students, setStudents] = useState<any[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState<string|null>(null);

  const effectiveSectionId = cls?.sectionId || null;

  const fetchRoster = useCallback(() => {
    if (!effectiveSectionId) return;
    setIsLoadingRoster(true);
    setRosterError(null);
    apiClient.get(`/academic/sections/${effectiveSectionId}/enrollments`)
      .then((res: any) => {
        const raw = Array.isArray(res) ? res : res?.data || [];
        const mapped = raw.map((s: any) => ({
          id: s.student?.id || s.id,
          enrollmentId: s.id,
          lrn: s.student?.lrn,
          surname: s.student?.last_name || s.student?.user?.last_name || '',
          first: s.student?.first_name || s.student?.user?.first_name || '',
          middleName: s.student?.middle_name || '',
          suffix: s.student?.suffix || '',
          dateOfBirth: s.student?.date_of_birth,
          gender: s.student?.gender || 'Male',
          gradeLevel: s.student?.grade_level || cls?.grade,
          street: s.student?.street || '',
          city: s.student?.city || '',
          stateProvince: s.student?.state_province || '',
          zipCode: s.student?.zip_code || '',
          guardianFirstName: s.student?.guardian_first_name || '',
          guardianLastName: s.student?.guardian_last_name || '',
          guardianPhone: s.student?.guardian_phone || '',
          guardianEmail: s.student?.guardian_email || '',
          bloodType: s.student?.blood_type || '',
          allergies: s.student?.allergies || '',
          medicalConditions: s.student?.medical_conditions || '',
          studentNumber: s.student?.student_number,
          avg: "—",
          att: "Good Standing",
          status: s.status || "Enrolled"
        }));
        setStudents(mapped);
      })
      .catch((err: any) => {
        setRosterError(err.message || "Failed to load roster");
      })
      .finally(() => {
        setIsLoadingRoster(false);
      });
  }, [effectiveSectionId, cls?.grade]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const TABS: { id:HubTab, label:string, icon:React.ElementType }[] = [
    { id:"students",   label:"Students",   icon:Users },
    { id:"attendance", label:"Attendance", icon:CalendarCheck },
    { id:"assignments",label:"Assignments",icon:ClipboardList },
    { id:"gradebook",  label:"Gradebook",  icon:FileText },
    { id:"analytics",  label:"Analytics",  icon:BarChart2 },
  ];
  if (isLoadingClasses || !cls) {
    if (isLoadingClasses) {
      return (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color: C.t3, fontSize: 14 }}>
          Loading classroom...
        </div>
      );
    }
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <EmptyState
          icon={Users}
          title="No Classes Assigned"
          description="You don't have any sections assigned for this academic year yet."
          guidance="Once an administrator assigns you to a section, your classes will appear here."
        />
      </div>
    );
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background: "transparent" }}>
      {/* Section header */}
      <div style={{ background:"#fff", borderBottom:`2px solid ${C.m700}`, padding:"12px 24px" }}>
        <div style={{ display:"flex", gap:5, alignItems:"center", fontSize:11, color:C.t3, marginBottom:8 }}>
          <button onClick={onBack} style={{ color:C.m700, background:"none", border:"none", cursor:"pointer", fontWeight:600, fontSize:11 }}>Dashboard</button>
          <ChevronRight size={11} color={C.t3} />
          <span style={{ color:C.t1, fontWeight:600 }}>Grade {cls.grade}, Section {cls.section}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Classroom Hub: Grade {cls.grade}, Section {cls.section}</div>
              <div style={{ fontSize:12, color:C.t3, marginTop:2 }}>{cls.subject}, {students.length || cls.students} students ({cls.semester})</div>
            </div>

            {myClasses.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}` }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: C.m700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Active Section:
                </span>
                <select
                  id="select-classroom-section"
                  value={cls.id}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedClassId(newId);
                    onSelectClass?.(newId);
                  }}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.t1,
                    background: "#ffffff",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: "4px 8px",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  {myClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Grade {c.grade}, Section {c.section} ({c.subject}) - {c.students} students{c.adviser ? ' (Class Adviser)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <Stamp label={`Grade ${cls.grade}`} color="#fff" bg={C.m700} />
              <Stamp label={`${cls.completion}% Complete`} color={C.green} bg={C.greenBg} />
              {cls.adviser && <Stamp label="Class Adviser" color={C.gold} bg={C.goldLight} />}
            </div>

            <div style={{ width:1, height:24, background:C.border }} />

            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {cls.adviser && (
                <>
                  <button 
                    id="btn-add-enroll-learner"
                    onClick={() => setIsAddLearnerOpen(true)}
                    style={{ 
                      display:"flex", 
                      alignItems:"center", 
                      gap:6, 
                      fontSize:12, 
                      fontWeight:700, 
                      color:"#fff", 
                      background:"#059669", 
                      border:"none", 
                      borderRadius:6, 
                      padding:"7px 14px", 
                      cursor:"pointer",
                      boxShadow:"0 1px 2px rgba(5,150,105,0.25)",
                      transition:"all 0.15s ease"
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#047857"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#059669"; }}
                  >
                    <UserPlus size={15} /> Enroll Student
                  </button>
                  <button 
                    id="btn-view-advisory-grades"
                    onClick={() => setIsAdvisoryOverviewOpen(true)}
                    style={{ 
                      display:"flex", 
                      alignItems:"center", 
                      gap:6, 
                      fontSize:12, 
                      fontWeight:700, 
                      color:"#fff", 
                      background:"#0d9488", 
                      border:"none", 
                      borderRadius:6, 
                      padding:"7px 14px", 
                      cursor:"pointer",
                      boxShadow:"0 1px 2px rgba(13,148,136,0.25)",
                      transition:"all 0.15s ease"
                    }}
                    title="View consolidated cross-subject published ratings and academic monitoring overview"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#0f766e"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#0d9488"; }}
                  >
                    <Award size={15} /> View Advisory Grades
                  </button>
                </>
              )}
              <button 
                id="btn-open-sf8"
                onClick={() => setIsSf8ModalOpen(true)}
                style={{ 
                  display:"flex", 
                  alignItems:"center", 
                  gap:6, 
                  fontSize:12, 
                  fontWeight:700, 
                  color:"#fff", 
                  background:"#2563eb", 
                  border:"none", 
                  borderRadius:6, 
                  padding:"7px 14px", 
                  cursor:"pointer",
                  boxShadow:"0 1px 2px rgba(37,99,235,0.25)",
                  transition:"all 0.15s ease"
                }}
                title="Generate DepEd School Form 8 (Learner Basic Health and Nutrition Report)"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1d4ed8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#2563eb"; }}
              >
                <FileSpreadsheet size={15} /> Form SF8
              </button>
            </div>
          </div>
        </div>
        {/* 5-module quick stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginTop:12 }}>
          {[
            { icon:Users,       label:"Students",   value:`${cls.students}`, sub:"enrolled", color:C.m700 },
            { icon:CalendarCheck,label:"Attendance", value:"94.2%",          sub:"this week", color:C.green },
            { icon:ClipboardList,label:"Assignments",value:"3 Active",       sub:"this week", color:C.teal },
            { icon:FileText,    label:"Gradebook",  value:"Term 1 Open",    sub:"12 pending", color:C.amber },
            { icon:BarChart2,   label:"Analytics",  value:"82.4",           sub:"class avg",  color:C.purple },
          ].map((s,i) => {
            const Icon = s.icon;
            return (
              <button key={i} onClick={()=>setTab(TABS[i].id)}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:4, border:`1px solid ${tab===TABS[i].id?s.color+"60":C.border}`, background:tab===TABS[i].id?C.m50:"transparent", cursor:"pointer", transition:"all 0.12s" } as React.CSSProperties}>
                <div style={{ width:28, height:28, borderRadius:5, background:`${s.color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon size={13} color={s.color} />
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.t1, fontFamily:"'JetBrains Mono',monospace" }}>{s.value}</div>
                  <div style={{ fontSize:9, color:C.t3 }}>{s.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.borderMed}`, display:"flex", padding:"0 24px" }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const act = tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"11px 18px", background:"none", border:"none", cursor:"pointer", borderBottom:act?`2px solid ${C.m700}`:"2px solid transparent", color:act?C.m700:C.t3, fontSize:12, fontWeight:act?700:400, marginBottom:-1, transition:"color 0.12s" }}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding:24 }}>

        {/* ── STUDENTS TAB ── */}
        {tab==="students" && (
          <DocPanel title={`Student Roster: Grade ${cls.grade}, Section ${cls.section}`} icon={Users}
            action={<div style={{ display:"flex", gap:6 }}>
              <button style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.8)", background:"rgba(255,255,255,0.12)", border:"none", borderRadius:4, padding:"5px 12px", cursor:"pointer" }}>Student QR</button>
              <button style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.8)", background:"rgba(255,255,255,0.12)", border:"none", borderRadius:4, padding:"5px 12px", cursor:"pointer" }}>Parent Contacts</button>
            </div>}>
            
            {isLoadingRoster ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: C.t3, fontSize: 13 }}>Loading roster from backend...</div>
            ) : rosterError ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: C.red, fontSize: 13 }}>{rosterError}</div>
            ) : students.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: C.t3, fontSize: 13 }}>No students are currently enrolled in this class.</div>
            ) : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                  {["#","LRN","Student Name","Gen. Avg","Attendance","Status","Action"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"9px 14px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s,i) => (
                  <tr key={s.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                    <td style={{ padding:"10px 14px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{i+1}</td>
                    <td style={{ padding:"10px 14px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{s.lrn}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{s.surname}, {s.first}</div>
                    </td>
                    <td style={{ padding:"10px 14px" }}><span style={gradeColor(s.avg)}>{s.avg}</span></td>
                    <td style={{ padding:"10px 14px" }}>
                      <Stamp label={s.att} color={s.att==="Good Standing"?C.green:s.att==="At Risk"?C.amber:C.red} bg={s.att==="Good Standing"?C.greenBg:s.att==="At Risk"?C.amberBg:C.redBg} />
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <Stamp label={s.status} color={s.status==="Passed" || s.status==="Enrolled"?C.green:C.red} bg={s.status==="Passed" || s.status==="Enrolled"?C.greenBg:C.redBg} />
                    </td>
                    <td style={{ padding:"10px 14px", display:"flex", gap:5 }}>
                      <button onClick={()=>setSf9Student(s)} style={{ fontSize:10, color:C.m700, background:C.m100, border:"none", borderRadius:4, padding:"4px 8px", cursor:"pointer", fontWeight:600 }} title="View Official Cross-Subject Report Card">Grades</button>
                      <button onClick={()=>setLearnerProfileStudent(s)} style={{ fontSize:10, color:C.t1, background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"4px 8px", cursor:"pointer", fontWeight:600 }} title="View Learner Demographics & SF8 Measurements">Profile</button>
                      <button onClick={()=>setSf9Student(s)} style={{ fontSize:10, color:"#059669", background:"#ecfdf5", border:"1px solid #a7f3d0", borderRadius:4, padding:"4px 8px", cursor:"pointer", fontWeight:700 }} title="View Official Form 138 SF9">SF9</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </DocPanel>
        )}

        {/* ── ATTENDANCE TAB ── */}
        {tab==="attendance" && <AttendanceHub classId={cls?.id || classId || ""} />}

        {/* ── ASSIGNMENTS TAB ── */}
        {tab==="assignments" && (
          <DocPanel title="Class Assignments" icon={ClipboardList}>
            <div style={{ padding: "60px 20px", textAlign: "center", color: C.t3, fontSize: 13 }}>
              This feature is currently unavailable. Homework and Assignments functionality will be added in a future phase.
            </div>
          </DocPanel>
        )}

        {/* ── GRADEBOOK TAB ── */}
        {tab==="gradebook" && (
          (String(cls?.id).startsWith('adv-') || cls?.subject === 'Advisory Class') ? (
            <DocPanel title={`Academic Monitoring: Grade ${cls.grade}, Section ${cls.section}`} icon={Award}>
              <div style={{ padding: "48px 24px", textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#ecfdf5", border: "1px solid #a7f3d0", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Award size={26} color="#059669" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: "0 0 8px", fontFamily: "'Fraunces', serif" }}>
                  Advisory Academic Monitoring
                </h3>
                <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, margin: "0 0 24px" }}>
                  As Class Adviser for <strong>Grade {cls.grade}, Section {cls.section}</strong>, you monitor published term grades, student averages, and general progress across all subjects in a read-only academic overview.
                  <br />
                  Individual subject assessments (Written Works and Performance Tasks) are encoded exclusively by assigned Subject Teachers.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                  <button
                    id="btn-open-advisory-monitoring"
                    onClick={() => setIsAdvisoryOverviewOpen(true)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      fontSize: 13, fontWeight: 700, color: "#fff", background: "#059669",
                      border: "none", borderRadius: 6, padding: "10px 22px", cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(5,150,105,0.3)"
                    }}
                  >
                    <Award size={16} /> Open Advisory Academic Overview
                  </button>
                </div>
              </div>
            </DocPanel>
          ) : (
            <div style={{ flex: 1, minHeight: 650, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <GradebookFullScreen classId={cls?.id || classId || undefined} onBack={() => setTab("students")} hideBack />
            </div>
          )
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab==="analytics" && (
          <DocPanel title="Class Analytics" icon={BarChart2}>
            <div style={{ padding: "60px 20px", textAlign: "center", color: C.t3, fontSize: 13 }}>
              Analytics charts are currently unavailable. Future phases will introduce real-time class metrics powered by authoritative backend data.
            </div>
          </DocPanel>
        )}
      </div>

      {/* ── Student Profile overlay (Report Card) ── */}
      {/* ── Official SF9 Report Card Modal ── */}
      {sf9Student && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(15,8,8,0.6)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"24px 20px", overflowY:"auto" }}
          onClick={e=>{ if(e.target===e.currentTarget) setSf9Student(null); }}>
          <div style={{ width:"100%", maxWidth:900, borderRadius:4, overflow:"hidden", boxShadow:"0 20px 60px rgba(74,10,16,0.4)", background:"#fff" }}>
            <div style={{ background:C.m900, padding:"8px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ color:"rgba(255,255,255,0.7)", fontSize:11 }}>Official Calulut Report Card (SF9) - {sf9Student.surname}, {sf9Student.first}</span>
              <div style={{ display:"flex", gap:8 }}>
                <button 
                  onClick={() => window.open('http://localhost:4000/api/academic/report-card/sf9/preview', '_blank')}
                  style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"#fff", background:"#059669", border:"none", borderRadius:3, padding:"4px 10px", cursor:"pointer" }}
                  title="Download authentic Calulut Integrated School SF9 Excel Form 138"
                >
                  <FileSpreadsheet size={11}/> Authentic SF9 (.xlsx)
                </button>
                <button onClick={()=>setSf9Student(null)} style={{ width:26, height:26, borderRadius:3, background:"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <X size={14}/>
                </button>
              </div>
            </div>
            <AuthenticCalulutSf9Viewer
              mode="student"
              studentData={{
                student: { id: sf9Student.id, name: `${sf9Student.first} ${sf9Student.surname}`, lrn: sf9Student.lrn },
                enrollment: { gradeLevel: (sf9Student as any).gradeLevel ?? cls.grade ?? 10, section: (sf9Student as any).section ?? cls.section ?? "Rizal" }
              }}
              onBack={() => setSf9Student(null)}
            />
          </div>
        </div>
      )}

      {/* ── Learner Profile & SF8 Health Modal ── */}
      {learnerProfileStudent && (
        <LearnerProfileModal
          student={learnerProfileStudent}
          sectionInfo={{ grade: cls.grade, section: cls.section }}
          isAdviser={Boolean(cls.adviser)}
          onClose={() => setLearnerProfileStudent(null)}
          onStudentUpdated={() => {
            fetchRoster();
          }}
        />
      )}

      {/* ── Adviser Add Learner Modal ── */}
      {isAddLearnerOpen && (
        <AdviserAddLearnerModal
          sectionId={cls?.sectionId || cls.id}
          grade={cls.grade}
          section={cls.section}
          adviserName={cls?.adviserName || (typeof cls?.adviser === 'string' ? cls.adviser : undefined)}
          onLearnerAdded={() => {
            fetchRoster();
          }}
          onClose={() => setIsAddLearnerOpen(false)}
        />
      )}

      {/* ── DepEd SF8 Report Modal ── */}
      {isSf8ModalOpen && (
        <DepEdSf8Modal
          sectionId={effectiveSectionId || cls?.sectionId || cls?.id}
          grade={cls?.grade || 10}
          section={cls?.section || "Rizal"}
          onClose={() => setIsSf8ModalOpen(false)}
        />
      )}

      {/* ── Advisory Academic Overview Modal ── */}
      {isAdvisoryOverviewOpen && (
        <AdvisoryAcademicOverviewModal
          sectionId={effectiveSectionId || cls?.sectionId || cls?.id}
          gradeLevel={cls?.grade}
          sectionName={cls?.section}
          onClose={() => setIsAdvisoryOverviewOpen(false)}
        />
      )}

    </div>
  );
}