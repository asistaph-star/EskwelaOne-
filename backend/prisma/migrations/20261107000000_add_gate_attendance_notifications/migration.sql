-- Additive Migration: Gate Attendance Notification Outbox
-- Safe, Non-Destructive Table Addition for DigiSkwela Student Gate Attendance

CREATE TABLE IF NOT EXISTS "public"."gate_attendance_notifications" (
    "id" VARCHAR(36) NOT NULL,
    "attendance_id" VARCHAR(36) NOT NULL,
    "student_id" VARCHAR(36) NOT NULL,
    "event_type" VARCHAR(20) NOT NULL,
    "recipient_role" VARCHAR(20) NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "recipient_name" VARCHAR(200) NOT NULL,
    "punctuality_status" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "error_message" TEXT,
    "brevo_message_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_attendance_notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "gate_attendance_notifications_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."gate_attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gate_attendance_notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_gate_notification_event" ON "public"."gate_attendance_notifications"("attendance_id", "event_type", "recipient_role");
CREATE INDEX IF NOT EXISTS "idx_notification_worker_polling" ON "public"."gate_attendance_notifications"("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "idx_student_notification_history" ON "public"."gate_attendance_notifications"("student_id", "created_at");

