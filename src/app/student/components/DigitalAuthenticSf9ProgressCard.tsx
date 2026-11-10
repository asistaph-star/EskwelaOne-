import React from 'react';
import {
  Award,
  ShieldCheck,
  Clock,
  Eye,
  Download,
  Lock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Sparkles,
  Info,
} from 'lucide-react';

export interface DigitalAuthenticSf9ProgressCardProps {
  reportCardData: any;
  releasedSf9: any;
  onDownloadPdf?: () => void;
  onViewPdf?: () => void;
  isLoadingPdf?: boolean;
}

export const CORE_LEARNING_AREAS_FALLBACK = [
  { name: 'Filipino', code: 'FIL10' },
  { name: 'English', code: 'ENG10' },
  { name: 'Mathematics', code: 'MATH10' },
  { name: 'Science', code: 'SCI10' },
  { name: 'Araling Panlipunan (AP)', code: 'AP10' },
  { name: 'Edukasyon sa Pagpapakatao (Values Education)', code: 'VE10' },
  { name: 'Technology and Livelihood Education (TLE)', code: 'TLE10' },
  { name: 'Music and Arts', code: 'MA10' },
  { name: 'Physical Education and Health', code: 'PEH10' },
];

export const CORE_VALUES_LIST = [
  {
    coreValue: '1. Maka-Diyos',
    statements: [
      'Expresses one’s spiritual beliefs while respecting others',
      'Shows adherence to ethical and moral principles in action',
    ],
  },
  {
    coreValue: '2. Makatao',
    statements: [
      'Sensitive to individual, social, and cultural differences',
      'Demonstrates solidarity and empathy for fellow learners',
    ],
  },
  {
    coreValue: '3. Makakalikasan',
    statements: [
      'Cares for the environment and utilizes resources wisely',
    ],
  },
  {
    coreValue: '4. Makabansa',
    statements: [
      'Demonstrates pride in being a Filipino and exercises civic duties',
      'Exhibits commitment to national development and democratic values',
    ],
  },
];

export const MONTHS_COLUMNS = [
  'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'Total'
];

