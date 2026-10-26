/**
 * Provision and Initialize Dedicated Test Database (digiskwela_test).
 * 
 * Safety Rules:
 * 1. Connects using administrative credentials from .env to provision the test database.
 * 2. Checks if `digiskwela_test` exists before creating.
 * 3. Never touches or mutates the existing `digiskwela` database records.
 * 4. Configures dedicated `digiskwela_test_user` role with restricted privileges.
 * 5. Explicitly revokes connection and schema access to `digiskwela` from `digiskwela_test_user`.
 * 6. Deploys Prisma schema and canonical baseline seed into `digiskwela_test`.
 * 7. Writes `.env.test` for test runners.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { findPostgresBinary, parseDatabaseUrl } from '../src/backup/backup.service.js';

const execFileAsync = promisify(execFile);

async function executePsql(
  host: string,
  port: number,
  user: string,
  password: string,
  targetDb: string,
  sqlCommand: string
): Promise<string> {
  const psqlBin = findPostgresBinary('psql');
  const args = [
    '--host', host,
    '--port', port.toString(),
    '--username', user,
    '--dbname', targetDb,
    '-t',
    '-A',
    '-c', sqlCommand,
  ];

  const env = {
    ...process.env,
    PGPASSWORD: password,
  };

  const { stdout } = await execFileAsync(psqlBin, args, { env });
  return stdout;
}

async function main() {
  console.log('============================================================');
  console.log('DIGISKWELA — DEDICATED TEST DATABASE SETUP');
  console.log('============================================================');

  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('backend/.env not found.');
  }

  const rawEnv = fs.readFileSync(envPath, 'utf-8');
  const dbUrlMatch = rawEnv.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (!dbUrlMatch) {
    throw new Error('DATABASE_URL not found in backend/.env');
  }

  const adminDbUrl = dbUrlMatch[1];
  const creds = parseDatabaseUrl(adminDbUrl);

  const testDbName = 'digiskwela_test';
  const testUserName = 'digiskwela_test_user';

  // Generate or read test user password from existing .env.test if present
  let testUserPassword = crypto.randomBytes(24).toString('base64url');
  const envTestPath = path.resolve(process.cwd(), '.env.test');
  if (fs.existsSync(envTestPath)) {
    const existingEnvTest = fs.readFileSync(envTestPath, 'utf-8');
    const existingMatch = existingEnvTest.match(/DATABASE_URL=["']?postgresql:\/\/[^:]+:([^@]+)@/);
    if (existingMatch) {
      testUserPassword = existingMatch[1];
    }
  }

  console.log(`[1/6] Inspecting PostgreSQL server at ${creds.host}:${creds.port}...`);
  const checkDbSql = `SELECT count(*)::int as count FROM pg_database WHERE datname = '${testDbName}';`;
  const dbCheckOut = await executePsql(creds.host, creds.port, creds.user, creds.password || '', 'postgres', checkDbSql);
  const dbExists = dbCheckOut.trim() === '1';

  if (!dbExists) {
    console.log(`[2/6] Creating fresh dedicated test database "${testDbName}"...`);
    await executePsql(creds.host, creds.port, creds.user, creds.password || '', 'postgres', `CREATE DATABASE "${testDbName}";`);
  } else {
    console.log(`[2/6] Dedicated test database "${testDbName}" already exists.`);
  }

  console.log(`[3/6] Configuring pgcrypto extension on "${testDbName}"...`);
  await executePsql(creds.host, creds.port, creds.user, creds.password || '', testDbName, 'CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  console.log(`[4/6] Provisioning dedicated role "${testUserName}" and setting strict privilege boundaries...`);
  const checkRoleSql = `SELECT count(*)::int as count FROM pg_roles WHERE rolname = '${testUserName}';`;
  const roleCheckOut = await executePsql(creds.host, creds.port, creds.user, creds.password || '', 'postgres', checkRoleSql);
  const roleExists = roleCheckOut.trim() === '1';

  if (!roleExists) {
    await executePsql(
      creds.host,
      creds.port,
      creds.user,
      creds.password || '',
      'postgres',
      `CREATE ROLE "${testUserName}" WITH LOGIN PASSWORD '${testUserPassword}';`
    );
  } else {
    await executePsql(
      creds.host,
      creds.port,
      creds.user,
      creds.password || '',
      'postgres',
      `ALTER ROLE "${testUserName}" WITH PASSWORD '${testUserPassword}';`
    );
  }

  // Grant privileges on test database
  await executePsql(
    creds.host,
    creds.port,
    creds.user,
    creds.password || '',
    'postgres',
    `GRANT CONNECT, TEMPORARY ON DATABASE "${testDbName}" TO "${testUserName}";`
  );
  await executePsql(
    creds.host,
    creds.port,
    creds.user,
    creds.password || '',
    testDbName,
    `GRANT ALL ON SCHEMA public TO "${testUserName}"; ALTER SCHEMA public OWNER TO "${testUserName}";`
  );

  // STRICT ISOLATION: Revoke CONNECT on development database from PUBLIC and explicitly grant only to admin user
  await executePsql(
    creds.host,
    creds.port,
    creds.user,
    creds.password || '',
    'postgres',
    `REVOKE CONNECT ON DATABASE "digiskwela" FROM PUBLIC; GRANT CONNECT ON DATABASE "digiskwela" TO "${creds.user}"; REVOKE ALL ON DATABASE "digiskwela" FROM "${testUserName}";`
  );

  console.log(`[5/6] Writing .env.test configuration...`);
  const testDbUrl = `postgresql://${testUserName}:${testUserPassword}@${creds.host}:${creds.port}/${testDbName}?schema=public`;

  const envTestContent = `# ============================================================
# DigiSkwela Backend — Dedicated Automated Test Configuration
# Target Database: digiskwela_test (Isolated from development/production)
# ============================================================

DATABASE_URL="${testDbUrl}"
TEST_DATABASE_URL="${testDbUrl}"

# --- Authentication ---
JWT_SECRET="test_suite_jwt_secret_key_min_32_chars_ok"
JWT_EXPIRES_IN="1h"

# --- Server & Environment ---
PORT=4001
CORS_ORIGIN="http://localhost:5173"
NODE_ENV="test"
`;

  fs.writeFileSync(envTestPath, envTestContent, 'utf-8');

  console.log(`[6/6] Deploying Prisma schema to "${testDbName}"...`);
  const prismaBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  await execFileAsync(
    prismaBin,
    ['prisma', 'db', 'push', '--skip-generate'],
    {
      shell: true,
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
      },
    }
  );

  console.log(`[SEED] Seeding canonical roles, permissions and school settings to "${testDbName}"...`);
  await execFileAsync(
    prismaBin,
    ['tsx', 'prisma/seed.ts'],
    {
      shell: true,
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
      },
    }
  );

  console.log(`[SEED] Seeding canonical demo accounts and test fixtures to "${testDbName}"...`);
  await execFileAsync(
    prismaBin,
    ['tsx', 'seed_demo_accounts.ts'],
    {
      shell: true,
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
      },
    }
  );

  console.log('✓ Dedicated test database setup completed successfully.');
}

main().catch(err => {
  console.error('[FATAL_ERROR_SETTING_UP_TEST_DB]', err);
  process.exit(1);
});
