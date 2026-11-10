import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(rootDir, 'backend');

console.log('=== SWITCHING TO: ISOLATED BREVO PILOT ENVIRONMENT (digiskwela_phase2c_test) ===');

// 1. Kill any existing process on port 4000
try {
  const findCmd = `powershell -Command "(Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess"`;
  const pid = execSync(findCmd, { encoding: 'utf8' }).trim();
  if (pid) {
    console.log(`Stopping backend process on port 4000 (PID: ${pid})...`);
    execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
  }
} catch {
  // port was already free
}

// 2. Start backend in manual_uat mode (APP_ENV=manual_uat, loads .env.manual_uat -> digiskwela_phase2c_test)
console.log('Starting backend on port 4000 with digiskwela_phase2c_test...');
const startCmd = `cmd /c "set APP_ENV=manual_uat && cd /d ${backendDir} && start /B node node_modules\\tsx\\dist\\cli.mjs src/server.ts"`;
execSync(startCmd);

console.log('✓ Brevo Pilot Backend started on http://localhost:4000');
console.log('  Database: digiskwela_phase2c_test');
console.log('  Mode: GUARDIAN_ONLY');
console.log('  Frontend accessible at: http://localhost:5173');

