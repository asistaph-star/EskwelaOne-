-- =============================================================================
-- DIGISKWELA — PHASE G DRAFT MIGRATION SQL (REVIEW ONLY — DO NOT EXECUTE YET)
-- Target Engine: PostgreSQL 17 / Prisma 6.19.3
-- Purpose: Official School Calendar, Whole-Day SF2 Attendance, Adviser Comments,
--          Signatory Snapshots, Published Grade Protection & SF9 Issuance Ledger
-- =============================================================================

BEGIN;

-- ─── 1. Enums ───────────────────────────────────────────────────────────────
CREATE TYPE "Sf9MonthKey" AS ENUM (
  'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR'
);

CREATE TYPE "CalendarMonthStatus" AS ENUM (
  'DRAFT', 'REVIEWED', 'FINALIZED'
);

CREATE TYPE "CalendarDayType" AS ENUM (
  'INSTRUCTIONAL',
  'WEEKEND',
  'REGULAR_HOLIDAY',
  'SPECIAL_NON_WORKING_HOLIDAY',
  'CLASS_SUSPENSION',
  'MAKEUP_INSTRUCTIONAL',
  'SCHOOL_ACTIVITY_NON_INSTRUCTIONAL'
);

CREATE TYPE "CalendarDayApprovalStatus" AS ENUM (
  'DRAFT', 'APPROVED'
);

CREATE TYPE "OfficialAttendanceStatus" AS ENUM (
  'P', 'A', 'L', 'E'
);

CREATE TYPE "OfficialAttendanceRecordStatus" AS ENUM (
  'DRAFT', 'VERIFIED', 'INVALIDATED_NON_INSTRUCTIONAL'
);

CREATE TYPE "CommentPublicationStatus" AS ENUM (
  'DRAFT', 'PUBLISHED'
);

-- ─── 2. Additive Columns & Composite Key Targets on Existing Tables ─────────

-- 2.1 SchoolSettings institutional identity & signatory metadata
ALTER TABLE "school_settings"
  ADD COLUMN "school_id" VARCHAR(20),
  ADD COLUMN "region" VARCHAR(100),
  ADD COLUMN "division" VARCHAR(150),
  ADD COLUMN "district" VARCHAR(150),
  ADD COLUMN "school_head_name" VARCHAR(150),
  ADD COLUMN "school_head_title" VARCHAR(100);

-- 2.2 AcademicYear historical signatory snapshot
ALTER TABLE "academic_years"
  ADD COLUMN "school_head_name_snapshot" VARCHAR(150),
  ADD COLUMN "school_head_title_snapshot" VARCHAR(100),
  ADD CONSTRAINT "academic_years_date_range_chk" CHECK ("end_date" > "start_date");

-- 2.3 Section designated Class Adviser & composite (id, academic_year_id) unique key
ALTER TABLE "sections"
  ADD COLUMN "adviser_teacher_id" VARCHAR(36),
  ADD COLUMN "adviser_assigned_at" TIMESTAMP(3),
  ADD COLUMN "adviser_name_snapshot" VARCHAR(150);

CREATE INDEX "sections_adviser_teacher_id_idx" ON "sections"("adviser_teacher_id");
CREATE UNIQUE INDEX "sections_id_academic_year_id_key" ON "sections"("id", "academic_year_id");

ALTER TABLE "sections"
  ADD CONSTRAINT "sections_adviser_teacher_id_fkey"
  FOREIGN KEY ("adviser_teacher_id") REFERENCES "teachers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2.4 Enrollment transfer date window & composite (id, student_id, section_id, academic_year_id) unique key
ALTER TABLE "enrollments"
  ADD COLUMN "effective_start_date" DATE,
  ADD COLUMN "effective_end_date" DATE,
  ADD CONSTRAINT "enrollments_effective_dates_chk"
    CHECK ("effective_end_date" IS NULL OR "effective_start_date" IS NULL OR "effective_end_date" >= "effective_start_date");

CREATE UNIQUE INDEX "enrollments_id_student_id_section_id_academic_year_id_key"
  ON "enrollments"("id", "student_id", "section_id", "academic_year_id");

