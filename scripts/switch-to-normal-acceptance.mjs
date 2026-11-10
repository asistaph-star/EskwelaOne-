import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(rootDir, 'backend');

console.log('=== SWITCHING TO: NORMAL ACCEPTANCE ENVIRONMENT (digiskwela_acceptance) ===');

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

// 2. Start backend in normal acceptance mode (no APP_ENV, loads .env -> digiskwela_acceptance)
console.log('Starting backend on port 4000 with digiskwela_acceptance...');
const startCmd = `cmd /c "cd /d ${backendDir} && start /B node node_modules\\tsx\\dist\\cli.mjs src/server.ts"`;
execSync(startCmd);

console.log('✓ Normal Acceptance Backend started on http://localhost:4000');
console.log('  Database: digiskwela_acceptance');
console.log('  Email sending: MOCK / DISABLED');
console.log('  Frontend accessible at: http://localhost:5173');

