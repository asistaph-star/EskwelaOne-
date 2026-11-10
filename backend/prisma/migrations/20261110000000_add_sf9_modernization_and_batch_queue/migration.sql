-- AlterTable
ALTER TABLE "terms" ADD COLUMN IF NOT EXISTS "is_grades_visible_to_students" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "sf9_bulk_batch_jobs" (
    "id" VARCHAR(255) NOT NULL,
    "section_id" VARCHAR(255) NOT NULL,
    "section_name" VARCHAR(255) NOT NULL,
    "target_term" VARCHAR(50) NOT NULL,
    "academic_year_id" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "items_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "actor_id" VARCHAR(255) NOT NULL,
    "actor_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sf9_bulk_batch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_sf9_batch_jobs_section_term" ON "sf9_bulk_batch_jobs"("section_id", "target_term");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_sf9_batch_jobs_status" ON "sf9_bulk_batch_jobs"("status");
