-- CreateTable
CREATE TABLE "faculty_attendance" (
    "id" VARCHAR(36) NOT NULL,
    "teacher_id" VARCHAR(36) NOT NULL,
    "date" DATE NOT NULL,
    "time_in" TIMESTAMPTZ(3),
    "time_out" TIMESTAMPTZ(3),
    "capture_source" VARCHAR(30) NOT NULL DEFAULT 'web_teacher',
    "override_status" VARCHAR(30),
    "override_remarks" VARCHAR(255),
    "corrected_by_id" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faculty_attendance_teacher_id_date_key" ON "faculty_attendance"("teacher_id", "date");

-- CreateIndex
CREATE INDEX "faculty_attendance_date_idx" ON "faculty_attendance"("date");

-- CreateIndex
CREATE INDEX "faculty_attendance_teacher_id_date_idx" ON "faculty_attendance"("teacher_id", "date");

-- AddForeignKey
ALTER TABLE "faculty_attendance" ADD CONSTRAINT "faculty_attendance_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_attendance" ADD CONSTRAINT "faculty_attendance_corrected_by_id_fkey" FOREIGN KEY ("corrected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
