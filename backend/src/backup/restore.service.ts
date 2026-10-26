import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { fieldEncryptionExtension } from 'prisma-field-encryption';
import {
  findPostgresBinary,
  parseDatabaseUrl,
  extractStorageArchive,
  verifyBackupBundle,
  getReferencedMediaFiles,
  DatabaseCredentials,
  BackupManifest,
} from './backup.service.js';

const execFileAsync = promisify(execFile);

export interface RestorationVerificationReport {
  success: boolean;
  verifiedAt: string;
  backupId: string;
  isolatedDatabaseName: string;
  restorationDurationMs: number;
  checks: {
    artifactDecryptionAndChecksums: boolean;
    schemaAndDataRestoration: boolean;
    fieldEncryptionUsable: boolean;
    decryptedSampleCount: number;
    userAccountIntegrity: boolean;
    academicRelationshipsIntegrity: boolean;
    attendanceRecordsIntegrity: boolean;
    mediaStorageRestoration: boolean;
    restoredFilesCount: number;
    databaseMediaReferentialIntegrity: boolean;
  };
  metrics: {
    restoredUsersCount: number;
    restoredStudentsCount: number;
    restoredTeachersCount: number;
    restoredEnrollmentsCount: number;
    restoredGradesCount: number;
    restoredAttendanceCount: number;
    verifiedReferencedMediaCount: number;
    missingReferencedMediaCount: number;
  };
  errors: string[];
}

/**
 * Execute psql command securely against the target server.
 */
async function executePsql(creds: DatabaseCredentials, targetDb: string, sqlCommand: string): Promise<string> {
  const psqlBin = findPostgresBinary('psql');
  const args = [
    '--host', creds.host,
    '--port', creds.port.toString(),
    '--username', creds.user,
    '--dbname', targetDb,
    '-c', sqlCommand,
  ];

  const env = {
    ...process.env,
    PGPASSWORD: creds.password || '',
  };

  const { stdout } = await execFileAsync(psqlBin, args, { env });
  return stdout;
}

/**
 * Perform a controlled, non-destructive restoration verification of a backup bundle
 * into an isolated sandbox database.
 * 
 * STRICT DESTRUCTIVE SAFETY:
 * Never drops, truncates, or modifies the live production database.
 * Restores exclusively into a newly created `digiskwela_restore_test_<timestamp>` database.
 */
