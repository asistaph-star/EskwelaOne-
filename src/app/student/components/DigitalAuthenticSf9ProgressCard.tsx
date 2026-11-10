import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  Download,
  Eye,
  ShieldCheck,
  Award,
  FileText,
  Calendar,
  AlertCircle,
  Sparkles,
  Info,
  Check,
  UserCheck,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { API_BASE_URL } from '../../../api/client';

export interface DigitalAuthenticSf9ProgressCardProps {
  reportCardData: any;
  releasedSf9: any;
  onDownloadPdf?: () => void;
  onViewPdf?: () => void;
  isLoadingPdf?: boolean;
  isTeacherPreview?: boolean;
  academicYearId?: string;
}

export const CANONICAL_JHS_LEARNING_AREAS = [
  { key: 'filipino', name: 'Filipino', code: 'FIL' },
  { key: 'english', name: 'English', code: 'ENG' },
  { key: 'mathematics', name: 'Mathematics', code: 'MATH' },
  { key: 'science', name: 'Science', code: 'SCI' },
  { key: 'ap', name: 'Araling Panlipunan (AP)', code: 'AP' },
  { key: 'esp', name: 'Edukasyon sa Pagpapakatao (EsP)', code: 'ESP' },
  { key: 'tle', name: 'Technology and Livelihood Education (TLE)', code: 'TLE' },
  {
    key: 'mapeh',
    name: 'MAPEH',
    code: 'MAPEH',
    isParent: true,
    components: [
      { key: 'music_arts', name: 'Music and Arts', code: 'MA' },
      { key: 'pe_health', name: 'Physical Education and Health', code: 'PEH' },
    ],
  },
];

export const MONTH_NAMES = [
  'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'Total'
];

export const PERFORMANCE_DESCRIPTORS = [
  { scale: '90–100', descriptor: 'Outstanding', remarks: 'Passed' },
  { scale: '85–89', descriptor: 'Very Satisfactory', remarks: 'Passed' },
  { scale: '80–84', descriptor: 'Satisfactory', remarks: 'Passed' },
  { scale: '75–79', descriptor: 'Fairly Satisfactory', remarks: 'Passed' },
  { scale: 'Below 75', descriptor: 'Did Not Meet Expectations', remarks: 'Failed' },
];

