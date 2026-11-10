import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { findPostgresBinary, parseDatabaseUrl, DatabaseCredentials } from '../src/backup/backup.service.js';

const execFileAsync = promisify(execFile);

async function runPsql(creds: DatabaseCredentials, dbName: string, sql: string) {
  const psqlBin = findPostgresBinary('psql');
  const args = [
    '--host', creds.host,
    '--port', creds.port.toString(),
    '--username', creds.user,
    '--dbname', dbName,
    '-c', sql,
  ];
  const env = { ...process.env, PGPASSWORD: creds.password || 'admin123' };
  const { stdout } = await execFileAsync(psqlBin, args, { env });
  return stdout;
}

async function main() {
  const creds: DatabaseCredentials = {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'admin123',
    database: 'postgres',
  };

  const targetDb = 'digiskwela_sf9_dev';
  const sourceDb = 'digiskwela_current_test';

  console.log(`Checking databases on ${creds.host}:${creds.port}...`);
  const listSql = "SELECT datname FROM pg_database WHERE datname LIKE 'digiskwela%';";
  const listOutput = await runPsql(creds, 'postgres', listSql);
  console.log(listOutput);

  if (listOutput.includes(targetDb)) {
    console.log(`Dropping existing ${targetDb} to ensure a pristine clone...`);
    await runPsql(creds, 'postgres', `DROP DATABASE ${targetDb} WITH (FORCE);`);
  }

  console.log(`Creating database ${targetDb}...`);
  let templateSuccess = false;
  try {
    console.log(`Attempting CREATE DATABASE ${targetDb} WITH TEMPLATE ${sourceDb}...`);
    await runPsql(creds, 'postgres', `CREATE DATABASE ${targetDb} WITH TEMPLATE ${sourceDb} OWNER postgres;`);
    console.log(`Successfully created ${targetDb} via template!`);
    templateSuccess = true;
  } catch (err: any) {
    console.warn(`Template creation failed (expected if live connections exist): ${err.message}`);
  }

  if (!templateSuccess) {
    console.log(`Creating empty ${targetDb} and dumping from ${sourceDb}...`);
    await runPsql(creds, 'postgres', `CREATE DATABASE ${targetDb} OWNER postgres;`);
    
    const dumpPath = path.join(process.cwd(), 'temp_dump_dev.sql');
    const pgDumpBin = findPostgresBinary('pg_dump');
    const psqlBin = findPostgresBinary('psql');
    const env = { ...process.env, PGPASSWORD: creds.password };

    console.log(`Dumping ${sourceDb} to ${dumpPath}...`);
    await execFileAsync(pgDumpBin, [
      '--host', creds.host,
      '--port', creds.port.toString(),
      '--username', creds.user,
      '--dbname', sourceDb,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--file', dumpPath,
    ], { env });

    console.log(`Restoring dump into ${targetDb}...`);
    await execFileAsync(psqlBin, [
      '--host', creds.host,
      '--port', creds.port.toString(),
      '--username', creds.user,
      '--dbname', targetDb,
      '--file', dumpPath,
    ], { env });

    if (fs.existsSync(dumpPath)) {
      fs.unlinkSync(dumpPath);
    }
    console.log(`Successfully cloned ${sourceDb} into ${targetDb} via pg_dump/psql!`);
  }

  // Quick verification
  const tableCheck = await runPsql(creds, targetDb, "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';");
  console.log(`Verification: Table count in ${targetDb}:`, tableCheck.trim());
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
