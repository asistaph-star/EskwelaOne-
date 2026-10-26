import { beforeAll, afterAll } from 'vitest';
import prisma from '../../src/config/database.js';
import {
  assertTestDatabaseIsolation,
  verifyDatabaseIdentity,
} from '../../src/config/databaseGuard.js';

let databaseVerified = false;

/**
 * Global Test Environment and Database Guard.
 * Executed before test suites run in Vitest.
 * 1. Confirms database configuration isolation (fails fast if target is production or development).
 * 2. Positively verifies actual PostgreSQL database identity via SELECT current_database().
 * 3. Enforces Student RBAC invariant within the dedicated test database.
 */

export async function assertStudentClinicRbacInvariant(): Promise<void> {
  const studentRole = await prisma.role.findUnique({
    where: { name: 'Student' },
    include: {
      role_permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!studentRole) return;

  const forbiddenKeys = ['clinic:read', 'clinic:write'];
  const dangerousMappings = studentRole.role_permissions.filter(rp =>
    forbiddenKeys.includes(rp.permission.key)
  );

  if (dangerousMappings.length > 0) {
    throw new Error(
      `[RBAC_INVARIANT_VIOLATION] Student role has unauthorized permissions: ${dangerousMappings
        .map(rp => rp.permission.key)
        .join(', ')}. Tests must clean up their own fixtures and not persist role modifications.`
    );
  }
}

/**
 * Scoped cleanup helper for characterization tests.
 * Only executes if current connected database is verified to be digiskwela_test.
 */
export async function enforceStudentClinicRbacInvariant(): Promise<void> {
  const identity = await verifyDatabaseIdentity(prisma);
  if (identity.database !== 'digiskwela_test') {
    throw new Error(
      `[UNSAFE_CLEANUP_BLOCKED] Refusing cleanup: target is "${identity.database}", not "digiskwela_test".`
    );
  }

  const studentRole = await prisma.role.findUnique({
    where: { name: 'Student' },
    include: {
      role_permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!studentRole) return;

  const forbiddenKeys = ['clinic:read', 'clinic:write'];
  const dangerousMappings = studentRole.role_permissions.filter(rp =>
    forbiddenKeys.includes(rp.permission.key)
  );

  if (dangerousMappings.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: {
        role_id: studentRole.id,
        permission_id: { in: dangerousMappings.map(rp => rp.permission_id) },
      },
    });
  }
}

beforeAll(async () => {
  // 1. Static environment configuration guard
  assertTestDatabaseIsolation(process.env);

  // 2. Dynamic runtime PostgreSQL identity verification
  if (!databaseVerified) {
    const identity = await verifyDatabaseIdentity(prisma);
    if (!process.env.SILENT_TEST_GUARD) {
      console.log(`[TEST_DB_GUARD] Connected database: ${identity.database} (user: ${identity.user})`);
    }
    databaseVerified = true;
  }

  // 3. RBAC baseline invariant check
  await assertStudentClinicRbacInvariant();
});

afterAll(async () => {
  // Post-test assertion: verify no test corrupted the Student role
  await assertStudentClinicRbacInvariant();
});