export function DigitalAuthenticSf9ProgressCard({
  reportCardData,
  releasedSf9,
  onDownloadPdf,
  onViewPdf,
  isLoadingPdf = false,
  isTeacherPreview = false,
  academicYearId,
}: DigitalAuthenticSf9ProgressCardProps) {
  const [activePageView, setActivePageView] = useState<'both' | 'front' | 'back'>('both');
  const [viewMode, setViewMode] = useState<'workbook-pdf' | 'digital-view'>('workbook-pdf');
  const [previewPdfBlobUrl, setPreviewPdfBlobUrl] = useState<string | null>(null);
  const [isLoadingPreviewPdf, setIsLoadingPreviewPdf] = useState<boolean>(true);
  const [previewPdfError, setPreviewPdfError] = useState<string | null>(null);
  const [rendererUnavailable, setRendererUnavailable] = useState<boolean>(false);

  const isReleased = Boolean(
    releasedSf9?.released ||
    reportCardData?.isOfficialSf9Released ||
    reportCardData?.scholastic?.isReleasedSf9
  );

  const fetchPreviewPdf = async () => {
    setIsLoadingPreviewPdf(true);
    setPreviewPdfError(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const query = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : '';
      const resp = await fetch(`${API_BASE_URL}/academic/report-card/student/preview/pdf${query}`, {
        credentials: 'include',
        headers,
      });

      if (resp.status === 503) {
        setRendererUnavailable(true);
        setViewMode('digital-view');
        return;
      }

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.message || `Failed to load preview PDF (HTTP ${resp.status})`);
      }

      const blob = await resp.blob();
      const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
      setPreviewPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(pdfBlob);
      });
      setRendererUnavailable(false);
    } catch (err: any) {
      console.warn('Workbook PDF preview unavailable, falling back to digital view:', err);
      setPreviewPdfError(err.message || 'Renderer unavailable');
      setRendererUnavailable(true);
      setViewMode('digital-view');
    } finally {
      setIsLoadingPreviewPdf(false);
    }
  };

  useEffect(() => {
    if (!isReleased) {
      fetchPreviewPdf();
    }
    return () => {
      if (previewPdfBlobUrl) {
        URL.revokeObjectURL(previewPdfBlobUrl);
      }
    };
  }, [academicYearId, isReleased, reportCardData?.termsMetadata]);

  const handleDownloadUnofficialPdf = () => {
    if (!previewPdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = previewPdfBlobUrl;
    const lrn = reportCardData?.student?.lrn || 'Learner';
    a.download = `Calulut_SF9_${lrn}_Unofficial_Preview.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Term grade visibility from termsMetadata
  const termsMeta: any[] = reportCardData?.termsMetadata || reportCardData?.scholastic?.termsMetadata || [];
  const t1Meta = termsMeta.find((t) => t.key === 'T1' || t.name === 'Term 1' || t.key === 'First Term');
  const t2Meta = termsMeta.find((t) => t.key === 'T2' || t.name === 'Term 2' || t.key === 'Second Term');
  const t3Meta = termsMeta.find((t) => t.key === 'T3' || t.name === 'Term 3' || t.key === 'Third Term');

  const isT1Visible = isTeacherPreview || isReleased || (t1Meta ? Boolean(t1Meta.isGradesVisible) : false);
  const isT2Visible = isTeacherPreview || isReleased || (t2Meta ? Boolean(t2Meta.isGradesVisible) : false);
  const isT3Visible = isTeacherPreview || isReleased || (t3Meta ? Boolean(t3Meta.isGradesVisible) : false);

  // Check visual state
  const visualState: 'CONCEALED_BLANK' | 'UNRELEASED_PREVIEW' | 'OFFICIALLY_RELEASED' | 'TEACHER_PREVIEW' = isReleased
    ? 'OFFICIALLY_RELEASED'
    : isTeacherPreview
    ? 'TEACHER_PREVIEW'
    : isT1Visible
    ? 'UNRELEASED_PREVIEW'
    : 'CONCEALED_BLANK';

  // Demographics
  const studentName = reportCardData?.student?.name || '—';
  const studentLrn = reportCardData?.student?.lrn || '—';
  const gradeLevel = reportCardData?.enrollment?.gradeLevel || '—';
  const sectionName = reportCardData?.enrollment?.section || '—';
  const age = reportCardData?.student?.age ?? '—';
  const sex = reportCardData?.student?.gender || '—';
  const academicYear = reportCardData?.school?.academicYear || releasedSf9?.academicYear || '—';
  const classAdviser = releasedSf9?.adviser || reportCardData?.adviser || '—';
  const schoolPrincipal = releasedSf9?.principal || reportCardData?.principal || '—';

  // Map scholastic subjects
  const rawSubjects: any[] = reportCardData?.scholastic?.subjects || [];

  // Helper function to resolve subject score
  const getSubjectScore = (matchKey: string, term: 'T1' | 'T2' | 'T3'): number | null => {
    const isVisible = term === 'T1' ? isT1Visible : term === 'T2' ? isT2Visible : isT3Visible;
    if (!isVisible) return null;

    const s = rawSubjects.find((subj: any) => {
      const n = (subj.name || subj.subjectName || '').toLowerCase();
      const c = (subj.code || subj.subjectCode || '').toLowerCase();
      if (matchKey === 'filipino') return n.includes('filipino') || c.includes('fil');
      if (matchKey === 'english') return n.includes('english') || c.includes('eng');
      if (matchKey === 'mathematics') return n.includes('math');
      if (matchKey === 'science') return n.includes('science') || c.includes('sci');
      if (matchKey === 'ap') return n.includes('araling panlipunan') || n.includes('ap') || c.includes('ap');
      if (matchKey === 'esp') return n.includes('values') || n.includes('edukasyon sa pagpapakatao') || n.includes('esp') || n.includes('gmrc');
      if (matchKey === 'tle') return n.includes('technology') || n.includes('tle') || n.includes('epp');
      if (matchKey === 'music_arts') return n.includes('music') || c.includes('ma');
      if (matchKey === 'pe_health') return n.includes('physical education') || n.includes('pe') || c.includes('peh');
      if (matchKey === 'mapeh') return n === 'mapeh' || c === 'mapeh';
      return false;
    });

    if (s) {
      if (typeof s[term] === 'number') return s[term];
      if (typeof s[term.toLowerCase()] === 'number') return s[term.toLowerCase()];
      if (typeof s.terms?.[term]?.numericScore === 'number') return s.terms[term].numericScore;
      if (typeof s.terms?.[term] === 'number') return s.terms[term];
    }
    return null;
  };

  // Helper to format table cells
  const formatCell = (val: number | null | undefined): string => {
    if (typeof val === 'number' && val > 0) return String(Math.round(val));
    return '—';
  };

  // Check annual completeness: All 3 terms must be visible and have grades
  const isAnnualComplete = isT1Visible && isT2Visible && isT3Visible &&
    rawSubjects.length > 0 &&
    rawSubjects.every((s: any) => typeof s.T1 === 'number' && typeof s.T2 === 'number' && typeof s.T3 === 'number');

  // General Average calculation
  const genAvg = isAnnualComplete && typeof reportCardData?.scholastic?.generalAverage === 'number'
    ? reportCardData.scholastic.generalAverage
    : null;

  // Attendance data
  const attData = reportCardData?.attendance;
  const standardClassDays = [15, 22, 20, 20, 20, 20, 20, 18, 18, 20, 5]; // Jun to Apr = 198
  const classDays: (number | string)[] = attData?.classDaysByMonth || standardClassDays;
  const presentDays: (number | string)[] = attData?.presentByMonth || [];
  
  // Format attendance cell
  const formatAttCell = (idx: number, isPresent: boolean): string => {
    if (visualState === 'CONCEALED_BLANK' && !isReleased) return '—';
    if (isPresent) {
      if (Array.isArray(presentDays) && typeof presentDays[idx] === 'number') {
        return String(presentDays[idx]);
      }
      return '—';
    } else {
      // Days Absent
      if (visualState === 'CONCEALED_BLANK' && !isReleased) return '—';
      if (Array.isArray(presentDays) && typeof presentDays[idx] === 'number' && typeof classDays[idx] === 'number') {
        const abs = Number(classDays[idx]) - Number(presentDays[idx]);
        return String(Math.max(0, abs));
      }
      return '—';
    }
  };

  // Attendance totals
  const totalClassDaysVal = visualState === 'CONCEALED_BLANK' && !isReleased
    ? '—'
    : attData?.totalClassDays ?? (classDays.length === 11 ? 198 : '—');
  const totalPresentVal = visualState === 'CONCEALED_BLANK' && !isReleased
    ? '—'
    : attData?.totalDaysPresent ?? '—';
  const totalAbsentVal = visualState === 'CONCEALED_BLANK' && !isReleased
    ? '—'
    : attData?.totalDaysAbsent ?? '—';

  // Published adviser comments
  const t1Comment = isT1Visible && reportCardData?.adviserComments?.T1
    ? reportCardData.adviserComments.T1
    : '—';
  const t2Comment = isT2Visible && reportCardData?.adviserComments?.T2
    ? reportCardData.adviserComments.T2
    : '—';
  const t3Comment = isT3Visible && reportCardData?.adviserComments?.T3
    ? reportCardData.adviserComments.T3
    : '—';

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #cbd5e1',
        boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
        overflow: 'hidden',
        fontFamily: "'Calibri', 'Inter', -apple-system, sans-serif",
      }}
    >
      {/* ── Status Banner ── */}
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
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={20} color="#a7f3d0" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.02em' }}>
                OFFICIALLY RELEASED &amp; SEALED DEPED FORM 138 (SF9)
              </div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>
                Certified by School Principal ({schoolPrincipal}) and Class Adviser ({classAdviser})
                {releasedSf9?.pdfSha256 && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 10,
                      background: 'rgba(0,0,0,0.25)',
                      padding: '2px 6px',
                      borderRadius: 3,
                    }}
                  >
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

      {visualState === 'TEACHER_PREVIEW' && (
        <div
          style={{
            background: 'linear-gradient(90deg, #1e3a5f 0%, #1e40af 100%)',
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
              <Eye size={16} color="#93c5fd" />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.02em' }}>
                STAFF ACADEMIC PREVIEW — AUTHENTIC CALULUT FORM 138
              </div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>
                Reviewing authoritative database records (grades, SF2 attendance, and signatories) formatted to Calulut Form 138 layout.
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#dbeafe',
              color: '#1e40af',
              textTransform: 'uppercase',
            }}
          >
            Teacher Verification Mode
          </span>
        </div>
      )}

      {/* ── Compact Unofficial Academic Preview Bar ── */}
      {!isReleased && !isTeacherPreview && (
        <div
          style={{
            background: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                backgroundColor: '#d97706',
                boxShadow: '0 0 0 3px rgba(217, 119, 6, 0.2)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400e', letterSpacing: '0.01em' }}>
                Academic Preview — Not an Officially Released SF9
              </div>
              <div style={{ fontSize: 11, color: '#b45309' }}>
                Authoritative DepEd Form 138 preview derived from authentic Calulut workbook. Official signed document unlocks upon Principal issuance.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* View Mode Switcher */}
            <div style={{ display: 'flex', background: '#fef3c7', borderRadius: 6, padding: 2, border: '1px solid #fcd34d' }}>
              <button
                type="button"
                id="btn-view-workbook-pdf"
                onClick={() => setViewMode('workbook-pdf')}
                disabled={rendererUnavailable}
                title={rendererUnavailable ? 'Workbook renderer unavailable' : 'View original Form 138 workbook PDF'}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: viewMode === 'workbook-pdf' ? 700 : 500,
                  borderRadius: 4,
                  border: 'none',
                  background: viewMode === 'workbook-pdf' ? '#b45309' : 'transparent',
                  color: viewMode === 'workbook-pdf' ? '#ffffff' : '#78350f',
                  cursor: rendererUnavailable ? 'not-allowed' : 'pointer',
                  opacity: rendererUnavailable ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease',
                }}
              >
                <FileSpreadsheet size={13} />
                <span>Original SF9 (Workbook PDF)</span>
              </button>
              <button
                type="button"
                id="btn-view-digital-table"
                onClick={() => setViewMode('digital-view')}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: viewMode === 'digital-view' ? 700 : 500,
                  borderRadius: 4,
                  border: 'none',
                  background: viewMode === 'digital-view' ? '#b45309' : 'transparent',
                  color: viewMode === 'digital-view' ? '#ffffff' : '#78350f',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease',
                }}
              >
                <Eye size={13} />
                <span>Digital View</span>
              </button>
            </div>

            {/* Download Preview Button */}
            {viewMode === 'workbook-pdf' && previewPdfBlobUrl && !isLoadingPreviewPdf && (
              <>
                <button
                  type="button"
                  id="btn-download-preview-pdf"
                  onClick={handleDownloadUnofficialPdf}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 6,
                    background: '#ffffff',
                    border: '1px solid #d97706',
                    color: '#92400e',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                  title="Download unofficial PDF preview copy"
                >
                  <Download size={13} />
                  <span>Download Preview (Unofficial)</span>
                </button>
                <button
                  type="button"
                  onClick={fetchPreviewPdf}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '5px 8px',
                    borderRadius: 6,
                    background: '#ffffff',
                    border: '1px solid #d97706',
                    color: '#92400e',
                    cursor: 'pointer',
                  }}
                  title="Refresh preview"
                >
                  <RefreshCw size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Graceful Fallback Notice ── */}
      {rendererUnavailable && (
        <div
          id="sf9-renderer-unavailable-notice"
          style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '8px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: '#475569',
          }}
        >
          <Info size={14} color="#0284c7" />
          <span>Original Form 138 document renderer is temporarily unavailable. Displaying digital progress summary.</span>
        </div>
      )}

      {/* ── View Body ── */}
      {!isReleased && !isTeacherPreview && viewMode === 'workbook-pdf' && !rendererUnavailable ? (
        <div>
          {isLoadingPreviewPdf ? (
            <div style={{ padding: 60, textAlign: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#475569', fontSize: 13, fontWeight: 600 }}>
                <RefreshCw size={18} className="animate-spin text-amber-600" />
                <span>Rendering authentic Calulut Form 138 preview from master workbook...</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                Applying published institutional ratings to DepEd SF9 Master Template.
              </div>
            </div>
          ) : previewPdfBlobUrl ? (
            <div style={{ background: '#525659', padding: 12, minHeight: 850 }}>
              <object
                data={`${previewPdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                type="application/pdf"
                id="authentic-sf9-pdf-object"
                style={{
                  width: '100%',
                  height: 850,
                  borderRadius: 8,
                  border: '1px solid #334155',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  display: 'block',
                }}
              >
                <iframe
                  src={`${previewPdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                  title="Calulut SF9 Workbook PDF Preview"
                  style={{
                    width: '100%',
                    height: 850,
                    border: 'none',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ padding: 32, textAlign: 'center', color: '#ffffff', background: '#1e293b' }}>
                    <p style={{ fontSize: 13, marginBottom: 12 }}>Your browser preview is not displaying the embedded PDF directly.</p>
                    <button
                      onClick={handleDownloadUnofficialPdf}
                      style={{
                        padding: '8px 16px',
                        background: '#b45309',
                        color: '#ffffff',
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 12,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Download Calulut SF9 Preview
                    </button>
                  </div>
                </iframe>
              </object>
            </div>
          ) : null}
        </div>
      ) : (
        <>

      {/* ── View Controls Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', fontWeight: 600 }}>
          <FileText size={15} color="#0f766e" />
          <span>DepEd SF9 / Form 138 (Grade 4–10 Master Layout)</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setActivePageView('both')}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: activePageView === 'both' ? 700 : 500,
              background: activePageView === 'both' ? '#0f766e' : '#fff',
              color: activePageView === 'both' ? '#fff' : '#475569',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
            }}
          >
            2-Page Complete View
          </button>
          <button
            onClick={() => setActivePageView('front')}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: activePageView === 'front' ? 700 : 500,
              background: activePageView === 'front' ? '#0f766e' : '#fff',
              color: activePageView === 'front' ? '#fff' : '#475569',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
            }}
          >
            Page 1: Scholastic Record
          </button>
          <button
            onClick={() => setActivePageView('back')}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: activePageView === 'back' ? 700 : 500,
              background: activePageView === 'back' ? '#0f766e' : '#fff',
              color: activePageView === 'back' ? '#fff' : '#475569',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
            }}
          >
            Page 2: Attendance &amp; Certification
          </button>
        </div>
      </div>

      {/* ── Authentic Master Template Document Container ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            activePageView === 'both'
              ? 'repeat(auto-fit, minmax(460px, 1fr))'
              : '1fr',
          gap: 24,
          padding: 24,
          background: '#f1f5f9',
        }}
      >
        {/* ══════════════════════════════════════════════════════════════
            PAGE 1 (LEFT PANEL): SCHOLASTIC RECORD & PERFORMANCE
            ══════════════════════════════════════════════════════════════ */}
        {(activePageView === 'both' || activePageView === 'front') && (
          <div
            style={{
              background: '#fff',
              border: '1.5px solid #0f172a',
              padding: '20px 22px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            {/* DepEd Institutional Header */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: '#1e293b', letterSpacing: '0.04em' }}>
                Republic of the Philippines
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: '#1e293b' }}>
                Department of Education
              </div>
              <div style={{ fontSize: 8.5, color: '#475569', marginTop: 1 }}>
                REGION III · SCHOOLS DIVISION OF CITY OF SAN FERNANDO (P)
              </div>
              <div style={{ fontSize: 8.5, color: '#475569' }}>
                North District · City of San Fernando, Pampanga
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  fontFamily: "'Times New Roman', serif",
                  color: '#0f172a',
                  letterSpacing: '0.04em',
                  marginTop: 6,
                  textTransform: 'uppercase',
                }}
              >
                CALULUT INTEGRATED SCHOOL
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#8B1E1E',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginTop: 3,
                }}
              >
                LEARNER&apos;S PROGRESS REPORT CARD (SF9)
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: '#334155', marginTop: 1 }}>
                {academicYear}
              </div>
            </div>

            {/* Learner Demographics Block */}
            <div
              style={{
                border: '1px solid #94a3b8',
                padding: '8px 12px',
                marginBottom: 14,
                fontSize: 10.5,
                background: '#fafafa',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6, marginBottom: 4 }}>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Name: </span>
                  <strong style={{ color: '#0f172a', textTransform: 'uppercase' }}>{studentName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>LRN: </span>
                  <strong style={{ fontFamily: "'JetBrains Mono',monospace", color: '#0f172a' }}>{studentLrn}</strong>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: 6 }}>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Grade &amp; Section: </span>
                  <strong style={{ color: '#0f172a' }}>Grade {gradeLevel} — {sectionName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Age: </span>
                  <strong style={{ color: '#0f172a' }}>{age}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Sex: </span>
                  <strong style={{ color: '#0f172a' }}>{sex}</strong>
                </div>
              </div>
            </div>

            {/* Scholastic Performance Table */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#0f172a',
                  marginBottom: 4,
                  letterSpacing: '0.02em',
                }}
              >
                REPORT ON LEARNING PROGRESS AND ACHIEVEMENT
              </div>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 10,
                  border: '1px solid #0f172a',
                }}
              >
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #0f172a' }}>
                    <th
                      rowSpan={2}
                      style={{
                        padding: '6px 8px',
                        textAlign: 'left',
                        fontWeight: 800,
                        borderRight: '1px solid #0f172a',
                        width: '46%',
                      }}
                    >
                      Learning Areas
                    </th>
                    <th
                      colSpan={3}
                      style={{
                        padding: '4px',
                        textAlign: 'center',
                        fontWeight: 800,
                        borderRight: '1px solid #0f172a',
                        borderBottom: '1px solid #0f172a',
                      }}
                    >
                      Quarterly Rating (Trimester)
                    </th>
                    <th
                      rowSpan={2}
                      style={{
                        padding: '6px 4px',
                        textAlign: 'center',
                        fontWeight: 800,
                        borderRight: '1px solid #0f172a',
                        width: '14%',
                      }}
                    >
                      Final Grade
                    </th>
                    <th
                      rowSpan={2}
                      style={{
                        padding: '6px 6px',
                        textAlign: 'center',
                        fontWeight: 800,
                        width: '16%',
                      }}
                    >
                      Remarks
                    </th>
                  </tr>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #0f172a' }}>
                    <th style={{ padding: '3px 4px', textAlign: 'center', fontWeight: 700, width: '8%', borderRight: '1px solid #cbd5e1' }}>1</th>
                    <th style={{ padding: '3px 4px', textAlign: 'center', fontWeight: 700, width: '8%', borderRight: '1px solid #cbd5e1' }}>2</th>
                    <th style={{ padding: '3px 4px', textAlign: 'center', fontWeight: 700, width: '8%', borderRight: '1px solid #0f172a' }}>3</th>
                  </tr>
                </thead>
                <tbody>
                  {CANONICAL_JHS_LEARNING_AREAS.map((area, idx) => {
                    if (area.isParent) {
                      // MAPEH Parent + Sub-components
                      const mapehT1 = getSubjectScore('mapeh', 'T1');
                      const mapehT2 = getSubjectScore('mapeh', 'T2');
                      const mapehT3 = getSubjectScore('mapeh', 'T3');
                      const musicT1 = getSubjectScore('music_arts', 'T1');
                      const musicT2 = getSubjectScore('music_arts', 'T2');
                      const musicT3 = getSubjectScore('music_arts', 'T3');
                      const peT1 = getSubjectScore('pe_health', 'T1');
                      const peT2 = getSubjectScore('pe_health', 'T2');
                      const peT3 = getSubjectScore('pe_health', 'T3');

                      // Calculate consolidated MAPEH rating if not explicitly in table
                      const resolvedMapehT1 = mapehT1 ?? (musicT1 && peT1 ? Math.round((musicT1 + peT1) / 2) : null);
                      const resolvedMapehT2 = mapehT2 ?? (musicT2 && peT2 ? Math.round((musicT2 + peT2) / 2) : null);
                      const resolvedMapehT3 = mapehT3 ?? (musicT3 && peT3 ? Math.round((musicT3 + peT3) / 2) : null);

                      const mapehFinal = isAnnualComplete && resolvedMapehT1 && resolvedMapehT2 && resolvedMapehT3
                        ? Math.round((resolvedMapehT1 + resolvedMapehT2 + resolvedMapehT3) / 3)
                        : null;
                      const mapehRemarks = mapehFinal !== null ? (mapehFinal >= 75 ? 'Passed' : 'Failed') : '—';

                      return (
                        <React.Fragment key={area.key}>
                          {/* MAPEH Parent Row */}
                          <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#fafafa', fontWeight: 700 }}>
                            <td style={{ padding: '5px 8px', borderRight: '1px solid #cbd5e1' }}>
                              {area.name}
                            </td>
                            <td style={{ padding: '5px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                              {formatCell(resolvedMapehT1)}
                            </td>
                            <td style={{ padding: '5px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                              {formatCell(resolvedMapehT2)}
                            </td>
                            <td style={{ padding: '5px 4px', textAlign: 'center', borderRight: '1px solid #0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
                              {formatCell(resolvedMapehT3)}
                            </td>
                            <td style={{ padding: '5px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace", fontWeight: 800 }}>
                              {formatCell(mapehFinal)}
                            </td>
                            <td style={{ padding: '5px 6px', textAlign: 'center', fontSize: 9.5 }}>
                              {mapehRemarks}
                            </td>
                          </tr>

                          {/* Music and Arts Sub-row */}
                          <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 9.5 }}>
                            <td style={{ padding: '4px 8px 4px 20px', borderRight: '1px solid #cbd5e1', fontStyle: 'italic' }}>
                              Music and Arts
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                              {formatCell(musicT1)}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                              {formatCell(musicT2)}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
                              {formatCell(musicT3)}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>
                              —
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>
                              —
                            </td>
                          </tr>

                          {/* Physical Education and Health Sub-row */}
                          <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#475569', fontSize: 9.5 }}>
                            <td style={{ padding: '4px 8px 4px 20px', borderRight: '1px solid #cbd5e1', fontStyle: 'italic' }}>
                              Physical Education and Health
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                              {formatCell(peT1)}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                              {formatCell(peT2)}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
                              {formatCell(peT3)}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>
                              —
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>
                              —
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    }

                    // Regular Core Subject Row
                    const t1Score = getSubjectScore(area.key, 'T1');
                    const t2Score = getSubjectScore(area.key, 'T2');
                    const t3Score = getSubjectScore(area.key, 'T3');

                    const finalRating = isAnnualComplete && t1Score && t2Score && t3Score
                      ? Math.round((t1Score + t2Score + t3Score) / 3)
                      : null;
                    const remarks = finalRating !== null ? (finalRating >= 75 ? 'Passed' : 'Failed') : '—';

                    return (
                      <tr
                        key={area.key}
                        style={{
                          borderBottom: '1px solid #cbd5e1',
                          background: idx % 2 === 0 ? '#fff' : '#fcfcfc',
                        }}
                      >
                        <td style={{ padding: '5px 8px', borderRight: '1px solid #cbd5e1', fontWeight: 600 }}>
                          {area.name}
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                          {formatCell(t1Score)}
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                          {formatCell(t2Score)}
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'center', borderRight: '1px solid #0f172a', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                          {formatCell(t3Score)}
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color: '#8B1E1E' }}>
                          {formatCell(finalRating)}
                        </td>
                        <td
                          style={{
                            padding: '5px 6px',
                            textAlign: 'center',
                            fontSize: 9.5,
                            fontWeight: 700,
                            color: remarks === 'Passed' ? '#15803d' : remarks === 'Failed' ? '#b91c1c' : '#64748b',
                          }}
                        >
                          {remarks}
                        </td>
                      </tr>
                    );
                  })}

                  {/* General Average Row */}
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #0f172a', fontWeight: 900 }}>
                    <td style={{ padding: '7px 8px', borderRight: '1px solid #0f172a', textTransform: 'uppercase' }}>
                      General Average
                    </td>
                    <td style={{ padding: '7px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                      —
                    </td>
                    <td style={{ padding: '7px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                      —
                    </td>
                    <td style={{ padding: '7px 4px', textAlign: 'center', borderRight: '1px solid #0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
                      —
                    </td>
                    <td style={{ padding: '7px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8B1E1E' }}>
                      {genAvg !== null ? genAvg : '—'}
                    </td>
                    <td style={{ padding: '7px 6px', textAlign: 'center', fontSize: 9.5, color: genAvg !== null ? (genAvg >= 75 ? '#15803d' : '#b91c1c') : '#64748b' }}>
                      {genAvg !== null ? (genAvg >= 75 ? 'Passed' : 'Failed') : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Performance Descriptors Table (DepEd Order No. 8, s. 2015) */}
            <div style={{ border: '1px solid #0f172a', marginTop: 12 }}>
              <div
                style={{
                  background: '#f1f5f9',
                  padding: '4px 8px',
                  fontWeight: 800,
                  fontSize: 9,
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #0f172a',
                  textAlign: 'center',
                }}
              >
                PERFORMANCE DESCRIPTORS
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid #cbd5e1', width: '30%' }}>Grading Scale</th>
                    <th style={{ padding: '3px 6px', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '45%' }}>Descriptors</th>
                    <th style={{ padding: '3px 6px', textAlign: 'center', width: '25%' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {PERFORMANCE_DESCRIPTORS.map((d, i) => (
                    <tr key={i} style={{ borderBottom: i < PERFORMANCE_DESCRIPTORS.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                      <td style={{ padding: '2px 6px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                        {d.scale}
                      </td>
                      <td style={{ padding: '2px 6px', borderRight: '1px solid #cbd5e1' }}>
                        {d.descriptor}
                      </td>
                      <td style={{ padding: '2px 6px', textAlign: 'center', fontWeight: 600 }}>
                        {d.remarks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PAGE 2 (RIGHT PANEL): ATTENDANCE, COMMENTS & TRANSFER
            ══════════════════════════════════════════════════════════════ */}
        {(activePageView === 'both' || activePageView === 'back') && (
          <div
            style={{
              background: '#fff',
              border: '1.5px solid #0f172a',
              padding: '20px 22px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            {/* Attendance Record Summary (11 Months + Total) */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#0f172a',
                  marginBottom: 4,
                  letterSpacing: '0.02em',
                }}
              >
                REPORT ON ATTENDANCE (SF2 SUMMARY)
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 8.5,
                    border: '1px solid #0f172a',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #0f172a' }}>
                      <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 800, borderRight: '1px solid #0f172a', minWidth: 90 }}>
                        Month
                      </th>
                      {MONTH_NAMES.map((m, idx) => (
                        <th
                          key={m}
                          style={{
                            padding: '4px 2px',
                            textAlign: 'center',
                            fontWeight: 700,
                            borderRight: idx === MONTH_NAMES.length - 1 ? 'none' : '1px solid #cbd5e1',
                            background: m === 'Total' ? '#e2e8f0' : undefined,
                          }}
                        >
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: No. of Class Days */}
                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 600, borderRight: '1px solid #0f172a' }}>
                        No. of Class Days
                      </td>
                      {standardClassDays.map((cd, idx) => (
                        <td key={idx} style={{ padding: '4px 2px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                          {cd}
                        </td>
                      ))}
                      <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 800, background: '#f8fafc', fontFamily: "'JetBrains Mono',monospace" }}>
                        {totalClassDaysVal}
                      </td>
                    </tr>

                    {/* Row 2: No. of Days Present */}
                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 600, borderRight: '1px solid #0f172a', color: '#15803d' }}>
                        No. of Days Present
                      </td>
                      {standardClassDays.map((_, idx) => (
                        <td key={idx} style={{ padding: '4px 2px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                          {formatAttCell(idx, true)}
                        </td>
                      ))}
                      <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 800, background: '#f8fafc', fontFamily: "'JetBrains Mono',monospace", color: '#15803d' }}>
                        {totalPresentVal}
                      </td>
                    </tr>

                    {/* Row 3: No. of Days Absent */}
                    <tr>
                      <td style={{ padding: '4px 6px', fontWeight: 600, borderRight: '1px solid #0f172a', color: '#b91c1c' }}>
                        No. of Days Absent
                      </td>
                      {standardClassDays.map((_, idx) => (
                        <td key={idx} style={{ padding: '4px 2px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono',monospace" }}>
                          {formatAttCell(idx, false)}
                        </td>
                      ))}
                      <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 800, background: '#f8fafc', fontFamily: "'JetBrains Mono',monospace", color: '#b91c1c' }}>
                        {totalAbsentVal}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Teacher's Comments / Remarks (Trimester System) */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#0f172a',
                  marginBottom: 6,
                  letterSpacing: '0.02em',
                }}
              >
                TEACHER&apos;S COMMENTS / REMARKS
              </div>

              {/* Term 1 Box */}
              <div style={{ border: '1px solid #94a3b8', borderRadius: 4, padding: '6px 10px', marginBottom: 8, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 3, marginBottom: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#0f172a' }}>Term 1</span>
                  <span style={{ fontSize: 8.5, color: '#64748b' }}>Adviser: {classAdviser}</span>
                </div>
                <div style={{ fontSize: 9.5, color: '#1e293b', fontStyle: t1Comment !== '—' ? 'normal' : 'italic', minHeight: 28, lineHeight: 1.4 }}>
                  {t1Comment}
                </div>
                <div style={{ textAlign: 'right', marginTop: 4 }}>
                  <span style={{ fontSize: 8.5, borderTop: '1px dotted #94a3b8', paddingTop: 1, color: '#475569' }}>
                    Signature of Class Adviser
                  </span>
                </div>
              </div>

              {/* Term 2 Box */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '6px 10px', marginBottom: 8, background: '#fcfcfc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 3, marginBottom: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>Term 2</span>
                  <span style={{ fontSize: 8.5, color: '#94a3b8' }}>Adviser: {classAdviser}</span>
                </div>
                <div style={{ fontSize: 9.5, color: '#64748b', fontStyle: 'italic', minHeight: 24, lineHeight: 1.4 }}>
                  {t2Comment}
                </div>
                <div style={{ textAlign: 'right', marginTop: 4 }}>
                  <span style={{ fontSize: 8.5, borderTop: '1px dotted #cbd5e1', paddingTop: 1, color: '#94a3b8' }}>
                    Signature of Class Adviser
                  </span>
                </div>
              </div>

              {/* Term 3 Box */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '6px 10px', background: '#fcfcfc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 3, marginBottom: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>Term 3</span>
                  <span style={{ fontSize: 8.5, color: '#94a3b8' }}>Adviser: {classAdviser}</span>
                </div>
                <div style={{ fontSize: 9.5, color: '#64748b', fontStyle: 'italic', minHeight: 24, lineHeight: 1.4 }}>
                  {t3Comment}
                </div>
                <div style={{ textAlign: 'right', marginTop: 4 }}>
                  <span style={{ fontSize: 8.5, borderTop: '1px dotted #cbd5e1', paddingTop: 1, color: '#94a3b8' }}>
                    Signature of Class Adviser
                  </span>
                </div>
              </div>
            </div>

            {/* Certificate of Transfer */}
            <div style={{ border: '1px solid #0f172a', padding: '10px 14px', marginBottom: 12, background: '#fff' }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: '#0f172a',
                  textAlign: 'center',
                  marginBottom: 6,
                  letterSpacing: '0.04em',
                }}
              >
                CERTIFICATE OF TRANSFER
              </div>
              <div style={{ fontSize: 9, color: '#334155', lineHeight: 1.4, marginBottom: 8 }}>
                This is to certify that the above-named learner has satisfactorily completed the requirements for the grade level indicated.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 9, marginBottom: 12 }}>
                <div>
                  <span style={{ color: '#64748b' }}>Admitted to Grade: </span>
                  <strong style={{ color: '#0f172a' }}>Grade {gradeLevel}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Eligible for Admission to: </span>
                  <strong style={{ color: isAnnualComplete ? '#15803d' : '#94a3b8' }}>
                    {isAnnualComplete ? `Grade ${gradeLevel + 1}` : '—'}
                  </strong>
                </div>
              </div>

              {/* Signatories Dual Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, textAlign: 'center', marginTop: 10 }}>
                <div>
                  <div style={{ height: 18 }} />
                  <div style={{ borderTop: '1px solid #0f172a', paddingTop: 3, fontWeight: 800, fontSize: 9.5, color: '#0f172a' }}>
                    {classAdviser}
                  </div>
                  <div style={{ fontSize: 8.5, color: '#64748b' }}>Class Adviser</div>
                </div>
                <div>
                  <div style={{ height: 18 }} />
                  <div style={{ borderTop: '1px solid #0f172a', paddingTop: 3, fontWeight: 800, fontSize: 9.5, color: '#0f172a' }}>
                    {schoolPrincipal}
                  </div>
                  <div style={{ fontSize: 8.5, color: '#64748b' }}>School Head / Principal IV</div>
                </div>
              </div>
            </div>

            {/* Cancellation of Eligibility to Transfer */}
            <div style={{ border: '1px solid #cbd5e1', padding: '8px 12px', background: '#fafafa' }}>
              <div
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#475569',
                  textAlign: 'center',
                  marginBottom: 4,
                }}
              >
                CANCELLATION OF ELIGIBILITY TO TRANSFER
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8, fontSize: 8.5, color: '#64748b', marginBottom: 6 }}>
                <div>
                  <span>Admitted in: </span>
                  <span style={{ borderBottom: '1px solid #cbd5e1', padding: '0 20px' }}>—</span>
                </div>
                <div>
                  <span>Date: </span>
                  <span style={{ borderBottom: '1px solid #cbd5e1', padding: '0 20px' }}>—</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <span style={{ borderTop: '1px solid #cbd5e1', paddingTop: 2, fontSize: 8, color: '#64748b', display: 'inline-block', width: '60%' }}>
                  School Head Signature
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )}
</div>
  );
}
