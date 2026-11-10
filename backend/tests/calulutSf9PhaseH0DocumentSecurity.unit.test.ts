import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import http from 'http';
import { Duplex } from 'stream';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
    },
    teacher: {
      findUnique: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    documentRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    excuseLetter: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    leaveRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    schoolSettings: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  },
}));

vi.mock('../src/config/database.js', () => ({
  default: mockPrisma,
}));

vi.mock('../src/audit/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({ id: 'audit-1' }),
}));

import app from '../src/app.js';
import { config } from '../src/config/env.js';
import {
  getMediaStoragePath,
  getBrandingStoragePath,
  getLeavesStoragePath,
  initMediaStorage,
} from '../src/config/storage.config.js';
import { resolveSafeStorageFilePath } from '../src/documents/documentSecurity.service.js';
import {
  getReferencedMediaFiles,
  archiveStorageDirectory,
  extractStorageArchive,
  getBackupStatusOverview,
  EXCLUDED_STORAGE_SUBDIRS,
} from '../src/backup/backup.service.js';

interface InMemoryHttpResponse {
  status: number;
  headers: Record<string, string>;
  rawBuffer: Buffer;
  text: string;
  body: any;
}

/**
 * Dispatches an HTTP request directly through the Express `app` pipeline in-memory
 * without binding or connecting to any loopback TCP socket (sandbox-safe).
 */
async function invokeApp(options: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<InMemoryHttpResponse> {
  return new Promise((resolve, reject) => {
    const socket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    (socket as any).remoteAddress = '127.0.0.1';
    (socket as any).writable = true;
    (socket as any).readable = true;

    const req = new http.IncomingMessage(socket as any);
    req.method = options.method;
    req.url = options.url;
    req.headers = {};

    for (const [k, v] of Object.entries(options.headers || {})) {
      req.headers[k.toLowerCase()] = v;
    }

    let payloadBuffer: Buffer | null = null;
    if (options.body !== undefined) {
      const serialized =
        typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      payloadBuffer = Buffer.from(serialized, 'utf-8');
      if (!req.headers['content-type']) {
        req.headers['content-type'] = 'application/json';
      }
      req.headers['content-length'] = String(payloadBuffer.length);
    }

    const res = new http.ServerResponse(req);
    res.assignSocket(socket as any);

    const chunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: any, encoding?: any, cb?: any): boolean => {
      if (chunk) {
        chunks.push(
          Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf-8')
        );
      }
      return origWrite(chunk, encoding, cb);
    }) as any;

    res.end = ((chunk?: any, encoding?: any, cb?: any): any => {
      if (chunk && typeof chunk !== 'function') {
        chunks.push(
          Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf-8')
        );
      }
      origEnd(chunk, encoding, cb);

      const rawHeaders = res.getHeaders();
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (v !== undefined) {
          headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
        }
      }

      const rawBuffer = Buffer.concat(chunks);
      const text = rawBuffer.toString('utf-8');
      let parsedBody: any = rawBuffer;
      const contentType = headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          parsedBody = JSON.parse(text);
        } catch {
          parsedBody = text;
        }
      }

      resolve({
        status: res.statusCode,
        headers,
        rawBuffer,
        text,
        body: parsedBody,
      });
      return res;
    }) as any;

    res.on('error', reject);

    try {
      (app as any)(req, res);
      if (payloadBuffer) {
        req.push(payloadBuffer);
      }
      req.push(null);
    } catch (err) {
      reject(err);
    }
  });
}

const STORAGE_DOCUMENTS_DIR = getMediaStoragePath();
const STORAGE_BRANDING_DIR = getBrandingStoragePath();
const STORAGE_LEAVES_DIR = getLeavesStoragePath();

const SYNTHETIC_BRANDING_FILENAME = 'branding_logo_synthetic_phase_h0_test.png';
const SYNTHETIC_PRIVATE_DOC_FILENAME = 'synthetic_phase_h0_private_doc.pdf';
const SYNTHETIC_CLINIC_DOC_FILENAME = 'synthetic_phase_h0_clinic_doc.pdf';
const SYNTHETIC_LEAVE_DOC_FILENAME = 'leave_synthetic_phase_h0_doc.pdf';

const SYNTHETIC_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);
const SYNTHETIC_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n',
  'utf-8'
);

interface SyntheticRoleSpec {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  roleName: string;
  permissions: string[];
}

