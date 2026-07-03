// ── Shared Calendar Data ──
// School events are locked (set by Principal). Personal events are editable.

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;          // "YYYY-MM-DD"
  time?: string;         // e.g. "08:00 AM" or "14:30"
  type: "academic" | "meeting" | "holiday" | "exam" | "personal";
  color: string;
  locked: boolean;        // true = school event (Principal-set), false = personal
  audience?: "all" | "teachers" | "students";
}

export interface ClassPeriod {
  time: string;
  subject: string;
  teacher: string;
  room: string;
}

// ── School-wide events (set by Principal, locked for Teachers & Students) ──
export const SCHOOL_EVENTS: CalendarEvent[] = [
  { id: "se-1", title: "Flag Ceremony",           date: "2025-06-02", type: "academic",  color: "#7c2d12", locked: true, audience: "all" },
  { id: "se-2", title: "PTA General Assembly",    date: "2025-06-06", type: "meeting",   color: "#1e40af", locked: true, audience: "all" },
  { id: "se-3", title: "Nutrition Month Kick-off", date: "2025-06-09", type: "academic",  color: "#15803d", locked: true, audience: "all" },
  { id: "se-4", title: "Independence Day (No Classes)", date: "2025-06-12", type: "holiday", color: "#b91c1c", locked: true, audience: "all" },
  { id: "se-5", title: "Q1 Diagnostic Exam",      date: "2025-06-16", type: "exam",      color: "#9333ea", locked: true, audience: "students" },
  { id: "se-6", title: "Q1 Diagnostic Exam Day 2", date: "2025-06-17", type: "exam",     color: "#9333ea", locked: true, audience: "students" },
  { id: "se-7", title: "LAC Session — All Teachers", date: "2025-06-13", type: "meeting", color: "#0369a1", locked: true, audience: "teachers" },
  { id: "se-8", title: "Brigada Eskwela",         date: "2025-06-20", type: "academic",  color: "#ca8604", locked: true, audience: "all" },
  { id: "se-9", title: "Foundation Day",           date: "2025-06-25", type: "holiday",   color: "#b91c1c", locked: true, audience: "all" },
  { id: "se-10", title: "SF2 Submission Deadline", date: "2025-06-27", type: "academic",  color: "#ca8604", locked: true, audience: "teachers" },
  { id: "se-11", title: "Quarterly Grades Encoding", date: "2025-06-30", type: "academic", color: "#7c2d12", locked: true, audience: "teachers" },
];

// ── Teacher personal events (editable by the teacher) ──
export const TEACHER_PERSONAL_EVENTS: CalendarEvent[] = [
  { id: "tp-1", title: "Prepare Q1 Lesson Plans", date: "2025-06-05", type: "personal", color: "#0ea5e9", locked: false },
  { id: "tp-2", title: "Grade 10 Remedial Class",  date: "2025-06-11", type: "personal", color: "#0ea5e9", locked: false },
  { id: "tp-3", title: "DLL Review & Update",      date: "2025-06-18", type: "personal", color: "#0ea5e9", locked: false },
  { id: "tp-4", title: "Parent Conference — Santos", date: "2025-06-23", type: "personal", color: "#8b5cf6", locked: false },
];

