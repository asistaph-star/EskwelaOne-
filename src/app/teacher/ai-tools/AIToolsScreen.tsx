import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C } from '../../shared/constants/tokens';
import { 
  FileText, 
  AlertCircle, 
  RefreshCw, 
  Filter, 
  Info,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { DocPanel } from '../../shared/components/DocPanel';
import { EmptyState } from '../../shared/components/EmptyState';
import { useMyClasses } from '../shared/useMyClasses';
import { 
  studentSupportApi, 
  TeacherStudentSupportResponse, 
  TeacherStudentSupportIndicator 
} from '../../../api/studentSupport.api';

export function AIToolsScreen() {
  const { myClasses, isLoading: isLoadingClasses } = useMyClasses();

  const [data, setData] = useState<TeacherStudentSupportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);

  // Filters
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('all');

  // Derive unique sections and subjects from teacher's assignments
  const sectionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of myClasses) {
      const sId = c.sectionId || c.section_id;
      if (sId) {
        map.set(sId, `Grade ${c.grade} - ${c.section}`);
      }
    }
    // Also include sections from API response if any
    if (data?.students) {
      for (const s of data.students) {
        if (s.sectionId && !map.has(s.sectionId)) {
          map.set(s.sectionId, `Grade ${s.gradeLevel} - ${s.sectionName}`);
        }
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [myClasses, data]);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of myClasses) {
      const subId = c.subjectId || c.subject_id;
      if (subId) {
        map.set(subId, c.subject);
      }
    }
    if (data?.students) {
      for (const s of data.students) {
        if (s.subjectId && !map.has(s.subjectId)) {
          map.set(s.subjectId, s.subjectName);
        }
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [myClasses, data]);

  const fetchIndicators = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsUnauthorized(false);

    try {
      const response = await studentSupportApi.getTeacherIndicators({
        sectionId: selectedSection || undefined,
        subjectId: selectedSubject || undefined,
        term: selectedTerm !== 'all' ? selectedTerm : undefined,
      });
      setData(response);
    } catch (err: any) {
      console.error('Failed to load student support indicators:', err);
      if (err?.status === 403 || err?.code === 'FORBIDDEN') {
        setIsUnauthorized(true);
      } else {
        setErrorMessage(err?.message || 'Records could not be loaded. Please check your connection and try again.');
      }
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSection, selectedSubject, selectedTerm]);

  useEffect(() => {
    fetchIndicators();
  }, [fetchIndicators]);

  const threshold = data?.metadata?.passingGradeThreshold ?? 75;
  const attendanceWindow = data?.metadata?.attendanceWindow;
  const students = data?.students || [];

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 24, background: "transparent", position: "relative" }}>
      {/* 1. Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 8, 
              background: C.m50, 
              border: `1px solid ${C.borderMed}`, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center" 
            }}>
              <FileText size={20} color={C.m700} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>
                Student Support Insights
              </h1>
              <div style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>
                Factual classroom attendance, grades, and gradebook records from DigiSkwela.
              </div>
            </div>
          </div>

          <button
            onClick={() => fetchIndicators()}
            disabled={isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#fff",
              border: `1px solid ${C.borderMed}`,
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: C.t1,
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.background = C.m50; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
          >
            <RefreshCw size={14} color={C.t2} className={isLoading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Required Explanatory Note Banner */}
      <div style={{ 
        marginBottom: 20, 
        padding: "14px 18px", 
        background: C.m50, 
        border: `1px solid ${C.borderMed}`, 
        borderRadius: 8,
        display: "flex",
        alignItems: "flex-start",
        gap: 12
      }}>
        <Info size={18} color={C.m700} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.5 }}>
          <strong>Notice: </strong>
          Factual records from DigiSkwela. This is not a prediction. A recorded term grade below {threshold} in one term is not a final result. Final evaluation requires all terms. Review before acting.
        </div>
      </div>

      {/* 3. Rules & Context Bar */}
      {attendanceWindow && (
        <div style={{ 
          marginBottom: 20, 
          padding: "12px 16px", 
          background: "#fff", 
          border: `1px solid ${C.border}`, 
          borderRadius: 8,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.t2 }}>
              <Calendar size={14} color={C.m700} />
              <span>
                <strong>Attendance Window:</strong> {attendanceWindow.startDate} to {attendanceWindow.endDate} ({attendanceWindow.timezone})
              </span>
            </div>

            <div style={{ width: 1, height: 16, background: C.border }} />

            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.t2 }}>
              <ShieldCheck size={14} color={C.m700} />
              <span>
                <strong>Passing Threshold:</strong> {threshold}
              </span>
            </div>
          </div>

          <div style={{ fontSize: 11, color: C.t3, display: "flex", alignItems: "center", gap: 10 }}>
            <span title="Source: Grade model term_grade">Grades: Term Grade Records</span>
            <span>•</span>
            <span title="Source: ClassAttendance only. Gate attendance is not used.">Attendance: ClassAttendance (Gate scans not used)</span>
            <span>•</span>
            <span title="Source: Gradebook column entries">Scores: Gradebook Cells</span>
          </div>
        </div>
      )}

      {/* 4. Filter Bar */}
      <div style={{ 
        marginBottom: 24, 
        padding: "12px 16px", 
        background: "#fff", 
        border: `1px solid ${C.border}`, 
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: C.t1 }}>
          <Filter size={14} color={C.m700} />
          <span>Filters:</span>
        </div>

        {/* Section Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label htmlFor="filter-section" style={{ fontSize: 12, color: C.t2, fontWeight: 600 }}>Section:</label>
          <select
            id="filter-section"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              borderRadius: 6,
              border: `1px solid ${C.borderMed}`,
              background: "#fff",
              color: C.t1,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">All Assigned Sections</option>
            {sectionOptions.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Subject Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label htmlFor="filter-subject" style={{ fontSize: 12, color: C.t2, fontWeight: 600 }}>Subject:</label>
          <select
            id="filter-subject"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              borderRadius: 6,
              border: `1px solid ${C.borderMed}`,
              background: "#fff",
              color: C.t1,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">All Assigned Subjects</option>
            {subjectOptions.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.label}</option>
            ))}
          </select>
        </div>

        {/* Term Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label htmlFor="filter-term" style={{ fontSize: 12, color: C.t2, fontWeight: 600 }}>Term:</label>
          <select
            id="filter-term"
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              borderRadius: 6,
              border: `1px solid ${C.borderMed}`,
              background: "#fff",
              color: C.t1,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">All Terms</option>
            <option value="T1">Term 1 (T1)</option>
            <option value="T2">Term 2 (T2)</option>
            <option value="T3">Term 3 (T3)</option>
            <option value="T4">Term 4 (T4)</option>
          </select>
        </div>

        {(selectedSection || selectedSubject || selectedTerm !== 'all') && (
          <button
            onClick={() => {
              setSelectedSection('');
              setSelectedSubject('');
              setSelectedTerm('all');
            }}
            style={{
              marginLeft: "auto",
              padding: "4px 8px",
              fontSize: 11,
              color: C.m700,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* 5. Main Content Area */}
      {isLoading ? (
        <DocPanel title="Classroom Support Records" icon={FileText}>
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              border: `3px solid ${C.borderMed}`, 
              borderTopColor: C.m700, 
              borderRadius: "50%", 
              animation: "spin 0.8s linear infinite", 
              margin: "0 auto 16px" 
            }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>Loading student support records...</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Querying authoritative classroom records from DigiSkwela.</div>
          </div>
        </DocPanel>
      ) : isUnauthorized ? (
        <div style={{ maxWidth: 600, margin: "40px auto" }}>
          <EmptyState
            icon={AlertCircle}
            title="Access Restricted"
            description="You are not authorized to view student support indicators for the requested section or assignment."
            guidance="You may only view indicators for sections and subjects currently assigned to your teacher account."
          />
        </div>
      ) : errorMessage ? (
        <div style={{ maxWidth: 600, margin: "40px auto", textAlign: "center" }}>
          <EmptyState
            icon={AlertCircle}
            title="Failed to Load Records"
            description={errorMessage}
            guidance="Please verify your network connection and click retry to attempt reloading the records."
          />
          <button
            onClick={() => fetchIndicators()}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              background: C.m700,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Retry Loading
          </button>
        </div>
      ) : students.length === 0 ? (
        <DocPanel title="Classroom Support Records" icon={FileText}>
          <div style={{ padding: 24 }}>
            <EmptyState
              icon={CheckCircle2}
              title="No Support Indicators Found"
              description="No students with the selected factual indicators were found for these filters."
              guidance="This view only displays students who have at least one factual indicator: a recorded term grade below the passing threshold, recorded class attendance marks, or missing gradebook scores."
            />
          </div>
        </DocPanel>
      ) : (
        <DocPanel 
          title={`Classroom Support Records (${students.length} student${students.length === 1 ? '' : 's'})`} 
          icon={FileText}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: C.m50, borderBottom: `1.5px solid ${C.border}` }}>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.05em" }}>Student</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.05em" }}>Section</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recorded Term Grade Below {threshold}</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Recorded Absences</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Late</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Excused</th>
                  <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Missing Scores</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student: TeacherStudentSupportIndicator, idx: number) => {
                  const hasBelowPassing = student.belowPassingTerms && student.belowPassingTerms.length > 0;
                  const rowBg = idx % 2 === 0 ? "#fff" : C.paper;

                  return (
                    <tr 
                      key={student.studentId}
                      style={{ 
                        background: rowBg, 
                        borderBottom: `1px solid ${C.border}`,
                        transition: "background 0.1s ease" 
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.m50; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}
                    >
                      {/* Student Name */}
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: C.t1 }}>
                        {student.studentDisplayName}
                      </td>

                      {/* Section */}
                      <td style={{ padding: "12px 16px", fontSize: 12, color: C.t2 }}>
                        {student.sectionName}
                      </td>

                      {/* Subject */}
                      <td style={{ padding: "12px 16px", fontSize: 12, color: C.t2 }}>
                        {student.subjectName}
                      </td>

                      {/* Recorded Term Grade Below Threshold */}
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>
                        {hasBelowPassing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {student.belowPassingTerms.map((bpt, i) => (
                              <span 
                                key={i}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: C.red,
                                }}
                              >
                                {bpt.term} — {bpt.grade} (below {threshold})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: C.t3, fontSize: 12 }}>None recorded below {threshold}</span>
                        )}
                      </td>

                      {/* Recorded Absences */}
                      <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "center", fontWeight: 700 }}>
                        {student.recordedAbsences.absences > 0 ? (
                          <span style={{ 
                            padding: "3px 8px", 
                            background: student.recordedAbsences.absences >= 3 ? C.redBg : C.amberBg,
                            color: student.recordedAbsences.absences >= 3 ? C.red : C.amber,
                            borderRadius: 12,
                            fontSize: 11
                          }}>
                            {student.recordedAbsences.absences}
                          </span>
                        ) : (
                          <span style={{ color: C.t3, fontWeight: 400 }}>0</span>
                        )}
                      </td>

                      {/* Late */}
                      <td style={{ padding: "12px 16px", fontSize: 12, textAlign: "center", color: C.t2 }}>
                        {student.recordedAbsences.tardies > 0 ? (
                          <span style={{ 
                            padding: "3px 8px", 
                            background: C.amberBg, 
                            color: C.amber, 
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600
                          }}>
                            {student.recordedAbsences.tardies}
                          </span>
                        ) : (
                          <span style={{ color: C.t3 }}>0</span>
                        )}
                      </td>

                      {/* Excused */}
                      <td style={{ padding: "12px 16px", fontSize: 12, textAlign: "center", color: C.t2 }}>
                        {student.recordedAbsences.excused > 0 ? (
                          <span style={{ 
                            padding: "3px 8px", 
                            background: C.blueBg, 
                            color: C.blue, 
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600
                          }}>
                            {student.recordedAbsences.excused}
                          </span>
                        ) : (
                          <span style={{ color: C.t3 }}>0</span>
                        )}
                      </td>

                      {/* Missing Scores */}
                      <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "center", fontWeight: 700 }}>
                        {student.missingScoresCount > 0 ? (
                          <span style={{ 
                            padding: "3px 8px", 
                            background: C.amberBg, 
                            color: C.amber, 
                            borderRadius: 12,
                            fontSize: 11
                          }}>
                            {student.missingScoresCount}
                          </span>
                        ) : (
                          <span style={{ color: C.t3, fontWeight: 400 }}>0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DocPanel>
      )}
    </div>
  );
}