import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { aiConfig, SCHOOL_NAME } from '../src/config/ai.config.js';
import { 
  decodeHTMLEntities, 
  stripChatbotFiller, 
  replaceRouteIds, 
  humanizeEnums, 
  cleanAwkwardLanguage, 
  normalizeAssistantText 
} from '../src/ai/utils/normalizeResponseText.js';

describe('DIGISKWELA — PRINCIPAL AI GLOBAL RESPONSE QUALITY & ARTIFACT REGRESSION SUITE', () => {
  let principalToken: string;
  let principalUserId: string;
  let originalProviderMode: any;

  beforeAll(async () => {
    originalProviderMode = aiConfig.providerMode;
    aiConfig.providerMode = 'mock';

    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId,
        email: `prin_qual_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'QualityValidator',
        status: 'active',
      },
    });

    const role = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (role) {
      await prisma.userRole.create({
        data: {
          user_id: principalUserId,
          role_id: role.id,
        },
      });
    }

    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '8h' });
  });

  afterAll(async () => {
    aiConfig.providerMode = originalProviderMode;
    await prisma.aIAuditLog.deleteMany({ where: { user_id: principalUserId } });
    await prisma.userRole.deleteMany({ where: { user_id: principalUserId } });
    await prisma.user.deleteMany({ where: { id: principalUserId } });
  });

  // ─── 1. Unit Normalizer Invariants ─────────────────────────────────────
  it('TC-QUAL-01: HTML entity decoding properly converts hex, decimal, and named entities', () => {
    expect(decodeHTMLEntities('&#x45;&#x78;&#x65;&#x63;&#x75;&#x74;&#x69;&#x76;&#x65;')).toBe('Executive');
    expect(decodeHTMLEntities('&#65;&#116;&#116;&#101;&#110;&#100;&#97;&#110;&#99;&#101;')).toBe('Attendance');
    expect(decodeHTMLEntities('Faculty &amp; Staff &lt;Summary&gt; &quot;CIS&quot; &#39;Notes&#39;')).toBe('Faculty & Staff <Summary> "CIS" \'Notes\'');
  });

  it('TC-QUAL-02: Route ID normalizer converts internal routes and non-breaking hyphens to human titles', () => {
    expect(replaceRouteIds('Navigate to p-monitoring to review scans.')).toBe('open Gate Attendance Monitoring to review scans.');
    expect(replaceRouteIds('Go to p-leaves dashboard.')).toBe('open Leave Management.');
    expect(replaceRouteIds('See details in (see Leave Management → p-leaves).')).toBe('See details in (see Leave Management).');
    expect(replaceRouteIds('See details in (see p-behavior).')).toBe('See details in (see Behavioral Reports).');
    // Non-breaking hyphen: p‑monitoring (unicode \u2011)
    expect(replaceRouteIds('Open p\u2011monitoring.')).toBe('Open Gate Attendance Monitoring.');
  });

  it('TC-QUAL-03: Enum normalizer replaces raw backend enums with readable phrases', () => {
    expect(humanizeEnums('Status is partial_terms with TIME_OUT_PENDING records.')).toBe('Status is partial terms with time-out pending records.');
    expect(humanizeEnums('Faculty count with NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND')).toBe('Faculty count with no gate check-in recorded and no approved leave found');
  });

  it('TC-QUAL-04: Chatbot filler stripper removes generic openings and closings', () => {
    expect(stripChatbotFiller('Sure! Here is the attendance report.')).toBe('Here is the attendance report.');
    expect(stripChatbotFiller('Certainly! Two requests are pending.')).toBe('Two requests are pending.');
    expect(stripChatbotFiller('Of course! The case is open.')).toBe('The case is open.');
    expect(stripChatbotFiller('Yes—we have 1 pending item.')).toBe('we have 1 pending item.');
    expect(stripChatbotFiller('Great question! All data is synced.')).toBe('All data is synced.');
    expect(stripChatbotFiller('Here is the summary. Let me know if you need anything else!')).toBe('Here is the summary.');
    expect(stripChatbotFiller('Here is the summary. Feel free to ask any other questions.')).toBe('Here is the summary.');
  });

  it('TC-QUAL-05: Awkward language cleaner removes (none) narrations and softens prescriptiveness', () => {
    expect(cleanAwkwardLanguage('All other faculty (none) have completed check-ins.')).toBe('');
    expect(cleanAwkwardLanguage('Approve the pending leave request immediately.')).toBe('Review the pending leave request immediately.');
    expect(cleanAwkwardLanguage('Take disciplinary action against the student.')).toBe('Review the behavior case against the student.');
    expect(cleanAwkwardLanguage('Refer the student to Guidance.')).toBe('Review Guidance counseling options.');
    expect(cleanAwkwardLanguage('Unexcused absence recorded today.')).toBe('No gate check-in recorded and no approved leave found recorded today.');
  });

  it('TC-QUAL-06: System Help handles general feature inquiry without menu dump', () => {
    expect(normalizeAssistantText('Help me find or understand a DigiSkwela feature.')).toBe('Which DigiSkwela feature do you need help with?');
    expect(normalizeAssistantText('Sure! Which DigiSkwela feature would you like to locate or learn more about—e.g., Gate Attendance Monitoring, Leave Management, etc.?')).toBe('Which DigiSkwela feature do you need help with?');
  });

  it('TC-QUAL-07: Structured report deduplication condenses meeting brief and weekly report narratives', () => {
    const rawBriefNarrative = '## Faculty Meeting Brief\n\n### Operational Highlights\n* 1 leave pending\n\n### Discussion\n* Discuss grades';
    const normalizedBrief = normalizeAssistantText(rawBriefNarrative, {
      hasStructuredData: true,
      toolName: 'generatePrincipalMeetingBrief',
    });
    expect(normalizedBrief).toBe('Here is your executive faculty meeting brief compiled from authoritative school records.');
    expect(normalizedBrief).not.toContain('##');
    expect(normalizedBrief).not.toContain('Operational Highlights');

    const rawWeeklyNarrative = '# Weekly Operations Report\n\n* Enrolled: 1200\n* Checked-in: 45';
    const normalizedWeekly = normalizeAssistantText(rawWeeklyNarrative, {
      hasStructuredData: true,
      toolName: 'generateWeeklyOperationsReport',
    });
    expect(normalizedWeekly).toBe(`Here is the weekly operations summary report for ${SCHOOL_NAME}.`);
  });

  // ─── 2. Integration Tests Across Core Live Matrix ───────────────────────
  it('TC-QUAL-08: Needs Attention response contains zero raw artifacts or route codes', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'What needs my review today?' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    const content = res.body.data.message.content;
    expect(content).not.toMatch(/p-monitoring|p-leaves|p-behavior|p-analytics/);
    expect(content).not.toMatch(/&#x[0-9a-fA-F]+;/);
    expect(content).not.toMatch(/svg/i);
    expect(content).not.toMatch(/\b(Sure|Certainly|Of course)\b/i);
  });

  it('TC-QUAL-09: System Help produces concise clarification without dumping all modules', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Help me find or understand a DigiSkwela feature.' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    const content = res.body.data.message.content;
    expect(content).toBe('Which DigiSkwela feature do you need help with?');
    expect(content).not.toMatch(/p-monitoring|p-leaves/);
  });

  it('TC-QUAL-10: Navigation query outputs human title and clean navigation button label without svg', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Where do I review faculty attendance?' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.message.content).toContain('Gate Attendance Monitoring');
    expect(data.message.content).not.toContain('p-monitoring');
    expect(data.navigationActions).toBeDefined();
    expect(data.navigationActions[0].label).toBe('Open Gate Attendance Monitoring');
    expect(data.navigationActions[0].label).not.toMatch(/svg/i);
  });

  it('TC-QUAL-11: Prepare Meeting returns deduplicated narrative and structured cards', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Prepare me for my next faculty meeting.' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.structuredData).toBeDefined();
    expect(data.structuredData.type).toBe('meeting_brief');
    // Narrative is concise executive intro, not duplicated report body
    expect(data.message.content).toBe('Here is your executive faculty meeting brief compiled from authoritative school records.');
    expect(data.message.content).not.toMatch(/&#x/);
  });

  it('TC-QUAL-12: Cross-check Attendance preserves neutral semantics and eliminates raw enums', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Check faculty gate records against approved leaves.' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    const content = res.body.data.message.content;
    expect(content).not.toMatch(/\b(AWOL|Late|Undertime|Absent|Unexcused)\b/i);
    expect(content).not.toMatch(/NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND/);
    expect(content).not.toMatch(/\(none\)/i);
  });

  it('TC-QUAL-13: Courtesy "Thank you!" responds with brief professional acknowledgement', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Thank you!' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.message.content).toBe('You’re welcome.');
  });
});
