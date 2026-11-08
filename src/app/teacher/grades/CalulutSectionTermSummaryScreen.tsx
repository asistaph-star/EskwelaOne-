import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Award, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Eye, 
  FileText,
  Users,
  ChevronDown,
  ArrowRight,
  ShieldAlert,
  Info,
  Calendar,
  Layers,
  Sparkles,
  Download
} from 'lucide-react';
import { apiClient } from '../../../api/client';
import { academicApi } from '../../../api/academic.api';

interface SubjectSummary {
  id: string;
  code: string;
  name: string;
  teacherName: string;
  teacherId?: string | null;
  assignmentId?: string | null;
  status?: 'ASSIGNED' | 'UNASSIGNED' | 'NOT_IN_CATALOG';
  isAssigned?: boolean;
  isConfiguredInCurriculum?: boolean;
  isEditableByMe: boolean;
  isPublished: boolean;
}

interface LearnerRecord {
  no: number;
  studentId: string;
  enrollmentId: string;
  lrn: string;
  name: string;
  dateOfBirth: string | null;
  age: number | null;
  sex: 'M' | 'F';
  grades: Record<string, number | null>;
  mapeh: {
    musicArts: number | null;
    peHealth: number | null;
    termGrade: number | null;
    isComplete: boolean;
  };
  termAverage: number | null;
  isComplete: boolean;
  isProvisional: boolean;
  missingCount: number;
  rank: number | null;
  rankDisplay: string;
}

interface TermSummaryData {
  school: {
    name: string;
    schoolId: string;
    region: string;
    division: string;
    academicYear: string;
    schoolHead: string;
  };
  section: {
    id: string;
    name: string;
    gradeLevel: number;
    adviserName: string;
    adviserId: string;
    term: string;
    termLabel: string;
  };
  subjects: SubjectSummary[];
  males: LearnerRecord[];
  females: LearnerRecord[];
  stats: {
    totalEnrolled: number;
    maleCount: number;
    femaleCount: number;
    completeCount: number;
    provisionalCount: number;
    pendingCount: number;
    classAverage: number | null;
  };
}

interface CalulutSectionTermSummaryScreenProps {
  onNavigateToMyGradebook?: (sectionId?: string) => void;
}

