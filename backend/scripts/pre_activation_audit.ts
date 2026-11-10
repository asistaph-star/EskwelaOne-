import prisma from '../src/config/database.js';
import crypto from 'crypto';
import https from 'https';

function requestBrevo(endpoint: string, apiKey: string): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://api.brevo.com${endpoint}`,
      {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          'accept': 'application/json'
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 0, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode || 0, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== DIGISKWELA: PRE-ACTIVATION COMPREHENSIVE AUDIT ===\n');

  // 1. Confirm database
  const dbNameResult = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  const currentDb = dbNameResult[0].current_database;
  console.log(`[CHECK 1] Database: ${currentDb}`);
  if (currentDb !== 'digiskwela_acceptance') {
    throw new Error(`CRITICAL ABORT: Expected digiskwela_acceptance, got ${currentDb}`);
  }

  // 2. Confirm the 3 historical HTTP 401 records remain FAILED
  const targetIds = [
    '01a1b999-d07d-73cc-bc7f-542449ef6c51',
    '01a1b999-d853-73ee-81ba-fed7baf6195a',
    '01a1b99d-a7ba-72f6-a6ba-636171d35047'
  ];

  console.log(`\n[CHECK 2] Verifying 3 historical HTTP 401 notification records remain FAILED...`);
  const historical = await prisma.gateAttendanceNotification.findMany({
    where: { id: { in: targetIds } }
  });
  if (historical.length !== 3) {
    throw new Error(`CRITICAL: Found ${historical.length} records instead of 3`);
  }
  for (const h of historical) {
    console.log(`- ${h.id}: status=${h.status}, attempts=${h.attempt_count}, error=${h.error_message?.slice(0, 50)}...`);
    if (h.status !== 'FAILED') {
      throw new Error(`CRITICAL: Record ${h.id} is not FAILED: status=${h.status}`);
    }
  }
  console.log('✓ All 3 historical records are confirmed FAILED and cannot be replayed by worker.');

  // 3. Confirm zero PENDING or PROCESSING notifications
  const backlog = await prisma.gateAttendanceNotification.count({
    where: { status: { in: ['PENDING', 'PROCESSING'] } }
  });
  console.log(`\n[CHECK 3] Outbox Backlog (PENDING + PROCESSING): ${backlog}`);
  if (backlog !== 0) {
    throw new Error(`CRITICAL: Outbox has backlog of ${backlog} items!`);
  }
  console.log('✓ Outbox is completely clean (0 pending, 0 processing).');

  // 4. Re-audit ALL currently authorized guardian recipients
  console.log(`\n[CHECK 4] Auditing all authorized guardian contacts in digiskwela_acceptance...`);
  const authorizations = await prisma.$queryRaw<Array<{
    id: string;
    student_id: string;
    guardian_email: string;
    guardian_name: string | null;
    status: string;
    verification_method: string | null;
    updated_at: Date;
  }>>`
    SELECT id, student_id, guardian_email, guardian_name, status, verification_method, updated_at
    FROM public.guardian_contact_authorizations
    WHERE status = 'AUTHORIZED'
    ORDER BY updated_at DESC
  `;

  console.log(`Total AUTHORIZED guardian contact rows: ${authorizations.length}`);
  for (const a of authorizations) {
    const student = await prisma.student.findUnique({
      where: { id: a.student_id },
      select: { lrn: true, first_name: true, last_name: true, guardian_email: true }
    });
    console.log(`- Student: ${student ? `${student.first_name} ${student.last_name} (LRN: ${student.lrn})` : a.student_id}`);
    console.log(`  Auth Record Email:    ${a.guardian_email}`);
    console.log(`  Student Record Email: ${student?.guardian_email}`);
    console.log(`  Verification Method:  ${a.verification_method}`);
    console.log(`  Updated At:           ${a.updated_at ? new Date(a.updated_at).toISOString() : 'N/A'}`);
  }

  // 5. Confirm replacement Brevo key authentication
  console.log(`\n[CHECK 5] Confirming Brevo key authentication via non-sending REST probe...`);
  const apiKey = process.env.BREVO_API_KEY || '';
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  console.log(`- Active Key Fingerprint: ${hash.slice(0, 16)}... (Safe suffix: ...${apiKey.slice(-6)})`);

  if (!hash.startsWith('01e51e16f6f920fd')) {
    throw new Error(`CRITICAL: Active key is not the valid replacement key! Fingerprint: ${hash}`);
  }

  const templatesRes = await requestBrevo('/v3/smtp/templates', apiKey);
  if (templatesRes.statusCode !== 200) {
    throw new Error(`CRITICAL: Brevo API authentication failed: HTTP ${templatesRes.statusCode}`);
  }
  console.log(`- GET /v3/smtp/templates returned HTTP ${templatesRes.statusCode} OK.`);
  console.log('✓ Brevo key is authenticated and active.');

  console.log('\n=== PRE-ACTIVATION AUDIT: 100% PASS ===');
}

main()
  .catch(e => {
    console.error('PRE-ACTIVATION AUDIT FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
