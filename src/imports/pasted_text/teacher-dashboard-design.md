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
category groupings. Exact order:

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

═══════════════════════════════════════
SCREEN 1 — Dashboard Overview (main landing page)
═══════════════════════════════════════

ALL widgets must display real-time data. No placeholder or static 
content anywhere on the dashboard.

WIDGETS (all functional, all connected to live data):

1. Students Needing Attention
   REPLACE the old Class Grade Summary widget with this.
   Do NOT show passing students here — only show:
   - Students who are failing (below passing grade) — red color coding
   - Students who are at risk of failing (near passing grade) — amber 
     color coding
   Each row: Student Name — Subject — Current Grade — Status badge 
   (Failing / At Risk)
   Purpose: teacher immediately sees who needs intervention without 
   scrolling through all students

2. Attendance Summary
   - Today's attendance rate across all assigned sections
   - Present / Absent / Late counts

3. Grade Analytics
   - Class average per assigned section
   - Passing vs failing rate, live from gradebook data

4. Teacher Overview by Year Level
   Organize teachers by Grade level, not by performance ranking.
   Use one color per grade level for quick identification:
   - Grade 7 (one color)
   - Grade 8 (one color)
   - Grade 9 (one color)
   - Grade 10 (one color)
   Each teacher card shows:
   - Teacher name
   - Assigned grade level
   - Assigned section(s)
   - Subjects handled
   - Advisory class (if applicable)
   This is for organization and identification only — not a performance 
   ranking or scoring system.

5. Recent Activities
   - Latest actions logged in the system (grade entries, attendance 
     taken, clinic visits logged, etc.)

6. Notifications
   - School announcements, pending tasks, system alerts

7. Quick Actions
   - Shortcut buttons for most frequent tasks (Take attendance, Enter 
     grades, Export SF2, etc.)

Class Cards (per assigned section):
- Grade 8 - Rizal
- Grade 9 - Einstein
- Grade 10 - Pilot
Each card shows: Number of Students, Subject, Semester, Adviser Status

═══════════════════════════════════════
SCREEN 2 — Grades (direct access tab)
═══════════════════════════════════════

- Section selector + Subject selector at the top
- Two tabs within this single page: "Grade entry" and "Quarterly 
  summary" — do NOT split into separate sidebar items

GRADE ENTRY TAB:
- Spreadsheet-style grading ledger: rows = student names, columns 
  grouped by category (Written Works, Performance Tasks, Quarterly 
  Assessment), with individual activity sub-columns inside each group
- Editable score input directly in each cell
- Quarter selector (Q1 | Q2 | Q3) — switches which quarter's score 
  grid is being viewed/edited
- "+ Add activity" button per category group
- Adjustable category weights (% inputs for WW/PT/QA), live recompute, 
  must total 100%
- Per-student computed Quarterly Average column, auto-updating as 
  scores are entered
- Excel Export

QUARTERLY SUMMARY TAB:
- Read-only reference view (linked to Form 138 / Report Card)
- Table: Student Name — Q1 Grade — Q2 Grade — Q3 Grade — Final 
  Average — Status (Passed/Failed)
- Pulled automatically from each quarter's Grade entry ledger
- Bottom bar: Students count, Passing count, Failing count, Class 
  Average

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
- List of students with clinic visit history: date, reason, 
  nurse remarks
- View-only for teacher — cannot edit, for awareness only

═══════════════════════════════════════
SCREEN 5 — Classroom Hub (Section Detail)
═══════════════════════════════════════

Full per-section management grid:

1. Students — Student List, Student Profiles, Parent Contacts, 
   Student QR
2. Attendance — same as direct access tab, scoped to this section
3. Gradebook — same as Grades direct access tab, scoped to this 
   section/subject
4. Analytics — Class Average, Subject Performance, Grade Distribution, 
   Students at Risk, AI Executive Summary

═══════════════════════════════════════
STUDENT GRADE CARD 
(triggered by clicking any student name, anywhere)
═══════════════════════════════════════

- Opens as a side panel/drawer over the current screen — NOT a full 
  page redirect, NOT through a separate View Profile page first
- Header: student name, grade & section, photo/avatar
- Table: rows = ALL subjects the student is enrolled in, columns: 
  Q1 | Q2 | Q3 | Final Average
- Bottom: General Average (large, emphasized), Passed/At Risk label
- Read-only — editing still happens in Grade entry tab only
- Close (X) returns teacher to wherever they clicked from
- Passing subjects in normal text, failing in red
- No line chart or grade trend graph

═══════════════════════════════════════
SCREEN 6 — Template Hub
═══════════════════════════════════════

Where administrators generate and print official school documents.

AVAILABLE TEMPLATES:
- Form 137
- Report Card
- Other printable school forms

REPORT CARD TEMPLATE BEHAVIOR:
- Displays the student's complete academic history across all 
  grade levels: Grade 7 | Grade 8 | Grade 9 | Grade 10
- Must support both grading formats automatically:

  Old Curriculum: Q1 | Q2 | Q3 | Q4
  New Curriculum: Q1 | Q2 | Q3

- System auto-detects and displays the correct format based on the 
  selected school year or grading setup — no manual switching needed
- This ensures compatibility when a student has records from both 
  old and new curriculum years (e.g. Grade 7 was under old curriculum, 
  Grade 8 onwards under new curriculum)

LAYOUT:
- Grid of template cards, each showing template name, preview 
  thumbnail, and a Generate/Print button
- Selecting a template opens a form to pick the student (or class/
  section for bulk printing), school year, then generates a 
  print-ready document

═══════════════════════════════════════
SCREEN 7 — AI Quick Tools
═══════════════════════════════════════

Quick-launch cards for:
- Recitation Manager
- Project Tracker

Do NOT include: Quiz Generator, Assessment Builder, TOS Generator, 
DLL Generator, Slideshow Builder.

═══════════════════════════════════════
SCREEN 8 — Professional Development
═══════════════════════════════════════

- Seminar Calendar
- LAC Sessions
- Training Schedule (with conflict detection against class schedule)
- Certificate Vault (upload certificates, tag by National/Regional/
  Division/District level, log training hours)
- Promotion Points Tracker