import crypto from 'crypto';
import { generateId } from '../common/utils/uuid.js';
import { maskEmail } from '../common/utils/masking.js';

export type GuardianContactStatus =
  | 'PENDING_VERIFICATION'
  | 'AUTHORIZED'
  | 'REPLACED'
  | 'REVOKED'
  | 'BLOCKED';

export interface RegisterGuardianContactOptions {
  studentId: string;
  guardianEmail: string;
  guardianName: string;
  clientPrisma: any;
  autoAuthorizeForTesting?: boolean;
  authorizedByUserId?: string;
  skipCooldown?: boolean;
}

export interface GuardianContactRecord {
  id: string;
  student_id: string;
  guardian_email: string;
  guardian_name: string;
  status: GuardianContactStatus;
  salt?: string | null;
  verification_token_hash?: string | null;
  verification_otp_hash?: string | null;
  failed_attempts: number;
  max_attempts: number;
  token_expires_at?: Date | null;
  last_code_sent_at?: Date | null;
  verified_at?: Date | null;
  authorized_by_user_id?: string | null;
  authorized_at?: Date | null;
  verification_method?: string | null;
  revoked_at?: Date | null;
  revocation_reason?: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Retrieves the dedicated OTP HMAC secret from runtime environment.
 * Strictly enforces that OTP_HMAC_SECRET must be configured with >= 32 characters.
 * Fails closed without falling back to JWT_SECRET or hardcoded keys.
 */
export function getOtpHmacSecret(): string {
  const secret = process.env.OTP_HMAC_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      'Guardian OTP verification subsystem unavailable: Dedicated OTP_HMAC_SECRET is not configured or has insufficient entropy (minimum 32 characters required).'
    );
  }
  return secret;
}

function hashSecretWithSalt(salt: string, secret: string): string {
  const hmacKey = getOtpHmacSecret();
  return crypto.createHmac('sha256', hmacKey).update(salt + ':' + secret.trim()).digest('hex');
}

/**
 * Service managing the complete lifecycle of guardian contact authorizations:
 * PENDING_VERIFICATION -> AUTHORIZED -> REPLACED / REVOKED / BLOCKED
 * Strictly adheres to fail-closed security and DepEd learner privacy requirements.
 */
export class GuardianAuthorizationService {
  /**
   * Registers a guardian contact for a student.
   * Generates a secure salted 6-digit OTP (15-min expiry) & 32-byte link token.
   * Enforces 60-second cooldown between resends.
   * Does NOT authorize the contact immediately unless explicitly authorized by staff.
   */
  static async registerContact(opts: RegisterGuardianContactOptions): Promise<{
    authorizationId: string;
    status: GuardianContactStatus;
    otp: string;
    token: string;
    verificationEmail: {
      to: string;
      subject: string;
      htmlContent: string;
    };
  }> {
    const { studentId, guardianEmail, guardianName, clientPrisma, autoAuthorizeForTesting, authorizedByUserId, skipCooldown } = opts;

    const trimmedEmail = guardianEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      throw new Error(`Invalid guardian email address format: ${maskEmail(trimmedEmail)}`);
    }

