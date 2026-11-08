import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  Printer,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  Info,
  MessageSquare,
  X,
  Lock,
  Unlock,
  Award,
  Send,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../../api/client';
import { ModernConfirmModal } from './ModernConfirmModal';
import { ModernToast, ToastMessage } from './ModernToast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export interface DiagnosticPrerequisiteCategory {
  title: string;
  category: string;
  status: 'passed' | 'blocked';
  summary: string;
  items: { label: string; ok: boolean; detail?: string }[];
}

export function categorizeDiagnosticReasons(
  rawReasons: string[],
  studentData: any,
  subjectEvaluation?: Record<string, any> | null,
  prerequisiteEvaluation?: any | null
): DiagnosticPrerequisiteCategory[] {
  const reasonsText = rawReasons.join(' ');
  const rawStudent = studentData?.student || studentData?.data?.student || {};
  const rawEnrollment = studentData?.enrollment || studentData?.data?.enrollment || {};

  // 1. Truly Missing Demographics
  let demoItems: { label: string; ok: boolean; detail?: string }[];
  if (prerequisiteEvaluation?.demographics) {
    const d = prerequisiteEvaluation.demographics;
    demoItems = [
      {
        label: 'Learner Reference Number (LRN)',
        ok: d.validLrn,
        detail: rawStudent.lrn || (d.validLrn ? 'Verified 12-digit DepEd LRN' : 'Pending authoritative 12-digit DepEd LRN'),
      },
      {
        label: 'Authoritative Date of Birth',
        ok: d.validBirthdate,
        detail: d.validBirthdate ? (d.age ? `Recorded (Age ${d.age})` : 'Recorded') : 'Missing in student demographic profile',
      },
      {
        label: 'Learner Gender / Sex',
        ok: d.validGender,
        detail: d.validGender ? (rawStudent.gender || 'Recorded') : 'Missing in student demographic profile',
      },
    ];
  } else {
    const hasBirthdateBlock = reasonsText.includes('MISSING_AUTHORITATIVE_BIRTHDATE');
    const hasGenderBlock = reasonsText.includes('MISSING_AUTHORITATIVE_GENDER');
    const hasLrnBlock = reasonsText.includes('MISSING_AUTHORITATIVE_LRN');
    demoItems = [
      {
        label: 'Learner Reference Number (LRN)',
        ok: !hasLrnBlock && !!(rawStudent.lrn && /^\d{12}$/.test(rawStudent.lrn)),
        detail: rawStudent.lrn || 'Pending authoritative 12-digit DepEd LRN',
      },
      {
        label: 'Authoritative Date of Birth',
        ok: !hasBirthdateBlock,
        detail: hasBirthdateBlock ? 'Missing in student demographic profile' : 'Recorded',
      },
      {
        label: 'Learner Gender / Sex',
        ok: !hasGenderBlock,
        detail: hasGenderBlock ? 'Missing in student demographic profile' : (rawStudent.gender || 'Recorded'),
      },
    ];
  }
  const demoPassed = demoItems.every((i) => i.ok);

  // 2. Data & Section Mapping
  const hasEnrollmentBlock =
    reasonsText.includes('CONTRADICTORY_ENROLLMENT_STUDENT') ||
    reasonsText.includes('no active section') ||
    reasonsText.includes('NOT_FOUND');
  const mappingItems = [
    {
      label: 'Active Enrollment Record',
      ok: !hasEnrollmentBlock,
      detail: rawEnrollment.section ? 'Enrolled' : 'Pending active enrollment verification',
    },
    {
      label: 'Grade Level & Section Mapping',
      ok: !hasEnrollmentBlock && !!rawEnrollment.section,
      detail:
        rawEnrollment.gradeLevel && rawEnrollment.section
          ? `Grade ${rawEnrollment.gradeLevel} - ${rawEnrollment.section}`
          : rawEnrollment.section || 'Assigned Section',
    },
    {
      label: 'Academic Year Scope',
      ok: true,
      detail: studentData?.school?.academicYear || 'SY 2026-2027 (Trimester Calendar)',
    },
  ];
  const mappingPassed = mappingItems.every((i) => i.ok);

  // 3. Verified Institutional Signatories
  let signatoryItems: { label: string; ok: boolean; detail?: string }[];
  if (prerequisiteEvaluation?.signatories) {
    const s = prerequisiteEvaluation.signatories;
    signatoryItems = [
      {
        label: 'Section Class Adviser Signatory',
        ok: s.hasAdviser,
        detail: s.hasAdviser ? (s.adviserName || 'Assigned & Verified') : 'Adviser assignment pending verification',
      },
      {
        label: 'School Head / Principal Signatory',
        ok: s.hasSchoolHead,
        detail: s.hasSchoolHead ? (s.schoolHeadName ? `${s.schoolHeadName} (${s.schoolHeadTitle || 'Principal'})` : 'Verified') : 'Missing verified School Head signatory record',
      },
    ];
  } else {
    const hasSchoolHeadBlock = reasonsText.includes('MISSING_SCHOOL_HEAD_SIGNATORY');
    const hasAdviserBlock = reasonsText.includes('MISSING_SECTION_ADVISER_SIGNATORY');
    signatoryItems = [
      {
        label: 'Section Class Adviser Signatory',
        ok: !hasAdviserBlock && rawReasons.length === 0,
        detail: hasAdviserBlock ? 'Adviser assignment pending verification' : (rawReasons.length === 0 ? 'Assigned & Verified' : 'Adviser assignment pending verification'),
      },
      {
        label: 'School Head / Principal Signatory',
        ok: !hasSchoolHeadBlock && rawReasons.length === 0,
        detail: hasSchoolHeadBlock ? 'Missing verified School Head signatory record' : (rawReasons.length === 0 ? 'Verified' : 'Pending signatory verification'),
      },
    ];
  }
  const signatoryPassed = signatoryItems.every((i) => i.ok);

  // 4. Unpublished / Missing Subject Grades (3 Terms)
  const CANONICAL_SUBJECTS = [
    { key: 'filipino', label: 'Filipino' },
    { key: 'english', label: 'English' },
    { key: 'math', label: 'Mathematics' },
    { key: 'science', label: 'Science' },
    { key: 'ap', label: 'Araling Panlipunan (AP)' },
    { key: 'gmrc', label: 'GMRC / Values Education / EsP' },
    { key: 'tle', label: 'TLE / EPP' },
    { key: 'music', label: 'Music' },
    { key: 'pe', label: 'Physical Education & Health (PE)' },
  ];

  const effectiveSubjectEval = prerequisiteEvaluation?.subjects || subjectEvaluation;

  const gradeItems = CANONICAL_SUBJECTS.map((subj) => {
    if (effectiveSubjectEval && effectiveSubjectEval[subj.key]) {
      const evalData = effectiveSubjectEval[subj.key];
      const isComplete = evalData.isComplete === true;
      const t1Str =
        evalData.t1?.grade !== null
          ? `T1: ${evalData.t1.grade}${evalData.t1.published ? ' (Pub)' : ' (Draft)'}`
          : 'T1: Missing';
      const t2Str =
        evalData.t2?.grade !== null
          ? `T2: ${evalData.t2.grade}${evalData.t2.published ? ' (Pub)' : ' (Draft)'}`
          : 'T2: Missing';
      const t3Str =
        evalData.t3?.grade !== null
          ? `T3: ${evalData.t3.grade}${evalData.t3.published ? ' (Pub)' : ' (Draft)'}`
          : 'T3: Missing';
      return {
        label: subj.label,
        ok: isComplete,
        detail: isComplete
          ? 'Complete across 3 terms (T1, T2, T3)'
          : `${t1Str} · ${t2Str} · ${t3Str}`,
      };
    }

    // Authoritative fallback: Never infer complete from absent error string
    const isExplicitlyBlocked = rawReasons.some(
      (r) =>
        r.includes(`UNPUBLISHED_OR_MISSING_SUBJECT_GRADES:${subj.key}`) ||
        r.includes(`grades.${subj.key}`)
    );

    return {
      label: subj.label,
      ok: false,
      detail: isExplicitlyBlocked
        ? 'Incomplete: terms pending published grades'
        : 'Pending authoritative term-level publication verification',
    };
  });
  const gradesPassed = gradeItems.every((i) => i.ok);

  // 5. School-Calendar Attendance (11 Months)
  let attItems: { label: string; ok: boolean; detail?: string }[];
  if (prerequisiteEvaluation?.attendance) {
    const a = prerequisiteEvaluation.attendance;
    attItems = [
      {
        label: 'School Attendance Calendar (Jun–Apr, 11 Months)',
        ok: a.readyForOfficialSf9,
        detail: a.readyForOfficialSf9
          ? '11 calendar months finalized'
          : `${a.finalizedMonthsCount}/${a.totalRequiredMonths || 11} calendar months finalized`,
      },
      {
        label: 'Daily Official Homeroom / SF2 Status',
        ok: !a.blockingReasons.some((r: string) => r.includes('UNRESOLVED_EXCUSED_ATTENDANCE')),
        detail: a.blockingReasons.some((r: string) => r.includes('UNRESOLVED_EXCUSED_ATTENDANCE'))
          ? 'Unresolved attendance exceptions'
          : (a.readyForOfficialSf9 ? 'Verified' : 'Pending calendar finalization'),
      },
    ];
  } else {
    const attendanceMatches = rawReasons.filter(
      (r) => r.toLowerCase().includes('attendance') || r.includes('SchoolCalendarMonth')
    );
    const hasUnresolvedExcused = reasonsText.includes('UNRESOLVED_EXCUSED_ATTENDANCE');
    attItems = [
      {
        label: 'School Attendance Calendar (Jun–Apr, 11 Months)',
        ok: attendanceMatches.length === 0 && rawReasons.length === 0,
        detail:
          attendanceMatches.length > 0
            ? `${attendanceMatches.length} monthly summaries pending finalization`
            : (rawReasons.length === 0 ? '11 calendar months finalized' : 'Attendance verification pending'),
      },
      {
        label: 'Daily Official Homeroom / SF2 Status',
        ok: !hasUnresolvedExcused && rawReasons.length === 0,
        detail: hasUnresolvedExcused
          ? 'Unresolved attendance exceptions'
          : (rawReasons.length === 0 ? 'Verified' : 'Pending verification'),
      },
    ];
  }
  const attendancePassed = attItems.every((i) => i.ok);

  // 6. Adviser Narrative Comments (T1, T2, T3)
  let commentItems: { label: string; ok: boolean; detail?: string }[];
  if (prerequisiteEvaluation?.comments) {
    const c = prerequisiteEvaluation.comments;
    commentItems = [
      {
        label: 'Term 1 Adviser Remark',
        ok: c.t1,
        detail: c.t1 ? 'Recorded & Published' : 'Pending published remark',
      },
      {
        label: 'Term 2 Adviser Remark',
        ok: c.t2,
        detail: c.t2 ? 'Recorded & Published' : 'Pending published remark',
      },
      {
        label: 'Term 3 Adviser Remark',
        ok: c.t3,
        detail: c.t3 ? 'Recorded & Published' : 'Pending published remark',
      },
    ];
  } else {
    const commT1Missing =
      reasonsText.includes('MISSING_PUBLISHED_ADVISER_COMMENT:T1') || reasonsText.includes('comments.t1');
    const commT2Missing =
      reasonsText.includes('MISSING_PUBLISHED_ADVISER_COMMENT:T2') || reasonsText.includes('comments.t2');
    const commT3Missing =
      reasonsText.includes('MISSING_PUBLISHED_ADVISER_COMMENT:T3') || reasonsText.includes('comments.t3');
    commentItems = [
      {
        label: 'Term 1 Adviser Remark',
        ok: !commT1Missing && rawReasons.length === 0,
        detail: commT1Missing ? 'Pending published remark' : (rawReasons.length === 0 ? 'Recorded' : 'Pending verification'),
      },
      {
        label: 'Term 2 Adviser Remark',
        ok: !commT2Missing && rawReasons.length === 0,
        detail: commT2Missing ? 'Pending published remark' : (rawReasons.length === 0 ? 'Recorded' : 'Pending verification'),
      },
      {
        label: 'Term 3 Adviser Remark',
        ok: !commT3Missing && rawReasons.length === 0,
        detail: commT3Missing ? 'Pending published remark' : (rawReasons.length === 0 ? 'Recorded' : 'Pending verification'),
      },
    ];
  }
  const commentsPassed = commentItems.every((i) => i.ok);

  return [
    {
      title: '1. Learner Demographics',
      category: 'Demographics',
      status: demoPassed ? 'passed' : 'blocked',
      summary: demoPassed
        ? 'Authoritative demographics verified'
        : 'Missing authoritative birthdate or demographics in student record',
      items: demoItems,
    },
    {
      title: '2. Section & Data Mapping',
      category: 'Mapping',
      status: mappingPassed ? 'passed' : 'blocked',
      summary: mappingPassed
        ? 'Active enrollment and section verified'
        : 'Enrollment or section data mapping error',
      items: mappingItems,
    },
    {
      title: '3. Institutional Signatories',
      category: 'Signatories',
      status: signatoryPassed ? 'passed' : 'blocked',
      summary: signatoryPassed
        ? 'School Head and Class Adviser signatories verified'
        : 'Missing verified School Head or Adviser signatory',
      items: signatoryItems,
    },
    {
      title: '4. Three-Term Subject Ratings (DepEd Order No. 015, s. 2026)',
      category: 'Grading',
      status: gradesPassed ? 'passed' : 'blocked',
      summary: gradesPassed
        ? 'All 3 terms (T1, T2, T3) published'
        : 'Unpublished or missing grades across 3 terms (T1, T2, T3)',
      items: gradeItems,
    },
    {
      title: '5. School-Calendar Attendance (11 Months)',
      category: 'Attendance',
      status: attendancePassed ? 'passed' : 'blocked',
      summary: attendancePassed
        ? '11 DepEd calendar months finalized'
        : 'Unfinalized monthly attendance summaries (Jun–Apr)',
      items: attItems,
    },
    {
      title: '6. Class Adviser Narrative Comments',
      category: 'Comments',
      status: commentsPassed ? 'passed' : 'blocked',
      summary: commentsPassed
        ? 'All 3 term comments published'
        : 'Missing published adviser comments for T1, T2, or T3',
      items: commentItems,
    },
  ];
}

