/**
 * DIGISKWELA — DepEd 2026 Grading Calculation Engine
 * Module: index.ts
 *
 * Public API surface for the isolated grading calculation engine.
 *
 * Consumers import from this barrel file. Direct imports from
 * sub-modules (types.ts, transmutation.ts, etc.) are also permitted
 * when more specific access is needed.
 *
 * IMPORTANT: Nothing exported here touches the database.
 * Official grade publication (Phase 4) will import from here and
 * add persistence coordination separately.
 */

export type {
  GradingPolicyVersion,
  SubjectGroup,
  ComponentWeights,
  ExamInternalWeights,
  AssessmentScore,
  ExamScore,
  StudentTermScoreInput,
  GradingPolicy,
  ComponentResult,
  ExamComponentResult,
  MissingAssessmentRef,
  GradeCalculationResult,
  PolicySelectionParams,
} from './types.js';

export { getGradingPolicy, GradingPolicyError, type GradingPolicyErrorCode } from './policyRegistry.js';
export {
  roundHalfUp,
  transmute2026,
  zeroBasedGrade,
  applyTransmutation,
  TransmutationError,
  getPerformanceDescriptor,
  ADJUSTED_PASSING_IG_THRESHOLD,
  ADJUSTED_TABLE_2026,
} from './transmutation.js';
export { calculateStudentTermGrade } from './calculationEngine.js';
export {
  generateCalulutSf9,
  validateSf9InputCompleteness,
  DEFAULT_MASTER_TEMPLATE_PATH,
  type Sf9Demographics,
  type Sf9SubjectScores,
  type Sf9Attendance,
  type Sf9Comments,
  type GenerateSf9Input,
  type Sf9CalculatedSummary,
  type GenerateSf9Result,
} from './calulutSf9Generator.js';

export {
  AUTHORIZED_SF9_STAFF_ROLES,
  GLOBAL_SF9_ADMIN_ROLES,
  REQUIRED_SUBJECT_KEYS,
  assertAuthorizedSf9Staff,
  assertAuthorizedStaffForSection,
  resolveStudentSf9DataMapping,
  generateSyntheticSf9Preview,
  generateSyntheticSf9PdfPreview,
  generateStudentCalulutSf9,
  generateStudentCalulutSf9Pdf,
  getSyntheticSf9Data,
  type Sf9LearningAreaCellMapping,
  type Sf9MappedSubjectRecord,
  type StudentSf9DataMapping,
} from './calulutSf9Service.js';

export {
  EXPECTED_MASTER_TEMPLATE_SHA256,
  resolveLibreOfficeBinary,
  getCandidateLibreOfficePaths,
  getSf9RenderTmpRoot,
  getSf9RenderJobsDir,
  getSf9RenderTimeoutMs,
  toFileUri,
  assertSafeJobDirectoryPath,
  cleanupJobDirectory,
  clearSf9SyntheticMemoryCache,
  prepareSingleSheetSf9Workbook,
  renderCalulutSf9BufferToPdf,
  checkSf9RendererHealth,
  type Sf9RenderCachePolicy,
  type Sf9RenderOptions,
  type Sf9RendererHealthStatus,
} from './calulutSf9PdfRenderer.js';

export {
  CALULUT_SF9_MONTH_SLOTS,
  CALULUT_SF9_ATTENDANCE_CELLS,
  CALULUT_SF9_COMMENT_CELLS,
  CALULUT_SF9_SIGNATORY_CELLS,
  CALULUT_SF9_GRADE_CELLS,
  parseManilaDateOnly,
  getDaysInCalendarMonth,
  enumerateDatesInMonth,
  validateCalendarMonthDefinition,
  validateCalendarDayRelationship,
  validateSectionCalendarExceptionRelationship,
  validateOfficialDailyAttendanceRelationship,
  evaluateCalendarMonthCompleteness,
  planCalendarDayReclassificationImpact,
  resolveEffectiveInstructionalDaysForSection,
  aggregateStudentMonthlyAttendanceForSf9,
  mapVerifiedSf2SummariesToCalulutSf9Cells,
  validateGradePublicationSnapshot,
  assertGradebookWritableForDraftSave,
  authorizeSectionAdviserOrOverride,
  resolveSf9AdviserCommentsForCells,
  validateOfficialSf9IssuanceRecord,
  type CalendarDayKind,
  type CalendarMonthLifecycleStatus,
  type OfficialAttendanceStatusCode,
  type OfficialAttendanceRecordStatus,
  type ExcusedAttendancePolicy,
  type AdviserCommentStatus,
  type Sf9IssuanceLifecycleStatus,
  type AcademicYearRef,
  type SectionRef,
  type EnrollmentRef,
  type SchoolCalendarMonthRecord,
  type SchoolCalendarDayRecord,
  type SectionCalendarExceptionRecord,
  type OfficialDailyAttendanceRecord,
  type IntegrityValidationResult,
  type ParsedManilaDate,
  type CalendarMonthCompletenessEvaluation,
  type CalendarReclassificationImpactPlan,
  type Sf2MonthAggregationVerificationState,
  type Sf2MonthlyStudentSummary,
  type CalulutSf9AttendanceMappingResult,
  type GradePublicationSnapshotInput,
  type GradePublicationValidationResult,
  type Sf2Sf9ActorRole,
  type AuthorizedActorContext,
  type Sf9AdviserTermCommentRecord,
  type Sf9OfficialIssuanceRecordContract,
} from './calulutSf2Sf9Foundation.js';

export {
  upsertSchoolCalendarMonth,
  upsertSchoolCalendarDay,
  upsertSectionCalendarException,
  finalizeSchoolCalendarMonth,
  reopenSchoolCalendarMonth,
  recordOfficialDailyAttendance,
  verifyOfficialDailyAttendance,
  computePersistedStudentMonthlyAttendance,
  assignSectionClassAdviser,
  saveSf9AdviserComment,
  resolvePersistedSf9Signatories,
  saveDraftGradeLedgerEntry,
  publishSubjectTermGradeSnapshot,
  generatePersistedStudentCalulutSf9FromDb,
  type Sf9MonthKeyLiteral,
  type PersistedStudentSf9AssemblyResult,
} from './calulutSf2Sf9Persistence.service.js';

export { Sf9PipelineProfiler, type Sf9TimingMetrics } from './sf9PipelineTiming.js';
export {
  computeDraftCacheIdentity,
  getCachedDraftPdf,
  setCachedDraftPdf,
} from './sf9DraftCache.js';