export function CalulutSectionTermSummaryScreen({ onNavigateToMyGradebook }: CalulutSectionTermSummaryScreenProps) {
  // Navigation & Scope State
  const [availableSections, setAvailableSections] = useState<Array<{ id: string; name: string; gradeLevel: number }>>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<'T1' | 'T2' | 'T3'>('T1');

  // Data Loading
  const [data, setData] = useState<TermSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch: Load sections accessible to this teacher
  useEffect(() => {
    academicApi.getYears().then(years => {
      const activeYear = years?.find((y: any) => y.is_current) || years?.[0];
      if (!activeYear) return;

      academicApi.getMyAssignments(activeYear.id).then((assignments: any[]) => {
        const secMap = new Map<string, { id: string; name: string; gradeLevel: number }>();

        assignments?.forEach(a => {
          if (a.section) {
            secMap.set(a.section.id, {
              id: a.section.id,
              name: a.section.name,
              gradeLevel: a.section.grade_level
            });
          }
        });

        // Also check advised sections
        apiClient.get<any>('/academic/advisory/my-section').then((advRes: any) => {
          const adv = advRes?.data || advRes;
          if (adv && adv.id) {
            secMap.set(adv.id, {
              id: adv.id,
              name: adv.name,
              gradeLevel: adv.grade_level
            });
          }
          const secList = Array.from(secMap.values()).sort((a, b) => a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name));
          setAvailableSections(secList);
          if (secList.length > 0 && !selectedSectionId) {
            setSelectedSectionId(secList[0].id);
          }
        }).catch(() => {
          const secList = Array.from(secMap.values()).sort((a, b) => a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name));
          setAvailableSections(secList);
          if (secList.length > 0 && !selectedSectionId) {
            setSelectedSectionId(secList[0].id);
          }
        });
      }).catch(console.error);
    }).catch(console.error);
  }, []);

  // Fetch summary data whenever section or term changes
  useEffect(() => {
    if (!selectedSectionId) return;
    setIsLoading(true);
    setError(null);

    apiClient.get<any>(`/academic/sections/${selectedSectionId}/term-summary?term=${selectedTerm}`)
      .then((res: any) => {
        const payload = res?.data || res;
        setData(payload);
      })
      .catch((err: any) => {
        console.error('Failed to load section term summary:', err);
        const msg = err.response?.data?.message || err.message || 'Unable to load section term summary.';
        setError(msg);
        setData(null);
      })
      .finally(() => setIsLoading(false));
  }, [selectedSectionId, selectedTerm]);

  // Subject partition
  const { coreSubjects, maSubject, pehSubject } = useMemo(() => {
    if (!data?.subjects) return { coreSubjects: [], maSubject: null, pehSubject: null };
    const isMA = (s: SubjectSummary) => (s.code.toUpperCase().startsWith('MA') && !s.code.toUpperCase().startsWith('MATH')) || s.name.toLowerCase().includes('music');
    const isPEH = (s: SubjectSummary) => s.code.toUpperCase().startsWith('PEH') || s.name.toLowerCase().includes('physical education') || s.name.toLowerCase().includes('health');

    const ma = data.subjects.find(isMA) || null;
    const peh = data.subjects.find(isPEH) || null;
    const core = data.subjects.filter(s => !isMA(s) && !isPEH(s));
    return { coreSubjects: core, maSubject: ma, pehSubject: peh };
  }, [data]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      
      {/* Top Controls Toolbar */}
      <div style={{ 
        background: '#ffffff', 
        borderBottom: '1px solid #e2e8f0', 
        padding: '12px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Section Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Section:
            </span>
            <select
              id="select-summary-section"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: 6,
                border: '1.5px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {availableSections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  Grade {sec.gradeLevel}, Section {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Term Switcher Tabs */}
          <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 8, padding: 3, border: '1px solid #e2e8f0' }}>
            {(['T1', 'T2', 'T3'] as const).map(term => {
              const labelMap: Record<string, string> = { T1: 'First Term', T2: 'Second Term', T3: 'Third Term' };
              const isSelected = selectedTerm === term;
              return (
                <button
                  key={term}
                  id={`tab-term-${term.toLowerCase()}`}
                  type="button"
                  onClick={() => setSelectedTerm(term)}
                  style={{
                    padding: '5px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    background: isSelected ? '#8b1e1e' : 'transparent',
                    color: isSelected ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {labelMap[term]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info & Navigation Quick Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 6, 
            fontSize: 11.5, 
            fontWeight: 600, 
            color: '#1e293b', 
            background: '#f1f5f9', 
            padding: '5px 10px', 
            borderRadius: 6,
            border: '1px solid #e2e8f0'
          }}>
            <Eye size={13} color="#475569" />
            <span>Read-Only Consolidated Summary</span>
          </div>

          {onNavigateToMyGradebook && (
            <button
              id="btn-back-to-gradebook"
              type="button"
              onClick={() => onNavigateToMyGradebook(selectedSectionId)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: '#8b1e1e',
                background: '#fff',
                border: '1.5px solid #8b1e1e',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <BookOpen size={13} />
              Edit My Subject Gradebook
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20, minHeight: 0 }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 350, flexDirection: 'column', gap: 12 }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              border: '3px solid #e2e8f0', 
              borderTopColor: '#8b1e1e', 
              borderRadius: '50%', 
              animation: 'spin 0.8s linear infinite' 
            }} />
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Loading Calulut Section Term Summary...
            </div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : error ? (
          <div style={{ 
            maxWidth: 650, 
            margin: '40px auto', 
            padding: 24, 
            background: '#fff', 
            borderRadius: 10, 
            border: '1px solid #fee2e2', 
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', marginBottom: 12 }}>
              <ShieldAlert size={24} />
              <div style={{ fontSize: 16, fontWeight: 700 }}>Access Restricted</div>
            </div>
            <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6, marginBottom: 16 }}>
              {error}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <strong>Notice:</strong> In accordance with Calulut Integrated School's academic privacy policy, teachers may only access published section summaries for sections where they are an officially assigned Subject Teacher or the designated Class Adviser.
            </div>
          </div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            No summary data available for this section.
          </div>
        ) : (
          <div style={{ 
            background: '#ffffff', 
            borderRadius: 8, 
            border: '1.5px solid #000000', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)', 
            overflow: 'hidden',
            fontFamily: 'Arial, sans-serif'
          }}>
            
            {/* Calulut Official Excel Header (Landscape Print Replica) */}
            <div style={{ borderBottom: '2px solid #000000', padding: '16px 20px', background: '#ffffff' }}>
              {/* Row 2-4: CLASS SUMMARY */}
              <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: '#000000', letterSpacing: '0.05em', marginBottom: 12 }}>
                CLASS SUMMARY
              </div>

              {/* Rows 5-6: School Information Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '8px 24px', 
                fontSize: 11.5, 
                color: '#000000',
                marginBottom: 14,
                lineHeight: 1.5
              }}>
                <div><strong>REGION:</strong> {data.school.region}</div>
                <div><strong>DIVISION:</strong> {data.school.division}</div>
                <div><strong>SCHOOL NAME:</strong> {data.school.name}</div>
                <div><strong>SCHOOL ID:</strong> {data.school.schoolId}</div>
                <div><strong>SCHOOL YEAR:</strong> {data.school.academicYear}</div>
                <div><strong>SCHOOL HEAD:</strong> {data.school.schoolHead}</div>
              </div>

              {/* Rows 9-10: Term, Grade, Section & Adviser */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                borderTop: '1px solid #000000', 
                paddingTop: 10,
                flexWrap: 'wrap',
                gap: 12,
                fontSize: 12.5,
                fontWeight: 700,
                color: '#000000'
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e2e8f0', padding: '4px 10px', borderRadius: 4, border: '1px solid #94a3b8' }}>
                  <Calendar size={14} />
                  <span>{data.section.termLabel}</span>
                </div>
                <div>
                  <strong>GRADE LEVEL:</strong> {data.section.gradeLevel} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>SECTION:</strong> {data.section.name}
                </div>
                <div>
                  <strong>CLASS ADVISER:</strong> {data.section.adviserName}
                </div>
              </div>
            </div>

            {/* Read-Only Status & Academic Integrity Banner */}
            <div style={{ 
              background: '#f8fafc', 
              borderBottom: '1.5px solid #000000', 
              padding: '8px 20px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              fontSize: 11.5,
              color: '#334155',
              flexWrap: 'wrap',
              gap: 8
            }}>
              <div>
                <strong>Section Statistics:</strong> Enrolled: <strong>{data.stats.totalEnrolled}</strong> (M: {data.stats.maleCount}, F: {data.stats.femaleCount}) &nbsp;•&nbsp; 
                Complete: <strong style={{ color: '#16a34a' }}>{data.stats.completeCount}</strong> &nbsp;•&nbsp; 
                Provisional: <strong style={{ color: '#d97706' }}>{data.stats.provisionalCount}</strong> &nbsp;•&nbsp; 
                Class Average: <strong>{data.stats.classAverage ?? '—'}</strong>
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                * Excel Formula Standard: 8 Equally Weighted Learning Areas • Ties ranked via RANK.AVG
              </div>
            </div>

            {/* Consolidated Wide Grade Grid */}
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                fontSize: 11, 
                whiteSpace: 'nowrap',
                textAlign: 'center'
              }}>
                <thead>
                  {/* Row 11: Top Level Hierarchy */}
                  <tr style={{ background: '#e2e8f0', color: '#000000', fontWeight: 700, borderBottom: '1px solid #000000' }}>
                    <th rowSpan={3} style={{ width: 40, border: '1px solid #000000', padding: 6 }}>No.</th>
                    <th rowSpan={3} style={{ width: 220, border: '1px solid #000000', padding: 6, textAlign: 'left' }}>LEARNERS' NAMES</th>
                    <th rowSpan={3} style={{ width: 110, border: '1px solid #000000', padding: 6 }}>LRN</th>
                    <th rowSpan={3} style={{ width: 85, border: '1px solid #000000', padding: 6 }}>Date of Birth</th>
                    <th rowSpan={3} style={{ width: 45, border: '1px solid #000000', padding: 6 }}>Age</th>
                    <th rowSpan={3} style={{ width: 45, border: '1px solid #000000', padding: 6 }}>Sex</th>
                    
                    {/* Learning Areas Span */}
                    <th colSpan={coreSubjects.length + 3} style={{ border: '1px solid #000000', padding: 5, background: '#cbd5e1' }}>
                      Learning Areas
                    </th>

                    <th rowSpan={3} style={{ width: 80, border: '1.5px solid #000000', padding: 6, background: '#f1f5f9' }}>
                      Final Grade
                    </th>
                    <th rowSpan={3} style={{ width: 65, border: '1.5px solid #000000', padding: 6, background: '#f1f5f9' }}>
                      Rank
                    </th>
                  </tr>

                  {/* Row 12: Subject Headers & MAPEH Grouping */}
                  <tr style={{ background: '#e2e8f0', color: '#000000', fontWeight: 700, borderBottom: '1px solid #000000' }}>
                    {coreSubjects.map(subj => {
                      const isUnassigned = subj.status === 'UNASSIGNED';
                      const isNotInCatalog = subj.status === 'NOT_IN_CATALOG';
                      const cleanName = subj.name.replace(/\s+\d+$/, '');
                      return (
                        <th key={subj.code || subj.id} rowSpan={2} style={{ width: 75, border: '1px solid #000000', padding: 4 }} title={`${subj.name} — Teacher: ${subj.teacherName}`}>
                          <div>{cleanName.split(' ')[0]}</div>
                          <div style={{ fontSize: 9, fontWeight: 500, color: '#475569' }}>{subj.code}</div>
                          {isUnassigned && (
                            <div style={{ fontSize: 7, color: '#b45309', fontWeight: 700, marginTop: 2, background: '#fef3c7', borderRadius: 2, padding: '1px 2px', border: '0.5px solid #f59e0b' }}>
                              UNASSIGNED
                            </div>
                          )}
                          {isNotInCatalog && (
                            <div style={{ fontSize: 7, color: '#64748b', fontWeight: 600, marginTop: 2, background: '#f1f5f9', borderRadius: 2, padding: '1px 2px', border: '0.5px solid #cbd5e1' }}>
                              PENDING
                            </div>
                          )}
                        </th>
                      );
                    })}

                    {/* MAPEH Super Header */}
                    <th colSpan={3} style={{ border: '1.5px solid #000000', padding: 4, background: '#cbd5e1' }}>
                      MAPEH
                    </th>
                  </tr>

                  {/* Row 13: MAPEH Sub-Columns */}
                  <tr style={{ background: '#e2e8f0', color: '#000000', fontWeight: 700, borderBottom: '2px solid #000000' }}>
                    <th style={{ width: 60, border: '1px solid #000000', padding: 4 }} title={`Music & Arts — Teacher: ${maSubject?.teacherName || 'Unassigned'}`}>
                      <div>M A</div>
                      {maSubject?.status === 'UNASSIGNED' && (
                        <div style={{ fontSize: 6.5, color: '#b45309', fontWeight: 700, background: '#fef3c7', borderRadius: 2, padding: '1px 2px' }}>UNASSIGNED</div>
                      )}
                      {maSubject?.status === 'NOT_IN_CATALOG' && (
                        <div style={{ fontSize: 6.5, color: '#64748b', fontWeight: 600, background: '#f1f5f9', borderRadius: 2, padding: '1px 2px' }}>PENDING</div>
                      )}
                    </th>
                    <th style={{ width: 60, border: '1px solid #000000', padding: 4 }} title={`Physical Education & Health — Teacher: ${pehSubject?.teacherName || 'Unassigned'}`}>
                      <div>P E H</div>
                      {pehSubject?.status === 'UNASSIGNED' && (
                        <div style={{ fontSize: 6.5, color: '#b45309', fontWeight: 700, background: '#fef3c7', borderRadius: 2, padding: '1px 2px' }}>UNASSIGNED</div>
                      )}
                      {pehSubject?.status === 'NOT_IN_CATALOG' && (
                        <div style={{ fontSize: 6.5, color: '#64748b', fontWeight: 600, background: '#f1f5f9', borderRadius: 2, padding: '1px 2px' }}>PENDING</div>
                      )}
                    </th>
                    <th style={{ width: 70, border: '1.5px solid #000000', padding: 4, background: '#cbd5e1' }} title="MAPEH Combined Term Grade">
                      Term Grade
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {/* ===================== MALE COHORT ===================== */}
                  <tr style={{ background: '#cccccc', borderTop: '2px solid #000000', borderBottom: '1px solid #000000' }}>
                    <td colSpan={coreSubjects.length + 11} style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 800, fontSize: 11.5, color: '#000000' }}>
                      MALE
                    </td>
                  </tr>

                  {data.males.length === 0 ? (
                    <tr>
                      <td colSpan={coreSubjects.length + 11} style={{ padding: 16, color: '#64748b', fontStyle: 'italic' }}>
                        No male learners enrolled in this section.
                      </td>
                    </tr>
                  ) : (
                    data.males.map((learner) => renderLearnerRow(learner, coreSubjects))
                  )}

                  {/* ===================== FEMALE COHORT ===================== */}
                  <tr style={{ background: '#cccccc', borderTop: '2px solid #000000', borderBottom: '1px solid #000000' }}>
                    <td colSpan={coreSubjects.length + 11} style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 800, fontSize: 11.5, color: '#000000' }}>
                      FEMALE
                    </td>
                  </tr>

                  {data.females.length === 0 ? (
                    <tr>
                      <td colSpan={coreSubjects.length + 11} style={{ padding: 16, color: '#64748b', fontStyle: 'italic' }}>
                        No female learners enrolled in this section.
                      </td>
                    </tr>
                  ) : (
                    data.females.map((learner) => renderLearnerRow(learner, coreSubjects))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Footer & Legend */}
            <div style={{ 
              background: '#f8fafc', 
              borderTop: '2px solid #000000', 
              padding: '12px 20px', 
              fontSize: 11, 
              color: '#475569',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                <strong>Legend:</strong> &nbsp;
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 16 }}>
                  <span style={{ width: 10, height: 10, background: '#16a34a', borderRadius: '50%' }} /> 
                  Complete Grade & Eligible Rank
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 16 }}>
                  <span style={{ width: 10, height: 10, background: '#d97706', borderRadius: '50%' }} /> 
                  * Provisional (Incomplete Learning Areas)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: '#94a3b8', borderRadius: '50%' }} /> 
                  Pending Grades
                </span>
              </div>
              <div style={{ fontStyle: 'italic' }}>
                DigiSkwela Academic Verification • Compliant with DepEd Order No. 015, s. 2026
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );

  function renderLearnerRow(learner: LearnerRecord, coreList: SubjectSummary[]) {
    const isProvisional = learner.isProvisional;
    const isComplete = learner.isComplete;
    const hasRank = learner.rank !== null;

    return (
      <tr 
        key={learner.studentId}
        style={{ 
          borderBottom: '1px solid #cbd5e1', 
          background: isProvisional ? '#fffdf7' : '#ffffff',
          transition: 'background 0.15s ease'
        }}
      >
        <td style={{ border: '1px solid #000000', padding: '6px 4px', fontWeight: 600 }}>{learner.no}</td>
        <td style={{ border: '1px solid #000000', padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#000000' }}>
          {learner.name}
        </td>
        <td style={{ border: '1px solid #000000', padding: '6px 4px', fontSize: 10.5 }}>{learner.lrn}</td>
        <td style={{ border: '1px solid #000000', padding: '6px 4px', fontSize: 10.5 }}>{learner.dateOfBirth || '—'}</td>
        <td style={{ border: '1px solid #000000', padding: '6px 4px' }}>{learner.age ?? '—'}</td>
        <td style={{ border: '1px solid #000000', padding: '6px 4px', fontWeight: 700 }}>{learner.sex}</td>

        {/* Core Subject Scores */}
        {coreList.map(subj => {
          const score = learner.grades[subj.code];
          return (
            <td 
              key={subj.code || subj.id}
              style={{ 
                border: '1px solid #000000', 
                padding: '6px 4px', 
                fontWeight: score !== null ? 600 : 400,
                color: score !== null ? (score < 75 ? '#dc2626' : '#000000') : '#94a3b8'
              }}
            >
              {score !== null ? score : '—'}
            </td>
          );
        })}

        {/* MAPEH: M A */}
        <td style={{ border: '1px solid #000000', padding: '6px 4px', color: learner.mapeh.musicArts !== null ? '#000000' : '#94a3b8' }}>
          {learner.mapeh.musicArts ?? '—'}
        </td>

        {/* MAPEH: P E H */}
        <td style={{ border: '1px solid #000000', padding: '6px 4px', color: learner.mapeh.peHealth !== null ? '#000000' : '#94a3b8' }}>
          {learner.mapeh.peHealth ?? '—'}
        </td>

        {/* MAPEH: Combined Term Grade */}
        <td style={{ 
          border: '1.5px solid #000000', 
          padding: '6px 4px', 
          fontWeight: 700, 
          background: '#f8fafc',
          color: learner.mapeh.isComplete 
            ? '#000000' 
            : (learner.mapeh.termGrade !== null ? '#b45309' : '#94a3b8')
        }}>
          {learner.mapeh.termGrade ?? '—'}
          {!learner.mapeh.isComplete && learner.mapeh.termGrade !== null && (
            <span style={{ fontSize: 9, display: 'block', color: '#d97706', fontWeight: 600 }}>*inc</span>
          )}
        </td>

        {/* Final Grade (Overall Term Average) */}
        <td style={{ 
          border: '1.5px solid #000000', 
          padding: '6px 6px', 
          fontWeight: 800, 
          fontSize: 11.5,
          background: isComplete ? '#f0fdf4' : (isProvisional ? '#fefce8' : '#ffffff'),
          color: isComplete 
            ? (learner.termAverage! < 75 ? '#dc2626' : '#15803d') 
            : (isProvisional ? '#b45309' : '#94a3b8')
        }}>
          {learner.termAverage !== null ? learner.termAverage : '—'}
          {isProvisional && (
            <span style={{ fontSize: 8.5, display: 'block', color: '#b45309', fontWeight: 600 }}>
              *{learner.missingCount} missing
            </span>
          )}
        </td>

        {/* Class Rank */}
        <td style={{ 
          border: '1.5px solid #000000', 
          padding: '6px 6px', 
          fontWeight: 800,
          background: hasRank ? '#f0fdf4' : '#ffffff',
          color: hasRank ? '#15803d' : '#94a3b8'
        }}>
          {hasRank ? (
            <span style={{ 
              display: 'inline-block', 
              padding: '2px 8px', 
              background: '#dcfce7', 
              borderRadius: 4, 
              color: '#166534',
              fontSize: 11
            }}>
              {learner.rankDisplay}
            </span>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: 10, fontStyle: 'italic' }}>
              Pending
            </span>
          )}
        </td>
      </tr>
    );
  }
}

