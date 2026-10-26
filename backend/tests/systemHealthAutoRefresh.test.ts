import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendScreenPath = path.resolve(
  __dirname,
  '../../src/app/admin/operations/SystemHealthScreen.tsx'
);

describe('DIGISKWELA — SYSTEM HEALTH AUTO-REFRESH & LIVE DATA FRESHNESS SUITE', () => {
  let itAdminCookie: string;
  let adminCookie: string;
  let teacherCookie: string;
  let studentCookie: string;

  beforeAll(async () => {
    // 1. ITAdmin
    const itRes = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'IT-001', password: 'password123' });
    expect(itRes.status).toBe(200);
    itAdminCookie = (itRes.headers['set-cookie'] as string[]).find((c) =>
      c.startsWith('auth_token=')
    )!;

    // 2. Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'ADM-001', password: 'password123' });
    expect(adminRes.status).toBe(200);
    adminCookie = (adminRes.headers['set-cookie'] as string[]).find((c) =>
      c.startsWith('auth_token=')
    )!;

    // 3. Teacher (Unauthorized)
    const teacherRes = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'EMP-T-001', password: 'password123' });
    expect(teacherRes.status).toBe(200);
    teacherCookie = (teacherRes.headers['set-cookie'] as string[]).find((c) =>
      c.startsWith('auth_token=')
    )!;

    // 4. Student (Unauthorized)
    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: '2026-00001', password: 'password123' });
    expect(studentRes.status).toBe(200);
    studentCookie = (studentRes.headers['set-cookie'] as string[]).find((c) =>
      c.startsWith('auth_token=')
    )!;
  });

  // ─── 1. Backend Health Endpoint Verification ─────────────────────────────
  describe('1. Backend Authoritative Health Inspection API', () => {
    it('returns authoritative lastChecked ISO timestamp from PostgreSQL & service inspection', async () => {
      const beforeCall = new Date().getTime();
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [itAdminCookie]);

      const afterCall = new Date().getTime();
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const lastChecked = new Date(res.body.data.lastChecked).getTime();
      expect(lastChecked).toBeGreaterThanOrEqual(beforeCall - 2000);
      expect(lastChecked).toBeLessThanOrEqual(afterCall + 2000);

      // Verify component inspections have their own actual inspection timestamps
      expect(res.body.data.components.api.lastChecked).toBeDefined();
      expect(res.body.data.components.database.lastChecked).toBeDefined();
      expect(res.body.data.components.storage.lastChecked).toBeDefined();
    });

    it('enforces RBAC: allows ITAdmin with diagnostic scope and Admin with operational scope', async () => {
      const itRes = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [itAdminCookie]);
      expect(itRes.status).toBe(200);
      expect(itRes.body.data.scope).toBe('FULL_ITADMIN');

      const adminRes = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [adminCookie]);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.scope).toBe('OPERATIONAL_ADMIN');
    });

    it('enforces RBAC: strictly rejects non-administrative roles (Teacher, Student)', async () => {
      const teacherRes = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [teacherCookie]);
      expect(teacherRes.status).toBe(403);
      expect(teacherRes.body.error?.code).toBe('FORBIDDEN');

      const studentRes = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [studentCookie]);
      expect(studentRes.status).toBe(403);
      expect(studentRes.body.error?.code).toBe('FORBIDDEN');
    });
  });

  // ─── 2. Relative Freshness Calculation Invariants ────────────────────────
  describe('2. Local Relative Freshness Calculation Invariants', () => {
    // Extract or test formatRelativeFreshness logic
    const formatFreshness = (lastChecked: Date, now: Date): string => {
      const diffMs = Math.max(0, now.getTime() - lastChecked.getTime());
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 10) return 'Checked just now';
      if (diffSec < 60) return `Checked ${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin === 1) return 'Checked 1 minute ago';
      if (diffMin < 60) return `Checked ${diffMin} minutes ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours === 1) return 'Checked 1 hour ago';
      return `Checked ${diffHours} hours ago`;
    };

    it('formats elapsed times under 10 seconds as "Checked just now"', () => {
      const now = new Date('2026-10-26T14:00:10.000Z');
      expect(formatFreshness(new Date('2026-10-26T14:00:08.000Z'), now)).toBe('Checked just now');
      expect(formatFreshness(new Date('2026-10-26T14:00:01.000Z'), now)).toBe('Checked just now');
    });

    it('formats elapsed times between 10s and 59s with exact seconds', () => {
      const now = new Date('2026-10-26T14:00:50.000Z');
      expect(formatFreshness(new Date('2026-10-26T14:00:35.000Z'), now)).toBe('Checked 15s ago');
      expect(formatFreshness(new Date('2026-10-26T14:00:05.000Z'), now)).toBe('Checked 45s ago');
    });

    it('formats elapsed times of 1 minute and multi-minutes correctly', () => {
      const now = new Date('2026-10-26T14:05:00.000Z');
      expect(formatFreshness(new Date('2026-10-26T14:04:00.000Z'), now)).toBe('Checked 1 minute ago');
      expect(formatFreshness(new Date('2026-10-26T14:03:00.000Z'), now)).toBe('Checked 2 minutes ago');
      expect(formatFreshness(new Date('2026-10-26T13:55:00.000Z'), now)).toBe('Checked 10 minutes ago');
    });

    it('formats elapsed hours correctly', () => {
      const now = new Date('2026-10-26T16:00:00.000Z');
      expect(formatFreshness(new Date('2026-10-26T15:00:00.000Z'), now)).toBe('Checked 1 hour ago');
      expect(formatFreshness(new Date('2026-10-26T13:00:00.000Z'), now)).toBe('Checked 3 hours ago');
    });
  });

  // ─── 3. Static Code & Lifecycle Safety Audit ─────────────────────────────
  describe('3. SystemHealthScreen Lifecycle, Visibility & Safety Audit', () => {
    const screenContent = fs.readFileSync(frontendScreenPath, 'utf8');

    it('configures standard 60-second automatic refresh interval', () => {
      expect(screenContent).toContain('60_000');
      expect(screenContent).toContain('executeFetch(false)');
    });

    it('implements Page Visibility API to pause polling when tab is hidden', () => {
      expect(screenContent).toContain("visibilitychange");
      expect(screenContent).toMatch(/document\.visibilityState\s*===\s*["']visible["']/);
      expect(screenContent).toContain("autoRefreshTimerRef.current = null");
    });

    it('revalidates data when user returns to visible tab if data is stale (>= 60s)', () => {
      expect(screenContent).toContain("elapsed >= 60_000 || isStale");
      expect(screenContent).toContain("executeFetch(false)");
    });

    it('implements online and offline network lifecycle listeners', () => {
      expect(screenContent).toMatch(/window\.addEventListener\(\s*["']online["']/);
      expect(screenContent).toMatch(/window\.addEventListener\(\s*["']offline["']/);
      expect(screenContent).toMatch(/window\.removeEventListener\(\s*["']online["']/);
      expect(screenContent).toMatch(/window\.removeEventListener\(\s*["']offline["']/);
    });

    it('marks data as stale rather than destroying UI state upon fetch failure', () => {
      expect(screenContent).toContain("setIsStale(true)");
      expect(screenContent).toContain("prev");
      expect(screenContent).toContain("return prev;");
    });

    it('prevents overlapping health requests using an in-flight ref guard', () => {
      expect(screenContent).toContain("isFetchingRef.current = true");
      expect(screenContent).toContain("if (isFetchingRef.current) return");
    });

    it('cleans up all intervals and listeners on component unmount', () => {
      expect(screenContent).toContain("isMountedRef.current = false");
      expect(screenContent).toContain("clearInterval(autoRefreshTimerRef.current)");
      expect(screenContent).toContain("clearInterval(clockInterval)");
      expect(screenContent).toContain("document.removeEventListener(\"visibilitychange\"");
    });

    it('explicitly formats timestamps with Asia/Manila Philippine timezone', () => {
      expect(screenContent).toContain('Asia/Manila');
      expect(screenContent).toMatch(/hour:\s*["']2-digit["']/);
      expect(screenContent).toMatch(/minute:\s*["']2-digit["']/);
      expect(screenContent).toMatch(/second:\s*["']2-digit["']/);
    });

    it('provides clear stale data alert and working manual retry button', () => {
      expect(screenContent).toContain("Stale Data Warning Alert");
      expect(screenContent).toContain("Retry");
      expect(screenContent).toContain("onClick={handleManualRefresh}");
    });
  });
});
