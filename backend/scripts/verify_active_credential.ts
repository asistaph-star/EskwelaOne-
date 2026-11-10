import '../src/config/env.js';
import crypto from 'crypto';
import https from 'https';
import prisma from '../src/config/database.js';

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
  console.log('=== DIGISKWELA: ACTIVE CREDENTIAL & CONFIGURATION VERIFICATION ===\n');

  // 1. Check environment variables loaded via application config
  const apiKey = process.env.BREVO_API_KEY || '';
  if (!apiKey) {
    throw new Error('CRITICAL: BREVO_API_KEY is not defined in process.env');
  }

  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const safePrefix = apiKey.slice(0, 15);
  const safeSuffix = apiKey.slice(-6);

  console.log('[CONFIG] Environment Resolution Check:');
  console.log(`- Loaded API Key Fingerprint (SHA-256): ${hash.slice(0, 16)}...`);
  console.log(`- Safe Pattern:                         ${safePrefix}...${safeSuffix}`);
  console.log(`- Key Length:                           ${apiKey.length} characters`);

  // Verify against known valid replacement key fingerprint
  const EXPECTED_VALID_HASH_PREFIX = '01e51e16f6f920fd';
  const REVOKED_KEY_HASH_PREFIX = 'd4116a5ee067cba7';

  if (hash.startsWith(REVOKED_KEY_HASH_PREFIX)) {
    throw new Error('CRITICAL SECURITY ERROR: Active key is the REVOKED original key!');
  }
  if (!hash.startsWith(EXPECTED_VALID_HASH_PREFIX)) {
    throw new Error(`CRITICAL ERROR: Active key fingerprint does not match valid replacement key! Found: ${hash}`);
  }
  console.log('✓ Credential matches valid restricted replacement key (not the revoked original).');

  // 2. Non-sending Brevo REST API verification
  console.log('\n[PROBE] Performing Non-Sending Brevo REST API Probes...');
  
  const templatesRes = await requestBrevo('/v3/smtp/templates', apiKey);
  console.log(`- GET /v3/smtp/templates: HTTP ${templatesRes.statusCode} (${templatesRes.statusCode === 200 ? 'OK - Valid Auth' : 'FAILED'})`);
  if (templatesRes.statusCode !== 200) {
    throw new Error(`Templates probe failed with status ${templatesRes.statusCode}: ${JSON.stringify(templatesRes.body)}`);
  }

  const reportsRes = await requestBrevo('/v3/smtp/statistics/reports', apiKey);
  console.log(`- GET /v3/smtp/statistics/reports: HTTP ${reportsRes.statusCode} (${reportsRes.statusCode === 200 ? 'OK - Valid Auth' : 'FAILED'})`);
  if (reportsRes.statusCode !== 200) {
    throw new Error(`Reports probe failed with status ${reportsRes.statusCode}: ${JSON.stringify(reportsRes.body)}`);
  }

  // Probe restricted scope (account endpoint should return 403 Forbidden for restricted key)
  const accountRes = await requestBrevo('/v3/account', apiKey);
  console.log(`- GET /v3/account: HTTP ${accountRes.statusCode} (${accountRes.statusCode === 403 ? 'Restricted Scope Enforced' : 'Unexpected status'})`);

  // 3. Dormant safeguard settings check
  console.log('\n[SAFEGUARDS] Verifying Dormant Live Sending Safeguards:');
  const emailProvider = process.env.EMAIL_PROVIDER;
  const gateEmailEnabled = process.env.GATE_EMAIL_ENABLED;
  const authMode = process.env.GATE_EMAIL_AUTHORIZATION_MODE;
  const recipientMode = process.env.GATE_EMAIL_RECIPIENT_MODE;
  const whitelist = process.env.AUTHORIZED_GATE_EMAIL_RECIPIENTS;

  console.log(`- EMAIL_PROVIDER:                 "${emailProvider}" (Expected: "mock")`);
  console.log(`- GATE_EMAIL_ENABLED:             "${gateEmailEnabled}" (Expected: "false")`);
  console.log(`- GATE_EMAIL_AUTHORIZATION_MODE:  "${authMode}" (Expected: "SCHOOL_AUTHORIZED")`);
  console.log(`- GATE_EMAIL_RECIPIENT_MODE:      "${recipientMode}" (Expected: "GUARDIAN_ONLY")`);
  console.log(`- AUTHORIZED_GATE_EMAIL_RECIPIENTS: "${whitelist}" (Expected: "" / empty)`);

  if (emailProvider !== 'mock') throw new Error(`Safeguard violation: EMAIL_PROVIDER is '${emailProvider}'`);
  if (gateEmailEnabled !== 'false') throw new Error(`Safeguard violation: GATE_EMAIL_ENABLED is '${gateEmailEnabled}'`);
  if (authMode !== 'SCHOOL_AUTHORIZED') throw new Error(`Safeguard violation: GATE_EMAIL_AUTHORIZATION_MODE is '${authMode}'`);
  if (recipientMode !== 'GUARDIAN_ONLY') throw new Error(`Safeguard violation: GATE_EMAIL_RECIPIENT_MODE is '${recipientMode}'`);
  if (whitelist && whitelist.trim() !== '') throw new Error(`Safeguard violation: AUTHORIZED_GATE_EMAIL_RECIPIENTS must be empty, got '${whitelist}'`);
  console.log('✓ All dormant safeguards verified.');

  // 4. Outbox backlog check in digiskwela_acceptance
  const dbNameResult = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  const currentDb = dbNameResult[0].current_database;
  console.log(`\n[DATABASE] Database: ${currentDb}`);
  if (currentDb !== 'digiskwela_acceptance') {
    throw new Error(`Database assertion failed: expected 'digiskwela_acceptance', got '${currentDb}'`);
  }

  const backlog = await prisma.gateAttendanceNotification.count({
    where: { status: { in: ['PENDING', 'PROCESSING'] } }
  });
  console.log(`- Outbox Backlog (PENDING + PROCESSING): ${backlog} (Expected: 0)`);
  if (backlog !== 0) {
    throw new Error(`Backlog assertion failed: expected 0, got ${backlog}`);
  }
  console.log('✓ Outbox is completely clean and ready.');

  console.log('\n=== ALL PRE-ACTIVATION VERIFICATIONS PASSED ===');
}

main()
  .catch(e => {
    console.error('VERIFICATION FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

