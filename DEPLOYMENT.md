# DIGISKWELA — PRODUCTION DEPLOYMENT & HOSTING GUIDE

**Institution:** Calulut Integrated School  
**Academic System:** DepEd Trimester Academic Calendar (SY 2026–2027)  
**System Architecture:** Thin-Client SaaS Web Application  

---

## 1. ARCHITECTURAL OVERVIEW & CLIENT/SERVER MODEL

DigiSkwela is designed as a **centralized thin-client enterprise school information system**:

- **Central Backend Server (Host):**  
  Hosts the Node.js Express API, connects to PostgreSQL 17, executes headless LibreOffice Calc (`soffice`) for DepEd Form 9 (SF9) workbook compilation, and serves static frontend assets or communicates with the reverse proxy (Nginx).
- **Client Devices (Students, Teachers, Staff, Administrators):**  
  Access DigiSkwela strictly through standard web browsers (Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari).  
  > **IMPORTANT:** End-user client devices **DO NOT REQUIRE** LibreOffice, Node.js, or PostgreSQL. The browser receives pre-compiled standard PDF binary streams rendered on the server.

---

## 2. SYSTEM REQUIREMENTS

### 2.1 Supported Server Operating Systems
- **Linux (Recommended for Production):** Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, Debian 12, CentOS/RHEL 9.
- **Windows (Development & Self-Hosted On-Premise):** Windows 10/11 64-bit, Windows Server 2019/2022.

### 2.2 Runtimes & Dependencies
- **Node.js:** `v20.x LTS` or `v24.x` (Tested and verified on Node `v24.18.0`).
- **Package Manager:** `npm` (v10+ / v11+) or `pnpm`.
- **Database:** PostgreSQL `v16` or `v17` (Tested on PostgreSQL `17.0`).
- **Document Renderer:** LibreOffice Calc (`v7.6+` or `v24.x+`).

---

## 3. SERVER-SIDE SOFTWARE INSTALLATION

### 3.1 Linux (Ubuntu / Debian Server)
```bash
# 1. Update package index
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PostgreSQL 16/17
sudo apt install -y postgresql postgresql-contrib

# 4. Install Headless LibreOffice & Metric-Compatible Fonts
sudo apt install -y libreoffice-calc libreoffice-java-common fonts-dejavu-core fonts-crosextra-carlito fonts-crosextra-caladea
```

### 3.2 Windows Server / Windows Host
1. **Node.js:** Install the official 64-bit LTS installer from `https://nodejs.org/`.
2. **PostgreSQL:** Install PostgreSQL 17 from `https://www.postgresql.org/download/windows/`.
3. **LibreOffice:** Run the official Windows 64-bit MSI installer (`LibreOffice_x.x.x_Win_x86-64.msi`).  
   By default, it installs to:  
   `C:\Program Files\LibreOffice\program\soffice.exe`  
   *DigiSkwela automatically auto-detects this standard path.*

---

## 4. LIBREOFFICE DISCOVERY & CONFIGURATION

DigiSkwela's backend (`calulutSf9PdfRenderer.ts`) checks candidates in this exact order:

1. `process.env.LIBREOFFICE_BIN` (Explicit `.env` override)
2. `backend/tools/libreoffice/program/soffice.bin` (Project-local portable copy)
3. `backend/tools/libreoffice/program/soffice.exe` (Project-local portable copy)
4. `C:\Program Files\LibreOffice\program\soffice.bin`
5. `C:\Program Files\LibreOffice\program\soffice.exe` (Default 64-bit Windows installer)
6. `C:\Program Files (x86)\LibreOffice\program\soffice.bin`
7. `C:\Program Files (x86)\LibreOffice\program\soffice.exe` (Default 32-bit Windows installer)
8. `/usr/bin/soffice` (Default Ubuntu/Debian package manager)
9. `/usr/bin/libreoffice`
10. `/usr/local/bin/soffice`
11. `/Applications/LibreOffice.app/Contents/MacOS/soffice` (macOS)

### Custom Configuration (`.env`)
If LibreOffice is installed in a non-standard directory, define it in `DigiSkwela/backend/.env`:
```env
# Optional override if not in /usr/bin/soffice or C:\Program Files\LibreOffice
LIBREOFFICE_BIN="/opt/libreoffice24.8/program/soffice"
```

---

## 5. REQUIRED ASSETS & DIRECTORIES

