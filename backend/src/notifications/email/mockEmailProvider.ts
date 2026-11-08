import { IEmailProvider, SendEmailOptions, SendEmailResult } from './emailProvider.interface.js';

export interface MockEmailRecord {
  sentAt: Date;
  options: SendEmailOptions;
}

export class MockEmailProvider implements IEmailProvider {
  public sentEmails: MockEmailRecord[] = [];
  public shouldFail: boolean = false;
  public failErrorMessage: string = 'Simulated provider connection error';
  public shouldExhaustQuota: boolean = false;
  public quotaExhaustMessage: string = 'Daily quota limit reached (300 emails/day)';

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (this.shouldExhaustQuota) {
      return {
        success: false,
        statusCode: 402,
        isQuotaExceeded: true,
        error: this.quotaExhaustMessage,
      };
    }

    if (this.shouldFail) {
      return {
        success: false,
        statusCode: 500,
        error: this.failErrorMessage,
      };
    }

    const record: MockEmailRecord = {
      sentAt: new Date(),
      options,
    };
    this.sentEmails.push(record);

    return {
      success: true,
      statusCode: 201,
      messageId: `mock_brevo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }

  clear() {
    this.sentEmails = [];
    this.shouldFail = false;
    this.shouldExhaustQuota = false;
  }
}

