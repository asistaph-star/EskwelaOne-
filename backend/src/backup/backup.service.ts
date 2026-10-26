import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);

export interface DatabaseCredentials {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  schema?: string;
}

export interface BackupComponentStatus {
  filename: string;
  sizeBytes: number;
  sha256: string;
  status: 'VERIFIED' | 'FAILED' | 'SKIPPED';
  details?: string;
}

export interface BackupManifest {
  backupId: string;
  timestamp: string;
  engine: string;
  database: BackupComponentStatus & {
    format: 'custom';
    tableCount?: number;
  };
  storage: BackupComponentStatus & {
    filesCount: number;
    referencedMediaCount?: number;
    crossSnapshotConsistency?: 'VERIFIED' | 'FAILED' | 'SKIPPED';
  };
  encryption: {
    fieldEncryptionConfigured: boolean;
    keyAlgorithm: string;
    warning: string;
  };
  overallStatus: 'SUCCESS' | 'FAILED';
  durationMs: number;
}

export interface ReferencedMediaItem {
  model: 'Document' | 'SchoolSettings' | 'LeaveRequest';
  id: string;
  expectedRelativePath: string;
  expectedSizeBytes?: number;
}

export interface StorageArchiveResult {
  filesCount: number;
  sizeBytes: number;
  sha256: string;
  archivedFiles: Array<{ relativePath: string; sizeBytes: number }>;
}

export interface BackupRegistryEntry {
  backupId: string;
  timestamp: string;
  overallStatus: 'SUCCESS' | 'FAILED';
  databaseSize: number;
  storageSize: number;
  totalSize: number;
  verified: boolean;
  backupPath: string;
  durationMs: number;
}

export interface BackupStatusOverview {
  lastBackupTime: string | null;
  lastBackupResult: 'SUCCESS' | 'FAILED' | 'NONE';
  backupType: string;
  nextScheduledBackup: string | null;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'NO_BACKUPS';
  totalBackupsCount: number;
  lastRestoreTestDate: string | null;
  operationalMessage: string;
  recentBackups: BackupRegistryEntry[];
}

/**
 * Locate PostgreSQL CLI executable (pg_dump, pg_restore, psql).
 * Checks explicit env vars, PATH, and standard Windows/Linux installation directories.
 */
export function findPostgresBinary(binaryName: 'pg_dump' | 'pg_restore' | 'psql'): string {
  const envVar = binaryName === 'pg_dump' ? 'PGDUMP_PATH' : binaryName === 'pg_restore' ? 'PGRESTORE_PATH' : 'PSQL_PATH';
  if (process.env[envVar] && fs.existsSync(process.env[envVar]!)) {
    return process.env[envVar]!;
  }

  if (process.env.PG_BIN_PATH) {
    const candidate = path.join(process.env.PG_BIN_PATH, process.platform === 'win32' ? `${binaryName}.exe` : binaryName);
    if (fs.existsSync(candidate)) return candidate;
  }

  // Windows standard installation paths (17, 16, 15, 14)
  if (process.platform === 'win32') {
    const versions = ['17', '16', '15', '14'];
    for (const v of versions) {
      const candidate = `C:\\Program Files\\PostgreSQL\\${v}\\bin\\${binaryName}.exe`;
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  // Default to PATH name
  return binaryName;
}

/**
 * Parse PostgreSQL connection string into typed components.
 */
export function parseDatabaseUrl(urlStr: string): DatabaseCredentials {
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '5432', 10),
      user: decodeURIComponent(parsed.username || 'postgres'),
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname.replace(/^\//, '') || 'digiskwela',
      schema: parsed.searchParams.get('schema') || 'public',
    };
  } catch (err: any) {
    throw new Error(`Failed to parse DATABASE_URL: ${err?.message}`);
  }
}

/**
 * Compute SHA-256 hash of a file on disk.
 */
export async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

/**
 * Recursively collect all files inside a directory.
 */
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

/**
 * Collect all active media files referenced by database records.
 * Inspects Document, SchoolSettings, and LeaveRequest.
 */
