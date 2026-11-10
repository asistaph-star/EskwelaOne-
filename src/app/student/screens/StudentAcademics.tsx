import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../shared/constants/tokens';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck, Download,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope, ExternalLink, Printer, ShieldCheck, History, Award } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';
import { apiClient, API_BASE_URL } from '../../../api/client';
import { studentApi } from '../../../api/student.api';

import { AuthenticCalulutSf9Viewer } from '../../shared/components/AuthenticCalulutSf9Viewer';
import { DigitalAuthenticSf9ProgressCard } from '../components/DigitalAuthenticSf9ProgressCard';
import { Form138PDFDocument } from '../components/Form138PDFDocument';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { getStudentRankAndStanding, getStudentRecentQuizzes, getStudentSubjectGrades } from '../../shared/utils/gradesService';
import { useSchoolSettings } from '../../shared/context/SchoolSettingsContext';
import { useAppContext } from '../../shared/AppContext';
import { SchoolYearSelector, AcademicYearOption } from '../../shared/components/SchoolYearSelector';
import { ReadOnlyBanner } from '../../shared/components/ReadOnlyBanner';


export function StudentAcademics({ setTab, currentUser }: any) {
  const { settings } = useSchoolSettings();
  const { currentUser: appUser } = useAppContext();
  const effectiveUser = currentUser || appUser;
  const studentId = effectiveUser?.studentProfile?.id || effectiveUser?.id;
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfToast, setPdfToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [reportCardData, setReportCardData] = useState<any>(null);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [releasedSf9, setReleasedSf9] = useState<{
    released: boolean;
    status: string;
    message?: string;
    academicYear?: string;
    reportingPeriod?: string;
    releaseDate?: string;
    adviser?: string;
    principal?: string;
    pdfSha256?: string;
    canDownload?: boolean;
    targetTerm?: string;
    version?: number;
    history?: any[];
  } | null>(null);
  const [isLoadingRelease, setIsLoadingRelease] = useState(true);
  const [showReleasedPdfModal, setShowReleasedPdfModal] = useState(false);
  const [releasedPdfBlobUrl, setReleasedPdfBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  // Multi-Year Grades History State
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [isLoadingYears, setIsLoadingYears] = useState(false);

  // Load available academic years for the student
  useEffect(() => {
    if (!studentId) return;
    setIsLoadingYears(true);
    studentApi.getStudentAcademicYears(studentId)
      .then((years: any) => {
        if (Array.isArray(years) && years.length > 0) {
          setAcademicYears(years);
          const currentYear = years.find((y: any) => y.isCurrent) || years[0];
          setSelectedAcademicYearId(currentYear.academicYearId);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch student academic years:', err);
      })
      .finally(() => setIsLoadingYears(false));
  }, [studentId]);

  useEffect(() => {
    return () => {
      if (releasedPdfBlobUrl) {
        URL.revokeObjectURL(releasedPdfBlobUrl);
      }
    };
  }, [releasedPdfBlobUrl]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && showReleasedPdfModal) {
        setShowReleasedPdfModal(false);
        setPdfLoadError(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showReleasedPdfModal]);

  function handlePrintPdf() {
    if (!releasedPdfBlobUrl) return;
    const printWindow = window.open(releasedPdfBlobUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  }

  useEffect(() => {
    if (!studentId) return;
    setIsLoadingGrades(true);
    const ayParam = selectedAcademicYearId ? `?academicYearId=${encodeURIComponent(selectedAcademicYearId)}` : '';

    apiClient.get(`/academic/report-card/${studentId}${ayParam}`)
      .then((res: any) => {
        if (res) setReportCardData(res);
      })
      .catch((err) => {
        console.warn('Could not fetch official report card from backend:', err);
      })
      .finally(() => setIsLoadingGrades(false));

    setIsLoadingRelease(true);
    apiClient.get<any>(`/academic/report-card/student/released-sf9${ayParam}`)
      .then((res: any) => {
        const data = res?.data || res;
        setReleasedSf9(data);
      })
      .catch((err) => {
        console.warn('Could not fetch student released SF9 metadata:', err);
        setReleasedSf9({
          released: false,
          status: 'PENDING_EVALUATION',
          message: 'Official report card has not yet been released.',
        });
      })
      .finally(() => setIsLoadingRelease(false));
  }, [studentId, selectedAcademicYearId]);

  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  async function handleViewReleasedPdf(versionToLoad?: number) {
    setIsLoadingPdf(true);
    setPdfLoadError(null);
    setShowReleasedPdfModal(true);
    try {
      const ver = typeof versionToLoad === 'number' ? versionToLoad : selectedVersion;
      const params = new URLSearchParams();
      if (ver) params.set('version', String(ver));
      if (selectedAcademicYearId) params.set('academicYearId', selectedAcademicYearId);
      const queryString = params.toString() ? `?${params.toString()}` : '';

      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const resp = await fetch(`${API_BASE_URL}/academic/report-card/student/released-sf9/pdf${queryString}`, {
        credentials: 'include',
        headers,
      });
      const contentType = resp.headers.get('content-type') || '';
      if (!resp.ok || (!contentType.includes('pdf') && !contentType.includes('octet-stream'))) {
        const errJson = await resp.json().catch(() => null);
        throw new Error(errJson?.message || errJson?.error?.message || `Failed to load released report card (HTTP ${resp.status})`);
      }
      const rawBlob = await resp.blob();
      const pdfBlob = rawBlob.type === 'application/pdf' ? rawBlob : new Blob([await rawBlob.arrayBuffer()], { type: 'application/pdf' });
      if (releasedPdfBlobUrl) {
        URL.revokeObjectURL(releasedPdfBlobUrl);
      }
      const url = URL.createObjectURL(pdfBlob);
      setReleasedPdfBlobUrl(url);
    } catch (err: any) {
      console.error('Failed to view released SF9:', err);
      setPdfLoadError(err.message || 'Failed to open released report card.');
      setPdfToast({ message: err.message || 'Failed to open released report card.', type: 'error' });
    } finally {
      setIsLoadingPdf(false);
    }
  }

  async function handleDownloadReleasedPdf(versionToDownload?: number) {
    setIsLoadingPdf(true);
    try {
      const ver = typeof versionToDownload === 'number' ? versionToDownload : selectedVersion;
      const versionParam = ver ? `?version=${ver}` : '';
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const resp = await fetch(`${API_BASE_URL}/academic/report-card/student/released-sf9/pdf${versionParam}`, {
        credentials: 'include',
        headers,
      });
      const contentType = resp.headers.get('content-type') || '';
      if (!resp.ok || (!contentType.includes('pdf') && !contentType.includes('octet-stream'))) {
        const errJson = await resp.json().catch(() => null);
        throw new Error(errJson?.message || errJson?.error?.message || `Failed to download report card (HTTP ${resp.status})`);
      }
      const rawBlob = await resp.blob();
      const pdfBlob = rawBlob.type === 'application/pdf' ? rawBlob : new Blob([await rawBlob.arrayBuffer()], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      const termLabel = releasedSf9?.targetTerm || (releasedSf9 as any)?.reportingPeriod || 'Official';
      const cleanTermLabel = String(termLabel).replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Calulut_SF9_${reportCardData?.student?.lrn || effectiveUser?.schoolId || 'Learner'}_${cleanTermLabel}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPdfToast({ message: 'Official SF9 PDF downloaded successfully.', type: 'success' });
    } catch (err: any) {
      console.error('Failed to download released SF9:', err);
      setPdfToast({ message: err.message || 'Download failed.', type: 'error' });
    } finally {
      setIsLoadingPdf(false);
    }
  }

  const realSubjectGrades = useMemo(() => {
    if (reportCardData?.scholastic?.subjects && reportCardData.scholastic.subjects.length > 0) {
      return reportCardData.scholastic.subjects.map((s: any) => ({
        name: s.name,
        short: s.name.length > 12 ? s.name.substring(0, 10) + '..' : s.name,
        classId: s.id,
        term1: s.T1 ?? null,
        term2: s.T2 ?? null,
        term3: s.T3 ?? null,
        term4: s.T4 ?? null,
      }));
    }
    return [];
  }, [reportCardData]);

  const realRecentQuizzes: any[] = [];

  const currentGrade10Avg = useMemo<number | null>(() => {
    // Strictly prefer authoritative backend General Average; never compute an unverified partial average
    if (typeof reportCardData?.scholastic?.generalAverage === 'number') {
      return reportCardData.scholastic.generalAverage;
    }
    return null;
  }, [reportCardData]);

  const standingInfo = useMemo(() => getStudentRankAndStanding(currentGrade10Avg ?? 0), [currentGrade10Avg]);

  async function handleExportPDF() {
    setIsExportingPDF(true);
    setPdfToast(null);
    try {
      const studentForPdf = reportCardData?.student ? {
        name: reportCardData.student.name,
        lrn: reportCardData.student.lrn,
        grade: reportCardData.enrollment?.gradeLevel || effectiveUser?.grade || 10,
        section: reportCardData.enrollment?.section || effectiveUser?.studentProfile?.sectionName || effectiveUser?.section || 'Advisory',
        adviser: reportCardData.adviser || effectiveUser?.studentProfile?.adviserName || 'Class Adviser',
        gender: reportCardData.student.gender || 'Unknown'
      } : effectiveUser;

      const blob = await pdf(<Form138PDFDocument student={studentForPdf} subjects={realSubjectGrades} schoolName={settings.schoolName} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ReportCard_${currentUser?.name || "Student"}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setPdfToast({ message: "PDF Downloaded Successfully!", type: "success" });
    } catch (err) {
      console.error(err);
      setPdfToast({ message: "Failed to generate PDF. Please try again.", type: "error" });
    } finally {
      setIsExportingPDF(false);
      setTimeout(() => setPdfToast(null), 4000);
    }
  }

  const realGradeTrendData = useMemo(() => {
    const configuredTerms: string[] = reportCardData?.scholastic?.configuredTerms || ['T1', 'T2', 'T3'];
    return configuredTerms.map((termKey) => {
      const field = termKey === 'T1' ? 'term1' : termKey === 'T2' ? 'term2' : termKey === 'T3' ? 'term3' : 'term4';
      const termLabel = termKey === 'T1' ? 'Term 1' : termKey === 'T2' ? 'Term 2' : termKey === 'T3' ? 'Term 3' : 'Term 4';
      const vals = realSubjectGrades
        .map(s => (s as any)[field])
        .filter((t): t is number => typeof t === 'number' && t > 0);
      return {
        name: termLabel,
        avg: vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      };
    });
  }, [realSubjectGrades, reportCardData]);

  const selectedYearOption = academicYears.find(y => y.academicYearId === selectedAcademicYearId);
  const currentYearOption = academicYears.find(y => y.isCurrent);
  const isHistoricalYear = selectedYearOption ? !selectedYearOption.isCurrent : Boolean(reportCardData?.school?.isHistorical);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
              <style dangerouslySetInnerHTML={{ __html: `
                @page {
                  size: letter portrait;
                  margin: 0.4in;
                }

                @media print {
                  html, body, #root, #root > div, .watermark-bg {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    overflow: visible !important;
                    display: block !important;
                    background: #fff !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }

                  body * { visibility: hidden !important; }

                  .no-print {
                    display: none !important;
                  }

                  #form138-print-root, #form138-print-root * { 
                    visibility: visible !important; 
                  }

                  @page {
                    size: portrait;
                    margin: 0.5in;
                  }

                  #form138-print-root {
                    display: block !important;
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    position: static !important;
                    box-sizing: border-box !important;
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    background: #fff !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }

                  /* Force text wrapping to prevent inline nowrap from forcing table width > page width */
                  #form138-print-root * {
                    white-space: normal !important;
                  }

                  #form138-print-root table {
                    width: 100% !important;
                    table-layout: fixed !important;
                    font-size: 8.5pt !important;
                  }

                  #form138-print-root table th,
                  #form138-print-root table td {
                    padding: 4px 6px !important;
                    word-wrap: break-word !important;
                  }
                }
              ` }} />

              <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Grades and Report Card (SF9)</h1>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Official DepEd scholastic records and SF9 (Form 138) progress reports for Calulut Integrated School.</div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Current SY:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      {currentYearOption?.academicYearName || reportCardData?.school?.academicYear || "SY 2026–2027"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "#ecfdf5", padding: "1px 6px", borderRadius: 4, border: "1px solid #a7f3d0" }}>Active</span>
                  </div>

                  {setTab && (
                    <button
                      onClick={() => setTab("academic-history")}
                      id="btn-goto-academic-history"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.navy,
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: 8,
                        padding: "7px 12px",
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                      title="View previous school years, past grades, and historical attendance"
                    >
                      <History size={13} color={C.navy} />
                      <span>Academic History</span>
                    </button>
                  )}
                  
                  {/* Toast Notification */}
                  {pdfToast && (
                    <div style={{ 
                      padding: "8px 12px", 
                      borderRadius: 6, 
                      fontSize: 11, 
                      fontWeight: 600,
                      background: pdfToast.type === 'success' ? C.greenBg : C.redBg,
                      color: pdfToast.type === 'success' ? C.green : C.red,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}>
                      {pdfToast.type === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                      {pdfToast.message}
                    </div>
                  )}

                  <button 
                    onClick={handleExportPDF} 
                    disabled={isExportingPDF}
                    style={{ 
                      display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, 
                      color: "#fff", background: isExportingPDF ? C.t3 : C.m700, 
                      border: "none", borderRadius: 8, padding: "8px 16px", cursor: isExportingPDF ? "not-allowed" : "pointer", 
                      transition: "all 0.15s" 
                    }}
                  >
                    {isExportingPDF ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13}/>}
                    {isExportingPDF ? "Generating..." : "Download Portal Summary (PDF)"}
                  </button>
                </div>
              </div>

              {/* Official DepEd Academic Outcome Banner (Principal Confirmed Promotion / JHS Completion) */}
              {!isHistoricalYear && reportCardData?.promotionApproval?.isApproved && (
                <div
                  id="academic-outcome-banner"
                  className="no-print"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: reportCardData.promotionApproval.approvedOutcome === 'COMPLETED' ? "#eff6ff" : "#f0fdf4",
                    border: `1px solid ${reportCardData.promotionApproval.approvedOutcome === 'COMPLETED' ? "#bfdbfe" : "#bbf7d0"}`,
                    borderRadius: 10,
                    gap: 16,
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: reportCardData.promotionApproval.approvedOutcome === 'COMPLETED' ? "#dbeafe" : "#dcfce7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: reportCardData.promotionApproval.approvedOutcome === 'COMPLETED' ? "#1d4ed8" : "#15803d",
                        flexShrink: 0
                      }}
                    >
                      <Award size={18} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                          {reportCardData.promotionApproval.approvedOutcome === 'COMPLETED'
                            ? "Junior High School Completion Confirmed"
                            : `Promotion to Grade ${reportCardData.promotionApproval.targetGradeLevel || ((reportCardData.enrollment?.gradeLevel || 7) + 1)} Approved`}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            background: reportCardData.promotionApproval.approvedOutcome === 'COMPLETED' ? "#1e40af" : "#166534",
                            color: "#fff",
                            letterSpacing: "0.02em"
                          }}
                        >
                          {reportCardData.promotionApproval.approvedOutcome === 'COMPLETED'
                            ? "JHS Completer"
                            : "Promoted"}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                        Confirmed by School Principal: <strong style={{ color: "#1e293b" }}>{reportCardData.promotionApproval.approvedByName || "School Principal"}</strong>
                        {reportCardData.promotionApproval.approvedAt && (
                          <span> on {new Date(reportCardData.promotionApproval.approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        )}
                        <span> &middot; DepEd Order No. 8, s. 2015</span>
                      </div>
                    </div>
                  </div>
                  {reportCardData.promotionApproval.approvedOutcome === 'COMPLETED' && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1e40af", background: "#dbeafe", padding: "4px 10px", borderRadius: 6, border: "1px solid #bfdbfe" }}>
                      Calulut Integrated School &bull; Junior High School Completer
                    </div>
                  )}
                </div>
              )}

              {/* Historical Year Read-Only Banner */}
              {isHistoricalYear && (
                <ReadOnlyBanner
                  yearName={selectedYearOption?.academicYearName || reportCardData?.school?.academicYear}
                  recordType="grades"
                  onReturnToCurrent={currentYearOption ? () => setSelectedAcademicYearId(currentYearOption.academicYearId) : undefined}
                />
              )}

              {/* Digital Authentic Calulut SF9 Form 138 Progress Card */}
              <div id="form138-print-root">
                <DigitalAuthenticSf9ProgressCard
                  reportCardData={reportCardData}
                  releasedSf9={releasedSf9}
                  onViewPdf={() => handleViewReleasedPdf()}
                  onDownloadPdf={() => handleDownloadReleasedPdf()}
                  isLoadingPdf={isLoadingPdf}
                />
              </div>

              {/* Historical Released Versions (when released) */}
              {releasedSf9?.released && releasedSf9?.history && releasedSf9.history.length > 1 && (
                <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700">Released Versions:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {releasedSf9.history.map((h: any) => (
                      <button
                        key={h.issuanceId}
                        type="button"
                        onClick={() => {
                          setSelectedVersion(h.version);
                          handleViewReleasedPdf(h.version);
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-all border ${
                          (selectedVersion === h.version || (!selectedVersion && h.isCurrent))
                            ? 'bg-emerald-700 text-white border-emerald-800'
                            : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        {h.reportingPeriod} (v{h.version})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal for viewing released authentic PDF - Rendered via createPortal directly into document.body to prevent parent z-index clipping */}
              {showReleasedPdfModal && typeof document !== 'undefined' && createPortal(
                <div
                  className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="sf9-modal-title"
                >
                  <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden border border-slate-700/80 animate-in zoom-in-95 duration-200 ring-1 ring-white/10">
                    {/* Primary Header */}
                    <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 gap-4 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-sm">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span id="sf9-modal-title" className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                              Official SF9 Form 138 &middot; {reportCardData?.student?.name || effectiveUser?.name || 'Learner Progress Report Card'}
                            </span>
                            {(releasedSf9?.reportingPeriod || (releasedSf9 as any)?.targetTerm) && (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold shrink-0">
                                {releasedSf9.reportingPeriod || (releasedSf9 as any).targetTerm}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>Calulut Integrated School &middot; DepEd Region III</span>
                            <span className="text-slate-600">&bull;</span>
                            <span>LRN: <strong className="text-slate-300 font-mono">{reportCardData?.student?.lrn || effectiveUser?.schoolId || '999026000004'}</strong></span>
                            <span className="text-slate-600">&bull;</span>
                            <span>Section: <strong className="text-slate-300">{effectiveUser?.studentProfile?.sectionName || effectiveUser?.section || 'Grade 10, Section Rizal'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-2 shrink-0 ml-auto">
                        {releasedPdfBlobUrl && !isLoadingPdf && !pdfLoadError && (
                          <>
                            <a
                              href={releasedPdfBlobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all border border-slate-700 shadow-sm"
                              title="Open PDF in new browser tab"
                            >
                              <ExternalLink size={13} />
                              <span className="hidden md:inline">Open in Tab</span>
                            </a>
                            <button
                              type="button"
                              onClick={handlePrintPdf}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all border border-slate-700 shadow-sm"
                              title="Print Report Card"
                            >
                              <Printer size={13} />
                              <span className="hidden md:inline">Print</span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadReleasedPdf()}
                          disabled={isLoadingPdf || !releasedSf9?.released}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all disabled:opacity-50"
                        >
                          <Download size={13} />
                          <span>Download PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowReleasedPdfModal(false);
                            setPdfLoadError(null);
                          }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all ml-1"
                          aria-label="Close SF9 viewer"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Secondary Verification Sub-bar */}
                    <div className="px-5 py-2 bg-slate-950/70 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between gap-4 flex-wrap shrink-0">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <ShieldCheck size={14} />
                          Authoritative DepEd Form 138
                        </span>
                        <span className="text-slate-600">|</span>
                        <span>Class Adviser: <strong className="text-slate-300 font-medium">{releasedSf9?.adviser || reportCardData?.adviser || 'Maria Corazon G. Alcantara'}</strong></span>
                        <span className="text-slate-600">|</span>
                        <span>School Head: <strong className="text-slate-300 font-medium">{releasedSf9?.principal || 'Dr. Eduardo M. Santos, Ed.D.'}</strong></span>
                      </div>
                      {releasedSf9?.pdfSha256 && (
                        <div className="text-[10.5px] font-mono text-slate-400">
                          Digital Seal: <span className="text-emerald-400">{releasedSf9.pdfSha256.substring(0, 18)}...</span>
                        </div>
                      )}
                    </div>

                    {/* Document Stage Body */}
                    <div className="flex-1 bg-[#3a3d40] p-1 sm:p-2 flex flex-col items-center justify-center overflow-hidden relative">
                      {isLoadingPdf ? (
                        <div className="flex flex-col items-center justify-center gap-3 p-8 text-white">
                          <RefreshCw size={34} className="animate-spin text-indigo-400" />
                          <p className="text-sm font-semibold tracking-wide">Retrieving Official Form 138...</p>
                          <p className="text-xs text-slate-400">Verifying digital seal and cryptographic signature</p>
                        </div>
                      ) : pdfLoadError ? (
                        <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center border border-slate-200">
                          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle size={24} />
                          </div>
                          <h4 className="font-bold text-slate-900 text-base mb-1.5">Unable to Display Report Card</h4>
                          <p className="text-xs text-slate-600 mb-5 leading-relaxed">{pdfLoadError}</p>
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => handleViewReleasedPdf()}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                            >
                              Retry
                            </button>
                            <button
                              onClick={() => {
                                setShowReleasedPdfModal(false);
                                setPdfLoadError(null);
                              }}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      ) : releasedPdfBlobUrl ? (
                        <object
                          data={`${releasedPdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                          type="application/pdf"
                          className="w-full h-full rounded-xl border border-slate-700/60 bg-[#525659] shadow-inner"
                        >
                          <iframe
                            src={`${releasedPdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                            title="Authentic Calulut SF9 PDF"
                            className="w-full h-full rounded-xl border border-slate-700/60 bg-[#525659]"
                          >
                            <div className="p-8 text-center text-white bg-slate-900 h-full flex flex-col items-center justify-center gap-3">
                              <p className="text-sm font-medium">Your browser preview is not displaying the embedded PDF.</p>
                              <a
                                href={releasedPdfBlobUrl}
                                download={`Calulut_SF9_${reportCardData?.student?.lrn || 'Learner'}.pdf`}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition-all inline-flex items-center gap-2"
                              >
                                <Download size={14} />
                                Download SF9 Document
                              </a>
                            </div>
                          </iframe>
                        </object>
                      ) : (
                        <div className="text-slate-400 text-xs">No document loaded.</div>
                      )}
                    </div>

                    {/* Footer Quick Status Bar */}
                    <div className="px-5 py-2 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>DepEd Form 138 Official Release &middot; Learner Progress Report &amp; Attendance</span>
                      </div>
                      <div className="text-slate-500 text-[10.5px]">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">Esc</kbd> to close
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )}

              <div className="no-print grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Visual Grade Trend line chart per year level */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 16 }}>Grade Averages Trend</div>
                  <div style={{ height: 170 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={realGradeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" stroke={C.t3} fontSize={10.5} tickLine={false} axisLine={false} />
                        <YAxis domain={[75, 100]} stroke={C.t3} fontSize={10.5} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.borderMed}` }} formatter={(val: number) => [`${val.toFixed(1)}%`, "Average"]} />
                        <Line type="monotone" dataKey="avg" stroke={C.m700} strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 4, stroke: C.m700, strokeWidth: 2, fill: "#fff" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Standing & Class rank metrics */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Academic Standing Details</div>
                  <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.t1 }}>Class Ranking</div>
                        <div style={{ fontSize: 10.5, color: C.t3, marginTop: 2 }}>Out of {standingInfo.totalStudents} enrolled students in Section {effectiveUser?.studentProfile?.sectionName || effectiveUser?.section || 'Advisory'}</div>
                      </div>
                      <Stamp label={`Rank ${standingInfo.rank}`} color={C.gold} bg={C.goldLight} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.t1 }}>Academic Track Recommendation</div>
                        <div style={{ fontSize: 10.5, color: C.t3, marginTop: 2 }}>Suggested path for senior high enrolment (Current GPA: {currentGrade10Avg !== null ? currentGrade10Avg.toFixed(1) : 'Pending Year-End Completion'})</div>
                      </div>
                      <Stamp label={standingInfo.track} color={C.blue} bg={C.blueBg} />
                    </div>
                  </div>
                </div>
                
                {/* Quiz Grades Details */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 12, gridColumn: "span 2", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Recent Quiz Performance</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ padding: "20px 24px" }}>
                    {realRecentQuizzes.map((qz, idx) => (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 10, borderBottom: `1px dashed ${C.borderMed}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{qz.s} &middot; <span style={{ color: C.t2, fontWeight: 600 }}>{qz.q}</span></span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.m700 }}>{qz.score}</span>
                        </div>
                        <div style={{ width: "100%", height: 6, background: C.borderMed, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${qz.pct}%`, height: "100%", background: C.m700, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                    {realRecentQuizzes.length === 0 && (
                      <div style={{ gridColumn: "span 2", textAlign: "center", fontSize: 11.5, color: C.t3, padding: 20 }}>
                        No quiz items recorded in active gradebooks yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
  );
}
