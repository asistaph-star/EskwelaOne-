-- CreateTable
CREATE TABLE "teacher_scan_credentials" (
    "id" VARCHAR(36) NOT NULL,
    "teacher_id" VARCHAR(36) NOT NULL,
    "scan_identifier" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_scan_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_scan_credentials_identifier_key" ON "teacher_scan_credentials"("scan_identifier");

-- CreateIndex
CREATE INDEX "teacher_scan_credentials_lookup_idx" ON "teacher_scan_credentials"("scan_identifier", "is_active");

-- AddForeignKey
ALTER TABLE "teacher_scan_credentials" ADD CONSTRAINT "teacher_scan_credentials_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