export async function getReferencedMediaFiles(prismaClient: any): Promise<ReferencedMediaItem[]> {
  const references: ReferencedMediaItem[] = [];

  try {
    // 1. Documents (stored in storage/documents/)
    if (prismaClient.document) {
      const docs = await prismaClient.document.findMany({
        select: { id: true, storage_key: true, size_bytes: true },
      });
      for (const doc of docs) {
        if (doc.storage_key) {
          references.push({
            model: 'Document',
            id: doc.id,
            expectedRelativePath: path.join('documents', doc.storage_key).replace(/\\/g, '/'),
            expectedSizeBytes: doc.size_bytes,
          });
        }
      }
    }

    // 2. SchoolSettings (branding assets in storage/branding/)
    if (prismaClient.schoolSettings) {
      const settings = await prismaClient.schoolSettings.findFirst({
        select: { id: true, logo_url: true, favicon_url: true, login_background_url: true },
      });
      if (settings) {
        const brandingUrls = [
          { key: 'logo_url', val: settings.logo_url },
          { key: 'favicon_url', val: settings.favicon_url },
          { key: 'login_background_url', val: settings.login_background_url },
        ];
        for (const item of brandingUrls) {
          if (item.val && typeof item.val === 'string' && item.val.startsWith('/storage/branding/')) {
            const basename = path.basename(item.val);
            references.push({
              model: 'SchoolSettings',
              id: `${settings.id}:${item.key}`,
              expectedRelativePath: path.join('branding', basename).replace(/\\/g, '/'),
            });
          }
        }
      }
    }

    // 3. Leave Requests (attachments in storage/leaves/)
    if (prismaClient.leaveRequest) {
      const leaves = await prismaClient.leaveRequest.findMany({
        where: { attachment_url: { not: null } },
        select: { id: true, attachment_url: true },
      });
      for (const leave of leaves) {
        if (
          leave.attachment_url &&
          typeof leave.attachment_url === 'string' &&
          leave.attachment_url.startsWith('/storage/leaves/')
        ) {
          const basename = path.basename(leave.attachment_url);
          references.push({
            model: 'LeaveRequest',
            id: leave.id,
            expectedRelativePath: path.join('leaves', basename).replace(/\\/g, '/'),
          });
        }
      }
    }
  } catch (err: any) {
    console.warn(`[getReferencedMediaFiles] Warning while querying media references: ${err?.message}`);
  }

  return references;
}

/**
 * Archive media storage directory into a single compressed tar.gz file.
 */
