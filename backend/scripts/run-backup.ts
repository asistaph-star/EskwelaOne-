/**
 * DigiSkwela — Production Backup Automation Script
 * 
 * Invoked manually or via OS Task Scheduler / Cron.
 * Creates an atomic backup bundle with native pg_dump custom archive,
 * media storage archive, and cryptographic SHA-256 verification.
 */
import { createBackup } from '../src/backup/backup.service.js';

async function main() {
  console.log('============================================================');
  console.log('DIGISKWELA — PRODUCTION BACKUP RUNNER');
  console.log('Calulut Integrated National High School');
  console.log('============================================================');

  const startTime = Date.now();

  try {
    const manifest = await createBackup({
      retentionCount: 7, // Retain last 7 daily backups
    });

    console.log('\n[BACKUP SUCCESSFUL]');
    console.log(`Backup ID:      ${manifest.backupId}`);
    console.log(`Timestamp:      ${manifest.timestamp}`);
    console.log(`Engine:         ${manifest.engine}`);
    console.log(`Database Size:  ${(manifest.database.sizeBytes / (1024 * 1024)).toFixed(2)} MB (${manifest.database.sha256.slice(0, 16)}...)`);
    console.log(`Storage Size:   ${(manifest.storage.sizeBytes / 1024).toFixed(2)} KB (${manifest.storage.filesCount} files)`);
    console.log(`Total Duration: ${(manifest.durationMs / 1000).toFixed(2)}s`);
    console.log('\nIntegrity verified: SHA-256 digests and pg_restore catalog checks passed.');
    console.log('============================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('\n[BACKUP FAILED]');
    console.error(`Error: ${err?.message}`);
    console.error(`Elapsed: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.error('============================================================');
    process.exit(1);
  }
}

main();
