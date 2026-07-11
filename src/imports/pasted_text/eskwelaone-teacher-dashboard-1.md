Design a Teacher Dashboard for DigiSkwela, a web-based school management 
system for Sindalan National High School.

═══════════════════════════════════════
VISUAL DIRECTION
═══════════════════════════════════════

AVOID GENERIC AI-DASHBOARD LOOK:
- Do not use the typical SaaS dashboard template (white rounded cards 
  floating on light gray background, soft blue/purple gradient accents, 
  generic sans-serif everywhere, evenly spaced 3-column grid with no 
  hierarchy)
- Do not use a near-black background with a single neon accent color
- Do not make it look like a generic CRM or fintech dashboard

GROUND IT IN REAL SCHOOL VISUAL LANGUAGE:
- Reference actual DepEd documents: report cards (Form 138), SF2 
  attendance sheets, school ID cards, certificates — structured ledger 
  lines, official header blocks, tabular rigidity, stamped/bordered feel
- Maroon as a structural color (header bands, section dividers, ruled 
  lines), not just a button accent
- Hairline rules instead of soft shadows, defined borders instead of 
  floating cards, tabular data treated like an actual gradebook ledger
- Passing scores/grades in normal text, failing in red — consistent 
  across all screens
- Signature visual element: pick ONE distinctive detail repeated 
  intentionally (e.g. recurring ledger-line pattern, consistent stamped 
  badge style) rather than scattering decoration everywhere

═══════════════════════════════════════
SIDEBAR NAVIGATION
═══════════════════════════════════════

Single flat list under one "MAIN" category. Do NOT create separate 
category groupings (no "Direct Access", no "Teacher Tools", no extra 
section labels). Exact order:

- Dashboard
- Classroom Hub
- Grades
- Attendance
- Clinic Visits
- Calendar
- Template Hub
- Tools
- AI Quick Tools
- Prof. Development
- Tutorials
- Help & Feedback
- Archived Classes

Grades, Attendance, and Clinic Visits are direct shortcuts — they open 
straight into a section/subject selector, skipping Classroom Hub. This 
is their function only, not a separate visual category.

═══════════════════════════════════════
SCREEN 1 — Dashboard Overview (main landing page)
═══════════════════════════════════════

Stats/widgets:
- Assigned Sections
- Total Students
- Today's Schedule
- Pending Grades
- Attendance Status
- Upcoming Activities

Class Cards (per assigned section), example:
- Grade 8 - Rizal
- Grade 9 - Einstein
- Grade 10 - Pilot
Each card shows: Number of Students, Subject, Semester, Adviser Status

Class Grade Summary Widget:
- Per section, quick list of students with their current overall grade 
  (General Average across all subjects so far)
- Each row: Student Name — Overall Grade — Status badge (Passed/At Risk)
- At-risk students surface at the top / flagged
- Clicking a student name opens their full grade card directly (see 
  "Student Grade Card" behavior below) — not a separate page navigation

═══════════════════════════════════════
SCREEN 2 — Grades (direct access tab)
═══════════════════════════════════════

- Section selector + Subject selector at the top (teacher may handle 
  multiple sections/subjects)
- Two tabs within this single page: "Grade entry" and "Quarterly summary" 
  — do not split these into separate sidebar items

GRADE ENTRY TAB:
- Spreadsheet-style grading ledger: rows = student names, columns 
  grouped by category (Written Works, Performance Tasks, Quarterly 
  Assessment), with individual activity sub-columns inside each group
- Editable score input directly in each cell
- Quarter selector (Q1 | Q2 | Q3) — switches which quarter's score grid 
  is being viewed/edited
- "+ Add activity" button per category group
- Adjustable category weights (% inputs for WW/PT/QA), live recompute, 
  must total 100%
- Per-student computed Quarterly Average column, auto-updating as scores 
  are entered
- Excel Export

QUARTERLY SUMMARY TAB:
- Read-only reference view (linked to Form 138 / Report Card)
- Table: Student Name — Q1 Grade — Q2 Grade — Q3 Grade — Final Average — 
  Status (Passed/Failed)
- Pulled automatically from each quarter's Grade entry ledger — editing 
  happens only in Grade entry, not here
- Bottom bar: Students count, Passing count, Failing count, Class Average

═══════════════════════════════════════
SCREEN 3 — Attendance (direct access tab)
═══════════════════════════════════════

- Section selector at the top
- Daily Attendance, QR Attendance Records, Manual Attendance, 
  Late Monitoring, SF2 Export

═══════════════════════════════════════
SCREEN 4 — Clinic Visits (direct access tab)
═══════════════════════════════════════

- Section selector at the top
- List of students with clinic visit history: date, reason, nurse remarks
- View-only for teacher — cannot edit clinic records, for awareness only 
  (e.g. knowing why a student was absent/excused)

═══════════════════════════════════════
SCREEN 5 — Classroom Hub (Section Detail)
═══════════════════════════════════════

Full per-section management grid, kept for complete classroom context in 
one place:

1. Students — Student List, Student Profiles, Parent Contacts, Student QR
2. Attendance — same functionality as the direct access tab, scoped to 
   this section
3. Gradebook — same functionality as the Grades direct access tab, 
   scoped to this section/subject
4. Analytics — Class Average, Subject Performance, Grade Distribution, 
   Students at Risk, AI Executive Summary

═══════════════════════════════════════
STUDENT GRADE CARD (triggered by clicking any student name, anywhere)
═══════════════════════════════════════

- Opens as a side panel/drawer over the current screen — NOT a full page 
  redirect, NOT routed through a separate "View Profile" page first
- Header: student name, grade & section, photo/avatar
- Table: rows = ALL subjects the student is enrolled in (not just the 
  subject the teacher was currently viewing) — columns: Q1 | Q2 | Q3 | 
  Final Average
- Bottom: General Average across all subjects (large, emphasized), 
  Passed/At Risk status label
- Read-only here — editing scores still happens only in that subject's 
  own Grade entry tab
- Close button (X) returns teacher to wherever they clicked from, no 
  navigation reset
- Passing subjects in normal text, failing subjects in red
- No line chart / grade trend graph on this panel

Note: deeper profile editing (contact info, parent details, etc.) can 
remain a separate page — but viewing grades must take exactly one click 
from any student name, not a detour through profile first.

═══════════════════════════════════════
SCREEN 6 — AI Quick Tools
═══════════════════════════════════════

Quick-launch cards for:
- Recitation Manager
- Project Tracker

Do NOT include any of these: Quiz Generator, Assessment Builder, Table 
of Specifications (TOS) Generator, Daily Lesson Log (DLL) Generator, 
Slideshow Builder.

═══════════════════════════════════════
SCREEN 7 — Professional Development
═══════════════════════════════════════

- Seminar Calendar
- LAC Sessions
- Training Schedule (with conflict detection against class schedule)
- Certificate Vault (upload certificates, tag by National/Regional/
  Division/District level, log training hours)
- Promotion Points Tracker