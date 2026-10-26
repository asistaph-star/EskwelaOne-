-- Canonicalize existing School IDs across User and domain profiles to uppercase trimmed
UPDATE "users" SET "school_id" = UPPER(TRIM("school_id"));
UPDATE "students" SET "student_number" = UPPER(TRIM("student_number")) WHERE "student_number" IS NOT NULL;
UPDATE "teachers" SET "employee_id" = UPPER(TRIM("employee_id")) WHERE "employee_id" IS NOT NULL;
UPDATE "staff" SET "employee_id" = UPPER(TRIM("employee_id")) WHERE "employee_id" IS NOT NULL;

-- Create functional unique index on LOWER(school_id) to strictly forbid case-variant duplicates
CREATE UNIQUE INDEX "users_school_id_lower_key" ON "users" (LOWER("school_id"));

-- Create functional unique index on LOWER(student_number) for student domain profile
CREATE UNIQUE INDEX "students_student_number_lower_key" ON "students" (LOWER("student_number")) WHERE "student_number" IS NOT NULL;
