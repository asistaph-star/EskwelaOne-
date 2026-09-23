-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "staff_id" VARCHAR(36),
ALTER COLUMN "teacher_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add exactly-one-host constraint
ALTER TABLE "appointments" ADD CONSTRAINT "chk_appointment_host" 
CHECK (("teacher_id" IS NOT NULL AND "staff_id" IS NULL) OR ("teacher_id" IS NULL AND "staff_id" IS NOT NULL));