const USERS: Record<string, SyntheticRoleSpec> = {
  studentOwner: {
    id: 'user-student-owner',
    schoolId: 'STU-OWNER-001',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    roleName: 'Student',
    permissions: ['academic:read', 'document:request', 'document:read'],
  },
  studentUnrelated: {
    id: 'user-student-other',
    schoolId: 'STU-OTHER-002',
    firstName: 'Pedro',
    lastName: 'Penduko',
    roleName: 'Student',
    permissions: ['academic:read', 'document:request', 'document:read'],
  },
  teacherAssigned: {
    id: 'user-teacher-assigned',
    schoolId: 'TCH-ASSIGNED-001',
    firstName: 'Maria',
    lastName: 'Santos',
    roleName: 'Teacher',
    permissions: [
      'user:read',
      'academic:read',
      'assignment:read_own',
      'grade:read',
      'grade:write',
      'attendance:read',
      'attendance:write',
    ],
  },
  teacherUnrelated: {
    id: 'user-teacher-unrelated',
    schoolId: 'TCH-UNRELATED-002',
    firstName: 'Jose',
    lastName: 'Rizal',
    roleName: 'Teacher',
    permissions: [
      'user:read',
      'academic:read',
      'assignment:read_own',
      'grade:read',
      'grade:write',
      'attendance:read',
      'attendance:write',
    ],
  },
  nurseStaff: {
    id: 'user-nurse-001',
    schoolId: 'NRS-001',
    firstName: 'Clara',
    lastName: 'Barton',
    roleName: 'Nurse',
    permissions: ['user:read', 'clinic:read', 'clinic:write'],
  },
  guidanceStaff: {
    id: 'user-guidance-001',
    schoolId: 'GDC-001',
    firstName: 'Elena',
    lastName: 'Guidance',
    roleName: 'Guidance',
    permissions: ['user:read', 'guidance:read', 'guidance:write', 'behavior:read', 'behavior:write'],
  },
  registrarStaff: {
    id: 'user-registrar-001',
    schoolId: 'REG-001',
    firstName: 'Rosa',
    lastName: 'Registrar',
    roleName: 'Registrar',
    permissions: [
      'user:read',
      'academic:read',
      'enrollment:read',
      'enrollment:write',
      'grade:read_all',
      'document:read',
      'document:approve',
    ],
  },
  principalStaff: {
    id: 'user-principal-001',
    schoolId: 'PRN-001',
    firstName: 'Antonio',
    lastName: 'Principal',
    roleName: 'Principal',
    permissions: [
      'user:read',
      'academic:read',
      'assignment:read_all',
      'grade:read_all',
      'grade:publish',
      'attendance:read',
      'document:read',
      'document:approve',
      'leave:approve',
    ],
  },
  adminStaff: {
    id: 'user-admin-001',
    schoolId: 'ADM-001',
    firstName: 'System',
    lastName: 'Admin',
    roleName: 'Admin',
    permissions: [
      'user:read',
      'academic:read',
      'document:read',
      'document:approve',
      'leave:approve',
      'clinic:read',
    ],
  },
};

function makeAuthHeader(spec: SyntheticRoleSpec): string {
  const token = jwt.sign({ userId: spec.id }, config.jwt.secret, { expiresIn: '15m' });
  return `Bearer ${token}`;
}

function toDbUserRecord(spec: SyntheticRoleSpec) {
  return {
    id: spec.id,
    school_id: spec.schoolId,
    email: `${spec.id}@calulut.edu.ph`,
    first_name: spec.firstName,
    last_name: spec.lastName,
    status: 'active',
    must_change_password: false,
    user_roles: [
      {
        role: {
          name: spec.roleName,
          role_permissions: spec.permissions.map(key => ({
            permission: { key },
          })),
        },
      },
    ],
  };
}

