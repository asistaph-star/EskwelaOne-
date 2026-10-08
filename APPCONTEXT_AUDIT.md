# AppContext Dependency Audit

## Summary
- AppContext Lines: 809
- Exposed Members: 69
- Files using AppContext: 29

## Member Analysis

### currentUser [APP-GLOBAL]
- Used in 14 files.
  - (Used in 14 files. Too many to list.)

### setCurrentUser [CROSS-DOMAIN (Small)]
- Used in 2 files.
  - /app/App.tsx
  - /app/auth/login/LoginScreen.tsx

### updateCurrentUser [UNUSED/LEGACY]
- Used in 0 files.

### isAuthChecking [UNUSED/LEGACY]
- Used in 0 files.

### setIsAuthChecking [UNUSED/LEGACY]
- Used in 0 files.

### excuseLetters [UNUSED/LEGACY]
- Used in 0 files.

### updateExcuseLetter [UNUSED/LEGACY]
- Used in 0 files.

### addExcuseLetter [UNUSED/LEGACY]
- Used in 0 files.

### getExcuseDocument [UNUSED/LEGACY]
- Used in 0 files.

### saveExcuseDocument [UNUSED/LEGACY]
- Used in 0 files.

### deleteExcuseDocument [UNUSED/LEGACY]
- Used in 0 files.

### getGenericDocument [CROSS-DOMAIN (Small)]
- Used in 2 files.
  - /app/student/screens/StudentSettings.tsx
  - /app/teacher/profile/TProfileScreen.tsx

### saveGenericDocument [CROSS-DOMAIN (Small)]
- Used in 2 files.
  - /app/student/screens/StudentSettings.tsx
  - /app/teacher/profile/TProfileScreen.tsx

### students [DOMAIN-SHARED (principal)]
- Used in 2 files.
  - /app/principal/announcements/PAnnouncementsScreen.tsx
  - /app/principal/records/RAcademicRecordsScreen.tsx

### teachers [DOMAIN-SHARED (principal)]
- Used in 2 files.
  - /app/principal/announcements/PAnnouncementsScreen.tsx
  - /app/principal/teachers/PTeachers.tsx

### addTeacher [SCREEN-LOCAL (/app/principal/teachers/PTeachers.tsx)]
- Used in 1 files.
  - /app/principal/teachers/PTeachers.tsx

### addStudent [UNUSED/LEGACY]
- Used in 0 files.

### updateUser [SCREEN-LOCAL (/app/teacher/profile/TProfileScreen.tsx)]
- Used in 1 files.
  - /app/teacher/profile/TProfileScreen.tsx

### teacherLeaves [SCREEN-LOCAL (/app/principal/dashboard/PDashboard.tsx)]
- Used in 1 files.
  - /app/principal/dashboard/PDashboard.tsx

### addTeacherLeave [UNUSED/LEGACY]
- Used in 0 files.

### updateTeacherLeave [UNUSED/LEGACY]
- Used in 0 files.

### announcements [UNUSED/LEGACY]
- Used in 0 files.

### addAnnouncement [UNUSED/LEGACY]
- Used in 0 files.

### assignments [SCREEN-LOCAL (/app/teacher/classroom/AssignmentReviewModal.tsx)]
- Used in 1 files.
  - /app/teacher/classroom/AssignmentReviewModal.tsx

### addAssignment [UNUSED/LEGACY]
- Used in 0 files.

### updateAssignment [UNUSED/LEGACY]
- Used in 0 files.

### assignmentSubmissions [SCREEN-LOCAL (/app/teacher/classroom/AssignmentReviewModal.tsx)]
- Used in 1 files.
  - /app/teacher/classroom/AssignmentReviewModal.tsx

### addAssignmentSubmission [UNUSED/LEGACY]
- Used in 0 files.

### updateAssignmentSubmission [SCREEN-LOCAL (/app/teacher/classroom/AssignmentReviewModal.tsx)]
- Used in 1 files.
  - /app/teacher/classroom/AssignmentReviewModal.tsx

### notifications [CROSS-DOMAIN (Small)]
- Used in 5 files.
  - /app/guidance/GuidanceApp.tsx
  - /app/nurse/NurseApp.tsx
  - /app/principal/shared/PHeaderBand.tsx
  - /app/shared/components/NotificationDropdown.tsx
  - /app/teacher/TeacherApp.tsx

### addNotification [CROSS-DOMAIN (Small)]
- Used in 3 files.
  - /app/principal/announcements/PAnnouncementsScreen.tsx
  - /app/teacher/appointments/AppointmentsScreen.tsx
  - /app/teacher/profile/TProfileScreen.tsx

### markNotificationsRead [SCREEN-LOCAL (/app/shared/components/NotificationDropdown.tsx)]
- Used in 1 files.
  - /app/shared/components/NotificationDropdown.tsx

### markSingleNotificationRead [SCREEN-LOCAL (/app/shared/components/NotificationDropdown.tsx)]
- Used in 1 files.
  - /app/shared/components/NotificationDropdown.tsx

