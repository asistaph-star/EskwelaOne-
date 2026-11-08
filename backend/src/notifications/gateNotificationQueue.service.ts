import { generateId } from '../common/utils/uuid.js';
import { config } from '../config/env.js';
import { maskEmail } from '../common/utils/masking.js';
import { GuardianAuthorizationService } from './guardianAuthorization.service.js';

export interface EnqueueNotificationParams {
  attendanceId: string;
  studentId: string;
  eventType: 'TIME_IN' | 'TIME_OUT';
  punctualityStatus?: 'On Time' | 'Late' | null;
  clientPrisma: any;
  recipientMode?: 'STUDENT_ONLY' | 'GUARDIAN_ONLY' | 'BOTH';
  authorizationMode?: 'PILOT_WHITELIST' | 'SCHOOL_AUTHORIZED';
  authorizedRecipients?: string[];
}

export interface EnqueueResult {
  enqueued: boolean;
  status: 'PENDING' | 'SKIPPED' | 'ALREADY_EXISTS';
  notificationId?: string;
  reason?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Enqueues a gate attendance notification into the transactional outbox table.
 * Guaranteed idempotent and decoupled from network dispatch.
 */
export async function enqueueGateNotification(
  params: EnqueueNotificationParams
): Promise<EnqueueResult> {
  const {
    attendanceId,
    studentId,
    eventType,
    punctualityStatus,
    clientPrisma,
    recipientMode = config.email.recipientMode || 'STUDENT_ONLY',
    authorizationMode = config.email.authorizationMode || 'PILOT_WHITELIST',
    authorizedRecipients,
  } = params;

  // Resolve Student and User
  const student = await clientPrisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          status: true,
        },
      },
    },
  });

  if (!student) {
    return { enqueued: false, status: 'SKIPPED', reason: 'STUDENT_RECORD_NOT_FOUND' };
  }

  const studentName = student.user
    ? `${student.user.first_name} ${student.user.last_name}`.trim()
    : `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';

  // Helper to enqueue a single recipient role
  async function enqueueSingleRecipient(role: 'STUDENT' | 'GUARDIAN'): Promise<EnqueueResult> {
    let rawEmail: string | undefined;
    let recipientDisplayName: string;

    if (role === 'STUDENT') {
      rawEmail = student.user?.email?.trim();
      recipientDisplayName = studentName;
    } else {
      rawEmail = student.guardian_email?.trim();
      const guardianFullName = [student.guardian_first_name, student.guardian_last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      recipientDisplayName = guardianFullName || `Parent/Guardian of ${studentName}`;
    }

    let notificationStatus: 'PENDING' | 'SKIPPED' = 'PENDING';
    let errorMessage: string | null = null;

    if (!rawEmail) {
      notificationStatus = 'SKIPPED';
      errorMessage = role === 'STUDENT'
        ? 'Student account does not have a registered email address'
        : 'Student does not have a registered parent/guardian email address';
    } else if (!EMAIL_REGEX.test(rawEmail)) {
      notificationStatus = 'SKIPPED';
      errorMessage = role === 'STUDENT'
        ? 'Student email address format is invalid'
        : 'Guardian email address format is invalid';
    } else if (student.user?.status && student.user.status.toLowerCase() !== 'active') {
      notificationStatus = 'SKIPPED';
      errorMessage = 'Student user account is not in active status';
    } else {
      // Authorization Check:
      // In PILOT_WHITELIST mode, strictly fail-closed if recipient is not explicitly whitelisted.
      // In SCHOOL_AUTHORIZED mode, verified DepEd registered contacts on active students are authorized.
      if (authorizationMode === 'PILOT_WHITELIST') {
        const authorized = (authorizedRecipients || config.email.authorizedRecipients || []).map((e: string) => e.toLowerCase());
        if (authorized.length === 0 || !authorized.includes(rawEmail.toLowerCase())) {
          notificationStatus = 'SKIPPED';
          errorMessage = `Recipient email ${maskEmail(rawEmail)} is not on the authorized whitelist (fail-closed protection).`;
        } else if (role === 'GUARDIAN') {
          // Dual-Layer Safety: Whitelist passed, now independently verify Guardian Authorization status!
          const authCheck = await GuardianAuthorizationService.checkAuthorization(
            clientPrisma,
            studentId,
            rawEmail
          );
          if (!authCheck.authorized) {
            notificationStatus = 'SKIPPED';
            errorMessage = authCheck.reason || `Suppressed: Guardian contact ${maskEmail(rawEmail)} is not verified/authorized. Attendance notices require confirmed authorization.`;
          }
        }
      } else if (authorizationMode === 'SCHOOL_AUTHORIZED') {
        // Enforce School-Managed Authorization Rules:
        if (role === 'GUARDIAN') {
          // Rule 1: Guardian identity verification (guardian name must accompany guardian email)
          const hasGuardianName = Boolean(
            (student.guardian_first_name && student.guardian_first_name.trim().length > 0) ||
            (student.guardian_last_name && student.guardian_last_name.trim().length > 0)
          );
          if (!hasGuardianName) {
            notificationStatus = 'SKIPPED';
            errorMessage = 'Guardian contact record is unverified: Parent/Guardian full name is required in DepEd profile to authorize notification delivery.';
          } else {
            // Rule 2: Anti-spoofing / isolation (guardian email must not be identical to student account login email)
            const studentAccountEmail = student.user?.email?.trim().toLowerCase();
            if (studentAccountEmail && rawEmail.toLowerCase() === studentAccountEmail) {
              notificationStatus = 'SKIPPED';
              errorMessage = 'Unauthorized recipient: Guardian email cannot be identical to the student\'s personal account email.';
            } else {
              // Rule 3: Strict Contact Lifecycle State Verification (must be AUTHORIZED)
              // Strictly fail-closed: If unauthorized, unverified, missing, or table unavailable, SKIPPED!
              const authCheck = await GuardianAuthorizationService.checkAuthorization(
                clientPrisma,
                studentId,
                rawEmail
              );
              if (!authCheck.authorized) {
                notificationStatus = 'SKIPPED';
                errorMessage = authCheck.reason || `Suppressed: Guardian contact ${maskEmail(rawEmail)} is not verified/authorized. Attendance notices require confirmed authorization.`;
              }
            }
          }
        }
      }
    }

    try {
      const record = await clientPrisma.gateAttendanceNotification.upsert({
        where: {
          unique_gate_notification_event: {
            attendance_id: attendanceId,
            event_type: eventType,
            recipient_role: role,
          },
        },
        update: {}, // Idempotent: preserve existing state if already queued
        create: {
          id: generateId(),
          attendance_id: attendanceId,
          student_id: studentId,
          event_type: eventType,
          recipient_role: role,
          recipient_email: rawEmail || 'no-email@unregistered.local',
          recipient_name: recipientDisplayName,
          punctuality_status: punctualityStatus || null,
          status: notificationStatus,
          error_message: errorMessage,
        },
      });

      return {
        enqueued: notificationStatus === 'PENDING',
        status: notificationStatus,
        notificationId: record.id,
        reason: errorMessage || undefined,
      };
    } catch (err: any) {
      // Return cleanly to avoid disrupting gate attendance
      return {
        enqueued: false,
        status: 'SKIPPED',
        reason: err?.message || 'Failed to upsert outbox notification record',
      };
    }
  }

  if (recipientMode === 'STUDENT_ONLY') {
    return enqueueSingleRecipient('STUDENT');
  }

  if (recipientMode === 'GUARDIAN_ONLY') {
    return enqueueSingleRecipient('GUARDIAN');
  }

  if (recipientMode === 'BOTH') {
    const studentRes = await enqueueSingleRecipient('STUDENT');
    const guardianRes = await enqueueSingleRecipient('GUARDIAN');
    return {
      enqueued: studentRes.enqueued || guardianRes.enqueued,
      status: studentRes.status === 'PENDING' || guardianRes.status === 'PENDING' ? 'PENDING' : 'SKIPPED',
      notificationId: guardianRes.notificationId || studentRes.notificationId,
      reason: guardianRes.reason || studentRes.reason,
    };
  }

  return { enqueued: false, status: 'SKIPPED', reason: 'UNSUPPORTED_RECIPIENT_MODE' };
}
