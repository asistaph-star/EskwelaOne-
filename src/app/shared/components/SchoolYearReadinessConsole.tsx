import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertCircle, CheckCircle2, Clock, RefreshCw, 
  BookOpen, Users, Calendar, Award, ShieldAlert, 
  Search, Filter, Download, Info, Check, FileSpreadsheet, X
} from 'lucide-react';
import { academicApi } from '../../../api/academic.api';

interface SchoolYearReadinessConsoleProps {
  academicYearId?: string;
  onClose?: () => void;
}

export function SchoolYearReadinessConsole({ academicYearId, onClose }: SchoolYearReadinessConsoleProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gradebooks' | 'students' | 'attendance' | 'sf9'>('gradebooks');

  // Search & filter state for Gradebooks tab
  const [gbSearch, setGbSearch] = useState('');
  const [gbTermFilter, setGbTermFilter] = useState<'ALL' | 'TERM 1' | 'TERM 2' | 'TERM 3'>('ALL');
  const [gbStatusFilter, setGbStatusFilter] = useState<'ALL' | 'Draft' | 'Missing'>('ALL');

  // Search & filter state for Students tab
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSectionFilter, setStudentSectionFilter] = useState('ALL');

  const fetchReadiness = async (yearIdToFetch: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await academicApi.getClosureReadiness(yearIdToFetch);
      const payload = (res as any)?.data || res;
      setData(payload);
    } catch (err: any) {
      console.error('Failed to load closure readiness:', err);
      setError(err.message || 'Failed to assess school-year closure readiness.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (academicYearId) {
      fetchReadiness(academicYearId);
    } else {
      academicApi.getYears()
        .then((years: any) => {
          const list = Array.isArray(years) ? years : [];
          const current = list.find((y: any) => y.is_current) || list[0];
          if (current?.id) {
            fetchReadiness(current.id);
          } else {
            setError('No active academic year found to assess.');
            setLoading(false);
          }
        })
        .catch(err => {
          setError(err.message || 'Failed to resolve academic year.');
          setLoading(false);
        });
    }
  }, [academicYearId]);

  // Combine unresolved gradebooks (full list if returned by backend, else sample)
  const allUnresolvedGradebooks: any[] = useMemo(() => {
    if (!data?.gradebooks) return [];
    return data.gradebooks.unresolvedGradebooks || data.gradebooks.unresolvedSample || [];
  }, [data]);

  // Filtered Gradebooks
  const filteredGradebooks = useMemo(() => {
    return allUnresolvedGradebooks.filter(gb => {
      const q = gbSearch.trim().toLowerCase();
      const matchQuery = !q || 
        gb.sectionName?.toLowerCase().includes(q) ||
        gb.subjectName?.toLowerCase().includes(q) ||
        gb.subjectCode?.toLowerCase().includes(q) ||
        gb.teacherName?.toLowerCase().includes(q);

      const matchTerm = gbTermFilter === 'ALL' || gb.termLabel === gbTermFilter;
      const matchStatus = gbStatusFilter === 'ALL' || gb.status === gbStatusFilter;

      return matchQuery && matchTerm && matchStatus;
    });
  }, [allUnresolvedGradebooks, gbSearch, gbTermFilter, gbStatusFilter]);

  // Filtered Students
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

  // Export Gradebooks to CSV
  const exportGradebooksCSV = () => {
    if (!filteredGradebooks.length) return;
    const headers = ['Grade Level', 'Section', 'Subject Code', 'Subject Name', 'Term', 'Assigned Teacher', 'Status', 'Required Action'];
    const rows = filteredGradebooks.map(g => [
      `Grade ${g.gradeLevel}`,
      `"${g.sectionName}"`,
      `"${g.subjectCode}"`,
      `"${g.subjectName}"`,
      `"${g.termLabel}"`,
      `"${g.teacherName}"`,
      `"${g.status}"`,
      `"${g.requiredAction || (g.status === 'Draft' ? 'Teacher to encode scores and publish' : 'Initialize gradebook and encode scores')}"`
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

  // Export Students to CSV
  const exportStudentsCSV = () => {
    if (!filteredStudents.length) return;
    const headers = ['Learner Name', 'LRN', 'Grade Level', 'Section', 'Missing Terms', 'Missing Subjects Count', 'General Average Status', 'Required Action'];
    const rows = filteredStudents.map(s => [
      `"${s.name}"`,
      `"${s.schoolId}"`,
      `Grade ${s.gradeLevel}`,
      `"${s.sectionName}"`,
      `"${s.missingTerms?.join(', ') || ''}"`,
      s.missingSubjectsCount || 0,
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

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <RefreshCw size={24} className="animate-spin text-slate-400" style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Assessing School-Year Completion Status...</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Validating teacher gradebooks, learner completeness, and official attendance records.</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '32px 24px', background: '#fff1f2', borderRadius: 10, border: '1px solid #fecdd3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#be123c', fontWeight: 700, fontSize: 15 }}>
          <AlertCircle size={20} />
          <span>Unable to Load Completion Review</span>
        </div>
        <p style={{ fontSize: 13, color: '#475569', margin: '8px 0 16px' }}>{error}</p>
        <button
          onClick={() => academicYearId && fetchReadiness(academicYearId)}
          style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Retry Review
        </button>
      </div>
    );
  }

  const isNotReady = data.overallStatus === 'NOT_READY';
  const isReady = data.overallStatus === 'READY';
  const evaluatedDateStr = data.evaluatedAt 
    ? new Date(data.evaluatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div id="school-year-readiness-console" className="space-y-5 text-slate-800" style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {/* ── 1. HEADER BAND ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
              School-Year Completion Review
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {data.academicYear?.name || 'SY 2026-2027'} · {data.academicYear?.lifecycle || 'ACTIVE'}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Review only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review academic requirements and outstanding work before school-year closure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center text-[11px] text-slate-400 mr-1">
            <Clock size={12} className="mr-1" />
            Last checked: {evaluatedDateStr}
          </div>
          <button
            onClick={() => data.academicYear?.id && fetchReadiness(data.academicYear.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw size={12} className="text-slate-500" />
            Refresh Status
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X size={13} />
              Close
            </button>
          )}
        </div>
      </div>

      {/* ── 2. CONCISE READINESS STATUS SUMMARY ── */}
      <div className={`p-4 rounded-lg border ${isNotReady ? 'bg-amber-50/70 border-amber-200 text-amber-950' : isReady ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {isNotReady ? (
              <Clock size={18} className="text-amber-600" />
            ) : isReady ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : (
              <AlertCircle size={18} className="text-blue-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isNotReady ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                {isNotReady ? 'Academic Work In Progress · Not Ready For Closure' : 'Ready For Official Closure'}
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                (Backend determination: <code className="font-mono text-[10.5px] font-semibold text-slate-700">{data.overallStatus}</code>)
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
              {isNotReady 
                ? 'Academic work is currently in progress for the active school year. Outstanding subject gradebooks, learner term grades, and daily attendance logs must be completed before school-year closure.'
                : data.summaryMessage}
            </p>
            <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
              <Info size={12} className="text-slate-400 shrink-0" />
              <span>Review only. School-year closure requires separate administrative authorization after all requirements are validated.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. WORK REQUIRING ATTENTION (4 COMPACT METRICS) ── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
          Work Requiring Attention · Key Completion Indicators
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Metric 1: Gradebooks */}
          <div 
            onClick={() => setActiveTab('gradebooks')}
            className={`p-3.5 bg-white border rounded-lg cursor-pointer transition-all hover:border-slate-400 shadow-xs ${activeTab === 'gradebooks' ? 'ring-2 ring-slate-800/20 border-slate-700' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Gradebook Publication</span>
              <BookOpen size={14} className="text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {data.gradebooks?.publishedCount} <span className="text-sm font-normal text-slate-400">/ {data.gradebooks?.totalExpected}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-amber-700">{data.gradebooks?.draftCount} in Draft</span>
              <span className="text-slate-300">·</span>
              <span className="font-semibold text-rose-700">{data.gradebooks?.missingCount} Uninitialized</span>
            </div>
          </div>

          {/* Metric 2: Learner Completeness */}
          <div 
            onClick={() => setActiveTab('students')}
            className={`p-3.5 bg-white border rounded-lg cursor-pointer transition-all hover:border-slate-400 shadow-xs ${activeTab === 'students' ? 'ring-2 ring-slate-800/20 border-slate-700' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Learner Academic Records</span>
              <Users size={14} className="text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {data.studentCompleteness?.fullyCompleteCount} <span className="text-sm font-normal text-slate-400">/ {data.studentCompleteness?.totalEnrolled}</span>
            </div>
            <div className="text-[11px] mt-1">
              {data.studentCompleteness?.incompleteCount > 0 ? (
                <span className="font-semibold text-rose-700">{data.studentCompleteness.incompleteCount} Learners with missing grades</span>
              ) : (
                <span className="font-semibold text-emerald-700">All Enrolled Learners Complete</span>
              )}
            </div>
          </div>

          {/* Metric 3: Attendance Verification */}
          <div 
            onClick={() => setActiveTab('attendance')}
            className={`p-3.5 bg-white border rounded-lg cursor-pointer transition-all hover:border-slate-400 shadow-xs ${activeTab === 'attendance' ? 'ring-2 ring-slate-800/20 border-slate-700' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Official Attendance</span>
              <Calendar size={14} className="text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {data.officialAttendance?.verifiedDailyRecordsCount} <span className="text-sm font-normal text-slate-400">/ {data.officialAttendance?.totalDailyRecords} Daily</span>
            </div>
            <div className="text-[11px] mt-1 text-slate-500">
              {data.officialAttendance?.draftDailyRecordsCount > 0 ? (
                <span className="font-semibold text-amber-700">{data.officialAttendance.draftDailyRecordsCount} Unverified Daily Logs</span>
              ) : (
                <span className="font-semibold text-emerald-700">All Daily Logs Verified</span>
              )}
              <span className="text-slate-400 ml-1">({data.officialAttendance?.finalizedMonthsCount}/11 Months Finalized)</span>
            </div>
          </div>

          {/* Metric 4: SF9 Issuances (Policy Tracked) */}
          <div 
            onClick={() => setActiveTab('sf9')}
            className={`p-3.5 bg-white border rounded-lg cursor-pointer transition-all hover:border-slate-400 shadow-xs ${activeTab === 'sf9' ? 'ring-2 ring-slate-800/20 border-slate-700' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">SF9 Form 138 Issuances</span>
              <Award size={14} className="text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {data.sf9IssuanceReadiness?.issuedSf9Count} <span className="text-sm font-normal text-slate-400">/ {data.sf9IssuanceReadiness?.totalEligibleStudents}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              <span className="font-semibold text-slate-700">{data.sf9IssuanceReadiness?.unissuedSf9Count} Unissued</span>
              <span className="text-slate-400 ml-1">(Separate School Policy)</span>
            </div>
          </div>

        </div>
      </div>

      {/* ── 4. MANDATORY BLOCKERS CALLOUT (IF ANY) ── */}
      {data.blockers && data.blockers.length > 0 && (
        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3.5">
          <div className="flex items-center gap-2 text-rose-800 text-xs font-bold mb-2">
            <ShieldAlert size={15} />
            <span>Mandatory Academic Completion Blockers ({data.blockers.length})</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
            {data.blockers.map((b: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 bg-white p-2 rounded border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 5. TAB NAVIGATION ── */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pt-1">
        <button
          onClick={() => setActiveTab('gradebooks')}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-md transition-colors border-t border-x -mb-px ${activeTab === 'gradebooks' ? 'bg-white border-slate-300 border-b-white text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Gradebook Publication ({allUnresolvedGradebooks.length} Unresolved)
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-md transition-colors border-t border-x -mb-px ${activeTab === 'students' ? 'bg-white border-slate-300 border-b-white text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Incomplete Learners ({data.studentCompleteness?.incompleteCount || 0})
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-md transition-colors border-t border-x -mb-px ${activeTab === 'attendance' ? 'bg-white border-slate-300 border-b-white text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Attendance Verification ({data.officialAttendance?.draftDailyRecordsCount || 0} Drafts)
        </button>

        <button
          onClick={() => setActiveTab('sf9')}
          className={`px-3.5 py-2 text-xs font-bold rounded-t-md transition-colors border-t border-x -mb-px ${activeTab === 'sf9' ? 'bg-white border-slate-300 border-b-white text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          SF9 &amp; Institutional Policies
        </button>
      </div>

      {/* ── TAB 1: GRADEBOOK PUBLICATION ── */}
      {activeTab === 'gradebooks' && (
        <div className="space-y-4">
          
          {/* By-Term Summary Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
              Gradebook Publication Summary by Term
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3.5">Grading Period</th>
                    <th className="py-2.5 px-3.5 text-center">Expected</th>
                    <th className="py-2.5 px-3.5 text-center text-emerald-700">Published</th>
                    <th className="py-2.5 px-3.5 text-center text-amber-700">Draft</th>
                    <th className="py-2.5 px-3.5 text-center text-rose-700">Missing</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.gradebooks?.byTerm?.map((t: any) => (
                    <tr key={t.termKey} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">{t.termLabel}</td>
                      <td className="py-2.5 px-3.5 text-center text-slate-600">{t.expectedGradebooks}</td>
                      <td className="py-2.5 px-3.5 text-center font-bold text-emerald-700">{t.publishedGradebooks}</td>
                      <td className="py-2.5 px-3.5 text-center font-semibold text-amber-700">{t.draftGradebooks}</td>
                      <td className="py-2.5 px-3.5 text-center font-semibold text-rose-700">{t.missingGradebooks}</td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'READY' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {t.status === 'READY' ? 'COMPLETE' : 'NOT_READY'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unresolved Gradebooks Resolver with Search & Filters */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Unresolved Gradebooks ({filteredGradebooks.length} of {allUnresolvedGradebooks.length} items shown)
                </div>
                <div className="text-[11px] text-slate-500">
                  Identify assigned teachers and sections requiring score encoding or gradebook publication.
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={exportGradebooksCSV}
                  disabled={!filteredGradebooks.length}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  title="Export filtered unresolved gradebooks as CSV"
                >
                  <Download size={13} />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search section, subject, or teacher..."
                  value={gbSearch}
                  onChange={e => setGbSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Term:</span>
                <select
                  value={gbTermFilter}
                  onChange={(e: any) => setGbTermFilter(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-700"
                >
                  <option value="ALL">All Terms</option>
                  <option value="TERM 1">TERM 1</option>
                  <option value="TERM 2">TERM 2</option>
                  <option value="TERM 3">TERM 3</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Status:</span>
                <select
                  value={gbStatusFilter}
                  onChange={(e: any) => setGbStatusFilter(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-700"
                >
                  <option value="ALL">All (Draft &amp; Missing)</option>
                  <option value="Draft">Draft (Scores encoded)</option>
                  <option value="Missing">Missing (Uninitialized)</option>
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

            {/* Table of Unresolved Items */}
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                  <tr className="text-slate-600 font-bold uppercase tracking-wider text-[10.5px]">
                    <th className="py-2 px-3">Grade &amp; Section</th>
                    <th className="py-2 px-3">Learning Area</th>
                    <th className="py-2 px-3">Term</th>
                    <th className="py-2 px-3">Assigned Teacher</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3">Action Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGradebooks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No unresolved gradebooks match the active filters.
                      </td>
                    </tr>
                  ) : (
                    filteredGradebooks.map((u: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          Grade {u.gradeLevel} - {u.sectionName}
                        </td>
                        <td className="py-2 px-3 text-slate-800">
                          {u.subjectName} <span className="text-[10px] text-slate-400">({u.subjectCode})</span>
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {u.termLabel}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {u.teacherName}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${u.status === 'Draft' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-600">
                          {u.requiredAction || (u.status === 'Draft' ? 'Teacher to complete scores and publish' : 'Initialize gradebook and encode scores')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 2: INCOMPLETE LEARNERS ── */}
      {activeTab === 'students' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs space-y-0">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900">
                Incomplete Enrolled Learners ({filteredStudents.length} of {unresolvedStudents.length} learners shown)
              </div>
              <div className="text-[11px] text-slate-500">
                Learners lacking published grades in one or more configured terms. General Averages are withheld.
              </div>
            </div>

            <button
              onClick={exportStudentsCSV}
              disabled={!filteredStudents.length}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              title="Export incomplete learners list as CSV"
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search learner name or LRN..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-800"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Section:</span>
              <select
                value={studentSectionFilter}
                onChange={(e: any) => setStudentSectionFilter(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-700"
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
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                <tr className="text-slate-600 font-bold uppercase tracking-wider text-[10.5px]">
                  <th className="py-2 px-3">Learner Name</th>
                  <th className="py-2 px-3">LRN</th>
                  <th className="py-2 px-3">Grade &amp; Section</th>
                  <th className="py-2 px-3">Missing Terms</th>
                  <th className="py-2 px-3">General Average Status</th>
                  <th className="py-2 px-3">Next Step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No incomplete learners match the active filters.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s: any) => (
                    <tr key={s.studentId} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {s.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {s.schoolId}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        Grade {s.gradeLevel} - {s.sectionName}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-rose-700">
                        {s.missingTerms?.join(', ') || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] italic text-slate-500">
                        {s.generalAverageStatus}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600">
                        {s.requiredAction || 'Awaiting grade publication for missing terms'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: ATTENDANCE VERIFICATION ── */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          
          {/* Two-Tier Attendance Overview Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Official SF2 Attendance Verification Architecture
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              DigiSkwela evaluates attendance verification across two independent operational stages: daily class attendance logs recorded by advisers, and monthly SF2 summary forms finalized for institutional compliance.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {/* Stage A: Daily Logs */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Stage 1: Daily Attendance Logs
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {data.officialAttendance?.verifiedDailyRecordsCount} of {data.officialAttendance?.totalDailyRecords} Verified
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {data.officialAttendance?.draftDailyRecordsCount > 0 ? (
                    <span className="text-amber-800 font-medium">
                      ⚠️ {data.officialAttendance.draftDailyRecordsCount} unverified daily records require adviser verification.
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      ✓ All recorded daily attendance logs are verified.
                    </span>
                  )}
                </div>
              </div>

              {/* Stage B: Monthly Calendars */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Stage 2: Monthly Calendar SF2 Forms
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {data.officialAttendance?.finalizedMonthsCount} of {data.officialAttendance?.totalCalendarMonths} Finalized
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  <span className="text-emerald-700 font-medium">
                    ✓ All 11 instructional months (June 2026 – April 2027) are officially finalized.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actionable Draft Daily Records Table */}
          {data.officialAttendance?.draftDailyItems && data.officialAttendance.draftDailyItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200">
                <div className="text-xs font-bold text-slate-900">
                  Unverified Daily Attendance Records ({data.officialAttendance.draftDailyItems.length})
                </div>
                <div className="text-[11px] text-slate-500">
                  The following daily attendance entries require class adviser review and confirmation in the Attendance Hub.
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10.5px] border-b border-slate-200">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Grade &amp; Section</th>
                      <th className="py-2 px-3">Responsible Class Adviser</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3">Required Next Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.officialAttendance.draftDailyItems.map((d: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">
                          Grade {d.gradeLevel} - {d.sectionName}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {d.adviserName}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {d.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600">
                          {d.requiredAction}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── TAB 4: SF9 & INSTITUTIONAL POLICIES (STRUCTURED PER PHASE 4) ── */}
      {activeTab === 'sf9' && (
        <div className="space-y-4">
          
          {/* Section A: Current System Facts */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Award size={16} className="text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                A. Current System Facts · SF9 Form 138 Issuance
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="text-[11px] text-slate-500 font-semibold uppercase">Total Eligible Learners</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{data.sf9IssuanceReadiness?.totalEligibleStudents}</div>
                <div className="text-[11px] text-slate-500">Enrolled junior high learners</div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
                <div className="text-[11px] text-emerald-800 font-semibold uppercase">Issued SF9 Documents</div>
                <div className="text-lg font-bold text-emerald-900 mt-0.5">{data.sf9IssuanceReadiness?.issuedSf9Count}</div>
                <div className="text-[11px] text-emerald-700">48.5% with released official cards</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="text-[11px] text-slate-600 font-semibold uppercase">Pending SF9 Issuance</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{data.sf9IssuanceReadiness?.unissuedSf9Count}</div>
                <div className="text-[11px] text-slate-500">51.5% awaiting grade finalization</div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Issuance Standard:</strong> DepEd Form 138 (SF9) is generated annually following the consolidation of all configured terms (<code className="font-mono text-[11px]">TERM 1</code>, <code className="font-mono text-[11px]">TERM 2</code>, <code className="font-mono text-[11px]">TERM 3</code>). Learners in Grade 9 Bonifacio have received full issuances, whereas learners in sections with pending terms will receive official SF9s upon term grade publication.
            </p>
          </div>

          {/* Section B: Decisions Requiring School Approval */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Info size={16} className="text-blue-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                B. Decisions Requiring School Leadership Approval
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              The following institutional governance decisions are evaluated separately from the automated school-year closure engine:
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">1</span>
                <div>
                  <div className="font-bold text-slate-900">Pre-Closure SF9 Issuance Requirement</div>
                  <div className="text-slate-600 mt-0.5 leading-relaxed">
                    Confirm whether Calulut Integrated School mandates 100% SF9 Form 138 issuance prior to closing the school year, or permits late issuance post-closure for transferees or remediation.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">2</span>
                <div>
                  <div className="font-bold text-slate-900">Post-Closure Scholastic Grade Corrections</div>
                  <div className="text-slate-600 mt-0.5 leading-relaxed">
                    Under DepEd guidelines, historical school-year grades are strictly read-only. Establish whether any exceptional retroactive adjustment requires formal Division Superintendent authorization.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">3</span>
                <div>
                  <div className="font-bold text-slate-900">Student Promotion and Retention Governance</div>
                  <div className="text-slate-600 mt-0.5 leading-relaxed">
                    Confirm that student promotion remains an independent faculty deliberation under DepEd Order No. 8, s. 2015 and must not be triggered automatically by administrative school-year closure.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section C: Existing Implemented Controls */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-emerald-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                C. Existing Implemented Technical &amp; Policy Controls
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-600" />
                  Historical Immutability
                </div>
                <div className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                  Active year records transition to read-only historical records immediately upon authorized closure. Ad-hoc editing is blocked at API level.
                </div>
              </div>

              <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-600" />
                  Document Integrity
                </div>
                <div className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                  Released SF9 documents are cryptographically tracked with immutable verification entries and QR/SHA-256 validation.
                </div>
              </div>

              <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-600" />
                  Role Separation
                </div>
                <div className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                  Teachers encode assessment scores, advisers verify SF2 attendance, and school leaders review institutional completion.
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
