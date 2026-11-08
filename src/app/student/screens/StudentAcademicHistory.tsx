import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { studentApi } from '../../../api/student.api';
import { apiClient } from '../../../api/client';

export interface StudentAcademicHistoryProps {
  setTab?: (tab: any) => void;
  currentUser?: any;
}

interface TermColumn {
  key: 'T1' | 'T2' | 'T3' | 'T4';
  label: 'TERM 1' | 'TERM 2' | 'TERM 3' | 'TERM 4';
}

function cleanSubjectName(name: string): string {
  if (!name) return '';
  return name.replace(/\s*\((?:Archived|QA|Legacy|Historical)\)\s*/gi, '').trim() || name;
}

export function StudentAcademicHistory({ currentUser }: StudentAcademicHistoryProps) {
  const effectiveStudentId = currentUser?.studentProfile?.id || currentUser?.id;

  // Academic Years state
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [isLoadingYears, setIsLoadingYears] = useState(true);
  const [yearsError, setYearsError] = useState<string | null>(null);

  // Grades state for selected year
  const [reportCardData, setReportCardData] = useState<any>(null);
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);
  const [gradesError, setGradesError] = useState<string | null>(null);

  // 1. Fetch student's academic years (only previous/historical years)
  useEffect(() => {
    if (!effectiveStudentId) return;
    setIsLoadingYears(true);
    setYearsError(null);

    studentApi.getStudentAcademicYears(effectiveStudentId)
      .then((years: any) => {
        const list = Array.isArray(years) ? years : [];
        setAcademicYears(list);
        const pastYears = list.filter((y: any) => y.lifecycle === 'HISTORICAL');
        if (pastYears.length > 0) {
          setSelectedYearId(pastYears[0].academicYearId);
        }
      })
      .catch((err: any) => {
        console.error('Failed to load academic years:', err);
        setYearsError('Failed to load academic years. Please check your network connection.');
      })
      .finally(() => setIsLoadingYears(false));
  }, [effectiveStudentId]);

  // Filter for authentic previous school years (lifecycle === 'HISTORICAL' strictly concluded)
  const historicalYears = useMemo(() => {
    return academicYears.filter((y: any) => y.lifecycle === 'HISTORICAL');
  }, [academicYears]);

  const selectedYear = useMemo(() => {
    return historicalYears.find((y: any) => y.academicYearId === selectedYearId) || historicalYears[0];
  }, [historicalYears, selectedYearId]);

  // 2. Fetch authoritative report card grades for selected historical year
  useEffect(() => {
    if (!effectiveStudentId || !selectedYearId) return;

    setIsLoadingGrades(true);
    setGradesError(null);
    apiClient.get(`/academic/report-card/${effectiveStudentId}?academicYearId=${encodeURIComponent(selectedYearId)}`)
      .then((res: any) => {
        setReportCardData(res);
      })
      .catch((err: any) => {
        console.warn('Could not fetch historical report card:', err);
        setGradesError('Could not retrieve historical grades for this school year.');
      })
      .finally(() => setIsLoadingGrades(false));
  }, [effectiveStudentId, selectedYearId]);

  // Scholastic data extraction
  const subjects: any[] = reportCardData?.scholastic?.subjects || [];
  const generalAverage = reportCardData?.scholastic?.generalAverage ?? null;

  // Determine term columns according to authoritative source structure
  // Display rule: TERM 1, TERM 2, TERM 3, TERM 4 only; never abbreviated; 0 terms for annual-final-only
  const termColumns = useMemo<TermColumn[]>(() => {
    const configured = reportCardData?.scholastic?.configuredTerms || [];

    const hasT1 = subjects.some(s => s.T1 !== null && s.T1 !== undefined);
    const hasT2 = subjects.some(s => s.T2 !== null && s.T2 !== undefined);
    const hasT3 = subjects.some(s => s.T3 !== null && s.T3 !== undefined);
    const hasT4 = subjects.some(s => s.T4 !== null && s.T4 !== undefined);

    // Annual-final-only: no term grades recorded on any subject -> do not invent term columns
    if (!hasT1 && !hasT2 && !hasT3 && !hasT4) {
      return [];
    }

    // 4-term historical records
    if (configured.length >= 4 || configured.includes('T4') || hasT4) {
      return [
        { key: 'T1', label: 'TERM 1' },
        { key: 'T2', label: 'TERM 2' },
        { key: 'T3', label: 'TERM 3' },
        { key: 'T4', label: 'TERM 4' },
      ];
    }

    // 3-term historical records
    if (configured.length === 3 || hasT3 || (configured.includes('T1') && configured.includes('T2') && configured.includes('T3'))) {
      return [
        { key: 'T1', label: 'TERM 1' },
        { key: 'T2', label: 'TERM 2' },
        { key: 'T3', label: 'TERM 3' },
      ];
    }

    // Explicit configured term count fallback
    if (configured.length === 1 && hasT1) {
      return [{ key: 'T1', label: 'TERM 1' }];
    }
    if (configured.length === 2 && (hasT1 || hasT2)) {
      return [
        { key: 'T1', label: 'TERM 1' },
        { key: 'T2', label: 'TERM 2' },
      ];
    }

    // Default if terms exist on data
    if (hasT1 || hasT2 || hasT3) {
      return [
        { key: 'T1', label: 'TERM 1' },
        { key: 'T2', label: 'TERM 2' },
        { key: 'T3', label: 'TERM 3' },
      ];
    }

    return [];
  }, [reportCardData, subjects]);

  // Initial loading indicator
  if (isLoadingYears) {
    return (
      <div style={{ maxWidth: 960, margin: '40px auto', textAlign: 'center', padding: '60px 20px' }}>
        <RefreshCw size={22} className="animate-spin text-slate-500" style={{ margin: '0 auto 10px' }} />
        <div style={{ fontSize: 13, color: '#64748b' }}>Loading academic history...</div>
      </div>
    );
  }

  // Error loading school years
  if (yearsError) {
    return (
      <div style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center', padding: '36px 24px', background: '#fff', borderRadius: 8, border: '1px solid #fecaca' }}>
        <AlertCircle size={28} className="text-rose-600" style={{ margin: '0 auto 10px' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Unable to Load Academic History</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{yearsError}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // EMPTY STATE: Exact requirement copy
  if (historicalYears.length === 0) {
    return (
      <div style={{ maxWidth: 640, margin: '60px auto', textAlign: 'center', padding: '48px 24px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', fontFamily: "'Fraunces', serif", margin: '0 0 8px' }}>
          No Previous Academic Records Available
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
          Grades from previous school years will appear here once they are available in DigiSkwela.
        </p>
      </div>
    );
  }

  // Academic context details
  const gradeLevel = selectedYear?.gradeLevel;
  const sectionName = selectedYear?.sectionName;
  const sourceSchool = selectedYear?.sourceSchool || reportCardData?.school?.name || 'Calulut Integrated School';
  const isJhsGrade = typeof gradeLevel === 'number' ? (gradeLevel >= 7 && gradeLevel <= 10) : true;
  const isCompleteSubjectSet = isJhsGrade ? subjects.length >= 8 : subjects.length > 0;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Inter', sans-serif" }}>
      
      {/* PAGE HEADER: Refined Academic Transcript Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', fontFamily: "'Fraunces', serif", margin: 0, letterSpacing: '-0.01em' }}>
              Academic History
            </h1>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.02em' }}>
              View only
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', lineHeight: 1.4 }}>
            Your academic performance from previous school years.
          </p>
        </div>

        {/* COMPACT SCHOOL YEAR DROPDOWN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="academic-history-year-select" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
            School Year:
          </label>
          <select
            id="academic-history-year-select"
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            disabled={isLoadingGrades}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0f172a',
              backgroundColor: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: isLoadingGrades ? 'default' : 'pointer',
              outline: 'none',
              minWidth: 200,
            }}
          >
            {historicalYears.map((yr: any) => {
              const details = [
                yr.gradeLevel ? `Grade ${yr.gradeLevel}` : null,
                yr.sectionName ? `Section ${yr.sectionName}` : null,
              ].filter(Boolean).join(', ');

              return (
                <option key={yr.academicYearId} value={yr.academicYearId}>
                  {yr.academicYearName}{details ? ` (${details})` : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* TRANSCRIPT METADATA BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '10px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, color: '#334155' }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: '#64748b' }}>Learner: </span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{currentUser?.name || reportCardData?.student?.name || 'Learner'}</span>
          </div>
          {(currentUser?.schoolId || reportCardData?.student?.lrn) && (
            <div>
              <span style={{ color: '#64748b' }}>LRN: </span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{currentUser?.schoolId || reportCardData?.student?.lrn}</span>
            </div>
          )}
          {gradeLevel && (
            <div>
              <span style={{ color: '#64748b' }}>Grade &amp; Section: </span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                Grade {gradeLevel}{sectionName ? ` - ${sectionName}` : ''}
              </span>
            </div>
          )}
        </div>
        <div>
          <span style={{ color: '#64748b' }}>School: </span>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{sourceSchool}</span>
        </div>
      </div>

      {/* ERROR LOADING GRADES */}
      {gradesError && (
        <div style={{ padding: '12px 16px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, fontSize: 12, color: '#e11d48' }}>
          {gradesError}
        </div>
      )}

      {/* HISTORICAL GRADES TABLE */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div className="overflow-x-auto w-full">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.04em' }}>
                  Subject
                </th>
                {termColumns.map((tc) => (
                  <th key={tc.key} style={{ textAlign: 'center', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.04em', width: 90 }}>
                    {tc.label}
                  </th>
                ))}
                <th style={{ textAlign: 'center', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#0f172a', letterSpacing: '0.04em', width: 110 }}>
                  Final Rating
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoadingGrades ? (
                <tr>
                  <td colSpan={termColumns.length + 2} style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                    <RefreshCw size={18} className="animate-spin text-slate-400" style={{ margin: '0 auto 8px' }} />
                    Loading historical grades...
                  </td>
                </tr>
              ) : subjects.length > 0 ? (
                subjects.map((sub: any, idx: number) => {
                  return (
                    <tr
                      key={sub.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#fff' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                        {cleanSubjectName(sub.name)}
                      </td>
                      {termColumns.map((tc) => {
                        const val = sub[tc.key];
                        return (
                          <td key={tc.key} style={{ textAlign: 'center', padding: '12px 14px', fontVariantNumeric: 'tabular-nums', color: val !== null && val !== undefined ? '#334155' : '#94a3b8' }}>
                            {val !== null && val !== undefined ? val : '—'}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: sub.finalRating !== null && sub.finalRating !== undefined ? '#0f172a' : '#94a3b8' }}>
                        {sub.finalRating !== null && sub.finalRating !== undefined ? sub.finalRating : '—'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={termColumns.length + 2} style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                    No published academic records available for this school year.
                  </td>
                </tr>
              )}
            </tbody>
            {/* GENERAL AVERAGE: Displayed only when authoritative data exists and subject set is complete */}
            {!isLoadingGrades && subjects.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                  <td colSpan={termColumns.length + 1} style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                    General Average
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isCompleteSubjectSet && generalAverage !== null ? (generalAverage >= 75 ? '#059669' : '#dc2626') : '#94a3b8' }}>
                    {isCompleteSubjectSet && generalAverage !== null && generalAverage !== undefined ? (
                      typeof generalAverage === 'number'
                        ? (generalAverage % 1 === 0 ? generalAverage : Number(generalAverage).toFixed(2))
                        : generalAverage
                    ) : (
                      <span style={{ fontSize: 11, fontStyle: 'italic', fontWeight: 500, color: '#94a3b8' }}>
                        Withheld (Incomplete Record)
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
}
