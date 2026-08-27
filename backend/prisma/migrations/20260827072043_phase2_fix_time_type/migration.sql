-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "time" SET DATA TYPE TIME(3);

-- AlterTable
ALTER TABLE "clinic_referrals" ALTER COLUMN "time" SET DATA TYPE TIME(3);

-- AlterTable
ALTER TABLE "gate_attendance" ALTER COLUMN "time_in" SET DATA TYPE TIME(3),
ALTER COLUMN "time_out" SET DATA TYPE TIME(3);
