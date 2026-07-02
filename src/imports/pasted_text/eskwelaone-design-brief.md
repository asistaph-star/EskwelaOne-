EskwelaOne+ — Figma Design Brief

Sindalan National High School · Education Management Information System
Version 1.0 | SY 2025–2026


1. Product Identity

Product: EskwelaOne+ — a web-based EMIS for Sindalan National High School
Primary users: Teachers, Subject Coordinators, Registrar, School Nurse, Prefect of Discipline, Principal
Goal of the UI: Make daily school operations feel organized, trustworthy, and fast — for educators who are not power users of software

Design language: "Institutional clarity"
Clean, professional, and authoritative without feeling cold. The system should look like it belongs in a DepEd school — navy blue, structured, dependable — while being modern enough to earn trust from teachers who are used to Excel.


2. Color System

Primary Palette (use these tokens everywhere)

Token NameHexUsagenavy-900#0F2240Sidebar background, dark surfacesnavy-700#1B3A6BPrimary brand color, buttons, links, active statesnavy-100#EFF6FFLight blue tint for badges, tag backgroundsgold-500#F5A623Accent — logo mark, active nav highlight, key CTAsgold-100#FEF3C7Light gold tint for banners and highlights

Semantic / Status Colors

TokenHexUsagegreen-700#2E7D52Passed, present, good standing, successgreen-100#F0FDF4Success background tintamber-500#F59E0BWarning, late, approaching evaluationamber-100#FFFBEBWarning background tintred-600#DC2626Absent, failing, high-priority alertred-100#FEF2F2Danger background tintpurple-700#5B21B6Grade 10 class tag, special sectionspurple-100#F5F3FFPurple tint

Neutral / Surface Colors

TokenHexUsagebg-page#F0F4FAPage background (light blue-gray)surface-white#FFFFFFCards, panels, topbar, modalsborder#E2E8F0Default hairline borders on cardstext-primary#1A202CMain body text, headingstext-secondary#4A5568Supporting labels, sub-headingstext-muted#94A3B8Placeholders, hints, light metadata

Color Rules


