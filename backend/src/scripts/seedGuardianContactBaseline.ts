import { PrismaClient } from '@prisma/client';
import { fieldEncryptionExtension } from 'prisma-field-encryption';
import { generateId } from '../common/utils/uuid.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Baseline population utility for guardian contact authorization lifecycle.
 * In accordance with Phase 3C.11 Directives:
 * - Decrypts existing student guardian emails using application encryption extension.
 * - Seeds ALL unmigrated guardian contacts with status = 'PENDING_VERIFICATION'.
 * - NEVER automatically marks contacts AUTHORIZED.
 * - Idempotent: skips students who already have an authorization record.
 * - Does not send any emails or OTP messages.
 */
export async function seedGuardianContactBaseline(dbUrl?: string): Promise<{
  databaseName: string;
  totalStudentsWithEmail: number;
  newlySeeded: number;
  alreadyExisting: number;
  invalidContacts: Array<{ studentId: string; email: string; reason: string }>;
  seededRecords: Array<{ studentId: string; maskedEmail: string; status: string }>;
}> {
  const basePrisma = new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
  });
  const client = basePrisma.$extends(fieldEncryptionExtension());

  try {
    const [dbInfo] = await (basePrisma as any).$queryRawUnsafe('SELECT current_database() as db_name');
    console.log(`[BASELINE_SEED] Connected to database: ${dbInfo.db_name}`);

    const students = await client.student.findMany({
      where: {
        guardian_email: { not: null },
      },
      select: {
        id: true,
        lrn: true,
        first_name: true,
        last_name: true,
        guardian_email: true,
        guardian_first_name: true,
        guardian_last_name: true,
      },
    });

    console.log(`[BASELINE_SEED] Found ${students.length} students with non-null guardian_email field`);

    let newlySeeded = 0;
    let alreadyExisting = 0;
    const invalidContacts: Array<{ studentId: string; email: string; reason: string }> = [];
    const seededRecords: Array<{ studentId: string; maskedEmail: string; status: string }> = [];

    for (const student of students) {
      if (!student.guardian_email || !student.guardian_email.trim()) {
        invalidContacts.push({ studentId: student.id, email: '', reason: 'Empty or whitespace email' });
        continue;
      }

      const trimmedEmail = student.guardian_email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        invalidContacts.push({ studentId: student.id, email: trimmedEmail, reason: 'Invalid email syntax' });
        continue;
      }

      const guardianName = [student.guardian_first_name, student.guardian_last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Parent / Guardian';

      // Check if authorization record already exists
      const existing: any[] = await (client as any).$queryRawUnsafe(
        `SELECT id, status FROM public.guardian_contact_authorizations 
         WHERE student_id = $1 AND guardian_email = $2 
         LIMIT 1`,
        student.id,
        trimmedEmail
      );

      if (existing && existing.length > 0) {
        alreadyExisting++;
        continue;
      }

      const id = generateId();
      await (client as any).$executeRawUnsafe(
        `INSERT INTO public.guardian_contact_authorizations (
          id, student_id, guardian_email, guardian_name, status,
          failed_attempts, max_attempts, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'PENDING_VERIFICATION', 0, 5, NOW(), NOW())`,
        id,
        student.id,
        trimmedEmail,
        guardianName
      );

      // Mask email for safe reporting (e.g. j***n@domain.com)
      const parts = trimmedEmail.split('@');
      const masked = parts[0].length <= 2 
        ? parts[0] + '***@' + parts[1] 
        : parts[0][0] + '***' + parts[0][parts[0].length - 1] + '@' + parts[1];

      seededRecords.push({
        studentId: student.id,
        maskedEmail: masked,
        status: 'PENDING_VERIFICATION',
      });

      newlySeeded++;
    }

    return {
      databaseName: dbInfo.db_name,
      totalStudentsWithEmail: students.length,
      newlySeeded,
      alreadyExisting,
      invalidContacts,
      seededRecords,
    };
  } finally {
    await basePrisma.$disconnect();
  }
}

// Allow standalone execution if invoked directly via tsx/node
if (process.argv[1]?.includes('seedGuardianContactBaseline')) {
  seedGuardianContactBaseline(process.env.DATABASE_URL)
    .then((res) => {
      console.log('[BASELINE_SEED] Execution Summary:');
      console.log(`Database: ${res.databaseName}`);
      console.log(`Total students with email: ${res.totalStudentsWithEmail}`);
      console.log(`Newly seeded: ${res.newlySeeded}`);
      console.log(`Already existing: ${res.alreadyExisting}`);
      console.log(`Invalid contacts: ${res.invalidContacts.length}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[BASELINE_SEED] Error:', err);
      process.exit(1);
    });
}