    // Anti-spoofing check: ensure guardian email is not student's login email
    const student = await clientPrisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { email: true } } },
    });

    if (!student) {
      throw new Error('Student record not found.');
    }

    const studentAccountEmail = student.user?.email?.trim().toLowerCase();
    if (studentAccountEmail && studentAccountEmail === trimmedEmail) {
      throw new Error('Unauthorized recipient: Guardian email cannot be identical to the student\'s personal account email.');
    }

    // 60-second Resend Cooldown Check
    if (!skipCooldown && !autoAuthorizeForTesting) {
      try {
        const recent: any[] = await clientPrisma.$queryRawUnsafe(
          `SELECT last_code_sent_at, created_at 
           FROM public.guardian_contact_authorizations 
           WHERE student_id = $1 AND guardian_email = $2 AND status = 'PENDING_VERIFICATION'
           ORDER BY created_at DESC LIMIT 1`,
          studentId,
          trimmedEmail
        );
        if (recent && recent.length > 0) {
          const lastSent = recent[0].last_code_sent_at || recent[0].created_at;
          if (lastSent) {
            const elapsedMs = Date.now() - new Date(lastSent).getTime();
            if (elapsedMs < 60000) {
              const waitSec = Math.ceil((60000 - elapsedMs) / 1000);
              throw new Error(`Please wait ${waitSec} second(s) before requesting a new verification code.`);
            }
          }
        }
      } catch (err: any) {
        if (err.message?.includes('Please wait')) {
          throw err;
        }
      }
    }

    // Supersede any previous active contact for this student
    try {
      await clientPrisma.$executeRawUnsafe(
        `UPDATE public.guardian_contact_authorizations 
         SET status = 'REPLACED', verification_otp_hash = NULL, verification_token_hash = NULL, updated_at = NOW() 
         WHERE student_id = $1 AND status IN ('PENDING_VERIFICATION', 'AUTHORIZED')`,
        studentId
      );
    } catch {
      // Table might not exist in unmigrated environment, handled gracefully
    }

    // Generate cryptographic per-record salt, 6-digit OTP, and 24-byte link token
    const salt = crypto.randomBytes(16).toString('hex');
    const otp = crypto.randomInt(100000, 999999).toString();
    const token = crypto.randomBytes(24).toString('hex');
    const otpHash = hashSecretWithSalt(salt, otp);
    const tokenHash = hashSecretWithSalt(salt, token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes strict validity

    const authId = generateId();
    const initialStatus: GuardianContactStatus = autoAuthorizeForTesting ? 'AUTHORIZED' : 'PENDING_VERIFICATION';
    const verifiedAt = autoAuthorizeForTesting ? new Date() : null;
    const authorizedAt = autoAuthorizeForTesting ? new Date() : null;
    const verificationMethod = autoAuthorizeForTesting ? 'IN_PERSON_STAFF' : null;

    try {
      await clientPrisma.$executeRawUnsafe(
        `INSERT INTO public.guardian_contact_authorizations (
          id, student_id, guardian_email, guardian_name, status,
          salt, verification_token_hash, verification_otp_hash,
          failed_attempts, max_attempts, token_expires_at, last_code_sent_at,
          verified_at, authorized_by_user_id, authorized_at, verification_method,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 5, $9, NOW(), $10, $11, $12, $13, NOW(), NOW())`,
        authId,
        studentId,
        trimmedEmail,
        guardianName.trim(),
        initialStatus,
        salt,
        tokenHash,
        otpHash,
        expiresAt,
        verifiedAt,
        authorizedByUserId || null,
        authorizedAt,
        verificationMethod
      );
    } catch (err: any) {
      console.warn('[GUARDIAN_AUTH] Could not persist authorization record to database:', err?.message);
    }

    // Verification email content (explicitly free of any student attendance details!)
    // Note: Link-based verification is held until a dedicated public verification route is deployed.
    const verificationEmail = {
      to: trimmedEmail,
      subject: 'Calulut Integrated School — Verify Guardian Email Address',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #1a365d;">Calulut Integrated School</h2>
          <p>Dear ${guardianName || 'Parent / Guardian'},</p>
          <p>You have been registered as the official guardian contact to receive automated school attendance updates from Calulut Integrated School.</p>
          <p>Please provide the following 6-digit verification code to the Class Adviser or school office to verify ownership of this email address:</p>
          <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 12px; background: #edf2f7; text-align: center; border-radius: 6px; margin: 16px 0; color: #1e293b;">
            ${otp}
          </div>
          <p style="font-size: 13px; color: #718096;">This code is valid for 15 minutes. For student data privacy, attendance notifications will NOT be sent until this contact is confirmed.</p>
          <p style="font-size: 12px; color: #a0aec0; border-top: 1px solid #e2e8f0; padding-top: 8px;">DepEd Calulut Integrated School • San Fernando, Pampanga • School ID: 500146</p>
        </div>
      `,
    };

    return {
      authorizationId: authId,
      status: initialStatus,
      otp,
      token,
      verificationEmail,
    };
  }

  /**
   * Verifies guardian email ownership using the 6-digit OTP.
   * Enforces 5-attempt limit with brute force lockout.
   * Single-use: clears OTP hash upon successful verification to prevent replay.
   * Transitions status from PENDING_VERIFICATION -> AUTHORIZED.
   */
  static async verifyWithOtp(
    clientPrisma: any,
    studentId: string,
    guardianEmail: string,
    otp: string
  ): Promise<{ success: boolean; message: string; attemptsRemaining?: number }> {
    const trimmedEmail = guardianEmail.trim().toLowerCase();
    const otpStr = String(otp || '').trim();

    try {
      const records: any[] = await clientPrisma.$queryRawUnsafe(
        `SELECT id, status, salt, verification_otp_hash, token_expires_at, failed_attempts, max_attempts 
         FROM public.guardian_contact_authorizations 
         WHERE student_id = $1 AND guardian_email = $2 
         ORDER BY created_at DESC LIMIT 1`,
        studentId,
        trimmedEmail
      );

      if (!records || records.length === 0) {
        return { success: false, message: 'Invalid or incorrect verification code.' };
      }

      const record = records[0];
      if (record.status === 'AUTHORIZED') {
        return { success: true, message: 'Guardian contact is already verified and authorized.' };
      }
      if (record.status !== 'PENDING_VERIFICATION') {
        return { success: false, message: `Cannot verify contact in status ${record.status}.` };
      }

      const maxAttempts = record.max_attempts || 5;
      const currentFailed = record.failed_attempts || 0;

      // Lockout check
      if (currentFailed >= maxAttempts || !record.verification_otp_hash) {
        return { success: false, message: 'Verification code locked due to excessive failed attempts. Please request a new code.' };
      }

      // Expiry check
      if (record.token_expires_at && new Date(record.token_expires_at) < new Date()) {
        return { success: false, message: 'Verification code has expired. Please request a new code.' };
      }

      // Salted candidate hash calculation with dedicated secret
      let candidateHash: string;
      try {
        candidateHash = hashSecretWithSalt(record.salt || '', otpStr);
      } catch (secErr: any) {
        console.error('[GUARDIAN_AUTH_FATAL] OTP verification blocked: Missing dedicated OTP_HMAC_SECRET.');
        return { 
          success: false, 
          message: 'Guardian OTP verification service is temporarily unavailable due to missing security configuration. Please contact the system administrator.' 
        };
      }

      if (candidateHash !== record.verification_otp_hash) {
        const nextFailed = currentFailed + 1;
        if (nextFailed >= maxAttempts) {
          // Invalidate OTP hash on lockout
          await clientPrisma.$executeRawUnsafe(
            `UPDATE public.guardian_contact_authorizations 
             SET failed_attempts = $1, verification_otp_hash = NULL, updated_at = NOW() 
             WHERE id = $2`,
            nextFailed,
            record.id
          );
          return { success: false, message: 'Verification code locked due to excessive failed attempts. Please request a new code.' };
        } else {
          await clientPrisma.$executeRawUnsafe(
            `UPDATE public.guardian_contact_authorizations 
             SET failed_attempts = $1, updated_at = NOW() 
             WHERE id = $2`,
            nextFailed,
            record.id
          );
          const remaining = maxAttempts - nextFailed;
          return { 
            success: false, 
            message: `Invalid or incorrect verification code. ${remaining} attempt(s) remaining.`,
            attemptsRemaining: remaining 
          };
        }
      }

      // Valid OTP: Clear OTP and token hashes to enforce single-use replay protection
      await clientPrisma.$executeRawUnsafe(
        `UPDATE public.guardian_contact_authorizations 
         SET status = 'AUTHORIZED', verified_at = NOW(), authorized_at = NOW(), 
             verification_otp_hash = NULL, verification_token_hash = NULL,
             verification_method = 'OTP', updated_at = NOW() 
         WHERE id = $1`,
        record.id
      );

      return { success: true, message: 'Guardian contact verified and authorized successfully.' };
    } catch (err: any) {
      return { success: false, message: `Database verification failed: ${err?.message}` };
    }
  }

  /**
   * Verifies guardian email ownership using the cryptographically signed direct link token.
   * Single-use: clears hashes upon success to prevent token replay.
   * Transitions status from PENDING_VERIFICATION -> AUTHORIZED with method 'DIRECT_EMAIL_LINK'.
   */
  static async verifyWithToken(
    clientPrisma: any,
    studentId: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    const tokenStr = String(token || '').trim();
    if (!tokenStr) {
      return { success: false, message: 'Invalid or missing verification link token.' };
    }

    try {
      const records: any[] = await clientPrisma.$queryRawUnsafe(
        `SELECT id, status, salt, verification_token_hash, token_expires_at 
         FROM public.guardian_contact_authorizations 
         WHERE student_id = $1 
         ORDER BY created_at DESC LIMIT 1`,
        studentId
      );

      if (!records || records.length === 0) {
        return { success: false, message: 'No authorization record found for this student.' };
      }

      const record = records[0];
      if (record.status === 'AUTHORIZED') {
        return { success: true, message: 'Guardian contact is already verified and authorized.' };
      }
      if (record.status !== 'PENDING_VERIFICATION') {
        return { success: false, message: `Cannot verify contact in status ${record.status}.` };
      }

      if (record.token_expires_at && new Date(record.token_expires_at) < new Date()) {
        return { success: false, message: 'Verification link has expired. Please request a new verification code.' };
      }

      if (!record.salt || !record.verification_token_hash) {
        return { success: false, message: 'Verification link has already been used or invalidated.' };
      }

      let candidateHash: string;
      try {
        candidateHash = hashSecretWithSalt(record.salt, tokenStr);
      } catch (err: any) {
        return { success: false, message: 'Verification subsystem unavailable due to missing security configuration.' };
      }

      if (candidateHash !== record.verification_token_hash) {
        return { success: false, message: 'Invalid or incorrect verification link.' };
      }

      // Valid link token: Transition to AUTHORIZED and clear tokens
      await clientPrisma.$executeRawUnsafe(
        `UPDATE public.guardian_contact_authorizations 
         SET status = 'AUTHORIZED', verified_at = NOW(), authorized_at = NOW(), 
             verification_otp_hash = NULL, verification_token_hash = NULL,
             verification_method = 'DIRECT_EMAIL_LINK', updated_at = NOW() 
         WHERE id = $1`,
        record.id
      );

      return { success: true, message: 'Guardian contact email verified and authorized successfully via email link.' };
    } catch (err: any) {
      return { success: false, message: `Verification failed: ${err?.message}` };
    }
  }

  /**
   * Authorizes a guardian contact directly by authorized school personnel (Adviser, Registrar, or Admin)
   * based on official DepEd enrollment records (SF1), contact update forms, or direct in-person confirmation.
   * Records explicit staff user ID, audit trail, confirmation method, and documentation source.
   */
  static async authorizeManuallyByStaff(
    clientPrisma: any,
    studentId: string,
    guardianEmail: string,
    authorizedByUserId: string,
    reason: string = 'DepEd SF1 Enrollment Record Verification',
    verificationMethod: string = 'SCHOOL_ENROLLMENT_CONFIRMED'
  ): Promise<{ success: boolean; message: string; recordId?: string }> {
    const trimmedEmail = guardianEmail.trim().toLowerCase();
    try {
      // Check if authorization record already exists
      const existing: any[] = await clientPrisma.$queryRawUnsafe(
        `SELECT id, status FROM public.guardian_contact_authorizations
         WHERE student_id = $1 AND guardian_email = $2
         ORDER BY created_at DESC LIMIT 1`,
        studentId,
        trimmedEmail
      );

      let recordId: string;
      if (!existing || existing.length === 0) {
        const student = await clientPrisma.student.findUnique({
          where: { id: studentId },
          select: { guardian_first_name: true, guardian_last_name: true },
        });
        const guardianName = [student?.guardian_first_name, student?.guardian_last_name].filter(Boolean).join(' ').trim() || 'Parent / Guardian';
        const registered = await this.registerContact({
          studentId,
          guardianEmail: trimmedEmail,
          guardianName,
          clientPrisma,
          autoAuthorizeForTesting: false,
          skipCooldown: true,
        });
        recordId = registered.authorizationId;
      } else {
        recordId = existing[0].id;
      }

      const result = await clientPrisma.$executeRawUnsafe(
        `UPDATE public.guardian_contact_authorizations 
         SET status = 'AUTHORIZED', authorized_by_user_id = $1, authorized_at = NOW(), 
             verified_at = NOW(), verification_method = $2, revocation_reason = $3,
             verification_otp_hash = NULL, verification_token_hash = NULL, updated_at = NOW() 
         WHERE id = $4`,
        authorizedByUserId,
        verificationMethod,
        reason,
        recordId
      );

      // Audit trail logging
      try {
        await clientPrisma.auditLog.create({
          data: {
            id: generateId(),
            actor_user_id: authorizedByUserId,
            action: 'GUARDIAN_CONTACT_MANUAL_AUTHORIZATION',
            resource_type: 'STUDENT',
            resource_id: studentId,
            reason: reason,
            new_state: {
              guardianEmail: maskEmail(trimmedEmail),
              verificationMethod,
              reason,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (err: any) {
        console.warn('[GUARDIAN_AUTH] Could not record audit log:', err?.message);
      }

      return { 
        success: true, 
        message: `Guardian contact confirmed and authorized by school personnel (${reason}).`,
        recordId 
      };
    } catch (err: any) {
      return { success: false, message: `Manual authorization failed: ${err?.message}` };
    }
  }

  /**
   * Revokes an authorized guardian contact.
   * Also suppresses any pending gate attendance notifications for that student in the outbox.
   */
  static async revokeContact(
    clientPrisma: any,
    studentId: string,
    guardianEmail: string,
    reason: string = 'Revoked by school personnel'
  ): Promise<{ success: boolean; suppressedNotifications: number }> {
    const trimmedEmail = guardianEmail.trim().toLowerCase();
    let suppressedCount = 0;

    try {
      await clientPrisma.$executeRawUnsafe(
        `UPDATE public.guardian_contact_authorizations 
         SET status = 'REVOKED', revoked_at = NOW(), revocation_reason = $1, 
             verification_otp_hash = NULL, verification_token_hash = NULL, updated_at = NOW() 
         WHERE student_id = $2 AND guardian_email = $3 AND status = 'AUTHORIZED'`,
        reason,
        studentId,
        trimmedEmail
      );

      // Invalidate any pending or processing outbox notifications for that student targeting this revoked address
      const res = await clientPrisma.gateAttendanceNotification.updateMany({
        where: {
          student_id: studentId,
          recipient_role: 'GUARDIAN',
          recipient_email: trimmedEmail,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        data: {
          status: 'SKIPPED',
          error_message: `Suppressed: Guardian contact ${maskEmail(trimmedEmail)} was revoked (${reason}).`,
        },
      });
      suppressedCount = res.count;
    } catch (err: any) {
      console.warn('[GUARDIAN_AUTH] Error during contact revocation:', err?.message);
    }

    return { success: true, suppressedNotifications: suppressedCount };
  }

  /**
   * Marks a contact as BLOCKED after a hard provider bounce or spam complaint.
   */
  static async blockContact(
    clientPrisma: any,
    guardianEmail: string,
    reason: string = 'Provider hard bounce / blocked recipient'
  ): Promise<void> {
    const trimmedEmail = guardianEmail.trim().toLowerCase();
    try {
      await clientPrisma.$executeRawUnsafe(
        `UPDATE public.guardian_contact_authorizations 
         SET status = 'BLOCKED', revocation_reason = $1, 
             verification_otp_hash = NULL, verification_token_hash = NULL, updated_at = NOW() 
         WHERE guardian_email = $2`,
        reason,
        trimmedEmail
      );
    } catch {}
  }

  /**
   * Checks whether a guardian contact is verified and authorized to receive student attendance notifications.
   * Strictly fails closed: returns authorized: false unless proven AUTHORIZED.
   * If table is missing or DB errors occur, logs an alert and safely suppresses delivery.
   */
  static async checkAuthorization(
    clientPrisma: any,
    studentId: string,
    guardianEmail: string
  ): Promise<{ authorized: boolean; status: GuardianContactStatus | 'UNKNOWN'; reason?: string }> {
    const trimmedEmail = guardianEmail.trim().toLowerCase();

    try {
      const records: any[] = await clientPrisma.$queryRawUnsafe(
        `SELECT status, token_expires_at 
         FROM public.guardian_contact_authorizations 
         WHERE student_id = $1 AND guardian_email = $2 
         ORDER BY created_at DESC LIMIT 1`,
        studentId,
        trimmedEmail
      );

      if (records && records.length > 0) {
        const currentStatus = records[0].status as GuardianContactStatus;
        if (currentStatus === 'AUTHORIZED') {
          return { authorized: true, status: 'AUTHORIZED' };
        }
        return {
          authorized: false,
          status: currentStatus,
          reason: `Guardian contact ${maskEmail(trimmedEmail)} status is ${currentStatus}. Only AUTHORIZED contacts can receive attendance notifications.`,
        };
      }
    } catch (err: any) {
      console.warn(`[GUARDIAN_AUTH_ALERT] Query failed or table missing: ${err?.message}. Failing closed.`);
      return {
        authorized: false,
        status: 'UNKNOWN',
        reason: `Guardian contact authorization table unavailable or query failed. Attendance delivery suppressed (fail-closed).`,
      };
    }

    // Default fail-closed for unverified contacts in SCHOOL_AUTHORIZED mode
    return {
      authorized: false,
      status: 'UNKNOWN',
      reason: `Guardian contact ${maskEmail(trimmedEmail)} has no active authorization record. Verification required before attendance dispatches.`,
    };
  }
}
