-- AlterTable: update default school name and short name to authoritative DepEd CIS values
ALTER TABLE "school_settings" 
    ALTER COLUMN "school_name" SET DEFAULT 'Calulut Integrated School',
    ALTER COLUMN "school_short_name" SET DEFAULT 'CIS';

-- Update existing singleton default record to authoritative values, ensuring unverified contact data is null
UPDATE "school_settings"
SET 
    "school_name" = 'Calulut Integrated School',
    "school_short_name" = 'CIS',
    "address" = NULL,
    "contact_email" = NULL,
    "contact_number" = NULL
WHERE "id" = 'default';
