/**
 * DIGISKWELA — AUTHENTIC CALULUT SF9 WORKBOOK-TO-PDF RENDERER
 *
 * Converts a populated Calulut Integrated School SF9 OpenXML workbook (.xlsx)
 * into a 1-page landscape PDF of worksheet 'SF9 - GRADE 4-10' using the
 * self-hosted headless LibreOffice Calc rendering engine.
 *
 * Security & Portability Guarantees:
 * 1. Zero persistent disk caching of generated PDFs or XLSX workbooks.
 * 2. Strict per-job isolation: each conversion executes in its own temporary
 *    directory with its own isolated LibreOffice UserInstallation profile.
 * 3. Cross-platform file URI construction via Node's standard pathToFileURL().
 * 4. Validated path containment before recursive cleanup to prevent traversal.
 * 5. Zero logging of learner names, LRNs, grades, or document contents.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import AdmZip from 'adm-zip';
import { AppError } from '../../common/middleware/errorHandler.js';
import { DEFAULT_MASTER_TEMPLATE_PATH } from './calulutSf9Generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawBackendRoot = path.resolve(__dirname, '../../../');
const BACKEND_ROOT =
  fs.existsSync(rawBackendRoot) && fs.realpathSync.native
    ? fs.realpathSync.native(rawBackendRoot)
    : rawBackendRoot;

export const EXPECTED_MASTER_TEMPLATE_SHA256 =
  'df7745d5758ff60a9260e53904f49f2259de25478ba453307ea4fb2f5ab29c78';

const SYNTHETIC_IDENTITY_MARKER = 'DELA CRUZ, JUAN SYNTHETIC';
const SYNTHETIC_LRN_MARKER = '999999260001';
const SYNTHETIC_MEMORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory TTL for synthetic fixture only
const MAX_CONCURRENT_RENDERS = 2;
const MAX_RENDER_QUEUE_DEPTH = 10;

export type Sf9RenderCachePolicy = 'no-store' | 'synthetic-memory-ttl';

export interface Sf9RenderOptions {
  /**
   * Cache policy:
   * - 'no-store' (default): Never caches in memory or on disk. Required for all real student reports.
   * - 'synthetic-memory-ttl': Allows short-lived in-memory caching strictly for the verified synthetic fixture.
   */
  cachePolicy?: Sf9RenderCachePolicy;
  /** Optional per-call conversion timeout override in milliseconds. */
  timeoutMs?: number;
  /** Optional custom LibreOffice binary path for testing failure/unavailable paths. */
  customSofficeBin?: string;
  /** Optional pipeline profiler for recording granular stage timings. */
  profiler?: any;
}

export function getSf9WarmedProfileDir(): string {
  return path.join(getSf9RenderTmpRoot(), 'warmed-profile');
}

interface SyntheticMemoryCacheEntry {
  hash: string;
  buffer: Buffer;
  expiresAt: number;
}

let syntheticMemoryCache: SyntheticMemoryCacheEntry | null = null;

interface RendererObservationState {
  lastVerifiedAt: string | null;
  lastStatus: 'VERIFIED' | 'FAILED' | 'NOT_RUN';
  lastLatencyMs: number | null;
}

const rendererObservation: RendererObservationState = {
  lastVerifiedAt: null,
  lastStatus: 'NOT_RUN',
  lastLatencyMs: null,
};

/**
 * Clear the in-memory synthetic preview cache (used by tests).
 */
export function clearSf9SyntheticMemoryCache(): void {
  syntheticMemoryCache = null;
}

/**
 * Resolve the configured temporary root directory for SF9 rendering jobs.
 */
export function getSf9RenderTmpRoot(): string {
  const configured = process.env.SF9_RENDER_TMP_DIR?.trim();
  if (configured) {
    const resolved = path.resolve(configured);
    return fs.existsSync(resolved) && fs.realpathSync.native
      ? fs.realpathSync.native(resolved)
      : resolved;
  }
  return path.join(BACKEND_ROOT, 'tmp', 'sf9-render');
}

/**
 * Resolve the isolated per-job working directory root.
 */