describe('Phase H.0 — Secure Private Document Storage & Authorization Suite', () => {
  const createdTempFiles: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();

    fs.mkdirSync(STORAGE_BRANDING_DIR, { recursive: true });
    fs.mkdirSync(STORAGE_DOCUMENTS_DIR, { recursive: true });
    fs.mkdirSync(STORAGE_LEAVES_DIR, { recursive: true });

    const brandingFile = path.join(STORAGE_BRANDING_DIR, SYNTHETIC_BRANDING_FILENAME);
    fs.writeFileSync(brandingFile, SYNTHETIC_PNG_BUFFER);
    if (!createdTempFiles.includes(brandingFile)) createdTempFiles.push(brandingFile);

    const privateDocFile = path.join(STORAGE_DOCUMENTS_DIR, SYNTHETIC_PRIVATE_DOC_FILENAME);
    fs.writeFileSync(privateDocFile, SYNTHETIC_PDF_BUFFER);
    if (!createdTempFiles.includes(privateDocFile)) createdTempFiles.push(privateDocFile);

    const clinicDocFile = path.join(STORAGE_DOCUMENTS_DIR, SYNTHETIC_CLINIC_DOC_FILENAME);
    fs.writeFileSync(clinicDocFile, SYNTHETIC_PDF_BUFFER);
    if (!createdTempFiles.includes(clinicDocFile)) createdTempFiles.push(clinicDocFile);

    const leaveDocFile = path.join(STORAGE_LEAVES_DIR, SYNTHETIC_LEAVE_DOC_FILENAME);
    fs.writeFileSync(leaveDocFile, SYNTHETIC_PDF_BUFFER);
    if (!createdTempFiles.includes(leaveDocFile)) createdTempFiles.push(leaveDocFile);

    mockPrisma.user.findUnique.mockImplementation(async ({ where }: any) => {
      const match = Object.values(USERS).find(u => u.id === where?.id);
      return match ? toDbUserRecord(match) : null;
    });

    mockPrisma.student.findUnique.mockImplementation(async ({ where }: any) => {
      if (where?.user_id === USERS.studentOwner.id) {
        return { id: 'student-profile-owner', user_id: USERS.studentOwner.id };
      }
      if (where?.user_id === USERS.studentUnrelated.id) {
        return { id: 'student-profile-other', user_id: USERS.studentUnrelated.id };
      }
      return null;
    });

    mockPrisma.teacher.findUnique.mockImplementation(async ({ where }: any) => {
      if (where?.user_id === USERS.teacherAssigned.id) {
        return { id: 'teacher-profile-assigned', user_id: USERS.teacherAssigned.id };
      }
      if (where?.user_id === USERS.teacherUnrelated.id) {
        return { id: 'teacher-profile-unrelated', user_id: USERS.teacherUnrelated.id };
      }
      return null;
    });
  });

  afterAll(() => {
    for (const f of createdTempFiles) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // ignore cleanup error
        }
      }
    }
  });

  it('1. Public school branding loads without authentication where intended', async () => {
    mockPrisma.schoolSettings.findUnique.mockResolvedValue({
      id: 'default',
      school_name: 'Calulut Integrated School',
      school_short_name: 'CIS',
      logo_url: `/storage/branding/${SYNTHETIC_BRANDING_FILENAME}`,
      favicon_url: `/storage/branding/${SYNTHETIC_BRANDING_FILENAME}`,
      login_background_url: null,
      primary_color: '#0A192F',
      secondary_color: '#1B3A6B',
      accent_color: '#F5A623',
      address: 'Calulut, City of San Fernando, Pampanga',
      contact_email: null,
      contact_number: null,
      login_welcome_text: 'Education Shapes the Future',
      footer_text: 'DigiSkwela',
    });

    const settingsRes = await invokeApp({
      method: 'GET',
      url: '/api/settings/school/public',
    });
    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.success).toBe(true);
    expect(settingsRes.body.data.logoUrl).toBe(`/storage/branding/${SYNTHETIC_BRANDING_FILENAME}`);

    const assetRes = await invokeApp({
      method: 'GET',
      url: `/storage/branding/${SYNTHETIC_BRANDING_FILENAME}`,
    });
    expect(assetRes.status).toBe(200);
    expect(assetRes.headers['content-type']).toMatch(/image\/png/);
    expect(assetRes.rawBuffer.subarray(0, 4).toString('hex')).toBe('89504e47');
  });

  it('2. Private /storage/documents/..., /storage/leaves/..., and /storage/chatgpt/... URLs are denied when unauthenticated or accessed directly', async () => {
    const privateDocRes = await invokeApp({
      method: 'GET',
      url: `/storage/documents/${SYNTHETIC_PRIVATE_DOC_FILENAME}`,
    });
    expect(privateDocRes.status).toBe(403);
    expect(privateDocRes.body.success).toBe(false);
    expect(privateDocRes.body.error.code).toBe('FORBIDDEN');
    expect(privateDocRes.headers['cache-control']).toContain('no-store');

    const privateLeaveRes = await invokeApp({
      method: 'GET',
      url: `/storage/leaves/${SYNTHETIC_LEAVE_DOC_FILENAME}`,
    });
    expect(privateLeaveRes.status).toBe(403);
    expect(privateLeaveRes.body.success).toBe(false);

    const privateChatgptRes = await invokeApp({
      method: 'GET',
      url: '/storage/chatgpt/tokens.json',
    });
    expect(privateChatgptRes.status).toBe(403);
    expect(privateChatgptRes.body.success).toBe(false);

    const privateAvatarRes = await invokeApp({
      method: 'GET',
      url: '/storage/avatars/user-avatar.png',
    });
    expect(privateAvatarRes.status).toBe(403);
    expect(privateAvatarRes.body.success).toBe(false);

    // Even with an authenticated student token, direct static /storage/documents/... access is denied
    const directWithAuthRes = await invokeApp({
      method: 'GET',
      url: `/storage/documents/${SYNTHETIC_PRIVATE_DOC_FILENAME}`,
      headers: { Authorization: makeAuthHeader(USERS.studentOwner) },
    });
    expect(directWithAuthRes.status).toBe(403);
  });

  it('3. Authorized owners can retrieve their own documents via presigned download URL', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-student-excuse-1',
      storage_key: SYNTHETIC_PRIVATE_DOC_FILENAME,
      filename: 'medical_excuse.pdf',
      mime_type: 'application/pdf',
      size_bytes: SYNTHETIC_PDF_BUFFER.length,
      uploaded_by: USERS.studentOwner.id,
      created_at: new Date(),
      uploader: toDbUserRecord(USERS.studentOwner),
      document_requests: [],
      excuseLetters: [
        {
          id: 'excuse-1',
          student_id: 'student-profile-owner',
          teacher_id: 'teacher-profile-assigned',
          document_id: 'doc-student-excuse-1',
        },
      ],
      teacherRankingDocuments: [],
      campus_media: null,
    });

    const presignRes = await invokeApp({
      method: 'POST',
      url: '/api/documents/doc-student-excuse-1/presign-download',
      headers: { Authorization: makeAuthHeader(USERS.studentOwner) },
    });

    expect(presignRes.status).toBe(200);
    expect(presignRes.body.success).toBe(true);
    expect(presignRes.body.data.url).toMatch(/^\/api\/documents\/serve\?token=/);
    expect(presignRes.headers['cache-control']).toContain('no-store');

    const serveRes = await invokeApp({
      method: 'GET',
      url: presignRes.body.data.url,
    });
    expect(serveRes.status).toBe(200);
    expect(serveRes.headers['content-type']).toMatch(/application\/pdf/);
    expect(serveRes.headers['cache-control']).toContain('private');
    expect(serveRes.headers['cache-control']).toContain('no-store');
    expect(serveRes.headers['x-content-type-options']).toBe('nosniff');
    expect(serveRes.rawBuffer.toString('utf-8')).toContain('%PDF-1.4');
  });

  it("4. An unrelated student cannot retrieve another student's document", async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-student-excuse-1',
      storage_key: SYNTHETIC_PRIVATE_DOC_FILENAME,
      filename: 'medical_excuse.pdf',
      mime_type: 'application/pdf',
      size_bytes: SYNTHETIC_PDF_BUFFER.length,
      uploaded_by: USERS.studentOwner.id,
      created_at: new Date(),
      uploader: toDbUserRecord(USERS.studentOwner),
      document_requests: [],
      excuseLetters: [
        {
          id: 'excuse-1',
          student_id: 'student-profile-owner',
          teacher_id: 'teacher-profile-assigned',
          document_id: 'doc-student-excuse-1',
        },
      ],
      teacherRankingDocuments: [],
      campus_media: null,
    });

    const presignRes = await invokeApp({
      method: 'POST',
      url: '/api/documents/doc-student-excuse-1/presign-download',
      headers: { Authorization: makeAuthHeader(USERS.studentUnrelated) },
    });

    expect(presignRes.status).toBe(403);
    expect(presignRes.body.success).toBe(false);
    expect(presignRes.body.error.code).toBe('FORBIDDEN');

    const metadataRes = await invokeApp({
      method: 'GET',
      url: '/api/documents/doc-student-excuse-1',
      headers: { Authorization: makeAuthHeader(USERS.studentUnrelated) },
    });
    expect(metadataRes.status).toBe(403);
  });

  it('5. Unrelated staff cannot retrieve protected student/faculty documents', async () => {
    // 5a. Unrelated teacher trying to access another teacher's student excuse letter
    mockPrisma.document.findUnique.mockResolvedValueOnce({
      id: 'doc-student-excuse-1',
      storage_key: SYNTHETIC_PRIVATE_DOC_FILENAME,
      filename: 'medical_excuse.pdf',
      mime_type: 'application/pdf',
      size_bytes: SYNTHETIC_PDF_BUFFER.length,
      uploaded_by: USERS.studentOwner.id,
      created_at: new Date(),
      uploader: toDbUserRecord(USERS.studentOwner),
      document_requests: [],
      excuseLetters: [
        {
          id: 'excuse-1',
          student_id: 'student-profile-owner',
          teacher_id: 'teacher-profile-assigned',
          document_id: 'doc-student-excuse-1',
        },
      ],
      teacherRankingDocuments: [],
      campus_media: null,
    });

    const unrelatedTeacherExcuseRes = await invokeApp({
      method: 'POST',
      url: '/api/documents/doc-student-excuse-1/presign-download',
      headers: { Authorization: makeAuthHeader(USERS.teacherUnrelated) },
    });
    expect(unrelatedTeacherExcuseRes.status).toBe(403);

    // 5b. Registrar trying to access a Teacher's private faculty ranking document
    mockPrisma.document.findUnique.mockResolvedValueOnce({
      id: 'doc-faculty-ranking-1',
      storage_key: SYNTHETIC_PRIVATE_DOC_FILENAME,
      filename: 'ipcrf_evaluation.pdf',
      mime_type: 'application/pdf',
      size_bytes: SYNTHETIC_PDF_BUFFER.length,
      uploaded_by: USERS.teacherAssigned.id,
      created_at: new Date(),
      uploader: toDbUserRecord(USERS.teacherAssigned),
      document_requests: [],
      excuseLetters: [],
      teacherRankingDocuments: [
        {
          ranking_id: 'ranking-1',
          document_id: 'doc-faculty-ranking-1',
          ranking: {
            id: 'ranking-1',
            teacher_id: 'teacher-profile-assigned',
            teacher: { id: 'teacher-profile-assigned', user_id: USERS.teacherAssigned.id },
          },
        },
      ],
      campus_media: null,
    });

    const registrarRankingRes = await invokeApp({
      method: 'POST',
      url: '/api/documents/doc-faculty-ranking-1/presign-download',
      headers: { Authorization: makeAuthHeader(USERS.registrarStaff) },
    });
    expect(registrarRankingRes.status).toBe(403);

    // 5c. Unrelated teacher trying to access another teacher's LeaveRequest attachment
    mockPrisma.leaveRequest.findUnique.mockResolvedValueOnce({
      id: 'leave-teacher-1',
      user_id: USERS.teacherAssigned.id,
      attachment_url: `/storage/leaves/${SYNTHETIC_LEAVE_DOC_FILENAME}`,
    });

    const unrelatedTeacherLeaveRes = await invokeApp({
      method: 'GET',
      url: '/api/admin/leaves/leave-teacher-1/attachment',
      headers: { Authorization: makeAuthHeader(USERS.teacherUnrelated) },
    });
    expect(unrelatedTeacherLeaveRes.status).toBe(403);
  });

  it('6. Clinic-sensitive documents retain their appropriate access restrictions', async () => {
    const clinicDocRecord = {
      id: 'doc-clinic-1',
      storage_key: SYNTHETIC_CLINIC_DOC_FILENAME,
      filename: 'clinic_referral_lab_result.pdf',
      mime_type: 'application/pdf',
      size_bytes: SYNTHETIC_PDF_BUFFER.length,
      uploaded_by: USERS.nurseStaff.id,
      created_at: new Date(),
      uploader: toDbUserRecord(USERS.nurseStaff),
      document_requests: [],
      excuseLetters: [],
      teacherRankingDocuments: [],
      campus_media: null,
    };

    // Unrelated Teacher, Registrar, Principal, Guidance, and Student must be denied
    for (const unauthorizedActor of [
      USERS.teacherAssigned,
      USERS.registrarStaff,
      USERS.principalStaff,
      USERS.guidanceStaff,
      USERS.studentUnrelated,
    ]) {
      mockPrisma.document.findUnique.mockResolvedValueOnce(clinicDocRecord);
      const res = await invokeApp({
        method: 'POST',
        url: '/api/documents/doc-clinic-1/presign-download',
        headers: { Authorization: makeAuthHeader(unauthorizedActor) },
      });
      expect(res.status).toBe(403);
    }

    // Authorized Nurse can access the clinic document
    mockPrisma.document.findUnique.mockResolvedValueOnce(clinicDocRecord);
    const nurseRes = await invokeApp({
      method: 'POST',
      url: '/api/documents/doc-clinic-1/presign-download',
      headers: { Authorization: makeAuthHeader(USERS.nurseStaff) },
    });
    expect(nurseRes.status).toBe(200);
    expect(nurseRes.body.data.url).toMatch(/^\/api\/documents\/serve\?token=/);
  });

  it('7. Directory traversal attempts are rejected across storage helpers and HTTP endpoints', async () => {
    const traversalKeys = [
      '../schema.prisma',
      '..\\schema.prisma',
      '../../.env',
      '../chatgpt/tokens.json',
      'subdir/file.pdf',
      'subdir\\file.pdf',
      '.hidden_file.pdf',
      'file\0name.pdf',
      'C:\\Windows\\win.ini',
      '/etc/passwd',
      '   ',
    ];

    for (const badKey of traversalKeys) {
      expect(() => resolveSafeStorageFilePath(STORAGE_DOCUMENTS_DIR, badKey)).toThrow();
    }

    // Even if a database record had a corrupted traversal storage_key, presign and serve reject it
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-traversal-1',
      storage_key: '../chatgpt/tokens.json',
      filename: 'malicious.pdf',
      mime_type: 'application/pdf',
      size_bytes: 100,
      uploaded_by: USERS.studentOwner.id,
      created_at: new Date(),
      uploader: toDbUserRecord(USERS.studentOwner),
      document_requests: [],
      excuseLetters: [],
      teacherRankingDocuments: [],
      campus_media: null,
    });

    const presignTraversalRes = await invokeApp({
      method: 'POST',
      url: '/api/documents/doc-traversal-1/presign-download',
      headers: { Authorization: makeAuthHeader(USERS.studentOwner) },
    });
    expect(presignTraversalRes.status).toBe(400);
    expect(presignTraversalRes.body.error.code).toBe('INVALID_STORAGE_KEY');

    // Branding static route also rejects encoded traversal
    const brandingTraversalRes = await invokeApp({
      method: 'GET',
      url: '/storage/branding/..%2Fdocuments%2Fsynthetic_phase_h0_private_doc.pdf',
    });
    expect([400, 403, 404]).toContain(brandingTraversalRes.status);
  });

  it('8. Private file metadata (storage_key) and server filesystem paths are not leaked', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-student-excuse-1',
      storage_key: SYNTHETIC_PRIVATE_DOC_FILENAME,
      filename: 'medical_excuse.pdf',
      mime_type: 'application/pdf',
      size_bytes: SYNTHETIC_PDF_BUFFER.length,
      uploaded_by: USERS.studentOwner.id,
      created_at: new Date('2026-10-29T00:00:00.000Z'),
      uploader: toDbUserRecord(USERS.studentOwner),
      document_requests: [],
      excuseLetters: [],
      teacherRankingDocuments: [],
      campus_media: null,
    });

    const docMetaRes = await invokeApp({
      method: 'GET',
      url: '/api/documents/doc-student-excuse-1',
      headers: { Authorization: makeAuthHeader(USERS.studentOwner) },
    });

    expect(docMetaRes.status).toBe(200);
    expect(docMetaRes.body.data).toEqual({
      id: 'doc-student-excuse-1',
      filename: 'medical_excuse.pdf',
      mime_type: 'application/pdf',
      size_bytes: SYNTHETIC_PDF_BUFFER.length,
      uploaded_by: USERS.studentOwner.id,
      created_at: '2026-10-29T00:00:00.000Z',
    });
    expect(docMetaRes.body.data.storage_key).toBeUndefined();
    expect(JSON.stringify(docMetaRes.body)).not.toContain(SYNTHETIC_PRIVATE_DOC_FILENAME);
    expect(JSON.stringify(docMetaRes.body)).not.toContain(STORAGE_DOCUMENTS_DIR);

    // Session JWT cannot be used as a download token on /api/documents/serve
    const sessionJwt = jwt.sign({ userId: USERS.studentOwner.id }, config.jwt.secret, {
      expiresIn: '15m',
    });
    const tokenConfusionRes = await invokeApp({
      method: 'GET',
      url: `/api/documents/serve?token=${sessionJwt}`,
    });
    expect(tokenConfusionRes.status).toBe(401);
  });

  it('9. Existing authorized document downloads work for assigned teachers, principals, registrars, and leave owners', async () => {
    // 9a. Assigned Teacher can download student's ExcuseLetter attachment (even without global document:read)
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-student-excuse-1',
      storage_key: SYNTHETIC_PRIVATE_DOC_FILENAME,
      filename: 'medical_excuse.pdf',
      mime_type: 'application/pdf',
      size_bytes: SYNTHETIC_PDF_BUFFER.length,
      uploaded_by: USERS.studentOwner.id,
      created_at: new Date(),
      uploader: toDbUserRecord(USERS.studentOwner),
      document_requests: [],
      excuseLetters: [
        {
          id: 'excuse-1',
          student_id: 'student-profile-owner',
          teacher_id: 'teacher-profile-assigned',
          document_id: 'doc-student-excuse-1',
        },
      ],
      teacherRankingDocuments: [],
      campus_media: null,
    });

    const teacherPresignRes = await invokeApp({
      method: 'POST',
      url: '/api/documents/doc-student-excuse-1/presign-download',
      headers: { Authorization: makeAuthHeader(USERS.teacherAssigned) },
    });
    expect(teacherPresignRes.status).toBe(200);

    const teacherServeRes = await invokeApp({
      method: 'GET',
      url: teacherPresignRes.body.data.url,
    });
    expect(teacherServeRes.status).toBe(200);
    expect(teacherServeRes.rawBuffer.toString('utf-8')).toContain('%PDF-1.4');

    // 9b. Registrar and Principal can download DocumentRequest attachment
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-request-attachment-1',
      storage_key: SYNTHETIC_PRIVATE_DOC_FILENAME,
      filename: 'request_supporting_id.pdf',
      mime_type: 'application/pdf',
      size_bytes: SYNTHETIC_PDF_BUFFER.length,
      uploaded_by: USERS.studentOwner.id,
      created_at: new Date(),
      uploader: toDbUserRecord(USERS.studentOwner),
      document_requests: [
        {
          id: 'req-1',
          student_id: 'student-profile-owner',
          teacher_id: 'teacher-profile-assigned',
          attached_document_id: 'doc-request-attachment-1',
        },
      ],
      excuseLetters: [],
      teacherRankingDocuments: [],
      campus_media: null,
    });

    const registrarPresignRes = await invokeApp({
      method: 'POST',
      url: '/api/documents/doc-request-attachment-1/presign-download',
      headers: { Authorization: makeAuthHeader(USERS.registrarStaff) },
    });
    expect(registrarPresignRes.status).toBe(200);

    // 9c. Leave owner and Principal can download LeaveRequest attachment via /api/admin/leaves/:id/attachment
    mockPrisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'leave-teacher-1',
      user_id: USERS.teacherAssigned.id,
      attachment_url: `/storage/leaves/${SYNTHETIC_LEAVE_DOC_FILENAME}`,
    });

    const ownerLeaveRes = await invokeApp({
      method: 'GET',
      url: '/api/admin/leaves/leave-teacher-1/attachment',
      headers: { Authorization: makeAuthHeader(USERS.teacherAssigned) },
    });
    expect(ownerLeaveRes.status).toBe(200);
    expect(ownerLeaveRes.headers['cache-control']).toContain('no-store');

    const principalLeaveRes = await invokeApp({
      method: 'GET',
      url: '/api/admin/leaves/leave-teacher-1/attachment',
      headers: { Authorization: makeAuthHeader(USERS.principalStaff) },
    });
    expect(principalLeaveRes.status).toBe(200);
  });

  it("10. Calulut's genuine synthetic SF9 PDF remains accessible only to authorized staff", async () => {
    const pdfRes = await invokeApp({
      method: 'GET',
      url: '/api/academic/report-card/sf9/preview/pdf',
      headers: { Authorization: makeAuthHeader(USERS.teacherAssigned) },
    });

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toMatch(/application\/pdf/);
    expect(pdfRes.headers['cache-control']).toContain('no-store');
    expect(pdfRes.rawBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdfRes.rawBuffer.length).toBeGreaterThan(10000);
  }, 60000);

  it('11. Unauthorized synthetic QA preview access is rejected', async () => {
    // Unauthenticated
    const unauthDataRes = await invokeApp({
      method: 'GET',
      url: '/api/academic/report-card/sf9/preview/data',
    });
    expect(unauthDataRes.status).toBe(401);

    const unauthPdfRes = await invokeApp({
      method: 'GET',
      url: '/api/academic/report-card/sf9/preview/pdf',
    });
    expect(unauthPdfRes.status).toBe(401);

    // Student role is rejected from staff QA preview endpoints
    const studentDataRes = await invokeApp({
      method: 'GET',
      url: '/api/academic/report-card/sf9/preview/data',
      headers: { Authorization: makeAuthHeader(USERS.studentOwner) },
    });
    expect(studentDataRes.status).toBe(403);

    const studentPdfRes = await invokeApp({
      method: 'GET',
      url: '/api/academic/report-card/sf9/preview/pdf',
      headers: { Authorization: makeAuthHeader(USERS.studentOwner) },
    });
    expect(studentPdfRes.status).toBe(403);

    // Nurse role is rejected from SF9 QA preview endpoints
    const nurseDataRes = await invokeApp({
      method: 'GET',
      url: '/api/academic/report-card/sf9/preview/data',
      headers: { Authorization: makeAuthHeader(USERS.nurseStaff) },
    });
    expect(nurseDataRes.status).toBe(403);
  });

  it('12. Existing storage, backup referential checks, and Phase G.1 migration proposals remain intact', async () => {
    expect(() => initMediaStorage()).not.toThrow();

    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        storage_key: SYNTHETIC_PRIVATE_DOC_FILENAME,
        size_bytes: SYNTHETIC_PDF_BUFFER.length,
      },
    ]);
    mockPrisma.schoolSettings.findFirst.mockResolvedValue({
      id: 'default',
      logo_url: `/storage/branding/${SYNTHETIC_BRANDING_FILENAME}`,
      favicon_url: null,
      login_background_url: null,
    });
    mockPrisma.leaveRequest.findMany.mockResolvedValue([
      {
        id: 'leave-1',
        attachment_url: `/storage/leaves/${SYNTHETIC_LEAVE_DOC_FILENAME}`,
      },
    ]);

    const referenced = await getReferencedMediaFiles(mockPrisma);
    expect(referenced).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model: 'Document',
          id: 'doc-1',
          expectedRelativePath: `documents/${SYNTHETIC_PRIVATE_DOC_FILENAME}`,
        }),
        expect.objectContaining({
          model: 'SchoolSettings',
          id: 'default:logo_url',
          expectedRelativePath: `branding/${SYNTHETIC_BRANDING_FILENAME}`,
        }),
        expect.objectContaining({
          model: 'LeaveRequest',
          id: 'leave-1',
          expectedRelativePath: `leaves/${SYNTHETIC_LEAVE_DOC_FILENAME}`,
        }),
      ])
    );

    // Verify Phase G.1 migration proposal files and active schema.prisma remain untouched
    const proposedPrismaPath = path.resolve(
      __dirname,
      '../prisma/proposals/phase_g_sf2_sf9_schema.prisma'
    );
    const proposedSqlPath = path.resolve(
      __dirname,
      '../prisma/proposals/phase_g_sf2_sf9_migration.draft.sql'
    );
    const activeSchemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

    expect(fs.existsSync(proposedPrismaPath)).toBe(true);
    expect(fs.existsSync(proposedSqlPath)).toBe(true);
    expect(fs.existsSync(activeSchemaPath)).toBe(true);

    const activeSchema = fs.readFileSync(activeSchemaPath, 'utf-8');
    // Phase H.3: Verified that active development schema contains the deployed SF2/SF9 models
    expect(activeSchema).toContain('model OfficialDailyAttendance');
    expect(activeSchema).toContain('model SchoolCalendarMonth');
    expect(activeSchema).toContain('model Sf9AdviserComment');
  });

  it('13. Excludes storage/chatgpt/ from future backup media archives, blocks /backups/*, binds dev host to 127.0.0.1, and keeps ChatGPT Plan delegation disabled by default', async () => {
    expect(EXCLUDED_STORAGE_SUBDIRS.has('chatgpt')).toBe(true);
    expect(config.host).toBe('127.0.0.1');

    // Create a temporary storage tree with branding/, documents/, and chatgpt/
    const tempRoot = path.resolve(__dirname, '../tmp/test_backup_exclusion_phase_h1');
    const tempStorage = path.join(tempRoot, 'storage');
    const tempArchive = path.join(tempRoot, 'test_storage.tar.gz');
    try {
      fs.mkdirSync(path.join(tempStorage, 'branding'), { recursive: true });
      fs.mkdirSync(path.join(tempStorage, 'documents'), { recursive: true });
      fs.mkdirSync(path.join(tempStorage, 'chatgpt'), { recursive: true });

      fs.writeFileSync(path.join(tempStorage, 'branding', 'logo.png'), SYNTHETIC_PNG_BUFFER);
      fs.writeFileSync(path.join(tempStorage, 'documents', 'doc.pdf'), SYNTHETIC_PDF_BUFFER);
      fs.writeFileSync(
        path.join(tempStorage, 'chatgpt', 'tokens.json'),
        JSON.stringify({ accessToken: 'synthetic_never_archive' })
      );
      fs.writeFileSync(
        path.join(tempStorage, 'chatgpt', 'registration.json'),
        JSON.stringify({ issuedClientId: 'oaiapp_synthetic' })
      );

      const archiveRes = await archiveStorageDirectory(tempStorage, tempArchive);
      const archivedPaths = archiveRes.archivedFiles.map(f => f.relativePath);
      expect(archivedPaths).toContain('branding/logo.png');
      expect(archivedPaths).toContain('documents/doc.pdf');
      expect(archivedPaths.some(p => p.includes('chatgpt'))).toBe(false);

      // Even if a legacy archive contained chatgpt/tokens.json, extractStorageArchive refuses to restore it
      const zlib = await import('zlib');
      const legacyArchivePath = path.join(tempRoot, 'legacy_with_chatgpt.tar.gz');
      const legacyExtractDir = path.join(tempRoot, 'extracted');
      const legacyPayload = JSON.stringify([
        { path: 'branding/logo.png', data: SYNTHETIC_PNG_BUFFER.toString('base64') },
        { path: 'chatgpt/tokens.json', data: Buffer.from('{"accessToken":"legacy"}').toString('base64') },
      ]);
      fs.writeFileSync(legacyArchivePath, zlib.gzipSync(Buffer.from(legacyPayload, 'utf-8')));

      const extractedCount = await extractStorageArchive(legacyArchivePath, legacyExtractDir);
      expect(extractedCount).toBe(1);
      expect(fs.existsSync(path.join(legacyExtractDir, 'branding', 'logo.png'))).toBe(true);
      expect(fs.existsSync(path.join(legacyExtractDir, 'chatgpt', 'tokens.json'))).toBe(false);
    } finally {
      if (fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }

    // /backups/* and /quarantine/* are blocked over HTTP
    const backupsHttpRes = await invokeApp({
      method: 'GET',
      url: '/backups/backup-registry.json',
    });
    expect(backupsHttpRes.status).toBe(403);

    const quarantineHttpRes = await invokeApp({
      method: 'GET',
      url: '/quarantine/backups_2026-10-26_pre_h1/quarantine-registry.json',
    });
    expect(quarantineHttpRes.status).toBe(403);

    const backupOverview = getBackupStatusOverview(path.resolve(__dirname, '../backups'));
    expect(backupOverview.verificationStatus).toBe('VERIFIED');
    expect(backupOverview.lastBackupResult).toBe('SUCCESS');
    expect(backupOverview.totalBackupsCount).toBeGreaterThanOrEqual(1);
    expect(backupOverview.recentBackups.length).toBeGreaterThanOrEqual(1);

    // ChatGPT Plan delegation remains disconnected/disabled by default unless explicitly authorized
    const authUrlDisabledRes = await invokeApp({
      method: 'GET',
      url: '/api/ai/chatgpt-plan/auth-url',
      headers: { Authorization: makeAuthHeader(USERS.principalStaff) },
    });
    expect(authUrlDisabledRes.status).toBe(403);
    expect(authUrlDisabledRes.body.error.code).toBe('CHATGPT_PLAN_DISABLED');

    // Non-admin roles (e.g. Teacher / Student) cannot invoke ChatGPT Plan disconnect/auth-url
    const teacherDeleteCredsRes = await invokeApp({
      method: 'DELETE',
      url: '/api/ai/chatgpt-plan/credentials',
      headers: { Authorization: makeAuthHeader(USERS.teacherAssigned) },
    });
    expect(teacherDeleteCredsRes.status).toBe(403);
  });
});