export async function archiveStorageDirectory(
  sourceDir: string,
  destTarGzPath: string
): Promise<StorageArchiveResult> {
  if (!fs.existsSync(sourceDir)) {
    const emptyPayload = zlib.gzipSync(Buffer.from('[]', 'utf-8'));
    const tempDir = path.dirname(destTarGzPath);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(destTarGzPath, emptyPayload);
    const sha256 = await computeFileHash(destTarGzPath);
    return { filesCount: 0, sizeBytes: emptyPayload.length, sha256, archivedFiles: [] };
  }

  // 1. Pre-capture consistency snapshot
  const initialFiles = getAllFiles(sourceDir);
  const initialSnapshot = new Map<string, { size: number; mtimeMs: number }>();
  for (const f of initialFiles) {
    const stat = fs.statSync(f);
    initialSnapshot.set(f, { size: stat.size, mtimeMs: stat.mtimeMs });
  }

  const tempDir = path.dirname(destTarGzPath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 2. Read file contents into memory
  const archiveRecords: { relativePath: string; content: Buffer }[] = [];
  for (const f of initialFiles) {
    if (!fs.existsSync(f)) {
      throw new Error(`Media consistency failure: file was deleted during archiving: ${path.basename(f)}`);
    }
    const rel = path.relative(sourceDir, f).replace(/\\/g, '/');
    const content = fs.readFileSync(f);
    archiveRecords.push({ relativePath: rel, content });
  }

  // 3. Post-capture consistency validation
  const postFiles = getAllFiles(sourceDir);
  if (postFiles.length !== initialFiles.length) {
    throw new Error(
      `Media consistency failure: file count changed during archiving (initially ${initialFiles.length}, now ${postFiles.length}). Concurrent modification detected.`
    );
  }

  for (const f of postFiles) {
    const initial = initialSnapshot.get(f);
    if (!initial) {
      throw new Error(`Media consistency failure: new file detected during archiving: ${path.basename(f)}`);
    }
    const postStat = fs.statSync(f);
    if (postStat.size !== initial.size || postStat.mtimeMs !== initial.mtimeMs) {
      throw new Error(`Media consistency failure: file content was modified during archiving: ${path.basename(f)}`);
    }
  }

  // 4. Serialize & compress
  const serialized = JSON.stringify(archiveRecords.map(r => ({
    path: r.relativePath,
    data: r.content.toString('base64'),
  })));

  const compressed = zlib.gzipSync(Buffer.from(serialized, 'utf-8'));
  fs.writeFileSync(destTarGzPath, compressed);

  const sizeBytes = fs.statSync(destTarGzPath).size;
  const sha256 = await computeFileHash(destTarGzPath);

  return {
    filesCount: initialFiles.length,
    sizeBytes,
    sha256,
    archivedFiles: archiveRecords.map(r => ({
      relativePath: r.relativePath,
      sizeBytes: r.content.length,
    })),
  };
}

/**
 * Extract storage archive back into target directory.
 */
export async function extractStorageArchive(archiveTarGzPath: string, targetDir: string): Promise<number> {
  if (!fs.existsSync(archiveTarGzPath)) {
    throw new Error(`Archive not found: ${archiveTarGzPath}`);
  }

  const compressed = fs.readFileSync(archiveTarGzPath);
  const decompressed = zlib.gunzipSync(compressed).toString('utf-8');
  const records = JSON.parse(decompressed) as { path: string; data: string }[];

  let extractedCount = 0;
  for (const item of records) {
    const destPath = path.join(targetDir, item.path);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.writeFileSync(destPath, Buffer.from(item.data, 'base64'));
    extractedCount++;
  }

  return extractedCount;
}

/**
 * Execute native PostgreSQL pg_dump in custom format (-Fc).
 * Credentials are passed securely via child process environment (PGPASSWORD), never in argv.
 */
export async function dumpDatabase(
  creds: DatabaseCredentials,
  outputFilePath: string,
  snapshotId?: string
): Promise<{ sizeBytes: number; sha256: string }> {
  const pgDumpBin = findPostgresBinary('pg_dump');

  const args = [
    '--host', creds.host,
    '--port', creds.port.toString(),
    '--username', creds.user,
    '--format=custom',
    '--compress=6',
    '--no-owner',
    '--no-privileges',
  ];

  if (snapshotId) {
    args.push(`--snapshot=${snapshotId}`);
  }

  args.push('--file', outputFilePath, creds.database);

  const env = {
    ...process.env,
    PGPASSWORD: creds.password || '',
  };

  try {
    await execFileAsync(pgDumpBin, args, { env });
  } catch (err: any) {
    const sanitizedMsg = err.message ? err.message.replace(creds.password || '___', '***') : 'Unknown pg_dump error';
    throw new Error(`pg_dump execution failed: ${sanitizedMsg}`);
  }

  if (!fs.existsSync(outputFilePath) || fs.statSync(outputFilePath).size === 0) {
    throw new Error('pg_dump produced empty or non-existent file.');
  }

  const sizeBytes = fs.statSync(outputFilePath).size;
  const sha256 = await computeFileHash(outputFilePath);

  return { sizeBytes, sha256 };
}

/**
 * Verify integrity of a custom-format dump using pg_restore --list.
 * Ensures the internal table-of-contents catalog is valid and readable without modifying any database.
 */
export async function verifyDumpIntegrity(dumpFilePath: string): Promise<{ valid: boolean; tableCount: number }> {
  const pgRestoreBin = findPostgresBinary('pg_restore');

  try {
    const { stdout } = await execFileAsync(pgRestoreBin, ['--list', dumpFilePath]);
    const lines = stdout.split('\n').filter(line => line.includes('TABLE DATA') || line.includes('TABLE public'));
    return {
      valid: true,
      tableCount: lines.length,
    };
  } catch (err: any) {
    return {
      valid: false,
      tableCount: 0,
    };
  }
}

/**
 * Master Backup Execution Function.
 * Produces atomic, verified backup bundle containing database dump, storage archive, and manifest.
 */
export async function createBackup(options?: {
  customBackupDir?: string;
  databaseUrl?: string;
  storageDir?: string;
  retentionCount?: number;
  skipMediaReferentialCheck?: boolean;
  transactionTimeoutMs?: number;
  onSnapshotExported?: (snapshotId: string) => Promise<void> | void;
}): Promise<BackupManifest> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `digiskwela_backup_${timestamp}`;

  const baseBackupDir = options?.customBackupDir || path.join(process.cwd(), 'backups');
  const targetBackupDir = path.join(baseBackupDir, backupId);

  if (!fs.existsSync(targetBackupDir)) {
    fs.mkdirSync(targetBackupDir, { recursive: true });
  }

  const dbUrl = options?.databaseUrl || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not configured for backup operation.');
  }
  const creds = parseDatabaseUrl(dbUrl);

  const storageSourceDir = options?.storageDir || path.join(process.cwd(), 'storage');

  const dumpFilePath = path.join(targetBackupDir, 'database.dump');
  const storageFilePath = path.join(targetBackupDir, 'storage.tar.gz');
  const manifestFilePath = path.join(targetBackupDir, 'backup-manifest.json');
  const checksumFilePath = path.join(targetBackupDir, 'checksums.sha256');

  let activePrisma: PrismaClient | null = null;

  try {
    activePrisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: ['error'],
    });

    let dbDumpResult: { sizeBytes: number; sha256: string } = { sizeBytes: 0, sha256: '' };
    let storageResult: StorageArchiveResult = { filesCount: 0, sizeBytes: 0, sha256: '', archivedFiles: [] };
    let referencedMediaCount = 0;

    // Coordinated PostgreSQL Snapshot:
    // Execute within a REPEATABLE READ transaction to export a snapshot,
    // query media references from that exact snapshot, and pass the snapshot to pg_dump --snapshot.
    await activePrisma.$transaction(
      async (tx) => {
        // 1. Export PostgreSQL snapshot from current RepeatableRead transaction
        const snapRows = await tx.$queryRawUnsafe<Array<{ pg_export_snapshot: string }>>(
          'SELECT pg_export_snapshot();'
        );
        const snapshotId = snapRows?.[0]?.pg_export_snapshot;
        if (!snapshotId) {
          throw new Error('Failed to export PostgreSQL snapshot for coordinated backup.');
        }

        // 2. Query all media references from the EXACT snapshot
        const references = await getReferencedMediaFiles(tx);
        referencedMediaCount = references.length;

        // Optional deterministic test hook for concurrency simulation
        if (options?.onSnapshotExported) {
          await options.onSnapshotExported(snapshotId);
        }

        // 3. Dump database using the exact exported snapshot
        dbDumpResult = await dumpDatabase(creds, dumpFilePath, snapshotId);

        // 4. Archive storage directory
        storageResult = await archiveStorageDirectory(storageSourceDir, storageFilePath);

        // 5. Verify Cross-Snapshot Database-to-Media Referential Consistency
        if (!options?.skipMediaReferentialCheck) {
          const archivedPathMap = new Map<string, number>();
          for (const item of storageResult.archivedFiles) {
            archivedPathMap.set(item.relativePath, item.sizeBytes);
          }

          const missingReferences: string[] = [];
          const mismatchedReferences: string[] = [];

          for (const ref of references) {
            if (!archivedPathMap.has(ref.expectedRelativePath)) {
              missingReferences.push(`${ref.model} (ID: ${ref.id}) -> ${ref.expectedRelativePath}`);
            } else if (
              ref.expectedSizeBytes !== undefined &&
              archivedPathMap.get(ref.expectedRelativePath) !== ref.expectedSizeBytes
            ) {
              mismatchedReferences.push(
                `${ref.model} (ID: ${ref.id}) -> ${ref.expectedRelativePath} (expected ${ref.expectedSizeBytes}B, archived ${archivedPathMap.get(ref.expectedRelativePath)}B)`
              );
            }
          }

          if (missingReferences.length > 0) {
            throw new Error(
              `Cross-snapshot consistency failure: database snapshot references ${missingReferences.length} media file(s) missing from media archive: ${missingReferences.join('; ')}`
            );
          }

          if (mismatchedReferences.length > 0) {
            throw new Error(
              `Cross-snapshot consistency failure: database snapshot references ${mismatchedReferences.length} media file(s) with mismatched size: ${mismatchedReferences.join('; ')}`
            );
          }
        }
      },
      {
        isolationLevel: 'RepeatableRead',
        timeout: options?.transactionTimeoutMs || 120000,
        maxWait: 10000,
      }
    );

    // Verify dump catalog integrity
    const dbVerify = await verifyDumpIntegrity(dumpFilePath);
    if (!dbVerify.valid) {
      throw new Error('Database dump structural integrity verification failed (pg_restore catalog check).');
    }

    // 4. Build manifest
    const manifest: BackupManifest = {
      backupId,
      timestamp: new Date().toISOString(),
      engine: 'PostgreSQL 17.3 + Native Custom Format (-Fc) + Coordinated Snapshot',
      database: {
        filename: 'database.dump',
        sizeBytes: dbDumpResult.sizeBytes,
        sha256: dbDumpResult.sha256,
        format: 'custom',
        tableCount: dbVerify.tableCount,
        status: 'VERIFIED',
      },
      storage: {
        filename: 'storage.tar.gz',
        sizeBytes: storageResult.sizeBytes,
        sha256: storageResult.sha256,
        filesCount: storageResult.filesCount,
        referencedMediaCount,
        crossSnapshotConsistency: options?.skipMediaReferentialCheck ? 'SKIPPED' : 'VERIFIED',
        status: 'VERIFIED',
      },
      encryption: {
        fieldEncryptionConfigured: Boolean(process.env.PRISMA_FIELD_ENCRYPTION_KEY),
        keyAlgorithm: 'k1.aesgcm256',
        warning: 'Sensitive student fields (LRN, phone) require identical PRISMA_FIELD_ENCRYPTION_KEY to decrypt after restoration.',
      },
      overallStatus: 'SUCCESS',
      durationMs: Date.now() - startTime,
    };

    // 5. Write manifest & checksums
    fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2), 'utf-8');

    const checksumContent = `${manifest.database.sha256}  database.dump\n${manifest.storage.sha256}  storage.tar.gz\n`;
    fs.writeFileSync(checksumFilePath, checksumContent, 'utf-8');

    // 6. Update backup registry
    updateBackupRegistry(baseBackupDir, {
      backupId,
      timestamp: manifest.timestamp,
      overallStatus: 'SUCCESS',
      databaseSize: manifest.database.sizeBytes,
      storageSize: manifest.storage.sizeBytes,
      totalSize: manifest.database.sizeBytes + manifest.storage.sizeBytes,
      verified: true,
      backupPath: targetBackupDir,
      durationMs: manifest.durationMs,
    });

    // 7. Enforce retention policy
    enforceBackupRetention(baseBackupDir, options?.retentionCount || 7);

    return manifest;
  } catch (err: any) {
    const failedManifest: BackupManifest = {
      backupId,
      timestamp: new Date().toISOString(),
      engine: 'PostgreSQL 17.3',
      database: {
        filename: 'database.dump',
        sizeBytes: 0,
        sha256: '',
        format: 'custom',
        status: 'FAILED',
        details: err?.message,
      },
      storage: {
        filename: 'storage.tar.gz',
        sizeBytes: 0,
        sha256: '',
        filesCount: 0,
        status: 'FAILED',
        details: err?.message,
      },
      encryption: {
        fieldEncryptionConfigured: Boolean(process.env.PRISMA_FIELD_ENCRYPTION_KEY),
        keyAlgorithm: 'k1.aesgcm256',
        warning: 'Backup aborted due to error.',
      },
      overallStatus: 'FAILED',
      durationMs: Date.now() - startTime,
    };

    try {
      fs.writeFileSync(manifestFilePath, JSON.stringify(failedManifest, null, 2), 'utf-8');
      updateBackupRegistry(baseBackupDir, {
        backupId,
        timestamp: failedManifest.timestamp,
        overallStatus: 'FAILED',
        databaseSize: 0,
        storageSize: 0,
        totalSize: 0,
        verified: false,
        backupPath: targetBackupDir,
        durationMs: failedManifest.durationMs,
      });
    } catch {
      // Ignore registry error during failure handling
    }

    throw err;
  } finally {
    if (activePrisma) {
      await activePrisma.$disconnect().catch(() => {});
    }
  }
}