export function getSf9RenderJobsDir(): string {
  return path.join(getSf9RenderTmpRoot(), 'jobs');
}

/**
 * Resolve the configured conversion timeout in milliseconds.
 */
export function getSf9RenderTimeoutMs(overrideMs?: number): number {
  if (typeof overrideMs === 'number' && Number.isFinite(overrideMs) && overrideMs > 0) {
    return Math.min(Math.max(Math.floor(overrideMs), 50), 120000);
  }
  const envVal = parseInt(process.env.SF9_RENDER_TIMEOUT_MS || '90000', 10);
  if (Number.isFinite(envVal) && envVal >= 1000 && envVal <= 120000) {
    return envVal;
  }
  return 45000;
}

/**
 * Candidate LibreOffice executable locations across environment overrides,
 * project-local portable installations, Windows, and Linux.
 */
export function getCandidateLibreOfficePaths(): string[] {
  return [
    process.env.LIBREOFFICE_BIN?.trim(),
    path.join(BACKEND_ROOT, 'tools', 'libreoffice', 'program', 'soffice.bin'),
    path.join(BACKEND_ROOT, 'tools', 'libreoffice', 'program', 'soffice.exe'),
    'C:\\Program Files\\LibreOffice\\program\\soffice.bin',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
  ].filter((p): p is string => Boolean(p));
}

/**
 * Locate the installed, configured, or project-local headless LibreOffice binary.
 */
