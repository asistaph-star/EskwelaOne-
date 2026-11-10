import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { resetAuthRateLimiter } from '../src/auth/auth.limiter.js';
import {
  DEFAULT_SCHOOL_SETTINGS,
  AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS,
} from '../src/settings/settings.service.js';

describe('DIGISKWELA — School Customization Reset to Authoritative Defaults Regression Suite', () => {
  let itAdminCookie: string;
  let baselineStudentCount: number;
  let baselineSectionCount: number;
  let baselineGateAttendanceCount: number;

  beforeAll(async () => {
    resetAuthRateLimiter();

    // Baseline audit of core academic data to verify zero contamination
    baselineStudentCount = await prisma.student.count();
    baselineSectionCount = await (prisma as any).section.count();
    baselineGateAttendanceCount = await (prisma as any).gateAttendance.count();

    // ITAdmin authentication
    const itLogin = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'IT-001', password: 'password123' });
    expect(itLogin.status).toBe(200);
    const itCookies = itLogin.headers['set-cookie'] as string[];
    itAdminCookie = itCookies.find(c => c.startsWith('auth_token='))!;
  });

  afterAll(async () => {
    resetAuthRateLimiter();
    // Ensure database is in canonical state after tests
    await (prisma as any).schoolSettings.upsert({
      where: { id: 'default' },
      update: DEFAULT_SCHOOL_SETTINGS,
      create: DEFAULT_SCHOOL_SETTINGS,
    });
    await prisma.$disconnect();
  });

  it('TEST A: Customizing school name to "Matulong High School" and resetting restores "Calulut Integrated School" and "CIS"', async () => {
    // 1. Customize to Matulong High School
    const patchRes = await request(app)
      .patch('/api/settings/school')
      .set('Cookie', itAdminCookie)
      .send({
        schoolName: 'Matulong High School',
        schoolShortName: 'MHS',
        address: 'Matulong, City of San Fernando, Pampanga',
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.school_name).toBe('Matulong High School');
    expect(patchRes.body.data.school_short_name).toBe('MHS');

    // 2. Invoke Reset to Default
    const resetRes = await request(app)
      .post('/api/settings/school/reset')
      .set('Cookie', itAdminCookie);

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // 3. Verify authoritative restoration
    expect(resetRes.body.data.school_name).toBe('Calulut Integrated School');
    expect(resetRes.body.data.school_short_name).toBe('CIS');
    expect(resetRes.body.data.schoolName).toBe('Calulut Integrated School');
    expect(resetRes.body.data.schoolShortName).toBe('CIS');
    expect(resetRes.body.data.logo_url).toBe('/school_seal.png');
    expect(resetRes.body.data.logoUrl).toBe('/school_seal.png');
    expect(resetRes.body.data.school_id).toBe('500146');

    // 4. Verify in PostgreSQL directly
    const dbRecord = await (prisma as any).schoolSettings.findUnique({
      where: { id: 'default' },
    });
    expect(dbRecord.school_name).toBe('Calulut Integrated School');
    expect(dbRecord.school_short_name).toBe('CIS');
    expect(dbRecord.logo_url).toBe('/school_seal.png');
  });

  it('TEST B: Customizing logo URL and colors and resetting restores official school seal and canonical palette', async () => {
    // 1. Customize logo and colors
    const patchRes = await request(app)
      .patch('/api/settings/school')
      .set('Cookie', itAdminCookie)
      .send({
        logoUrl: '/storage/branding/branding_logo_custom_test123.png',
        faviconUrl: '/storage/branding/branding_favicon_custom_test123.png',
        primaryColor: '#8B0000',
        secondaryColor: '#FF4500',
        accentColor: '#FFD700',
        loginWelcomeText: 'Customized Portal Banner Text',
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.logo_url).toBe('/storage/branding/branding_logo_custom_test123.png');
    expect(patchRes.body.data.primary_color).toBe('#8B0000');

    // 2. Invoke Reset to Default
    const resetRes = await request(app)
      .post('/api/settings/school/reset')
      .set('Cookie', itAdminCookie);

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // 3. Verify logo and colors restored
    expect(resetRes.body.data.logo_url).toBe('/school_seal.png');
    expect(resetRes.body.data.logoUrl).toBe('/school_seal.png');
    expect(resetRes.body.data.favicon_url).toBe('/school_seal.png');
    expect(resetRes.body.data.faviconUrl).toBe('/school_seal.png');
    expect(resetRes.body.data.primary_color).toBe('#0A192F');
    expect(resetRes.body.data.secondary_color).toBe('#1B3A6B');
    expect(resetRes.body.data.accent_color).toBe('#F5A623');
    expect(resetRes.body.data.login_welcome_text).toBe('Education Shapes the Future');
  });

  it('TEST C: Repeated customization and reset cycles (3 cycles) execute cleanly without regression or leakage', async () => {
    const testCases = [
      { name: 'Pampanga National High School', shortName: 'PNHS', logo: '/storage/test_pnhs.png' },
      { name: 'San Fernando Science High School', shortName: 'SFSHS', logo: '/storage/test_sfshs.png' },
      { name: 'Sindalan Elementary School', shortName: 'SES', logo: '/storage/test_ses.png' },
    ];

    for (const tc of testCases) {
      // Customize
      const patch = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', itAdminCookie)
        .send({
          schoolName: tc.name,
          schoolShortName: tc.shortName,
          logoUrl: tc.logo,
        });
      expect(patch.status).toBe(200);
      expect(patch.body.data.school_name).toBe(tc.name);

      // Reset
      const reset = await request(app)
        .post('/api/settings/school/reset')
        .set('Cookie', itAdminCookie);
      expect(reset.status).toBe(200);
      expect(reset.body.data.school_name).toBe('Calulut Integrated School');
      expect(reset.body.data.school_short_name).toBe('CIS');
      expect(reset.body.data.logo_url).toBe('/school_seal.png');
      expect(reset.body.data.favicon_url).toBe('/school_seal.png');
    }
  });

  it('TEST D: Multi-session persistence: Public and Authenticated endpoints consistently return restored defaults', async () => {
    // 1. GET /api/settings/school/public
    const pubRes = await request(app).get('/api/settings/school/public');
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.success).toBe(true);
    expect(pubRes.body.data.schoolName).toBe('Calulut Integrated School');
    expect(pubRes.body.data.schoolShortName).toBe('CIS');
    expect(pubRes.body.data.logoUrl).toBe('/school_seal.png');
    expect(pubRes.body.data.faviconUrl).toBe('/school_seal.png');
    expect(pubRes.body.data.primaryColor).toBe('#0A192F');

    // 2. GET /api/settings/school (Authenticated)
    const authRes = await request(app)
      .get('/api/settings/school')
      .set('Cookie', itAdminCookie);
    expect(authRes.status).toBe(200);
    expect(authRes.body.success).toBe(true);
    expect(authRes.body.data.school_name).toBe('Calulut Integrated School');
    expect(authRes.body.data.school_short_name).toBe('CIS');
    expect(authRes.body.data.logo_url).toBe('/school_seal.png');
    expect(authRes.body.data.school_id).toBe('500146');
  });

  it('TEST E: Critical data safety: DepEd School ID 500146, students, sections, and attendance remain completely intact', async () => {
    // 1. DepEd School ID verification
    const settings = await (prisma as any).schoolSettings.findUnique({
      where: { id: 'default' },
    });
    expect(settings.school_id).toBe('500146');

    // 2. Academic data counts remain identical to baseline
    const currentStudentCount = await prisma.student.count();
    const currentSectionCount = await (prisma as any).section.count();
    const currentGateAttendanceCount = await (prisma as any).gateAttendance.count();

    expect(currentStudentCount).toBe(baselineStudentCount);
    expect(currentSectionCount).toBe(baselineSectionCount);
    expect(currentGateAttendanceCount).toBe(baselineGateAttendanceCount);

    // 3. Verify student records are queryable and intact
    const testStudent = await prisma.student.findFirst();
    expect(testStudent).not.toBeNull();
    expect(testStudent?.id).toBeDefined();
  });
});