export interface AuthenticCalulutSf9ViewerProps {
  mode: 'qa-preview' | 'student';
  studentData?: any;
  onBack: () => void;
}

export function AuthenticCalulutSf9Viewer({
  mode: initialMode,
  studentData,
  onBack,
}: AuthenticCalulutSf9ViewerProps) {
  const [activeMode, setActiveMode] = useState<'qa-preview' | 'student'>(initialMode);
  const [docMode, setDocMode] = useState<'DRAFT' | 'OFFICIAL'>('DRAFT');
  const [meta, setMeta] = useState<any>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [gateReason, setGateReason] = useState<string | null>(null);
  const [blockingReasons, setBlockingReasons] = useState<string[]>([]);
  const [subjectEvaluation, setSubjectEvaluation] = useState<Record<string, any> | null>(null);
  const [prerequisiteEvaluation, setPrerequisiteEvaluation] = useState<any | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isOfficialReady, setIsOfficialReady] = useState<boolean>(false);

  // Adviser Comments Drawer State
  const [isCommentsDrawerOpen, setIsCommentsDrawerOpen] = useState<boolean>(false);
  const [commentsLoading, setCommentsLoading] = useState<boolean>(false);
  const [commentsSaving, setCommentsSaving] = useState<boolean>(false);
  const [activeCommentTerm, setActiveCommentTerm] = useState<'T1' | 'T2' | 'T3'>('T1');
  const [comments, setComments] = useState<Record<string, any>>({ T1: null, T2: null, T3: null });
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({ T1: '', T2: '', T3: '' });
  const [allowCorrection, setAllowCorrection] = useState<boolean>(false);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentsSuccess, setCommentsSuccess] = useState<string | null>(null);

  // Official Issuance State
  const [issuingOfficial, setIssuingOfficial] = useState<boolean>(false);
  const [issuanceSuccess, setIssuanceSuccess] = useState<any>(null);
  const [showIssueModal, setShowIssueModal] = useState<boolean>(false);
  const [selectedReleaseTerm, setSelectedReleaseTerm] = useState<'T1' | 'T2' | 'T3'>('T1');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Release to Student Portal State
  const [isReleased, setIsReleased] = useState<boolean>(false);
  const [showReleaseModal, setShowReleaseModal] = useState<boolean>(false);
  const [releasing, setReleasing] = useState<boolean>(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ id: Date.now(), message, type });
  };

  const rawStudent = studentData?.student || studentData?.data?.student || {};
  const rawEnrollment = studentData?.enrollment || studentData?.data?.enrollment || {};
  const studentId = rawStudent.id || studentData?.id;
  const learnerName = rawStudent.name || (rawStudent.last_name ? `${rawStudent.last_name}, ${rawStudent.first_name}` : 'Enrolled Learner');
  const learnerLrn = rawStudent.lrn || 'Pending';
  const gradeSection =
    rawEnrollment.gradeLevel && rawEnrollment.section
      ? `Grade ${rawEnrollment.gradeLevel} - ${rawEnrollment.section}`
      : rawEnrollment.section || 'Assigned Section';
  const schoolYear = studentData?.school?.academicYear || '2026-2027';

  useEffect(() => {
    setActiveMode(initialMode);
  }, [initialMode]);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setGateReason(null);
    setBlockingReasons([]);
    setSubjectEvaluation(null);
    setPrerequisiteEvaluation(null);
    setRenderError(null);

    let currentObjectUrl: string | null = null;

    try {
      if (activeMode === 'student') {
        if (!studentId) {
          setGateReason('No enrolled student identifier was provided to retrieve academic records.');
          setLoading(false);
          return;
        }

        const endpoint = `${API_BASE_URL}/academic/report-card/${encodeURIComponent(studentId)}/sf9/pdf?mode=${docMode.toLowerCase()}&term=${selectedReleaseTerm}`;
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const pdfResp = await fetch(endpoint, {
          method: 'GET',
          headers,
          credentials: 'include',
        });

        if (!pdfResp.ok) {
          const errJson = await pdfResp.json().catch(() => null);
          const rawList: string[] =
            errJson?.error?.details?.blockingReasons ||
            errJson?.details?.blockingReasons ||
            errJson?.error?.blockingReasons ||
            errJson?.blockingReasons ||
            [];
          const subjEval =
            errJson?.error?.details?.subjectEvaluation ||
            errJson?.details?.subjectEvaluation ||
            null;
          const prereqEval =
            errJson?.error?.details?.prerequisiteEvaluation ||
            errJson?.details?.prerequisiteEvaluation ||
            null;
          const msg =
            errJson?.error?.message ||
            errJson?.message ||
            (docMode === 'OFFICIAL'
              ? 'Official SF9 report card cannot be issued until all prerequisite term grades, verified calendar attendance, adviser comments, and institutional signatories are completed.'
              : 'Draft SF9 report card cannot be generated until learner demographics and term gradebooks are encoded.');

          let parsedReasons: string[] = rawList;
          if (parsedReasons.length === 0 && msg.includes(':')) {
            const parts = msg
              .split(':')
              .slice(1)
              .join(':')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            if (parts.length > 0) parsedReasons = parts;
          }

          setGateReason(msg);
          setBlockingReasons(parsedReasons);
          setSubjectEvaluation(subjEval);
          setPrerequisiteEvaluation(prereqEval);
          setLoading(false);
          return;
        }

        const readyHeader = pdfResp.headers.get('X-Sf9-Official-Ready');
        setIsOfficialReady(readyHeader === 'true');

        const pdfBlob = await pdfResp.blob();
        currentObjectUrl = URL.createObjectURL(pdfBlob);
        setPdfBlobUrl(currentObjectUrl);
        setLoading(false);

        apiClient.get<any>(`/academic/report-card/${encodeURIComponent(studentId)}/released-sf9`)
          .then((res: any) => {
            if (res?.data?.released) setIsReleased(true);
            else setIsReleased(false);
          })
          .catch(() => {});
        return;
      }

      // QA Verification Preview mode: load metadata + LibreOffice-rendered PDF from the populated workbook
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const [metaRes, pdfResp] = await Promise.all([
        apiClient.get<any>('/academic/report-card/sf9/preview/data').catch(() => null),
        fetch(`${API_BASE_URL}/academic/report-card/sf9/preview/pdf`, {
          method: 'GET',
          headers,
          credentials: 'include',
        }),
      ]);

      if (!pdfResp.ok) {
        const errJson = await pdfResp.json().catch(() => null);
        throw new Error(
          errJson?.error?.message ||
            `Failed to render authentic Calulut SF9 workbook (HTTP ${pdfResp.status}).`
        );
      }

      const pdfBlob = await pdfResp.blob();
      currentObjectUrl = URL.createObjectURL(pdfBlob);
      setMeta(metaRes?.payload ? metaRes : metaRes?.data || metaRes);
      setPdfBlobUrl(currentObjectUrl);
      setLoading(false);
    } catch (err: any) {
      setRenderError(err?.message || 'Unable to load the workbook-rendered SF9 document.');
      setLoading(false);
    }
  }, [activeMode, docMode, studentId, selectedReleaseTerm]);

  useEffect(() => {
    let active = true;
    loadDocument();
    return () => {
      active = false;
    };
  }, [loadDocument]);

  // Fetch comments when drawer opens
  const fetchComments = useCallback(async () => {
    if (!studentId) return;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await apiClient.get<any>(`/academic/sf9/comments/students/${studentId}`);
      if (res?.data?.comments) {
        setComments(res.data.comments);
        setCommentDrafts({
          T1: res.data.comments.T1?.commentText || '',
          T2: res.data.comments.T2?.commentText || '',
          T3: res.data.comments.T3?.commentText || '',
        });
      }
    } catch (err: any) {
      setCommentsError(err?.response?.data?.message || err.message || 'Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  }, [studentId]);

  const handleOpenCommentsDrawer = () => {
    setIsCommentsDrawerOpen(true);
    fetchComments();
  };

  const handleSaveComment = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!studentId) return;
    setCommentsSaving(true);
    setCommentsError(null);
    setCommentsSuccess(null);

    try {
      const text = commentDrafts[activeCommentTerm] || '';
      await apiClient.post(`/academic/sf9/comments/students/${studentId}`, {
        term: activeCommentTerm,
        commentText: text.trim(),
        status,
        allowPublishedCorrection: allowCorrection,
        correctionReason: allowCorrection ? correctionReason : undefined,
      });

      setCommentsSuccess(
        `Term ${activeCommentTerm} comment ${status === 'PUBLISHED' ? 'published' : 'saved as draft'} successfully!`
      );
      setAllowCorrection(false);
      setCorrectionReason('');
      await fetchComments();
      // Reload PDF so comments immediately show on the rendered SF9 document!
      await loadDocument();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || err.message;
      setCommentsError(msg || 'Failed to save comment');
    } finally {
      setCommentsSaving(false);
    }
  };

  const handleIssueOfficialSf9 = () => {
    if (!studentId) return;
    setShowIssueModal(true);
  };

  const handleConfirmIssue = async () => {
    if (!studentId) return;
    setIssuingOfficial(true);
    try {
      const reportingPeriod =
        selectedReleaseTerm === 'T1'
          ? 'Term 1 SF9'
          : selectedReleaseTerm === 'T2'
          ? 'Term 2 SF9'
          : 'Annual SF9 (Terms 1-3)';
      const res = await apiClient.post<any>(
        `/academic/report-card/${encodeURIComponent(studentId)}/sf9/issue`,
        { targetTerm: selectedReleaseTerm, reportingPeriod }
      );
      setIssuanceSuccess(res?.data || res);
      showToast(
        `Official SF9 (${reportingPeriod}) successfully issued! (Version ${res?.data?.version || 1})`,
        'success'
      );
      setShowIssueModal(false);
      await loadDocument();
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
        showToast(`Cannot issue ${selectedReleaseTerm} SF9:\n${grouped.join('\n')}`, 'error');
      } else {
        const msg =
          err?.response?.data?.message || err?.response?.data?.error?.message || err.message;
        showToast(`Cannot issue official SF9: ${msg}`, 'error');
      }
    } finally {
      setIssuingOfficial(false);
    }
  };

  const handleConfirmRelease = async () => {
    if (!studentId) return;
    setReleasing(true);
    try {
      const reportingPeriod =
        selectedReleaseTerm === 'T1'
          ? 'Term 1 SF9'
          : selectedReleaseTerm === 'T2'
          ? 'Term 2 SF9'
          : 'Annual SF9 (Terms 1-3)';
      await apiClient.post(`/academic/report-card/${encodeURIComponent(studentId)}/sf9/release`, {
        reportingPeriod,
        targetTerm: selectedReleaseTerm,
      });
      showToast(`Official ${reportingPeriod} successfully released to ${learnerName}'s Student Portal!`, 'success');
      setShowReleaseModal(false);
      setIsReleased(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || err.message;
      showToast(`Cannot release SF9: ${msg}`, 'error');
    } finally {
      setReleasing(false);
    }
  };

  const handlePrintPdf = () => {
    if (!pdfBlobUrl) return;
    const printWin = window.open(pdfBlobUrl, '_blank');
    if (printWin) {
      printWin.focus();
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download =
      activeMode === 'qa-preview'
        ? 'SF9_Calulut_7-Agoncillo_Synthetic_Verification.pdf'
        : `SF9_Calulut_${learnerName.replace(/[^a-zA-Z0-9]/g, '_')}_${docMode}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadExcel = async () => {
    try {
      const endpoint =
        activeMode === 'qa-preview'
          ? `${API_BASE_URL}/academic/report-card/sf9/preview`
          : `${API_BASE_URL}/academic/report-card/${encodeURIComponent(studentId)}/sf9/xlsx?mode=${docMode.toLowerCase()}`;

      const resp = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
      });
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        activeMode === 'qa-preview'
          ? 'SF9_Calulut_7-Agoncillo_Synthetic_Verification.xlsx'
          : `SF9_Calulut_${learnerName.replace(/[^a-zA-Z0-9]/g, '_')}_${docMode}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download populated SF9 workbook', e);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 480,
          color: '#475569',
          background: '#f8fafc',
        }}
      >
        <Loader2 className="animate-spin" size={32} style={{ marginBottom: 14, color: '#8B1E1E' }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
          Rendering Authentic Calulut SF9 Workbook (`SF9 - GRADE 4-10`)...
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          {docMode === 'DRAFT'
            ? 'Populating draft grades, attendance, and adviser comments into master template'
            : 'Enforcing release gate conditions and generating official sealed document'}
        </div>
      </div>
    );
  }

  // Diagnostic Gating Card for Student Mode when conditions are not yet met
  if (activeMode === 'student' && gateReason) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#f8fafc',
          overflow: 'auto',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            background: '#fff',
            borderBottom: '1px solid #e2e8f0',
            padding: '0 20px',
            height: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#8B1E1E',
                background: '#FDF2F2',
                border: '1px solid rgba(139,30,30,0.2)',
                padding: '6px 12px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={13} /> Back to Forms and Records
            </button>
            <div style={{ width: 1, height: 22, background: '#cbd5e1' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {docMode === 'OFFICIAL'
                  ? 'Official SF9 / Form 138 Release Gating Diagnostics'
                  : 'Draft SF9 / Form 138 Record Notice'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Calulut Integrated School · Academic Year {schoolYear}
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                setDocMode(docMode === 'OFFICIAL' ? 'DRAFT' : 'OFFICIAL');
              }}
              style={{
                padding: '6px 14px',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#92400e',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {docMode === 'OFFICIAL' ? 'Switch to Draft Preview' : 'Switch to Official Mode'}
            </button>
          </div>
        </div>

        {/* Gating Details Box */}
        <div style={{ padding: '36px 24px', display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              maxWidth: 680,
              width: '100%',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderTop: '4px solid #f59e0b',
              borderRadius: 8,
              padding: '28px 32px',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: '#fef3c7',
                    color: '#92400e',
                    padding: '2px 8px',
                    borderRadius: 4,
                    marginBottom: 4,
                  }}
                >
                  {docMode === 'OFFICIAL' ? 'Official Release Gated' : 'Draft Record Diagnostic'}
                </span>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {docMode === 'OFFICIAL'
                    ? 'Official Form 138 (SF9-JHS) Requires Complete Records'
                    : 'Draft Form 138 (SF9-JHS) In-Progress Record'}
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '14px 16px',
                marginBottom: 18,
                fontSize: 12.5,
                color: '#334155',
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 8,
                }}
              >
                Learner Identification
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                <div>
                  Name: <strong style={{ color: '#0f172a' }}>{learnerName}</strong>
                </div>
                <div>
                  LRN: <strong style={{ color: '#0f172a' }}>{learnerLrn}</strong>
                </div>
                <div>
                  Grade &amp; Section: <strong style={{ color: '#0f172a' }}>{gradeSection}</strong>
                </div>
                <div>
                  School Year: <strong style={{ color: '#0f172a' }}>{schoolYear}</strong>
                </div>
              </div>
            </div>

            {(() => {
              const categories = categorizeDiagnosticReasons(blockingReasons, studentData, subjectEvaluation, prerequisiteEvaluation);
              return (
                <>
                  <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 18 }}>
                    Under <strong>DepEd Order No. 015, s. 2026</strong> (Implementing Guidelines on Assessment and Grading for the Three-Term Trimester Academic Calendar), the official sealed School Form 9 (Form 138) requires complete, verified academic, attendance, demographic, and signatory records across all three terms (T1, T2, T3).
                    {docMode === 'DRAFT' && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                        In accordance with DepEd policy, draft preview generation requires student demographic and term gradebook records to be encoded. Incomplete records cannot generate a partial report card.
                      </div>
                    )}
                  </div>

                  {/* 6 Authoritative Gating Categories */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                    {categories.map((cat, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: cat.status === 'passed' ? '#f0fdf4' : '#fff',
                          border: `1px solid ${cat.status === 'passed' ? '#bbf7d0' : '#fed7aa'}`,
                          borderLeft: `4px solid ${cat.status === 'passed' ? '#16a34a' : '#ea580c'}`,
                          borderRadius: 6,
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {cat.status === 'passed' ? (
                              <CheckCircle2 size={16} color="#16a34a" />
                            ) : (
                              <AlertTriangle size={16} color="#ea580c" />
                            )}
                            <strong style={{ fontSize: 13, color: '#0f172a' }}>{cat.title}</strong>
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: cat.status === 'passed' ? '#dcfce7' : '#ffedd5',
                              color: cat.status === 'passed' ? '#166534' : '#9a3412',
                            }}
                          >
                            {cat.status === 'passed' ? 'Verified' : 'Prerequisite Missing'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
                          {cat.summary}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '4px 12px' }}>
                          {cat.items.map((item, itemIdx) => (
                            <div
                              key={itemIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 11.5,
                                color: item.ok ? '#1e293b' : '#9a3412',
                              }}
                            >
                              {item.ok ? (
                                <CheckCircle2 size={13} color="#16a34a" style={{ flexShrink: 0 }} />
                              ) : (
                                <XCircle size={13} color="#ea580c" style={{ flexShrink: 0 }} />
                              )}
                              <span>
                                <strong>{item.label}:</strong>{' '}
                                <span style={{ color: item.ok ? '#475569' : '#b45309' }}>{item.detail}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      padding: '12px 14px',
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: 6,
                      color: '#9f1239',
                      fontSize: 12.5,
                      marginBottom: 18,
                    }}
                  >
                    <strong>Diagnostic Blocking Details:</strong>
                    <div style={{ marginTop: 4, wordBreak: 'break-word', fontSize: 11.5, color: '#881337' }}>
                      {gateReason}
                    </div>
                  </div>
                </>
              );
            })()}

            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#1e40af' }}>
                <Info size={18} style={{ flexShrink: 0 }} />
                <span>
                  {docMode === 'OFFICIAL' ? (
                    <>
                      You can inspect the in-progress draft records anytime by
                      switching to <strong>Draft Preview Mode</strong>.
                    </>
                  ) : (
                    <>
                      Once all three-term (T1, T2, T3) gradebooks, school-calendar attendance, and adviser comments are encoded and published, records will be available for{' '}
                      <strong>Official Release</strong>.
                    </>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDocMode(docMode === 'OFFICIAL' ? 'DRAFT' : 'OFFICIAL')}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {docMode === 'OFFICIAL' ? 'Open Draft Preview' : 'Switch to Official Mode'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (renderError || !pdfBlobUrl) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          background: '#f8fafc',
        }}
      >
        <AlertTriangle size={36} color="#dc2626" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
          {renderError ? 'Document Rendering Error' : 'Preview Unavailable'}
        </div>
        <div style={{ fontSize: 13, color: '#475569', maxWidth: 520, textAlign: 'center', marginBottom: 16 }}>
          {renderError || gateReason || 'The requested SF9 document could not be rendered at this time.'}
        </div>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            background: '#8B1E1E',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Back to Forms and Records
        </button>
      </div>
    );
  }

  const currentComment = comments[activeCommentTerm];
  const isCommentPublished = currentComment?.status === 'PUBLISHED';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 'calc(100vh - 70px)',
        background: '#334155',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top Viewer Chrome */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #cbd5e1',
          padding: '0 20px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        {/* Left: Back & Learner Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#8B1E1E',
              background: '#FDF2F2',
              border: '1px solid rgba(139,30,30,0.2)',
              padding: '6px 12px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={13} /> Back
          </button>
          <div style={{ width: 1, height: 22, background: '#cbd5e1' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                {activeMode === 'qa-preview'
                  ? 'DELA CRUZ, JUAN SYNTHETIC — Grade 7 Agoncillo'
                  : `${learnerName} — ${gradeSection}`}
              </span>

              {/* Mode indicator badge */}
              {activeMode === 'qa-preview' ? (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#166534',
                    background: '#dcfce7',
                    border: '1px solid #bbf7d0',
                    padding: '2px 8px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <CheckCircle2 size={11} /> Synthetic Baseline Preview
                </span>
              ) : docMode === 'DRAFT' ? (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#92400e',
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    padding: '2px 8px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <AlertTriangle size={11} /> Draft Preview
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#166534',
                    background: '#dcfce7',
                    border: '1px solid #bbf7d0',
                    padding: '2px 8px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ShieldCheck size={11} /> Official Sealed Mode
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              Source Workbook: <strong>SF9 7-Agoncillo (SY 2026-2027).xlsx</strong> · Sheet: <strong>SF9 - GRADE 4-10</strong> · LRN: <strong>{activeMode === 'qa-preview' ? '999999260001' : learnerLrn}</strong>
            </div>
          </div>
        </div>

        {/* Center: Mode Toggle (Draft vs Official) */}
        {activeMode === 'student' && (
          <div
            style={{
              display: 'flex',
              background: '#f1f5f9',
              padding: 3,
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              gap: 2,
            }}
          >
            <button
              onClick={() => setDocMode('DRAFT')}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background: docMode === 'DRAFT' ? '#fff' : 'transparent',
                color: docMode === 'DRAFT' ? '#b45309' : '#64748b',
                boxShadow: docMode === 'DRAFT' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Draft Preview
            </button>
            <button
              onClick={() => setDocMode('OFFICIAL')}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background: docMode === 'OFFICIAL' ? '#fff' : 'transparent',
                color: docMode === 'OFFICIAL' ? '#15803d' : '#64748b',
                boxShadow: docMode === 'OFFICIAL' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Official Issuance
            </button>
          </div>
        )}

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Adviser Comments Button */}
          {activeMode === 'student' && (
            <button
              onClick={handleOpenCommentsDrawer}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: isCommentsDrawerOpen ? '#1d4ed8' : '#334155',
                background: isCommentsDrawerOpen ? '#dbeafe' : '#fff',
                border: `1px solid ${isCommentsDrawerOpen ? '#93c5fd' : '#cbd5e1'}`,
                borderRadius: 4,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
              title="Edit T1, T2, T3 narrative adviser comments for this learner"
            >
              <MessageSquare size={13} /> Adviser Comments (T1-T3)
            </button>
          )}

          {/* Official Issue Action (shown when in official mode and ready) */}
          {activeMode === 'student' && docMode === 'OFFICIAL' && !gateReason && (
            <button
              onClick={handleIssueOfficialSf9}
              disabled={issuingOfficial}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                background: '#15803d',
                border: 'none',
                borderRadius: 4,
                padding: '6px 14px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
              title="Seal and officially issue this SF9 report card"
            >
              {issuingOfficial ? <Loader2 className="animate-spin" size={13} /> : <Award size={13} />} Issue Official SF9
            </button>
          )}

          {/* Release to Student Portal Action */}
          {activeMode === 'student' && docMode === 'OFFICIAL' && !gateReason && (
            isReleased ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#166534',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  padding: '5px 12px',
                  borderRadius: 4,
                }}
                title="This report card is already released and visible to the student in their portal"
              >
                <CheckCircle2 size={13} /> Released to Student
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowReleaseModal(true)}
                disabled={releasing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(37,99,235,0.2)',
                }}
                title="Authorize release to student portal"
              >
                {releasing ? <Loader2 className="animate-spin" size={13} /> : <Send size={13} />} Release to Student Portal
              </button>
            )
          )}

          <button
            onClick={handlePrintPdf}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#334155',
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            <Printer size={13} /> Print
          </button>

          <button
            onClick={handleDownloadPdf}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#1e293b',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            <FileText size={13} /> PDF
          </button>

          <button
            onClick={handleDownloadExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              background: '#059669',
              border: 'none',
              borderRadius: 4,
              padding: '6px 12px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
            title="Download populated OpenXML workbook (.xlsx)"
          >
            <FileSpreadsheet size={13} /> Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Draft Preview / Official Banner */}
      {activeMode === 'student' && (
        <div
          style={{
            background: docMode === 'DRAFT' ? '#fffbeb' : '#f0fdf4',
            borderBottom: `1px solid ${docMode === 'DRAFT' ? '#fde68a' : '#bbf7d0'}`,
            padding: '7px 20px',
            fontSize: 11,
            color: docMode === 'DRAFT' ? '#92400e' : '#166534',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {docMode === 'DRAFT' ? (
              <AlertTriangle size={14} color="#d97706" />
            ) : (
              <ShieldCheck size={14} color="#16a34a" />
            )}
            <span>
              {docMode === 'DRAFT' ? (
                <>
                  <strong>DRAFT PROGRESS PREVIEW:</strong> Contains saved raw scores and unverified
                  working entries. Watermarked as Non-Official. Not valid for formal school transfer or DepEd graduation.
                </>
              ) : (
                <>
                  <strong>OFFICIAL ISSUANCE MODE:</strong> All gating criteria passed. Authentic Calulut
                  SF9 workbook rendered via headless LibreOffice without draft watermark.
                </>
              )}
            </span>
          </div>

          {docMode === 'DRAFT' && isOfficialReady && (
            <button
              onClick={() => setDocMode('OFFICIAL')}
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: '#166534',
                background: '#dcfce7',
                border: '1px solid #86efac',
                padding: '2px 8px',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              All Records Complete · Switch to Official Issuance &rarr;
            </button>
          )}
        </div>
      )}

      {/* Main Document Viewer Container */}
      <div style={{ flex: 1, width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
        <iframe
          src={`${pdfBlobUrl}#toolbar=1&navpanes=0&view=FitH`}
          title="Authentic Calulut SF9 Workbook-Rendered PDF"
          style={{
            width: isCommentsDrawerOpen ? 'calc(100% - 380px)' : '100%',
            height: '100%',
            border: 'none',
            background: '#525659',
            transition: 'width 0.2s ease',
          }}
        />

        {/* Adviser Narrative Comments Side Drawer */}
        {isCommentsDrawerOpen && (
          <div
            style={{
              width: 380,
              height: '100%',
              background: '#fff',
              borderLeft: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
              zIndex: 20,
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} color="#8B1E1E" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    Adviser Narrative Comments
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748b' }}>
                    DepEd Form 138 Section 4 · Calulut Integrated School
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsCommentsDrawerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
              {/* Learner Info */}
              <div
                style={{
                  background: '#f1f5f9',
                  borderRadius: 6,
                  padding: '10px 12px',
                  marginBottom: 16,
                  fontSize: 11.5,
                  color: '#334155',
                }}
              >
                <div>Learner: <strong style={{ color: '#0f172a' }}>{learnerName}</strong></div>
                <div style={{ marginTop: 2 }}>Section: <strong>{gradeSection}</strong></div>
              </div>

              {/* Term Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  marginBottom: 14,
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: 8,
                }}
              >
                {(['T1', 'T2', 'T3'] as const).map(t => {
                  const isAct = activeCommentTerm === t;
                  const cStatus = comments[t]?.status;
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        setActiveCommentTerm(t);
                        setAllowCorrection(false);
                        setCorrectionReason('');
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: 11.5,
                        fontWeight: 700,
                        borderRadius: 4,
                        border: isAct ? '1.5px solid #8B1E1E' : '1px solid #e2e8f0',
                        background: isAct ? '#8B1E1E' : '#fff',
                        color: isAct ? '#fff' : '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span>Term {t.substring(1)}</span>
                      <span
                        style={{
                          fontSize: 8.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          opacity: isAct ? 0.9 : 0.7,
                        }}
                      >
                        {cStatus === 'PUBLISHED' ? 'Published' : cStatus === 'DRAFT' ? 'Draft' : 'Empty'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Term Status Badge */}
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                  {activeCommentTerm} Comment Status:
                </span>
                {isCommentPublished ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#166534',
                      background: '#dcfce7',
                      border: '1px solid #bbf7d0',
                      padding: '2px 8px',
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Lock size={10} /> PUBLISHED (Sealed)
                  </span>
                ) : currentComment?.status === 'DRAFT' ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#92400e',
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                      padding: '2px 8px',
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Unlock size={10} /> DRAFT
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#64748b',
                      background: '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: 3,
                    }}
                  >
                    NOT RECORDED
                  </span>
                )}
              </div>

              {/* Published Comment Warning & Correction Checkbox */}
              {isCommentPublished && (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 6,
                    padding: 10,
                    marginBottom: 12,
                    fontSize: 11,
                    color: '#92400e',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    Comment is sealed for official SF9 issuance.
                  </div>
                  <div>
                    Last updated by: <strong>{currentComment?.adviserName || 'Class Adviser'}</strong>
                  </div>
                  <label
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      fontWeight: 700,
                      color: '#b45309',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allowCorrection}
                      onChange={e => setAllowCorrection(e.target.checked)}
                    />
                    I want to submit an authorized correction
                  </label>
                  {allowCorrection && (
                    <input
                      type="text"
                      placeholder="Justification for correction (required)..."
                      value={correctionReason}
                      onChange={e => setCorrectionReason(e.target.value)}
                      style={{
                        marginTop: 6,
                        width: '100%',
                        padding: '4px 8px',
                        fontSize: 11,
                        border: '1px solid #cbd5e1',
                        borderRadius: 4,
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              )}

              {/* Textarea */}
              <div style={{ marginBottom: 6 }}>
                <textarea
                  rows={6}
                  maxLength={300}
                  disabled={isCommentPublished && !allowCorrection}
                  value={commentDrafts[activeCommentTerm] || ''}
                  onChange={e =>
                    setCommentDrafts(prev => ({
                      ...prev,
                      [activeCommentTerm]: e.target.value,
                    }))
                  }
                  placeholder={`Enter ${activeCommentTerm} narrative observation on learner's conduct, core values, or academic effort (maximum 300 characters)...`}
                  style={{
                    width: '100%',
                    padding: 10,
                    fontSize: 12,
                    lineHeight: 1.5,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    background: isCommentPublished && !allowCorrection ? '#f8fafc' : '#fff',
                  }}
                />
              </div>

              {/* Character Counter */}
              <div
                style={{
                  textAlign: 'right',
                  fontSize: 10.5,
                  color: (commentDrafts[activeCommentTerm]?.length || 0) > 280 ? '#dc2626' : '#64748b',
                  marginBottom: 16,
                }}
              >
                {commentDrafts[activeCommentTerm]?.length || 0} / 300 characters
              </div>

              {/* Notifications */}
              {commentsError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 11,
                    color: '#b91c1c',
                    marginBottom: 12,
                  }}
                >
                  {commentsError}
                </div>
              )}

              {commentsSuccess && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 11,
                    color: '#166534',
                    marginBottom: 12,
                  }}
                >
                  {commentsSuccess}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  disabled={commentsSaving || (isCommentPublished && !allowCorrection)}
                  onClick={() => handleSaveComment('DRAFT')}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#334155',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {commentsSaving ? <Loader2 className="animate-spin" size={13} /> : null} Save as Draft
                </button>

                <button
                  type="button"
                  disabled={commentsSaving || (isCommentPublished && !allowCorrection)}
                  onClick={() => handleSaveComment('PUBLISHED')}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    background: '#8B1E1E',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}
                >
                  {commentsSaving ? <Loader2 className="animate-spin" size={13} /> : <Lock size={13} />} Publish {activeCommentTerm} Comment
                </button>
              </div>

              <div style={{ marginTop: 16, fontSize: 10.5, color: '#64748b', lineHeight: 1.5 }}>
                <em>Tip:</em> Saved comments are automatically populated into <code>&apos;TEACHERS COMMENTS&apos;!F14/J14/O14</code> and visible in SF9 cells <code>R15</code> (T1), <code>R19</code> (T2), and <code>R23</code> (T3) of the authentic Calulut workbook and rendered immediately in the PDF preview.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modern Modal for Officially Issuing Calulut SF9 (Per-Term) ── */}
      <ModernConfirmModal
        isOpen={showIssueModal}
        onClose={() => !issuingOfficial && setShowIssueModal(false)}
        onConfirm={handleConfirmIssue}
        title={
          selectedReleaseTerm === 'T1'
            ? 'Issue Term 1 SF9'
            : selectedReleaseTerm === 'T2'
            ? 'Issue Term 2 SF9'
            : 'Issue Final Term 3 SF9'
        }
        subtitle={`${learnerName} · LRN: ${learnerLrn} · Calulut Integrated School`}
        badge={{ text: `DepEd SF9 — ${selectedReleaseTerm}`, variant: 'success' }}
        confirmVariant="success"
        confirmLabel={
          selectedReleaseTerm === 'T1'
            ? 'Issue Term 1 SF9'
            : selectedReleaseTerm === 'T2'
            ? 'Issue Term 2 SF9'
            : 'Issue Final Term 3 SF9'
        }
        confirmIcon={<ShieldCheck size={16} />}
        isLoading={issuingOfficial}
        loadingLabel={`Generating & Sealing ${selectedReleaseTerm} Checksums...`}
        checklist={
          selectedReleaseTerm === 'T1'
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
            : selectedReleaseTerm === 'T2'
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
        note={`Official per-term issuance creates an official DepEd academic record for ${selectedReleaseTerm}. Future-term records remain blank until their respective completion.`}
      >
        {/* Term Selection Segmented Controls */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Select Target Release Term
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedReleaseTerm('T1')}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                selectedReleaseTerm === 'T1'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Issue Term 1 SF9
            </button>
            <button
              type="button"
              onClick={() => setSelectedReleaseTerm('T2')}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                selectedReleaseTerm === 'T2'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Issue Term 2 SF9
            </button>
            <button
              type="button"
              onClick={() => setSelectedReleaseTerm('T3')}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                selectedReleaseTerm === 'T3'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Issue Final Term 3 SF9
            </button>
          </div>
        </div>
      </ModernConfirmModal>

      {/* ── Modern Modal for Releasing SF9 to Student Portal ── */}
      <ModernConfirmModal
        isOpen={showReleaseModal}
        onClose={() => !releasing && setShowReleaseModal(false)}
        onConfirm={handleConfirmRelease}
        title="Release Official SF9 to Student Portal"
        subtitle={`${learnerName} · LRN: ${studentId} · Calulut Integrated School`}
        badge={{ text: 'Student Portal Access', variant: 'info' }}
        confirmVariant="primary"
        confirmLabel="Authorize & Release to Student"
        confirmIcon={<Send size={16} />}
        isLoading={releasing}
        loadingLabel="Releasing to Student Portal..."
        checklist={[
          {
            title: 'Authorize Student View',
            description: 'Grants this learner and their parents immediate live access to view their official report card in the Student Portal.',
          },
          {
            title: 'Enable Verified PDF Export',
            description: 'Authorizes student to download the digitally verified, sealed Calulut Form 138 PDF.',
          },
          {
            title: 'Audit Log Trail',
            description: 'Records official release authorization with your administrative user ID and timestamp.',
          },
        ]}
        note="Ensure all scholastic ratings and attendance records have been verified prior to student portal release."
      />

      {/* ── Modern Toast Notification ── */}
      <ModernToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