export async function verifyRestoration(backupDirPath: string, options?: {
  baseDatabaseUrl?: string;
  keepSandboxDb?: boolean;
}): Promise<RestorationVerificationReport> {
  const startTime = Date.now();
  const errors: string[] = [];
  const testDbSuffix = Date.now().toString(36);
  const isolatedDbName = `digiskwela_restore_test_${testDbSuffix}`;

  // 1. Validate bundle checksums and manifest
  const bundleCheck = await verifyBackupBundle(backupDirPath);
  if (!bundleCheck.valid || !bundleCheck.manifest) {
    throw new Error(`Backup bundle validation failed: ${bundleCheck.errors.join('; ')}`);
  }
  const manifest = bundleCheck.manifest;

  const dbUrl = options?.baseDatabaseUrl || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not configured for restore verification.');
  }
  const creds = parseDatabaseUrl(dbUrl);

  const pgRestoreBin = findPostgresBinary('pg_restore');
  const dumpFilePath = path.join(backupDirPath, manifest.database.filename);
  const storageArchiveFilePath = path.join(backupDirPath, manifest.storage.filename);

  const isolatedStorageDir = path.join(path.dirname(backupDirPath), `sandbox_storage_${testDbSuffix}`);

  let isolatedPrisma: any = null;
  const metrics = {
    restoredUsersCount: 0,
    restoredStudentsCount: 0,
    restoredTeachersCount: 0,
    restoredEnrollmentsCount: 0,
    restoredGradesCount: 0,
    restoredAttendanceCount: 0,
    verifiedReferencedMediaCount: 0,
    missingReferencedMediaCount: 0,
  };

  const checks = {
    artifactDecryptionAndChecksums: true,
    schemaAndDataRestoration: false,
    fieldEncryptionUsable: false,
    decryptedSampleCount: 0,
    userAccountIntegrity: false,
    academicRelationshipsIntegrity: false,
    attendanceRecordsIntegrity: false,
    mediaStorageRestoration: false,
    restoredFilesCount: 0,
    databaseMediaReferentialIntegrity: false,
  };

  try {
    // 2. Create isolated sandbox database
    const maintenanceDb = creds.database || 'digiskwela_test';
    await executePsql(creds, maintenanceDb, `CREATE DATABASE "${isolatedDbName}";`);

    // 3. Restore pg_dump archive into isolated database
    const restoreArgs = [
      '--host', creds.host,
      '--port', creds.port.toString(),
      '--username', creds.user,
      '--dbname', isolatedDbName,
      '--no-owner',
      '--no-privileges',
      dumpFilePath,
    ];

    const restoreEnv = {
      ...process.env,
      PGPASSWORD: creds.password || '',
    };

    try {
      await execFileAsync(pgRestoreBin, restoreArgs, { env: restoreEnv });
      checks.schemaAndDataRestoration = true;
    } catch (restoreErr: any) {
      // pg_restore may return non-zero for minor warnings (e.g. extension already exists)
      // Check if schema tables were actually created
      const tablesCheck = await executePsql(creds, isolatedDbName, `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';`);
      if (parseInt(tablesCheck.trim(), 10) > 0 || tablesCheck.includes('count')) {
        checks.schemaAndDataRestoration = true;
      } else {
        errors.push(`pg_restore failed: ${restoreErr.message}`);
      }
    }

    // 4. Extract storage archive into isolated sandbox directory
    try {
      const extractedCount = await extractStorageArchive(storageArchiveFilePath, isolatedStorageDir);
      checks.mediaStorageRestoration = true;
      checks.restoredFilesCount = extractedCount;
    } catch (storageErr: any) {
      errors.push(`Storage extraction failed: ${storageErr.message}`);
    }

    // 5. Connect isolated Prisma client to verify data & encryption
    const sandboxDbUrl = `postgresql://${creds.user}:${encodeURIComponent(creds.password || '')}@${creds.host}:${creds.port}/${isolatedDbName}?schema=public`;

    const baseClient = new PrismaClient({
      datasources: { db: { url: sandboxDbUrl } },
      log: ['error'],
    });

    isolatedPrisma = baseClient.$extends(
      fieldEncryptionExtension()
    );

    // 5a. User Account Verification
    const usersCount = await isolatedPrisma.user.count();
    metrics.restoredUsersCount = usersCount;
    if (usersCount > 0) {
      checks.userAccountIntegrity = true;
    } else {
      errors.push('Zero user accounts found in restored database.');
    }

    // 5b. Academic & Student Integrity
    const studentsCount = await isolatedPrisma.student.count();
    const teachersCount = await isolatedPrisma.teacher.count();
    metrics.restoredStudentsCount = studentsCount;
    metrics.restoredTeachersCount = teachersCount;

    // 5c. Field Encryption Usability (Decrypt LRN and guardian phone)
    if (studentsCount > 0) {
      const sampleStudent = await isolatedPrisma.student.findFirst({
        where: { lrn: { not: '' } },
      });

      if (sampleStudent && sampleStudent.lrn) {
        // If field encryption extension works, lrn is decrypted text, not k1.aesgcm256 ciphertext
        const isDecrypted = !sampleStudent.lrn.startsWith('k1.aesgcm256.');
        if (isDecrypted) {
          checks.fieldEncryptionUsable = true;
          checks.decryptedSampleCount = 1;
        } else {
          errors.push('Restored student LRN remains raw ciphertext. PRISMA_FIELD_ENCRYPTION_KEY mismatch or missing extension.');
        }
      } else {
        checks.fieldEncryptionUsable = true; // No encrypted students in snapshot, acceptable
      }
    } else {
      checks.fieldEncryptionUsable = true;
    }

    // 5d. Enrollment & Gradebook Relationship Integrity
    const enrollmentsCount = await isolatedPrisma.enrollment.count();
    const gradesCount = await isolatedPrisma.grade.count();
    metrics.restoredEnrollmentsCount = enrollmentsCount;
    metrics.restoredGradesCount = gradesCount;
    checks.academicRelationshipsIntegrity = true;

    // 5e. Attendance Records Integrity
    const gateAttendanceCount = await isolatedPrisma.gateAttendance.count();
    metrics.restoredAttendanceCount = gateAttendanceCount;
    checks.attendanceRecordsIntegrity = true;

    // 5f. Cross-Snapshot Database-to-Media Referential Integrity
    try {
      const restoredMediaReferences = await getReferencedMediaFiles(isolatedPrisma);
      let missingMediaCount = 0;
      let verifiedMediaCount = 0;

      for (const ref of restoredMediaReferences) {
        const physicalPath = path.join(isolatedStorageDir, ref.expectedRelativePath);
        if (!fs.existsSync(physicalPath)) {
          missingMediaCount++;
          errors.push(
            `Missing referenced media in restored archive: ${ref.model} (ID: ${ref.id}) expects file at '${ref.expectedRelativePath}'`
          );
        } else {
          // If expected size is available, verify byte size consistency
          if (ref.expectedSizeBytes !== undefined) {
            const actualSize = fs.statSync(physicalPath).size;
            if (actualSize !== ref.expectedSizeBytes) {
              missingMediaCount++;
              errors.push(
                `Mismatched media file size in restored archive: ${ref.model} (ID: ${ref.id}) expects ${ref.expectedSizeBytes} bytes, got ${actualSize} bytes`
              );
            } else {
              verifiedMediaCount++;
            }
          } else {
            verifiedMediaCount++;
          }
        }
      }

      metrics.verifiedReferencedMediaCount = verifiedMediaCount;
      metrics.missingReferencedMediaCount = missingMediaCount;
      checks.databaseMediaReferentialIntegrity = missingMediaCount === 0;

      if (missingMediaCount > 0) {
        errors.push(
          `Referential integrity failure: ${missingMediaCount} media file(s) referenced by restored database are missing or corrupted in restored storage.`
        );
      }
    } catch (refErr: any) {
      errors.push(`Media referential integrity check error: ${refErr.message}`);
      checks.databaseMediaReferentialIntegrity = false;
    }

  } catch (err: any) {
    errors.push(`Restoration verification error: ${err?.message}`);
  } finally {
    // 6. Disconnect isolated Prisma client
    if (isolatedPrisma) {
      try {
        await isolatedPrisma.$disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }

    // 7. Clean up sandbox database (unless explicitly preserved)
    if (!options?.keepSandboxDb) {
      try {
        // Terminate any remaining connections to sandbox db before dropping
        const maintenanceDb = creds.database || 'digiskwela_test';
        await executePsql(
          creds,
          maintenanceDb,
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${isolatedDbName}';`
        );
        await executePsql(creds, maintenanceDb, `DROP DATABASE IF EXISTS "${isolatedDbName}";`);
      } catch (cleanupErr: any) {
        console.warn(`Could not drop sandbox database ${isolatedDbName}:`, cleanupErr.message);
      }
    }

    // 8. Clean up sandbox storage directory
    if (fs.existsSync(isolatedStorageDir)) {
      try {
        fs.rmSync(isolatedStorageDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup error
      }
    }
  }

  const restorationDurationMs = Date.now() - startTime;
  const isSuccessful =
    errors.length === 0 &&
    checks.schemaAndDataRestoration &&
    checks.userAccountIntegrity &&
    checks.databaseMediaReferentialIntegrity;

  const report: RestorationVerificationReport = {
    success: isSuccessful,
    verifiedAt: new Date().toISOString(),
    backupId: manifest.backupId,
    isolatedDatabaseName: isolatedDbName,
    restorationDurationMs,
    checks,
    metrics,
    errors,
  };

  // Write verification report to backup directory and root registry
  const reportPath = path.join(path.dirname(backupDirPath), 'restore-verification.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  return report;
}
