import { IEmailProvider } from './email/emailProvider.interface.js';
import { config } from '../config/env.js';
import {
  renderTimeInTemplate,
  renderTimeOutTemplate,
} from './email/templates/gateAttendanceTemplates.js';
import {
  formatPhilippineDate,
  formatPhilippineTime,
} from './punctuality.service.js';
import { maskEmail } from '../common/utils/masking.js';
import { GuardianAuthorizationService } from './guardianAuthorization.service.js';

export interface GateWorkerOptions {
  emailProvider: IEmailProvider;
  clientPrisma: any;
  pollIntervalMs?: number;
  batchSize?: number;
  authorizedRecipients?: string[];
  authorizationMode?: 'PILOT_WHITELIST' | 'SCHOOL_AUTHORIZED';
  rateLimitDelayMs?: number;
  dailyQuotaLimit?: number;
}

export interface WebhookEventPayload {
  event: 'delivered' | 'soft_bounce' | 'hard_bounce' | 'blocked' | 'spam' | 'deferred';
  email: string;
  messageId?: string;
  timestamp?: Date;
  reason?: string;
}

export class GateNotificationWorker {
  private emailProvider: IEmailProvider;
  private prisma: any;
  private pollIntervalMs: number;
  private batchSize: number;
  private authorizedRecipients?: string[];
  private authorizationMode: 'PILOT_WHITELIST' | 'SCHOOL_AUTHORIZED';
  private rateLimitDelayMs: number;
  private dailyQuotaLimit: number;
  private isRunning: boolean = false;
  private intervalHandle: any = null;

