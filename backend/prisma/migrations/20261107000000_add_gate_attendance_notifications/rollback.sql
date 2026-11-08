-- Non-Destructive Rollback: Gate Attendance Notification Outbox
-- Drops only the additive outbox table without affecting student, gate_attendance, or academic tables.

DROP TABLE IF EXISTS "public"."gate_attendance_notifications" CASCADE;