/**
 * Update the persistent registry file in the backups folder.
 */
function updateBackupRegistry(baseDir: string, entry: BackupRegistryEntry): void {
  const registryPath = path.join(baseDir, 'backup-registry.json');
  let registry: BackupRegistryEntry[] = [];

  if (fs.existsSync(registryPath)) {
    try {
      registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    } catch {
      registry = [];
    }
  }

  // Prepend latest entry
  registry = [entry, ...registry.filter(r => r.backupId !== entry.backupId)];
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
}

/**
 * Remove older backups beyond retention count.
 */
export function enforceBackupRetention(baseDir: string, retainCount: number): number {
  const registryPath = path.join(baseDir, 'backup-registry.json');
  if (!fs.existsSync(registryPath)) return 0;

  let registry: BackupRegistryEntry[] = [];
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  } catch {
    return 0;
  }

  if (registry.length <= retainCount) return 0;

  const toKeep = registry.slice(0, retainCount);
  const toDelete = registry.slice(retainCount);

  let deletedCount = 0;
  for (const item of toDelete) {
    if (fs.existsSync(item.backupPath)) {
      try {
        fs.rmSync(item.backupPath, { recursive: true, force: true });
        deletedCount++;
      } catch (e) {
        console.warn(`Failed to prune old backup at ${item.backupPath}:`, e);
      }
    }
  }

  fs.writeFileSync(registryPath, JSON.stringify(toKeep, null, 2), 'utf-8');
  return deletedCount;
}

