-- Rollback sf9_modernization_and_batch_queue migration
DROP TABLE IF EXISTS "sf9_bulk_batch_jobs";
ALTER TABLE "terms" DROP COLUMN IF EXISTS "is_grades_visible_to_students";