### 5.1 Tracked Workbook Master Template
- **Path:** `backend/templates/sf9/master_template_sanitized.xlsx` (377,625 bytes)
- **Integrity Hash:** SHA-256 `df7745d5758ff60a9260e53904f49f2259de25478ba453307ea4fb2f5ab29c78`
- **Git Status:** Tracked in Git. Do not modify sheet names (`SF9 - GRADE 4-10`) or cell coordinate references.

### 5.2 Server File Storage & Temporary Directories
The backend creates isolated, per-job temporary render workspaces:
- `backend/tmp/sf9-render/jobs/` (Auto-created with mode `0o700`)
- `backend/tmp/uploads/` (Auto-created for media and identity documents)
- These directories are safely excluded from Git in `.gitignore`.

---

## 6. ENVIRONMENT VARIABLES & SECRETS

### 6.1 Backend (`backend/.env`)
```env
# Server
PORT=4000
NODE_ENV=production

# Database (PostgreSQL)
DATABASE_URL="postgresql://postgres:YOUR_SECURE_PASSWORD@localhost:5432/digiskwela_acceptance?schema=public"

# Security & Encryption (32-byte hexadecimal key for field encryption)
JWT_SECRET="YOUR_RANDOM_LONG_SECRET_KEY"
FIELD_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# Optional Renderer Overrides
# LIBREOFFICE_BIN="/usr/bin/soffice"
# SF9_RENDER_TIMEOUT_MS=45000
```

### 6.2 Frontend (`.env` or `.env.production`)
```env
VITE_API_BASE_URL="http://YOUR_SERVER_IP:4000/api"
```

---

## 7. BUILD & INITIALIZATION PROCEDURES

### Step 1: Install Dependencies
```bash
# In project root
npm install

# In backend directory
npm --prefix backend install
```

### Step 2: Run Database Migrations
```bash
npm --prefix backend run db:deploy
```

### Step 3: Seed Acceptance Environment (Clean Host Initialization)
```bash
node scripts/seed_acceptance_environment.cjs
```
*Seeds SchoolSettings (Calulut Integrated School), 11-month SF2 attendance calendars, class sections, subjects, staff accounts, and enrolled student cohorts.*

### Step 4: Build Backend & Frontend
```bash
# Compile backend TypeScript into dist/
npm --prefix backend run build

# Compile frontend Vite bundle into dist/
npm run build
```

---

## 8. PRODUCTION STARTUP

### Starting the Services:
- **Backend API Server:**
  ```bash
  npm --prefix backend start
  ```
  *(Runs `node dist/src/server.js` on port 4000)*
- **Frontend Web Application (Production Reverse Proxy):**
  Configure Nginx or Caddy to serve the `dist/` folder on port 80/443 and proxy `/api/` requests to `http://localhost:4000/api/`.

---

## 9. SMOKE TEST & HEALTH VERIFICATION

### 9.1 Automated Diagnostic Script
Run the built-in diagnostic tool on the server host:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\check_sf9_environment.ps1
```

### 9.2 HTTP Health Endpoint
Query the system health endpoint:
```bash
curl http://localhost:4000/api/admin/system-health
```
Verify that `"Calulut SF9 Document Renderer"` returns `"status": "OPERATIONAL"`.

---

## 10. TROUBLESHOOTING COMMON CODES

| Error Code | HTTP Status | Root Cause | Remediation |
|---|---|---|---|
| `RENDERER_UNAVAILABLE` | **503** | Headless LibreOffice executable (`soffice`) not found on server. | Install LibreOffice to default path or set `LIBREOFFICE_BIN` in `backend/.env`. |
| `SF9_PDF_RENDER_TIMEOUT` | **504** | Conversion took longer than 45 seconds. | Ensure server has at least 2 CPU cores and 2 GB RAM. Increase `SF9_RENDER_TIMEOUT_MS` if needed. |
| `INCOMPLETE_ACADEMIC_RECORD` | **422** | Student lacks encoded grades, attendance, or adviser remarks. | **Not an infrastructure error.** Teacher must encode missing grades/attendance as mandated by DepEd Order No. 015, s. 2026. |
| `MISSING_AUTHORITATIVE_GENDER` | **422** | Learner gender is recorded as "Unknown" or blank. | Update learner profile to "Male" or "Female" as required by DepEd Form 138 / SF9 standards. |
| `INVALID_PDF_SIGNATURE` | **500** | Output PDF corrupted or missing `%PDF-` header. | Verify font packages (`fonts-dejavu-core`, `Carlito`) are installed. |

