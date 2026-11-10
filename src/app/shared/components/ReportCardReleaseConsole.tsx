import React, { useState, useEffect, useCallback } from 'react';
import { C } from '../constants/tokens';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  ChevronDown,
  Sparkles,
  Info,
  Calendar,
  X,
} from 'lucide-react';
import { apiClient } from '../../../api/client';
import { AuthenticCalulutSf9Viewer } from './AuthenticCalulutSf9Viewer';
import { ModernConfirmModal } from './ModernConfirmModal';
import { ModernToast, ToastMessage } from './ModernToast';
import { StudentGradeVisibilityCard } from './StudentGradeVisibilityCard';

export interface ReportCardReleaseConsoleProps {
  portal?: 'Principal' | 'Registrar' | 'Teacher' | 'Admin';
  initialSectionId?: string;
  onBack?: () => void;
}

export function ReportCardReleaseConsole({
  portal = 'Principal',
  initialSectionId,
  onBack,
}: ReportCardReleaseConsoleProps) {
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(initialSectionId || '');
  const [loadingSections, setLoadingSections] = useState<boolean>(true);

  const [overview, setOverview] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'eligible' | 'incomplete' | 'unissued' | 'issued' | 'released'>('all');

  // Viewer state
  const [selectedStudentForViewer, setSelectedStudentForViewer] = useState<any | null>(null);

  // Modals & Action States
  const [actionStudent, setActionStudent] = useState<any | null>(null);
  const [showIssueModal, setShowIssueModal] = useState<boolean>(false);
  const [showReleaseModal, setShowReleaseModal] = useState<boolean>(false);
  const [showBatchReleaseModal, setShowBatchReleaseModal] = useState<boolean>(false);
  const [showBatchIssueModal, setShowBatchIssueModal] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<any | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<'T1' | 'T2' | 'T3'>('T1');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ id: Date.now(), message, type });
  };

  const parseBlocker = (reason: string): { label: string; bg: string; color: string; border: string } => {
    if (/incomplete_missing_attendance|attendance|month/i.test(reason)) {
      const match = reason.match(/Month\s+([A-Za-z]+)/i);
      const month = match ? match[1] : 'SF2';
      return {
        label: `Missing SF2: ${month}`,
        bg: '#fef3c7',
        color: '#92400e',
        border: '#fde68a',
      };
    }
    if (/adviser_comment/i.test(reason)) {
      return {
        label: 'Missing Adviser Comment (T1)',
        bg: '#fef3c7',
        color: '#92400e',
        border: '#fde68a',
      };
    }
    if (/hollow_gradebook/i.test(reason)) {
      const parts = reason.split(':');
      const subj = parts[1] ? parts[1].toUpperCase() : 'Subject';
      return {
        label: `Hollow Gradebook: ${subj}`,
        bg: '#fee2e2',
        color: '#991b1b',
        border: '#fca5a5',
      };
    }
    if (/missing_subject_grade|unauthorized_or_missing/i.test(reason)) {
      const parts = reason.split(':');
      const subj = parts[1] ? parts[1].toUpperCase() : 'Grade';
      return {
        label: `Missing Grade: ${subj}`,
        bg: '#fee2e2',
        color: '#991b1b',
        border: '#fca5a5',
      };
    }
    return {
      label: reason.replace(/_/g, ' ').toLowerCase(),
      bg: '#f1f5f9',
      color: '#475569',
      border: '#cbd5e1',
    };
  };

  // 1. Fetch available sections
  useEffect(() => {
    async function loadSections() {
      setLoadingSections(true);
      try {
        if (portal === 'Teacher') {
          const res = await apiClient.get<any[]>('/academic/my-classes');
          if (Array.isArray(res) && res.length > 0) {
            const mapped = res
              .filter((c: any) => c.sectionId)
              .map((c: any) => ({
                id: c.sectionId,
                name: c.section || `Grade ${c.grade}`,
                grade_level: c.grade,
                label: `Grade ${c.grade}, Section ${c.section}`,
              }));
            // Deduplicate by sectionId
            const unique = Array.from(new Map(mapped.map((s: any) => [s.id, s])).values());
            setSections(unique);
            if (unique.length > 0 && !selectedSectionId) {
              setSelectedSectionId(unique[0].id);
            }
          }
        } else {
          // Principal / Registrar: Fetch active academic year sections
          const yearsRes = await apiClient.get<any[]>('/academic/years');
          const activeYear = Array.isArray(yearsRes) ? yearsRes.find((y: any) => y.is_active) || yearsRes[0] : null;
          if (activeYear) {
            const secRes = await apiClient.get<any>(`/academic/years/${activeYear.id}/sections`);
            const secList = Array.isArray(secRes?.data) ? secRes.data : Array.isArray(secRes) ? secRes : [];
            const formatted = secList.map((s: any) => ({
              id: s.id,
              name: s.name,
              grade_level: s.grade_level,
              label: `Grade ${s.grade_level}, Section ${s.name}`,
            }));
            setSections(formatted);
            if (formatted.length > 0 && !selectedSectionId) {
              setSelectedSectionId(formatted[0].id);
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to load sections', err);
        setError('Failed to load sections list.');
      } finally {
        setLoadingSections(false);
      }
    }
    loadSections();
  }, [portal]);

  // 2. Fetch section report card overview
  const fetchOverview = useCallback(async () => {
    if (!selectedSectionId) return;
    setLoadingOverview(true);
    setError(null);
    try {
      const res = await apiClient.get<any>(`/academic/report-card/sections/${selectedSectionId}/overview`);
      setOverview(res?.data || res);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Failed to load report card overview.';
      setError(msg);
    } finally {
      setLoadingOverview(false);
    }
  }, [selectedSectionId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // 3. Issue Single Student SF9 (Per-Term)
  const handleConfirmIssue = async () => {
    if (!actionStudent) return;
    setIsProcessing(true);
    try {
      const reportingPeriod =
        selectedTerm === 'T1'
          ? 'Term 1 SF9'
          : selectedTerm === 'T2'
          ? 'Term 2 SF9'
          : 'Annual SF9 (Terms 1-3)';
      const res = await apiClient.post<any>(
        `/academic/report-card/${encodeURIComponent(actionStudent.studentId)}/sf9/issue`,
        { targetTerm: selectedTerm, reportingPeriod }
      );
      showToast(
        `Official SF9 (${reportingPeriod}) successfully issued for ${actionStudent.name}! (Version ${res?.data?.version || 1})`,
        'success'
      );
      setShowIssueModal(false);
      setActionStudent(null);
      await fetchOverview();
    } catch (err: any) {
      const details =
        err?.response?.data?.details?.blockingReasons ||
        err?.response?.data?.error?.details?.blockingReasons;
      if (Array.isArray(details) && details.length > 0) {
        const subjectErrs = details.filter((d: string) => /subject|grade|learning area/i.test(d));
        const attErrs = details.filter((d: string) => /attendance|sf2|month/i.test(d));
        const commErrs = details.filter((d: string) => /comment|remark/i.test(d));
        const otherErrs = details.filter(
          (d: string) => !subjectErrs.includes(d) && !attErrs.includes(d) && !commErrs.includes(d)
        );
        const grouped: string[] = [];
        if (subjectErrs.length) grouped.push(`📚 Subjects: ${subjectErrs.join('; ')}`);
        if (attErrs.length) grouped.push(`📅 Attendance: ${attErrs.join('; ')}`);
        if (commErrs.length) grouped.push(`✍️ Adviser Comments: ${commErrs.join('; ')}`);
        if (otherErrs.length) grouped.push(`⚠️ ${otherErrs.join('; ')}`);
        showToast(`Cannot issue ${selectedTerm} SF9:\n${grouped.join('\n')}`, 'error');
      } else {
        const msg =
          err?.response?.data?.message || err?.response?.data?.error?.message || err.message;
        showToast(`Cannot issue official SF9: ${msg}`, 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Release Single Student SF9 (Per-Term)
  const handleConfirmRelease = async () => {
    if (!actionStudent) return;
    setIsProcessing(true);
    try {
      const targetTerm = actionStudent.issuance?.targetTerm || 'T1';
      const reportingPeriod =
        actionStudent.issuance?.reportingPeriod ||
        (targetTerm === 'T1' ? 'Term 1 SF9' : targetTerm === 'T2' ? 'Term 2 SF9' : 'Annual SF9 (Terms 1-3)');
      await apiClient.post(
        `/academic/report-card/${encodeURIComponent(actionStudent.studentId)}/sf9/release`,
        { reportingPeriod, targetTerm }
      );
      showToast(
        `Official ${reportingPeriod} released! ${actionStudent.name} can now view and download their report card in the Student Portal.`,
        'success'
      );
      setShowReleaseModal(false);
      setActionStudent(null);
      await fetchOverview();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || err.message;
      showToast(`Cannot release SF9: ${msg}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Batch Release All Issued SF9s for the Section
  const handleConfirmBatchRelease = async () => {
    if (!selectedSectionId) return;
    setIsProcessing(true);
    try {
      const res = await apiClient.post<any>(
        `/academic/report-card/sections/${selectedSectionId}/release-all`,
        { reportingPeriod: 'Annual SF9 (Terms 1-3)' }
      );
      const count = res?.data?.newlyReleasedCount ?? 0;
      showToast(`Batch release complete! ${count} report cards released to the Student Portal.`, 'success');
      setShowBatchReleaseModal(false);
      await fetchOverview();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || err.message;
      showToast(`Batch release failed: ${msg}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Principal Authorize Entire Section
  const handleAuthorizeSection = async () => {
    if (!selectedSectionId) return;
    setIsProcessing(true);
    try {
      const res = await apiClient.post<any>(
        `/academic/report-card/sections/${selectedSectionId}/authorize`,
        { targetTerm: selectedTerm }
      );
      showToast(
        `Section ${res?.data?.sectionName || ''} successfully authorized for official SF9 issuance by School Principal!`,
        'success'
      );
      await fetchOverview();
    } catch (err: any) {
      const unready =
        err?.response?.data?.details?.unreadyLearners ||
        err?.response?.data?.error?.details?.unreadyLearners;
      if (Array.isArray(unready) && unready.length > 0) {
        const sample = unready
          .slice(0, 3)
          .map((u: any) => `${u.name}: ${u.blockingReasons.slice(0, 2).join(', ')}`)
          .join('\n');
        showToast(
          `Cannot authorize section (${unready.length} incomplete learners):\n${sample}`,
          'error'
        );
      } else {
        const msg =
          err?.response?.data?.message || err?.response?.data?.error?.message || err.message;
        showToast(`Principal authorization denied: ${msg}`, 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 7. Principal Authorize Single Learner
  const handleAuthorizeStudent = async (student: any) => {
    if (!student) return;
    setIsProcessing(true);
    try {
      await apiClient.post<any>(
        `/academic/report-card/${encodeURIComponent(student.studentId)}/sf9/authorize`,
        { targetTerm: selectedTerm }
      );
      showToast(
        `Official SF9 issuance authorized for ${student.name} by School Principal!`,
        'success'
      );
      await fetchOverview();
    } catch (err: any) {
      const details =
        err?.response?.data?.details?.blockingReasons ||
        err?.response?.data?.error?.details?.blockingReasons;
      if (Array.isArray(details) && details.length > 0) {
        showToast(`Cannot authorize learner:\n${details.join('; ')}`, 'error');
      } else {
        const msg =
          err?.response?.data?.message || err?.response?.data?.error?.message || err.message;
        showToast(`Principal authorization denied: ${msg}`, 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 8. Principal Authorize Only Eligible Students
  const handleAuthorizeEligible = async () => {
    if (!selectedSectionId) return;
    setIsProcessing(true);
    try {
      const res = await apiClient.post<any>(
        `/academic/report-card/sections/${selectedSectionId}/authorize-eligible`,
        { targetTerm: selectedTerm }
      );
      const data = res?.data || res;
      showToast(
        `Authorized ${data.authorizedCount} eligible learners in Section ${overview?.section?.name || ''}! (${data.excludedCount} incomplete learners safely bypassed)`,
        'success'
      );
      await fetchOverview();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message;
      showToast(`Principal authorization failed: ${msg}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 9. Asynchronous Batch SF9 Issuance
  const handleStartBulkIssue = async () => {
    if (!selectedSectionId) return;
    setIsProcessing(true);
    try {
      const res = await apiClient.post<any>(
        `/academic/report-card/sections/${selectedSectionId}/bulk-issue`,
        { targetTerm: selectedTerm }
      );
      const data = res?.data || res;
      const batchId = data.batchId;
      setActiveBatchId(batchId);
      setShowBatchIssueModal(true);
      showToast(`Bulk SF9 issuance started for ${data.totalEnqueued} authorized learners.`, 'info');
      pollBatchProgress(batchId);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message;
      showToast(`Cannot start bulk issuance: ${msg}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const pollBatchProgress = (batchId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get<any>(`/academic/report-card/batches/${batchId}/progress`);
        const p = res?.data || res;
        setBatchProgress(p);
        if (p.status === 'COMPLETED' || p.status === 'FAILED') {
          clearInterval(interval);
          fetchOverview();
        }
      } catch (e) {
        console.error('Polling batch progress error', e);
      }
    }, 1500);
  };

  // If viewing a single student's SF9, render the authentic Calulut viewer
  if (selectedStudentForViewer) {
    return (
      <AuthenticCalulutSf9Viewer
        mode="student"
        studentData={{
          student: {
            id: selectedStudentForViewer.studentId,
            name: selectedStudentForViewer.name,
            lrn: selectedStudentForViewer.lrn,
            gender: selectedStudentForViewer.gender,
          },
          enrollment: {
            gradeLevel: selectedStudentForViewer.gradeLevel,
            section: selectedStudentForViewer.sectionName,
          },
        }}
        onBack={() => {
          setSelectedStudentForViewer(null);
          fetchOverview();
        }}
      />
    );
  }

  // Filter learners
  const learners: any[] = overview?.learners || [];
  const filteredLearners = learners.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.lrn.includes(searchQuery);

    if (!matchesSearch) return false;

    if (filterStatus === 'eligible') return l.eligibility?.isEligible;
    if (filterStatus === 'incomplete') return !l.eligibility?.isEligible;
    if (filterStatus === 'unissued') return !l.issuance.isIssued;
    if (filterStatus === 'issued') return l.issuance.isIssued && !l.release.isReleased;
    if (filterStatus === 'released') return l.release.isReleased;
    return true;
  });

  const stats = overview?.stats || {
    totalLearners: 0,
    totalSubjects: 0,
    publishedSubjectsCount: 0,
    issuedCount: 0,
    releasedCount: 0,
    eligibleCount: 0,
    incompleteCount: 0,
    authorizedCount: 0,
  };

  const unreleasedIssuedCount = learners.filter(
    (l) => l.issuance.isIssued && !l.release.isReleased
  ).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', background: C.paper }}>
      {/* ── Top Bar / Header ── */}
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${C.borderMed}`,
          padding: '16px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                background: C.m50,
                color: C.m700,
                border: `1px solid ${C.borderMed}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Back
            </button>
          )}

          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: C.m100,
              color: C.m700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Award size={22} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>
                Report Cards (SF9)
              </h2>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: C.m50,
                  color: C.m700,
                  border: `1px solid ${C.borderMed}`,
                  textTransform: 'uppercase',
                }}
              >
                {portal} Console
              </span>
            </div>
            <p style={{ fontSize: 12, color: C.t3, margin: '2px 0 0 0' }}>
              Review published trimester grades, issue official DepEd Form 138 (SF9) report cards, and release them to the Student Portal.
            </p>
          </div>
        </div>

        {/* Section Selector & Batch Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Section Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>Section:</span>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={loadingSections}
              style={{
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: C.t1,
                background: '#fff',
                border: `1px solid ${C.borderMed}`,
                borderRadius: 6,
                outline: 'none',
                cursor: 'pointer',
                minWidth: 180,
              }}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchOverview}
            disabled={loadingOverview}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: C.t2,
              background: '#fff',
              border: `1px solid ${C.borderMed}`,
              borderRadius: 6,
              cursor: 'pointer',
            }}
            title="Refresh section records"
          >
            <RefreshCw size={13} className={loadingOverview ? 'animate-spin' : ''} /> Refresh
          </button>

          {/* Header Action Buttons (Strictly Scoped by Role Authority) */}
          {portal === 'Registrar' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                color: '#92400e',
                background: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: 6,
              }}
              title="Registrar SF9 access is view-only. Academic authorization is executed by the Principal, and portal release is executed by School Administration."
            >
              <ShieldCheck size={14} color="#b45309" />
              <span>View-Only Audit (Release reserved for Admin)</span>
            </div>
          )}

          {portal === 'Principal' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleAuthorizeEligible}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  background: '#047857',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(4,120,87,0.2)',
                }}
                title="Formally authorize official SF9 issuance for eligible learners with complete records"
              >
                <ShieldCheck size={14} />
                Authorize Eligible ({stats.eligibleCount ?? 0})
              </button>

              <button
                onClick={handleAuthorizeSection}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.t2,
                  background: '#fff',
                  border: `1px solid ${C.borderMed}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                title="Strict authorization: Requires 100% of all section learners to be complete"
              >
                <ShieldCheck size={13} />
                Authorize All Section
              </button>
            </div>
          )}

          {portal === 'Admin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleStartBulkIssue}
                disabled={isProcessing || !stats.isPrincipalAuthorized}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  background: stats.isPrincipalAuthorized ? '#0284c7' : '#94a3b8',
                  border: 'none',
                  borderRadius: 6,
                  cursor: stats.isPrincipalAuthorized ? 'pointer' : 'not-allowed',
                  boxShadow: stats.isPrincipalAuthorized ? '0 1px 3px rgba(2,132,199,0.2)' : 'none',
                }}
                title={
                  !stats.isPrincipalAuthorized
                    ? 'Bulk issuance requires prior formal authorization by the School Principal.'
                    : 'Issue official SF9 report cards in the background with bounded concurrency'
                }
              >
                <Sparkles size={13} /> Batch Issue SF9s
              </button>

              <button
                onClick={() => setShowBatchReleaseModal(true)}
                disabled={unreleasedIssuedCount === 0 || !stats.isPrincipalAuthorized || isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  background:
                    unreleasedIssuedCount > 0 && stats.isPrincipalAuthorized ? '#15803d' : '#94a3b8',
                  border: 'none',
                  borderRadius: 6,
                  cursor:
                    unreleasedIssuedCount > 0 && stats.isPrincipalAuthorized ? 'pointer' : 'not-allowed',
                  boxShadow:
                    unreleasedIssuedCount > 0 && stats.isPrincipalAuthorized
                      ? '0 1px 3px rgba(21,128,61,0.2)'
                      : 'none',
                }}
                title={
                  !stats.isPrincipalAuthorized
                    ? 'Batch release requires prior formal authorization by the School Principal.'
                    : unreleasedIssuedCount === 0
                    ? 'No unreleased issued report cards available for batch release.'
                    : 'Release all sealed report cards in this section to the Student Portal'
                }
              >
                <Send size={13} /> Batch Release Section ({unreleasedIssuedCount})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px 48px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Error Banner */}
        {error && (
          <div
            style={{
              flexShrink: 0,
              background: '#fef2f2',
              border: '1px solid #fecdd3',
              borderRadius: 8,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Student Grade Visibility Control for Authorized Administration Roles */}
        {(portal === 'Admin' || portal === 'Principal') && (
          <StudentGradeVisibilityCard
            className="flex-shrink-0"
            academicYearName="SY 2026–2027"
          />
        )}

        {/* ── Section Metric Cards Strip ── */}
        <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {/* Card 1: Enrolled Learners */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Enrolled Learners
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", marginTop: 4 }}>
              {stats.totalLearners}
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
              {overview?.section?.name ? `Section ${overview.section.name} (Adviser: ${overview.section.adviserName})` : 'Class Section'}
            </div>
          </div>

          {/* Card 2: Subject Grades Published */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Subject Gradebooks
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d', fontFamily: "'Fraunces',serif", marginTop: 4 }}>
              {stats.publishedSubjectsCount} <span style={{ fontSize: 14, color: C.t3, fontWeight: 600 }}>of {stats.totalSubjects || 9}</span>
            </div>
            <div style={{ fontSize: 11, marginTop: 2 }}>
              {stats.unassignedCurriculumCount > 0 ? (
                <span style={{ color: '#b45309', fontWeight: 600 }}>
                  ⚠️ {stats.unassignedCurriculumCount} Subject{stats.unassignedCurriculumCount > 1 ? 's' : ''} Unassigned ({stats.assignedSubjectsCount || 0} of 9 configured)
                </span>
              ) : stats.publishedSubjectsCount === (stats.totalSubjects || 9) ? (
                <span style={{ color: '#15803d' }}>All 9 learning areas officially published</span>
              ) : (
                <span style={{ color: '#d97706' }}>Pending remaining subject teachers</span>
              )}
            </div>
          </div>

          {/* Card 3: Official SF9 Issued */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Official SF9 Sealed
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0369a1', fontFamily: "'Fraunces',serif", marginTop: 4 }}>
              {stats.issuedCount} <span style={{ fontSize: 14, color: C.t3, fontWeight: 600 }}>of {stats.totalLearners}</span>
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
              SHA-256 sealed DepEd workbooks
            </div>
          </div>

          {/* Card 4: Released to Student Portal */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Released to Portal
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed', fontFamily: "'Fraunces',serif", marginTop: 4 }}>
              {stats.releasedCount} <span style={{ fontSize: 14, color: C.t3, fontWeight: 600 }}>of {stats.totalLearners}</span>
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
              Visible to learners &amp; parents
            </div>
          </div>
        </div>

        {/* ── Table Filter & Search Controls ── */}
        <div
          style={{
            flexShrink: 0,
            background: '#fff',
            border: `1px solid ${C.borderMed}`,
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: '6px 12px', minWidth: 260 }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search by student name or LRN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: C.t1, width: '100%' }}
            />
          </div>

          {/* Status Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {[
              { id: 'all', label: `All Learners (${learners.length})` },
              { id: 'eligible', label: `Eligible (${stats.eligibleCount ?? learners.filter((l) => l.eligibility?.isEligible).length})` },
              { id: 'incomplete', label: `Incomplete (${stats.incompleteCount ?? learners.filter((l) => !l.eligibility?.isEligible).length})` },
              { id: 'unissued', label: `Unissued (${learners.filter((l) => !l.issuance.isIssued).length})` },
              { id: 'issued', label: `Ready for Release (${unreleasedIssuedCount})` },
              { id: 'released', label: `Released (${stats.releasedCount})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id as any)}
                style={{
                  padding: '5px 12px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 20,
                  border: filterStatus === f.id ? `1px solid ${C.m700}` : `1px solid ${C.borderMed}`,
                  background: filterStatus === f.id ? C.m100 : '#fff',
                  color: filterStatus === f.id ? C.m700 : C.t2,
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Roster Table ── */}
        <div style={{ flexShrink: 0, background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          {loadingOverview ? (
            <div style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: C.t3 }}>
              <Loader2 size={28} className="animate-spin" color={C.m700} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Loading section report card records...</div>
            </div>
          ) : filteredLearners.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: C.t3, fontSize: 13 }}>
              No learners found matching the selected filter.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${C.borderMed}` }}>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: C.t2 }}>Learner Name &amp; LRN</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: C.t2, textAlign: 'center' }}>SF9 Readiness</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: C.t2, textAlign: 'center' }}>Subject Grades</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: C.t2, textAlign: 'center' }}>Adviser Comments</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: C.t2, textAlign: 'center' }}>Principal Authorization</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: C.t2, textAlign: 'center' }}>Official Issuance</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: C.t2, textAlign: 'center' }}>Student Portal</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: C.t2, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLearners.map((learner, idx) => {
                    const isIssued = learner.issuance.isIssued;
                    const isReleased = learner.release.isReleased;

                    return (
                      <tr
                        key={learner.studentId}
                        style={{
                          borderBottom: `1px solid ${C.border}`,
                          background: idx % 2 === 0 ? '#fff' : '#fafafa',
                        }}
                      >
                        {/* Learner Info */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: C.t1, fontSize: 13 }}>{learner.name}</div>
                          <div style={{ fontSize: 11, color: C.t3, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>
                            LRN: {learner.lrn} · {learner.gender === 'Male' || learner.gender === 'M' ? 'Male' : learner.gender === 'Female' || learner.gender === 'F' ? 'Female' : 'Unknown'}
                          </div>
                        </td>

                        {/* SF9 Readiness & Blockers */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {learner.eligibility?.isEligible ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: '#dcfce7',
                                color: '#166534',
                                border: '1px solid #86efac',
                              }}
                            >
                              <CheckCircle2 size={11} /> Eligible for SF9
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  border: '1px solid #fca5a5',
                                }}
                              >
                                <AlertTriangle size={11} /> Incomplete ({learner.eligibility?.blockingReasons?.length || 1})
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', maxWidth: 220 }}>
                                {(learner.eligibility?.blockingReasons || []).slice(0, 4).map((r: string, rIdx: number) => {
                                  const chip = parseBlocker(r);
                                  return (
                                    <span
                                      key={rIdx}
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 600,
                                        padding: '1px 5px',
                                        borderRadius: 3,
                                        background: chip.bg,
                                        color: chip.color,
                                        border: `1px solid ${chip.border}`,
                                      }}
                                      title={r}
                                    >
                                      {chip.label}
                                    </span>
                                  );
                                })}
                                {(learner.eligibility?.blockingReasons?.length || 0) > 4 && (
                                  <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>
                                    +{(learner.eligibility?.blockingReasons?.length || 0) - 4} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Subject Grades Status */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: learner.publishedSubjectsCount === learner.totalSubjectsCount ? '#dcfce7' : '#fef3c7',
                              color: learner.publishedSubjectsCount === learner.totalSubjectsCount ? '#166534' : '#92400e',
                              border: learner.publishedSubjectsCount === learner.totalSubjectsCount ? '1px solid #86efac' : '1px solid #fde68a',
                            }}
                          >
                            {learner.publishedSubjectsCount === learner.totalSubjectsCount ? (
                              <CheckCircle2 size={11} />
                            ) : (
                              <AlertTriangle size={11} />
                            )}
                            {learner.publishedSubjectsCount} of {learner.totalSubjectsCount} Published
                          </span>
                        </td>

                        {/* Adviser Remarks */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: learner.hasAdviserComment ? '#15803d' : '#64748b',
                            }}
                          >
                            {learner.hasAdviserComment ? 'Verified ✓' : 'Pending'}
                          </span>
                        </td>

                        {/* Principal Authorization Status */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {learner.principalAuthorization?.isAuthorized ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                              }}
                            >
                              <CheckCircle2 size={12} /> Authorized ({learner.principalAuthorization?.targetTerm || 'T1'})
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 10.5,
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: '#fef2f2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                              }}
                            >
                              <AlertTriangle size={11} /> Pending Principal
                            </span>
                          )}
                        </td>

                        {/* Official Issuance Status */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {isIssued ? (
                            <div>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  border: '1px solid #bae6fd',
                                }}
                                title={`SHA-256: ${learner.issuance.pdfSha256}`}
                              >
                                <ShieldCheck size={12} /> {learner.issuance.targetTerm || 'T1'} Issued (v{learner.issuance.version})
                              </span>
                              {learner.issuance.issuedAt && (
                                <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                                  {new Date(learner.issuance.issuedAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                              Not Issued
                            </span>
                          )}
                        </td>

                        {/* Student Portal Status */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {isReleased ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #86efac',
                              }}
                            >
                              <CheckCircle2 size={12} /> {learner.release.targetTerm || learner.issuance.targetTerm || 'T1'} Released
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: '#f1f5f9',
                                color: '#64748b',
                              }}
                            >
                              Pending Release
                            </span>
                          )}
                        </td>

                        {/* Actions (Strictly Scoped by Role Authority) */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            {/* Inspect SF9 Preview: Available to all staff roles */}
                            <button
                              type="button"
                              onClick={() => setSelectedStudentForViewer(learner)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#1e293b',
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                              title="Inspect authentic Calulut Form 138 report card preview"
                            >
                              <Eye size={12} /> Inspect SF9
                            </button>

                            {/* Principal Actions: Formal Academic Authorization */}
                            {portal === 'Principal' && (
                              <button
                                type="button"
                                onClick={() => handleAuthorizeStudent(learner)}
                                disabled={isProcessing}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '4px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: '#fff',
                                  background: learner.principalAuthorization?.isAuthorized ? '#047857' : '#0284c7',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                }}
                                title={
                                  learner.principalAuthorization?.isAuthorized
                                    ? 'Academic record formally authorized by School Principal'
                                    : 'Review prerequisites and authorize official SF9 issuance'
                                }
                              >
                                <ShieldCheck size={12} />
                                {learner.principalAuthorization?.isAuthorized ? 'Authorized ✓' : 'Authorize SF9'}
                              </button>
                            )}

                            {/* Admin Actions: Official Issuance & Release to Student */}
                            {portal === 'Admin' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!learner.principalAuthorization?.isAuthorized) {
                                      showToast(
                                        'Official issuance requires prior formal authorization by the School Principal.',
                                        'error'
                                      );
                                      return;
                                    }
                                    setActionStudent(learner);
                                    setSelectedTerm(
                                      learner.issuance.isIssued
                                        ? learner.issuance.targetTerm === 'T1'
                                          ? 'T2'
                                          : learner.issuance.targetTerm === 'T2'
                                          ? 'T3'
                                          : 'T3'
                                        : 'T1'
                                    );
                                    setShowIssueModal(true);
                                  }}
                                  disabled={!learner.principalAuthorization?.isAuthorized || isProcessing}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#fff',
                                    background: learner.principalAuthorization?.isAuthorized ? '#15803d' : '#94a3b8',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: learner.principalAuthorization?.isAuthorized ? 'pointer' : 'not-allowed',
                                  }}
                                  title={
                                    !learner.principalAuthorization?.isAuthorized
                                      ? 'Requires prior Principal authorization'
                                      : 'Officially issue or update official SF9'
                                  }
                                >
                                  <Award size={12} /> {isIssued ? 'Issue Next Term' : 'Issue SF9'}
                                </button>

                                {isIssued && !isReleased && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!learner.principalAuthorization?.isAuthorized) {
                                        showToast(
                                          'Official release requires prior formal authorization by the School Principal.',
                                          'error'
                                        );
                                        return;
                                      }
                                      setActionStudent(learner);
                                      setShowReleaseModal(true);
                                    }}
                                    disabled={!learner.principalAuthorization?.isAuthorized || isProcessing}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '4px 10px',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: '#fff',
                                      background: learner.principalAuthorization?.isAuthorized ? '#2563eb' : '#94a3b8',
                                      border: 'none',
                                      borderRadius: 4,
                                      cursor: learner.principalAuthorization?.isAuthorized ? 'pointer' : 'not-allowed',
                                    }}
                                    title={`Authorize release of ${learner.issuance.targetTerm || 'Term 1'} SF9 to student portal`}
                                  >
                                    <Send size={12} /> Release {learner.issuance.targetTerm || 'T1'}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modern Modal for Single Issuance (Per-Term) ── */}
      <ModernConfirmModal
        isOpen={showIssueModal}
        onClose={() => !isProcessing && setShowIssueModal(false)}
        onConfirm={handleConfirmIssue}
        title={
          selectedTerm === 'T1'
            ? 'Issue Term 1 SF9'
            : selectedTerm === 'T2'
            ? 'Issue Term 2 SF9'
            : 'Issue Final Term 3 SF9'
        }
        subtitle={`${actionStudent?.name} · LRN: ${actionStudent?.lrn} · Calulut Integrated School`}
        badge={{ text: `DepEd SF9 — ${selectedTerm}`, variant: 'success' }}
        confirmVariant="success"
        confirmLabel={
          selectedTerm === 'T1'
            ? 'Issue Term 1 SF9'
            : selectedTerm === 'T2'
            ? 'Issue Term 2 SF9'
            : 'Issue Final Term 3 SF9'
        }
        confirmIcon={<Award size={16} />}
        isLoading={isProcessing}
        loadingLabel={`Generating & Sealing ${selectedTerm} Checksums...`}
        checklist={
          selectedTerm === 'T1'
            ? [
                {
                  title: 'Term 1 Subject Grades (9 Learning Areas)',
                  description:
                    'Validates that all 9 core learning areas are published for Term 1 (Mathematics, Science, English, Filipino, AP, VE, TLE, Music & Arts, PE & Health). Terms 2 and 3 are not required.',
                  status: 'neutral',
                  icon: <Info size={13} className="text-slate-500" />,
                },
                {
                  title: 'Term 1 Attendance (Jun, Jul, Aug, Sep)',
                  description:
                    'Validates verified SF2 learner attendance for Term 1 school calendar months. Months beyond Term 1 remain blank without penalty.',
                  status: 'neutral',
                  icon: <Info size={13} className="text-slate-500" />,
                },
                {
                  title: 'Term 1 Class Adviser Narrative Comments',
                  description:
                    'Validates finalized Term 1 narrative remarks on learner progress and values development.',
                  status: 'neutral',
                  icon: <Info size={13} className="text-slate-500" />,
                },
              ]
            : selectedTerm === 'T2'
            ? [
                {
                  title: 'Terms 1 & 2 Published Subject Grades',
                  description:
                    'Validates that all 9 core learning areas are published through Term 2. Historical Term 1 records are preserved and Term 3 remains blank.',
                  status: 'neutral',
                  icon: <Info size={13} className="text-slate-500" />,
                },
                {
                  title: 'Terms 1 & 2 Attendance Record (Jun – Jan)',
                  description:
                    'Validates verified attendance across Terms 1 and 2. Term 3 attendance remains blank.',
                  status: 'neutral',
                  icon: <Info size={13} className="text-slate-500" />,
                },
                {
                  title: 'Terms 1 & 2 Adviser Comments',
                  description:
                    'Validates finalized Class Adviser narrative remarks for both Term 1 and Term 2.',
                  status: 'neutral',
                  icon: <Info size={13} className="text-slate-500" />,
                },
              ]
            : [
                {
                  title: 'Complete Academic Year Grades (Terms 1–3)',
                  description:
                    'Validates all 3 terms published with final ratings and general average calculated using official grading rules.',
                  status: 'neutral',
                  icon: <Info size={13} className="text-slate-500" />,
                },
                {
                  title: 'Full School Year Attendance (11 Months)',
                  description:
                    'Validates verified attendance from June through April across the configured SY 2026-2027 calendar.',
                  status: 'neutral',
                  icon: <Info size={13} className="text-slate-500" />,
                },
                {
                  title: 'Annual Adviser Remarks & Promotional Certification',
                  description:
                    'Validates complete annual adviser narrative comments, promotional status, and school head certification.',
                  status: 'neutral',
                  icon: <Info size={13} className="text-slate-500" />,
                },
              ]
        }
        note={`Official per-term issuance creates an official DepEd academic record for ${selectedTerm}. Future-term records remain blank until their respective completion.`}
      >
        {/* Term Selection Segmented Controls */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Select Target Release Term
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedTerm('T1')}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                selectedTerm === 'T1'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Issue Term 1 SF9
            </button>
            <button
              type="button"
              onClick={() => setSelectedTerm('T2')}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                selectedTerm === 'T2'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Issue Term 2 SF9
            </button>
            <button
              type="button"
              onClick={() => setSelectedTerm('T3')}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                selectedTerm === 'T3'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Issue Final Term 3 SF9
            </button>
          </div>
        </div>
      </ModernConfirmModal>

      {/* ── Modern Modal for Single Release (Per-Term) ── */}
      <ModernConfirmModal
        isOpen={showReleaseModal}
        onClose={() => !isProcessing && setShowReleaseModal(false)}
        onConfirm={handleConfirmRelease}
        title={`Release ${actionStudent?.issuance?.targetTerm || 'Term 1'} SF9 to Student Portal`}
        subtitle={`${actionStudent?.name} · LRN: ${actionStudent?.lrn} · Calulut Integrated School`}
        badge={{ text: `${actionStudent?.issuance?.targetTerm || 'Term 1'} Release`, variant: 'info' }}
        confirmVariant="primary"
        confirmLabel={`Authorize & Release ${actionStudent?.issuance?.targetTerm || 'Term 1'} SF9`}
        confirmIcon={<Send size={16} />}
        isLoading={isProcessing}
        loadingLabel="Authorizing Student Access..."
        checklist={[
          {
            title: 'Authorize Student Portal Access',
            description: `Grants ${actionStudent?.name || 'learner'} immediate access to view their official ${actionStudent?.issuance?.targetTerm || 'Term 1'} report card.`,
            status: 'neutral',
            icon: <Info size={13} className="text-slate-500" />,
          },
          {
            title: 'Enable Verified PDF Export',
            description: 'Allows downloading the sealed, school-head signed Calulut Form 138 PDF.',
            status: 'neutral',
            icon: <Info size={13} className="text-slate-500" />,
          },
          {
            title: 'Audit Log Trail',
            description: 'Records official release timestamp and releasing administrator user ID.',
            status: 'neutral',
            icon: <Info size={13} className="text-slate-500" />,
          },
        ]}
        note={`Release this student's official ${actionStudent?.issuance?.targetTerm || 'Term 1'} SF9 after verifying their completed records.`}
      />

      {/* ── Modern Modal for Batch Release ── */}
      <ModernConfirmModal
        isOpen={showBatchReleaseModal}
        onClose={() => !isProcessing && setShowBatchReleaseModal(false)}
        onConfirm={handleConfirmBatchRelease}
        title={`Batch Release ${overview?.section?.name || 'Section'} Report Cards`}
        subtitle={`${unreleasedIssuedCount} issued report cards ready for release · Calulut Integrated School`}
        badge={{ text: 'Section Release', variant: 'info' }}
        confirmVariant="primary"
        confirmLabel={`Release All (${unreleasedIssuedCount}) to Portal`}
        confirmIcon={<Send size={16} />}
        isLoading={isProcessing}
        loadingLabel="Releasing Section Report Cards..."
        checklist={[
          {
            title: 'Class-Wide Release',
            description: `Authorizes immediate student portal viewing for all ${unreleasedIssuedCount} issued learners in this section.`,
          },
          {
            title: 'Immutable Audit Log',
            description: 'Logs batch release authorization for institutional accountability.',
          },
        ]}
        note="Unissued learners will remain in pending state and will not receive premature or incomplete report cards."
      />

      {/* ── Batch Issuance Progress Modal ── */}
      {showBatchIssueModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 500, width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>Bulk SF9 Issuance Queue</h3>
                  <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Bounded background compilation with LibreOffice</p>
                </div>
              </div>
              {batchProgress?.status !== 'PROCESSING' && (
                <button
                  onClick={() => {
                    setShowBatchIssueModal(false);
                    fetchOverview();
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                <span>Status: <strong style={{ color: batchProgress?.status === 'COMPLETED' ? '#16a34a' : '#0284c7' }}>{batchProgress?.status || 'INITIALIZING'}</strong></span>
                <span>{batchProgress?.progressPercent ?? 0}%</span>
              </div>
              <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${batchProgress?.progressPercent ?? 0}%`, height: '100%', background: batchProgress?.status === 'COMPLETED' ? '#16a34a' : '#0284c7', transition: 'width 0.3s ease' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', marginBottom: 16 }}>
              <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Completed</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{batchProgress?.completedCount ?? 0}</div>
              </div>
              <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Skipped</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{batchProgress?.skippedCount ?? 0}</div>
              </div>
              <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{batchProgress?.totalCount ?? 0}</div>
              </div>
            </div>

            {batchProgress?.currentStudentName && batchProgress.status === 'PROCESSING' && (
              <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginBottom: 16, background: '#f1f5f9', padding: '6px 10px', borderRadius: 6 }}>
                Compiling: <strong style={{ color: '#0f172a' }}>{batchProgress.currentStudentName}</strong>
              </div>
            )}

            {batchProgress?.status === 'COMPLETED' && (
              <div style={{ fontSize: 12, color: '#166534', background: '#dcfce7', padding: '10px 14px', borderRadius: 6, border: '1px solid #86efac', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} />
                <span>Batch processing complete! {batchProgress.completedCount} report cards issued.</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowBatchIssueModal(false);
                  fetchOverview();
                }}
                disabled={batchProgress?.status === 'PROCESSING'}
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  background: batchProgress?.status === 'PROCESSING' ? '#cbd5e1' : '#0284c7',
                  color: '#fff',
                  cursor: batchProgress?.status === 'PROCESSING' ? 'not-allowed' : 'pointer',
                }}
              >
                {batchProgress?.status === 'PROCESSING' ? 'Processing in Background...' : 'Close & Refresh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notifications ── */}
      <ModernToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
