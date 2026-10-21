-- CreateTable
CREATE TABLE "ai_audit_logs" (
    "id" VARCHAR(36) NOT NULL,
    "trace_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "portal" VARCHAR(50) NOT NULL,
    "scope_decision" VARCHAR(50) NOT NULL,
    "tools_requested" JSONB NOT NULL DEFAULT '[]',
    "tools_executed" JSONB NOT NULL DEFAULT '[]',
    "status" VARCHAR(50) NOT NULL,
    "provider_mode" VARCHAR(50) NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "token_usage" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_audit_logs_trace_id_idx" ON "ai_audit_logs"("trace_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_user_id_idx" ON "ai_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_created_at_idx" ON "ai_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "ai_audit_logs_portal_idx" ON "ai_audit_logs"("portal");

-- AddForeignKey
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
