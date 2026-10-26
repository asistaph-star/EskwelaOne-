-- CreateTable
CREATE TABLE "school_settings" (
    "id" VARCHAR(36) NOT NULL DEFAULT 'default',
    "school_name" VARCHAR(255) NOT NULL DEFAULT 'Calulut Integrated National High School',
    "school_short_name" VARCHAR(50) NOT NULL DEFAULT 'CINHS',
    "logo_url" VARCHAR(500) DEFAULT '/school_seal.png',
    "favicon_url" VARCHAR(500) DEFAULT '/school_seal.png',
    "login_background_url" VARCHAR(500),
    "primary_color" VARCHAR(20) NOT NULL DEFAULT '#0A192F',
    "secondary_color" VARCHAR(20) NOT NULL DEFAULT '#1B3A6B',
    "accent_color" VARCHAR(20) NOT NULL DEFAULT '#F5A623',
    "address" VARCHAR(255),
    "contact_email" VARCHAR(255),
    "contact_number" VARCHAR(50),
    "login_welcome_text" VARCHAR(255) DEFAULT 'Education Shapes the Future',
    "footer_text" VARCHAR(255) DEFAULT 'Official DepEd School Management Platform',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" VARCHAR(36),

    CONSTRAINT "school_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert initial singleton configuration
INSERT INTO "school_settings" (
    "id",
    "school_name",
    "school_short_name",
    "logo_url",
    "favicon_url",
    "primary_color",
    "secondary_color",
    "accent_color",
    "login_welcome_text",
    "footer_text",
    "updated_at"
)
VALUES (
    'default',
    'Calulut Integrated National High School',
    'CINHS',
    '/school_seal.png',
    '/school_seal.png',
    '#0A192F',
    '#1B3A6B',
    '#F5A623',
    'Education Shapes the Future',
    'Official DepEd School Management Platform',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
