import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database.js';
import {
  createBackup,
  verifyBackupBundle,
  getBackupStatusOverview,
} from '../src/backup/backup.service.js';
import { verifyRestoration } from '../src/backup/restore.service.js';

describe('DIGISKWELA — DEF-001 Cross-Snapshot Consistency & Recovery Verification', () => {
  const testSuiteDir = path.join(process.cwd(), 'backups', 'def001_verification_suite');
  const testStorageDir = path.join(testSuiteDir, 'test_storage');
  let adminUserId: string;

  beforeAll(async () => {
    if (!fs.existsSync(testSuiteDir)) {
      fs.mkdirSync(testSuiteDir, { recursive: true });
    }
    const realStorageDir = path.join(process.cwd(), 'storage');
    if (fs.existsSync(realStorageDir)) {
      fs.cpSync(realStorageDir, testStorageDir, { recursive: true });
    }
    fs.mkdirSync(path.join(testStorageDir, 'documents'), { recursive: true });

    // Seed test admin user for document relations
    const adminUser = await prisma.user.findFirst({ where: { school_id: 'ADM-001' } });
    expect(adminUser).toBeDefined();
    adminUserId = adminUser!.id;
  });

  afterAll(async () => {
    // Cleanup temporary test suite files
    if (fs.existsSync(testSuiteDir)) {
      fs.rmSync(testSuiteDir, { recursive: true, force: true });
    }
  });

  // ─── TEST A — Delete File Only ──────────────────────────────────────────────
  it('TEST A: rejects backup when a database-referenced file is deleted after snapshot', async () => {
    const docId = `doc-test-a-${Date.now()}`;
    const filename = `file_a_${Date.now()}.pdf`;
    const storagePath = path.join(testStorageDir, 'documents', filename);
    const content = Buffer.from('TEST A: Sample Document Content for File Deletion Test');
    fs.writeFileSync(storagePath, content);

    await prisma.document.create({
      data: {
        id: docId,
        storage_key: filename,
        filename,
        mime_type: 'application/pdf',
        size_bytes: content.length,
        uploaded_by: adminUserId,
      },
    });

    try {
      await expect(
        createBackup({
          customBackupDir: testSuiteDir,
          storageDir: testStorageDir,
          onSnapshotExported: async () => {
            // Simulate race condition: file deleted from disk after database snapshot
            if (fs.existsSync(storagePath)) {
              fs.unlinkSync(storagePath);
            }
          },
        })
      ).rejects.toThrow(/Cross-snapshot consistency failure.*missing from media archive/);

      // Verify registry records failure and verified is false
      const registryPath = path.join(testSuiteDir, 'backup-registry.json');
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      const latest = registry[0];
      expect(latest.overallStatus).toBe('FAILED');
      expect(latest.verified).toBe(false);
    } finally {
      await prisma.document.deleteMany({ where: { id: docId } });
      if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
    }
  });

  // ─── TEST B — Primary DEF-001 Regression: Delete DB Record and File ────────
  it('TEST B: primary DEF-001 regression — rejects backup when DB record and file are deleted after snapshot', async () => {
    const docId = `doc-test-b-${Date.now()}`;
    const filename = `file_b_${Date.now()}.pdf`;
    const storagePath = path.join(testStorageDir, 'documents', filename);
    const content = Buffer.from('TEST B: Primary DEF-001 Regression Document Content');
    fs.writeFileSync(storagePath, content);

    await prisma.document.create({
      data: {
        id: docId,
        storage_key: filename,
        filename,
        mime_type: 'application/pdf',
        size_bytes: content.length,
        uploaded_by: adminUserId,
      },
    });

    try {
      // In the legacy implementation, deleting both DB record and file caused getReferencedMediaFiles
      // to return 0 records because it queried the live database, allowing the corrupt backup to pass!
      // In the corrected implementation, the RepeatableRead transaction binds getReferencedMediaFiles
      // to the exact snapshot captured by pg_dump, so it detects the missing file and rejects the backup.
      await expect(
        createBackup({
          customBackupDir: testSuiteDir,
          storageDir: testStorageDir,
          onSnapshotExported: async () => {
            // Delete DB record outside the transaction on live database
            await prisma.document.delete({ where: { id: docId } });
            // Delete file from disk
            if (fs.existsSync(storagePath)) {
              fs.unlinkSync(storagePath);
            }
          },
        })
      ).rejects.toThrow(/Cross-snapshot consistency failure.*missing from media archive/);

      // Verify backup is marked FAILED in registry
      const registryPath = path.join(testSuiteDir, 'backup-registry.json');
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      const latest = registry[0];
      expect(latest.overallStatus).toBe('FAILED');
      expect(latest.verified).toBe(false);
    } finally {
      await prisma.document.deleteMany({ where: { id: docId } });
      if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
    }
  });

  // ─── TEST C — Update Database Reference Between Snapshots ───────────────────
  it('TEST C: snapshot reference remains authoritative when live record is updated to new file', async () => {
    const docId = `doc-test-c-${Date.now()}`;
    const fileA = `file_c_original_${Date.now()}.pdf`;
    const fileB = `file_c_updated_${Date.now()}.pdf`;

    const storagePathA = path.join(testStorageDir, 'documents', fileA);
    const storagePathB = path.join(testStorageDir, 'documents', fileB);

    const contentA = Buffer.from('Original File A Content');
    const contentB = Buffer.from('Updated File B Content');
    fs.writeFileSync(storagePathA, contentA);

    await prisma.document.create({
      data: {
        id: docId,
        storage_key: fileA,
        filename: fileA,
        mime_type: 'application/pdf',
        size_bytes: contentA.length,
        uploaded_by: adminUserId,
      },
    });

    try {
      // If live database updates to File B and deletes File A after snapshot export:
      // The backup snapshot STILL expects File A.
      await expect(
        createBackup({
          customBackupDir: testSuiteDir,
          storageDir: testStorageDir,
          onSnapshotExported: async () => {
            // Update live DB record to reference File B and delete File A
            fs.writeFileSync(storagePathB, contentB);
            await prisma.document.update({
              where: { id: docId },
              data: { storage_key: fileB, filename: fileB, size_bytes: contentB.length },
            });
            if (fs.existsSync(storagePathA)) {
              fs.unlinkSync(storagePathA);
            }
          },
        })
      ).rejects.toThrow(/Cross-snapshot consistency failure.*missing from media archive/);
    } finally {
      await prisma.document.deleteMany({ where: { id: docId } });
      if (fs.existsSync(storagePathA)) fs.unlinkSync(storagePathA);
      if (fs.existsSync(storagePathB)) fs.unlinkSync(storagePathB);
    }
  });

  // ─── TEST D — Concurrent File Creation ──────────────────────────────────────
  it('TEST D: allows concurrent unreferenced file creation without failing backup', async () => {
    const unrefDoc = path.join(testStorageDir, 'documents', `unreferenced_${Date.now()}.txt`);

    const manifest = await createBackup({
      customBackupDir: testSuiteDir,
      storageDir: testStorageDir,
      onSnapshotExported: async () => {
        // Create an unreferenced file on disk while backup is active
        fs.writeFileSync(unrefDoc, 'Harmless concurrent file unreferenced by database snapshot');
      },
    });

    expect(manifest.overallStatus).toBe('SUCCESS');
    expect(manifest.storage.crossSnapshotConsistency).toBe('VERIFIED');

    if (fs.existsSync(unrefDoc)) fs.unlinkSync(unrefDoc);
  });

  // ─── TEST E — File Replacement / Size Mismatch ──────────────────────────────
  it('TEST E: rejects backup when file content on disk has mismatched byte size', async () => {
    const docId = `doc-test-e-${Date.now()}`;
    const filename = `file_e_${Date.now()}.pdf`;
    const storagePath = path.join(testStorageDir, 'documents', filename);
    const content = Buffer.from('Original Exact Document Content');
    fs.writeFileSync(storagePath, content);

    await prisma.document.create({
      data: {
        id: docId,
        storage_key: filename,
        filename,
        mime_type: 'application/pdf',
        size_bytes: content.length,
        uploaded_by: adminUserId,
      },
    });

    try {
      await expect(
        createBackup({
          customBackupDir: testSuiteDir,
          storageDir: testStorageDir,
          onSnapshotExported: async () => {
            // Alter byte size of file on disk after snapshot export
            fs.appendFileSync(storagePath, '\nTAMPERED_EXTRA_PAYLOAD');
          },
        })
      ).rejects.toThrow(/Cross-snapshot consistency failure.*mismatched size/);
    } finally {
      await prisma.document.deleteMany({ where: { id: docId } });
      if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
    }
  });

  // ─── TEST F — Interrupted Backup ────────────────────────────────────────────
  it('TEST F: cleanly marks interrupted backup as FAILED and preserves previous valid backups', async () => {
    // 1. First run a clean valid backup to establish a known good recovery generation
    const validManifest = await createBackup({
      customBackupDir: testSuiteDir,
      storageDir: testStorageDir,
    });
    expect(validManifest.overallStatus).toBe('SUCCESS');

    // 2. Run an interrupted backup attempt
    await expect(
      createBackup({
        customBackupDir: testSuiteDir,
        storageDir: testStorageDir,
        onSnapshotExported: async () => {
          throw new Error('SIMULATED_PROCESS_INTERRUPTION');
        },
      })
    ).rejects.toThrow('SIMULATED_PROCESS_INTERRUPTION');

    // 3. Verify registry reflects the latest failed backup but preserves previous valid backup
    const registryPath = path.join(testSuiteDir, 'backup-registry.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    expect(registry.length).toBeGreaterThanOrEqual(2);

    const latest = registry[0];
    expect(latest.overallStatus).toBe('FAILED');
    expect(latest.verified).toBe(false);

    const previousValid = registry[1];
    expect(previousValid.backupId).toBe(validManifest.backupId);
    expect(previousValid.overallStatus).toBe('SUCCESS');
    expect(previousValid.verified).toBe(true);
  });

  // ─── TEST G & H — Normal Valid Backup & Full Isolated Restoration ───────────
  it('TEST G & H: creates valid coordinated backup and verifies end-to-end isolated restoration', async () => {
    // 1. Create a synthetic document that will be cleanly backed up and restored
    const docId = `doc-valid-${Date.now()}`;
    const filename = `valid_doc_${Date.now()}.pdf`;
    const storagePath = path.join(testStorageDir, 'documents', filename);
    const content = Buffer.from('Valid Document for End-to-End Coordinated Restoration Test');
    fs.writeFileSync(storagePath, content);

    await prisma.document.create({
      data: {
        id: docId,
        storage_key: filename,
        filename,
        mime_type: 'application/pdf',
        size_bytes: content.length,
        uploaded_by: adminUserId,
      },
    });

    try {
      const manifest = await createBackup({
        customBackupDir: testSuiteDir,
        storageDir: testStorageDir,
      });

      expect(manifest.overallStatus).toBe('SUCCESS');
      expect(manifest.database.status).toBe('VERIFIED');
      expect(manifest.storage.status).toBe('VERIFIED');
      expect(manifest.storage.crossSnapshotConsistency).toBe('VERIFIED');
      expect(manifest.engine).toContain('Coordinated Snapshot');

      // 2. Validate bundle files and checksums
      const backupDir = path.join(testSuiteDir, manifest.backupId);
      const bundleCheck = await verifyBackupBundle(backupDir);
      expect(bundleCheck.valid).toBe(true);

      // 3. Execute isolated restoration verification (Option B verification)
      const restoreReport = await verifyRestoration(backupDir);
      expect(restoreReport.success).toBe(true);
      expect(restoreReport.checks.schemaAndDataRestoration).toBe(true);
      expect(restoreReport.checks.userAccountIntegrity).toBe(true);
      expect(restoreReport.checks.mediaStorageRestoration).toBe(true);
      expect(restoreReport.checks.databaseMediaReferentialIntegrity).toBe(true);
      expect(restoreReport.metrics.missingReferencedMediaCount).toBe(0);
      expect(restoreReport.errors.length).toBe(0);
    } finally {
      await prisma.document.deleteMany({ where: { id: docId } });
      if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
    }
  });
});
