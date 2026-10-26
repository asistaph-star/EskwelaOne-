-- AlterTable: Remove Calulut seal defaults from logo_url and favicon_url, set neutral footer default
ALTER TABLE "school_settings" 
    ALTER COLUMN "logo_url" DROP DEFAULT,
    ALTER COLUMN "favicon_url" DROP DEFAULT,
    ALTER COLUMN "footer_text" SET DEFAULT 'DigiSkwela · School Management System';

-- Update existing default record to use neutral footer text if still set to DepEd endorsement
UPDATE "school_settings"
SET "footer_text" = 'DigiSkwela · School Management System'
WHERE "footer_text" = 'Official DepEd School Management Platform';
