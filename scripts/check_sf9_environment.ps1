# ==============================================================================
# DIGISKWELA — READ-ONLY SF9 & ENVIRONMENT DIAGNOSTIC TOOL
# ==============================================================================
# Purpose: Non-destructive cross-laptop audit for LibreOffice, templates,
# Git commit alignment, and database prerequisite state.
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  DIGISKWELA PRE-DEFENSE ENVIRONMENT & SF9 READ-ONLY AUDIT       " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# Determine base repository root directory
$repoRoot = (Get-Location).Path
if (Test-Path (Join-Path $repoRoot "DigiSkwela")) {
    $repoRoot = (Join-Path $repoRoot "DigiSkwela")
}
Set-Location $repoRoot

# 1. Git Repository and Commit Status
Write-Host "[1/5] Checking Git Status and Commit Alignment..." -ForegroundColor Yellow
try {
    $commit = git -C $repoRoot rev-parse --short HEAD 2>$null
    $branch = git -C $repoRoot rev-parse --abbrev-ref HEAD 2>$null
    $origin = git -C $repoRoot config --get remote.origin.url 2>$null
    Write-Host "  Repository Root: $repoRoot" -ForegroundColor White
    Write-Host "  Remote Origin  : $origin" -ForegroundColor White
    Write-Host "  Active Branch  : $branch" -ForegroundColor White
    Write-Host "  HEAD Commit    : $commit (Expected: 16581a2)" -ForegroundColor White
    if ($commit -like "16581a2*") {
        Write-Host "  [OK] Git commit matches reference laptop." -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Git commit differs from reference laptop (16581a2)." -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] Unable to determine Git commit." -ForegroundColor Red
}
Write-Host ""

# 2. Template Assets
Write-Host "[2/5] Checking Calulut SF9 Master Template Asset..." -ForegroundColor Yellow
$tplPath = Join-Path $repoRoot "backend\templates\sf9\master_template_sanitized.xlsx"
if (Test-Path $tplPath) {
    $tplItem = Get-Item $tplPath
    Write-Host "  Template File : $tplPath" -ForegroundColor White
    Write-Host "  Size          : $($tplItem.Length) bytes" -ForegroundColor White
    Write-Host "  [OK] Master Excel SF9 template is present." -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Master Excel SF9 template is MISSING at $tplPath!" -ForegroundColor Red
}
Write-Host ""

# 3. LibreOffice Binary Resolution Audit
Write-Host "[3/5] Auditing LibreOffice Candidates (calulutSf9PdfRenderer.ts)..." -ForegroundColor Yellow
$candidates = @(
    $env:LIBREOFFICE_BIN,
    (Join-Path $repoRoot "backend\tools\libreoffice\program\soffice.bin"),
    (Join-Path $repoRoot "backend\tools\libreoffice\program\soffice.exe"),
    "C:\Program Files\LibreOffice\program\soffice.bin",
    "C:\Program Files\LibreOffice\program\soffice.exe"
)

$foundBin = $null
foreach ($cand in $candidates) {
    if ($cand -and (Test-Path $cand)) {
        Write-Host "  [FOUND] $cand" -ForegroundColor Green
        if (-not $foundBin) { $foundBin = $cand }
    } else {
        if ($cand) { Write-Host "  [MISSING] $cand" -ForegroundColor DarkGray }
    }
}

if ($foundBin) {
    Write-Host "  Active Binary Resolved: $foundBin" -ForegroundColor Cyan
    Write-Host "  [OK] Headless LibreOffice is available for SF9 rendering." -ForegroundColor Green
} else {
    Write-Host "  [CRITICAL DEFECT] No LibreOffice binary found!" -ForegroundColor Red
    Write-Host "  Issue 1 Cause: Headless PDF renderer will fail with HTTP 503 RENDERER_UNAVAILABLE." -ForegroundColor Red
    Write-Host "  Resolution   : Install LibreOffice to C:\Program Files\LibreOffice or copy backend\tools\libreoffice." -ForegroundColor Yellow
}
Write-Host ""

# 4. Node.js & Runtime Environment
Write-Host "[4/5] Checking Node.js Runtime..." -ForegroundColor Yellow
$nodeVer = node -v 2>$null
$npmVer = npm -v 2>$null
Write-Host "  Node Version : $nodeVer" -ForegroundColor White
Write-Host "  NPM Version  : $npmVer" -ForegroundColor White
Write-Host ""

# 5. Database Connection & Prerequisite Records Inspection
Write-Host "[5/5] Checking Database & Academic Records Prerequisites..." -ForegroundColor Yellow
$nodeCheckScript = @'
const path = require('path');
const dotenv = require(path.join(process.cwd(), 'backend', 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(process.cwd(), 'backend', '.env'), quiet: true });
const { PrismaClient } = require(path.join(process.cwd(), 'backend', 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();

async function check() {
  try {
    const [dbRow] = await prisma.$queryRawUnsafe('SELECT current_database() as db');
    const userCount = await prisma.user.count();
    const studentCount = await prisma.student.count();
    const enrollmentCount = await prisma.enrollment.count();
    const gradeCount = await prisma.grade.count();
    const commentsCount = await prisma.sf9AdviserComment.count();
    const settings = await prisma.schoolSettings.findFirst();

    console.log(JSON.stringify({
      success: true,
      database: dbRow?.db,
      users: userCount,
      students: studentCount,
      enrollments: enrollmentCount,
      grades: gradeCount,
      comments: commentsCount,
      schoolName: settings?.school_name || 'Not configured'
    }));
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: e.message }));
  } finally {
    await prisma.$disconnect();
  }
}
check();
'@

try {
    $dbOutput = node -e $nodeCheckScript
    $jsonLine = $dbOutput | Where-Object { $_ -match '^\s*\{.*"success"' } | Select-Object -First 1
    if (-not $jsonLine) {
        $jsonLine = $dbOutput | Where-Object { $_ -match '^\s*\{' } | Select-Object -First 1
    }
    $dbRes = $jsonLine | ConvertFrom-Json
    if ($dbRes -and $dbRes.success) {
        Write-Host "  Connected Database : $($dbRes.database)" -ForegroundColor White
        Write-Host "  School Name        : $($dbRes.schoolName)" -ForegroundColor White
        Write-Host "  Total Users        : $($dbRes.users)" -ForegroundColor White
        Write-Host "  Total Students     : $($dbRes.students)" -ForegroundColor White
        Write-Host "  Total Enrollments  : $($dbRes.enrollments)" -ForegroundColor White
        Write-Host "  Total Grades       : $($dbRes.grades)" -ForegroundColor White
        Write-Host "  Adviser Comments   : $($dbRes.comments)" -ForegroundColor White

        if ($dbRes.grades -gt 0 -and $dbRes.comments -gt 0) {
            Write-Host "  [OK] Acceptance academic records are populated." -ForegroundColor Green
        } else {
            Write-Host "  [WARNING] Database lacks published grades or adviser comments!" -ForegroundColor Red
            Write-Host "  Issue 2 Cause: Teacher Portal will show Gating Diagnostics screen (DepEd Order 015 prerequisite enforcement)." -ForegroundColor Red
        }
    } else {
        $errMsg = if ($dbRes -and $dbRes.error) { $dbRes.error } else { $dbOutput -join " " }
        Write-Host "  [FAIL] Database check failed: $errMsg" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] Could not execute database inspection script: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  AUDIT COMPLETE                                                 " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
