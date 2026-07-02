FIGMA PROMPT — EskwelaOne+ Full Design with Login, Original Features, School Colors, and Responsive Layout
Using the existing EskwelaOne+ Figma design as the base, apply the following updates and additions. Keep the same visual language — card components, sidebar nav, top bar with school year/quarter selector. Quarters are now 3 (Q1, Q2, Q3) not 4.

COLOR SCHEME — UPDATE ENTIRE DESIGN
Replace all current accent/primary colors with the official Sindalan NHS color palette:

Sidebar background: deep maroon #6B0F1A or #7B1D1D
Sidebar active item highlight: slightly lighter maroon #9B2335
Primary buttons: maroon #9B2335
Accent / hover states: lighter maroon #B83A4A
Stat card accent dots: maroon
Badges and active indicators: adjust to maroon tones
All instances of blue, navy, green, or purple accent from the original design — replace with maroon variants
White text on maroon backgrounds, maintain contrast ratios
Page background and card backgrounds stay white/light gray — only the accent color changes


0. Login Page

Centered card layout on a light gray or maroon-tinted background
School logo top center inside the card
School name: "Sindalan National High School" + "EskwelaOne+" subtitle
Fields: Email input, Password input
Primary button: "Sign In" (maroon)
No role selector — role is determined automatically after login
Optional: "Forgot password?" link below the button
Footer text: school address or division name
Desktop: centered card 400px width
Mobile: card becomes full screen with padding only


SIDEBAR NAV STRUCTURE
Admin role sees: Dashboard, Students, Attendance, Gradebook, Analytics, Clinic Visits, Behavior Records, Reports, Faculty, Inventory, Gate Tracking
Teacher role sees: Dashboard, Students, Attendance, Gradebook, Reports
Sidebar header shows: school logo, "EskwelaOne+", school name, logged-in user name and role below

1. Student Management Page

Page header: "Student Management" + subtext "Search and manage student records"
Top action row: Export CSV button, Add Section button, Add Student button (primary maroon)
Filter bar: School Year dropdown, Grade Level dropdown, Section dropdown, Status dropdown, Search input (by name, ID, or email), Search button
Gender tabs: Male Students / Female Students with count badge
Table columns: Student ID, First Name, Last Name, Grade & Section, Adviser, Email, Phone, Status (Active badge)
Mobile: each student row becomes a stacked card with all details visible
Match the card and table style of the existing design


2. Gradebook / Scholastic Record Page

Student selector at top: name, grade, section, school year, adviser
Quarterly ratings table: Subject column, Q1, Q2, Q3 columns, Final Rating column, Remarks column (Passed/Failed)
Subjects: Filipino, English, Mathematics, Science, Araling Panlipunan (AP), Edukasyon sa Pagpapakatao (EsP), Technology and Livelihood Education (TLE), MAPEH (Music, Arts, PE, Health as split sub-rows)
General Average row at bottom, auto-computed
Promoted / Retained status badge below general average
Remedial Classes section below main table: columns are Learning Area, Final Rating, Remedial Class Mark, Recomputed Final Grade, Remarks
Print / Export button top right
Mobile: table scrolls horizontally, Subject column stays sticky/frozen on the left
Keep modern card container style from existing design


3. Attendance Page

Monthly calendar grid view with list view toggle
Filters: Grade, Section, Date range
Status indicators per student per day: Present, Absent, Late, Excused — color-coded dots
Summary row per student showing total Present, Absent, Late count
Mobile: calendar compresses to weekly view, list view becomes default


4. Clinic Visits Page

Page header: "Clinic Visits" + subtext "Track student health visits"
Stat card at top: Today's Clinic Visits count (same style as existing dashboard cards)
Filter bar: School Year, Grade, Section, Date range, Search by student name or ID
Add Visit button top right (primary maroon)
Table columns: Student ID, Name, Grade & Section, Date & Time, Complaint/Reason, Action Taken, Handled By, Status
Mobile: each record becomes a stacked card
Admin only visibility


5. Behavior Records Page

Page header: "Behavior Records" + subtext "Track student behavioral incidents"
Stat card at top: Total Incidents count (same dashboard card style)
Filter bar: School Year, Grade, Section, Incident Type (Positive/Negative), Date range
Add Record button top right (primary maroon)
Table columns: Student ID, Name, Grade & Section, Date, Incident Type, Description, Reported By, Status/Action
Mobile: each record becomes a stacked card
Admin only visibility


6. Reports Page

Printable Scholastic Record layout matching DepEd SF9 format
School info header: School Name, Region, District, School ID, Grade, Section, School Year, Adviser Name, Signature line
Same Q1/Q2/Q3 grade table as Gradebook page with Final Rating and Remarks columns
General Average and Promoted/Retained at bottom
Remedial Classes section below
Print-ready: white background, formal layout inside the page content area, surrounding UI keeps the app shell
Export/Print button top right
Mobile: horizontal scroll on the SF9 table, print action still accessible


RESPONSIVE DESIGN REQUIREMENTS
Design frames for 3 breakpoints:

Desktop — 1440px (primary layout, full sidebar + content)
Tablet — 768px (sidebar collapses to icon-only or hidden behind hamburger)
Mobile — 390px (iPhone 14 size, bottom nav or hamburger menu)

Mobile-specific layout rules:

Sidebar becomes a bottom navigation bar with icons only (Dashboard, Students, Attendance, Grades, More)
"More" tab opens a drawer for the rest of the pages
Tables become scrollable cards per row — each student/record becomes a stacked card instead of a table row
Filter bars stack vertically, full width
Stat cards stack 2x2 grid then single column on smallest screens
Buttons full width on mobile
Login page card becomes full screen with padding only
Gradebook table scrolls horizontally, Subject column stays sticky/frozen on left

Tablet-specific layout rules:

Sidebar collapses to icon-only (no labels), expands on hover or tap
Tables stay as tables but with fewer visible columns, horizontal scroll for the rest
Filter bars wrap to 2 rows if needed


GLOBAL RULES

All pages use the same maroon sidebar, top bar, and card component style
Quarter count is 3 (Q1, Q2, Q3) — do not add Q4 anywhere
Tables use alternating row shading, status badges use color (Active = green, Absent = red, At Risk = orange, Pending = yellow) — only primary/accent UI elements shift to maroon
All filter bars: dropdowns left, search input center, primary action button right
Design all pages at all 3 breakpoints: Desktop 1440px, Tablet 768px, Mobile 390px