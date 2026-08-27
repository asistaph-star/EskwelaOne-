/*
  Warnings:

  - You are about to drop the column `diagnosis` on the `clinic_referrals` table. All the data in the column will be lost.
  - You are about to drop the column `medications` on the `clinic_referrals` table. All the data in the column will be lost.
  - You are about to drop the column `symptoms` on the `clinic_referrals` table. All the data in the column will be lost.
  - You are about to drop the column `treatments` on the `clinic_referrals` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `enrollment_applications` table. All the data in the column will be lost.
  - You are about to drop the column `dates` on the `excuse_letters` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `allergies` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `guardian_name` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `medical_conditions` on the `students` table. All the data in the column will be lost.
  - Added the required column `first_name` to the `enrollment_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `enrollment_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `end_date` to the `excuse_letters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date` to the `excuse_letters` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "clinic_referrals" DROP COLUMN "diagnosis",
DROP COLUMN "medications",
DROP COLUMN "symptoms",
DROP COLUMN "treatments";

-- AlterTable
ALTER TABLE "enrollment_applications" DROP COLUMN "name",
ADD COLUMN     "first_name" VARCHAR(100) NOT NULL,
ADD COLUMN     "last_name" VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE "excuse_letters" DROP COLUMN "dates",
ADD COLUMN     "end_date" DATE NOT NULL,
ADD COLUMN     "start_date" DATE NOT NULL;

-- AlterTable
ALTER TABLE "students" DROP COLUMN "address",
DROP COLUMN "allergies",
DROP COLUMN "guardian_name",
DROP COLUMN "medical_conditions",
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "guardian_first_name" VARCHAR(100),
ADD COLUMN     "guardian_last_name" VARCHAR(100),
ADD COLUMN     "state_province" VARCHAR(100),
ADD COLUMN     "street" VARCHAR(255),
ADD COLUMN     "zip_code" VARCHAR(20);

-- CreateTable
CREATE TABLE "student_allergies" (
    "id" VARCHAR(36) NOT NULL,
    "student_id" VARCHAR(36) NOT NULL,
    "allergy" VARCHAR(200) NOT NULL,

    CONSTRAINT "student_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_medical_conditions" (
    "id" VARCHAR(36) NOT NULL,
    "student_id" VARCHAR(36) NOT NULL,
    "condition" VARCHAR(200) NOT NULL,

    CONSTRAINT "student_medical_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_referral_symptoms" (
    "id" VARCHAR(36) NOT NULL,
    "clinic_referral_id" VARCHAR(36) NOT NULL,
    "symptom" VARCHAR(200) NOT NULL,

    CONSTRAINT "clinic_referral_symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_referral_diagnoses" (
    "id" VARCHAR(36) NOT NULL,
    "clinic_referral_id" VARCHAR(36) NOT NULL,
    "diagnosis" VARCHAR(200) NOT NULL,

    CONSTRAINT "clinic_referral_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_referral_medications" (
    "id" VARCHAR(36) NOT NULL,
    "clinic_referral_id" VARCHAR(36) NOT NULL,
    "medication" VARCHAR(200) NOT NULL,

    CONSTRAINT "clinic_referral_medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_referral_treatments" (
    "id" VARCHAR(36) NOT NULL,
    "clinic_referral_id" VARCHAR(36) NOT NULL,
    "treatment" VARCHAR(200) NOT NULL,

    CONSTRAINT "clinic_referral_treatments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "student_allergies" ADD CONSTRAINT "student_allergies_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_medical_conditions" ADD CONSTRAINT "student_medical_conditions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_referral_symptoms" ADD CONSTRAINT "clinic_referral_symptoms_clinic_referral_id_fkey" FOREIGN KEY ("clinic_referral_id") REFERENCES "clinic_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_referral_diagnoses" ADD CONSTRAINT "clinic_referral_diagnoses_clinic_referral_id_fkey" FOREIGN KEY ("clinic_referral_id") REFERENCES "clinic_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_referral_medications" ADD CONSTRAINT "clinic_referral_medications_clinic_referral_id_fkey" FOREIGN KEY ("clinic_referral_id") REFERENCES "clinic_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_referral_treatments" ADD CONSTRAINT "clinic_referral_treatments_clinic_referral_id_fkey" FOREIGN KEY ("clinic_referral_id") REFERENCES "clinic_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
