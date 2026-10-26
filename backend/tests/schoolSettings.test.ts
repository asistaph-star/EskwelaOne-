import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { resetAuthRateLimiter } from '../src/auth/auth.limiter.js';
import { DEFAULT_SCHOOL_SETTINGS } from '../src/settings/settings.service.js';

describe('DIGISKWELA — School Customization & RBAC Security Suite', () => {
  let itAdminCookie: string;
  let adminCookie: string;
  let teacherCookie: string;
  let studentCookie: string;

  beforeAll(async () => {
    resetAuthRateLimiter();

    // Ensure database is in canonical state before tests
    await (prisma as any).schoolSettings.upsert({
      where: { id: 'default' },
      update: DEFAULT_SCHOOL_SETTINGS,
      create: DEFAULT_SCHOOL_SETTINGS,
    });

    // 1. ITAdmin
    const itLogin = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'IT-001', password: 'password123' });
    expect(itLogin.status).toBe(200);
    const itCookies = itLogin.headers['set-cookie'] as string[];
    itAdminCookie = itCookies.find(c => c.startsWith('auth_token='))!;

    // 2. Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'ADM-001', password: 'password123' });
    expect(adminLogin.status).toBe(200);
    const adminCookies = adminLogin.headers['set-cookie'] as string[];
    adminCookie = adminCookies.find(c => c.startsWith('auth_token='))!;

    // 3. Teacher
    const teacherLogin = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'EMP-T-001', password: 'password123' });
    expect(teacherLogin.status).toBe(200);
    const teacherCookies = teacherLogin.headers['set-cookie'] as string[];
    teacherCookie = teacherCookies.find(c => c.startsWith('auth_token='))!;

    // 4. Student
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: '2026-00001', password: 'password123' });
    expect(studentLogin.status).toBe(200);
    const studentCookies = studentLogin.headers['set-cookie'] as string[];
    studentCookie = studentCookies.find(c => c.startsWith('auth_token='))!;
  });

  afterAll(async () => {
    resetAuthRateLimiter();
    // Restore canonical defaults
    await (prisma as any).schoolSettings.upsert({
      where: { id: 'default' },
      update: DEFAULT_SCHOOL_SETTINGS,
      create: DEFAULT_SCHOOL_SETTINGS,
    });
    await prisma.$disconnect();
  });

  describe('1. Public Branding Read', () => {
    it('GET /api/settings/school/public succeeds without authentication and excludes internal metadata', async () => {
      const res = await request(app).get('/api/settings/school/public');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.schoolName).toBe('Calulut Integrated School');
      expect(data.schoolShortName).toBe('CIS');
      expect(data.logoUrl).toBe('/school_seal.png');
      expect(data.primaryColor).toBe('#0A192F');
      expect(data.secondaryColor).toBe('#1B3A6B');
      expect(data.accentColor).toBe('#F5A623');
      expect(data.address).toBeNull();
      expect(data.contactEmail).toBeNull();
      expect(data.contactNumber).toBeNull();
      expect(data.footerText).toBe('DigiSkwela · School Management System');

      // Security check: internal fields must NOT leak
      expect(data).not.toHaveProperty('id');
      expect(data).not.toHaveProperty('created_at');
      expect(data).not.toHaveProperty('updated_at');
      expect(data).not.toHaveProperty('updated_by_id');
      expect(data).not.toHaveProperty('updated_by');
    });
  });

  describe('2. Authenticated Read & RBAC Enforcement', () => {
    it('ITAdmin can read full school settings', async () => {
      const res = await request(app)
        .get('/api/settings/school')
        .set('Cookie', itAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('default');
      expect(res.body.data.school_name).toBe('Calulut Integrated School');
      expect(res.body.data.school_short_name).toBe('CIS');
    });

    it('Standard Admin can read full school settings (read-only access)', async () => {
      const res = await request(app)
        .get('/api/settings/school')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.school_name).toBe('Calulut Integrated School');
    });

    it('Non-administrative roles (Student) cannot read internal settings route', async () => {
      const res = await request(app)
        .get('/api/settings/school')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Unauthenticated request to internal settings route is rejected with 401', async () => {
      const res = await request(app).get('/api/settings/school');
      expect(res.status).toBe(401);
    });
  });

  describe('3. Authorization / RBAC Mutation Boundaries', () => {
    it('ITAdmin can update school settings', async () => {
      const res = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', itAdminCookie)
        .send({
          schoolName: 'Calulut Integrated School - Test Branch',
          primaryColor: '#0F172A',
          contactEmail: 'admin@cinhs.edu.ph',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.school_name).toBe('Calulut Integrated School - Test Branch');
      expect(res.body.data.primary_color).toBe('#0F172A');
      expect(res.body.data.contact_email).toBe('admin@cinhs.edu.ph');
    });

    it('Standard Admin write is strictly BLOCKED with 403 Forbidden', async () => {
      const res = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', adminCookie)
        .send({
          schoolName: 'Malicious Admin Hijack',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Only IT Administrators are authorized');
    });

    it('Teacher write is strictly BLOCKED with 403 Forbidden', async () => {
      const res = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', teacherCookie)
        .send({ schoolName: 'Teacher Hijack' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Student write is strictly BLOCKED with 403 Forbidden', async () => {
      const res = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', studentCookie)
        .send({ schoolName: 'Student Hijack' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Unauthenticated write is rejected with 401', async () => {
      const res = await request(app)
        .patch('/api/settings/school')
        .send({ schoolName: 'Unauth Hijack' });

      expect(res.status).toBe(401);
    });
  });

  describe('4. Input Validation & Mass Assignment Protection', () => {
    it('Rejects invalid hex colors (arbitrary CSS, script injection, non-hex)', async () => {
      const invalidColors = [
        'red',
        'rgb(0,0,0)',
        '#12345',
        '#1234567',
        'url(https://evil.com)',
        '<script>alert(1)</script>',
      ];

      for (const color of invalidColors) {
        const res = await request(app)
          .patch('/api/settings/school')
          .set('Cookie', itAdminCookie)
          .send({ primaryColor: color });

        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('Rejects dangerous URLs (javascript:, data:)', async () => {
      const invalidUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
      ];

      for (const url of invalidUrls) {
        const res = await request(app)
          .patch('/api/settings/school')
          .set('Cookie', itAdminCookie)
          .send({ logoUrl: url });

        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('Rejects mass assignment of internal identifiers (id, created_at, updated_by_id)', async () => {
      const res = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', itAdminCookie)
        .send({
          id: 'arbitrary-id-tamper',
          created_at: new Date().toISOString(),
          updated_by_id: 'tampered-user-id',
        });

      // Strict schema rejects unknown fields
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('5. Reset to Default Branding (White-Label Safe)', () => {
    it('Standard Admin cannot reset settings (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/settings/school/reset')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('ITAdmin reset restores default branding while strictly preserving configured school identity', async () => {
      // Step A: Set custom school identity and custom branding
      await request(app)
        .patch('/api/settings/school')
        .set('Cookie', itAdminCookie)
        .send({
          schoolName: 'Custom Regional Academy',
          schoolShortName: 'CRA',
          address: 'Barangay San Jose, San Fernando',
          contactEmail: 'contact@cra.edu.ph',
          contactNumber: '(045) 888-9999',
          primaryColor: '#7C3AED',
          loginWelcomeText: 'Custom Portal Greeting',
        });

      // Step B: Trigger reset
      const resetRes = await request(app)
        .post('/api/settings/school/reset')
        .set('Cookie', itAdminCookie);

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Verify school identity is PRESERVED (NOT overwritten)
      expect(resetRes.body.data.school_name).toBe('Custom Regional Academy');
      expect(resetRes.body.data.school_short_name).toBe('CRA');
      expect(resetRes.body.data.address).toBe('Barangay San Jose, San Fernando');
      expect(resetRes.body.data.contact_email).toBe('contact@cra.edu.ph');
      expect(resetRes.body.data.contact_number).toBe('(045) 888-9999');

      // Verify visual branding is RESTORED to generic product defaults (null logo/favicon, neutral footer)
      expect(resetRes.body.data.primary_color).toBe('#0A192F');
      expect(resetRes.body.data.secondary_color).toBe('#1B3A6B');
      expect(resetRes.body.data.accent_color).toBe('#F5A623');
      expect(resetRes.body.data.login_welcome_text).toBe('Education Shapes the Future');
      expect(resetRes.body.data.logo_url).toBeNull();
      expect(resetRes.body.data.favicon_url).toBeNull();
      expect(resetRes.body.data.footer_text).toBe('DigiSkwela · School Management System');
    });

    it('White-label retest: configured second-school identity & contact data survive branding reset without Calulut seal or DepEd endorsement', async () => {
      // Configure Sample Integrated School / SIS
      const patchRes = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', itAdminCookie)
        .send({
          schoolName: 'Sample Integrated School',
          schoolShortName: 'SIS',
          logoUrl: '/storage/branding/sample-logo.png',
          faviconUrl: '/storage/branding/sample-icon.png',
          address: '789 Education Boulevard, City Center',
          contactEmail: 'contact@sample-is.edu.ph',
          contactNumber: '(02) 8999-1234',
          footerText: 'Custom SIS Footer',
        });
      expect(patchRes.status).toBe(200);

      // Trigger Restore Default Branding
      const resetRes = await request(app)
        .post('/api/settings/school/reset')
        .set('Cookie', itAdminCookie);

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      const data = resetRes.body.data;
      // Institutional identity Still: Sample Integrated School SIS
      expect(data.school_name).toBe('Sample Integrated School');
      expect(data.school_short_name).toBe('SIS');

      // School contact data Still preserved
      expect(data.address).toBe('789 Education Boulevard, City Center');
      expect(data.contact_email).toBe('contact@sample-is.edu.ph');
      expect(data.contact_number).toBe('(02) 8999-1234');

      // Branding assets Must NOT become Calulut's school seal (must be null)
      expect(data.logo_url).toBeNull();
      expect(data.favicon_url).toBeNull();

      // Footer Must NOT claim DigiSkwela is an official DepEd platform
      expect(data.footer_text).toBe('DigiSkwela · School Management System');
      expect(data.footer_text).not.toContain('DepEd');

      // Verify public projection
      const publicRes = await request(app).get('/api/settings/school/public');
      expect(publicRes.status).toBe(200);
      const pubData = publicRes.body.data;
      expect(pubData.schoolName).toBe('Sample Integrated School');
      expect(pubData.schoolShortName).toBe('SIS');
      expect(pubData.logoUrl).toBeNull();
      expect(pubData.faviconUrl).toBeNull();
      expect(pubData.footerText).toBe('DigiSkwela · School Management System');
      expect(pubData.footerText).not.toContain('DepEd');

      // Ensure no Calulut branding leaked into reset
      const serialized = JSON.stringify(pubData);
      expect(serialized).not.toContain('/school_seal.png');
      expect(serialized).not.toContain('Calulut');
      expect(serialized).not.toContain('DepEd');
    });
  });

  describe('6. Singleton Enforcement', () => {
    it('Only one authoritative SchoolSettings record exists in the database', async () => {
      const allSettings = await (prisma as any).schoolSettings.findMany();
      expect(allSettings.length).toBe(1);
      expect(allSettings[0].id).toBe('default');
    });
  });

  describe('7. Asset Upload Security & Handling', () => {
    const VALID_PNG_BUFFER = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    it('Unauthenticated upload is rejected (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/settings/school/upload')
        .attach('file', VALID_PNG_BUFFER, 'logo.png');

      expect(res.status).toBe(401);
    });

    it('Standard Admin cannot upload branding assets (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/settings/school/upload')
        .set('Cookie', adminCookie)
        .attach('file', VALID_PNG_BUFFER, 'logo.png');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Upload without file is rejected (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/settings/school/upload')
        .set('Cookie', itAdminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('Disallowed file format (e.g. text/plain or executable script) is rejected (400 Bad Request)', async () => {
      const fakeExecutable = Buffer.from('console.log("malicious code")', 'utf-8');
      const res = await request(app)
        .post('/api/settings/school/upload')
        .set('Cookie', itAdminCookie)
        .field('assetType', 'logo')
        .attach('file', fakeExecutable, 'malicious.js');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('ITAdmin can upload a valid PNG logo (201 Created) and access it via /storage/branding', async () => {
      const res = await request(app)
        .post('/api/settings/school/upload')
        .set('Cookie', itAdminCookie)
        .field('assetType', 'logo')
        .attach('file', VALID_PNG_BUFFER, 'test_seal.png');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toMatch(/^\/storage\/branding\/branding_logo_/);
      expect(res.body.data.assetType).toBe('logo');

      // Verify the uploaded file is accessible via static endpoint
      const staticRes = await request(app).get(res.body.data.url);
      expect(staticRes.status).toBe(200);
      expect(staticRes.headers['content-type']).toMatch(/image\/png/);
    });
  });

  describe('8. White-Label Portability & Blank Contact Data Integrity', () => {
    it('Custom school configuration renders without any hardcoded Calulut/CINHS text in public projection', async () => {
      // Configure Sample Integrated School / SIS
      const patchRes = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', itAdminCookie)
        .send({
          schoolName: 'Sample Integrated School',
          schoolShortName: 'SIS',
          address: '456 Education Avenue, City Center',
          contactEmail: 'info@sample-is.edu.ph',
          contactNumber: '(02) 8123-4567',
        });
      expect(patchRes.status).toBe(200);

      // Verify public projection
      const publicRes = await request(app).get('/api/settings/school/public');
      expect(publicRes.status).toBe(200);
      const data = publicRes.body.data;

      expect(data.schoolName).toBe('Sample Integrated School');
      expect(data.schoolShortName).toBe('SIS');
      expect(data.address).toBe('456 Education Avenue, City Center');
      expect(data.contactEmail).toBe('info@sample-is.edu.ph');
      expect(data.contactNumber).toBe('(02) 8123-4567');

      // Crucial White-label check: Zero instances of "Calulut" in the response data payload
      const serializedData = JSON.stringify(data);
      expect(serializedData).not.toContain('Calulut');
      expect(serializedData).not.toContain('CINHS');
    });

    it('Blank/null contact fields do not cause server errors or produce "null"/"undefined" literals', async () => {
      // Set contact info to null
      const patchRes = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', itAdminCookie)
        .send({
          address: null,
          contactEmail: null,
          contactNumber: null,
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.address).toBeNull();
      expect(patchRes.body.data.contact_email).toBeNull();
      expect(patchRes.body.data.contact_number).toBeNull();

      // Check public endpoint
      const publicRes = await request(app).get('/api/settings/school/public');
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.data.address).toBeNull();
      expect(publicRes.body.data.contactEmail).toBeNull();
      expect(publicRes.body.data.contactNumber).toBeNull();

      // Ensure no string conversion produced literal string "null" or "undefined"
      expect(publicRes.body.data.address).not.toBe('null');
      expect(publicRes.body.data.address).not.toBe('undefined');
      expect(publicRes.body.data.contactEmail).not.toBe('null');
      expect(publicRes.body.data.contactNumber).not.toBe('null');
    });
  });
});

