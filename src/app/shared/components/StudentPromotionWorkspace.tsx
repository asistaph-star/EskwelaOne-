import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search, Filter, Check, X, ArrowRight, Clock,
  RefreshCw, ChevronLeft, ChevronRight, CheckCircle2,
  AlertTriangle, AlertCircle, Award, UserPlus, Eye,
  SlidersHorizontal, RotateCcw, GraduationCap, ShieldCheck,
  CheckCircle, FileText, CheckSquare, Square, MinusSquare,
  HelpCircle, ChevronDown, ChevronUp, Layers, UserCheck,
  XCircle, Info
} from 'lucide-react';
import { academicApi, PromotionRosterParams } from '../../../api/academic.api';

export interface LearnerPromotionItem {
  studentId: string;
  lrn: string;
  fullName: string;
  gender: string;
  currentSectionId: string;
  currentSectionName: string;
  currentGradeLevel: number;
  enrollmentId: string;
  enrollmentStatus: string;
  isAcademicallyComplete: boolean;
  missingRequirements: string[];
  learningAreaRatings: Array<{
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    termGrades: Record<string, number | null>;
    finalRating: number | null;
    isPassed: boolean;
    isMAPEH?: boolean;
  }>;
  totalLearningAreas: number;
  passedLearningAreasCount: number;
  failedLearningAreasCount: number;
  failedLearningAreas: string[];
  generalAverage: number | null;
  eligibility: 'ELIGIBLE_FOR_PROMOTION' | 'JHS_COMPLETER' | 'REMEDIAL_REQUIRED' | 'RETAINED' | 'INCOMPLETE' | 'DEPARTED';
  eligibilityLabel: string;
  recommendedGradeLevel: number | null;
  policyReference: string;
  approval: {
    isApproved: boolean;
    approvedOutcome: 'PROMOTED' | 'RETAINED' | 'COMPLETED' | null;
    approvedAt: string | null;
    approvedById: string | null;
    approvedByName: string | null;
    remarks: string | null;
  };
  nextYearEnrollment: {
    isEnrolled: boolean;
    enrollmentId: string;
    academicYearId: string;
    academicYearName: string;
    sectionId: string;
    sectionName: string;
    gradeLevel: number | null;
    status: string;
  } | null;
}

interface PromotionRosterResponse {
  academicYear: { id: string; name: string; isCurrent: boolean };
  configuredTerms: Array<{ key: string; label: string }>;
  summary: {
    totalLearners: number;
    eligibleCount: number;
    jhsCompleterCount: number;
    remedialCount: number;
    retainedCount: number;
    incompleteCount: number;
    departedCount: number;
    approvedCount: number;
    nextYearEnrolledCount: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalMatching: number;
  };
  totalLearners: number;
  eligibleCount: number;
  remedialCount: number;
  retainedCount: number;
  incompleteCount: number;
  departedCount: number;
  approvedCount: number;
  nextYearEnrolledCount: number;
  learners: LearnerPromotionItem[];
}

export interface LearnerSelectability {
  selectable: boolean;
  reason?: string;
}

/**
 * Evaluates whether a learner is strictly eligible to be selected for bulk operations.
 * Enforces DepEd Order No. 8, s. 2015, DO 11, s. 2018, and G10 program boundary rules.
 */
export function evaluateLearnerSelectability(
  learner: LearnerPromotionItem,
  portal: 'Admin' | 'Principal' | 'Registrar',
  gradeLevelFilter: string,
  selectedStudentIds: Set<string>,
  learnersOnPage: LearnerPromotionItem[]
): LearnerSelectability {
  const isDeparted = learner.enrollmentStatus === 'TRANSFERRED_OUT' ||
                     learner.enrollmentStatus === 'DROPPED_OUT' ||
                     learner.eligibility === 'DEPARTED';

  if (isDeparted) {
    return {
      selectable: false,
      reason: 'Departed learner (DO 11, s. 2018) — ineligible for academic progression'
    };
  }

  // ── REGISTRAR PORTAL: NEXT-YEAR RE-ENROLLMENT ──
  if (portal === 'Registrar') {
    // 1. Grade 10 completers cannot be re-enrolled into Junior High School
    if (learner.currentGradeLevel === 10 || learner.eligibility === 'JHS_COMPLETER') {
      return {
        selectable: false,
        reason: 'Junior High School program boundary — Grade 10 completers do not re-enroll in JHS'
      };
    }

    // 2. Already enrolled in next academic year
    if (learner.nextYearEnrollment && learner.nextYearEnrollment.isEnrolled) {
      return {
        selectable: false,
        reason: 'Already enrolled in next school year'
      };
    }

    // 3. Must have verified Principal approval
    if (!learner.approval.isApproved) {
      return {
        selectable: false,
        reason: 'Pending Principal approval — learner outcome must be approved before next-year enrollment'
      };
    }

    // 4. Must not have incomplete grades
    if (!learner.isAcademicallyComplete || learner.eligibility === 'INCOMPLETE') {
      return {
        selectable: false,
        reason: 'Incomplete published term grades'
      };
    }

    return { selectable: true };
  }

  // ── PRINCIPAL / ADMIN PORTAL: PROMOTION & COMPLETION ──
  // 1. Already approved/confirmed
  if (learner.approval.isApproved) {
    return {
      selectable: false,
      reason: learner.currentGradeLevel === 10
        ? 'JHS Completion already confirmed by Principal'
        : 'Promotion outcome already approved by Principal'
    };
  }

  // 2. Incomplete required grades
  if (!learner.isAcademicallyComplete || learner.eligibility === 'INCOMPLETE') {
    return {
      selectable: false,
      reason: learner.missingRequirements[0] || 'Incomplete published term grades — cannot approve until grades are complete'
    };
  }

  // 3. Retained in current grade level
  if (learner.eligibility === 'RETAINED') {
    return {
      selectable: false,
      reason: `Retained in Grade ${learner.currentGradeLevel} (3+ failing learning areas under DO 8, s. 2015)`
    };
  }

  // 4. Remedial classes required
  if (learner.eligibility === 'REMEDIAL_REQUIRED') {
    return {
      selectable: false,
      reason: 'Remedial classes required under DO 8, s. 2015 before promotion can be deliberated'
    };
  }

  // 5. Grade level boundaries
  const isG10Candidate = learner.currentGradeLevel === 10 &&
    (learner.eligibility === 'JHS_COMPLETER' || learner.eligibility === 'ELIGIBLE_FOR_PROMOTION');
  const isG7to9Candidate = learner.currentGradeLevel >= 7 && learner.currentGradeLevel <= 9 &&
    learner.eligibility === 'ELIGIBLE_FOR_PROMOTION';

  // Check what grade levels are already in the active selection batch
  const selectedLearners = learnersOnPage.filter(l => selectedStudentIds.has(l.studentId));
  const hasG10Selected = selectedLearners.some(l => l.currentGradeLevel === 10);
  const hasG7to9Selected = selectedLearners.some(l => l.currentGradeLevel >= 7 && l.currentGradeLevel <= 9);

  if (gradeLevelFilter === '10') {
    if (isG10Candidate) return { selectable: true };
    return { selectable: false, reason: 'Ineligible for JHS completion' };
  }

  if (gradeLevelFilter === '7' || gradeLevelFilter === '8' || gradeLevelFilter === '9') {
    if (isG7to9Candidate) return { selectable: true };
    return { selectable: false, reason: 'Ineligible for promotion' };
  }

  // In 'ALL' Grade Levels:
  if (hasG10Selected) {
    if (isG10Candidate) return { selectable: true };
    return { selectable: false, reason: 'Cannot mix Grade 7–9 promotion with Grade 10 JHS completion in the same batch' };
  }

  if (hasG7to9Selected) {
    if (isG7to9Candidate) return { selectable: true };
    return { selectable: false, reason: 'Cannot mix Grade 10 JHS completion with Grade 7–9 promotion in the same batch' };
  }

  // Nothing selected yet in 'ALL':
  if (isG7to9Candidate || isG10Candidate) {
    return { selectable: true };
  }

  return { selectable: false, reason: 'Ineligible for academic promotion' };
}

