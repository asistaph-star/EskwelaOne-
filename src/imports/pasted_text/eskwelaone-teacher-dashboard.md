Design a Teacher Dashboard for EskwelaOne+, a web-based school management 
system for Sindalan National High School.

AVOID GENERIC AI-DASHBOARD LOOK:
- Do not use the typical SaaS dashboard template (white rounded cards floating 
  on light gray background, soft blue/purple gradient accents, generic 
  sans-serif everywhere, evenly spaced 3-column grid with no hierarchy)
- Do not use a near-black background with a single neon accent color
- Do not make it look like a generic CRM or fintech dashboard

GROUND IT IN REAL SCHOOL VISUAL LANGUAGE:
- Reference actual DepEd documents: report cards (Form 138), SF2 attendance 
  sheets, school ID cards, certificates — structured ledger lines, official 
  header blocks, tabular rigidity, stamped/bordered feel
- Maroon as a structural color (header bands, section dividers, ruled lines), 
  not just a button accent
- Hairline rules instead of soft shadows, defined borders instead of floating 
  cards, tabular data treated like an actual gradebook ledger

──────────────────────────────────────
SCREEN 1 — Dashboard Overview (main landing page)
──────────────────────────────────────
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

Class Grade Summary Widget (NEW — add this):
- Per section, quick list of students with their current overall grade 
  (General Average across all subjects so far)
- Each row: Student Name — Overall Grade — Status badge (Passed/At Risk)
- At-risk students surface at the top / flagged
- Clicking a student name jumps to their Student Detail / Report Card page
- Compact glance-view, not the full report card

──────────────────────────────────────
SCREEN 2 — Classroom Hub (Section Detail)
──────────────────────────────────────
4 core modules:

1. Students
   - Student List, Student Profiles, Parent Contacts, Student QR

2. Attendance
   - Daily Attendance, QR Attendance Records, Manual Attendance, 
     Late Monitoring, SF2 Export

3. Gradebook
   - Spreadsheet-style grading ledger: rows = student names, columns 
     grouped by category (Written Works, Performance Tasks, Quarterly 
     Assessment), with individual activity sub-columns inside each group
   - Editable score input directly in each cell
   - Quarter selector (Q1 | Q2 | Q3) — switches which quarter's score 
     grid is being viewed/edited
   - "+ Add activity" button per category group
   - Adjustable category weights (% inputs for WW/PT/QA), live recompute
   - Quarterly summary table (separate view): Student Name — Q1 Grade — 
     Q2 Grade — Q3 Grade — Final Average, read-only, pulled from each 
     quarter's ledger
   - Excel Export

4. Analytics
   - Class Average, Subject Performance, Grade Distribution, 
     Students at Risk, AI Executive Summary

──────────────────────────────────────
SCREEN 3 — Student Detail Page
──────────────────────────────────────
Overall Grade Card (near top, beside student's basic info):
- Large General Average number (computed across all subjects, all 
  quarters so far)
- Status label: "Passed" or "At Risk"
- Subject breakdown list underneath (e.g. Filipino - 88, Math - 76, 
  Science - 92...)
- "View full report card" button → opens Report Card screen

Student Report Card screen (opens from the button above):
- Header: student name, grade & section, adviser, school year
- Table: rows = subjects, columns = Q1 | Q2 | Q3 | Final Average | Remarks
- Final Average per subject = average of Q1+Q2+Q3
- Remarks = Passed/Failed
- Bottom row: General Average across all subjects, emphasized/bordered box
- REMOVE: do not include a grade trend line chart anywhere on this screen

──────────────────────────────────────
SCREEN 4 — AI Quick Tools
──────────────────────────────────────
Quick-launch cards for:
- Recitation Manager
- Project Tracker

REMOVE — do not include any of these:
- Quiz Generator
- Assessment Builder
- Table of Specifications (TOS) Generator
- Daily Lesson Log (DLL) Generator
- Slideshow Builder

──────────────────────────────────────
SCREEN 5 — Professional Development
──────────────────────────────────────
- Seminar Calendar
- LAC Sessions
- Training Schedule (with conflict detection against class schedule)
- Certificate Vault (upload certificates, tag by National/Regional/
  Division/District level, log training hours)
- Promotion Points Tracker

──────────────────────────────────────
DESIGN NOTES
──────────────────────────────────────
- Sidebar navigation: Dashboard, Calendar, Template Hub, Tutorials, Tools, 
  Help & Feedback, with an Archived Classes link
- Maroon as the primary structural school color
- Attendance status uses color-coded badges (green = Good Standing)
- Passing scores/grades in normal text, failing in red — consistent 
  across all screens
- Signature visual element: pick ONE distinctive detail repeated 
  intentionally (e.g. recurring ledger-line pattern, consistent stamped 
  badge style) rather than scattering decoration everywhere