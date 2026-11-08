-- CreateTable: student_health_metrics
CREATE TABLE IF NOT EXISTS "student_health_metrics" (
    "id" VARCHAR(36) NOT NULL,
    "student_id" VARCHAR(36) NOT NULL,
    "academic_year_id" VARCHAR(36) NOT NULL,
    "section_id" VARCHAR(36) NOT NULL,
    "enrollment_id" VARCHAR(36),
    "measurement_period" VARCHAR(30) NOT NULL,
    "measurement_date" DATE NOT NULL,
    "height_cm" DECIMAL(5,2) NOT NULL,
    "weight_kg" DECIMAL(5,2) NOT NULL,
    "computed_age_years" INTEGER,
    "computed_age_months" INTEGER,
    "computed_bmi" DECIMAL(5,2),
    "bmi_category" VARCHAR(50),
    "hfa_category" VARCHAR(50),
    "assessment_status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_INPUTS',
    "who_reference_version" VARCHAR(50) NOT NULL DEFAULT 'WHO_2007_GROWTH_REFERENCE',
    "calculation_engine_version" VARCHAR(50) NOT NULL DEFAULT 'DIGISKWELA_CALULUT_HEALTH_V1',
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "correction_of_metric_id" VARCHAR(36),
    "correction_reason" VARCHAR(500),
    "remarks" VARCHAR(500),
    "recorded_by_id" VARCHAR(36) NOT NULL,
    "verified_by_id" VARCHAR(36),
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_health_metrics_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "student_health_metrics_student_id_is_latest_idx" ON "student_health_metrics"("student_id", "is_latest");
CREATE INDEX IF NOT EXISTS "student_health_metrics_student_id_ay_period_idx" ON "student_health_metrics"("student_id", "academic_year_id", "measurement_period");
CREATE INDEX IF NOT EXISTS "student_health_metrics_section_id_ay_period_idx" ON "student_health_metrics"("section_id", "academic_year_id", "measurement_period");

-- Foreign Keys (onDelete: Restrict)
ALTER TABLE "student_health_metrics" ADD CONSTRAINT "student_health_metrics_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_health_metrics" ADD CONSTRAINT "student_health_metrics_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_health_metrics" ADD CONSTRAINT "student_health_metrics_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_health_metrics" ADD CONSTRAINT "student_health_metrics_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_health_metrics" ADD CONSTRAINT "student_health_metrics_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_health_metrics" ADD CONSTRAINT "student_health_metrics_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_health_metrics" ADD CONSTRAINT "student_health_metrics_correction_of_metric_id_fkey" FOREIGN KEY ("correction_of_metric_id") REFERENCES "student_health_metrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

