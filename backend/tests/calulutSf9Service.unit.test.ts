import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { Duplex } from 'stream';
import AdmZip from 'adm-zip';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { config } from '../src/config/env.js';
import {
  DEFAULT_MASTER_TEMPLATE_PATH,
  EXPECTED_MASTER_TEMPLATE_SHA256,
  generateSyntheticSf9Preview,
  generateSyntheticSf9PdfPreview,
  generateStudentCalulutSf9,
  generateStudentCalulutSf9Pdf,
  validateSf9InputCompleteness,
  generateCalulutSf9,
  getSyntheticSf9Data,
  prepareSingleSheetSf9Workbook,
  resolveLibreOfficeBinary,
  renderCalulutSf9BufferToPdf,
  toFileUri,
  assertSafeJobDirectoryPath,
  cleanupJobDirectory,
  clearSf9SyntheticMemoryCache,
  getSf9RenderJobsDir,
  getSf9RenderTmpRoot,
  checkSf9RendererHealth,
  assertAuthorizedSf9Staff,
  type GenerateSf9Input,
} from '../src/academic/grading/index.js';

function makeAuthCookie(payload: { id: string; schoolId: string; roles: string[] }): string {
  const token = jwt.sign({ userId: payload.id }, config.jwt.secret, { expiresIn: '1h' });
  return `auth_token=${token}`;
}

function mockAuthenticatedUser(payload: { id: string; schoolId: string; roles: string[] }) {
  vi.spyOn(prisma.user, 'findUnique').mockImplementation((async (args: any) => {
    if (args?.where?.id === payload.id) {
      return {
        id: payload.id,
        school_id: payload.schoolId,
        email: `${payload.id}@calulut.edu.ph`,
        first_name: 'Test',
        last_name: 'User',
        status: 'active',
        must_change_password: false,
        user_roles: payload.roles.map((r) => ({
          role: {
            name: r,
            role_permissions: [],
          },
        })),
      };
    }
    return null;
  }) as any);
}

/**
 * Dispatch an HTTP GET request through the Express app in memory without binding
 * a loopback TCP socket (compatible with strict sandbox execution).
 */
