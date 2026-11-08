import app from './app.js';
import { config, assertProductionConfig } from './config/env.js';
import prisma from './config/database.js';
import { GateNotificationWorker } from './notifications/gateNotificationWorker.js';
import { BrevoEmailProvider } from './notifications/email/brevoEmailProvider.js';
import { MockEmailProvider } from './notifications/email/mockEmailProvider.js';

let gateWorker: GateNotificationWorker | null = null;

async function main() {
  // Fail fast immediately if running in production with unsafe configuration
  if (config.nodeEnv === 'production') {
    assertProductionConfig();
  }

  // Verify database connection
  try {
    await prisma.$connect();
    console.log('✓ Database connected');
  } catch (err) {
    console.error('✗ Database connection failed:', err);
    process.exit(1);
  }

  app.listen(config.port, config.host, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  DigiSkwela Backend                        ║
║  Port: ${String(config.port).padEnd(36)}║
║  Env:  ${config.nodeEnv.padEnd(36)}║
║  CORS: ${config.corsOrigin.padEnd(36)}║
╚════════════════════════════════════════════╝
    `);

    if (config.email.gateEmailEnabled) {
      const provider = config.email.provider === 'brevo'
        ? new BrevoEmailProvider({
            apiKey: config.email.brevoApiKey,
            senderEmail: config.email.senderEmail,
            senderName: config.email.senderName,
            replyToEmail: config.email.replyToEmail,
          })
        : new MockEmailProvider();

      gateWorker = new GateNotificationWorker({
        emailProvider: provider,
        clientPrisma: prisma,
        pollIntervalMs: 3000,
        authorizedRecipients: config.email.authorizedRecipients,
        authorizationMode: config.email.authorizationMode,
        dailyQuotaLimit: config.email.dailyQuotaLimit,
        batchSize: config.email.batchSize,
      });
      gateWorker.start();
      console.log(`✓ Gate Notification Worker started (Provider: ${config.email.provider}, Mode: ${config.email.recipientMode}, Auth: ${config.email.authorizationMode})`);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  if (gateWorker) {
    gateWorker.stop();
  }
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  if (gateWorker) {
    gateWorker.stop();
  }
  await prisma.$disconnect();
  process.exit(0);
});

// Server entrypoint - credentials verified; live sending disabled pending approval
main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
