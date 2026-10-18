import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiClient } from '../../../api/client';
import { facultyAttendanceApi, FacultyAttendanceSummary } from '../../../api/facultyAttendance.api';
import { useGateAttendanceSSE } from '../../shared/hooks/useGateAttendanceSSE';
import { PScreen, GradeCardInfo } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import { Sparkles, Users, GraduationCap, BookMarked, AlertCircle, HeartHandshake, Calendar, CalendarCheck, ArrowRight, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart as RBarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { executiveSummaryApi, ExecutiveSummaryResponse } from '../../../api/executiveSummary.api';
import { useAppContext } from '../../shared/AppContext';
import { DailyExecutiveBriefing } from './DailyExecutiveBriefing';

export interface GateTrendPoint {
  date: string;
  count: number;
}

export interface PrincipalDashboardResponse {
  enrolledStudents: number;
  totalTeachers: number;
  activeSections?: number;
  studentsOnCampus?: number;
  gateToday: number;
  pendingApprovals: number;
  pendingDisciplineCases?: number;
  studentsRequiringAttention?: number;
  gateTrend: GateTrendPoint[];
}

function Stamp({ label, color, bg }: { label:string; color:string; bg:string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, background: bg }}>
      {label}
    </span>
  );
}

export function PDashboard({ onNav, onShowGradeCard }: { onNav:(s:PScreen)=>void; onShowGradeCard:(info:GradeCardInfo)=>void }) {
  const { currentUser } = useAppContext();
  const [dashData, setDashData] = useState<PrincipalDashboardResponse | null>(null);
  const [teacherLeaves, setTeacherLeaves] = useState<any[]>([]);
  const [facultySummary, setFacultySummary] = useState<FacultyAttendanceSummary | null>(null);
  const [attentionStudents, setAttentionStudents] = useState<any[]>([]);
  const [academicData, setAcademicData] = useState<any | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Executive Summary State
  const [summaryData, setSummaryData] = useState<ExecutiveSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);
  const [isLiveUpdating, setIsLiveUpdating] = useState(false);
  const [liveUpdateError, setLiveUpdateError] = useState(false);

  // Debounce timer for coalescing rapid SSE attendance arrivals into one briefing fetch
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 2500; // 2.5s debounce window (recommended 2–5 seconds)

  // Stable callback for loading and manually refreshing Executive Summary (button or mount)
  const loadSummary = useCallback(async () => {
    // If a debounce timer is running, cancel it as explicit manual refresh takes precedence
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSummaryLoading(true);
    setSummaryError(false);
    setLiveUpdateError(false);
    try {
      const res = await executiveSummaryApi.getSummary();
      setSummaryData(res);
    } catch (err) {
      console.error('Failed to load executive summary:', err);
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Stable callback for background SSE auto-refresh:
  // Retains the last valid briefing on screen (no blanking, no skeleton flash)
  const loadSummaryBackground = useCallback(async () => {
    setIsLiveUpdating(true);
    setLiveUpdateError(false);
    try {
      const res = await executiveSummaryApi.getSummary();
      setSummaryData(res);
    } catch (err) {
      console.error('Failed to live-refresh executive summary:', err);
      // Retain last valid briefing and display non-intrusive notification
      setLiveUpdateError(true);
    } finally {
      setIsLiveUpdating(false);
    }
  }, []);

  // Debounced trigger: coalesces rapid bursts of scans into ONE summary fetch
  const triggerDebouncedSummaryRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      loadSummaryBackground();
      debounceTimerRef.current = null;
    }, DEBOUNCE_MS);
  }, [loadSummaryBackground]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Stable callback for refreshing Student Gate / Admin Dashboard metrics
  const loadDashboardData = useCallback(async () => {
    try {
      const dData: any = await apiClient.get<PrincipalDashboardResponse>('/admin/dashboard').catch(() => null);
      if (dData) {
        setDashData(dData.data || dData);
      }
    } catch (e) {
      console.error('Failed to refresh dashboard data:', e);
    }
  }, []);

  // Stable callback for refreshing Faculty Attendance summary
  const loadFacultySummary = useCallback(async () => {
    try {
      const fData = await facultyAttendanceApi.getSummary().catch((err) => {
        console.error('Failed to load faculty summary:', err);
        return null;
      });
      if (fData) {
        setFacultySummary(fData);
      }
    } catch (e) {
      console.error('Failed to refresh faculty summary:', e);
    }
  }, []);

  // Stable callbacks for SSE events:
  // Student Gate scan -> 'attendance-changed' -> refresh dashboard KPI + debounced briefing refresh
  const handleStudentAttendanceChanged = useCallback(() => {
    loadDashboardData();
    triggerDebouncedSummaryRefresh();
  }, [loadDashboardData, triggerDebouncedSummaryRefresh]);

  // Faculty Gate scan -> 'faculty-attendance-changed' -> refresh faculty KPI + debounced briefing refresh
  const handleFacultyAttendanceChanged = useCallback(() => {
    loadFacultySummary();
    triggerDebouncedSummaryRefresh();
  }, [loadFacultySummary, triggerDebouncedSummaryRefresh]);

  // Connect to authoritative Gate Attendance SSE for real-time KPI & briefing updates:
  // Student Gate scan -> 'attendance-changed' -> handleStudentAttendanceChanged()
  // Faculty Gate scan -> 'faculty-attendance-changed' -> handleFacultyAttendanceChanged()
  useGateAttendanceSSE({
    onStudentAttendanceChanged: handleStudentAttendanceChanged,
    onFacultyAttendanceChanged: handleFacultyAttendanceChanged,
  });

  useEffect(() => {
    Promise.all([
      apiClient.get<PrincipalDashboardResponse>('/admin/dashboard').catch(() => null),
      apiClient.get('/admin/leaves').catch(() => []),
      facultyAttendanceApi.getSummary().catch((err) => {
        console.error('Failed to load faculty summary:', err);
        return null;
      }),
      apiClient.get<any>('/admin/welfare-alerts').catch(() => null),
      apiClient.get<any>('/admin/analytics/academics').catch(() => null),
      apiClient.get<any[]>('/admin/events').catch(() => [])
    ]).then(([dData, lData, fData, wData, aData, eData]: any) => {
      if (!dData) setError(true);
      else setDashData(dData.data || dData);
      
      setTeacherLeaves(lData?.data || lData || []);
      if (fData) {
        setFacultySummary(fData);
      }
      const attList = wData?.data?.attentionStudents || wData?.attentionStudents || [];
      setAttentionStudents(Array.isArray(attList) ? attList : []);

      setAcademicData(aData?.data || aData || null);

      const evList = Array.isArray(eData?.data) ? eData.data : (Array.isArray(eData) ? eData : []);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const filteredEvents = evList
        .filter((ev: any) => new Date(ev.date).getTime() >= todayStart.getTime())
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setUpcomingEvents(filteredEvents);

      setLoading(false);
    });
    loadSummary();
  }, [loadSummary]);

  const pendingLeavesList = teacherLeaves.filter(l => l.status === "Pending");
  
  const enrolled = dashData?.enrolledStudents || 0;
  const teachers = dashData?.totalTeachers || 0;
  const activeSections = dashData?.activeSections || 0;
  const pendingApprovalsCount = dashData?.pendingApprovals || 0;

  const overallPassRate = useMemo(() => {
    const list = academicData?.passingVsFailingByGradeLevel;
    if (!Array.isArray(list) || list.length === 0) return null;
    let passing = 0;
    let total = 0;
    list.forEach((item: any) => {
      passing += item.passing || 0;
      total += (item.passing || 0) + (item.failing || 0);
    });
    return total > 0 ? (passing / total) * 100 : null;
  }, [academicData]);

  const onCampusCount = dashData?.studentsOnCampus ?? 0;
  const facultyOnCampus = facultySummary?.timeOutPendingCount ?? 0;
  const facultyCompleted = facultySummary?.completedCount ?? 0;
  const totalFaculty = facultySummary?.totalActiveFaculty ?? 0;

  // Real, live operational KPI cards backed by PostgreSQL
  const KPI_CARDS = [
    { v: loading ? "..." : `${enrolled} Enrolled`, l: "Total Students", sub: "Active Current Year", subColor: C.t3, color: C.m700, bg: C.m100, icon: Users, dest: "p-monitoring" },
    { 
      v: loading ? "..." : `${onCampusCount} Checked In`, 
      l: "Students on Campus Now", 
      sub: onCampusCount > 0 ? "Currently Inside Campus" : "Live Gate Scan Activity", 
      subColor: onCampusCount > 0 ? C.green : C.t3, 
      color: onCampusCount > 0 ? C.green : C.m700, 
      bg: onCampusCount > 0 ? C.greenBg : C.m100, 
      icon: CalendarCheck, 
      dest: "p-monitoring" 
    },
    { v: loading ? "..." : `${teachers} Faculty`, l: "Total Teachers", sub: "Registered Profiles", subColor: C.t3, color: C.m700, bg: C.m100, icon: GraduationCap, dest: "p-teachers" },
    { 
      v: loading ? "..." : `${facultyOnCampus} / ${totalFaculty} Checked In`, 
      l: "Faculty Checked In Today", 
      sub: loading ? "Loading..." : facultyCompleted > 0
        ? `${facultyCompleted} Timed Out · ${facultySummary?.pendingCheckInCount ?? 0} Pending`
        : `${facultySummary?.onLeaveCount ?? 0} On Leave · ${facultySummary?.pendingCheckInCount ?? 0} Pending Check-In${(facultySummary?.officialBusinessCount ?? 0) > 0 ? ` · ${facultySummary?.officialBusinessCount} Official Business` : ''}`, 
      subColor: facultyOnCampus > 0 ? C.green : C.t3, 
      color: facultyOnCampus > 0 ? C.green : C.amber, 
      bg: facultyOnCampus > 0 ? C.greenBg : C.amberBg, 
      icon: GraduationCap, 
      dest: "p-teachers" 
    },
    { v: loading ? "..." : `${activeSections} Sections`, l: "Total Active Sections", sub: "Grades 7 to 10", subColor: C.t3, color: C.m700, bg: C.m100, icon: BookMarked, dest: "p-teachers" },
    { 
      v: loading ? "..." : `${dashData?.studentsRequiringAttention ?? attentionStudents.length} Flagged`, 
      l: "Students Requiring Attention", 
      sub: (dashData?.studentsRequiringAttention ?? attentionStudents.length) > 0 ? "Active Disciplinary Concerns" : "No active flags", 
      subColor: (dashData?.studentsRequiringAttention ?? attentionStudents.length) > 0 ? C.red : C.t3, 
      color: (dashData?.studentsRequiringAttention ?? attentionStudents.length) > 0 ? C.red : C.m700, 
      bg: (dashData?.studentsRequiringAttention ?? attentionStudents.length) > 0 ? C.redBg : C.m100, 
      icon: AlertCircle, 
      dest: "p-behavior" 
    },
    { 
      v: loading ? "..." : `${dashData?.pendingDisciplineCases ?? 0} Active`, 
      l: "Open Behavior Cases", 
      sub: (dashData?.pendingDisciplineCases ?? 0) > 0 ? "Under Investigation / Notified" : "All cases resolved", 
      subColor: (dashData?.pendingDisciplineCases ?? 0) > 0 ? C.amber : C.green, 
      color: (dashData?.pendingDisciplineCases ?? 0) > 0 ? C.amber : C.green, 
      bg: (dashData?.pendingDisciplineCases ?? 0) > 0 ? C.amberBg : C.greenBg, 
      icon: HeartHandshake, 
      dest: "p-behavior" 
    }
  ];

  if (error) {
    return <div style={{ padding: 40, textAlign: "center", color: C.red }}>Failed to load dashboard data.</div>;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "transparent", padding: "20px 24px" }}>
      {/* 1. Daily Executive Briefing (Prominent Top-of-Dashboard Placement) */}
      <DailyExecutiveBriefing
        summaryData={summaryData}
        loading={summaryLoading}
        error={summaryError}
        isLiveUpdating={isLiveUpdating}
        liveUpdateError={liveUpdateError}
        onRefresh={loadSummary}
        onNav={onNav}
        currentUser={currentUser}
      />

      {/* 2. Key Performance Indicator Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.l} onClick={() => onNav(kpi.dest as PScreen)} style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderLeft: `5px solid ${kpi.color}`, borderRadius: 4, padding: "12px 18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{kpi.l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>{kpi.v}</div>
                <div style={{ fontSize: 10, color: kpi.subColor, fontWeight: 600, marginTop: 4 }}>{kpi.sub}</div>
              </div>
              <div style={{ background: kpi.bg, width: 34, height: 34, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color={kpi.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Detailed Operational & Academic Panels */}
      <div style={{ display: "grid", gridTemplateColumns: "65fr 35fr", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* PRIN-004: Student-Centric Welfare Alerts Attention Layer */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>
                Students Requiring Attention ({attentionStudents.length})
              </span>
              <span onClick={() => onNav('p-behavior' as PScreen)} style={{ fontSize: 11, cursor: "pointer", color: "#fef08a", fontWeight: 600 }}>
                View Behavioral Reports →
              </span>
            </div>
            {attentionStudents.length === 0 ? (
              <div style={{ padding: "18px 16px", fontSize: 12, color: C.t3, textAlign: "center" }}>
                No students currently flagged for administrative attention. All cases resolved.
              </div>
            ) : (
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {attentionStudents.slice(0, 5).map((student, idx) => {
                  const statusColors: Record<string, { color: string; bg: string }> = {
                    'Under investigation': { color: C.purple, bg: C.purpleBg },
                    'Parent notified': { color: C.blue, bg: C.blueBg },
                    'Reported': { color: C.amber, bg: C.amberBg },
                  };
                  const sc = statusColors[student.latestStatus] || { color: C.t2, bg: C.paper };

                  return (
                    <div
                      key={student.studentId || idx}
                      onClick={() => onNav('p-behavior' as PScreen)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: idx < attentionStudents.length - 1 ? "1px solid #eee" : "none", cursor: "pointer" }}
                      className="hover:bg-slate-50 transition"
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>
                          {student.studentName}
                        </div>
                        <div style={{ fontSize: 11, color: C.t2, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, color: C.red }}>
                            {student.openConcernsCount} {student.openConcernsCount === 1 ? 'Open Concern' : 'Open Concerns'}
                          </span>
                          <span style={{ color: C.t3 }}>•</span>
                          <span style={{ color: C.t3 }}>Latest: {student.latestIncident}</span>
                          {student.sectionName && <span style={{ color: C.t3 }}>· {student.sectionName}</span>}
                        </div>
                      </div>
                      <Stamp label={student.latestStatus} color={sc.color} bg={sc.bg} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
              Pending Leave Approvals ({pendingApprovalsCount})
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingLeavesList.length === 0 ? (
                <div style={{ padding: "16px 12px", fontSize: 12, color: C.t3, textAlign: "center" }}>No pending leave requests.</div>
              ) : pendingLeavesList.slice(0,5).map((app, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>Leave Request</div>
                    <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{new Date(app.start_date).toLocaleDateString()} to {new Date(app.end_date).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
              7-Day Gate Activity Trend
            </div>
            <div style={{ padding: "16px 12px", minHeight: 200, display: "flex", flexDirection: "column" }}>
              {!dashData?.gateTrend || dashData.gateTrend.length === 0 ? (
                <div style={{ fontSize: 12, color: C.t3, textAlign: "center", margin: "auto" }}>No trend data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <RBarChart data={dashData.gateTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: C.m50 }} contentStyle={{ borderRadius: 4, border: `1px solid ${C.borderMed}`, fontSize: 12 }} />
                    <Bar dataKey="count" fill={C.m700} radius={[2, 2, 0, 0]} maxBarSize={40} />
                  </RBarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Academic Health Overview (Backed by real /admin/analytics/academics) */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
                Academic Health
              </span>
              <span onClick={() => onNav('p-analytics' as PScreen)} style={{ fontSize: 11, cursor: "pointer", color: "#fef08a", fontWeight: 600 }}>
                View Academic Analytics →
              </span>
            </div>
            <div style={{ padding: "16px 14px" }}>
              {!academicData || (!academicData.schoolAverageByGradeLevel?.length && !academicData.passingVsFailingByGradeLevel?.length) ? (
                <div style={{ fontSize: 12, color: C.t3, textAlign: "center", padding: "8px 0" }}>
                  No quarterly grade records submitted for the active academic year.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {overallPassRate !== null && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.paper, padding: "8px 12px", borderRadius: 4, border: `1px solid ${C.borderMed}` }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase" }}>Overall Pass Rate</span>
                      <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: overallPassRate >= 75 ? C.green : C.red }}>
                        {overallPassRate.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {academicData.schoolAverageByGradeLevel?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        Grade Level Averages
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                        {academicData.schoolAverageByGradeLevel.map((g: any) => (
                          <div key={g.gradeLevel} style={{ textAlign: "center", padding: "6px 4px", background: "#f8fafc", borderRadius: 4, border: `1px solid #e2e8f0` }}>
                            <div style={{ fontSize: 9, color: C.t3, fontWeight: 600 }}>Gr {g.gradeLevel}</div>
                            <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: g.average >= 75 ? C.t1 : C.red }}>
                              {g.average.toFixed(1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Events (Backed by real /admin/events) */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: C.m800, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 13, fontFamily: "'Fraunces', serif" }}>
                Upcoming Events ({upcomingEvents.length})
              </span>
              <span onClick={() => onNav('p-events' as PScreen)} style={{ fontSize: 11, cursor: "pointer", color: "#fef08a", fontWeight: 600 }}>
                Manage Events →
              </span>
            </div>
            <div style={{ padding: 12 }}>
              {upcomingEvents.length === 0 ? (
                <div style={{ padding: "16px 12px", fontSize: 12, color: C.t3, textAlign: "center" }}>
                  No upcoming events scheduled.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {upcomingEvents.slice(0, 3).map((ev: any) => {
                    const d = new Date(ev.date);
                    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <div key={ev.id} onClick={() => onNav('p-events' as PScreen)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} className="hover:bg-slate-50 transition">
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{ev.title}</div>
                          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                            {dateFormatted} {ev.audience ? `· For: ${ev.audience}` : ''}
                          </div>
                        </div>
                        <Stamp label={ev.type || 'Event'} color={C.m700} bg={C.m100} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