// ── Class schedule for Grade 10 - Pilot section (Mon–Fri) ──
export const CLASS_SCHEDULE: Record<string, ClassPeriod[]> = {
  Monday: [
    { time: "7:30 – 8:30",  subject: "Filipino",  teacher: "Mrs. Reyes",   room: "Room 201" },
    { time: "8:30 – 9:30",  subject: "English",   teacher: "Ms. Soriano",  room: "Room 201" },
    { time: "9:45 – 10:45", subject: "Math",       teacher: "Mr. Garcia",   room: "Room 203" },
    { time: "10:45 – 11:45", subject: "Science",   teacher: "Mrs. Cruz",    room: "Lab 1" },
    { time: "1:00 – 2:00",  subject: "AP",         teacher: "Mr. Santos",   room: "Room 201" },
    { time: "2:00 – 3:00",  subject: "MAPEH",      teacher: "Coach Dizon",  room: "Gym" },
    { time: "3:15 – 4:15",  subject: "TLE",        teacher: "Mrs. Pangilinan", room: "TLE Lab" },
  ],
  Tuesday: [
    { time: "7:30 – 8:30",  subject: "English",   teacher: "Ms. Soriano",  room: "Room 201" },
    { time: "8:30 – 9:30",  subject: "Math",       teacher: "Mr. Garcia",   room: "Room 203" },
    { time: "9:45 – 10:45", subject: "Science",    teacher: "Mrs. Cruz",    room: "Lab 1" },
    { time: "10:45 – 11:45", subject: "Filipino",  teacher: "Mrs. Reyes",   room: "Room 201" },
    { time: "1:00 – 2:00",  subject: "ESP",        teacher: "Ms. Lim",      room: "Room 202" },
    { time: "2:00 – 3:00",  subject: "AP",         teacher: "Mr. Santos",   room: "Room 201" },
    { time: "3:15 – 4:15",  subject: "MAPEH",      teacher: "Coach Dizon",  room: "Gym" },
  ],
  Wednesday: [
    { time: "7:30 – 8:30",  subject: "Math",       teacher: "Mr. Garcia",   room: "Room 203" },
    { time: "8:30 – 9:30",  subject: "Science",    teacher: "Mrs. Cruz",    room: "Lab 1" },
    { time: "9:45 – 10:45", subject: "Filipino",   teacher: "Mrs. Reyes",   room: "Room 201" },
    { time: "10:45 – 11:45", subject: "English",   teacher: "Ms. Soriano",  room: "Room 201" },
    { time: "1:00 – 2:00",  subject: "TLE",        teacher: "Mrs. Pangilinan", room: "TLE Lab" },
    { time: "2:00 – 3:00",  subject: "ESP",        teacher: "Ms. Lim",      room: "Room 202" },
    { time: "3:15 – 4:15",  subject: "AP",         teacher: "Mr. Santos",   room: "Room 201" },
  ],
  Thursday: [
    { time: "7:30 – 8:30",  subject: "Science",   teacher: "Mrs. Cruz",    room: "Lab 1" },
    { time: "8:30 – 9:30",  subject: "Filipino",   teacher: "Mrs. Reyes",   room: "Room 201" },
    { time: "9:45 – 10:45", subject: "English",    teacher: "Ms. Soriano",  room: "Room 201" },
    { time: "10:45 – 11:45", subject: "Math",      teacher: "Mr. Garcia",   room: "Room 203" },
    { time: "1:00 – 2:00",  subject: "MAPEH",      teacher: "Coach Dizon",  room: "Gym" },
    { time: "2:00 – 3:00",  subject: "TLE",        teacher: "Mrs. Pangilinan", room: "TLE Lab" },
    { time: "3:15 – 4:15",  subject: "ESP",        teacher: "Ms. Lim",      room: "Room 202" },
  ],
  Friday: [
    { time: "7:30 – 8:30",  subject: "AP",         teacher: "Mr. Santos",   room: "Room 201" },
    { time: "8:30 – 9:30",  subject: "Math",       teacher: "Mr. Garcia",   room: "Room 203" },
    { time: "9:45 – 10:45", subject: "Science",    teacher: "Mrs. Cruz",    room: "Lab 1" },
    { time: "10:45 – 11:45", subject: "Filipino",  teacher: "Mrs. Reyes",   room: "Room 201" },
    { time: "1:00 – 2:00",  subject: "English",    teacher: "Ms. Soriano",  room: "Room 201" },
    { time: "2:00 – 3:00",  subject: "MAPEH",      teacher: "Coach Dizon",  room: "Gym" },
    { time: "3:15 – 4:15",  subject: "Club / Homeroom", teacher: "Ms. Soriano", room: "Room 201" },
  ],
};

// Subject color mapping for timetable
export const SUBJECT_COLORS: Record<string, string> = {
  Filipino: "#7c2d12",
  English:  "#1e40af",
  Math:     "#9333ea",
  Science:  "#15803d",
  AP:       "#ca8604",
  MAPEH:    "#0369a1",
  TLE:      "#b45309",
  ESP:      "#0f766e",
  "Club / Homeroom": "#6b7280",
};

// Event type labels & colors
export const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  academic: { label: "Academic",  color: "#7c2d12" },
  meeting:  { label: "Meeting",   color: "#1e40af" },
  holiday:  { label: "Holiday",   color: "#b91c1c" },
  exam:     { label: "Exam",      color: "#9333ea" },
  personal: { label: "Personal",  color: "#0ea5e9" },
};