ALTER TABLE "enrollments"
  ADD CONSTRAINT "student_enrollments_section_ay_fkey"
  FOREIGN KEY ("section_id", "academic_year_id") REFERENCES "sections"("id", "academic_year_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2.5 Grade published integer snapshot & uniqueness
ALTER TABLE "grades"
  ADD COLUMN "published_term_grade" SMALLINT,
  ADD COLUMN "published_initial_grade" DECIMAL(5, 2),
  ADD COLUMN "published_gradebook_id" VARCHAR(36),
  ADD COLUMN "published_version" INTEGER,
  ADD COLUMN "published_at" TIMESTAMP(3),
  ADD COLUMN "published_by_id" VARCHAR(36),
  ADD COLUMN "publication_correction_reason" VARCHAR(500),
  ADD CONSTRAINT "grades_published_term_grade_range_chk"
    CHECK ("published_term_grade" IS NULL OR ("published_term_grade" BETWEEN 60 AND 100));

CREATE UNIQUE INDEX "grades_student_id_subject_id_term_academic_year_id_key"
  ON "grades"("student_id", "subject_id", "term", "academic_year_id");
CREATE INDEX "grades_published_gradebook_id_idx" ON "grades"("published_gradebook_id");

ALTER TABLE "grades"
  ADD CONSTRAINT "grades_published_gradebook_id_fkey"
    FOREIGN KEY ("published_gradebook_id") REFERENCES "gradebooks"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "grades_published_by_id_fkey"
    FOREIGN KEY ("published_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 3. School Calendar Hierarchy (Normalized NOT NULL Uniqueness) ──────────

CREATE TABLE "school_calendar_months" (
  "id" VARCHAR(36) NOT NULL,
  "academic_year_id" VARCHAR(36) NOT NULL,
  "month_key" "Sf9MonthKey" NOT NULL,
  "calendar_year" INTEGER NOT NULL,
  "calendar_month" INTEGER NOT NULL,
  "status" "CalendarMonthStatus" NOT NULL DEFAULT 'DRAFT',
  "planned_instructional_days" INTEGER,
  "reviewed_by_id" VARCHAR(36),
  "reviewed_at" TIMESTAMP(3),
  "finalized_by_id" VARCHAR(36),
  "finalized_at" TIMESTAMP(3),
  "reopened_by_id" VARCHAR(36),
  "reopened_at" TIMESTAMP(3),
  "reopen_reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "school_calendar_months_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "school_calendar_months_month_range_chk" CHECK ("calendar_month" BETWEEN 1 AND 12),
  CONSTRAINT "school_calendar_months_planned_days_chk" CHECK ("planned_instructional_days" IS NULL OR ("planned_instructional_days" BETWEEN 0 AND 31)),
  CONSTRAINT "school_calendar_months_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "school_calendar_months_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "school_calendar_months_finalized_by_id_fkey"
    FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "school_calendar_months_reopened_by_id_fkey"
    FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "school_calendar_months_academic_year_id_month_key_key"
  ON "school_calendar_months"("academic_year_id", "month_key");
CREATE UNIQUE INDEX "school_calendar_months_academic_year_id_calendar_year_calend_key"
  ON "school_calendar_months"("academic_year_id", "calendar_year", "calendar_month");
CREATE UNIQUE INDEX "school_calendar_months_id_academic_year_id_key"
  ON "school_calendar_months"("id", "academic_year_id");
CREATE INDEX "school_calendar_months_academic_year_id_status_idx"
  ON "school_calendar_months"("academic_year_id", "status");

CREATE TABLE "school_calendar_days" (
  "id" VARCHAR(36) NOT NULL,
  "academic_year_id" VARCHAR(36) NOT NULL,
  "calendar_month_id" VARCHAR(36) NOT NULL,
  "date" DATE NOT NULL,
  "day_type" "CalendarDayType" NOT NULL,
  "is_instructional" BOOLEAN NOT NULL DEFAULT false,
  "description" VARCHAR(255),
  "approval_status" "CalendarDayApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "recorded_by_id" VARCHAR(36) NOT NULL,
  "updated_by_id" VARCHAR(36),
  "approved_by_id" VARCHAR(36),
  "approved_at" TIMESTAMP(3),
  "correction_reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "school_calendar_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "school_calendar_days_instructional_type_chk" CHECK (
    ("day_type" IN ('INSTRUCTIONAL', 'MAKEUP_INSTRUCTIONAL') AND "is_instructional" = TRUE)
    OR ("day_type" NOT IN ('INSTRUCTIONAL', 'MAKEUP_INSTRUCTIONAL') AND "is_instructional" = FALSE)
  ),
  CONSTRAINT "school_calendar_days_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Composite FK guarantees calendar_month_id belongs to the exact same academic_year_id
  CONSTRAINT "school_calendar_days_calendar_month_ay_fkey"
    FOREIGN KEY ("calendar_month_id", "academic_year_id") REFERENCES "school_calendar_months"("id", "academic_year_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "school_calendar_days_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "school_calendar_days_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "school_calendar_days_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "school_calendar_days_academic_year_id_date_key"
  ON "school_calendar_days"("academic_year_id", "date");
CREATE UNIQUE INDEX "school_calendar_days_id_academic_year_id_date_key"
  ON "school_calendar_days"("id", "academic_year_id", "date");
CREATE INDEX "school_calendar_days_calendar_month_id_is_instructional_app_idx"
  ON "school_calendar_days"("calendar_month_id", "is_instructional", "approval_status");

CREATE TABLE "section_calendar_exceptions" (
  "id" VARCHAR(36) NOT NULL,
  "academic_year_id" VARCHAR(36) NOT NULL,
  "section_id" VARCHAR(36) NOT NULL,
  "calendar_day_id" VARCHAR(36) NOT NULL,
  "date" DATE NOT NULL,
  "override_day_type" "CalendarDayType" NOT NULL,
  "override_is_instructional" BOOLEAN NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "approval_status" "CalendarDayApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "recorded_by_id" VARCHAR(36) NOT NULL,
  "approved_by_id" VARCHAR(36),
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "section_calendar_exceptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "section_calendar_exceptions_instructional_type_chk" CHECK (
    ("override_day_type" IN ('INSTRUCTIONAL', 'MAKEUP_INSTRUCTIONAL') AND "override_is_instructional" = TRUE)
    OR ("override_day_type" NOT IN ('INSTRUCTIONAL', 'MAKEUP_INSTRUCTIONAL') AND "override_is_instructional" = FALSE)
  ),
  CONSTRAINT "section_calendar_exceptions_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Composite FK guarantees section_id belongs to the exact same academic_year_id
  CONSTRAINT "section_calendar_exceptions_section_ay_fkey"
    FOREIGN KEY ("section_id", "academic_year_id") REFERENCES "sections"("id", "academic_year_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Composite FK guarantees calendar_day_id matches both academic_year_id and date
  CONSTRAINT "section_calendar_exceptions_calendar_day_ay_date_fkey"
    FOREIGN KEY ("calendar_day_id", "academic_year_id", "date") REFERENCES "school_calendar_days"("id", "academic_year_id", "date")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "section_calendar_exceptions_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "section_calendar_exceptions_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "section_calendar_exceptions_section_id_calendar_day_id_key"
  ON "section_calendar_exceptions"("section_id", "calendar_day_id");
CREATE UNIQUE INDEX "section_calendar_exceptions_academic_year_id_section_id_dat_key"
  ON "section_calendar_exceptions"("academic_year_id", "section_id", "date");
CREATE INDEX "section_calendar_exceptions_calendar_day_id_approval_status_idx"
  ON "section_calendar_exceptions"("calendar_day_id", "approval_status");

-- ─── 4. Official Daily Attendance (Whole-Day DepEd SF2 Record) ──────────────

CREATE TABLE "official_daily_attendance" (
  "id" VARCHAR(36) NOT NULL,
  "academic_year_id" VARCHAR(36) NOT NULL,
  "section_id" VARCHAR(36) NOT NULL,
  "student_id" VARCHAR(36) NOT NULL,
  "enrollment_id" VARCHAR(36) NOT NULL,
  "calendar_day_id" VARCHAR(36) NOT NULL,
  "date" DATE NOT NULL,
  "status" "OfficialAttendanceStatus" NOT NULL,
  "record_status" "OfficialAttendanceRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "tardy_type" VARCHAR(30),
  "remarks" VARCHAR(500),
  "correction_reason" VARCHAR(500),
  "recorded_by_id" VARCHAR(36) NOT NULL,
  "updated_by_id" VARCHAR(36),
  "verified_by_id" VARCHAR(36),
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "official_daily_attendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "official_daily_attendance_tardy_type_chk" CHECK (
    ("status" = 'L' AND ("tardy_type" IS NULL OR "tardy_type" IN ('MORNING', 'AFTERNOON', 'CONSECUTIVE')))
    OR ("status" <> 'L' AND "tardy_type" IS NULL)
  ),
  CONSTRAINT "official_daily_attendance_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "official_daily_attendance_section_ay_fkey"
    FOREIGN KEY ("section_id", "academic_year_id") REFERENCES "sections"("id", "academic_year_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "official_daily_attendance_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Composite FK guarantees enrollment_id matches student_id, section_id, and academic_year_id
  CONSTRAINT "official_daily_attendance_enrollment_composite_fkey"
    FOREIGN KEY ("enrollment_id", "student_id", "section_id", "academic_year_id")
    REFERENCES "enrollments"("id", "student_id", "section_id", "academic_year_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Composite FK guarantees calendar_day_id matches academic_year_id and date
  CONSTRAINT "official_daily_attendance_calendar_day_composite_fkey"
    FOREIGN KEY ("calendar_day_id", "academic_year_id", "date")
    REFERENCES "school_calendar_days"("id", "academic_year_id", "date")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "official_daily_attendance_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "official_daily_attendance_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "official_daily_attendance_verified_by_id_fkey"
    FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "official_daily_attendance_enrollment_id_date_key"
  ON "official_daily_attendance"("enrollment_id", "date");
CREATE UNIQUE INDEX "official_daily_attendance_student_id_date_key"
  ON "official_daily_attendance"("student_id", "date");
CREATE UNIQUE INDEX "official_daily_attendance_enrollment_id_calendar_day_id_key"
  ON "official_daily_attendance"("enrollment_id", "calendar_day_id");
CREATE INDEX "official_daily_attendance_academic_year_id_section_id_date_idx"
  ON "official_daily_attendance"("academic_year_id", "section_id", "date");
CREATE INDEX "official_daily_attendance_enrollment_id_record_status_date_idx"
  ON "official_daily_attendance"("enrollment_id", "record_status", "date");

-- ─── 5. SF9 Adviser Narrative Comments ──────────────────────────────────────

CREATE TABLE "sf9_adviser_comments" (
  "id" VARCHAR(36) NOT NULL,
  "enrollment_id" VARCHAR(36) NOT NULL,
  "student_id" VARCHAR(36) NOT NULL,
  "section_id" VARCHAR(36) NOT NULL,
  "academic_year_id" VARCHAR(36) NOT NULL,
  "term" "TermKey" NOT NULL,
  "comment" TEXT NOT NULL,
  "status" "CommentPublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "recorded_by_id" VARCHAR(36) NOT NULL,
  "updated_by_id" VARCHAR(36),
  "published_by_id" VARCHAR(36),
  "published_at" TIMESTAMP(3),
  "correction_reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sf9_adviser_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sf9_adviser_comments_term_jhs_chk" CHECK ("term" IN ('T1', 'T2', 'T3')),
  -- Composite FK guarantees enrollment_id matches student_id, section_id, and academic_year_id
  CONSTRAINT "sf9_adviser_comments_enrollment_composite_fkey"
    FOREIGN KEY ("enrollment_id", "student_id", "section_id", "academic_year_id")
    REFERENCES "enrollments"("id", "student_id", "section_id", "academic_year_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_adviser_comments_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_adviser_comments_section_ay_fkey"
    FOREIGN KEY ("section_id", "academic_year_id") REFERENCES "sections"("id", "academic_year_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_adviser_comments_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_adviser_comments_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_adviser_comments_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_adviser_comments_published_by_id_fkey"
    FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sf9_adviser_comments_enrollment_id_term_key"
  ON "sf9_adviser_comments"("enrollment_id", "term");
CREATE INDEX "sf9_adviser_comments_enrollment_id_status_idx"
  ON "sf9_adviser_comments"("enrollment_id", "status");
CREATE INDEX "sf9_adviser_comments_student_id_academic_year_id_status_idx"
  ON "sf9_adviser_comments"("student_id", "academic_year_id", "status");
CREATE INDEX "sf9_adviser_comments_section_id_academic_year_id_term_statu_idx"
  ON "sf9_adviser_comments"("section_id", "academic_year_id", "term", "status");

-- ─── 6. Official SF9 Issuance Ledger (Encrypted Snapshot + PDF SHA-256) ─────

CREATE TABLE "sf9_official_issuances" (
  "id" VARCHAR(36) NOT NULL,
  "enrollment_id" VARCHAR(36) NOT NULL,
  "student_id" VARCHAR(36) NOT NULL,
  "section_id" VARCHAR(36) NOT NULL,
  "academic_year_id" VARCHAR(36) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "frozen_payload_encrypted" TEXT NOT NULL,
  "calculated_summary_encrypted" TEXT NOT NULL,
  "template_sha256" VARCHAR(64) NOT NULL,
  "xlsx_sha256" VARCHAR(64) NOT NULL,
  "pdf_sha256" VARCHAR(64) NOT NULL,
  "libreoffice_version" VARCHAR(100) NOT NULL,
  "issued_pdf_document_id" VARCHAR(36),
  "adviser_teacher_id" VARCHAR(36) NOT NULL,
  "adviser_name" VARCHAR(150) NOT NULL,
  "school_head_name" VARCHAR(150) NOT NULL,
  "school_head_title" VARCHAR(100) NOT NULL,
  "issued_by_id" VARCHAR(36) NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "superseded_by_id" VARCHAR(36),
  "correction_reason" VARCHAR(500),

  CONSTRAINT "sf9_official_issuances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sf9_official_issuances_version_positive_chk" CHECK ("version" >= 1),
  CONSTRAINT "sf9_official_issuances_supersession_consistency_chk" CHECK (
    ("is_current" = TRUE AND "superseded_by_id" IS NULL)
    OR ("is_current" = FALSE)
  ),
  -- Composite FK guarantees enrollment_id matches student_id, section_id, and academic_year_id
  CONSTRAINT "sf9_official_issuances_enrollment_composite_fkey"
    FOREIGN KEY ("enrollment_id", "student_id", "section_id", "academic_year_id")
    REFERENCES "enrollments"("id", "student_id", "section_id", "academic_year_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_official_issuances_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_official_issuances_section_ay_fkey"
    FOREIGN KEY ("section_id", "academic_year_id") REFERENCES "sections"("id", "academic_year_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_official_issuances_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_official_issuances_adviser_teacher_id_fkey"
    FOREIGN KEY ("adviser_teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_official_issuances_issued_pdf_document_id_fkey"
    FOREIGN KEY ("issued_pdf_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_official_issuances_issued_by_id_fkey"
    FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sf9_official_issuances_superseded_by_id_fkey"
    FOREIGN KEY ("superseded_by_id") REFERENCES "sf9_official_issuances"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sf9_official_issuances_enrollment_id_version_key"
  ON "sf9_official_issuances"("enrollment_id", "version");
-- Partial unique index: at most ONE current official issuance per enrollment
CREATE UNIQUE INDEX "sf9_official_issuances_one_current_per_enrollment_key"
  ON "sf9_official_issuances"("enrollment_id")
  WHERE ("is_current" = TRUE);
CREATE INDEX "sf9_official_issuances_enrollment_id_is_current_idx"
  ON "sf9_official_issuances"("enrollment_id", "is_current");
CREATE INDEX "sf9_official_issuances_student_id_academic_year_id_is_curre_idx"
  ON "sf9_official_issuances"("student_id", "academic_year_id", "is_current");

COMMIT;

-- =============================================================================
-- OPERATIONAL ROLLBACK & DATA PRESERVATION STRATEGY (NO ROUTINE TABLE DROPS)
-- =============================================================================
-- 1. Pre-Production / Empty-Table Test Rollback (digiskwela_test only, when row count = 0):
--    May drop newly added constraints/tables ONLY after verifying SELECT COUNT(*) = 0
--    on official_daily_attendance, sf9_adviser_comments, and sf9_official_issuances.
-- 2. Operational Rollback (once any real attendance, comment, or issuance row exists):
--    NEVER execute DROP TABLE on populated academic tables. Instead:
--    a) Disable the official SF2/SF9 write/issuance feature flag at the service layer.
--    b) Retain all rows in school_calendar_*, official_daily_attendance,
--       sf9_adviser_comments, and sf9_official_issuances intact with ON DELETE RESTRICT.
--    c) Because all existing tables only received nullable additive columns, prior
--       application code remains 100% compatible without dropping any stored records.

