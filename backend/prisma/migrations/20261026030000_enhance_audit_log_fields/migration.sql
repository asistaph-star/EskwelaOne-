-- AlterTable: Add audit context fields (actor snapshots, category, target label, result, IP, and user agent)
ALTER TABLE "audit_logs" ADD COLUMN "actor_school_id" VARCHAR(100);
ALTER TABLE "audit_logs" ADD COLUMN "actor_role" VARCHAR(50);
ALTER TABLE "audit_logs" ADD COLUMN "category" VARCHAR(50);
ALTER TABLE "audit_logs" ADD COLUMN "target_label" VARCHAR(255);
ALTER TABLE "audit_logs" ADD COLUMN "result" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE "audit_logs" ADD COLUMN "ip_address" VARCHAR(45);
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" VARCHAR(255);

-- CreateIndex
CREATE INDEX "audit_logs_category_idx" ON "audit_logs"("category");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_result_idx" ON "audit_logs"("result");
