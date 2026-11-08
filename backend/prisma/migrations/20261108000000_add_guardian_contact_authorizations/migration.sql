-- Migration: 20261108000000_add_guardian_contact_authorizations
-- Description: Additive migration for DepEd-compliant guardian contact authorization lifecycle.
-- Safety: Purely additive. Does not drop or alter existing tables, columns, or constraints.
-- Target Database: digiskwela_acceptance (Prepared and Staged — Awaiting Project Owner Approval)
-- Security Policy: Strictly fail-closed. All existing contacts default to PENDING_VERIFICATION.
-- Zero Fail-Open Policy: No automatic AUTHORIZED status without documented proof or OTP verification.

-- 1. Create guardian_contact_authorizations table
CREATE TABLE IF NOT EXISTS public.guardian_contact_authorizations (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_email VARCHAR(255) NOT NULL,
    guardian_name VARCHAR(200) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    salt VARCHAR(64),
    verification_token_hash VARCHAR(64),
    verification_otp_hash VARCHAR(64),
    failed_attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    last_code_sent_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    authorized_by_user_id VARCHAR(36) REFERENCES public.users(id),
    authorized_at TIMESTAMP WITH TIME ZONE,
    verification_method VARCHAR(50),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revocation_reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Additive columns for environments where table was previously initialized
ALTER TABLE public.guardian_contact_authorizations ADD COLUMN IF NOT EXISTS salt VARCHAR(64);
ALTER TABLE public.guardian_contact_authorizations ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE public.guardian_contact_authorizations ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 5;
ALTER TABLE public.guardian_contact_authorizations ADD COLUMN IF NOT EXISTS last_code_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.guardian_contact_authorizations ADD COLUMN IF NOT EXISTS verification_method VARCHAR(50);

-- 3. Indexes for rapid lookup during gate scans and verification flows
CREATE INDEX IF NOT EXISTS idx_guardian_auth_lookup 
ON public.guardian_contact_authorizations (student_id, guardian_email, status);

CREATE INDEX IF NOT EXISTS idx_guardian_auth_status 
ON public.guardian_contact_authorizations (status);

-- 4. Baseline Population & Classification Policy:
-- In accordance with Project Owner Phase 3C.10 Directives:
-- Every existing guardian contact in Calulut Integrated School MUST default to PENDING_VERIFICATION.
-- No student contact (including Mark Mercado) shall be initialized as AUTHORIZED.
-- A prior email delivery proves network transit only, not verified guardian legal authorization.
-- In DigiSkwela, student.guardian_email is encrypted with prisma-field-encryption.
-- The baseline population script decodes student contacts via the application encryption layer
-- and registers them in PENDING_VERIFICATION state with nullified OTP hashes.

-- Rollback statement:
-- DROP INDEX IF EXISTS public.idx_guardian_auth_status;
-- DROP INDEX IF EXISTS public.idx_guardian_auth_lookup;
-- DROP TABLE IF EXISTS public.guardian_contact_authorizations;
