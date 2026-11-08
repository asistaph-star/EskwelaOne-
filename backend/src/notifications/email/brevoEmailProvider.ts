import { IEmailProvider, SendEmailOptions, SendEmailResult } from './emailProvider.interface.js';

export interface BrevoProviderOptions {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  replyToEmail?: string;
  replyToName?: string;
}

export class BrevoEmailProvider implements IEmailProvider {
  private apiKey: string;
  private senderEmail: string;
  private senderName: string;
  private replyToEmail?: string;
  private replyToName?: string;

  constructor(options: BrevoProviderOptions) {
    this.apiKey = options.apiKey?.trim();
    this.senderEmail = options.senderEmail?.trim() || 'noreply.cisattendance@gmail.com';
    this.senderName = options.senderName?.trim() || 'Calulut Integrated School Attendance';
    this.replyToEmail = options.replyToEmail?.trim();
    this.replyToName = options.replyToName?.trim() || options.senderName;
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.apiKey) {
      return {
        success: false,
        statusCode: 500,
        error: 'BREVO_API_KEY is not configured in backend environment.',
      };
    }

    const payload: Record<string, any> = {
      sender: {
        email: this.senderEmail,
        name: this.senderName,
      },
      to: options.to.map((recipient) => ({
        email: recipient.email,
        ...(recipient.name ? { name: recipient.name } : {}),
      })),
      subject: options.subject,
      htmlContent: options.htmlContent,
      textContent: options.textContent,
    };

    if (options.replyTo) {
      payload.replyTo = options.replyTo;
    } else if (this.replyToEmail) {
      payload.replyTo = {
        email: this.replyToEmail,
        name: this.replyToName,
      };
    }

    if (options.tags && options.tags.length > 0) {
      payload.tags = options.tags;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const statusCode = response.status;
        const rawCode = String(data?.code || '').toLowerCase();
        const rawMsg = String(data?.message || '');
        const isQuota = statusCode === 402 || rawCode.includes('quota') || rawMsg.toLowerCase().includes('quota');
        const isAuthError = statusCode === 401 || statusCode === 403 || rawCode.includes('unauthorized') || rawMsg.toLowerCase().includes('key not found');
        const formattedError = isAuthError
          ? `Brevo API authentication error (${statusCode}): ${data?.message || 'Unauthorized / Key not found'}. Verify BREVO_API_KEY.`
          : (data?.message || `Brevo API HTTP ${statusCode}`);

        return {
          success: false,
          statusCode,
          error: formattedError,
          isQuotaExceeded: isQuota,
          isAuthenticationError: isAuthError,
        };
      }

      return {
        success: true,
        statusCode: response.status,
        messageId: data?.messageId || data?.messageIds?.[0] || 'brevo_msg_recorded',
      };
    } catch (err: any) {
      return {
        success: false,
        statusCode: 0,
        error: err?.message || 'Network error attempting to connect to Brevo REST API',
      };
    }
  }
}