export type BatchModalStage = 'CLOSED' | 'CONFIRM' | 'PROCESSING' | 'RESULTS';

interface StudentPromotionWorkspaceProps {
  academicYearId: string;
  academicYearName: string;
  portal: 'Admin' | 'Principal' | 'Registrar';
}

export function StudentPromotionWorkspace({
  academicYearId,
  academicYearName,
  portal
}: StudentPromotionWorkspaceProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PromotionRosterResponse | null>(null);

  // Available sections for filtering
  const [sectionsList, setSectionsList] = useState<Array<{ id: string; name: string; grade_level: number }>>([]);

  // Server-Side Query Controls
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [gradeLevelFilter, setGradeLevelFilter] = useState<'ALL' | '7' | '8' | '9' | '10'>('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortBy, setSortBy] = useState<'gradeSection' | 'name' | 'generalAverage' | 'outcome' | 'reviewStatus'>('gradeSection');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Row Selection State (IBM Carbon / PatternFly Pattern)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState<boolean>(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Unified Single Batch Action Modal State Machine (Defect 2 Fix)
  const [batchModalStage, setBatchModalStage] = useState<BatchModalStage>('CLOSED');
  const [batchActionType, setBatchActionType] = useState<'PROMOTION' | 'COMPLETION' | 'REGISTRAR_ENROLL'>('PROMOTION');
  const [batchTargetYearId, setBatchTargetYearId] = useState<string>('');
  const [batchTargetSectionId, setBatchTargetSectionId] = useState<string>('');
  const [batchRemarks, setBatchRemarks] = useState<string>('');
  const [submittingBatch, setSubmittingBatch] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<{
    batchId?: string;
    totalRequested: number;
    approvedCount?: number;
    enrolledCount?: number;
    alreadyApprovedCount?: number;
    skippedCount?: number;
    excludedCount: number;
    excludedLearners: Array<{ studentId: string; fullName: string; lrn?: string; reason: string }>;
    message: string;
  } | null>(null);
  const [showExcludedDetails, setShowExcludedDetails] = useState<boolean>(false);

  // Focused Review Modal State (Single Learner)
  const [reviewModalLearner, setReviewModalLearner] = useState<LearnerPromotionItem | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<'PROMOTED' | 'RETAINED' | 'COMPLETED'>('PROMOTED');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Registrar Single Next-Year Enrollment Modal State
  const [enrollModalLearner, setEnrollModalLearner] = useState<LearnerPromotionItem | null>(null);
  const [availableYears, setAvailableYears] = useState<any[]>([]);
  const [selectedTargetYearId, setSelectedTargetYearId] = useState<string>('');
  const [availableTargetSections, setAvailableTargetSections] = useState<any[]>([]);
  const [selectedTargetSectionId, setSelectedTargetSectionId] = useState<string>('');
  const [enrollRemarks, setEnrollRemarks] = useState('');
  const [loadingTargetSections, setLoadingTargetSections] = useState(false);
  const [submittingEnroll, setSubmittingEnroll] = useState(false);

  // Feedback toast banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canApprove = portal === 'Principal' || portal === 'Admin';
  const canEnroll = portal === 'Registrar' || portal === 'Admin';

  // Debounce search input by 280ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [search]);

  // Load sections list once
  useEffect(() => {
    if (academicYearId) {
      academicApi.getSections(academicYearId)
        .then((secs: any) => {
          setSectionsList(Array.isArray(secs) ? secs : []);
        })
        .catch(err => {
          console.error('Failed to load sections for filter:', err);
        });
    }
  }, [academicYearId]);

  // Fetch promotion roster from backend with pagination, sorting & filters
  const fetchRoster = useCallback(async () => {
    if (!academicYearId) return;
    try {
      setLoading(true);
      setError(null);
      const params: PromotionRosterParams = {
        page,
        pageSize,
        search: debouncedSearch.trim() || undefined,
        gradeLevel: gradeLevelFilter !== 'ALL' ? Number(gradeLevelFilter) : undefined,
        sectionId: sectionFilter !== 'ALL' ? sectionFilter : undefined,
        outcome: outcomeFilter !== 'ALL' ? outcomeFilter : undefined,
        reviewStatus: reviewStatusFilter !== 'ALL' ? reviewStatusFilter : undefined,
        sortBy,
        sortOrder
      };
      const res = await academicApi.getPromotionRoster(academicYearId, params);
      const payload = (res as any)?.data || res;
      setData(payload);
    } catch (err: any) {
      console.error('Failed to load promotion roster:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to retrieve promotion worklist.');
    } finally {
      setLoading(false);
    }
  }, [academicYearId, page, pageSize, debouncedSearch, gradeLevelFilter, sectionFilter, outcomeFilter, reviewStatusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const learners = data?.learners || [];
  const pagination = data?.pagination || {
    page: 1,
    pageSize: 25,
    totalPages: 1,
    totalMatching: learners.length
  };
  const summary = data?.summary || {
    totalLearners: data?.totalLearners || 0,
    eligibleCount: data?.eligibleCount || 0,
    jhsCompleterCount: (data as any)?.jhsCompleterCount || 0,
    remedialCount: data?.remedialCount || 0,
    retainedCount: data?.retainedCount || 0,
    incompleteCount: data?.incompleteCount || 0,
    departedCount: data?.departedCount || 0,
    approvedCount: data?.approvedCount || 0,
    nextYearEnrolledCount: data?.nextYearEnrolledCount || 0
  };

  // ── ELIGIBILITY-AWARE SELECTION LOGIC (Defect 1 Fix) ──
  // Evaluates every learner strictly against DO 8, s. 2015 and program boundaries.
  const selectableOnPage = useMemo(() => {
    return learners.filter(l =>
      evaluateLearnerSelectability(l, portal, gradeLevelFilter, selectedStudentIds, learners).selectable
    );
  }, [learners, portal, gradeLevelFilter, selectedStudentIds]);

  const isAllPageSelected = selectableOnPage.length > 0 && selectableOnPage.every(l => selectedStudentIds.has(l.studentId));
  const isSomePageSelected = selectableOnPage.some(l => selectedStudentIds.has(l.studentId)) && !isAllPageSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomePageSelected;
    }
  }, [isSomePageSelected]);

  const toggleSelectAllOnPage = () => {
    if (selectableOnPage.length === 0) return;
    const next = new Set(selectedStudentIds);
    if (isAllPageSelected) {
      // Unselect only selectable learners on current page
      selectableOnPage.forEach(l => next.delete(l.studentId));
      setSelectAllMatching(false);
    } else {
      // Select only eligible learners on current page without mixing cohorts
      let targetsToSelect = selectableOnPage;
      if (portal !== 'Registrar' && gradeLevelFilter === 'ALL') {
        if (hasSelectedGrade10) {
          targetsToSelect = selectableOnPage.filter(l => l.currentGradeLevel === 10);
        } else if (hasSelectedGrade7to9) {
          targetsToSelect = selectableOnPage.filter(l => l.currentGradeLevel >= 7 && l.currentGradeLevel <= 9);
        } else {
          // Default cohort when nothing selected yet:
          const hasEligibleG7to9 = selectableOnPage.some(l => l.currentGradeLevel >= 7 && l.currentGradeLevel <= 9);
          if (hasEligibleG7to9) {
            targetsToSelect = selectableOnPage.filter(l => l.currentGradeLevel >= 7 && l.currentGradeLevel <= 9);
          } else {
            targetsToSelect = selectableOnPage.filter(l => l.currentGradeLevel === 10);
          }
        }
      }
      targetsToSelect.forEach(l => next.add(l.studentId));
    }
    setSelectedStudentIds(next);
  };

  const toggleSelectRow = (studentId: string) => {
    const learner = learners.find(l => l.studentId === studentId);
    if (!learner) return;

    const selectability = evaluateLearnerSelectability(learner, portal, gradeLevelFilter, selectedStudentIds, learners);
    if (!selectability.selectable && !selectedStudentIds.has(studentId)) {
      // Block selecting ineligible records!
      return;
    }

    const next = new Set(selectedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
      setSelectAllMatching(false);
    } else {
      next.add(studentId);
    }
    setSelectedStudentIds(next);
  };

  const clearSelection = useCallback(() => {
    setSelectedStudentIds(new Set());
    setSelectAllMatching(false);
  }, []);

  // Auto-reset selection whenever scope, academic year, page, or filters change to prevent stale carry-over
  useEffect(() => {
    clearSelection();
  }, [academicYearId, gradeLevelFilter, sectionFilter, outcomeFilter, reviewStatusFilter, debouncedSearch, page, clearSelection]);

  // Analyze selected items for batch actions
  const selectedLearnersOnPage = useMemo(() => {
    return learners.filter(l => selectedStudentIds.has(l.studentId));
  }, [learners, selectedStudentIds]);

  const hasSelectedGrade10 = useMemo(() => {
    if (selectAllMatching) {
      return gradeLevelFilter === '10';
    }
    return selectedLearnersOnPage.some(l => l.currentGradeLevel === 10);
  }, [selectAllMatching, gradeLevelFilter, selectedLearnersOnPage]);

  const hasSelectedGrade7to9 = useMemo(() => {
    if (selectAllMatching) {
      return ['7', '8', '9'].includes(gradeLevelFilter) || gradeLevelFilter === 'ALL';
    }
    return selectedLearnersOnPage.some(l => l.currentGradeLevel >= 7 && l.currentGradeLevel <= 9);
  }, [selectAllMatching, gradeLevelFilter, selectedLearnersOnPage]);

  const effectiveSelectedCount = selectAllMatching ? pagination.totalMatching : selectedStudentIds.size;

  // View & Summary eligible counts for intelligent toolbar empty/disabled states
  const eligibleG7to9InView = useMemo(() => {
    return learners.filter(l => l.currentGradeLevel >= 7 && l.currentGradeLevel <= 9 && l.eligibility === 'ELIGIBLE_FOR_PROMOTION' && !l.approval.isApproved).length;
  }, [learners]);

  const eligibleG10InView = useMemo(() => {
    return learners.filter(l => l.currentGradeLevel === 10 && (l.eligibility === 'JHS_COMPLETER' || l.eligibility === 'ELIGIBLE_FOR_PROMOTION') && !l.approval.isApproved).length;
  }, [learners]);

  const totalEligibleG7to9InSummary = Math.max(0, (summary.eligibleCount || 0) - ((data as any)?.summary?.jhsCompleterCount || (data as any)?.jhsCompleterCount || 0));
  const totalEligibleG10InSummary = (data as any)?.summary?.jhsCompleterCount || (data as any)?.jhsCompleterCount || 0;

  // Open focused review modal for single student
  const openReviewModal = (learner: LearnerPromotionItem) => {
    setReviewModalLearner(learner);
    setApprovalRemarks(learner.approval.remarks || '');
    if (learner.approval.isApproved && learner.approval.approvedOutcome) {
      setApprovalDecision(learner.approval.approvedOutcome);
    } else if (learner.currentGradeLevel === 10) {
      setApprovalDecision('COMPLETED');
    } else if (learner.eligibility === 'RETAINED') {
      setApprovalDecision('RETAINED');
    } else {
      setApprovalDecision('PROMOTED');
    }
  };

  // Submit Single Principal Decision
  const handleApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalLearner) return;

    try {
      setSubmittingApproval(true);
      setFeedback(null);
      const res = await academicApi.approvePromotion(academicYearId, {
        studentId: reviewModalLearner.studentId,
        decision: approvalDecision,
        remarks: approvalRemarks.trim() || undefined
      });

      const outcomeText = approvalDecision === 'COMPLETED'
        ? 'Junior High School Completion confirmed'
        : approvalDecision === 'PROMOTED'
          ? `Promotion to Grade ${reviewModalLearner.recommendedGradeLevel} approved`
          : 'Retention confirmed';

      setFeedback({
        type: 'success',
        message: res?.message || `${outcomeText} for ${reviewModalLearner.fullName}.`
      });
      setReviewModalLearner(null);
      fetchRoster();
    } catch (err: any) {
      console.error('Promotion decision submission failed:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err.message || 'Failed to record official decision.'
      });
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Load available target academic years when registrar enroll modal opens
  const openEnrollModal = async (learner: LearnerPromotionItem) => {
    setEnrollModalLearner(learner);
    setEnrollRemarks('');
    setSelectedTargetSectionId('');
    try {
      const years = await academicApi.getYears();
      const otherYears = (years || []).filter((y: any) => y.id !== academicYearId);
      setAvailableYears(otherYears);
      if (otherYears.length > 0) {
        setSelectedTargetYearId(otherYears[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch academic years for enrollment:', err);
    }
  };

  // Open Batch Action Modal
  const openBatchActionModal = async (action: 'PROMOTION' | 'COMPLETION' | 'REGISTRAR_ENROLL') => {
    setBatchActionType(action);
    setBatchRemarks('');
    setBatchResult(null);
    setShowExcludedDetails(false);

    if (action === 'REGISTRAR_ENROLL') {
      try {
        const years = await academicApi.getYears();
        const otherYears = (years || []).filter((y: any) => y.id !== academicYearId);
        setAvailableYears(otherYears);
        if (otherYears.length > 0) {
          setBatchTargetYearId(otherYears[0].id);
          const sections = await academicApi.getSections(otherYears[0].id);
          setAvailableTargetSections(sections || []);
          if (sections && sections.length > 0) {
            setBatchTargetSectionId(sections[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load target years for bulk enrollment:', err);
      }
    }
    setBatchModalStage('CONFIRM');
  };

  // Close Batch Modal cleanly and reset transient states
  const closeBatchModal = () => {
    setBatchModalStage('CLOSED');
    setBatchResult(null);
    clearSelection();
    fetchRoster();
  };

  // Test hook for automated test harness to simulate multi-scenario modal verification
  useEffect(() => {
    (window as any).__setBatchResultForTesting = (data: any) => {
      setBatchResult(data);
      setBatchModalStage('RESULTS');
    };
    (window as any).__setBatchModalStageForTesting = (stage: 'CLOSED' | 'CONFIRM' | 'PROCESSING' | 'RESULTS') => {
      setBatchModalStage(stage);
    };
    return () => {
      delete (window as any).__setBatchResultForTesting;
      delete (window as any).__setBatchModalStageForTesting;
    };
  }, []);

  // Load target sections when batchTargetYearId changes
  useEffect(() => {
    if (batchActionType === 'REGISTRAR_ENROLL' && batchTargetYearId) {
      academicApi.getSections(batchTargetYearId)
        .then((secs: any) => {
          setAvailableTargetSections(secs || []);
          if (secs && secs.length > 0) {
            setBatchTargetSectionId(secs[0].id);
          } else {
            setBatchTargetSectionId('');
          }
        })
        .catch(err => {
          console.error('Failed to load target sections:', err);
          setAvailableTargetSections([]);
        });
    }
  }, [batchActionType, batchTargetYearId]);

  // Execute Batch Principal Approval
  const handleBatchApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchActionType !== 'PROMOTION' && batchActionType !== 'COMPLETION') return;

    try {
      setSubmittingBatch(true);
      setBatchModalStage('PROCESSING');
      setFeedback(null);
      const payload: any = {
        actionType: batchActionType,
        remarks: batchRemarks.trim() || undefined
      };

      if (selectAllMatching) {
        payload.selectAllMatching = true;
        payload.filterScope = {
          gradeLevel: gradeLevelFilter !== 'ALL' ? Number(gradeLevelFilter) : undefined,
          sectionId: sectionFilter !== 'ALL' ? sectionFilter : undefined,
          search: debouncedSearch.trim() || undefined,
          outcome: outcomeFilter !== 'ALL' ? outcomeFilter : undefined
        };
      } else {
        payload.studentIds = Array.from(selectedStudentIds);
      }

      const res = await academicApi.bulkApprovePromotion(academicYearId, payload);
      const resData = (res as any)?.data || res;
      setBatchResult(resData);
      setBatchModalStage('RESULTS');
    } catch (err: any) {
      console.error('Bulk promotion approval failed:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err.message || 'Failed to execute bulk approval.'
      });
      setBatchModalStage('CLOSED');
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Execute Batch Registrar Enrollment
  const handleBatchEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchActionType !== 'REGISTRAR_ENROLL' || !batchTargetYearId || !batchTargetSectionId) return;

    try {
      setSubmittingBatch(true);
      setBatchModalStage('PROCESSING');
      setFeedback(null);

      const targetSec = availableTargetSections.find(s => s.id === batchTargetSectionId);
      const placements = Array.from(selectedStudentIds).map(sid => ({
        studentId: sid,
        targetSectionId: batchTargetSectionId
      }));

      const res = await academicApi.bulkEnrollNextYear(academicYearId, {
        targetAcademicYearId: batchTargetYearId,
        placements,
        remarks: batchRemarks.trim() || undefined
      });

      const resData = (res as any)?.data || res;
      setBatchResult(resData);
      setBatchModalStage('RESULTS');
    } catch (err: any) {
      console.error('Bulk enrollment failed:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err.message || 'Failed to execute bulk next-year enrollment.'
      });
      setBatchModalStage('CLOSED');
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Compute pagination range text
  const startItem = pagination.totalMatching === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.totalMatching);

  const hasActiveFilters = Boolean(
    search.trim() ||
    gradeLevelFilter !== 'ALL' ||
    sectionFilter !== 'ALL' ||
    outcomeFilter !== 'ALL' ||
    reviewStatusFilter !== 'ALL'
  );

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setGradeLevelFilter('ALL');
    setSectionFilter('ALL');
    setOutcomeFilter('ALL');
    setReviewStatusFilter('ALL');
    setPage(1);
    clearSelection();
  };

  return (
    <div className="space-y-3 text-slate-800" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── FEEDBACK TOAST ── */}
      {feedback && (
        <div
          className={`px-3.5 py-2.5 rounded-md flex items-center justify-between border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-rose-700 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── HEADER & COMPACT SUMMARY STRIP (LINEAR STYLE) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              {portal === 'Registrar' ? 'Student Re-Enrollment & Next-Year Placement' : 'Student Promotion & Completion'}
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
              {academicYearName || 'SY 2026–2027'} · Grades 7–10
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
            <span className="font-semibold text-slate-800">{summary.totalLearners}</span> learners
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-emerald-700">{summary.eligibleCount}</span> eligible
            {summary.jhsCompleterCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-indigo-700">{summary.jhsCompleterCount}</span> G10 completers
              </>
            )}
            {summary.remedialCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-amber-700">{summary.remedialCount}</span> remedial
              </>
            )}
            {summary.retainedCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-rose-700">{summary.retainedCount}</span> retained
              </>
            )}
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-600">{summary.incompleteCount}</span> incomplete
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-900">{summary.approvedCount}</span> approved
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRoster()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh promotion worklist"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-slate-400' : 'text-slate-500'} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── SINGLE CLEAN TOOLBAR (LINEAR / SHADCN PATTERN) ── */}
      <div className="bg-white p-2.5 rounded-md border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          {/* Search Input */}
          <div className="relative w-56 sm:w-64">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or LRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1 text-xs border border-slate-200 rounded bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-800 focus:border-slate-800 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Grade Selector */}
          <select
            value={gradeLevelFilter}
            onChange={(e) => { setGradeLevelFilter(e.target.value as any); setPage(1); clearSelection(); }}
            className="py-1 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-800"
          >
            <option value="ALL">All Grades</option>
            <option value="7">Grade 7</option>
            <option value="8">Grade 8</option>
            <option value="9">Grade 9</option>
            <option value="10">Grade 10</option>
          </select>

          {/* Section Selector */}
          <select
            value={sectionFilter}
            onChange={(e) => { setSectionFilter(e.target.value); setPage(1); clearSelection(); }}
            className="py-1 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-800 max-w-[160px] truncate"
          >
            <option value="ALL">All Sections</option>
            {sectionsList.map((s) => (
              <option key={s.id} value={s.id}>Grade {s.grade_level}, Section {s.name}</option>
            ))}
          </select>

          {/* Outcome Filter */}
          <select
            value={outcomeFilter}
            onChange={(e) => { setOutcomeFilter(e.target.value); setPage(1); clearSelection(); }}
            className="py-1 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-800"
          >
            <option value="ALL">All Outcomes</option>
            <option value="ELIGIBLE_FOR_PROMOTION">Eligible for Promotion</option>
            <option value="JHS_COMPLETER">Eligible for JHS Completion</option>
            <option value="REMEDIAL_REQUIRED">Remedial Required</option>
            <option value="RETAINED">Retained</option>
            <option value="INCOMPLETE">Incomplete Grades</option>
            <option value="DEPARTED">Departed (DO 11)</option>
          </select>

          {/* Review Status Filter */}
          <select
            value={reviewStatusFilter}
            onChange={(e) => { setReviewStatusFilter(e.target.value); setPage(1); clearSelection(); }}
            className="py-1 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-800"
          >
            <option value="ALL">All Review Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="ATTENTION">Requires Attention</option>
          </select>

          {/* Reset Action */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right Side: Bulk Action Toolbar Controls + Showing Counter */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Counter Info */}
          <div className="text-[11px] text-slate-500 shrink-0">
            Showing <span className="font-semibold text-slate-900">{startItem}–{endItem}</span> of {pagination.totalMatching}
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />

          {/* ── BULK ACTION CONTROLS IN TOOLBAR ── */}
          {portal === 'Registrar' ? (
            <button
              type="button"
              disabled={effectiveSelectedCount === 0}
              onClick={() => openBatchActionModal('REGISTRAR_ENROLL')}
              title={
                effectiveSelectedCount > 0
                  ? `Re-enroll ${effectiveSelectedCount} selected promoted learner(s) in next school year`
                  : 'Select eligible promoted learners to re-enroll'
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-2xs transition-all ${
                effectiveSelectedCount > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer ring-1 ring-blue-500'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <UserPlus size={13} className={effectiveSelectedCount > 0 ? '' : 'opacity-40'} />
              <span>Bulk Re-Enroll{effectiveSelectedCount > 0 ? ` (${effectiveSelectedCount})` : ''}</span>
            </button>
          ) : (
            /* Principal Bulk Actions */
            <div className="flex items-center gap-1.5">
              {/* Case 1: Filtered to Grade 10 -> Show Confirm JHS Completions */}
              {gradeLevelFilter === '10' && (
                <button
                  type="button"
                  disabled={effectiveSelectedCount === 0}
                  onClick={() => openBatchActionModal('COMPLETION')}
                  title={
                    effectiveSelectedCount > 0
                      ? `Confirm JHS completion for ${effectiveSelectedCount} selected learner(s)`
                      : eligibleG10InView > 0 || totalEligibleG10InSummary > 0
                        ? 'Select eligible learners to approve'
                        : 'No eligible Grade 10 completers available for approval'
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-2xs transition-all ${
                    effectiveSelectedCount > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer ring-1 ring-indigo-500'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <Award size={13} className={effectiveSelectedCount > 0 ? '' : 'opacity-40'} />
                  <span>Confirm JHS Completions{effectiveSelectedCount > 0 ? ` (${effectiveSelectedCount})` : ''}</span>
                </button>
              )}

              {/* Case 2: Filtered to Grade 7, 8, or 9 -> Show Approve Promotions */}
              {['7', '8', '9'].includes(gradeLevelFilter) && (
                <button
                  type="button"
                  disabled={effectiveSelectedCount === 0}
                  onClick={() => openBatchActionModal('PROMOTION')}
                  title={
                    effectiveSelectedCount > 0
                      ? `Approve promotion for ${effectiveSelectedCount} selected learner(s)`
                      : eligibleG7to9InView > 0
                        ? 'Select eligible learners to approve'
                        : `No eligible learners available for promotion in Grade ${gradeLevelFilter} (grades incomplete or retained)`
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-2xs transition-all ${
                    effectiveSelectedCount > 0
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer ring-1 ring-blue-500'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 size={13} className={effectiveSelectedCount > 0 ? '' : 'opacity-40'} />
                  <span>Approve Promotions{effectiveSelectedCount > 0 ? ` (${effectiveSelectedCount})` : ''}</span>
                </button>
              )}

              {/* Case 3: Filtered to 'ALL' Grades -> Show both actions so users see both capabilities */}
              {gradeLevelFilter === 'ALL' && (
                <>
                  {/* Approve Promotions Button (for G7-9) */}
                  <button
                    type="button"
                    disabled={!hasSelectedGrade7to9 || effectiveSelectedCount === 0}
                    onClick={() => openBatchActionModal('PROMOTION')}
                    title={
                      hasSelectedGrade7to9 && effectiveSelectedCount > 0
                        ? `Approve promotion for ${effectiveSelectedCount} selected Grade 7–9 learner(s)`
                        : hasSelectedGrade10
                          ? 'Grade 10 completers selected — clear or filter by Grade 7–9 for promotions'
                          : totalEligibleG7to9InSummary > 0
                            ? 'Select eligible Grade 7–9 learners to approve'
                            : 'No eligible Grade 7–9 learners available (grades incomplete or pending finalization)'
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-2xs transition-all ${
                      hasSelectedGrade7to9 && effectiveSelectedCount > 0
                        ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer ring-1 ring-blue-500'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 size={13} className={hasSelectedGrade7to9 && effectiveSelectedCount > 0 ? '' : 'opacity-40'} />
                    <span>Approve Promotions{hasSelectedGrade7to9 && effectiveSelectedCount > 0 ? ` (${effectiveSelectedCount})` : ''}</span>
                  </button>

                  {/* Confirm JHS Completions Button (for G10) */}
                  <button
                    type="button"
                    disabled={!hasSelectedGrade10 || effectiveSelectedCount === 0}
                    onClick={() => openBatchActionModal('COMPLETION')}
                    title={
                      hasSelectedGrade10 && effectiveSelectedCount > 0
                        ? `Confirm JHS completion for ${effectiveSelectedCount} selected Grade 10 learner(s)`
                        : hasSelectedGrade7to9
                          ? 'Grade 7–9 learners selected — clear or filter by Grade 10 for JHS completions'
                          : totalEligibleG10InSummary > 0
                            ? 'Select eligible Grade 10 learners to approve'
                            : 'No eligible Grade 10 completers available'
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-2xs transition-all ${
                      hasSelectedGrade10 && effectiveSelectedCount > 0
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer ring-1 ring-indigo-500'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    <Award size={13} className={hasSelectedGrade10 && effectiveSelectedCount > 0 ? '' : 'opacity-40'} />
                    <span>Confirm JHS Completions{hasSelectedGrade10 && effectiveSelectedCount > 0 ? ` (${effectiveSelectedCount})` : ''}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── IBM CARBON / PATTERNFLY RESTRAINED BATCH ACTION BAR ── */}
      {selectedStudentIds.size > 0 && (
        <div className="bg-slate-900 text-white px-4 py-2 rounded-md flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-1 duration-150 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-slate-100">
              {effectiveSelectedCount} {effectiveSelectedCount === 1 ? 'learner' : 'learners'} selected
            </span>

            {/* Select all across all pages option */}
            {isAllPageSelected && pagination.totalMatching > learners.length && !selectAllMatching && (
              <span className="text-slate-300 text-[11px]">
                · All {learners.length} learners on this page selected.
                <button
                  type="button"
                  onClick={() => setSelectAllMatching(true)}
                  className="ml-1.5 text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
                >
                  Select all {pagination.totalMatching} learners matching filters
                </button>
              </span>
            )}

            {selectAllMatching && (
              <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                <Check size={12} />
                All {pagination.totalMatching} matching learners selected across all pages
              </span>
            )}

            <button
              type="button"
              onClick={clearSelection}
              className="text-slate-400 hover:text-white text-[11px] font-medium underline ml-1 cursor-pointer"
            >
              Deselect all
            </button>
          </div>

          <div className="flex items-center gap-2">
            {portal === 'Registrar' ? (
              /* Registrar Bulk Action */
              <button
                type="button"
                onClick={() => openBatchActionModal('REGISTRAR_ENROLL')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <UserPlus size={13} />
                <span>Bulk Re-Enroll ({effectiveSelectedCount})</span>
              </button>
            ) : (
              /* Principal Bulk Actions */
              <>
                {/* Mixed Grade Warning */}
                {hasSelectedGrade10 && hasSelectedGrade7to9 ? (
                  <span className="text-[11px] text-amber-300 flex items-center gap-1">
                    <AlertTriangle size={13} />
                    Separate Grade 7–9 Promotions from Grade 10 Completions
                  </span>
                ) : null}

                {/* Approve Selected Promotions (Grade 7–9 only) */}
                {hasSelectedGrade7to9 && !hasSelectedGrade10 && (
                  <button
                    type="button"
                    onClick={() => openBatchActionModal('PROMOTION')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={13} />
                    <span>Approve Selected Promotions ({effectiveSelectedCount})</span>
                  </button>
                )}

                {/* Confirm Selected JHS Completions (Grade 10 only) */}
                {hasSelectedGrade10 && !hasSelectedGrade7to9 && (
                  <button
                    type="button"
                    onClick={() => openBatchActionModal('COMPLETION')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Award size={13} />
                    <span>Confirm Selected JHS Completions ({effectiveSelectedCount})</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── HIGH-DENSITY STREAMLINED ROSTER TABLE WITH SELECTION ── */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-2xs">
        {loading && learners.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw size={20} className="animate-spin text-slate-400 mx-auto mb-2" />
            <div className="text-xs font-semibold text-slate-700">Loading Promotion & Placement Records...</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Evaluating learning-area final ratings under DepEd Order No. 8, s. 2015.</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-700 bg-rose-50/40">
            <AlertCircle size={24} className="mx-auto mb-2 text-rose-600" />
            <div className="text-xs font-bold">{error}</div>
            <button
              onClick={() => fetchRoster()}
              className="mt-3 px-3 py-1 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        ) : learners.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <div className="text-xs font-medium text-slate-600">No student records match the selected criteria.</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Try clearing filters or searching with a different name/LRN.</div>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-3 text-xs text-slate-800 underline font-medium hover:text-slate-950"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-medium text-[11px] tracking-wide">
                  {/* Select All Checkbox Column */}
                  <th className="w-9 py-2.5 px-3 text-center">
                    <input
                      type="checkbox"
                      ref={headerCheckboxRef}
                      checked={isAllPageSelected}
                      disabled={selectableOnPage.length === 0}
                      onChange={toggleSelectAllOnPage}
                      className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        selectableOnPage.length === 0
                          ? 'No eligible unapproved learners available to select on this page'
                          : isAllPageSelected
                          ? 'Deselect all on page'
                          : `Select all ${selectableOnPage.length} eligible unapproved learners on page`
                      }
                      aria-label={
                        selectableOnPage.length === 0
                          ? 'No eligible unapproved learners available to select on this page'
                          : isAllPageSelected
                          ? 'Deselect all on page'
                          : 'Select all eligible on page'
                      }
                    />
                  </th>
                  <th className="py-2.5 px-3 font-semibold">Student</th>
                  <th className="py-2.5 px-3 font-semibold">Grade Level</th>
                  <th className="py-2.5 px-3 font-semibold">Section</th>
                  <th className="py-2.5 px-3 text-center font-semibold">General Average</th>
                  <th className="py-2.5 px-3 font-semibold">Academic Outcome</th>
                  {portal === 'Registrar' ? (
                    <>
                      <th className="py-2.5 px-3 font-semibold">Target Placement</th>
                      <th className="py-2.5 px-3 font-semibold">Re-Enrollment Status</th>
                    </>
                  ) : (
                    <th className="py-2.5 px-3 font-semibold">Review Status</th>
                  )}
                  <th className="py-2.5 px-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {learners.map((learner) => {
                  const selectability = evaluateLearnerSelectability(learner, portal, gradeLevelFilter, selectedStudentIds, learners);
                  const isG10 = learner.currentGradeLevel === 10;
                  const isJhsCompleter = learner.eligibility === 'JHS_COMPLETER' || (isG10 && learner.eligibility === 'ELIGIBLE_FOR_PROMOTION');
                  const isEligible = learner.eligibility === 'ELIGIBLE_FOR_PROMOTION' && !isJhsCompleter;
                  const isRemedial = learner.eligibility === 'REMEDIAL_REQUIRED';
                  const isRetained = learner.eligibility === 'RETAINED';
                  const isIncomplete = learner.eligibility === 'INCOMPLETE';
                  const isDeparted = learner.eligibility === 'DEPARTED';
                  const isApproved = learner.approval.isApproved;
                  const isEnrolled = Boolean(learner.nextYearEnrollment);
                  const isSelected = selectedStudentIds.has(learner.studentId);

                  return (
                    <tr
                      key={learner.studentId}
                      className={`transition-colors h-[40px] leading-tight ${
                        isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Row Checkbox Column */}
                      <td className="py-2 px-3 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!selectability.selectable}
                          onChange={() => toggleSelectRow(learner.studentId)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-0 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          title={selectability.reason || (isSelected ? 'Deselect learner' : 'Select learner for batch processing')}
                          aria-label={selectability.reason ? `${learner.fullName}: ${selectability.reason}` : `Select ${learner.fullName}`}
                        />
                      </td>

                      {/* Column 1: Student (Name + LRN, no gender pill) */}
                      <td className="py-2 px-3 align-middle">
                        <div className="font-medium text-slate-900 text-xs">{learner.fullName}</div>
                        <div className="font-mono text-[11px] text-slate-500 tracking-tight mt-0.5">
                          {learner.lrn}
                        </div>
                      </td>

                      {/* Column 2: Grade Level & Section */}
                      <td className="py-2 px-3 align-middle text-slate-800 font-medium">
                        Grade {learner.currentGradeLevel}
                      </td>
                      <td className="py-2 px-3 align-middle text-slate-600 font-medium">
                        {learner.currentSectionName}
                      </td>

                      {/* Column 3: General Average */}
                      <td className="py-2 px-3 align-middle text-center">
                        {learner.generalAverage !== null ? (
                          <span className="font-mono text-xs font-semibold text-slate-900">
                            {learner.generalAverage}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">—</span>
                        )}
                      </td>

                      {/* Column 4: Academic Outcome (Text-first + Subtle Dot) */}
                      <td className="py-2 px-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          {isEligible && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="text-xs font-medium text-slate-900">
                                Eligible for Promotion
                              </span>
                            </>
                          )}
                          {isJhsCompleter && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                              <span className="text-xs font-medium text-slate-900">
                                Eligible for JHS Completion
                              </span>
                            </>
                          )}
                          {isRemedial && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="text-xs font-medium text-amber-900">
                                Remedial Required ({learner.failedLearningAreasCount || 1})
                              </span>
                            </>
                          )}
                          {isRetained && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                              <span className="text-xs font-medium text-rose-900">
                                Retained in Grade {learner.currentGradeLevel}
                              </span>
                            </>
                          )}
                          {isIncomplete && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                              <span className="text-xs text-slate-500 font-medium">
                                Incomplete Grades
                              </span>
                            </>
                          )}
                          {isDeparted && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                              <span className="text-xs text-slate-400 font-medium">
                                Departed (DO 11)
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Registrar View Extra Columns */}
                      {portal === 'Registrar' ? (
                        <>
                          <td className="py-2 px-3 align-middle text-xs">
                            {isJhsCompleter || learner.approval.approvedOutcome === 'COMPLETED' ? (
                              <span className="text-slate-500 font-medium">JHS Finished (No Next Grade)</span>
                            ) : isRetained ? (
                              <span className="text-slate-700 font-medium">Grade {learner.currentGradeLevel} (Retained)</span>
                            ) : (
                              <span className="text-slate-800 font-medium">Grade {learner.currentGradeLevel + 1}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 align-middle text-xs">
                            {isEnrolled ? (
                              <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span>{learner.nextYearEnrollment?.sectionName || 'Enrolled'}</span>
                              </div>
                            ) : isJhsCompleter || learner.approval.approvedOutcome === 'COMPLETED' ? (
                              <span className="text-slate-400">Not Applicable</span>
                            ) : isApproved || isRetained ? (
                              <span className="text-indigo-700 font-medium">Ready for Placement</span>
                            ) : (
                              <span className="text-slate-400">Awaiting Approval</span>
                            )}
                          </td>
                        </>
                      ) : (
                        /* Principal View: Column 5 Review Status */
                        <td className="py-2 px-3 align-middle text-xs">
                          {isApproved ? (
                            <div className="flex items-center gap-1 text-emerald-700 font-medium">
                              <Check size={13} className="shrink-0" />
                              <span>
                                {learner.approval.approvedOutcome === 'COMPLETED'
                                  ? 'JHS Completion Confirmed'
                                  : learner.approval.approvedOutcome === 'PROMOTED'
                                    ? 'Promotion Approved'
                                    : 'Retention Confirmed'}
                              </span>
                            </div>
                          ) : isJhsCompleter || isEligible ? (
                            <span className="text-slate-500 font-normal">Pending Review</span>
                          ) : isRemedial || isRetained ? (
                            <span className="text-amber-800 font-medium">Requires Attention</span>
                          ) : (
                            <span className="text-slate-400">Not Applicable</span>
                          )}
                        </td>
                      )}

                      {/* Column 6: Action */}
                      <td className="py-2 px-3.5 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {portal === 'Registrar' ? (
                            /* Registrar Action */
                            canEnroll && !isEnrolled && (isApproved || isRetained) && !isJhsCompleter && learner.approval.approvedOutcome !== 'COMPLETED' ? (
                              <button
                                onClick={() => openEnrollModal(learner)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
                              >
                                <UserPlus size={11} />
                                <span>Assign Section</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => openReviewModal(learner)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                              >
                                <Eye size={11} />
                                <span>View</span>
                              </button>
                            )
                          ) : (
                            /* Principal Actions */
                            canApprove && !isApproved && isJhsCompleter ? (
                              <button
                                onClick={() => openReviewModal(learner)}
                                className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
                              >
                                Review Completion
                              </button>
                            ) : canApprove && !isApproved && isEligible ? (
                              <button
                                onClick={() => openReviewModal(learner)}
                                className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
                              >
                                Review
                              </button>
                            ) : (
                              <button
                                onClick={() => openReviewModal(learner)}
                                className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                              >
                                {isApproved ? 'View Decision' : 'Inspect'}
                              </button>
                            )
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

        {/* ── SERVER-SIDE PAGINATION FOOTER ── */}
        <div className="px-3.5 py-2.5 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
                clearSelection();
              }}
              className="py-0.5 px-1.5 border border-slate-200 rounded bg-white text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-400">·</span>
            <span>
              Page <span className="font-semibold text-slate-900">{pagination.page}</span> of {pagination.totalPages}
            </span>
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button
              onClick={() => { setPage((p) => Math.max(p - 1, 1)); clearSelection(); }}
              disabled={pagination.page <= 1 || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft size={13} />
              <span>Previous</span>
            </button>
            <button
              onClick={() => { setPage((p) => Math.min(p + 1, pagination.totalPages)); clearSelection(); }}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <span>Next</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── UNIFIED BATCH ACTION MODAL (ONE MODAL CONTAINER, NO STACKING) ── */}
      {batchModalStage !== 'CLOSED' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[90vh]">
            
            {/* ── STAGE 1: CONFIRM ── */}
            {batchModalStage === 'CONFIRM' && (
              <>
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-slate-800" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      {batchActionType === 'PROMOTION' && 'Confirm Bulk Promotion Approval'}
                      {batchActionType === 'COMPLETION' && 'Confirm Bulk JHS Completion'}
                      {batchActionType === 'REGISTRAR_ENROLL' && 'Confirm Bulk Next-Year Re-Enrollment'}
                    </h3>
                  </div>
                  <button
                    onClick={closeBatchModal}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form
                  onSubmit={batchActionType === 'REGISTRAR_ENROLL' ? handleBatchEnrollSubmit : handleBatchApprovalSubmit}
                  className="p-5 overflow-y-auto space-y-4 text-xs"
                >
                  <div className="p-3.5 bg-slate-50 rounded border border-slate-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Action:</span>
                      <span className="font-semibold text-slate-900">
                        {batchActionType === 'PROMOTION' && 'Approve Promotion (Grades 7–9)'}
                        {batchActionType === 'COMPLETION' && 'Confirm JHS Completion (Grade 10)'}
                        {batchActionType === 'REGISTRAR_ENROLL' && 'Next-Year Re-Enrollment'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Academic Year:</span>
                      <span className="font-medium text-slate-800">{academicYearName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Eligible Selected Count:</span>
                      <span className="font-semibold text-slate-900">
                        {effectiveSelectedCount} {effectiveSelectedCount === 1 ? 'learner' : 'learners'}
                        {selectAllMatching && ' (matching server filters across all pages)'}
                      </span>
                    </div>
                  </div>

                  {batchActionType === 'REGISTRAR_ENROLL' && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block font-semibold text-slate-800 mb-1">
                          Target Academic Year
                        </label>
                        <select
                          value={batchTargetYearId}
                          onChange={(e) => setBatchTargetYearId(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded py-1.5 px-2 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                        >
                          {availableYears.map((y) => (
                            <option key={y.id} value={y.id}>{y.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-800 mb-1">
                          Assign Target Section
                        </label>
                        {availableTargetSections.length === 0 ? (
                          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs">
                            No sections available in this target academic year.
                          </div>
                        ) : (
                          <select
                            value={batchTargetSectionId}
                            onChange={(e) => setBatchTargetSectionId(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded py-1.5 px-2 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                          >
                            {availableTargetSections.map((s) => (
                              <option key={s.id} value={s.id}>Grade {s.grade_level}, Section {s.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Administrative Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={batchRemarks}
                      onChange={(e) => setBatchRemarks(e.target.value)}
                      placeholder="e.g. Batch deliberation approved under DepEd Order No. 8, s. 2015"
                      className="w-full text-xs border border-slate-200 rounded py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-slate-800"
                    />
                  </div>

                  <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded text-[11px] text-blue-900 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-blue-700" />
                      <span>DepEd Academic Safety &amp; Provenance Protocol</span>
                    </div>
                    <p className="text-blue-800/90 leading-relaxed">
                      Every selected record is independently re-validated at execution time. Incomplete learners, departed students,
                      or records with failing grades will be automatically excluded with logged justifications.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={closeBatchModal}
                      disabled={submittingBatch}
                      className="px-3 py-1.5 border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingBatch || effectiveSelectedCount === 0 || (batchActionType === 'REGISTRAR_ENROLL' && !batchTargetSectionId)}
                      className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>
                        {batchActionType === 'PROMOTION' && `Confirm & Approve (${effectiveSelectedCount})`}
                        {batchActionType === 'COMPLETION' && `Confirm JHS Completion (${effectiveSelectedCount})`}
                        {batchActionType === 'REGISTRAR_ENROLL' && `Confirm Bulk Enrollment (${effectiveSelectedCount})`}
                      </span>
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ── STAGE 2: PROCESSING (LINEAR SPINNER STATE) ── */}
            {batchModalStage === 'PROCESSING' && (
              <div className="p-8 text-center space-y-4">
                <RefreshCw size={28} className="animate-spin text-slate-700 mx-auto" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Executing Batch Academic Processing...
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Re-validating eligibility against DepEd Order No. 8, s. 2015 and recording audit provenance. Please wait...
                  </p>
                </div>
              </div>
            )}

            {/* ── STAGE 3: RESULTS (DEFECT 3 COMPLIANT CATEGORIZATION) ── */}
            {batchModalStage === 'RESULTS' && batchResult && (() => {
              const approvedCount = Number(batchResult.approvedCount ?? batchResult.enrolledCount ?? 0);
              const alreadyCount = Number(batchResult.alreadyApprovedCount ?? batchResult.skippedCount ?? 0);
              const excludedCount = Number(batchResult.excludedCount ?? 0);

              // Determine exact scenario
              const isAllApproved = approvedCount > 0 && excludedCount === 0;
              const isPartial = approvedCount > 0 && excludedCount > 0;
              const isZeroApproved = approvedCount === 0 && excludedCount > 0;
              const isAllAlreadyProcessed = approvedCount === 0 && excludedCount === 0 && alreadyCount > 0;

              return (
                <>
                  <div className={`px-5 py-3.5 border-b flex items-center justify-between ${
                    isZeroApproved
                      ? 'bg-rose-50/70 border-rose-200'
                      : isPartial
                      ? 'bg-amber-50/70 border-amber-200'
                      : isAllApproved
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isZeroApproved ? (
                        <XCircle size={18} className="text-rose-700 shrink-0" />
                      ) : isPartial ? (
                        <AlertTriangle size={18} className="text-amber-700 shrink-0" />
                      ) : isAllApproved ? (
                        <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                      ) : (
                        <Info size={18} className="text-slate-700 shrink-0" />
                      )}
                      <h3 className={`text-sm font-semibold ${
                        isZeroApproved
                          ? 'text-rose-950'
                          : isPartial
                          ? 'text-amber-950'
                          : isAllApproved
                          ? 'text-emerald-950'
                          : 'text-slate-900'
                      }`}>
                        {isZeroApproved
                          ? 'Batch Approval Blocked — No Records Approved'
                          : isPartial
                          ? 'Batch Completed with Exclusions'
                          : isAllApproved
                          ? 'Batch Processing Completed Successfully'
                          : isAllAlreadyProcessed
                          ? 'All Selected Records Already Processed'
                          : 'Batch Execution Finished'}
                      </h3>
                    </div>
                    <button
                      onClick={closeBatchModal}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="p-5 overflow-y-auto space-y-4 text-xs">
                    {/* Status Message Banner with accurate chromatic styling */}
                    <div className={`p-3 rounded font-medium border ${
                      isZeroApproved
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : isPartial
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : isAllApproved
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}>
                      {batchResult.message}
                    </div>

                    {/* Results Breakdown Grid */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">Approved</div>
                        <div className={`text-lg font-bold font-mono mt-0.5 ${
                          approvedCount > 0 ? 'text-emerald-700' : 'text-slate-400'
                        }`}>
                          {approvedCount}
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">Already Processed</div>
                        <div className="text-lg font-bold text-slate-700 font-mono mt-0.5">
                          {alreadyCount}
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">Excluded</div>
                        <div className={`text-lg font-bold font-mono mt-0.5 ${
                          excludedCount > 0 ? 'text-rose-700' : 'text-slate-400'
                        }`}>
                          {excludedCount}
                        </div>
                      </div>
                    </div>

                    {/* Excluded Learners List */}
                    {batchResult.excludedLearners && batchResult.excludedLearners.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowExcludedDetails(!showExcludedDetails)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-slate-950 cursor-pointer"
                        >
                          <span>Inspect {batchResult.excludedLearners.length} Excluded Records with Reasons</span>
                          {showExcludedDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {showExcludedDetails && (
                          <div className="border border-slate-200 rounded overflow-hidden max-h-48 overflow-y-auto">
                            <table className="w-full text-left text-[11px] border-collapse">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                <tr>
                                  <th className="py-1 px-2.5">Learner</th>
                                  <th className="py-1 px-2.5">Reason for Exclusion</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {batchResult.excludedLearners.map((ex: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="py-1 px-2.5 font-medium text-slate-900">{ex.fullName}</td>
                                    <td className="py-1 px-2.5 text-rose-700">{ex.reason}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={closeBatchModal}
                        className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 cursor-pointer shadow-2xs"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}

          </div>
        </div>
      )}

      {/* ── FOCUSED STUDENT REVIEW DIALOG (SINGLE LEARNER) ── */}
      {reviewModalLearner && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {portal === 'Registrar' ? 'Learner Academic Standing' : 'Academic Outcome Review'}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  {reviewModalLearner.fullName} · LRN <span className="font-mono">{reviewModalLearner.lrn}</span> · Grade {reviewModalLearner.currentGradeLevel} · {reviewModalLearner.currentSectionName}
                </div>
              </div>
              <button
                onClick={() => setReviewModalLearner(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              
              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">General Average</div>
                  <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                    {reviewModalLearner.generalAverage !== null ? reviewModalLearner.generalAverage : '—'}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">DO 8 Outcome</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    {reviewModalLearner.currentGradeLevel === 10
                      ? 'Eligible for JHS Completion'
                      : reviewModalLearner.eligibility === 'ELIGIBLE_FOR_PROMOTION'
                        ? `Promote to Grade ${reviewModalLearner.recommendedGradeLevel}`
                        : reviewModalLearner.eligibilityLabel}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Learning Areas</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    {reviewModalLearner.passedLearningAreasCount} Passed · {reviewModalLearner.failedLearningAreasCount} Failed
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Review Status</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">
                    {reviewModalLearner.approval.isApproved ? (
                      <span className="text-emerald-700 font-bold">Approved</span>
                    ) : (
                      <span className="text-slate-500">Pending</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Complete Learning Areas Breakdown Table */}
              <div>
                <div className="text-xs font-semibold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>Authoritative Subject Final Ratings</span>
                  <span className="text-[11px] font-normal text-slate-500">DepEd Order No. 8, s. 2015</span>
                </div>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-[11px]">
                        <th className="py-1.5 px-3">Learning Area</th>
                        {(data?.configuredTerms || [
                          { key: 'T1', label: 'TERM 1' },
                          { key: 'T2', label: 'TERM 2' },
                          { key: 'T3', label: 'TERM 3' }
                        ]).map((t) => (
                          <th key={t.key} className="py-1.5 px-2 text-center font-medium">{t.label}</th>
                        ))}
                        <th className="py-1.5 px-2 text-center font-semibold">Final Rating</th>
                        <th className="py-1.5 px-3 text-right font-medium">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {reviewModalLearner.learningAreaRatings && reviewModalLearner.learningAreaRatings.length > 0 ? (
                        reviewModalLearner.learningAreaRatings.map((la) => (
                          <tr key={la.subjectId} className={la.isMAPEH ? 'bg-slate-50/50 font-medium' : ''}>
                            <td className="py-1.5 px-3 text-slate-900">
                              {la.subjectName}
                              {la.isMAPEH && <span className="text-[10px] text-slate-500 ml-1.5">(Consolidated)</span>}
                            </td>
                            {(data?.configuredTerms || [
                              { key: 'T1', label: 'TERM 1' },
                              { key: 'T2', label: 'TERM 2' },
                              { key: 'T3', label: 'TERM 3' }
                            ]).map((t) => (
                              <td key={t.key} className="py-1.5 px-2 text-center font-mono text-slate-600">
                                {la.termGrades?.[t.key] !== null && la.termGrades?.[t.key] !== undefined ? la.termGrades[t.key] : '—'}
                              </td>
                            ))}
                            <td className="py-1.5 px-2 text-center font-mono font-semibold text-slate-900">
                              {la.finalRating !== null ? la.finalRating : '—'}
                            </td>
                            <td className="py-1.5 px-3 text-right">
                              {la.finalRating === null ? (
                                <span className="text-slate-400">Incomplete</span>
                              ) : la.isPassed ? (
                                <span className="text-emerald-700 font-medium">Passed</span>
                              ) : (
                                <span className="text-rose-700 font-medium">Failed</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400">
                            {reviewModalLearner.isAcademicallyComplete
                              ? 'No subject ratings available.'
                              : reviewModalLearner.missingRequirements[0] || 'Incomplete grading periods.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Decision Section (For Principal) */}
              {canApprove && (
                <form onSubmit={handleApprovalSubmit} className="space-y-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Official Principal Decision
                    </label>
                    <select
                      value={approvalDecision}
                      onChange={(e) => setApprovalDecision(e.target.value as any)}
                      className="w-full text-xs border border-slate-200 rounded py-1.5 px-2.5 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                    >
                      {reviewModalLearner.currentGradeLevel === 10 ? (
                        <>
                          <option value="COMPLETED">Confirm Junior High School Completion</option>
                          <option value="RETAINED">Retain in Grade 10 (DO 8, s. 2015)</option>
                        </>
                      ) : (
                        <>
                          <option value="PROMOTED">Promote to Grade {reviewModalLearner.recommendedGradeLevel}</option>
                          <option value="RETAINED">Retain in Grade {reviewModalLearner.currentGradeLevel}</option>
                        </>
                      )}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {reviewModalLearner.currentGradeLevel === 10
                        ? 'Calulut Integrated School JHS ends at Grade 10. Grade 10 learners receive official completion credentials.'
                        : `Authorizes progression under DepEd Order No. 8, s. 2015.`}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Administrative Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      placeholder="e.g. Approved for promotion following satisfactory academic standing."
                      className="w-full text-xs border border-slate-200 rounded py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-slate-800"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewModalLearner(null)}
                      disabled={submittingApproval}
                      className="px-3 py-1.5 border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingApproval || !reviewModalLearner.isAcademicallyComplete}
                      className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      {submittingApproval && <RefreshCw size={12} className="animate-spin" />}
                      <span>
                        {reviewModalLearner.currentGradeLevel === 10
                          ? 'Confirm JHS Completion'
                          : 'Approve Promotion'}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REGISTRAR SINGLE NEXT-YEAR ENROLLMENT MODAL ── */}
      {enrollModalLearner && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Assign Next-Year Placement
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  {enrollModalLearner.fullName} · LRN <span className="font-mono">{enrollModalLearner.lrn}</span>
                </div>
              </div>
              <button
                onClick={() => setEnrollModalLearner(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!enrollModalLearner || !selectedTargetYearId || !selectedTargetSectionId) return;
                try {
                  setSubmittingEnroll(true);
                  const res = await academicApi.enrollNextYear(academicYearId, {
                    studentId: enrollModalLearner.studentId,
                    targetAcademicYearId: selectedTargetYearId,
                    targetSectionId: selectedTargetSectionId,
                    remarks: enrollRemarks.trim() || undefined
                  });
                  setFeedback({
                    type: 'success',
                    message: res?.message || `Student ${enrollModalLearner.fullName} successfully placed into next school year.`
                  });
                  setEnrollModalLearner(null);
                  fetchRoster();
                } catch (err: any) {
                  setFeedback({
                    type: 'error',
                    message: err?.response?.data?.message || err.message || 'Failed to complete next-year enrollment.'
                  });
                } finally {
                  setSubmittingEnroll(false);
                }
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Standing:</span>
                  <span className="font-medium text-slate-900">Grade {enrollModalLearner.currentGradeLevel} · {enrollModalLearner.currentSectionName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Level:</span>
                  <span className="font-semibold text-emerald-800">
                    {enrollModalLearner.eligibility === 'RETAINED'
                      ? `Grade ${enrollModalLearner.currentGradeLevel} (Retained)`
                      : `Grade ${enrollModalLearner.currentGradeLevel + 1} (Promoted)`}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Target Academic Year
                </label>
                <select
                  value={selectedTargetYearId}
                  onChange={(e) => setSelectedTargetYearId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded py-1.5 px-2 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                >
                  {availableYears.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Target Section
                </label>
                {loadingTargetSections ? (
                  <div className="py-2 text-xs text-slate-500 flex items-center gap-1.5">
                    <RefreshCw size={12} className="animate-spin text-slate-400" />
                    <span>Loading available sections...</span>
                  </div>
                ) : availableTargetSections.length === 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs">
                    No sections configured for Grade {enrollModalLearner.eligibility === 'RETAINED' ? enrollModalLearner.currentGradeLevel : enrollModalLearner.currentGradeLevel + 1} in this target school year.
                  </div>
                ) : (
                  <select
                    value={selectedTargetSectionId}
                    onChange={(e) => setSelectedTargetSectionId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded py-1.5 px-2 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                  >
                    {availableTargetSections.map((s) => (
                      <option key={s.id} value={s.id}>Grade {s.grade_level}, Section {s.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Enrollment Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={enrollRemarks}
                  onChange={(e) => setEnrollRemarks(e.target.value)}
                  placeholder="e.g. Regular next-year enrollment following verified promotion."
                  className="w-full text-xs border border-slate-200 rounded py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEnrollModalLearner(null)}
                  disabled={submittingEnroll}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEnroll || !selectedTargetSectionId}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                >
                  {submittingEnroll && <RefreshCw size={12} className="animate-spin" />}
                  <span>Confirm Placement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