  constructor(options: GateWorkerOptions) {
    this.emailProvider = options.emailProvider;
    this.prisma = options.clientPrisma;
    this.pollIntervalMs = options.pollIntervalMs || 5000;
    this.batchSize = options.batchSize || 10;
    this.authorizedRecipients = options.authorizedRecipients;
    this.authorizationMode = options.authorizationMode || 'PILOT_WHITELIST';
    this.rateLimitDelayMs = options.rateLimitDelayMs || 0;
    this.dailyQuotaLimit = options.dailyQuotaLimit !== undefined ? options.dailyQuotaLimit : 300;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalHandle = setInterval(() => {
      this.processBatch().catch((err) => {
        console.error('[GateNotificationWorker] Error during processBatch:', err?.message || err);
      });
    }, this.pollIntervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Processes a single batch of pending outbox records.
   * Can be called directly by cron/tests for deterministic execution.
   */
  async processBatch(): Promise<{
    processed: number;
    sent: number;
    failed: number;
    quotaExceeded: number;
    expired: number;
    recovered: number;
  }> {
    const summary = {
      processed: 0,
      sent: 0,
      failed: 0,
      quotaExceeded: 0,
      expired: 0,
      recovered: 0,
    };

    const now = new Date();

    // 0. Crash Recovery: Recover abandoned records stuck in 'PROCESSING' for > 5 minutes
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
    const stuck = await this.prisma.gateAttendanceNotification.findMany({
      where: {
        status: 'PROCESSING',
        updated_at: { lte: staleThreshold },
      },
    });

    for (const record of stuck) {
      if (record.brevo_message_id) {
        // Provider already accepted it before the crash
        await this.prisma.gateAttendanceNotification.update({
          where: { id: record.id },
          data: {
            status: 'ACCEPTED',
            error_message: 'Recovered after worker interruption (already accepted by provider)',
          },
        });
        summary.recovered++;
      } else if (record.attempt_count >= record.max_attempts) {
        await this.prisma.gateAttendanceNotification.update({
          where: { id: record.id },
          data: {
            status: 'FAILED',
            error_message: 'Max retry attempts exceeded during worker crash recovery',
          },
        });
        summary.recovered++;
      } else {
        // Safe to re-queue (set next_attempt_at slightly in past so it is eligible immediately)
        await this.prisma.gateAttendanceNotification.update({
          where: { id: record.id },
          data: {
            status: 'PENDING',
            next_attempt_at: new Date(Date.now() - 1000),
          },
        });
        summary.recovered++;
      }
    }

    // Allow 2-second skew buffer so newly queued records are immediately eligible for processing
    const queryNow = new Date(Date.now() + 2000);
    const pending = await this.prisma.gateAttendanceNotification.findMany({
      where: {
        status: 'PENDING',
        next_attempt_at: { lte: queryNow },
      },
      take: this.batchSize,
      include: {
        attendance: true,
        student: {
          include: {
            user: { select: { first_name: true, last_name: true } },
          },
        },
      },
    });

    if (!pending || pending.length === 0) {
      return summary;
    }

    // Local Quota Admission Control (Pre-computation for today)
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    for (const item of pending) {
      summary.processed++;

      // Check expiration: Do not silently dispatch yesterday's passes today
      const isExpired =
        now.getTime() - item.created_at.getTime() > 18 * 60 * 60 * 1000 ||
        formatPhilippineDate(item.created_at) !== formatPhilippineDate(now);

      if (isExpired) {
        await this.prisma.gateAttendanceNotification.update({
          where: { id: item.id },
          data: {
            status: 'EXPIRED',
            error_message: 'Suppressed: Notification expired past attendance date',
          },
        });
        summary.expired++;
        continue;
      }

      // Authorization Verification in Worker:
      if (this.authorizationMode === 'PILOT_WHITELIST') {
        const authorizedList = (this.authorizedRecipients ?? config.email.authorizedRecipients ?? []).map((e: string) => e.toLowerCase());
        if (authorizedList.length === 0 || !authorizedList.includes(item.recipient_email.toLowerCase())) {
          await this.prisma.gateAttendanceNotification.update({
            where: { id: item.id },
            data: {
              status: 'SKIPPED',
              error_message: `Suppressed by worker: Recipient ${maskEmail(item.recipient_email)} is not on the authorized whitelist (fail-closed protection).`,
            },
          });
          summary.failed++;
          continue;
        }

        // Dual-Layer Safety: Whitelist passed, now independently verify Guardian Authorization status!
        if (item.recipient_role === 'GUARDIAN') {
          const authCheck = await GuardianAuthorizationService.checkAuthorization(
            this.prisma,
            item.student_id,
            item.recipient_email
          );
          if (!authCheck.authorized) {
            await this.prisma.gateAttendanceNotification.update({
              where: { id: item.id },
              data: {
                status: 'SKIPPED',
                error_message: authCheck.reason || `Suppressed by worker: Guardian contact ${maskEmail(item.recipient_email)} is unverified (status: ${authCheck.status}). Dual-layer protection blocked delivery.`,
              },
            });
            summary.failed++;
            continue;
          }
        }
      } else if (this.authorizationMode === 'SCHOOL_AUTHORIZED') {
        if (item.recipient_role === 'GUARDIAN') {
          // Pre-dispatch Revocation & Replaced Contact Safety Check:
          const currentStudent = await this.prisma.student.findUnique({
            where: { id: item.student_id },
            select: { guardian_email: true, guardian_first_name: true, guardian_last_name: true },
          });

          const currentGuardianEmail = currentStudent?.guardian_email?.trim().toLowerCase();
          if (!currentGuardianEmail || currentGuardianEmail !== item.recipient_email.toLowerCase()) {
            await this.prisma.gateAttendanceNotification.update({
              where: { id: item.id },
              data: {
                status: 'SKIPPED',
                error_message: 'Suppressed by worker: Guardian contact was modified or revoked in student profile prior to dispatch.',
              },
            });
            summary.failed++;
            continue;
          }

          // Contact Lifecycle state verification: must still be AUTHORIZED
          // Strictly fail-closed: If unauthorized, unverified, missing, or table unavailable, SKIPPED!
          const authCheck = await GuardianAuthorizationService.checkAuthorization(
            this.prisma,
            item.student_id,
            item.recipient_email
          );
          if (!authCheck.authorized) {
            if (authCheck.status === 'UNKNOWN') {
              console.warn(
                `[GATE_EMAIL_WORKER_ALERT] Student ${item.student_id} guardian contact (${maskEmail(item.recipient_email)}) check returned UNKNOWN status: ${authCheck.reason}. Delivery blocked (fail-closed).`
              );
            }
            await this.prisma.gateAttendanceNotification.update({
              where: { id: item.id },
              data: {
                status: 'SKIPPED',
                error_message: authCheck.reason || 'Suppressed by worker: Guardian contact is not in AUTHORIZED status.',
              },
            });
            summary.failed++;
            continue;
          }
        }
      }

      // Local Quota Admission Check: Verify we have not exceeded daily quota limit
      const sentCountToday = await this.prisma.gateAttendanceNotification.count({
        where: {
          status: { in: ['ACCEPTED', 'DELIVERED'] },
          sent_at: { gte: todayMidnight },
        },
      });

      if (sentCountToday >= this.dailyQuotaLimit) {
        await this.prisma.gateAttendanceNotification.update({
          where: { id: item.id },
          data: {
            status: 'QUOTA_EXCEEDED',
            error_message: `Local quota admission control: Daily limit (${this.dailyQuotaLimit} emails/day) reached. Message held to prevent provider overrun.`,
          },
        });
        summary.quotaExceeded++;
        // Circuit breaker: halt remaining batch
        break;
      }

      // Atomically claim the record: conditional transition PENDING -> PROCESSING
      // Prevents duplicate processing when multiple concurrent workers poll the queue.
      const claimResult = await this.prisma.gateAttendanceNotification.updateMany({
        where: {
          id: item.id,
          status: 'PENDING',
        },
        data: {
          status: 'PROCESSING',
          attempt_count: { increment: 1 },
        },
      });

      if (claimResult.count === 0) {
        // Record was concurrently claimed by another worker instance
        continue;
      }

      // Rate limiting backpressure delay if configured
      if (this.rateLimitDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelayMs));
      }

      // Concurrency Race Check: Verify if record was cancelled/revoked while in PROCESSING
      const freshlyClaimed = await this.prisma.gateAttendanceNotification.findUnique({
        where: { id: item.id },
        select: { status: true },
      });
      if (freshlyClaimed?.status !== 'PROCESSING') {
        // State changed externally (e.g., teacher updated/revoked contact)
        summary.failed++;
        continue;
      }

      // Prepare template data (Always use original scan timestamp)
      const scanDate = item.attendance?.date ? new Date(item.attendance.date) : new Date();
      const rawTime =
        item.event_type === 'TIME_IN'
          ? item.attendance?.time_in || item.created_at
          : item.attendance?.time_out || item.created_at;
      const scanTime = new Date(rawTime);

      const studentDisplayName = item.student?.user
        ? `${item.student.user.first_name} ${item.student.user.last_name}`.trim()
        : `${item.student?.first_name || ''} ${item.student?.last_name || ''}`.trim() || item.recipient_name;

      const templateData = {
        studentName: item.recipient_role === 'GUARDIAN' ? studentDisplayName : item.recipient_name,
        attendanceDate: formatPhilippineDate(scanDate),
        timeStr: formatPhilippineTime(scanTime),
        punctualityStatus: item.punctuality_status as any,
      };

      const { subject, htmlContent, textContent } =
        item.event_type === 'TIME_IN'
          ? renderTimeInTemplate(templateData)
          : renderTimeOutTemplate(templateData);

      try {
        const result = await this.emailProvider.sendEmail({
          to: [{ email: item.recipient_email, name: item.recipient_name }],
          subject,
          htmlContent,
          textContent,
          tags: [`gate_${item.event_type.toLowerCase()}`],
        });

        if (result.success) {
          // Brevo API successfully accepted the message
          await this.prisma.gateAttendanceNotification.update({
            where: { id: item.id },
            data: {
              status: 'ACCEPTED',
              sent_at: new Date(),
              brevo_message_id: result.messageId || 'brevo-msg-ok',
              error_message: null,
            },
          });
          summary.sent++;
        } else if (result.isQuotaExceeded) {
          await this.prisma.gateAttendanceNotification.update({
            where: { id: item.id },
            data: {
              status: 'QUOTA_EXCEEDED',
              error_message: result.error || 'Brevo daily quota exceeded (300 emails/day)',
            },
          });
          summary.quotaExceeded++;
          // Circuit Breaker: Halt the batch immediately when daily quota is exhausted
          break;
        } else if (result.isAuthenticationError || result.statusCode === 401 || result.statusCode === 403) {
          console.error(
            `[GATE_EMAIL_WORKER_CRITICAL] Email provider authentication error: ${result.error}. Live dispatch paused.`
          );
          await this.prisma.gateAttendanceNotification.update({
            where: { id: item.id },
            data: {
              status: 'FAILED',
              error_message: result.error || 'Provider authentication failed (invalid or expired API key)',
            },
          });
          summary.failed++;
          // Circuit Breaker: Halt the batch immediately on auth failure (prevent spamming failed calls)
          break;
        } else if (result.statusCode === 429) {
          // HTTP 429: Rate limited by provider
          const retryAfterSeconds = (result as any).retryAfterSeconds || 60;
          const nextAttemptAt = new Date(Date.now() + retryAfterSeconds * 1000);
          await this.prisma.gateAttendanceNotification.update({
            where: { id: item.id },
            data: {
              status: 'PENDING',
              next_attempt_at: nextAttemptAt,
              error_message: `Rate limited by provider (HTTP 429). Retrying after ${retryAfterSeconds}s.`,
            },
          });
          summary.failed++;
          break; // Back off current batch
        } else {
          const maxAttempts = item.max_attempts || 3;
          const updatedAttemptCount = item.attempt_count + 1;
          const isFinalFailure = updatedAttemptCount >= maxAttempts;

          // Exponential backoff: 2 minutes after 1st retry, 10 minutes after 2nd
          const backoffMinutes = updatedAttemptCount === 1 ? 2 : 10;
          const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await this.prisma.gateAttendanceNotification.update({
            where: { id: item.id },
            data: {
              status: isFinalFailure ? 'FAILED' : 'PENDING',
              next_attempt_at: nextAttemptAt,
              error_message: result.error || 'Delivery attempt failed',
            },
          });
          summary.failed++;
        }
      } catch (err: any) {
        await this.prisma.gateAttendanceNotification.update({
          where: { id: item.id },
          data: {
            status: 'FAILED',
            error_message: err?.message || 'Unexpected exception during email dispatch',
          },
        });
        summary.failed++;
      }
    }

    return summary;
  }

