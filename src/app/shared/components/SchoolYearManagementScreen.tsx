import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertCircle, CheckCircle2, Clock, RefreshCw, 
  BookOpen, Users, Calendar, Award, ShieldAlert, 
  Search, Filter, Download, Info, Check, FileSpreadsheet, X,
  CalendarDays, School, Layers, CheckCircle, ChevronRight, FileText, Lock,
  ArrowLeft, ArrowRight, SlidersHorizontal, LayoutDashboard, GraduationCap
} from 'lucide-react';
import { academicApi } from '../../../api/academic.api';
import { StudentPromotionWorkspace } from './StudentPromotionWorkspace';
import { StudentGradeVisibilityCard } from './StudentGradeVisibilityCard';

export function formatGradebookStatus(status: string): string {
  switch (status) {
    case 'Published':
      return 'Published';
    case 'Draft':
      return 'Draft';
    case 'Missing':
    case 'Uninitialized':
    case 'UNINITIALIZED':
      return 'Not yet created';
    default:
      return status;
  }
}

// Enforce full term labels everywhere — never display abbreviated identifiers such as T1, T2, T3
export function formatTermLabel(termKeyOrLabel?: string | null): string {
  if (!termKeyOrLabel) return '';
  const trimmed = String(termKeyOrLabel).trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'T1' || upper === 'TERM 1' || upper === 'TERM1' || upper === 'Q1') return 'TERM 1';
  if (upper === 'T2' || upper === 'TERM 2' || upper === 'TERM2' || upper === 'Q2') return 'TERM 2';
  if (upper === 'T3' || upper === 'TERM 3' || upper === 'TERM3' || upper === 'Q3') return 'TERM 3';
  if (upper === 'T4' || upper === 'TERM 4' || upper === 'TERM4' || upper === 'Q4') return 'TERM 4';
  return trimmed;
}

interface SchoolYearManagementScreenProps {
  portal: 'Principal' | 'Admin' | 'Registrar';
}