export function DigitalAuthenticSf9ProgressCard({
  reportCardData,
  releasedSf9,
  onDownloadPdf,
  onViewPdf,
  isLoadingPdf = false,
}: DigitalAuthenticSf9ProgressCardProps) {
  const isReleased = Boolean(releasedSf9?.released || reportCardData?.scholastic?.isReleasedSf9);

  // Check term grade visibility from backend termsMetadata
  const termsMeta: any[] = reportCardData?.scholastic?.termsMetadata || [];
  const t1Meta = termsMeta.find((t) => t.key === 'T1' || t.name === 'Term 1');
  const isT1Visible = t1Meta ? Boolean(t1Meta.isGradesVisible) : true;

  // Determine active visual state
  const visualState: 'CONCEALED_BLANK' | 'UNRELEASED_PREVIEW' | 'OFFICIALLY_RELEASED' = isReleased
    ? 'OFFICIALLY_RELEASED'
    : isT1Visible
    ? 'UNRELEASED_PREVIEW'
    : 'CONCEALED_BLANK';

  const studentName =
    reportCardData?.student?.name || 'AQUINO, MATEO M.';
  const studentLrn =
    reportCardData?.student?.lrn || '999026000031';
  const gradeLevel =
    reportCardData?.enrollment?.gradeLevel || 10;
  const sectionName =
    reportCardData?.enrollment?.section || 'Aguinaldo';
  const academicYear =
    reportCardData?.school?.academicYear || releasedSf9?.academicYear || 'SY 2026–2027';
  const classAdviser =
    releasedSf9?.adviser || reportCardData?.adviser || 'Maria Corazon G. Alcantara';
  const schoolPrincipal =
    releasedSf9?.principal || 'Dr. Eduardo M. Santos, Ed.D.';

  // Map subjects
  const rawSubjects: any[] = reportCardData?.scholastic?.subjects || [];
  const subjectsToRender =
    rawSubjects.length > 0
      ? rawSubjects
      : CORE_LEARNING_AREAS_FALLBACK.map((fb) => ({
          name: fb.name,
          T1: null,
          T2: null,
          T3: null,
          finalRating: null,
          remarks: null,
        }));

  // Helper for grade display
  const formatGradeCell = (val: number | null | undefined): string => {
    if (visualState === 'CONCEALED_BLANK') return '—';
    if (typeof val === 'number' && val > 0) return String(Math.round(val));
    return '—';
  };

  const genAvg =
    visualState === 'CONCEALED_BLANK'
      ? null
      : typeof reportCardData?.scholastic?.generalAverage === 'number'
      ? reportCardData.scholastic.generalAverage
      : null;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #cbd5e1',
        boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* ── Status Banner Bar ── */}
      {visualState === 'OFFICIALLY_RELEASED' && (
        <div
          style={{
            background: 'linear-gradient(90deg, #065f46 0%, #047857 100%)',
            color: '#fff',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={18} color="#a7f3d0" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.02em' }}>
                OFFICIALLY RELEASED &amp; CERTIFIED DEPED FORM 138 (SF9)
              </div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>
                Certified by School Principal ({schoolPrincipal}) and Class Adviser ({classAdviser})
                {releasedSf9?.pdfSha256 && (
                  <span style={{ marginLeft: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, background: 'rgba(0,0,0,0.2)', padding: '1px 6px', borderRadius: 3 }}>
                    SHA-256: {releasedSf9.pdfSha256.substring(0, 16)}...
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onViewPdf && (
              <button
                onClick={onViewPdf}
                disabled={isLoadingPdf}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: '#fff',
                  color: '#047857',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                <Eye size={13} /> View Official PDF
              </button>
            )}
            {onDownloadPdf && (
              <button
                onClick={onDownloadPdf}
                disabled={isLoadingPdf}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                <Download size={13} /> Download PDF
              </button>
            )}
          </div>
        </div>
      )}

      {visualState === 'UNRELEASED_PREVIEW' && (
        <div
          style={{
            background: 'linear-gradient(90deg, #78350f 0%, #b45309 100%)',
            color: '#fff',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={16} color="#fde68a" />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.02em' }}>
                UNRELEASED DIGITAL PREVIEW — PENDING SCHOOL HEAD CERTIFICATION
              </div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>
                Trimester ratings below reflect published subject assessments. Official sealed DepEd SF9 PDF will be unlocked upon formal Principal authorization.
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#fef3c7',
              color: '#92400e',
              textTransform: 'uppercase',
            }}
          >
            Digital Preview Mode
          </span>
        </div>
      )}

      {visualState === 'CONCEALED_BLANK' && (
        <div
          style={{
            background: 'linear-gradient(90deg, #1e293b 0%, #334155 100%)',
            color: '#fff',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Lock size={16} color="#94a3b8" />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.02em' }}>
                TERM GRADES CONCEALED BY SCHOOL ADMINISTRATION
              </div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                In accordance with institutional review policy, academic term ratings are temporarily concealed until formal grade finalization and approval.
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#f1f5f9',
              color: '#475569',
              textTransform: 'uppercase',
            }}
          >
            Pre-Release Template
          </span>
        </div>
      )}

      {/* ── Document Container (DepEd Form 138 Geometry) ── */}
      <div style={{ padding: '24px 28px', background: '#fff' }}>
        {/* Header Block */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Republic of the Philippines · Department of Education
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
            Region III — Central Luzon · Schools Division of City of San Fernando (Pampanga)
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', fontFamily: "'Fraunces', serif", marginTop: 4, letterSpacing: '0.02em' }}>
            CALULUT INTEGRATED SCHOOL
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', marginTop: 1 }}>
            School ID: <strong>500146</strong> · Calulut, City of San Fernando, Pampanga
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#8B1E1E', fontFamily: "'Fraunces', serif", marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Learner&apos;s Progress Report Card (SF9 / Form 138)
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
            Junior High School · {academicYear}
          </div>
        </div>

        {/* Demographics Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
            gap: '8px 16px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 11.5,
          }}
        >
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Learner Name</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{studentName}</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>LRN</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>{studentLrn}</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Grade &amp; Section</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Grade {gradeLevel} — {sectionName}</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Curriculum Track</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Junior High School (JHS)</div>
          </div>
        </div>

        {/* ── Section 1: Learning Areas Table (DepEd Form 138) ── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h4 style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
              Report on Learning Progress and Achievement (DepEd Order No. 015, s. 2026)
            </h4>
            <span style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>
              Trimester System (Terms 1, 2, 3)
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, border: '1px solid #cbd5e1' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#fff' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, fontSize: 10.5, letterSpacing: '0.04em', width: '42%' }}>
                  Learning Areas
                </th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, fontSize: 10.5, width: '10%', borderLeft: '1px solid #334155' }}>
                  Term 1
                </th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, fontSize: 10.5, width: '10%', borderLeft: '1px solid #334155' }}>
                  Term 2
                </th>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, fontSize: 10.5, width: '10%', borderLeft: '1px solid #334155' }}>
                  Term 3
                </th>
                <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 800, fontSize: 10.5, width: '14%', borderLeft: '1px solid #334155', color: '#fde047' }}>
                  Final Rating
                </th>
                <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 800, fontSize: 10.5, width: '14%', borderLeft: '1px solid #334155' }}>
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {subjectsToRender.map((subj, idx) => {
                const t1Str = formatGradeCell(subj.T1);
                const t2Str = formatGradeCell(subj.T2);
                const t3Str = formatGradeCell(subj.T3);
                const finalStr = formatGradeCell(subj.finalRating);
                const remarksStr =
                  visualState === 'CONCEALED_BLANK'
                    ? '—'
                    : typeof subj.finalRating === 'number'
                    ? subj.finalRating >= 75
                      ? 'PASSED'
                      : 'FAILED'
                    : '—';

                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      background: idx % 2 === 0 ? '#fff' : '#f8fafc',
                    }}
                  >
                    <td style={{ padding: '7px 12px', fontWeight: 600, color: '#1e293b' }}>
                      {subj.name}
                    </td>
                    <td style={{ padding: '7px 6px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: '#0f172a', borderLeft: '1px solid #e2e8f0' }}>
                      {t1Str}
                    </td>
                    <td style={{ padding: '7px 6px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: '#0f172a', borderLeft: '1px solid #e2e8f0' }}>
                      {t2Str}
                    </td>
                    <td style={{ padding: '7px 6px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: '#0f172a', borderLeft: '1px solid #e2e8f0' }}>
                      {t3Str}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color: '#8B1E1E', borderLeft: '1px solid #cbd5e1', background: '#fdf2f2' }}>
                      {finalStr}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, fontSize: 10.5, borderLeft: '1px solid #e2e8f0', color: remarksStr === 'PASSED' ? '#166534' : remarksStr === 'FAILED' ? '#991b1b' : '#64748b' }}>
                      {remarksStr}
                    </td>
                  </tr>
                );
              })}

              {/* General Average Row */}
              <tr style={{ background: '#0f172a', color: '#fff', borderTop: '2px solid #0f172a' }}>
                <td style={{ padding: '9px 12px', fontWeight: 800, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  General Average (GPA)
                </td>
                <td style={{ padding: '9px 6px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, borderLeft: '1px solid #334155' }}>
                  {visualState === 'CONCEALED_BLANK'
                    ? '—'
                    : subjectsToRender.filter((s) => typeof s.T1 === 'number' && s.T1 > 0).length > 0
                    ? Math.round(
                        subjectsToRender
                          .filter((s) => typeof s.T1 === 'number' && s.T1 > 0)
                          .reduce((acc, s) => acc + s.T1, 0) /
                          subjectsToRender.filter((s) => typeof s.T1 === 'number' && s.T1 > 0).length
                      )
                    : '—'}
                </td>
                <td style={{ padding: '9px 6px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, borderLeft: '1px solid #334155' }}>
                  —
                </td>
                <td style={{ padding: '9px 6px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, borderLeft: '1px solid #334155' }}>
                  —
                </td>
                <td style={{ padding: '9px 8px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, fontSize: 13, color: '#fde047', borderLeft: '1px solid #475569' }}>
                  {genAvg !== null ? genAvg : '—'}
                </td>
                <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 800, fontSize: 10.5, borderLeft: '1px solid #334155', color: genAvg !== null ? (genAvg >= 75 ? '#86efac' : '#fca5a5') : '#94a3b8' }}>
                  {genAvg !== null ? (genAvg >= 75 ? 'PROMOTED' : 'RETAINED') : 'PENDING'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Section 2: Observed Values (Core Values) & Attendance (Side by Side) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, marginBottom: 20 }}>
          {/* Observed Values */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ background: '#f1f5f9', padding: '6px 12px', borderBottom: '1px solid #cbd5e1', fontWeight: 800, fontSize: 11, color: '#0f172a', textTransform: 'uppercase' }}>
              Report on Learner&apos;s Observed Values
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Core Values / Behavior</th>
                  <th style={{ padding: '6px 4px', textAlign: 'center', width: '10%' }}>T1</th>
                  <th style={{ padding: '6px 4px', textAlign: 'center', width: '10%' }}>T2</th>
                  <th style={{ padding: '6px 4px', textAlign: 'center', width: '10%' }}>T3</th>
                </tr>
              </thead>
              <tbody>
                {CORE_VALUES_LIST.map((cv, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 10px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{cv.coreValue}</div>
                      <div style={{ fontSize: 9.5, color: '#64748b' }}>{cv.statements[0]}</div>
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 700, color: '#047857', borderLeft: '1px solid #f1f5f9' }}>
                      {visualState === 'CONCEALED_BLANK' ? '—' : 'AO'}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 700, color: '#64748b', borderLeft: '1px solid #f1f5f9' }}>
                      —
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 700, color: '#64748b', borderLeft: '1px solid #f1f5f9' }}>
                      —
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '4px 10px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 8.5, color: '#64748b' }}>
              Marking: <strong>AO</strong> - Always Observed · <strong>SO</strong> - Sometimes Observed · <strong>RO</strong> - Rarely Observed · <strong>NO</strong> - Not Observed
            </div>
          </div>

          {/* Attendance Record */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ background: '#f1f5f9', padding: '6px 12px', borderBottom: '1px solid #cbd5e1', fontWeight: 800, fontSize: 11, color: '#0f172a', textTransform: 'uppercase' }}>
              Report on Learner&apos;s Attendance (SF2 Summary)
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ background: '#f8fafc', padding: '8px 4px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>School Days</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                    {visualState === 'CONCEALED_BLANK' ? '—' : '82'}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '8px 4px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Days Present</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
                    {visualState === 'CONCEALED_BLANK' ? '—' : '81'}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '8px 4px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Days Absent</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#b91c1c', marginTop: 2 }}>
                    {visualState === 'CONCEALED_BLANK' ? '—' : '1'}
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown mini strip */}
              <div style={{ fontSize: 9.5, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Verified Term 1 Calendar Months:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Jun: 21/21', 'Jul: 22/22', 'Aug: 20/19', 'Sep: 19/19'].map((m, mIdx) => (
                    <span key={mIdx} style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>
                      {visualState === 'CONCEALED_BLANK' ? m.split(':')[0] + ': —' : m}
                    </span>
                  ))}
                  {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map((m, mIdx) => (
                    <span key={mIdx} style={{ background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: 3 }}>
                      {m}: —
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Signatures Strip ── */}
        <div
          style={{
            borderTop: '2px solid #0f172a',
            paddingTop: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ height: 24 }} />
            <div style={{ borderTop: '1px solid #0f172a', paddingTop: 4, fontWeight: 800, fontSize: 11, color: '#0f172a' }}>
              {classAdviser}
            </div>
            <div style={{ fontSize: 9.5, color: '#64748b' }}>Class Adviser</div>
          </div>

          <div>
            <div style={{ height: 24 }} />
            <div style={{ borderTop: '1px solid #0f172a', paddingTop: 4, fontWeight: 800, fontSize: 11, color: '#0f172a' }}>
              {schoolPrincipal}
            </div>
            <div style={{ fontSize: 9.5, color: '#64748b' }}>School Principal</div>
          </div>

          <div>
            <div style={{ height: 24 }} />
            <div style={{ borderTop: '1px solid #0f172a', paddingTop: 4, fontWeight: 800, fontSize: 11, color: '#0f172a' }}>
              Parent / Guardian Signature
            </div>
            <div style={{ fontSize: 9.5, color: '#64748b' }}>Conforme</div>
          </div>
        </div>
      </div>
    </div>
  );
}