Never use raw black (#000) or pure white (#fff) for text — use token values above
Status badge pattern: always pair {color}-100 background + {color}-700 text + {color}-200 border
Progress bars: fill color matches the class/section tag color (blue for Grade 8, green for Grade 9, purple for Grade 10)
The gold-500 accent appears ONLY on: logo mark, active sidebar nav, primary action buttons, and key metric accents — nowhere else



3. Typography

Typefaces

RoleFontSourceDisplay / HeadingsPlus Jakarta SansGoogle FontsBody / UIInterGoogle FontsNumbers / Data tablesIBM Plex MonoGoogle Fonts

Type Scale

NameFontSizeWeightUsagepage-titlePlus Jakarta Sans20px600Page headerssection-labelInter13px500Section titles, card labelsbodyInter13px400General UI textbody-smInter11px400Metadata, badges, subtitlesstat-numberPlus Jakarta Sans22–28px500Dashboard metric numbersdataIBM Plex Mono12px400Grades, scores, IDs in tableslabelInter10px500Uppercase section dividers (with 0.08em letter-spacing)

Typography Rules


Use sentence case everywhere — never title case on buttons or labels
Section divider labels in the sidebar: UPPERCASE, 10px, letter-spacing 0.08em, muted color
Student names in tables: "Surname, First Name" format (e.g., Santos, Juan Miguel)
All grades and scores use IBM Plex Mono for visual alignment in table columns



4. Spacing & Grid System


Base unit: 4px
Card padding: 14px (3.5 units)
Section spacing: 18px between major sections
Card gap: 10px between cards in a grid
Sidebar width: 200px (fixed)
Topbar height: 52px (fixed)
Border radius — cards: 10px
Border radius — buttons/inputs: 6px
Border radius — badges/pills: 20px (full pill)
Border radius — tags: 4px
Sidebar nav item: 8px padding, 6px border-radius, 1px margin around each item
Card border: 0.5px solid border token


Layout Grid


Desktop canvas: 1280px wide minimum
Three-column class card grid: repeat(3, 1fr) with 10px gap
Two-column bottom panels: 1fr 1fr with 10px gap
Stats row: repeat(4, 1fr) with 10px gap



5. Core Components

5.1 Sidebar


Background: navy-900 (#0F2240)
Logo area: 18px top padding, includes the EskwelaOne+ wordmark + Sindalan NHS sub-label
Logo mark: 28×28px rounded square in gold-500, contains the app icon
Nav section labels: uppercase 10px muted white, 12px top padding
Nav items: 12px Inter, icons at 15px Tabler outline

Default: rgba(255,255,255,0.55) text
Hover: rgba(255,255,255,0.06) bg, rgba(255,255,255,0.8) text
Active: rgba(245,166,35,0.15) bg, #F5A623 text



Alert badge on nav item: 9px red pill (#DC2626)
Bottom user pill: avatar circle (28px, navy bg + gold border) + name/role + chevron


5.2 Topbar


Background: white, border-bottom: 0.5px solid border
Left: greeting text (14px 500) + sub-label (12px muted)
Center-right: system status pill, search box, notification bell
Status pill: navy-100 bg, navy-700 text, 0.5px border — shows "S.Y. Active"
Search box: light gray bg, 0.5px border, Tabler ti-search icon, 120px input


5.3 School Banner


Full-width strip inside content area, below topbar
Background: dark navy gradient (#0F2240 → #1B3A6B)
Contains: school icon in gold-tinted box + school name/address + DepEd compliance pill
Border-radius: 10px, margin-bottom: 18px


5.4 Stat Cards


Background: white, 0.5px border, 10px radius
Left accent bar: 3px wide, 32px tall, color matches the stat's semantic meaning

Navy = total students
Green = present / passing
Amber = warnings / lates
Red = absences / failing



Layout: flex row, accent bar + label/value/delta column
Number: 22px Plus Jakarta Sans 500
Label: 10px uppercase muted
Delta: 10px, colored (green for positive, muted for neutral)


5.5 Class Cards


White bg, 0.5px border, 10px radius, hover border = navy-700
Top: grade-level tag (colored pill with grade icon)

Grade 8: blue tag (navy-100/navy-700)
Grade 9: green tag
Grade 10: purple tag



Section name: 13px 500, Sub-label: 11px muted
Footer (separated by 0.5px top border):

Student count with ti-users icon
Thin 3px progress bar (completion %)
Percentage label





5.6 Alert List Item


Flex row: 6px colored dot + student name (flex 1) + status badge
Dot colors: red = absences, amber = academic risk, blue = pending action
Badge pattern: {color}-100 bg + {color}-700 text + 0.5px {color}-200 border


5.7 Quick Action Buttons


2-column grid inside a panel
Each button: flex row with ti- icon + label, 10px 12px padding
Default: #F8FAFF bg, 0.5px border
Hover: navy-100 bg, navy-700 text and border
Icon color: always navy-700


5.8 Data Tables (Gradebook, Student List)


Header row: #F8FAFF bg, 11px uppercase label, border-bottom
Data cells: 13px body, numbers in IBM Plex Mono 12px
Row hover: #F8FAFF bg tint
Sticky first column for student names (surname-first format)
Passing grade: green text (green-700)
Failing grade: red text (red-600)
Column groups (Written Works / Performance Tasks / Quarterly Assessment): separated by thicker column borders


5.9 Student Profile Header


Top section: avatar circle (initials, 48px) + full name + grade/section + general average box
General Average box: large 28px Plus Jakarta Sans number + "Passed/Failed" label below
Attendance badge: colored pill (green = Good Standing, amber = At Risk, red = Poor Attendance)
Quick tab nav below: Profile | Grades | Attendance | Behavior | Clinic



6. Screen Specifications

Screen 1: Main Dashboard (Teacher View)

Layout: Sidebar (200px) + Main content (fills remaining)
Content areas (top to bottom):


Topbar — greeting + status + search + bell
School banner strip
Stats row (4 cards): Total Students / Present Today / Late Arrivals / Absent Today
"My Classes" header + 3-column class card grid
2-column bottom row: Alerts panel (left) + Quick Actions panel (right)


Figma notes:


Use Auto Layout for stats row and class card grid
All cards use the same card component base (white, 0.5px border, 10px radius)
Quick actions grid uses a nested 2×3 grid



Screen 2: Class Hub (Section Detail)

URL pattern: /class/{section-id}
Layout: Same sidebar + topbar, breadcrumb below topbar
Content:


Section header: name, grade level, subject, student count, SY period
4 core module cards in a 2×2 grid:

Students (ti-users icon, navy accent)
Attendance (ti-calendar-check, green accent)
Grading System (ti-report, amber accent)
Analytics (ti-chart-bar, purple accent)



"AI Quick Tools" row (horizontal scroll): DLL | Assessments | Recitation | Project Lab | SlideShow


AI Quick Tool buttons: slightly larger than quick action buttons, each has a colored icon, name, and "AI-powered" sub-label. Uses a horizontal scrollable strip.


Screen 3: Student Detail Page

Layout: Sidebar + main, student profile header spans full width
Profile header components:


Avatar initials circle (48px, navy bg + gold border)
Full name (18px Plus Jakarta Sans) + grade/section sub-label
General Average box (right-aligned): large number, passed/failed label in semantic color
Attendance status badge (inline pill)


Tab body — Grades tab:


Subject list as a table: Subject name | Q1 | Q2 | Q3 | Q4 | Final Average
Numbers in IBM Plex Mono, colored by passing/failing status


Tab body — Attendance tab:


Mini calendar (monthly grid view) + totals sidebar
Days present (green) / absent (red) / late (amber) / excused (blue)


Anecdotal notes section:


White card at bottom, text area with timestamp + teacher name
Tags for category: Academic | Behavioral | Health | Achievement



Screen 4: Attendance Hub

Layout: Sidebar + main with month selector at top
Content:


Month/year selector (chevron nav) + "Export SF2" button (prominent, navy-700 bg)
Calendar grid (Mon–Fri columns, weeks as rows)

Each cell: date number + colored dot for attendance status
Today highlighted with navy border
Non-school days (holidays) shown in muted gray with "Holiday" label



Right sidebar panel: Attendance Alerts list + Lates Alert list


SF2 Export button: Primary action, navy-700 background, white text, 6px radius — most prominent element on page


Screen 5: Gradebook

Layout: Sidebar + main, full-width data table
Table structure:


Frozen left column: student names (surname, firstname)
Column groups separated by border-strong vertical lines:

Written Works (WW1, WW2, WW3...) — blue column group header
Performance Tasks (PT1, PT2...) — green column group header
Quarterly Assessment (QA) — amber column group header
Quarterly Average — navy column group header



Top toolbar: subject selector | quarter selector | "Export Excel" button
Weight configurator: small inputs for WW% / PT% / QA% with live recalculation


Color coding in cells:


90–100: green-700 text
75–89: text-primary (normal)
Below 75: red-600 text + red-100 background tint



Screen 6: Analytics Hub

Layout: Sidebar + main, 2-column grid for charts
Content:


AI Executive Summary box (full width): white card with light gold-100 left border accent, AI-generated text summary, "Regenerate" button
Chart grid (2 columns):

Subject Performance Index: horizontal bar chart (Inter, IBM Plex Mono for values)
Grade Distribution Ring: donut chart with legend (Passed / Conditional / Failed)



Intervention Watchlist (full width): table of students flagged for academic risk, sorted by urgency


AI Summary box border accent: 3px left border in gold-500 — visually signals "AI-generated content"


Screen 7: DLL Module

Layout: Sidebar + main, two-panel view
Left panel (1/3): Archive list of past DLLs (date, topic, competency tag)
Right panel (2/3): DLL editor or AI generator

AI Generator form:


Grade level selector
Subject dropdown
Learning competency input (or MELC code)
Session count (1–3 sessions)
"Generate DLL" button (gold-500 background, dark text)


Generated DLL view:


Structured card for each section: Learning Competency | Objectives | Session A/B/C breakdown
Print/Export PDF button at top right



Screen 8: Assessments Hub / TOS Builder

Two tabs: Test Bank | TOS Builder
TOS Builder layout:


Input form: grade level, subject, topics, hours taught
Auto-generated TOS table: Hours | % Weight | Items | Bloom's Taxonomy columns
"Generate Questions" button (calls AI)


Generated test view:


Question card list: number badge + question text + options (for multiple choice) or blank line (for identification)
Collapsible answer key section (hidden by default, reveal on teacher interaction)
Export as PDF / Print buttons



Screen 9: Faculty Dashboard (Admin View)

Access: Principal / Admin role only
Content:


Teacher Promotion Tracker table:

Name | Designation | Years in Current Rank | Promotion Status
Status badge using traffic light: Green (Year 1) | Amber (Year 2) | Red (Year 3/Eligible)



DepEd Rank Demographics chart: horizontal bar showing count per rank (Teacher I, II, III, MT I...)
Digital Credential Vault: per-teacher document list with category tags (National/Regional/Division/District)



Screen 10: Gate Tracking / QR Ecosystem

Layout: Sidebar + main, live dashboard feel
Content:


Live headcount ticker: large numbers — Total Present | Inside Campus | Checked Out
Recent scan log: scrolling list of last 20 gate events (student photo + name + timestamp + In/Out badge)
Parent notification log: sent notifications with status (Delivered / Pending)
QR code generator panel: search student → generate and print QR code



7. Navigation Structure

EskwelaOne+
├── Dashboard (teacher home)
├── Students
│   └── [Student Detail]
│       ├── Grades
│       ├── Attendance
│       ├── Behavior
│       └── Clinic
├── Attendance
│   └── Attendance Hub (per class)
├── Gradebook (per class / per quarter)
├── Analytics
│   └── AI Executive Summary
├── Lesson Logs (DLL)
├── Assessments + TOS
├── Faculty (Admin only)
│   ├── Promotion Tracker
│   └── Credential Vault
├── Inventory
└── Gate Tracking (QR)


8. Iconography

Use Tabler Icons (outline style only). Key icons per module:

ModuleIconDashboardti-layout-dashboardStudentsti-usersAttendanceti-calendar-checkGradebookti-reportAnalyticsti-chart-barLesson Logs (DLL)ti-notebookAssessmentsti-clipboard-textFacultyti-schoolInventoryti-packageGate / QRti-qrcodeAI toolsti-sparklesExport / SF2ti-file-exportAlertti-bell-ringing


9. Component States

Every interactive component must have states defined in Figma:


Default — resting state
Hover — slight bg tint change or border color change
Active/Pressed — subtle scale down or darker bg
Focus — navy 2px outline ring (for accessibility)
Disabled — 40% opacity, not-allowed cursor
Loading — skeleton shimmer (light gray animated bar)
Empty — empty state illustration + CTA (e.g., "No students added yet. Add your first student →")



10. Design Do's and Don'ts

Do


Use 0.5px borders on cards — thinner borders feel more refined
Keep sidebar nav labels short (1–2 words max)
Always pair a status badge with a semantic color (never just gray)
Use sentence case on all labels, buttons, and headings
Show student names as "Surname, First Name" throughout
Use IBM Plex Mono for all numerical data in tables
Keep the gold-500 accent rare — it should feel like a highlight, not a theme color


Don't


Don't use gradients anywhere except the school banner background
Don't use more than 3 font sizes in one card
Don't label buttons "Submit" or "OK" — use specific verbs ("Save grades", "Export SF2", "Generate DLL")
Don't repeat the nav icon and label in the content header — the topbar already shows context
Don't put borders on badge/pill elements if they already have a colored background — choose one
Don't use red for anything other than alerts/failures — it triggers alarm
Don't build modals for simple actions — use inline expand or side panels instead



11. Figma File Structure Recommendation

📁 EskwelaOne+ Design
├── 📄 _Design System
│   ├── Colors (all tokens as styles)
│   ├── Typography (all text styles)
│   ├── Spacing (frame with spacing examples)
│   └── Icons (Tabler icon library frames)
├── 📄 Components
│   ├── Sidebar
│   ├── Topbar
│   ├── Cards (Stat, Class, Alert)
│   ├── Table Rows
│   ├── Badges & Tags
│   ├── Buttons
│   ├── Inputs & Forms
│   └── Modals & Drawers
├── 📄 Teacher Screens
│   ├── 01 Dashboard
│   ├── 02 Class Hub
│   ├── 03 Student Detail
│   ├── 04 Attendance Hub
│   ├── 05 Gradebook
│   ├── 06 Analytics
│   ├── 07 DLL Module
│   └── 08 Assessments
├── 📄 Admin Screens
│   ├── 09 Faculty Dashboard
│   └── 10 Gate Tracking
└── 📄 Flows
    ├── Login → Dashboard
    ├── Add Attendance Flow
    └── Generate DLL Flow


12. Prototype Notes


All class cards → link to Class Hub screen
Student names in any table → link to Student Detail
"Export SF2" → trigger modal showing export preview
"Generate DLL" / "AI Executive Summary" → show loading skeleton state (1.5s) → reveal generated content
Sidebar active state → update on page navigation
Notification bell → slide-in drawer from the right showing alert list



Brief prepared for EskwelaOne+ Figma design work. Align all screen designs to this system before presenting to stakeholders or DepEd reviewers.