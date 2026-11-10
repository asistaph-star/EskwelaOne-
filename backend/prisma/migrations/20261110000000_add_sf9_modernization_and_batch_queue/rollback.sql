-- ============================================================================
-- DIGISKWELA: DATA-PRESERVING OPERATIONAL ROLLBACK & SCHEMA REVERT SCRIPT
-- Migration: 20261110000000_add_sf9_modernization_and_batch_queue
-- Target: Main Database Integration Safety Procedure
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROCEDURE A: OPERATIONAL (NON-DESTRUCTIVE) SOFT ROLLBACK (RECOMMENDED)
-- Preserves all batch audit logs, job history, and schema integrity.
-- Reverts system behavior immediately without data loss.
-- ----------------------------------------------------------------------------

-- 1. Immediately soft-disable student grade visibility across all terms
UPDATE "terms"
SET "is_grades_visible_to_students" = false
WHERE "is_grades_visible_to_students" = true;

-- 2. Safely cancel all in-flight or queued background SF9 bulk generation jobs
UPDATE "sf9_bulk_batch_jobs"
SET "status" = 'CANCELLED',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "status" IN ('QUEUED', 'RUNNING');

-- ----------------------------------------------------------------------------
-- PROCEDURE B: PRE-REVERSION ARCHIVAL (MANDATORY BEFORE ANY DDL EXECUTION)
-- Creates timestamped snapshot tables to prevent permanent data loss.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "sf9_bulk_batch_jobs_archive_20261110" AS
SELECT * FROM "sf9_bulk_batch_jobs";

CREATE TABLE IF NOT EXISTS "terms_visibility_archive_20261110" AS
SELECT "id", "name", "is_grades_visible_to_students"
FROM "terms";

-- ----------------------------------------------------------------------------
-- PROCEDURE C: EMERGENCY SCHEMA DDL REVERT (EXPLICIT AUTHORIZATION ONLY)
-- Only execute if full schema revert is required AFTER verifying Procedure B.
-- ----------------------------------------------------------------------------

-- Verify archive exists before dropping active tables:
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sf9_bulk_batch_jobs_archive_20261110') THEN
    DROP TABLE IF EXISTS "sf9_bulk_batch_jobs";
    ALTER TABLE "terms" DROP COLUMN IF EXISTS "is_grades_visible_to_students";
  ELSE
    RAISE EXCEPTION 'Rollback aborted: sf9_bulk_batch_jobs_archive_20261110 does not exist. Back up data first.';
  END IF;
END $$;