function dispatchAppGet(
  urlPath: string,
  cookie?: string
): Promise<{ status: number; headers: Record<string, string>; body: any }> {
  return new Promise((resolve, reject) => {
    const socket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    (socket as any).remoteAddress = '127.0.0.1';

    const req = new http.IncomingMessage(socket as any);
    req.method = 'GET';
    req.url = urlPath;
    req.headers = {
      host: 'localhost',
      ...(cookie ? { cookie } : {}),
    };

    const res = new http.ServerResponse(req);
    res.assignSocket(socket as any);

    const chunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: any, encoding?: any, cb?: any) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding));
      }
      return origWrite(chunk, encoding, cb);
    }) as any;

    res.end = ((chunk?: any, encoding?: any, cb?: any) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding));
      }
      origEnd(chunk, encoding, cb);

      const rawBuffer = Buffer.concat(chunks);
      const rawHeaders = res.getHeaders();
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawHeaders)) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      }

      let body: any = rawBuffer;
      const contentType = headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          body = JSON.parse(rawBuffer.toString('utf8'));
        } catch {
          body = rawBuffer.toString('utf8');
        }
      }

      resolve({
        status: res.statusCode,
        headers,
        body,
      });
      return res;
    }) as any;

    try {
      (app as any).handle(req, res, (err: any) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

const SYNTHETIC_STUDENT_ALT: GenerateSf9Input = {
  demographics: {
    name: 'REYES, MARIA SYNTHETIC',
    lrn: '999999260002',
    birthdateSerial: '41409',
    age: 13,
    gender: 'F',
    gradeLevel: 7,
    section: 'Agoncillo',
    schoolYear: '2026-2027',
    schoolName: 'Calulut Integrated School',
    schoolId: '500146',
    schoolHead: 'APRIL G. CONCEPCION',
    adviser: 'KATHRINA MAE H. OMLANG',
  },
  grades: {
    filipino: [86, 88, 90],
    english: [84, 86, 88],
    math: [90, 92, 94],
    science: [88, 90, 92],
    ap: [85, 87, 89],
    gmrc: [91, 93, 95],
    tle: [86, 88, 90],
    music: [89, 91, 93],
    pe: [87, 89, 91],
  },
  attendance: {
    present: [15, 22, 20, 20, 20, 20, 20, 18, 18, 20, 5],
    classDays: [15, 22, 20, 20, 20, 20, 20, 18, 18, 20, 5],
  },
  comments: {
    t1: 'Synthetic verification remark T1.',
    t2: 'Synthetic verification remark T2.',
    t3: 'Synthetic verification remark T3.',
  },
};

describe('Calulut SF9 Phase B.2 Service, Renderer Hardening & Security Suite', () => {
  beforeEach(() => {
    clearSf9SyntheticMemoryCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. Synthetic Verification Preview & Template Integrity ───────────────
  describe('1. Synthetic Verification Preview & Template Integrity', () => {
    it('verifies canonical Calulut master template SHA-256 and print area ($A$1:$AD$52)', () => {
      const templateBytes = fs.readFileSync(DEFAULT_MASTER_TEMPLATE_PATH);
      const actualHash = crypto.createHash('sha256').update(templateBytes).digest('hex');
      expect(actualHash).toBe(EXPECTED_MASTER_TEMPLATE_SHA256);

      const { buffer } = generateSyntheticSf9Preview();
      const renderBuffer = prepareSingleSheetSf9Workbook(buffer);
      const zip = new AdmZip(renderBuffer);
      const wbXml = zip.readAsText('xl/workbook.xml');

      expect(wbXml).toContain("'SF9 - GRADE 4-10'!$A$1:$AD$52");
      expect(wbXml).toContain('fullCalcOnLoad="1"');
      expect(wbXml).toMatch(/<sheet[^>]*name="SF9 - GRADE 4-10"(?![^>]*state="hidden")[^>]*\/>/);
      expect(wbXml).toMatch(/<sheet[^>]*name="INPUT DATA"[^>]*state="hidden"[^>]*\/>/);
      expect(wbXml).toMatch(/<sheet[^>]*name="TERM 1 SUMMARY"[^>]*state="hidden"[^>]*\/>/);
      expect(wbXml).toMatch(/<sheet[^>]*name="TERM 2 SUMMARY"[^>]*state="hidden"[^>]*\/>/);
      expect(wbXml).toMatch(/<sheet[^>]*name="TERM 3 SUMMARY"[^>]*state="hidden"[^>]*\/>/);
      expect(wbXml).toMatch(/<sheet[^>]*name="ATTENDANCE RECORD SUMMARY"[^>]*state="hidden"[^>]*\/>/);
      expect(wbXml).toMatch(/<sheet[^>]*name="TEACHERS COMMENTS"[^>]*state="hidden"[^>]*\/>/);
    });

    it('produces an authentic Calulut SF9 Excel workbook without database dependencies', () => {
      const { buffer, filename } = generateSyntheticSf9Preview();

      expect(filename).toBe('SF9_Calulut_7-Agoncillo_Synthetic_Verification.xlsx');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(300000);

      const zip = new AdmZip(buffer);
      const s6Xml = zip.readAsText('xl/worksheets/sheet6.xml');
      expect(s6Xml).toMatch(/<c r="I42"[^>]*><f[^>]*>[^<]+<\/f><v>90<\/v><\/c>/);
      expect(s6Xml).toMatch(/<c r="J42"[^>]*><f[^>]*>[^<]+<\/f><v>Passed<\/v><\/c>/);

      const sstXml = zip.readAsText('xl/sharedStrings.xml');
      expect(sstXml).toContain('DELA CRUZ, JUAN SYNTHETIC');
    });

    it('returns structured synthetic SF9 data for the in-app document viewer', () => {
      const data = getSyntheticSf9Data();
      expect(data.success).toBe(true);
      expect(data.payload.demographics.name).toBe('DELA CRUZ, JUAN SYNTHETIC');
      expect(data.payload.demographics.schoolName).toBe('Calulut Integrated School');
      expect(data.calculated?.generalAverage).toBe(90);
      expect(data.calculated?.generalRemarks).toBe('Passed');
      expect(data.source.worksheet).toBe('SF9 - GRADE 4-10');
      expect(data.source.rendererStatus).toBe('VERIFIED_LIBREOFFICE_PDF');
      expect(data.source.pdfEndpoint).toBe('/academic/report-card/sf9/preview/pdf');
    });
  });

  // ─── 2. Cross-Platform File URI Handling ──────────────────────────────────
  describe('2. Cross-Platform File URI Conversion (pathToFileURL)', () => {
    it('handles spaces, Unicode characters, Windows drive letters, Linux paths, and separators without quadruple slashes', () => {
      // 1. Path with spaces and Windows drive letter
      const winSpaceUri = toFileUri('C:\\Users\\Admin\\Documents\\Capstone Project\\profile');
      expect(winSpaceUri).toMatch(/^file:\/\/\/[A-Za-z]:\/Users\/Admin\/Documents\/Capstone%20Project\/profile$/);
      expect(winSpaceUri).not.toContain('file:////');

      // 2. Path with Unicode characters (Ñ, é)
      const unicodeUri = toFileUri('C:\\Users\\Admin\\Calulut_Ñ_é_2026\\profile');
      expect(unicodeUri).toContain('Calulut_%C3%91_%C3%A9_2026/profile');
      expect(unicodeUri).toMatch(/^file:\/\/\/[^/]/);

      // 3. Linux-style absolute path (no quadruple-slash file://// defect)
      const posixStyleUri = toFileUri('/var/data/digiskwela/sf9 render/profile');
      expect(posixStyleUri.startsWith('file:///')).toBe(true);
      expect(posixStyleUri.startsWith('file:////')).toBe(false);
      expect(posixStyleUri).toContain('/var/data/digiskwela/sf9%20render/profile');

      // 4. Rejects empty path
      expect(() => toFileUri('')).toThrow();
    });
  });

  // ─── 3. Headless LibreOffice Renderer, Job Isolation & Zero Persistent Caching ───
  describe('3. Renderer Execution, Job Isolation, Cleanup & Confidentiality', () => {
    beforeEach(() => {
      const jobsDir = getSf9RenderJobsDir();
      if (fs.existsSync(jobsDir)) {
        for (const item of fs.readdirSync(jobsDir)) {
          try {
            fs.rmSync(path.join(jobsDir, item), { recursive: true, force: true });
          } catch {}
        }
      }
    });
    it('renders the synthetic workbook into a valid PDF (%PDF- signature) and leaves zero job files on disk', async () => {
      const jobsDir = getSf9RenderJobsDir();
      const { buffer, filename } = await generateSyntheticSf9PdfPreview({
        id: 'teacher-1',
        schoolId: 'EMP-T-001',
        roles: ['Teacher'],
      });

      expect(filename).toBe('SF9_Calulut_7-Agoncillo_Synthetic_Verification.pdf');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(50000);
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

      // Verify zero job directories remain after conversion completes
      if (fs.existsSync(jobsDir)) {
        await new Promise((r) => setTimeout(r, 500));
        const remainingJobs = fs.readdirSync(jobsDir);
        expect(remainingJobs.length).toBe(0);
      }
    });

    it('never writes non-synthetic/student PDFs to disk cache and cleans up job directory immediately', async () => {
      const cacheDir = path.join(getSf9RenderTmpRoot(), 'cache');
      const filesBefore = fs.existsSync(cacheDir) ? new Set(fs.readdirSync(cacheDir)) : new Set<string>();

      const genResult = generateCalulutSf9(SYNTHETIC_STUDENT_ALT);
      expect(genResult.success).toBe(true);
      if (!genResult.success) return;

      // Render with default cachePolicy ('no-store') and even attempt 'synthetic-memory-ttl' on non-canonical record
      const pdfBuffer = await renderCalulutSf9BufferToPdf(genResult.buffer, {
        cachePolicy: 'no-store',
      });
      expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

      const filesAfter = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : [];
      const newlyCachedFiles = filesAfter.filter((f) => !filesBefore.has(f));
      expect(newlyCachedFiles).toEqual([]);

      const jobsDir = getSf9RenderJobsDir();
      await new Promise((r) => setTimeout(r, 500));
      expect(fs.existsSync(jobsDir) ? fs.readdirSync(jobsDir) : []).toEqual([]);
    });

    it('executes two simultaneous conversions in isolated per-job profiles without state collision or leftover files', async () => {
      const { buffer: synthBufA } = generateSyntheticSf9Preview();
      const resB = generateCalulutSf9(SYNTHETIC_STUDENT_ALT);
      expect(resB.success).toBe(true);
      if (!resB.success) return;

      const [pdfA, pdfB] = await Promise.all([
        renderCalulutSf9BufferToPdf(synthBufA, { cachePolicy: 'no-store' }),
        renderCalulutSf9BufferToPdf(resB.buffer, { cachePolicy: 'no-store' }),
      ]);

      expect(pdfA.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(pdfB.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(pdfA.length).toBeGreaterThan(50000);
      expect(pdfB.length).toBeGreaterThan(50000);

      const jobsDir = getSf9RenderJobsDir();
      await new Promise((r) => setTimeout(r, 500));
      expect(fs.existsSync(jobsDir) ? fs.readdirSync(jobsDir) : []).toEqual([]);
    });

    it('handles unavailable renderer binary cleanly (503 RENDERER_UNAVAILABLE) and cleans up on timeout', async () => {
      const { buffer } = generateSyntheticSf9Preview();

      await expect(
        renderCalulutSf9BufferToPdf(buffer, {
          customSofficeBin: 'C:\\nonexistent\\path\\soffice.bin',
        })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'RENDERER_UNAVAILABLE',
      });

      // Timeout test (50ms timeout forces termination and cleanup)
      await expect(
        renderCalulutSf9BufferToPdf(buffer, {
          cachePolicy: 'no-store',
          timeoutMs: 50,
        })
      ).rejects.toMatchObject({
        code: expect.stringMatching(/SF9_PDF_RENDER_TIMEOUT|SF9_PDF_RENDER_FAILED/),
      });

      const jobsDir = getSf9RenderJobsDir();
      await new Promise((r) => setTimeout(r, 500));
      expect(fs.existsSync(jobsDir) ? fs.readdirSync(jobsDir) : []).toEqual([]);
    });

    it('prevents path traversal in temporary job cleanup (assertSafeJobDirectoryPath)', async () => {
      const jobsRoot = getSf9RenderJobsDir();

      // Valid direct child job folder passes
      const validJobPath = path.join(jobsRoot, 'sf9-job-1700000000-deadbeef');
      expect(assertSafeJobDirectoryPath(validJobPath, jobsRoot)).toBe(path.resolve(validJobPath));

      // Traversal, parent root, sibling folder, or invalid folder name must be rejected
      expect(() => assertSafeJobDirectoryPath(jobsRoot, jobsRoot)).toThrow(/UNSAFE_CLEANUP_PATH|outside/i);
      expect(() => assertSafeJobDirectoryPath(path.join(jobsRoot, '..'), jobsRoot)).toThrow();
      expect(() => assertSafeJobDirectoryPath(path.join(jobsRoot, '../cache'), jobsRoot)).toThrow();
      expect(() => assertSafeJobDirectoryPath(path.join(jobsRoot, '../profile'), jobsRoot)).toThrow();
      expect(() => assertSafeJobDirectoryPath(path.join(jobsRoot, 'arbitrary-folder'), jobsRoot)).toThrow();
      expect(() => assertSafeJobDirectoryPath('C:\\', jobsRoot)).toThrow();

      await expect(cleanupJobDirectory(path.join(jobsRoot, '../cache'), jobsRoot)).rejects.toMatchObject({
        code: 'UNSAFE_CLEANUP_PATH',
      });
    });

    it('reports accurate read-only renderer health status without fabricating OPERATIONAL when binary is missing', () => {
      const healthy = checkSf9RendererHealth();
      expect(healthy.templateAvailable).toBe(true);
      expect(healthy.templateIntegrityValid).toBe(true);
      expect(healthy.executableAvailable).toBe(true);
      expect(['OPERATIONAL', 'DEGRADED']).toContain(healthy.status);

      // Simulate missing binary via LIBREOFFICE_BIN override
      const prevBin = process.env.LIBREOFFICE_BIN;
      process.env.LIBREOFFICE_BIN = 'C:\\missing_libreoffice\\soffice.bin';
      try {
        const degraded = checkSf9RendererHealth();
        expect(degraded.executableAvailable).toBe(false);
        expect(degraded.status).toBe('UNAVAILABLE');
      } finally {
        if (prevBin === undefined) {
          delete process.env.LIBREOFFICE_BIN;
        } else {
          process.env.LIBREOFFICE_BIN = prevBin;
        }
      }
    });
  });

  // ─── 4. Incomplete Record Rejection & Non-Fabrication Guards ──────────────
  describe('4. Academic Safety, RBAC, Publication Gate & Zero Fabricated Student Data', () => {
    it('enforces academic completeness: rejects records with missing learning areas, terms, attendance, or comments', () => {
      const incompleteInput = {
        demographics: {
          name: 'SANTOS, ANGELO SYNTHETIC',
          lrn: '999999260099',
          birthdateSerial: '41409',
          age: 13,
          gender: 'M' as const,
          gradeLevel: 7,
          section: 'Agoncillo',
          schoolYear: '2026-2027',
        },
        grades: {
          math: [88, 90] as any, // Only 2 terms!
        },
        attendance: {
          present: [15, 20, 20],
          classDays: [],
        },
        comments: { t1: '', t2: '', t3: '' },
      };

      const missing = validateSf9InputCompleteness(incompleteInput as any);
      expect(missing.some((m) => m.includes('grades.filipino'))).toBe(true);
      expect(missing.some((m) => m.includes('grades.math'))).toBe(true);
      expect(missing.some((m) => m.includes('attendance.present'))).toBe(true);
      expect(missing.some((m) => m.includes('attendance.classDays'))).toBe(true);
      expect(missing.some((m) => m.includes('comments.t1'))).toBe(true);
      expect(missing.some((m) => m.includes('comments.t2'))).toBe(true);
      expect(missing.some((m) => m.includes('comments.t3'))).toBe(true);

      const result = generateCalulutSf9(incompleteInput as any);
      expect(result.success).toBe(false);
    });

    it('restricts synthetic preview and official SF9 endpoints to authorized staff roles only', async () => {
      // Unauthenticated requests -> 401
      const unauthPdf = await dispatchAppGet('/api/academic/report-card/sf9/preview/pdf');
      expect(unauthPdf.status).toBe(401);

      const unauthStudentPdf = await dispatchAppGet('/api/academic/report-card/stu-1/sf9/pdf');
      expect(unauthStudentPdf.status).toBe(401);

      // Student role -> 403 Forbidden on synthetic preview and official SF9 endpoints
      const studentActor = {
        id: 'stu-user-1',
        schoolId: '2026-00001',
        roles: ['Student'],
      };
      mockAuthenticatedUser(studentActor);
      const studentCookie = makeAuthCookie(studentActor);

      const stuPreviewData = await dispatchAppGet(
        '/api/academic/report-card/sf9/preview/data',
        studentCookie
      );
      expect(stuPreviewData.status).toBe(403);

      const stuPreviewPdf = await dispatchAppGet(
        '/api/academic/report-card/sf9/preview/pdf',
        studentCookie
      );
      expect(stuPreviewPdf.status).toBe(403);

      const stuOfficialPdf = await dispatchAppGet(
        '/api/academic/report-card/stu-user-1/sf9/pdf',
        studentCookie
      );
      expect(stuOfficialPdf.status).toBe(403);

      // Nurse / Guidance -> 403 Forbidden
      expect(() =>
        assertAuthorizedSf9Staff({
          id: 'nurse-1',
          schoolId: 'EMP-N-001',
          firstName: 'Test',
          lastName: 'Nurse',
          status: 'active',
          permissions: [],
          roles: ['Nurse'],
        })
      ).toThrow(/FORBIDDEN|authorized school personnel/i);

      // Teacher / Registrar / Principal / Admin -> Allowed for synthetic preview
      const teacherActor = {
        id: 'teacher-1',
        schoolId: 'EMP-T-001',
        roles: ['Teacher'],
      };
      mockAuthenticatedUser(teacherActor);
      const teacherCookie = makeAuthCookie(teacherActor);
      const teacherPreviewData = await dispatchAppGet(
        '/api/academic/report-card/sf9/preview/data',
        teacherCookie
      );
      expect(teacherPreviewData.status).toBe(200);
      expect(teacherPreviewData.headers['cache-control']).toContain('no-store');
    });

    it('blocks a teacher from generating SF9 for a student in an unassigned section (cross-student isolation)', async () => {
      vi.spyOn(prisma.student, 'findFirst').mockResolvedValue({
        id: 'stu-other-sec',
        user_id: 'user-other-sec',
        lrn: '123456789012',
        grade_level: 10,
        gender: 'Male',
        date_of_birth: new Date('2011-05-10'),
        user: { first_name: 'Juan', last_name: 'Dela Cruz', middle_name: null },
        current_section: {
          id: 'sec-rizal',
          name: 'Rizal',
          grade_level: 10,
          academic_year: { id: 'ay-2026', name: '2026-2027' },
          assignments: [
            {
              academic_year_id: 'ay-2026',
              teacher: { user_id: 'assigned-teacher-id', user: { first_name: 'Maria', last_name: 'Clara' } },
              subject: { id: 'sub-1', name: 'Mathematics', code: 'MATH10' },
            },
          ],
        },
      } as any);

      await expect(
        generateStudentCalulutSf9('stu-other-sec', {
          id: 'unassigned-teacher-id',
          schoolId: 'EMP-T-999',
          roles: ['Teacher'],
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('blocks unpublished grades even if ?allowDraft=true is passed on the HTTP route', async () => {
      vi.spyOn(prisma.student, 'findFirst').mockResolvedValue({
        id: 'stu-draft',
        user_id: 'user-draft',
        lrn: '123456789012',
        grade_level: 7,
        gender: 'Male',
        date_of_birth: new Date('2013-05-10'),
        user: { first_name: 'Pedro', last_name: 'Penduko', middle_name: null },
        current_section: {
          id: 'sec-agoncillo',
          name: 'Agoncillo',
          grade_level: 7,
          academic_year: { id: 'ay-2026', name: '2026-2027' },
          assignments: [
            {
              academic_year_id: 'ay-2026',
              teacher: { user_id: 'teacher-1', user: { first_name: 'Kathrina', last_name: 'Omlang' } },
              subject: { id: 'sub-1', name: 'Mathematics', code: 'MATH7' },
            },
          ],
        },
      } as any);

      vi.spyOn(prisma.gradebooks, 'findMany').mockResolvedValue([
        { id: 'gb-1', status: 'Draft', term: { key: 'T1' } },
      ] as any);

      const teacherActor = {
        id: 'teacher-1',
        schoolId: 'EMP-T-001',
        roles: ['Teacher'],
      };
      mockAuthenticatedUser(teacherActor);
      const teacherCookie = makeAuthCookie(teacherActor);

      const excelRes = await dispatchAppGet(
        '/api/academic/report-card/stu-draft/sf9/excel?allowDraft=true',
        teacherCookie
      );

      expect(excelRes.status).toBe(422);
      expect(excelRes.body.error.code).toBe('GRADES_NOT_PUBLISHED');
    });

    it('blocks a real student with published gradebooks but incomplete learning-area grades', async () => {
      vi.spyOn(prisma.student, 'findFirst').mockResolvedValue({
        id: 'stu-incomplete',
        user_id: 'user-incomplete',
        lrn: '123456789012',
        grade_level: 7,
        gender: 'Male',
        date_of_birth: new Date('2013-05-10'),
        user: { first_name: 'Pedro', last_name: 'Penduko', middle_name: null },
        current_section: {
          id: 'sec-agoncillo',
          name: 'Agoncillo',
          grade_level: 7,
          academic_year: { id: 'ay-2026', name: '2026-2027' },
          assignments: [
            {
              academic_year_id: 'ay-2026',
              teacher: { user_id: 'teacher-1', user: { first_name: 'Kathrina', last_name: 'Omlang' } },
              subject: { id: 'sub-1', name: 'Mathematics', code: 'MATH7' },
            },
          ],
        },
      } as any);

      vi.spyOn(prisma.gradebooks, 'findMany').mockResolvedValue([
        { id: 'gb-1', status: 'Published', term: { key: 'T1' } },
        { id: 'gb-2', status: 'Published', term: { key: 'T2' } },
        { id: 'gb-3', status: 'Published', term: { key: 'T3' } },
      ] as any);

      // Only Mathematics grades exist; other 8 subjects are missing
      vi.spyOn(prisma.grade, 'findMany').mockResolvedValue([
        { term: 'T1', term_grade: 88, subject: { name: 'Mathematics', code: 'MATH7' } },
        { term: 'T2', term_grade: 90, subject: { name: 'Mathematics', code: 'MATH7' } },
        { term: 'T3', term_grade: 92, subject: { name: 'Mathematics', code: 'MATH7' } },
      ] as any);

      await expect(
        generateStudentCalulutSf9('stu-incomplete', {
          id: 'teacher-1',
          schoolId: 'EMP-T-001',
          roles: ['Teacher'],
        })
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'INCOMPLETE_ACADEMIC_RECORD',
      });
    });

    it('refuses to fabricate missing attendance or teacher comments even when all 9 subject grades are complete and published', async () => {
      vi.spyOn(prisma.student, 'findFirst').mockResolvedValue({
        id: 'stu-complete-grades',
        user_id: 'user-complete-grades',
        lrn: '123456789012',
        grade_level: 7,
        gender: 'Male',
        date_of_birth: new Date('2013-05-10'),
        user: { first_name: 'Pedro', last_name: 'Penduko', middle_name: null },
        current_section: {
          id: 'sec-agoncillo',
          name: 'Agoncillo',
          grade_level: 7,
          academic_year: { id: 'ay-2026', name: '2026-2027' },
          assignments: [
            {
              academic_year_id: 'ay-2026',
              teacher: { user_id: 'teacher-1', user: { first_name: 'Kathrina', last_name: 'Omlang' } },
              subject: { id: 'sub-1', name: 'Mathematics', code: 'MATH7' },
            },
          ],
        },
      } as any);

      vi.spyOn(prisma.gradebooks, 'findMany').mockResolvedValue([
        { id: 'gb-1', status: 'Published', term: { key: 'T1' } },
        { id: 'gb-2', status: 'Published', term: { key: 'T2' } },
        { id: 'gb-3', status: 'Published', term: { key: 'T3' } },
      ] as any);

      const subjects = [
        { name: 'Filipino', code: 'FIL7' },
        { name: 'English', code: 'ENG7' },
        { name: 'Mathematics', code: 'MATH7' },
        { name: 'Science', code: 'SCI7' },
        { name: 'Araling Panlipunan', code: 'AP7' },
        { name: 'GMRC / EsP', code: 'GMRC7' },
        { name: 'TLE', code: 'TLE7' },
        { name: 'Music & Arts', code: 'MUS7' },
        { name: 'Physical Education & Health', code: 'PE7' },
      ];

      const allTermGrades = subjects.flatMap((subject) => [
        { term: 'T1', term_grade: 88, subject },
        { term: 'T2', term_grade: 90, subject },
        { term: 'T3', term_grade: 92, subject },
      ]);

      vi.spyOn(prisma.grade, 'findMany').mockResolvedValue(allTermGrades as any);

      await expect(
        generateStudentCalulutSf9Pdf('stu-complete-grades', {
          id: 'teacher-1',
          schoolId: 'EMP-T-001',
          roles: ['Teacher'],
        })
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'AUTHORITATIVE_SF9_DATA_UNAVAILABLE',
      });
    });
  });
});
