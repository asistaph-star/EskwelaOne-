import { execFile } from 'child_process';
import { promisify } from 'util';
import { findPostgresBinary } from '../src/backup/backup.service.js';

const execFileAsync = promisify(execFile);

async function main() {
  const psqlBin = findPostgresBinary('psql');
  const sql = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'terms' AND column_name = 'is_grades_visible_to_students'
      ) THEN
        ALTER TABLE terms ADD COLUMN is_grades_visible_to_students BOOLEAN NOT NULL DEFAULT true;
      END IF;
    END
    $$;
  `;
  const env = { ...process.env, PGPASSWORD: 'admin123' };
  const { stdout } = await execFileAsync(psqlBin, [
    '--host', 'localhost',
    '--port', '5432',
    '--username', 'postgres',
    '--dbname', 'digiskwela_sf9_dev',
    '-c', sql,
  ], { env });
  console.log('Migration output:', stdout || 'SUCCESS');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