export function SchoolYearManagementScreen({ portal }: SchoolYearManagementScreenProps) {
  // Main Tab: 'overview' | 'grades' | 'promotion'
  const [mainTab, setMainTab] = useState<'overview' | 'grades' | 'promotion'>('grades');
  const [data, setData] = useState<any | null>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grade View Sub-State: 'summary' | 'gradebooks' | 'students'
  const [gradeView, setGradeView] = useState<'summary' | 'gradebooks' | 'students'>('summary');

  const handleSwitchGradeView = (view: 'summary' | 'gradebooks' | 'students') => {
    setGradeView(view);
    // Smoothly scroll workspace to top for immediate visual feedback
    setTimeout(() => {
      const target = document.getElementById('grade-management-workspace');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  };

  // Search & filter state for Gradebooks
  const [gbSearch, setGbSearch] = useState('');
  const [gbTermFilter, setGbTermFilter] = useState<'ALL' | 'TERM 1' | 'TERM 2' | 'TERM 3'>('ALL');
  const [gbStatusFilter, setGbStatusFilter] = useState<'ALL' | 'Draft' | 'Missing'>('ALL');

  // Search & filter state for Students
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSectionFilter, setStudentSectionFilter] = useState('ALL');

  // Fetch all academic years
  useEffect(() => {
    academicApi.getYears()
      .then((years: any) => {
        const list = Array.isArray(years) ? years : [];
        setAcademicYears(list);
        const current = list.find((y: any) => y.is_current) || list[0];
        if (current?.id) {
          setSelectedYearId(current.id);
        }
      })
      .catch((err: any) => {
        console.error('Failed to load academic years:', err);
        setError('Failed to load academic years.');
        setLoading(false);
      });
  }, []);

  // Fetch academic year grade completion data whenever selectedYearId changes
  const fetchReadiness = async (yearId: string) => {
    if (!yearId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await academicApi.getClosureReadiness(yearId);
      const payload = (res as any)?.data || res;
      setData(payload);
    } catch (err: any) {
      console.error('Failed to load school-year grade data:', err);
      setError(err.message || 'Failed to evaluate school-year grade data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedYearId) {
      fetchReadiness(selectedYearId);
    }
  }, [selectedYearId]);

  // Derived gradebooks list
  const allUnresolvedGradebooks: any[] = useMemo(() => {
    if (!data?.gradebooks) return [];
    return data.gradebooks.unresolvedGradebooks || data.gradebooks.unresolvedSample || [];
  }, [data]);

  const filteredGradebooks = useMemo(() => {
    return allUnresolvedGradebooks.filter(gb => {
      const q = gbSearch.trim().toLowerCase();
      const matchQuery = !q || 
        gb.sectionName?.toLowerCase().includes(q) ||
        gb.subjectName?.toLowerCase().includes(q) ||
        gb.subjectCode?.toLowerCase().includes(q) ||
        gb.teacherName?.toLowerCase().includes(q);

      const normalizedTerm = formatTermLabel(gb.termLabel || gb.termKey);
      const matchTerm = gbTermFilter === 'ALL' || normalizedTerm === gbTermFilter;
      const matchStatus = gbStatusFilter === 'ALL' || gb.status === gbStatusFilter;

      return matchQuery && matchTerm && matchStatus;
    });
  }, [allUnresolvedGradebooks, gbSearch, gbTermFilter, gbStatusFilter]);

  // Derived students list
  const unresolvedStudents: any[] = useMemo(() => {
    return data?.studentCompleteness?.unresolvedStudents || [];
  }, [data]);

  const uniqueStudentSections = useMemo(() => {
    const set = new Set<string>();
    unresolvedStudents.forEach(s => {
      if (s.sectionName) set.add(s.sectionName);
    });
    return Array.from(set).sort();
  }, [unresolvedStudents]);

  const filteredStudents = useMemo(() => {
    return unresolvedStudents.filter(s => {
      const q = studentSearch.trim().toLowerCase();
      const matchQuery = !q ||
        s.name?.toLowerCase().includes(q) ||
        s.schoolId?.toLowerCase().includes(q) ||
        s.sectionName?.toLowerCase().includes(q);

      const matchSection = studentSectionFilter === 'ALL' || s.sectionName === studentSectionFilter;
      return matchQuery && matchSection;
    });
  }, [unresolvedStudents, studentSearch, studentSectionFilter]);

  // CSV Exports
  const exportGradebooksCSV = () => {
    if (!filteredGradebooks.length) return;
    const headers = ['Grade Level', 'Section', 'Learning Area Code', 'Learning Area Name', 'Grading Period', 'Assigned Teacher', 'Publication Status', 'Action Required'];
    const rows = filteredGradebooks.map(g => [
      `Grade ${g.gradeLevel}`,
      `"${g.sectionName}"`,
      `"${g.subjectCode}"`,
      `"${g.subjectName}"`,
      `"${formatTermLabel(g.termLabel || g.termKey)}"`,
      `"${g.teacherName}"`,
      `"${formatGradebookStatus(g.status)}"`,
      `"${g.requiredAction || (g.status === 'Draft' ? 'Teacher to complete score encoding and publish' : 'Initialize gradebook and encode scores')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `unresolved_gradebooks_${data?.academicYear?.name || 'SY2026-2027'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportStudentsCSV = () => {
    if (!filteredStudents.length) return;
    const headers = ['Learner Name', 'LRN', 'Grade Level', 'Section', 'Missing Grading Periods', 'General Average Status', 'Action Required'];
    const rows = filteredStudents.map(s => [
      `"${s.name}"`,
      `"${s.schoolId}"`,
      `Grade ${s.gradeLevel}`,
      `"${s.sectionName}"`,
      `"${s.missingTerms?.map((t: string) => formatTermLabel(t)).join(', ') || ''}"`,
      `"${s.generalAverageStatus}"`,
      `"${s.requiredAction || 'Awaiting grade publication for missing terms'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `incomplete_learners_${data?.academicYear?.name || 'SY2026-2027'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const evaluatedDateStr = data?.evaluatedAt 
    ? new Date(data.evaluatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const totalGradebooks = data?.gradebooks?.totalExpected || 0;
  const publishedGradebooks = data?.gradebooks?.publishedCount || 0;
  const totalLearners = data?.studentCompleteness?.activeEnrolledCount ?? data?.studentCompleteness?.totalEnrolled ?? 0;
  const completeLearners = data?.studentCompleteness?.fullyCompleteCount || 0;

  return (
    <div 
      className="flex-1 min-h-0 w-full overflow-y-auto"
      style={{ flex: 1, minHeight: 0, height: '100%', overflowY: 'auto' }}
    >
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-800" style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {/* ── BREADCRUMB & HEADER ── */}
      <div className="border-b border-slate-200 pb-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
          <School size={14} className="text-slate-500" />
          <span>Calulut Integrated School (DepEd School ID: 500146)</span>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-4 mt-1.5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
                School Years
              </h1>
              {academicYears.length > 1 ? (
                <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-md px-2.5 py-1 shadow-2xs">
                  <label htmlFor="academic-year-selector" className="text-[11px] font-bold text-slate-600 uppercase">Year:</label>
                  <select
                    id="academic-year-selector"
                    value={selectedYearId}
                    onChange={(e) => setSelectedYearId(e.target.value)}
                    className="text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded px-2 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-slate-400 cursor-pointer"
                  >
                    {academicYears.map((ay: any) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name} {ay.is_current ? '(Active)' : '(Archived)'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
                  {data?.academicYear?.name || 'SY 2026–2027'} (Active School Year)
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1 font-medium">
              Academic year grade finalization, learning-area ratings, and student promotion deliberation.
            </p>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs font-medium text-slate-500 flex items-center gap-1">
              <Clock size={13} className="text-slate-400" />
              Evaluated: {evaluatedDateStr}
            </span>
            <button
              onClick={() => selectedYearId && fetchReadiness(selectedYearId)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-slate-400' : 'text-slate-600'} />
              Refresh Status
            </button>
          </div>
        </div>

        {/* Primary Page Navigation Tabs (Overview vs Year-End Grades vs Student Promotion) */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-200 -mb-5">
          <button
            onClick={() => setMainTab('overview')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${mainTab === 'overview' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            <CalendarDays size={15} />
            Overview &amp; Calendar
          </button>
          <button
            onClick={() => setMainTab('grades')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${mainTab === 'grades' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            <BookOpen size={15} />
            Year-End Grades &amp; Finalization
            {publishedGradebooks < totalGradebooks && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                In Progress
              </span>
            )}
          </button>
          <button
            onClick={() => setMainTab('promotion')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${mainTab === 'promotion' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            <GraduationCap size={15} />
            Student Promotion &amp; Placement
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="py-16 text-center bg-white rounded-lg border border-slate-200">
          <RefreshCw size={26} className="animate-spin text-slate-400 mx-auto mb-3" />
          <div className="text-base font-bold text-slate-900">Loading School-Year Grades &amp; Promotion Workspace...</div>
          <div className="text-sm text-slate-600 mt-1 font-medium">Retrieving academic calendar configuration, section enrollment, and grade publication metrics.</div>
        </div>
      )}

      {error && !data && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-lg">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <AlertCircle size={18} />
            <span>Unable to load academic year records</span>
          </div>
          <p className="text-sm text-slate-700 mt-2">{error}</p>
          <button
            onClick={() => selectedYearId && fetchReadiness(selectedYearId)}
            className="mt-4 px-3.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded hover:bg-slate-800"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: OVERVIEW & CALENDAR ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {mainTab === 'overview' && data && (
        <div className="space-y-6 pt-2">
          
          {/* Institutional Academic Year Profile */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 md:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Fraunces', serif" }}>
                  Active Academic Year Profile
                </h2>
                <p className="text-sm text-slate-600 mt-0.5 font-medium">
                  Official instructional calendar configuration for Calulut Integrated School.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1.5 rounded-md bg-slate-100 text-slate-800 border border-slate-300">
                  {data.academicYear?.name || 'SY 2026–2027'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-slate-600 font-bold uppercase tracking-wider text-xs">Academic Year</span>
                <div className="text-base font-bold text-slate-900 mt-1">{data.academicYear?.name}</div>
                <div className="text-xs text-emerald-800 font-semibold mt-1">Operational Current Year</div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-slate-600 font-bold uppercase tracking-wider text-xs">Calendar Duration</span>
                <div className="text-base font-bold text-slate-900 mt-1">June 1, 2026 – April 30, 2027</div>
                <div className="text-xs text-slate-600 font-medium mt-1">11 Scheduled Instructional Months</div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-slate-600 font-bold uppercase tracking-wider text-xs">Grading Framework</span>
                <div className="text-base font-bold text-slate-900 mt-1">Three-Term Standard</div>
                <div className="text-xs text-slate-600 font-medium mt-1">DepEd Order No. 015, s. 2026</div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                <span className="text-slate-600 font-bold uppercase tracking-wider text-xs">Curriculum Level</span>
                <div className="text-base font-bold text-slate-900 mt-1">Junior High School</div>
                <div className="text-xs text-slate-600 font-medium mt-1">Grades 7, 8, 9, and 10 (8 Core Areas)</div>
              </div>
            </div>
          </div>

          {/* Three Key Academic Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Enrolled Learners</span>
                <Users size={18} className="text-slate-500" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">{data.studentCompleteness?.totalEnrolled}</div>
              <div className="text-sm text-slate-600 mt-1.5 leading-normal font-medium">
                Verified learners actively enrolled across junior high sections.
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Academic Sections</span>
                <Layers size={18} className="text-slate-500" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">{data.curriculumCoverage?.sectionsEvaluated?.length || 5}</div>
              <div className="text-sm text-slate-600 mt-1.5 leading-normal font-medium">
                Rizal (G10), Bonifacio (G9), Del Pilar (G9), Luna (G8), Mabini (G7).
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Teaching Assignments</span>
                <BookOpen size={18} className="text-slate-500" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">{data.gradebooks?.totalExpected / (data.academicYear?.configuredTerms?.length || 3)}</div>
              <div className="text-sm text-slate-600 mt-1.5 leading-normal font-medium">
                45 Subject teaching assignments across 9 official learning areas.
              </div>
            </div>

          </div>

          {/* Student Grade Visibility Controls */}
          <StudentGradeVisibilityCard
            academicYearId={data.academicYear?.id}
            academicYearName={data.academicYear?.name}
          />

          {/* Configured Academic Terms Schedule Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Configured Academic Terms Schedule
                </h3>
                <div className="text-xs text-slate-600 mt-0.5 font-medium">
                  Official evaluation periods for gradebook computation and trimester assessments.
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-3 py-1 rounded-md shadow-2xs">
                3 Terms Configured
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs">
                    <th className="py-3 px-4">Grading Period</th>
                    <th className="py-3 px-4">DepEd Official Label</th>
                    <th className="py-3 px-4">Evaluation Focus</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.academicYear?.configuredTerms?.map((t: any) => {
                    const fullLabel = formatTermLabel(t.label || t.key);
                    return (
                      <tr key={t.key} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4 font-bold text-sm text-slate-900">{fullLabel}</td>
                        <td className="py-3.5 px-4 font-semibold text-sm text-slate-800">{fullLabel}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-700 font-medium leading-relaxed">
                          Written Work, Performance Tasks, and Trimester Assessment consolidation.
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                            Active &amp; Configured
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Institutional Grade & Promotion Navigation Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Year-End Academic Grade Finalization &amp; Student Promotion
                </h3>
                <p className="text-sm text-slate-700 mt-1.5 max-w-3xl leading-relaxed">
                  DigiSkwela stores and verifies student grades strictly by academic year. Inspect gradebook publications, verify learner final ratings under DepEd Order No. 8, s. 2015, and promote eligible learners to the next grade level with permanent record preservation.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setMainTab('grades')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <BookOpen size={14} />
                  <span>Inspect Year-End Grades</span>
                </button>
                <button
                  onClick={() => setMainTab('promotion')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-md text-xs font-bold hover:bg-emerald-800 transition-colors shadow-xs"
                >
                  <GraduationCap size={14} />
                  <span>Student Promotion &amp; Placement</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: YEAR-END GRADES & FINALIZATION ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {mainTab === 'grades' && data && (
        <div id="grade-management-workspace" className="space-y-6 pt-2">
          
          {/* Executive Grade Management Header Banner */}
          <div className="p-4 md:p-5 rounded-lg border bg-white border-slate-200 text-slate-800 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-900 border border-slate-300">
                    {data.academicYear?.name || 'SY 2026–2027'} Readiness
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-50 text-blue-900 border border-blue-200">
                    DepEd Order No. 8, s. 2015 Framework
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 pt-1">
                  Academic Year Grade Finalization &amp; Subject Ratings Overview
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Track TERM 1, TERM 2, and TERM 3 gradebook publication status, review authoritative learning-area final ratings, identify incomplete learners, and prepare for student promotion.
                </p>
              </div>

              {/* Progress Counters */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-center min-w-[120px]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gradebooks</div>
                  <div className="text-lg font-bold text-slate-900">
                    {publishedGradebooks} <span className="text-xs font-normal text-slate-500">of {totalGradebooks}</span>
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-800 mt-0.5">
                    {publishedGradebooks === totalGradebooks ? 'All Published' : `${totalGradebooks - publishedGradebooks} Pending`}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-center min-w-[120px]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Learners</div>
                  <div className="text-lg font-bold text-slate-900">
                    {completeLearners} <span className="text-xs font-normal text-slate-500">of {totalLearners}</span>
                  </div>
                  <div className="text-[10px] font-semibold text-rose-800 mt-0.5">
                    {totalLearners - completeLearners > 0 ? `${totalLearners - completeLearners} Incomplete` : 'All Complete'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── UNIFIED GRADE VIEW SWITCHER TABS ── */}
          <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 px-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <SlidersHorizontal size={14} className="text-slate-500" />
                <span>Grade Workspaces:</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Grade Workspaces">
                <button
                  type="button"
                  id="tab-grade-summary"
                  role="tab"
                  aria-selected={gradeView === 'summary'}
                  onClick={() => handleSwitchGradeView('summary')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    gradeView === 'summary'
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <LayoutDashboard size={14} />
                  <span>Grade Overview &amp; Summary</span>
                </button>

                <button
                  type="button"
                  id="tab-gradebooks-list"
                  role="tab"
                  aria-selected={gradeView === 'gradebooks'}
                  onClick={() => handleSwitchGradeView('gradebooks')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    gradeView === 'gradebooks'
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <BookOpen size={14} />
                  <span>Gradebook Publication</span>
                  {allUnresolvedGradebooks.length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      gradeView === 'gradebooks' ? 'bg-slate-800 text-amber-300' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {allUnresolvedGradebooks.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  id="tab-learner-records"
                  role="tab"
                  aria-selected={gradeView === 'students'}
                  onClick={() => handleSwitchGradeView('students')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    gradeView === 'students'
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Users size={14} />
                  <span>Learner Academic Records &amp; Final Ratings</span>
                  {(data.studentCompleteness?.incompleteCount || 0) > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      gradeView === 'students' ? 'bg-slate-800 text-rose-300' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {data.studentCompleteness?.incompleteCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* ── GRADE SUB-VIEW 1: SUMMARY ── */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {gradeView === 'summary' && (
            <div className="space-y-6">
              
              {/* 2 Primary Grade Cards (Gradebooks & Learner Records) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Card 1: Gradebook Publication */}
                <div 
                  onClick={() => handleSwitchGradeView('gradebooks')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSwitchGradeView('gradebooks'); } }}
                  role="button"
                  tabIndex={0}
                  aria-label="Inspect Gradebook Publication details"
                  className="p-5 bg-white border border-slate-200 rounded-lg cursor-pointer transition-all hover:border-slate-400 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-slate-800/20 group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-slate-600 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">Gradebook Publication Status</span>
                      <BookOpen size={18} className="text-slate-500 group-hover:text-slate-900 transition-colors" />
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-1">
                      {data.gradebooks?.publishedCount} <span className="text-lg font-normal text-slate-400">of {data.gradebooks?.totalExpected}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-2 font-medium">
                      <span className="font-semibold text-amber-800">{data.gradebooks?.draftCount} Draft</span>
                      <span className="text-slate-400 mx-1.5">,</span>
                      <span className="font-semibold text-rose-800">{data.gradebooks?.missingCount} Not yet created</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-3 leading-relaxed font-medium">
                      Teachers encode assessment scores and publish official gradebooks across TERM 1, TERM 2, and TERM 3. Click to inspect pending gradebooks by learning area and assigned teacher.
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-800 group-hover:text-slate-950">
                    <span>Inspect Gradebook Publication Work List</span>
                    <ArrowRight size={14} className="text-slate-400 group-hover:translate-x-1 group-hover:text-slate-900 transition-all" />
                  </div>
                </div>

                {/* Card 2: Learner Academic Records */}
                <div 
                  onClick={() => handleSwitchGradeView('students')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSwitchGradeView('students'); } }}
                  role="button"
                  tabIndex={0}
                  aria-label="Inspect Learner Academic Records details"
                  className="p-5 bg-white border border-slate-200 rounded-lg cursor-pointer transition-all hover:border-slate-400 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-slate-800/20 group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-slate-600 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">Learner Academic Records &amp; Final Ratings</span>
                      <Users size={18} className="text-slate-500 group-hover:text-slate-900 transition-colors" />
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-1">
                      {data.studentCompleteness?.fullyCompleteCount} <span className="text-lg font-normal text-slate-400">of {data.studentCompleteness?.activeEnrolledCount ?? data.studentCompleteness?.totalEnrolled} Active</span>
                    </div>
                    <div className="text-xs mt-2 text-slate-600 font-medium">
                      {(data.studentCompleteness?.incompleteCount || 0) > 0 ? (
                        <span className="font-semibold text-rose-800">{data.studentCompleteness?.incompleteCount} with missing term grades</span>
                      ) : (
                        <span className="font-semibold text-emerald-800">All active learners complete</span>
                      )}
                      {Boolean(data.studentCompleteness?.departedCount) && (
                        <span className="text-slate-500 ml-1.5 font-normal">
                          • {data.studentCompleteness?.departedCount} officially departed
                        </span>
                      )}
                      {Boolean(data.studentCompleteness?.remedialCandidatesCount) && (
                        <span className="text-amber-700 ml-1.5 font-normal">
                          • {data.studentCompleteness?.remedialCandidatesCount} remedial
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-3 leading-relaxed font-medium">
                      Under DepEd Order No. 8, s. 2015, learners require complete term grades to determine authoritative final ratings and General Averages. Click to inspect incomplete records and academic exceptions.
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-800 group-hover:text-slate-950">
                    <span>Inspect Learner Records &amp; Final Ratings</span>
                    <ArrowRight size={14} className="text-slate-400 group-hover:translate-x-1 group-hover:text-slate-900 transition-all" />
                  </div>
                </div>

              </div>

              {/* Summary Table: Gradebook Publication Status by Grading Period */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Gradebook Publication Status by Grading Period
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    3 Configured Terms
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs">
                        <th className="py-3 px-4">Grading Period</th>
                        <th className="py-3 px-4 text-center">Expected</th>
                        <th className="py-3 px-4 text-center text-emerald-800">Published</th>
                        <th className="py-3 px-4 text-center text-amber-800">Draft</th>
                        <th className="py-3 px-4 text-center text-rose-800">Not Yet Created</th>
                        <th className="py-3 px-4 text-center">Completion State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.gradebooks?.byTerm?.map((t: any) => {
                        const fullLabel = formatTermLabel(t.termLabel || t.termKey);
                        return (
                          <tr key={t.termKey} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 font-bold text-sm text-slate-900">{fullLabel}</td>
                            <td className="py-3 px-4 text-center font-semibold text-slate-700">{t.expectedGradebooks}</td>
                            <td className="py-3 px-4 text-center font-bold text-emerald-800">{t.publishedGradebooks}</td>
                            <td className="py-3 px-4 text-center font-bold text-amber-800">{t.draftGradebooks}</td>
                            <td className="py-3 px-4 text-center font-bold text-rose-800">{t.missingGradebooks}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${t.status === 'READY' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                                {t.status === 'READY' ? 'Complete' : 'In Progress'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DepEd Order No. 8, s. 2015 Policy Guidance Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-3">
                <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-slate-900 font-bold">DepEd Policy Standard (DO 8, s. 2015 &amp; DO 11, s. 2018):</strong>
                  <ul className="list-disc pl-4 mt-1.5 space-y-1 text-slate-600 font-medium">
                    <li>Authoritative final learning-area ratings and General Averages are calculated upon consolidation of all three configured grading periods.</li>
                    <li>Published failing grades (&lt; 75) are valid official records. Learners with 1–2 failing learning areas require remedial classes; learners with 3 or more are retained.</li>
                    <li>For officially departed learners (Dropped Out or Transferred Out), prior earned grades are preserved for permanent SF10 records, while subsequent terms are officially excused.</li>
                  </ul>
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* ── GRADE SUB-VIEW 2: GRADEBOOK PUBLICATION WORK LIST ── */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {gradeView === 'gradebooks' && (
            <div className="space-y-4">
              
              {/* Workspace Header with Prominent Back Action */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      id="btn-back-to-grade-summary"
                      onClick={() => handleSwitchGradeView('summary')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-md border border-slate-300 transition-colors cursor-pointer shadow-2xs"
                      title="Return to Grade Overview"
                    >
                      <ArrowLeft size={15} />
                      <span>Back to Grade Summary</span>
                    </button>

                    <div className="h-5 w-px bg-slate-300 hidden sm:block" />

                    <div className="flex items-center gap-2">
                      <BookOpen size={18} className="text-slate-700" />
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                        Gradebook Publication Work List
                      </h2>
                    </div>

                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                      {filteredGradebooks.length} of {allUnresolvedGradebooks.length} Unresolved
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSwitchGradeView('students')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100"
                  >
                    <span>Switch to Learner Records</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* Summary by Term Table */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-800">
                  Gradebook Publication Status by Grading Period
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs">
                        <th className="py-2.5 px-4">Grading Period</th>
                        <th className="py-2.5 px-4 text-center">Expected</th>
                        <th className="py-2.5 px-4 text-center text-emerald-800">Published</th>
                        <th className="py-2.5 px-4 text-center text-amber-800">Draft</th>
                        <th className="py-2.5 px-4 text-center text-rose-800">Not Yet Created</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.gradebooks?.byTerm?.map((t: any) => {
                        const fullLabel = formatTermLabel(t.termLabel || t.termKey);
                        return (
                          <tr key={t.termKey} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-4 font-bold text-sm text-slate-900">{fullLabel}</td>
                            <td className="py-2.5 px-4 text-center font-semibold text-slate-700">{t.expectedGradebooks}</td>
                            <td className="py-2.5 px-4 text-center font-bold text-emerald-800">{t.publishedGradebooks}</td>
                            <td className="py-2.5 px-4 text-center font-bold text-amber-800">{t.draftGradebooks}</td>
                            <td className="py-2.5 px-4 text-center font-bold text-rose-800">{t.missingGradebooks}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${t.status === 'READY' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                                {t.status === 'READY' ? 'Complete' : 'In Progress'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Unresolved Gradebooks Table with Search, Filter & CSV Export */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Unresolved Gradebooks List ({filteredGradebooks.length} of {allUnresolvedGradebooks.length} items shown)
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 font-medium">
                      Assigned subject teachers requiring score encoding or gradebook publication.
                    </div>
                  </div>

                  <button
                    onClick={exportGradebooksCSV}
                    disabled={!filteredGradebooks.length}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Download size={13} />
                    Export CSV
                  </button>
                </div>

                {/* Filter Toolbar */}
                <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search section, subject, or teacher..."
                      value={gbSearch}
                      onChange={e => setGbSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 font-medium">Grading Period:</span>
                    <select
                      value={gbTermFilter}
                      onChange={(e: any) => setGbTermFilter(e.target.value)}
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-800 font-medium"
                    >
                      <option value="ALL">All Terms</option>
                      <option value="TERM 1">TERM 1</option>
                      <option value="TERM 2">TERM 2</option>
                      <option value="TERM 3">TERM 3</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 font-medium">Status:</span>
                    <select
                      value={gbStatusFilter}
                      onChange={(e: any) => setGbStatusFilter(e.target.value)}
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-800 font-medium"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="Missing">Not yet created</option>
                    </select>
                  </div>

                  {(gbSearch || gbTermFilter !== 'ALL' || gbStatusFilter !== 'ALL') && (
                    <button
                      onClick={() => { setGbSearch(''); setGbTermFilter('ALL'); setGbStatusFilter('ALL'); }}
                      className="text-xs text-rose-700 hover:underline font-semibold"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                      <tr className="text-slate-700 font-bold uppercase tracking-wider text-xs">
                        <th className="py-2.5 px-3">Grade &amp; Section</th>
                        <th className="py-2.5 px-3">Learning Area</th>
                        <th className="py-2.5 px-3">Grading Period</th>
                        <th className="py-2.5 px-3">Assigned Teacher</th>
                        <th className="py-2.5 px-3 text-center">Publication Status</th>
                        <th className="py-2.5 px-3">Action Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredGradebooks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                            No unresolved gradebooks match the active filters.
                          </td>
                        </tr>
                      ) : (
                        filteredGradebooks.map((u: any, idx: number) => {
                          const fullLabel = formatTermLabel(u.termLabel || u.termKey);
                          return (
                            <tr key={idx} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                Grade {u.gradeLevel} - {u.sectionName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-800">
                                {u.subjectName} <span className="text-[11px] text-slate-500">({u.subjectCode})</span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                                {fullLabel}
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 font-medium">
                                {u.teacherName}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${u.status === 'Draft' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-800 border border-slate-300'}`}>
                                  {formatGradebookStatus(u.status)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-slate-700 font-medium leading-relaxed">
                                {u.requiredAction || (u.status === 'Draft' ? 'Teacher to complete score encoding and publish' : 'Initialize gradebook and encode scores')}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Return Action Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleSwitchGradeView('summary')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-md border border-slate-300 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={15} />
                  <span>Back to Grade Summary</span>
                </button>
                <div className="text-xs text-slate-500 font-medium hidden sm:flex items-center gap-2">
                  <span>Active School Year:</span>
                  <strong className="text-slate-800">{data?.academicYear?.name || 'SY 2026–2027'}</strong>
                  <span>·</span>
                  <span>Calulut Integrated School</span>
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* ── GRADE SUB-VIEW 3: LEARNER ACADEMIC RECORDS & EXCEPTIONS ── */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {gradeView === 'students' && (
            <div className="space-y-6">
              
              {/* Workspace Header with Prominent Back Action */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      id="btn-back-to-grade-summary-students"
                      onClick={() => handleSwitchGradeView('summary')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-md border border-slate-300 transition-colors cursor-pointer shadow-2xs"
                      title="Return to Grade Overview"
                    >
                      <ArrowLeft size={15} />
                      <span>Back to Grade Summary</span>
                    </button>

                    <div className="h-5 w-px bg-slate-300 hidden sm:block" />

                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-slate-700" />
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                        Learner Academic Records &amp; Exceptions
                      </h2>
                    </div>

                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                      {filteredStudents.length} of {unresolvedStudents.length} Incomplete
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSwitchGradeView('gradebooks')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100"
                  >
                    <ArrowLeft size={13} />
                    <span>Switch to Gradebook Work List</span>
                  </button>
                </div>
              </div>

              {/* Card A: Incomplete Enrolled Learners */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Incomplete Enrolled Learners ({filteredStudents.length} of {unresolvedStudents.length} learners shown)
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 font-medium">
                      Active learners missing published grades or departed learners missing verified departure dates. General Averages are withheld under DepEd Order No. 8, s. 2015.
                    </div>
                  </div>

                  <button
                    onClick={exportStudentsCSV}
                    disabled={!filteredStudents.length}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Download size={13} />
                    Export CSV
                  </button>
                </div>

                {/* Filter Bar */}
                <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search learner name..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 font-medium">Section:</span>
                    <select
                      value={studentSectionFilter}
                      onChange={(e: any) => setStudentSectionFilter(e.target.value)}
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-800 font-medium"
                    >
                      <option value="ALL">All Sections</option>
                      {uniqueStudentSections.map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>

                  {(studentSearch || studentSectionFilter !== 'ALL') && (
                    <button
                      onClick={() => { setStudentSearch(''); setStudentSectionFilter('ALL'); }}
                      className="text-xs text-rose-700 hover:underline font-semibold"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>

                {/* Incomplete Students Table */}
                <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                      <tr className="text-slate-700 font-bold uppercase tracking-wider text-xs">
                        <th className="py-2.5 px-3">Learner Name</th>
                        <th className="py-2.5 px-3">Grade &amp; Section</th>
                        <th className="py-2.5 px-3">Missing Grading Periods</th>
                        <th className="py-2.5 px-3">Completion Status</th>
                        <th className="py-2.5 px-3">General Average Status</th>
                        <th className="py-2.5 px-3">Next Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                            No incomplete learners match the active filters.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((s: any) => {
                          const formattedTerms = s.missingTerms?.map((term: string) => formatTermLabel(term)).join(', ') || 'None';
                          return (
                            <tr key={s.studentId} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-semibold text-slate-900 text-sm">
                                {s.name}
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 font-medium">
                                Grade {s.gradeLevel} - {s.sectionName}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-rose-800">
                                {formattedTerms}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                  Incomplete
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-xs italic text-slate-600 font-medium">
                                {s.generalAverageStatus}
                              </td>
                              <td className="py-2.5 px-3 text-xs text-slate-700 font-medium leading-relaxed">
                                {s.requiredAction || 'Awaiting grade publication for missing terms'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card B: Officially Departed Learners (DepEd DO 11, s. 2018 & DO 58, s. 2017) */}
              {Array.isArray(data?.studentCompleteness?.departedLearners) && data.studentCompleteness.departedLearners.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                  <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="text-sm font-bold text-slate-900">
                      Officially Departed Learners ({data.studentCompleteness.departedLearners.length})
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 font-medium">
                      In accordance with DepEd Order No. 11, s. 2018 and DO 58, s. 2017, prior earned grades are preserved for SF10 permanent records; subsequent terms after departure are excused.
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                        <tr className="text-slate-700 font-bold uppercase tracking-wider text-xs">
                          <th className="py-2.5 px-3">Learner Name</th>
                          <th className="py-2.5 px-3">Grade &amp; Section</th>
                          <th className="py-2.5 px-3">Movement Status</th>
                          <th className="py-2.5 px-3">Effective Date</th>
                          <th className="py-2.5 px-3">Authorization Audit</th>
                          <th className="py-2.5 px-3">Preserved Terms</th>
                          <th className="py-2.5 px-3">Excused Terms</th>
                          <th className="py-2.5 px-3">Record Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.studentCompleteness.departedLearners.map((d: any) => (
                          <tr key={d.studentId} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 text-sm">
                              {d.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 font-medium">
                              Grade {d.gradeLevel} - {d.sectionName}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${d.status === 'Dropped_Out' ? 'bg-rose-100 text-rose-900 border border-rose-200' : 'bg-blue-100 text-blue-900 border border-blue-200'}`}>
                                {d.status === 'Dropped_Out' ? 'Dropped Out' : 'Transferred Out'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-700">
                              {d.departureDate || 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-xs text-slate-800 font-medium">
                              {d.authorizedBy ? `${d.authorizedBy}${d.authorizedAt ? ` (${d.authorizedAt})` : ''}` : 'DepEd DO 11 Verified'}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-emerald-800">
                              {d.preservedTerms?.join(', ') || 'None'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 italic">
                              {d.excusedTerms?.join(', ') || 'None'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                Excused (DO 11)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Card C: Learners Awaiting Remedial / Retention Deliberation (DepEd DO 8, s. 2015) */}
              {Array.isArray(data?.studentCompleteness?.academicExceptions) && data.studentCompleteness.academicExceptions.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                  <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="text-sm font-bold text-slate-900">
                      Learners Awaiting Remedial or Retention Review ({data.studentCompleteness.academicExceptions.length})
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 font-medium">
                      Under DepEd Order No. 8, s. 2015, published failing grades (&lt; 75) are valid official records. Learners with 1–2 failing learning areas require remedial classes; learners with 3 or more are retained.
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                        <tr className="text-slate-700 font-bold uppercase tracking-wider text-xs">
                          <th className="py-2.5 px-3">Learner Name</th>
                          <th className="py-2.5 px-3">Grade &amp; Section</th>
                          <th className="py-2.5 px-3 text-center">Failed Areas</th>
                          <th className="py-2.5 px-3">Authoritative Final Learning-Area Ratings</th>
                          <th className="py-2.5 px-3">DepEd Deliberation Recommendation</th>
                          <th className="py-2.5 px-3">Grading Impact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.studentCompleteness.academicExceptions.map((ex: any) => (
                          <tr key={ex.studentId} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 text-sm">
                              {ex.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 font-medium">
                              Grade {ex.gradeLevel} - {ex.sectionName}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-rose-800">
                              {ex.failedSubjectsCount}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              {ex.failedSubjects?.map((f: any) => f.termBreakdown ? `${f.subjectName}: ${f.termBreakdown}` : `${f.subjectName} (${f.termKey}: ${f.grade})`).join('; ')}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${ex.failedSubjectsCount <= 2 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-rose-100 text-rose-900 border border-rose-300'}`}>
                                {ex.recommendation}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-emerald-800">
                              Valid Grade (Preserved)
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bottom Return Action Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleSwitchGradeView('summary')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-md border border-slate-300 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={15} />
                  <span>Back to Grade Summary</span>
                </button>
                <div className="text-xs text-slate-500 font-medium hidden sm:flex items-center gap-2">
                  <span>Active School Year:</span>
                  <strong className="text-slate-800">{data?.academicYear?.name || 'SY 2026–2027'}</strong>
                  <span>·</span>
                  <span>Calulut Integrated School</span>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: STUDENT PROMOTION & GRADE-TO-GRADE TRANSITION ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {mainTab === 'promotion' && data && (
        <StudentPromotionWorkspace
          academicYearId={data.academicYear.id}
          academicYearName={data.academicYear.name}
          portal={portal}
        />
      )}

    </div>
    </div>
  );
}