| Widget | Current Source | Intended Meaning | Existing Real Domain? |
| :--- | :--- | :--- | :--- |
| **KPI: Total Students** | Hardcoded (`"342 Enrolled"`) | Currently Enrolled Students | YES (`Student` / `Enrollment` / `AcademicYear`) |
| **KPI: Total Teachers** | Hardcoded (`"18 Faculty"`) | Total Teacher Accounts | YES (`User` / `Role` = Teacher) |
| **KPI: Total Staff** | Hardcoded (`"8 Staff"`) | Total Staff Accounts | YES (`User` / `Role` = Admin/Nurse/Guidance/etc)? Needs verification |
| **KPI: Active Sections** | Hardcoded (`"12 Sections"`) | Sections in active AY | YES (`Section` / `AcademicYear`) |
| **KPI: Attendance Rate** | Hardcoded (`"94.2%"`) | Gate attendance % | YES (`GateAttendance` vs `Enrollment`) |
| **KPI: Inside School** | `gateAttendance.length` (Context) | Active time-ins today | YES (`GateAttendance` API) |
| **KPI: Teachers Present** | Hardcoded (`"17 / 18"`) | Faculty attendance today | NO (Confirmed missing domain: PRIN-014) |
| **KPI: Active Clinic** | `clinicReferrals.length` | Active clinic cases | YES (`ClinicRecord`? Needs check) |
| **KPI: Discipline Cases** | Hardcoded (`"2 Pending"`) | Pending behavior cases | YES (`BehavioralReport`? Needs check) |
| **AI Executive Summary** | Hardcoded Text | AI Insights | NO (No AI engine/domain) |
| **Critical Alerts** | Hardcoded Array | Urgent multi-domain alerts | UNCERTAIN (Needs check on clinic/behavior urgency status) |
| **Students Requiring Attention** | Hardcoded Array | Academic/Behavioral flags | UNCERTAIN / Completion 4 |
| **Pending Approvals** | Hardcoded Array | Principal actionable approvals | YES (`LeaveRequest`, `DocumentRequest`) |
| **Attendance Overview** | Hardcoded Recharts | Gate attendance breakdown | YES (`GateAttendance`) |
| **Academic Health** | Hardcoded Array | Pass rates, grades | YES (But deferred to Completion 4) |
| **Upcoming Events** | Hardcoded Array | Calendar events | YES (`Event` domain) |
