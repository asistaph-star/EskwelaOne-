# DigiSkwela — School Management System (EskwelaOne)

Official school management platform for Calulut Integrated School, featuring DepEd-compliant grading (DepEd Order No. 8, s. 2015), authentic Form 138 (SF9) progress reporting, SF2 attendance tracking, and administrative portals for Administrators, Principals, Teachers, and Students.

---

## Architecture Overview

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS (`src/`)
- **Backend:** Node.js + Express + TypeScript (`backend/`)
- **Database & ORM:** PostgreSQL 17 + Prisma ORM (`backend/prisma/`)
- **Document Generation:** OpenXML Excel workbook manipulation (`exceljs`) + headless LibreOffice Calc PDF rendering
- **Master SF9 Template:** `backend/templates/sf9/master_template_sanitized.xlsx` (Sheet: `SF9 - GRADE 4-10`)

---

## Teammate Quickstart & Local Setup

### 1. Prerequisites
- **Node.js:** v18+ (tested on Node.js v20/v24)
- **PostgreSQL:** v15+ (local database instance)
- **LibreOffice:** Headless server-side runtime for PDF rendering (see [LibreOffice Setup](#libreoffice-server-side-setup) below)

### 2. Environment Configuration

#### Backend Setup (`backend/`)
```bash
cd backend
cp .env.example .env
```
Update `.env` with your local PostgreSQL connection and secrets:
```ini
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/digiskwela?schema=public"
JWT_SECRET="CHANGE_ME_TO_A_STRONG_RANDOM_SECRET_MIN_32_CHARS"
PORT=4000
CORS_ORIGIN="http://localhost:5173"
MEDIA_STORAGE_PATH="./storage/documents"
```

Install dependencies and generate Prisma client:
```bash
npm install
npx prisma generate
npx prisma migrate deploy  # or npx prisma db push
```

#### Frontend Setup (Root)
```bash
cp .env.example .env
npm install
```
Default frontend `.env`:
```ini
VITE_API_URL="http://localhost:4000/api"
VITE_BACKEND_URL="http://localhost:4000"
PORT=5173
```

### 3. Running Development Servers

Start Backend:
```bash
cd backend
npm run dev
# Server running at http://localhost:4000
```

Start Frontend (in a separate terminal):
```bash
npm run dev
# Vite dev server running at http://localhost:5173
```

---

## LibreOffice Server-Side Setup

> **IMPORTANT:** LibreOffice is strictly a **backend server-side dependency** used to convert the populated DepEd SF9 Excel workbook into official PDF documents. Students, teachers, and frontend clients **do not** need to install LibreOffice.

The backend resolver (`calulutSf9PdfRenderer.ts`) automatically discovers LibreOffice across standard operating system locations:

### Option A: Standard System Installation (Recommended)
- **Windows:** Download and install [LibreOffice](https://www.libreoffice.org/download/download/) (default path: `C:\Program Files\LibreOffice\program\soffice.exe` or `soffice.bin`).
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt-get update && sudo apt-get install -y libreoffice-calc --no-install-recommends
  # Resolves automatically to /usr/bin/soffice
  ```
- **macOS:** Install LibreOffice via DMG or Homebrew:
  ```bash
  brew install --cask libreoffice
  # Resolves automatically to /Applications/LibreOffice.app/Contents/MacOS/soffice
  ```

### Option B: Project-Local Portable Runtime
Place a portable LibreOffice distribution inside `backend/tools/libreoffice/` such that:
- Windows: `backend/tools/libreoffice/program/soffice.exe`
- Linux: `backend/tools/libreoffice/program/soffice.bin`

### Option C: Explicit Environment Variable
Set the absolute path to your LibreOffice executable in `backend/.env`:
```ini
LIBREOFFICE_BIN="/custom/path/to/soffice"
```

---

## DepEd SF9 Modernization Feature Overview

### 1. Authentic Digital SF9 Progress Card (`DigitalAuthenticSf9ProgressCard.tsx`)
A high-fidelity React implementation matching the layout, typography, and borders of `backend/templates/sf9/master_template_sanitized.xlsx` (Sheet `SF9 - GRADE 4-10`):
- **Page 1: Scholastic Record:** 8 DepEd JHS learning areas, quarterly ratings (1–3), and DepEd Order No. 8, s. 2015 Performance Descriptors reference table.
- **Page 2: Attendance & Certification:** 11-month SF2 attendance summary table (Jun–Apr + Total), teacher comments per term, and Certificate of Transfer with Class Adviser and Principal IV signatories.
- **View Switcher:** Seamlessly toggle between `2-Page Complete View`, `Page 1: Scholastic Record`, and `Page 2: Attendance & Certification`.

### 2. Four Dynamic Visual States
- **State A (Concealed Blank):** Unreleased learners when term grades are hidden by school policy. Displays a dark slate status banner and em-dash placeholders (`—`).
- **State B (Academic Preview):** Unreleased learners when Term 1 grades are toggled visible. Displays an amber preview banner with published trimester assessments.
- **State C (Subsequent Terms Visible):** Unreleased learners with progressive terms visible; annual final ratings and promotion descriptors remain unrated until all required terms complete.
- **State D (Officially Released SF9):** Formally issued and released learners. Displays an emerald green status banner with cryptographic SHA-256 digital seal badge and unlocked PDF download/view buttons.

### 3. Duplicate Authorization & Issuance Prevention
- **Batch Authorization:** `POST /api/academic/report-card/sections/:sectionId/authorize-eligible` skips already issued or released learners idempotently.
- **Single Issuance & Authorization:** Re-authorizing or re-issuing an already authorized/issued learner returns HTTP 409 Conflict (`ALREADY_ISSUED_OR_RELEASED` / `ALREADY_ISSUED`).

### 4. Student Grade Privacy Gating
- Academic terms default to `is_grades_visible_to_students: false`.
- Authorized administrators manage visibility via `PATCH /api/academic/terms/:termId/visibility`.
- Unreleased learners receive `null` for concealed ratings and comments. Officially released learners retain continuous, independent access to their signed SF9 PDF.

---

## Feature Status & Verification Scope

- **Fully Implemented & Automated-Tested:**
  - SF9 eligibility evaluation and hollow gradebook rejection.
  - Section-level batch authorization with duplicate learner skipping.
  - Single-learner duplicate authorization and issuance rejection (409 Conflict).
  - Term grade visibility toggle and student privacy gating.
  - Authentic React SF9 card viewer with 4 visual states.
  - Authenticated SF9 PDF download and SHA-256 cryptographic verification.
- **Implemented with In-Memory State & DB Persistence (Requires Multi-Worker Load Testing):**
  - Durable batch issuance queue (`sf9BatchQueue.service.ts`) with PostgreSQL synchronization (`sf9_bulk_batch_jobs`) and restart recovery.
  - End-to-end full school year closure (Terms 2 and 3 grade entry to annual promotion).
