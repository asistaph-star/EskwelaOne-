/**
 * DigiSkwela — Disaster Recovery & Isolated Restoration Verification Script
 * 
 * Verifies that a backup bundle can be restored end-to-end:
 * 1. Restores database dump into an isolated sandbox database (never touching production).
 * 2. Restores media archive into sandbox directory.
 * 3. Verifies schema, data records, user accounts, and student/faculty relationships.
 * 4. Verifies field encryption usability (decrypts LRN using PRISMA_FIELD_ENCRYPTION_KEY).
 * 5. Measures exact recovery duration and logs results.
 * 6. Completely tears down the sandbox database and directory.
 */
import path from 'path';
import fs from 'fs';
import { verifyRestoration } from '../src/backup/restore.service.js';

async function main() {
  console.log('============================================================');
  console.log('DIGISKWELA — DISASTER RECOVERY & RESTORATION VERIFICATION');
  console.log('Calulut Integrated National High School');
  console.log('============================================================');

  const backupsBaseDir = path.join(process.cwd(), 'backups');
  const registryPath = path.join(backupsBaseDir, 'backup-registry.json');

  if (!fs.existsSync(registryPath)) {
    console.error('[ERROR] No backup registry found. Please execute a backup first (npm run backup).');
    process.exit(1);
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const latestBackup = registry[0];

  if (!latestBackup || !fs.existsSync(latestBackup.backupPath)) {
    console.error('[ERROR] Latest backup directory does not exist on disk.');
    process.exit(1);
  }

  console.log(`Target Backup Bundle: ${latestBackup.backupId}`);
  console.log(`Path:                 ${latestBackup.backupPath}`);
  console.log('Starting isolated restoration sandbox test...\n');

  try {
    const report = await verifyRestoration(latestBackup.backupPath);

    console.log('------------------------------------------------------------');
    console.log('RESTORATION VERIFICATION RESULTS:');
    console.log(`Overall Result:       ${report.success ? 'PASS (RECOVERABLE)' : 'FAIL'}`);
    console.log(`Recovery Time (RTO):  ${(report.restorationDurationMs / 1000).toFixed(2)}s`);
    console.log(`Isolated Sandbox DB:  ${report.isolatedDatabaseName} (Cleanly Destroyed)`);
    console.log('\nIntegrity Checks:');
    console.log(`  ✓ Checksums & Catalog:      ${report.checks.artifactDecryptionAndChecksums ? 'PASS' : 'FAIL'}`);
    console.log(`  ✓ Schema & Data Restore:    ${report.checks.schemaAndDataRestoration ? 'PASS' : 'FAIL'}`);
    console.log(`  ✓ Field Encryption Usable:  ${report.checks.fieldEncryptionUsable ? 'PASS' : 'FAIL'} (${report.checks.decryptedSampleCount} sample decrypted)`);
    console.log(`  ✓ User Accounts Integrity:  ${report.checks.userAccountIntegrity ? 'PASS' : 'FAIL'} (${report.metrics.restoredUsersCount} accounts)`);
    console.log(`  ✓ Academic Relationships:   ${report.checks.academicRelationshipsIntegrity ? 'PASS' : 'FAIL'} (${report.metrics.restoredStudentsCount} students, ${report.metrics.restoredTeachersCount} teachers)`);
    console.log(`  ✓ Gradebook & Attendance:   ${report.checks.attendanceRecordsIntegrity ? 'PASS' : 'FAIL'} (${report.metrics.restoredGradesCount} grades, ${report.metrics.restoredAttendanceCount} gate logs)`);
    console.log(`  ✓ Media Storage Restore:    ${report.checks.mediaStorageRestoration ? 'PASS' : 'FAIL'} (${report.checks.restoredFilesCount} assets restored)`);
    console.log(`  ✓ Database-to-Media Links:  ${report.checks.databaseMediaReferentialIntegrity ? 'PASS' : 'FAIL'} (${report.metrics.verifiedReferencedMediaCount} referenced files verified)`);

    if (report.errors.length > 0) {
      console.warn('\nWarnings/Errors Encountered:');
      for (const e of report.errors) console.warn(`  - ${e}`);
    }

    console.log('============================================================');
    process.exit(report.success ? 0 : 1);
  } catch (err: any) {
    console.error('\n[RESTORATION FAILED]');
    console.error(`Error: ${err?.message}`);
    console.error('============================================================');
    process.exit(1);
  }
}

main();
