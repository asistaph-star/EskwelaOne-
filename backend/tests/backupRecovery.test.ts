import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/app.js';
import {
  findPostgresBinary,
  parseDatabaseUrl,
  computeFileHash,
  archiveStorageDirectory,
  extractStorageArchive,
  createBackup,
  verifyBackupBundle,
  enforceBackupRetention,
  getBackupStatusOverview,
  getReferencedMediaFiles,
} from '../src/backup/backup.service.js';
import { verifyRestoration } from '../src/backup/restore.service.js';
import prisma from '../src/config/database.js';

describe('DIGISKWELA — Backup & Disaster Recovery Readiness Test Suite', () => {
  let itAdminCookie: string;
  let adminCookie: string;
  let teacherCookie: string;
  let studentCookie: string;

  const testTempDir = path.join(process.cwd(), 'backups', 'test_backup_suite');

  beforeAll(async () => {
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }

    // 1. Authenticate ITAdmin
    const itRes = await request(app).post('/api/auth/login').send({ schoolId: 'IT-001', password: 'password123' });
    expect(itRes.status).toBe(200);
    itAdminCookie = (itRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 2. Authenticate Admin
    const adminRes = await request(app).post('/api/auth/login').send({ schoolId: 'ADM-001', password: 'password123' });
    expect(adminRes.status).toBe(200);
    adminCookie = (adminRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 3. Authenticate Teacher
    const teacherRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-T-001', password: 'password123' });
    expect(teacherRes.status).toBe(200);
    teacherCookie = (teacherRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 4. Authenticate Student
    const studentRes = await request(app).post('/api/auth/login').send({ schoolId: '2026-00001', password: 'password123' });
    expect(studentRes.status).toBe(200);
    studentCookie = (studentRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;
  });

  afterAll(() => {
    // Clean up temporary test directory
    if (fs.existsSync(testTempDir)) {
      try {
        fs.rmSync(testTempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup error
      }
    }
  });

  // ─── 1. TOOLING & CONFIGURATION PARSING ───────────────────────────────────────
  describe('1. Tooling & Configuration Locator', () => {
    it('successfully locates PostgreSQL 17 pg_dump binary', () => {
      const bin = findPostgresBinary('pg_dump');
      expect(bin).toBeDefined();
      expect(typeof bin).toBe('string');
      expect(fs.existsSync(bin)).toBe(true);
    });

    it('successfully locates PostgreSQL 17 pg_restore binary', () => {
      const bin = findPostgresBinary('pg_restore');
      expect(bin).toBeDefined();
      expect(typeof bin).toBe('string');
      expect(fs.existsSync(bin)).toBe(true);
    });

    it('parses DATABASE_URL into typed connection components safely', () => {
      const parsed = parseDatabaseUrl('postgresql://myuser:mypassword@db.host.internal:5433/schooldb?schema=custom');
      expect(parsed.host).toBe('db.host.internal');
      expect(parsed.port).toBe(5433);
      expect(parsed.user).toBe('myuser');
      expect(parsed.password).toBe('mypassword');
      expect(parsed.database).toBe('schooldb');
      expect(parsed.schema).toBe('custom');
    });

    it('computes accurate SHA-256 hash of a file on disk', async () => {
      const sampleFile = path.join(testTempDir, 'hash_test.txt');
      fs.writeFileSync(sampleFile, 'DigiSkwela Calulut INHS Backup Verification 2026', 'utf-8');

      const hash = await computeFileHash(sampleFile);
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);

      // Re-computation produces identical deterministic hash
      const hashAgain = await computeFileHash(sampleFile);
      expect(hashAgain).toBe(hash);
    });
  });

  // ─── 2. STORAGE ARCHIVING & EXTRACTION FIDELITY ──────────────────────────────
  describe('2. Media Storage Archiving & Extraction', () => {
    it('archives directory and extracts back with 100% round-trip byte fidelity', async () => {
      const sourceDir = path.join(testTempDir, 'mock_storage_source');
      const subDir = path.join(sourceDir, 'branding');
      fs.mkdirSync(subDir, { recursive: true });

      const file1Path = path.join(sourceDir, 'document_sample.txt');
      const file2Path = path.join(subDir, 'logo_seal.png');
      fs.writeFileSync(file1Path, 'Sample Document Content DepEd Form 137');
      fs.writeFileSync(file2Path, 'Binary-like seal data header PNG');

      const archiveDest = path.join(testTempDir, 'storage_test.tar.gz');

      // 1. Archive
      const archiveResult = await archiveStorageDirectory(sourceDir, archiveDest);
      expect(archiveResult.filesCount).toBe(2);
      expect(archiveResult.sizeBytes).toBeGreaterThan(0);
      expect(archiveResult.sha256).toHaveLength(64);

      // 2. Extract
      const extractDest = path.join(testTempDir, 'mock_storage_extracted');
      const extractedCount = await extractStorageArchive(archiveDest, extractDest);
      expect(extractedCount).toBe(2);

      // 3. Verify content fidelity
      const restoredFile1 = fs.readFileSync(path.join(extractDest, 'document_sample.txt'), 'utf-8');
      const restoredFile2 = fs.readFileSync(path.join(extractDest, 'branding', 'logo_seal.png'), 'utf-8');

      expect(restoredFile1).toBe('Sample Document Content DepEd Form 137');
      expect(restoredFile2).toBe('Binary-like seal data header PNG');
    });
  });

  // ─── 3. ATOMIC BACKUP CREATION & INTEGRITY VERIFICATION ─────────────────────
  describe('3. Atomic Backup Bundle Creation', () => {
    let createdBackupPath: string;

    it('creates a complete, verified backup bundle with native pg_dump custom format', async () => {
      const manifest = await createBackup({
        customBackupDir: testTempDir,
        retentionCount: 5,
      });

      expect(manifest.backupId).toBeDefined();
      expect(manifest.overallStatus).toBe('SUCCESS');
      expect(manifest.durationMs).toBeGreaterThan(0);

      // Database dump verified
      expect(manifest.database.status).toBe('VERIFIED');
      expect(manifest.database.format).toBe('custom');
      expect(manifest.database.sizeBytes).toBeGreaterThan(1000);
      expect(manifest.database.sha256).toHaveLength(64);
      expect(manifest.database.tableCount).toBeGreaterThan(10);

      // Storage archive verified
      expect(manifest.storage.status).toBe('VERIFIED');
      expect(manifest.storage.sizeBytes).toBeGreaterThan(0);
      expect(manifest.storage.sha256).toHaveLength(64);

      // Manifest & checksum files exist on disk
      createdBackupPath = path.join(testTempDir, manifest.backupId);
      expect(fs.existsSync(path.join(createdBackupPath, 'database.dump'))).toBe(true);
      expect(fs.existsSync(path.join(createdBackupPath, 'storage.tar.gz'))).toBe(true);
      expect(fs.existsSync(path.join(createdBackupPath, 'backup-manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(createdBackupPath, 'checksums.sha256'))).toBe(true);
    });

    it('passes bundle integrity validation on the created bundle', async () => {
      const check = await verifyBackupBundle(createdBackupPath);
      expect(check.valid).toBe(true);
      expect(check.errors).toHaveLength(0);
      expect(check.manifest?.overallStatus).toBe('SUCCESS');
    });

    it('detects tampering or corruption if a dump file is modified', async () => {
      // Create a corrupted test copy
      const tamperedDir = path.join(testTempDir, 'tampered_backup');
      fs.cpSync(createdBackupPath, tamperedDir, { recursive: true });

      // Modify database dump content
      fs.appendFileSync(path.join(tamperedDir, 'database.dump'), '\nCORRUPTED_BYTES');

      const check = await verifyBackupBundle(tamperedDir);
      expect(check.valid).toBe(false);
      expect(check.errors.some(e => e.includes('SHA-256 mismatch') || e.includes('catalog'))).toBe(true);
    });
  });

  // ─── 4. RETENTION POLICY ENFORCEMENT ──────────────────────────────────────────
  describe('4. Backup Retention Enforcement', () => {
    it('prunes oldest backup records when count exceeds retention threshold', () => {
      const registryPath = path.join(testTempDir, 'backup-registry.json');
      const mockEntries = [
        { backupId: 'b1', timestamp: '2026-10-26T01:00:00Z', overallStatus: 'SUCCESS', totalSize: 100, verified: true, backupPath: path.join(testTempDir, 'b1'), durationMs: 100 },
        { backupId: 'b2', timestamp: '2026-10-26T02:00:00Z', overallStatus: 'SUCCESS', totalSize: 100, verified: true, backupPath: path.join(testTempDir, 'b2'), durationMs: 100 },
        { backupId: 'b3', timestamp: '2026-10-26T03:00:00Z', overallStatus: 'SUCCESS', totalSize: 100, verified: true, backupPath: path.join(testTempDir, 'b3'), durationMs: 100 },
      ];

      // Create dummy folders
      fs.mkdirSync(path.join(testTempDir, 'b1'), { recursive: true });
      fs.mkdirSync(path.join(testTempDir, 'b2'), { recursive: true });
      fs.mkdirSync(path.join(testTempDir, 'b3'), { recursive: true });

      fs.writeFileSync(registryPath, JSON.stringify(mockEntries, null, 2), 'utf-8');

      // Keep only 2
      const deleted = enforceBackupRetention(testTempDir, 2);
      expect(deleted).toBe(1);
      expect(fs.existsSync(path.join(testTempDir, 'b3'))).toBe(false); // b3 was oldest (index 2)
      expect(fs.existsSync(path.join(testTempDir, 'b1'))).toBe(true);
      expect(fs.existsSync(path.join(testTempDir, 'b2'))).toBe(true);
    });
  });

  // ─── 5. BACKEND API ACCESS CONTROL & SECURITY ─────────────────────────────────
  describe('5. Read-Only Backend API & Access Control (/api/admin/backup-status)', () => {
    it('allows ITAdmin full operational backup status', async () => {
      const res = await request(app)
        .get('/api/admin/backup-status')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.backupType).toContain('PostgreSQL');
      expect(res.body.data.verificationStatus).toBeDefined();
      expect(Array.isArray(res.body.data.recentBackups)).toBe(true);
    });

    it('allows Admin operational overview while masking server paths', async () => {
      const res = await request(app)
        .get('/api/admin/backup-status')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      for (const b of res.body.data.recentBackups) {
        expect(b.backupPath).toBe('[PROTECTED_SERVER_PATH]');
      }
    });

    it('blocks Teacher with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/backup-status')
        .set('Cookie', [teacherCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/backup-status')
        .set('Cookie', [studentCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/backup-status');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects POST mutation with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .post('/api/admin/backup-status')
        .set('Cookie', [itAdminCookie])
        .send({ action: 'trigger' });

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('rejects DELETE mutation with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .delete('/api/admin/backup-status')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('does not expose credentials, database passwords, or JWT secrets in API payload', async () => {
      const res = await request(app)
        .get('/api/admin/backup-status')
        .set('Cookie', [itAdminCookie]);

      const jsonStr = JSON.stringify(res.body).toLowerCase();
      expect(jsonStr).not.toContain('admin123');
      expect(jsonStr).not.toContain('super_secret_jwt');
      expect(jsonStr).not.toContain('k1.aesgcm256');
      expect(jsonStr).not.toContain('prisma_field_encryption_key');
    });
  });

  // ─── 6. CONCURRENCY, ARCHIVE SECURITY & SENSITIVE-DATA INTEGRITY ─────────────
  describe('6. Concurrency, Archive Security & Sensitive-Data Leak Protection', () => {
    it('detects concurrent file modification during media archiving and rejects the operation', async () => {
      const concurrencyDir = path.join(testTempDir, 'concurrency_mod_test');
      fs.mkdirSync(concurrencyDir, { recursive: true });
      const targetFile = path.join(concurrencyDir, 'doc_mod.txt');
      fs.writeFileSync(targetFile, 'Original Content Baseline');

      const archiveDest = path.join(testTempDir, 'concurrency_mod.tar.gz');

      // Intercept fs.readFileSync to modify the file concurrently during archiving
      const originalReadFileSync = fs.readFileSync;
      const readSpy = (p: any, ...args: any[]) => {
        const result = (originalReadFileSync as any)(p, ...args);
        if (typeof p === 'string' && p.includes('doc_mod.txt')) {
          // Simulate concurrent write by another process
          fs.appendFileSync(targetFile, '\nCONCURRENT_MODIFIED_BYTES');
        }
        return result;
      };

      (fs as any).readFileSync = readSpy;

      try {
        await expect(archiveStorageDirectory(concurrencyDir, archiveDest)).rejects.toThrow(
          /Media consistency failure: file content was modified during archiving/
        );
      } finally {
        (fs as any).readFileSync = originalReadFileSync;
      }
    });

    it('detects concurrent file creation during media archiving and rejects the operation', async () => {
      const concurrencyDir = path.join(testTempDir, 'concurrency_create_test');
      fs.mkdirSync(concurrencyDir, { recursive: true });
      const targetFile = path.join(concurrencyDir, 'doc_existing.txt');
      fs.writeFileSync(targetFile, 'Existing Initial Content');

      const archiveDest = path.join(testTempDir, 'concurrency_create.tar.gz');

      // Intercept fs.readFileSync to create a new file during archiving
      const originalReadFileSync = fs.readFileSync;
      const readSpy = (p: any, ...args: any[]) => {
        const result = (originalReadFileSync as any)(p, ...args);
        if (typeof p === 'string' && p.includes('doc_existing.txt')) {
          // Simulate concurrent file creation
          fs.writeFileSync(path.join(concurrencyDir, 'new_concurrent_file.txt'), 'New File Uploaded');
        }
        return result;
      };

      (fs as any).readFileSync = readSpy;

      try {
        await expect(archiveStorageDirectory(concurrencyDir, archiveDest)).rejects.toThrow(
          /Media consistency failure: file count changed during archiving/
        );
      } finally {
        (fs as any).readFileSync = originalReadFileSync;
      }
    });

    it('detects concurrent file deletion during media archiving and rejects the operation', async () => {
      const concurrencyDir = path.join(testTempDir, 'concurrency_delete_test');
      fs.mkdirSync(concurrencyDir, { recursive: true });
      const file1 = path.join(concurrencyDir, 'file_1.txt');
      const file2 = path.join(concurrencyDir, 'file_2.txt');
      fs.writeFileSync(file1, 'File 1 content');
      fs.writeFileSync(file2, 'File 2 content');

      const archiveDest = path.join(testTempDir, 'concurrency_delete.tar.gz');

      // Intercept fs.readFileSync to delete file2 during archiving of file1
      const originalReadFileSync = fs.readFileSync;
      const readSpy = (p: any, ...args: any[]) => {
        if (typeof p === 'string' && p.includes('file_1.txt')) {
          // Delete file2 before it is captured
          if (fs.existsSync(file2)) {
            fs.unlinkSync(file2);
          }
        }
        return (originalReadFileSync as any)(p, ...args);
      };

      (fs as any).readFileSync = readSpy;

      try {
        await expect(archiveStorageDirectory(concurrencyDir, archiveDest)).rejects.toThrow(
          /Media consistency failure: file was deleted during archiving/
        );
      } finally {
        (fs as any).readFileSync = originalReadFileSync;
      }
    });

    it('confirms backend/backups is strictly inaccessible via public HTTP static routes', async () => {
      const res = await request(app).get('/backups/backup-registry.json');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('confirms backend/backups is excluded in .gitignore', () => {
      const gitignorePath = path.join(process.cwd(), '..', '.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      expect(gitignoreContent).toContain('backend/backups/');
      expect(gitignoreContent).toContain('*.tar.gz');
    });

    it('updates operational message appropriately when the latest backup is marked FAILED', () => {
      const mockDir = path.join(testTempDir, 'failed_overview_test');
      fs.mkdirSync(mockDir, { recursive: true });

      const failedEntries = [
        {
          backupId: 'backup_failed_01',
          timestamp: '2026-10-26T12:00:00Z',
          overallStatus: 'FAILED',
          databaseSize: 0,
          storageSize: 0,
          totalSize: 0,
          verified: false,
          backupPath: path.join(mockDir, 'backup_failed_01'),
          durationMs: 150,
        },
      ];

      fs.writeFileSync(path.join(mockDir, 'backup-registry.json'), JSON.stringify(failedEntries, null, 2), 'utf-8');

      const overview = getBackupStatusOverview(mockDir);
      expect(overview.lastBackupResult).toBe('FAILED');
      expect(overview.verificationStatus).toBe('UNVERIFIED');
      expect(overview.operationalMessage).toContain('Last backup execution failed');
      expect(overview.operationalMessage).not.toContain('executed successfully');
    });
  });

  // ─── 7. CROSS-SNAPSHOT REFERENTIAL CONSISTENCY & RECOVERY INTEGRITY ──────────
  describe('7. Cross-Snapshot Referential Consistency & Database-to-Media Integrity', () => {
    let backupDocId: string | null = null;

    beforeAll(async () => {
      const admin = await prisma.user.findFirst({ where: { school_id: 'ADM-001' } });
      const adminId = admin ? admin.id : 'demo-admin-1';

      const docFile = '01a10cc8-9f7f-709e-ba78-612007f2c600.pdf';
      const docPath = path.join(process.cwd(), 'storage', 'documents', docFile);
      if (fs.existsSync(docPath)) {
        const stat = fs.statSync(docPath);
        backupDocId = 'backup-suite-doc-1';
        await prisma.document.upsert({
          where: { id: backupDocId },
          update: { size_bytes: stat.size, storage_key: docFile },
          create: {
            id: backupDocId,
            storage_key: docFile,
            filename: docFile,
            mime_type: 'application/pdf',
            size_bytes: stat.size,
            uploaded_by: adminId,
          },
        });
      }
    });

    afterAll(async () => {
      if (backupDocId) {
        await prisma.document.deleteMany({ where: { id: backupDocId } }).catch(() => {});
      }
    });

    it('accurately discovers active media references from database models', async () => {
      const mockPrisma = {
        document: {
          findMany: async () => [
            { id: 'doc-1', storage_key: 'test_doc_1.pdf', size_bytes: 1024 },
          ],
        },
        schoolSettings: {
          findFirst: async () => ({
            id: 'settings-1',
            logo_url: '/storage/branding/school_logo.png',
            favicon_url: '/storage/branding/favicon.ico',
            login_background_url: null,
          }),
        },
        leaveRequest: {
          findMany: async () => [
            { id: 'leave-1', attachment_url: '/storage/leaves/med_cert.pdf' },
          ],
        },
      };

      const refs = await getReferencedMediaFiles(mockPrisma);
      expect(refs.length).toBe(4);
      expect(refs).toContainEqual({
        model: 'Document',
        id: 'doc-1',
        expectedRelativePath: 'documents/test_doc_1.pdf',
        expectedSizeBytes: 1024,
      });
      expect(refs).toContainEqual({
        model: 'SchoolSettings',
        id: 'settings-1:logo_url',
        expectedRelativePath: 'branding/school_logo.png',
      });
      expect(refs).toContainEqual({
        model: 'SchoolSettings',
        id: 'settings-1:favicon_url',
        expectedRelativePath: 'branding/favicon.ico',
      });
      expect(refs).toContainEqual({
        model: 'LeaveRequest',
        id: 'leave-1',
        expectedRelativePath: 'leaves/med_cert.pdf',
      });
    });

    it('TEST A: rejects backup when a database-referenced file is deleted or missing from the media archive', async () => {
      // Create a test storage directory that intentionally omits database-referenced files
      const inconsistentStorageDir = path.join(testTempDir, 'inconsistent_storage');
      fs.mkdirSync(path.join(inconsistentStorageDir, 'documents'), { recursive: true });
      fs.writeFileSync(path.join(inconsistentStorageDir, 'documents', 'unrelated_orphan.pdf'), 'Orphan content');

      // Attempt backup pointing to inconsistentStorageDir where real database-referenced media is missing
      await expect(
        createBackup({
          customBackupDir: testTempDir,
          storageDir: inconsistentStorageDir,
        })
      ).rejects.toThrow(/Cross-snapshot consistency failure.*missing from media archive/);

      // Verify registry records the failure and marks verified: false
      const registryPath = path.join(testTempDir, 'backup-registry.json');
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      const failedEntry = registry[0];
      expect(failedEntry.overallStatus).toBe('FAILED');
      expect(failedEntry.verified).toBe(false);
    });

    it('TEST B: rejects backup when a database-referenced file has mismatched size (file replaced)', async () => {
      // Copy real storage directory but mutate the size of a referenced document
      const realStorageDir = path.join(process.cwd(), 'storage');
      const mutatedStorageDir = path.join(testTempDir, 'mutated_storage');
      fs.cpSync(realStorageDir, mutatedStorageDir, { recursive: true });

      // Find the first document file and append bytes to alter its size
      const docsDir = path.join(mutatedStorageDir, 'documents');
      const docFiles = fs.readdirSync(docsDir);
      expect(docFiles.length).toBeGreaterThan(0);
      const targetDoc = path.join(docsDir, docFiles[0]);
      fs.appendFileSync(targetDoc, '\nTAMPERED_EXTRA_BYTES_FOR_SIZE_MISMATCH');

      await expect(
        createBackup({
          customBackupDir: testTempDir,
          storageDir: mutatedStorageDir,
        })
      ).rejects.toThrow(/Cross-snapshot consistency failure.*mismatched size/);
    });

    it('TEST C: allows harmless unreferenced files in storage without failing backup', async () => {
      // Copy real storage directory and add an unreferenced file
      const unrefStorageDir = path.join(testTempDir, 'unreferenced_storage');
      const realStorageDir = path.join(process.cwd(), 'storage');
      fs.cpSync(realStorageDir, unrefStorageDir, { recursive: true });

      fs.writeFileSync(
        path.join(unrefStorageDir, 'documents', 'harmless_unreferenced_extra.txt'),
        'Harmless unreferenced media created during backup'
      );

      const manifest = await createBackup({
        customBackupDir: testTempDir,
        storageDir: unrefStorageDir,
        retentionCount: 5,
      });

      expect(manifest.overallStatus).toBe('SUCCESS');
      expect(manifest.storage.crossSnapshotConsistency).toBe('VERIFIED');
      expect(manifest.storage.referencedMediaCount).toBeGreaterThan(0);
    });

    it('TEST D: isolated restoration verifies database-to-media referential links on healthy backup', async () => {
      // Execute a real backup with full storage directory
      const manifest = await createBackup({
        customBackupDir: testTempDir,
        retentionCount: 5,
      });
      expect(manifest.overallStatus).toBe('SUCCESS');

      const backupBundleDir = path.join(testTempDir, manifest.backupId);
      const report = await verifyRestoration(backupBundleDir);

      expect(report.success).toBe(true);
      expect(report.checks.databaseMediaReferentialIntegrity).toBe(true);
      expect(report.metrics.missingReferencedMediaCount).toBe(0);
      expect(report.metrics.verifiedReferencedMediaCount).toBeGreaterThan(0);
    }, 30000);

    it('TEST E: isolated restoration fails if a referenced media file is missing in restored storage', async () => {
      // Create a corrupted backup copy where a referenced file is missing from storage archive
      const manifest = await createBackup({
        customBackupDir: testTempDir,
        retentionCount: 5,
      });

      const originalBundleDir = path.join(testTempDir, manifest.backupId);
      const corruptedBundleDir = path.join(testTempDir, 'corrupted_media_bundle');
      fs.cpSync(originalBundleDir, corruptedBundleDir, { recursive: true });

      // Create an empty storage archive inside the corrupted bundle
      const emptyArchive = path.join(corruptedBundleDir, 'storage.tar.gz');
      const emptyStorageDir = path.join(testTempDir, 'empty_temp_storage');
      fs.mkdirSync(emptyStorageDir, { recursive: true });
      const archiveResult = await archiveStorageDirectory(emptyStorageDir, emptyArchive);

      // Update manifest checksum for the replaced archive so it passes file-level hash check
      const manifestPath = path.join(corruptedBundleDir, 'backup-manifest.json');
      const bundleManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      bundleManifest.storage.sha256 = archiveResult.sha256;
      bundleManifest.storage.sizeBytes = archiveResult.sizeBytes;
      fs.writeFileSync(manifestPath, JSON.stringify(bundleManifest, null, 2), 'utf-8');

      // Restoration must FAIL because restored database references media missing from restored storage!
      const report = await verifyRestoration(corruptedBundleDir);
      expect(report.success).toBe(false);
      expect(report.checks.databaseMediaReferentialIntegrity).toBe(false);
      expect(report.metrics.missingReferencedMediaCount).toBeGreaterThan(0);
      expect(report.errors.some(e => e.includes('Missing referenced media'))).toBe(true);
    }, 30000);
  });
});


