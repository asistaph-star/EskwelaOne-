import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';

describe('Phase 5A: Three-Term Academic Configuration Verification', () => {
  let testAyId: string;
  let testT1Id: string;
  let testT2Id: string;
  let testT3Id: string;

  beforeAll(async () => {
    testAyId = generateId();
    testT1Id = generateId();
    testT2Id = generateId();
    testT3Id = generateId();

    // Setup an isolated synthetic academic year in test database
    await prisma.academicYear.create({
      data: {
        id: testAyId,
        name: `SY 2026-2027 Test ${Date.now()}`,
        start_date: new Date('2026-08-01'),
        end_date: new Date('2027-05-31'),
        is_current: false,
      }
    });

    // 1. Initial state: T1 exists
    await prisma.term.create({
      data: {
        id: testT1Id,
        academic_year_id: testAyId,
        name: 'First Quarter',
        key: 'T1'
      }
    });
  });

  afterAll(async () => {
    try {
      await prisma.term.deleteMany({ where: { academic_year_id: testAyId } });
      await prisma.academicYear.delete({ where: { id: testAyId } });
    } catch (e) {
      console.warn('Teardown warning:', e);
    }
  });

  it('1. Renames existing T1 to "First Term" while preserving primary key ID', async () => {
    const updated = await prisma.term.update({
      where: { id: testT1Id },
      data: { name: 'First Term' }
    });

    expect(updated.id).toBe(testT1Id);
    expect(updated.name).toBe('First Term');
    expect(updated.key).toBe('T1');
  });

  it('2. Configures T2 as "Second Term" and T3 as "Third Term"', async () => {
    const t2 = await prisma.term.create({
      data: {
        id: testT2Id,
        academic_year_id: testAyId,
        name: 'Second Term',
        key: 'T2'
      }
    });

    const t3 = await prisma.term.create({
      data: {
        id: testT3Id,
        academic_year_id: testAyId,
        name: 'Third Term',
        key: 'T3'
      }
    });

    expect(t2.name).toBe('Second Term');
    expect(t2.key).toBe('T2');
    expect(t3.name).toBe('Third Term');
    expect(t3.key).toBe('T3');
  });

  it('3. Ensures exactly three terms exist for the academic year', async () => {
    const terms = await prisma.term.findMany({
      where: { academic_year_id: testAyId },
      orderBy: { key: 'asc' }
    });

    expect(terms).toHaveLength(3);
    expect(terms.map(t => t.name)).toEqual(['First Term', 'Second Term', 'Third Term']);
    expect(terms.map(t => t.key)).toEqual(['T1', 'T2', 'T3']);
  });

  it('4. Rejects duplicate term creation for the same key in the same academic year', async () => {
    await expect(
      prisma.term.create({
        data: {
          id: generateId(),
          academic_year_id: testAyId,
          name: 'Duplicate Second Term',
          key: 'T2'
        }
      })
    ).rejects.toThrow();
  });
});
