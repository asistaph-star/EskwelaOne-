/*
  Warnings:

  - The `time` column on the `clinic_referrals` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `temperature` column on the `clinic_referrals` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `time_in` column on the `gate_attendance` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `time_out` column on the `gate_attendance` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `time` on the `appointments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "time",
ADD COLUMN     "time" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "clinic_referrals" DROP COLUMN "time",
ADD COLUMN     "time" TIMESTAMP(3),
DROP COLUMN "temperature",
ADD COLUMN     "temperature" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "gate_attendance" DROP COLUMN "time_in",
ADD COLUMN     "time_in" TIMESTAMP(3),
DROP COLUMN "time_out",
ADD COLUMN     "time_out" TIMESTAMP(3);