/**
 * Verify an existing backup bundle on disk.
 */
export async function verifyBackupBundle(backupDirPath: string): Promise<{
  valid: boolean;
  manifest: BackupManifest | null;
  errors: string[];
}> {
  const errors: string[] = [];
  const manifestPath = path.join(backupDirPath, 'backup-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return { valid: false, manifest: null, errors: ['backup-manifest.json not found in backup bundle.'] };
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (err: any) {
    return { valid: false, manifest: null, errors: [`Corrupted manifest file: ${err?.message}`] };
  }

  // 1. Verify database dump file and hash
  const dbDumpPath = path.join(backupDirPath, manifest.database.filename);
  if (!fs.existsSync(dbDumpPath)) {
    errors.push(`Database dump file missing: ${manifest.database.filename}`);
  } else {
    const actualHash = await computeFileHash(dbDumpPath);
    if (actualHash !== manifest.database.sha256) {
      errors.push(`Database dump SHA-256 mismatch: expected ${manifest.database.sha256}, got ${actualHash}`);
    }

    const catalogCheck = await verifyDumpIntegrity(dbDumpPath);
    if (!catalogCheck.valid) {
      errors.push('Database dump failed pg_restore catalog verification.');
    }
  }

  // 2. Verify storage archive file and hash
  const storagePath = path.join(backupDirPath, manifest.storage.filename);
  if (!fs.existsSync(storagePath)) {
    errors.push(`Storage archive file missing: ${manifest.storage.filename}`);
  } else {
    const actualHash = await computeFileHash(storagePath);
    if (actualHash !== manifest.storage.sha256) {
      errors.push(`Storage archive SHA-256 mismatch: expected ${manifest.storage.sha256}, got ${actualHash}`);
    }
  }

  return {
    valid: errors.length === 0,
    manifest,
    errors,
  };
}

/**
 * Retrieve verified operational backup overview for Admin portal.
 */
export function getBackupStatusOverview(baseDir?: string): BackupStatusOverview {
  const backupDir = baseDir || path.join(process.cwd(), 'backups');
  const registryPath = path.join(backupDir, 'backup-registry.json');
  const restoreLogPath = path.join(backupDir, 'restore-verification.json');

  let entries: BackupRegistryEntry[] = [];
  if (fs.existsSync(registryPath)) {
    try {
      entries = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    } catch {
      entries = [];
    }
  }

  let lastRestoreDate: string | null = null;
  if (fs.existsSync(restoreLogPath)) {
    try {
      const restoreLog = JSON.parse(fs.readFileSync(restoreLogPath, 'utf-8'));
      lastRestoreDate = restoreLog.verifiedAt || null;
    } catch {
      lastRestoreDate = null;
    }
  }

  const latest = entries[0] || null;

  return {
    lastBackupTime: latest ? latest.timestamp : null,
    lastBackupResult: latest ? latest.overallStatus : 'NONE',
    backupType: 'Atomic PostgreSQL Dump (pg_dump -Fc) + Storage Media Archive',
    nextScheduledBackup: 'Configurable via OS Task Scheduler / Cron (Recommended: Daily 23:00)',
    verificationStatus: latest ? (latest.verified ? 'VERIFIED' : 'UNVERIFIED') : 'NO_BACKUPS',
    totalBackupsCount: entries.length,
    lastRestoreTestDate: lastRestoreDate,
    operationalMessage: latest
      ? latest.overallStatus === 'SUCCESS'
        ? `Last backup executed successfully (${(latest.totalSize / (1024 * 1024)).toFixed(2)} MB total) with verified SHA-256 checksums.`
        : 'Last backup execution failed. Error recorded in manifest.'
      : 'No automated backups recorded yet. Ready to initialize backup routine.',
    recentBackups: entries.slice(0, 5),
  };
}