  /**
   * Processes transactional webhooks from Brevo or external providers.
   * Updates notification status and coordinates contact reputation updates.
   */
  async handleWebhook(payload: WebhookEventPayload): Promise<{ success: boolean; updatedRecords: number }> {
    const { event, email, messageId, timestamp = new Date(), reason } = payload;
    let newStatus: string | null = null;

    switch (event) {
      case 'delivered':
        newStatus = 'DELIVERED';
        break;
      case 'hard_bounce':
        newStatus = 'BOUNCED';
        break;
      case 'blocked':
      case 'spam':
        newStatus = 'BLOCKED';
        break;
      case 'deferred':
        newStatus = 'DEFERRED';
        break;
      default:
        return { success: true, updatedRecords: 0 };
    }

    const whereClause: any = {};
    if (messageId) {
      whereClause.brevo_message_id = messageId;
    } else {
      whereClause.recipient_email = email.trim().toLowerCase();
    }

    const updateData: any = {
      status: newStatus,
      updated_at: new Date(),
    };

    if (newStatus === 'DELIVERED') {
      updateData.delivered_at = timestamp;
    } else if (reason) {
      updateData.error_message = `Provider webhook: ${reason}`;
    }

    const res = await this.prisma.gateAttendanceNotification.updateMany({
      where: whereClause,
      data: updateData,
    });

    // If contact hard bounced or was blocked, update contact authorization status
    if (newStatus === 'BOUNCED' || newStatus === 'BLOCKED') {
      await GuardianAuthorizationService.blockContact(
        this.prisma,
        email,
        `Provider reported ${event}: ${reason || 'Permanent delivery failure'}`
      );
    }

    return { success: true, updatedRecords: res.count };
  }
}