### events [SCREEN-LOCAL (/app/student/screens/StudentCalendar.tsx)]
- Used in 1 files.
  - /app/student/screens/StudentCalendar.tsx

### addEvent [UNUSED/LEGACY]
- Used in 0 files.

### editEvent [UNUSED/LEGACY]
- Used in 0 files.

### deleteEvent [UNUSED/LEGACY]
- Used in 0 files.

### messages [UNUSED/LEGACY]
- Used in 0 files.

### addMessage [UNUSED/LEGACY]
- Used in 0 files.

### gateAttendance [CROSS-DOMAIN (Small)]
- Used in 3 files.
  - /app/principal/dashboard/PDashboard.tsx
  - /app/principal/monitoring/PMonitoring.tsx
  - /app/teacher/attendance/AttendanceHub.tsx

### invalidScans [SCREEN-LOCAL (/app/principal/monitoring/PMonitoring.tsx)]
- Used in 1 files.
  - /app/principal/monitoring/PMonitoring.tsx

### addInvalidScan [SCREEN-LOCAL (/app/shared/hooks/useGateAttendanceSSE.ts)]
- Used in 1 files.
  - /app/shared/hooks/useGateAttendanceSSE.ts

### refreshGateAttendance [SCREEN-LOCAL (/app/shared/hooks/useGateAttendanceSSE.ts)]
- Used in 1 files.
  - /app/shared/hooks/useGateAttendanceSSE.ts

### addGateAttendance [UNUSED/LEGACY]
- Used in 0 files.

### updateGateAttendance [UNUSED/LEGACY]
- Used in 0 files.

### clinicReferrals [SCREEN-LOCAL (/app/principal/dashboard/PDashboard.tsx)]
- Used in 1 files.
  - /app/principal/dashboard/PDashboard.tsx

### addClinicReferral [UNUSED/LEGACY]
- Used in 0 files.

### resolveClinicReferral [UNUSED/LEGACY]
- Used in 0 files.

### clinicVisitRecords [UNUSED/LEGACY]
- Used in 0 files.

### addClinicVisitRecord [UNUSED/LEGACY]
- Used in 0 files.

### behaviorLogs [SCREEN-LOCAL (/app/shared/reports/BehavioralReports.tsx)]
- Used in 1 files.
  - /app/shared/reports/BehavioralReports.tsx

### addBehaviorLog [UNUSED/LEGACY]
- Used in 0 files.

### updateBehaviorLog [UNUSED/LEGACY]
- Used in 0 files.

### appointments [UNUSED/LEGACY]
- Used in 0 files.

### addAppointment [UNUSED/LEGACY]
- Used in 0 files.

### updateAppointment [UNUSED/LEGACY]
- Used in 0 files.

### studentRecords [SCREEN-LOCAL (/app/guidance/records/GStudentRecordsScreen.tsx)]
- Used in 1 files.
  - /app/guidance/records/GStudentRecordsScreen.tsx

### counselingLogs [SCREEN-LOCAL (/app/guidance/records/GStudentRecordsScreen.tsx)]
- Used in 1 files.
  - /app/guidance/records/GStudentRecordsScreen.tsx

### addCounselingLog [UNUSED/LEGACY]
- Used in 0 files.

### documentRequests [CROSS-DOMAIN (Small)]
- Used in 3 files.
  - /app/principal/dashboard/RDashboard.tsx
  - /app/principal/documents/RDocRequestsScreen.tsx
  - /app/teacher/documents/DocRequestsScreen.tsx

### addDocumentRequest [UNUSED/LEGACY]
- Used in 0 files.

### updateDocumentRequest [CROSS-DOMAIN (Small)]
- Used in 2 files.
  - /app/principal/documents/RDocRequestsScreen.tsx
  - /app/teacher/documents/DocRequestsScreen.tsx

### systemAccounts [UNUSED/LEGACY]
- Used in 0 files.

### deleteAccount [UNUSED/LEGACY]
- Used in 0 files.

### resetPassword [UNUSED/LEGACY]
- Used in 0 files.

### enrollmentApplications [SCREEN-LOCAL (/app/principal/enrollment/REnrollmentScreen.tsx)]
- Used in 1 files.
  - /app/principal/enrollment/REnrollmentScreen.tsx

### enrollmentError [SCREEN-LOCAL (/app/principal/enrollment/REnrollmentScreen.tsx)]
- Used in 1 files.
  - /app/principal/enrollment/REnrollmentScreen.tsx

### addEnrollmentApplication [SCREEN-LOCAL (/app/principal/enrollment/REnrollmentScreen.tsx)]
- Used in 1 files.
  - /app/principal/enrollment/REnrollmentScreen.tsx

### updateEnrollmentApplication [SCREEN-LOCAL (/app/principal/enrollment/REnrollmentScreen.tsx)]
- Used in 1 files.
  - /app/principal/enrollment/REnrollmentScreen.tsx

