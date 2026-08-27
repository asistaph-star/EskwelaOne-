import app from './app.js';
import { config } from './config/env.js';
import prisma from './config/database.js';

async function main() {
  // Verify database connection
  try {
    await prisma.$connect();
    console.log('✓ Database connected');
  } catch (err) {
    console.error('✗ Database connection failed:', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  DigiSkwela Backend                        ║
║  Port: ${String(config.port).padEnd(36)}║
║  Env:  ${config.nodeEnv.padEnd(36)}║
║  CORS: ${config.corsOrigin.padEnd(36)}║
╚════════════════════════════════════════════╝
    `);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
