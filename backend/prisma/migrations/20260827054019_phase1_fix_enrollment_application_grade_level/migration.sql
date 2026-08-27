/*
  Warnings:

  - Changed the type of `grade_level` on the `enrollment_applications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "enrollment_applications" DROP COLUMN "grade_level",
ADD COLUMN     "grade_level" INTEGER NOT NULL;