/**
 * Operational diagnostic metric retriever for Admin IT visibility.
 * Safely aggregates queue status without exposing raw email addresses.
 */
export async function getGateNotificationQueueMetrics(clientPrisma: any): Promise<{
  queueDepth: number;
  statusCounts: Record<string, number>;
  sentToday: number;
  dailyQuotaLimit: number;
  unverifiedContactsCount: number;
}> {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const [notifications, unverified] = await Promise.all([
    clientPrisma.gateAttendanceNotification.groupBy({
      by: ['status'],
      _count: { status: true },
    }).catch(() => []),
    clientPrisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM public.guardian_contact_authorizations WHERE status = 'PENDING_VERIFICATION'`
    ).catch(() => [{ count: 0 }]),
  ]);

  const statusCounts: Record<string, number> = {};
  let queueDepth = 0;
  for (const group of notifications) {
    statusCounts[group.status] = group._count.status;
    if (group.status === 'PENDING') queueDepth += group._count.status;
  }

  const sentToday = await clientPrisma.gateAttendanceNotification.count({
    where: {
      status: { in: ['ACCEPTED', 'DELIVERED'] },
      sent_at: { gte: todayMidnight },
    },
  }).catch(() => 0);

  return {
    queueDepth,
    statusCounts,
    sentToday,
    dailyQuotaLimit: 300,
    unverifiedContactsCount: (unverified && unverified[0]?.count) || 0,
  };
}
