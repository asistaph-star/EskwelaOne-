-- AlterTable: add learner demographic names to students table
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "first_name" VARCHAR(100);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "last_name" VARCHAR(100);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "middle_name" VARCHAR(100);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "suffix" VARCHAR(20);

-- Backfill existing learner names from users table safely (names are plain text in both tables)
UPDATE "students" s
SET 
  first_name = u.first_name,
  last_name = u.last_name,
  middle_name = u.middle_name
FROM "users" u
WHERE s.user_id = u.id AND s.first_name IS NULL;

-- AlterTable: make user_id nullable while retaining unique constraint and foreign key
ALTER TABLE "students" ALTER COLUMN "user_id" DROP NOT NULL;

