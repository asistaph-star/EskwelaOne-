/**
 * Provider-agnostic Email Interface contract.
 * Decouples gate attendance notifications from specific delivery services (Brevo, AWS SES, SMTP, Mock).
 */

export interface SendEmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: SendEmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent: string;
  replyTo?: SendEmailRecipient;
  tags?: string[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isQuotaExceeded?: boolean;
  isAuthenticationError?: boolean;
  statusCode?: number;
}

export interface IEmailProvider {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  getDailyRemainingQuota?(): Promise<number>;
}

