import { seedFixture } from '../../scripts/seed-teacher-demo-fixture.js';
import { cleanupFixture } from '../../scripts/cleanup-teacher-demo-fixture.js';

/**
 * Setup hook for tests requiring the 24-student Teacher demo fixture.
 * Ensures stale fixture records from aborted runs are cleaned before seeding.
 */
export async function setupTeacherDemoFixture(): Promise<void> {
  await cleanupFixture();
  await seedFixture();
}

/**
 * Teardown hook for tests requiring the 24-student Teacher demo fixture.
 * Ensures all fixture rows are deleted after the test suite completes.
 */
export async function teardownTeacherDemoFixture(): Promise<void> {
  await cleanupFixture();
}
