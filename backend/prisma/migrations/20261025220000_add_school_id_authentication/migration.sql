-- 1. Alter users table: add school_id column (nullable initially for backfill)
ALTER TABLE "users" ADD COLUMN "school_id" VARCHAR(100);

-- 2. Alter users table: make email nullable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- 3. Alter students table: add student_number column
ALTER TABLE "students" ADD COLUMN "student_number" VARCHAR(100);

-- 4. Backfill school_id from teachers.employee_id
UPDATE "users" u
SET "school_id" = UPPER(TRIM(t."employee_id"))
FROM "teachers" t
WHERE t."user_id" = u."id" AND t."employee_id" IS NOT NULL;

-- 5. Backfill school_id from staff.employee_id
UPDATE "users" u
SET "school_id" = UPPER(TRIM(s."employee_id"))
FROM "staff" s
WHERE s."user_id" = u."id" AND s."employee_id" IS NOT NULL AND u."school_id" IS NULL;

-- 6. Canonical Demo Accounts explicit deterministic backfill
-- Principal (staff has EMP-P-001)
UPDATE "users" SET "school_id" = 'EMP-P-001' WHERE "email" = 'principal@demo.com';

-- Teacher (teacher has EMP-T-001)
UPDATE "users" SET "school_id" = 'EMP-T-001' WHERE "email" = 'teacher@demo.com';

-- Nurse (staff has EMP-N-001)
UPDATE "users" SET "school_id" = 'EMP-N-001' WHERE "email" = 'nurse@demo.com';

-- Guidance (staff has EMP-G-001)
UPDATE "users" SET "school_id" = 'EMP-G-001' WHERE "email" = 'guidance@demo.com';

-- Registrar (EMP-R-001)
UPDATE "users" SET "school_id" = 'EMP-R-001' WHERE "email" = 'registrar@demo.com';
INSERT INTO "staff" ("id", "user_id", "employee_id", "department", "position", "created_at", "updated_at")
SELECT 'demo-staff-reg-1', u."id", 'EMP-R-001', 'Registrar Office', 'Registrar I', NOW(), NOW()
FROM "users" u
WHERE u."email" = 'registrar@demo.com'
  AND NOT EXISTS (SELECT 1 FROM "staff" WHERE "user_id" = u."id");

-- Admin (ADM-001)
UPDATE "users" SET "school_id" = 'ADM-001' WHERE "email" = 'admin@demo.com';

-- ITAdmin (IT-001)
UPDATE "users" SET "school_id" = 'IT-001' WHERE "email" = 'itadmin@demo.com';

-- GateOperator (GATE-001)
UPDATE "users" SET "school_id" = 'GATE-001' WHERE "email" = 'gate@demo.com';

-- Student demo account (2026-00001)
UPDATE "users" SET "school_id" = '2026-00001' WHERE "email" = 'student@demo.com';
UPDATE "students" SET "student_number" = '2026-00001' WHERE "user_id" = (SELECT "id" FROM "users" WHERE "email" = 'student@demo.com');

-- 7. Demo students demo.student01 to demo.student24
UPDATE "users" SET "school_id" = '2026-10001' WHERE "email" = 'demo.student01@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10002' WHERE "email" = 'demo.student02@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10003' WHERE "email" = 'demo.student03@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10004' WHERE "email" = 'demo.student04@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10005' WHERE "email" = 'demo.student05@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10006' WHERE "email" = 'demo.student06@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10007' WHERE "email" = 'demo.student07@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10008' WHERE "email" = 'demo.student08@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10009' WHERE "email" = 'demo.student09@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10010' WHERE "email" = 'demo.student10@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10011' WHERE "email" = 'demo.student11@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10012' WHERE "email" = 'demo.student12@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10013' WHERE "email" = 'demo.student13@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10014' WHERE "email" = 'demo.student14@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10015' WHERE "email" = 'demo.student15@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10016' WHERE "email" = 'demo.student16@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10017' WHERE "email" = 'demo.student17@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10018' WHERE "email" = 'demo.student18@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10019' WHERE "email" = 'demo.student19@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10020' WHERE "email" = 'demo.student20@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10021' WHERE "email" = 'demo.student21@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10022' WHERE "email" = 'demo.student22@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10023' WHERE "email" = 'demo.student23@calulut.edu.ph';
UPDATE "users" SET "school_id" = '2026-10024' WHERE "email" = 'demo.student24@calulut.edu.ph';

-- Sync student_number on students for demo students
UPDATE "students" s
SET "student_number" = u."school_id"
FROM "users" u
WHERE s."user_id" = u."id" AND u."school_id" IS NOT NULL AND s."student_number" IS NULL;

-- 8. Backfill any fixture students if existing (fix-user-student-XX)
UPDATE "users"
SET "school_id" = 'FIX-STU-' || SUBSTRING("id" FROM 18)
WHERE "id" LIKE 'fix-user-student-%' AND "school_id" IS NULL;

UPDATE "students" s
SET "student_number" = u."school_id"
FROM "users" u
WHERE s."user_id" = u."id" AND u."id" LIKE 'fix-user-student-%' AND s."student_number" IS NULL;

-- 9. Fallback for any other remaining users
UPDATE "users"
SET "school_id" = 'SCH-' || RIGHT(REPLACE("id", '-', ''), 10)
WHERE "school_id" IS NULL;

UPDATE "students" s
SET "student_number" = u."school_id"
FROM "users" u
WHERE s."user_id" = u."id" AND s."student_number" IS NULL;

-- 10. Enforce NOT NULL and UNIQUE on users.school_id
ALTER TABLE "users" ALTER COLUMN "school_id" SET NOT NULL;
CREATE UNIQUE INDEX "users_school_id_key" ON "users"("school_id");

-- 11. Enforce UNIQUE on students.student_number
CREATE UNIQUE INDEX "student_profiles_student_number_key" ON "students"("student_number");