export function resolveLibreOfficeBinary(customBin?: string): string | null {
  if (customBin !== undefined) {
    const trimmed = customBin.trim();
    return trimmed && fs.existsSync(trimmed) ? trimmed : null;
  }
  const envBin = process.env.LIBREOFFICE_BIN?.trim();
  if (envBin) {
    // If LIBREOFFICE_BIN is explicitly configured, do not silently fall back if invalid
    return fs.existsSync(envBin) ? envBin : null;
  }
  for (const candidate of getCandidateLibreOfficePaths()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Convert an absolute filesystem path to a valid RFC 8089 file:// URI
 * using Node's standard pathToFileURL implementation.
 */
export function toFileUri(absPath: string): string {
  if (!absPath || typeof absPath !== 'string' || !absPath.trim()) {
    throw new AppError(400, 'INVALID_RENDER_PATH', 'A non-empty filesystem path is required for file URI conversion.');
  }
  return pathToFileURL(absPath).href;
}

/**
 * Validate that a job directory path is strictly a direct child of the isolated
 * SF9 render jobs root before allowing recursive deletion.
 */
export function assertSafeJobDirectoryPath(jobDir: string, jobsRoot: string = getSf9RenderJobsDir()): string {
  if (!jobDir || typeof jobDir !== 'string' || !jobsRoot || typeof jobsRoot !== 'string') {
    throw new AppError(400, 'UNSAFE_CLEANUP_PATH', 'Job directory and jobs root paths must be non-empty.');
  }

  const resolvedRoot = path.resolve(jobsRoot);
  const resolvedJob = path.resolve(jobDir);
  const relative = path.relative(resolvedRoot, resolvedJob);

  if (
    !relative ||
    relative === '.' ||
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative.split(path.sep).length !== 1 ||
    !/^sf9-job-[a-zA-Z0-9_-]+$/.test(relative)
  ) {
    throw new AppError(
      400,
      'UNSAFE_CLEANUP_PATH',
      'Refused to remove directory outside the isolated SF9 render jobs root.'
    );
  }

  return resolvedJob;
}

/**
 * Safely remove an isolated SF9 conversion job directory after validating containment.
 * Includes brief retry handling for Windows file handle release after process termination.
 */
export async function cleanupJobDirectory(
  jobDir: string,
  jobsRoot: string = getSf9RenderJobsDir()
): Promise<void> {
  const validatedPath = assertSafeJobDirectoryPath(jobDir, jobsRoot);

  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      if (fs.existsSync(validatedPath)) {
        fs.rmSync(validatedPath, { recursive: true, force: true });
      }
      if (!fs.existsSync(validatedPath)) {
        return;
      }
    } catch {
      // Wait for OS file handles to release after process exit/termination
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

/**
 * Prepare an isolated render-only copy of a populated Calulut SF9 workbook where
 * only the 'SF9 - GRADE 4-10' worksheet is visible for PDF export while all
 * backing summary sheets remain present in the workbook for formula evaluation.
 */
export function prepareSingleSheetSf9Workbook(xlsxBuffer: Buffer): Buffer {
  const zip = new AdmZip(xlsxBuffer);
  let wbXml = zip.readAsText('xl/workbook.xml');

  wbXml = wbXml.replace(/<sheet\s+([^>]*?)\/>/g, (_full, attrs: string) => {
    if (/name="SF9 - GRADE 4-10"/.test(attrs)) {
      return `<sheet ${attrs.replace(/\s*state="[^"]*"/g, '')}/>`;
    }
    if (/state="/.test(attrs)) {
      return `<sheet ${attrs.replace(/state="[^"]*"/, 'state="hidden"')}/>`;
    }
    return `<sheet ${attrs} state="hidden"/>`;
  });

  if (/<calcPr[^>]*\/>/.test(wbXml)) {
    wbXml = wbXml.replace(/<calcPr([^>]*?)\/>/, (_m, attrs: string) => {
      const clean = attrs.replace(/\s*fullCalcOnLoad="[^"]*"/g, '');
      return `<calcPr${clean} fullCalcOnLoad="1"/>`;
    });
  }

  zip.updateFile('xl/workbook.xml', Buffer.from(wbXml, 'utf8'));
  return zip.toBuffer();
}

/**
 * Verify that a workbook buffer strictly represents the canonical synthetic verification
 * baseline before allowing it to enter the short-lived synthetic memory cache.
 */
function isVerifiedSyntheticWorkbook(xlsxBuffer: Buffer): boolean {
  try {
    const zip = new AdmZip(xlsxBuffer);
    const sstXml = zip.readAsText('xl/sharedStrings.xml');
    const s2Xml = zip.readAsText('xl/worksheets/sheet2.xml');
    return (
      sstXml.includes(SYNTHETIC_IDENTITY_MARKER) &&
      s2Xml.includes(SYNTHETIC_LRN_MARKER)
    );
  } catch {
    return false;
  }
}

// Bounded concurrency semaphore for isolated LibreOffice worker processes
let activeRenders = 0;
const waitingQueue: Array<() => void> = [];

async function withBoundedRenderSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    if (waitingQueue.length >= MAX_RENDER_QUEUE_DEPTH) {
      throw new AppError(
        429,
        'RENDER_QUEUE_FULL',
        'SF9 PDF rendering service is currently at capacity. Please retry shortly.'
      );
    }
    await new Promise<void>((resolve) => {
      waitingQueue.push(resolve);
    });
  }

  activeRenders++;
  try {
    return await fn();
  } finally {
    activeRenders--;
    const next = waitingQueue.shift();
    if (next) {
      next();
    }
  }
}

/**
 * Convert a populated Calulut SF9 .xlsx buffer into a 1-page landscape PDF buffer
 * rendered directly from the 'SF9 - GRADE 4-10' worksheet by headless LibreOffice Calc.
 *
 * Persistent disk caching is strictly disabled for all calls.
 */
export async function renderCalulutSf9BufferToPdf(
  xlsxBuffer: Buffer,
  options: Sf9RenderOptions = {}
): Promise<Buffer> {
  const cachePolicy: Sf9RenderCachePolicy = options.cachePolicy ?? 'no-store';
  const sofficeBin = resolveLibreOfficeBinary(options.customSofficeBin);

  if (!sofficeBin) {
    throw new AppError(
      503,
      'RENDERER_UNAVAILABLE',
      'Headless LibreOffice Calc binary not found. Cannot render Calulut SF9 workbook to PDF.'
    );
  }

  const renderReadyXlsx = prepareSingleSheetSf9Workbook(xlsxBuffer);
  const canUseSyntheticMemoryCache =
    cachePolicy === 'synthetic-memory-ttl' && isVerifiedSyntheticWorkbook(renderReadyXlsx);

  let contentHash = '';
  if (canUseSyntheticMemoryCache) {
    contentHash = crypto.createHash('sha256').update(renderReadyXlsx).digest('hex');
    if (
      syntheticMemoryCache &&
      syntheticMemoryCache.hash === contentHash &&
      syntheticMemoryCache.expiresAt > Date.now() &&
      syntheticMemoryCache.buffer.length > 1000
    ) {
      return Buffer.from(syntheticMemoryCache.buffer);
    }
  }

  return withBoundedRenderSlot(async () => {
    if (
      canUseSyntheticMemoryCache &&
      syntheticMemoryCache &&
      syntheticMemoryCache.hash === contentHash &&
      syntheticMemoryCache.expiresAt > Date.now() &&
      syntheticMemoryCache.buffer.length > 1000
    ) {
      return Buffer.from(syntheticMemoryCache.buffer);
    }

    const jobsRoot = getSf9RenderJobsDir();
    fs.mkdirSync(jobsRoot, { recursive: true, mode: 0o700 });

    // Clean up any stale orphaned job directories older than 2x timeout
    if (activeRenders === 1) {
      const staleCutoffMs = Date.now() - getSf9RenderTimeoutMs() * 2;
      try {
        for (const entry of fs.readdirSync(jobsRoot)) {
          const tsMatch = /^sf9-job-(\d+)-[a-zA-Z0-9_-]+$/.exec(entry);
          if (tsMatch && Number(tsMatch[1]) < staleCutoffMs) {
            await cleanupJobDirectory(path.join(jobsRoot, entry), jobsRoot);
          }
        }
      } catch {
        // Ignore non-fatal stale cleanup errors
      }
    }

    const jobId = `sf9-job-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const rawJobDir = assertSafeJobDirectoryPath(path.join(jobsRoot, jobId), jobsRoot);
    fs.mkdirSync(rawJobDir, { recursive: true, mode: 0o700 });

    const jobDir =
      fs.existsSync(rawJobDir) && fs.realpathSync.native
        ? fs.realpathSync.native(rawJobDir)
        : rawJobDir;
    const rawProfileDir = path.join(jobDir, 'profile');
    const warmedDir = getSf9WarmedProfileDir();
    if (fs.existsSync(warmedDir) && fs.existsSync(path.join(warmedDir, 'user'))) {
      try {
        fs.cpSync(warmedDir, rawProfileDir, { recursive: true });
      } catch {
        fs.mkdirSync(rawProfileDir, { recursive: true, mode: 0o700 });
      }
    } else {
      fs.mkdirSync(rawProfileDir, { recursive: true, mode: 0o700 });
    }
    const jobProfileDir =
      fs.existsSync(rawProfileDir) && fs.realpathSync.native
        ? fs.realpathSync.native(rawProfileDir)
        : rawProfileDir;

    const inputXlsxPath = path.join(jobDir, 'sf9_working_copy.xlsx');
    const outputPdfPath = path.join(jobDir, 'sf9_working_copy.pdf');
    fs.writeFileSync(inputXlsxPath, renderReadyXlsx, { mode: 0o600 });

    const profileUri = toFileUri(jobProfileDir);
    const timeoutMs = getSf9RenderTimeoutMs(options.timeoutMs);
    const startMs = Date.now();

    const killProcessTreeOnWindows = (pid?: number): Promise<void> => {
      if (process.platform !== 'win32' || !pid) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        execFile(
          'taskkill',
          ['/F', '/T', '/PID', String(pid)],
          { timeout: 3000, windowsHide: true },
          () => resolve()
        );
      });
    };

    const invokeSofficeOnce = (remainingTimeoutMs: number): Promise<{ restarted: boolean }> =>
      new Promise((resolve, reject) => {
        const child = execFile(
          sofficeBin,
          [
            '--headless',
            '--norestore',
            '--nologo',
            '--nolockcheck',
            `-env:UserInstallation=${profileUri}`,
            '--convert-to',
            'pdf',
            '--outdir',
            jobDir,
            inputXlsxPath,
          ],
          { timeout: Math.max(50, remainingTimeoutMs), windowsHide: true },
          (err: any) => {
            if (err) {
              // Exit code 81 (EXITHELPER_NORMAL_RESTART) occurs when LibreOffice initializes
              // a brand-new isolated UserInstallation profile for the first time.
              if (err.code === 81 && !err.killed) {
                resolve({ restarted: true });
                return;
              }

              const isTimeout =
                Boolean(err.killed) ||
                err.signal === 'SIGTERM' ||
                err.code === 'ETIMEDOUT' ||
                /timed out/i.test(String(err.message || ''));

              rendererObservation.lastStatus = 'FAILED';
              rendererObservation.lastVerifiedAt = new Date().toISOString();
              rendererObservation.lastLatencyMs = Date.now() - startMs;

              killProcessTreeOnWindows(child.pid).finally(() => {
                if (isTimeout) {
                  reject(
                    new AppError(
                      504,
                      'SF9_PDF_RENDER_TIMEOUT',
                      `LibreOffice Calc timed out after ${timeoutMs}ms while rendering SF9 workbook.`
                    )
                  );
                  return;
                }

                reject(
                  new AppError(
                    500,
                    'SF9_PDF_RENDER_FAILED',
                    'LibreOffice Calc failed to render the SF9 workbook to PDF.'
                  )
                );
              });
              return;
            }
            resolve({ restarted: false });
          }
        );
      });

    try {
      const firstRun = await invokeSofficeOnce(timeoutMs);
      if (firstRun.restarted || !fs.existsSync(outputPdfPath)) {
        const elapsed = Date.now() - startMs;
        if (elapsed >= timeoutMs) {
          throw new AppError(
            504,
            'SF9_PDF_RENDER_TIMEOUT',
            `LibreOffice Calc timed out after ${timeoutMs}ms while rendering SF9 workbook.`
          );
        }
        await invokeSofficeOnce(timeoutMs - elapsed);
      }

      if (!fs.existsSync(outputPdfPath)) {
        rendererObservation.lastStatus = 'FAILED';
        rendererObservation.lastVerifiedAt = new Date().toISOString();
        rendererObservation.lastLatencyMs = Date.now() - startMs;

        throw new AppError(
          500,
          'SF9_PDF_OUTPUT_MISSING',
          'LibreOffice completed without producing the rendered SF9 PDF.'
        );
      }

      const pdfBuffer = fs.readFileSync(outputPdfPath);

      if (pdfBuffer.length < 100 || pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        rendererObservation.lastStatus = 'FAILED';
        rendererObservation.lastVerifiedAt = new Date().toISOString();
        rendererObservation.lastLatencyMs = Date.now() - startMs;

        throw new AppError(
          500,
          'SF9_PDF_INVALID_SIGNATURE',
          'Rendered output did not contain a valid PDF header.'
        );
      }

      rendererObservation.lastStatus = 'VERIFIED';
      rendererObservation.lastVerifiedAt = new Date().toISOString();
      rendererObservation.lastLatencyMs = Date.now() - startMs;

      // Seed warmed-profile cache so subsequent renders do not restart with exit code 81
      try {
        const warmedDir = getSf9WarmedProfileDir();
        if (!fs.existsSync(path.join(warmedDir, 'user')) && fs.existsSync(path.join(jobProfileDir, 'user'))) {
          fs.mkdirSync(warmedDir, { recursive: true, mode: 0o700 });
          fs.cpSync(jobProfileDir, warmedDir, { recursive: true });
        }
      } catch {}

      if (canUseSyntheticMemoryCache && contentHash) {
        syntheticMemoryCache = {
          hash: contentHash,
          buffer: Buffer.from(pdfBuffer),
          expiresAt: Date.now() + SYNTHETIC_MEMORY_CACHE_TTL_MS,
        };
      }

      return pdfBuffer;
    } finally {
      await cleanupJobDirectory(jobDir, jobsRoot);
    }
  });
}

export interface Sf9RendererHealthStatus {
  status: 'OPERATIONAL' | 'DEGRADED' | 'UNAVAILABLE';
  message: string;
  templateAvailable: boolean;
  templateIntegrityValid: boolean;
  executableAvailable: boolean;
  lastVerifiedAt: string | null;
  lastConversionStatus: 'VERIFIED' | 'FAILED' | 'NOT_RUN';
  latencyMs?: number;
}

/**
 * Read-only, non-invasive health check for the Calulut SF9 renderer.
 * Verifies executable availability, sanitized master template presence,
 * canonical SHA-256 and print-area integrity, and last conversion observation
 * without spawning an expensive conversion on every health-check poll.
 */
export function checkSf9RendererHealth(): Sf9RendererHealthStatus {
  const start = Date.now();
  const executablePath = resolveLibreOfficeBinary();
  const executableAvailable = Boolean(executablePath);

  let templateAvailable = false;
  let templateIntegrityValid = false;

  try {
    if (fs.existsSync(DEFAULT_MASTER_TEMPLATE_PATH)) {
      fs.accessSync(DEFAULT_MASTER_TEMPLATE_PATH, fs.constants.R_OK);
      templateAvailable = true;

      const templateBytes = fs.readFileSync(DEFAULT_MASTER_TEMPLATE_PATH);
      const actualHash = crypto.createHash('sha256').update(templateBytes).digest('hex');
      if (actualHash === EXPECTED_MASTER_TEMPLATE_SHA256) {
        const zip = new AdmZip(templateBytes);
        const wbXml = zip.readAsText('xl/workbook.xml');
        if (
          wbXml.includes('name="SF9 - GRADE 4-10"') &&
          wbXml.includes("'SF9 - GRADE 4-10'!$A$1:$AD$52")
        ) {
          templateIntegrityValid = true;
        }
      }
    }
  } catch {
    templateAvailable = false;
    templateIntegrityValid = false;
  }

  const checkLatencyMs = Date.now() - start;

  if (!templateAvailable) {
    return {
      status: 'UNAVAILABLE',
      message: 'Sanitized Calulut SF9 master workbook is missing or unreadable.',
      templateAvailable,
      templateIntegrityValid,
      executableAvailable,
      lastVerifiedAt: rendererObservation.lastVerifiedAt,
      lastConversionStatus: rendererObservation.lastStatus,
      latencyMs: checkLatencyMs,
    };
  }

  if (!templateIntegrityValid) {
    return {
      status: 'UNAVAILABLE',
      message: 'Sanitized Calulut SF9 master workbook failed SHA-256 or print-area integrity check.',
      templateAvailable,
      templateIntegrityValid,
      executableAvailable,
      lastVerifiedAt: rendererObservation.lastVerifiedAt,
      lastConversionStatus: rendererObservation.lastStatus,
      latencyMs: checkLatencyMs,
    };
  }

  if (!executableAvailable) {
    return {
      status: 'UNAVAILABLE',
      message: 'Headless LibreOffice Calc executable is not installed or configured.',
      templateAvailable,
      templateIntegrityValid,
      executableAvailable,
      lastVerifiedAt: rendererObservation.lastVerifiedAt,
      lastConversionStatus: rendererObservation.lastStatus,
      latencyMs: checkLatencyMs,
    };
  }

  if (rendererObservation.lastStatus === 'FAILED') {
    return {
      status: 'DEGRADED',
      message: 'Calulut SF9 template and LibreOffice binary are present, but the most recent conversion failed.',
      templateAvailable,
      templateIntegrityValid,
      executableAvailable,
      lastVerifiedAt: rendererObservation.lastVerifiedAt,
      lastConversionStatus: rendererObservation.lastStatus,
      latencyMs: rendererObservation.lastLatencyMs ?? checkLatencyMs,
    };
  }

  return {
    status: 'OPERATIONAL',
    message:
      rendererObservation.lastStatus === 'VERIFIED'
        ? 'Calulut SF9 master workbook integrity and headless LibreOffice PDF renderer verified.'
        : 'Calulut SF9 master workbook integrity and headless LibreOffice binary ready.',
    templateAvailable,
    templateIntegrityValid,
    executableAvailable,
    lastVerifiedAt: rendererObservation.lastVerifiedAt,
    lastConversionStatus: rendererObservation.lastStatus,
    latencyMs: rendererObservation.lastLatencyMs ?? checkLatencyMs,
  };
}
