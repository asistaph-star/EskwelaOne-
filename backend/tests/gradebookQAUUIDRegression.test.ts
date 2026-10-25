import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { config } from '../src/config/env.js';
import { generateId } from '../src/common/utils/uuid.js';
import { saveLedger } from '../src/gradebooks/ledger.service.js';

describe('DIGISKWELA — Gradebook QA Column UUID Regression Gate', () => {
  const teacherUserId = 'demo-teacher-1';
  const classAssignmentId = 'demo-assign-1';
  let teacherToken: string;

  async function cleanupGradebookData() {
    const gbs = await prisma.gradebooks.findMany({ where: { assignment_id: classAssignmentId } });
    for (const gb of gbs) {
      await prisma.grade_entries.deleteMany({
        where: { column: { gradebook_id: gb.id } }
      });
      await prisma.gradebook_columns.deleteMany({
        where: { gradebook_id: gb.id }
      });
      await prisma.gradebooks.delete({
        where: { id: gb.id }
      });
    }
  }

  beforeAll(async () => {
    teacherToken = sign({ userId: teacherUserId }, config.jwt.secret, { expiresIn: '1h' });
    await cleanupGradebookData();
  });

  afterAll(async () => {
    await cleanupGradebookData();
    await prisma.$disconnect();
  });

  it('proves saveLedger persists fresh gradebook, WW, PT, and QA columns with valid 36-char UUIDs without P2000', async () => {
    const ww1Id = generateId();
    const ww2Id = generateId();
    const pt1Id = generateId();

    const termsPayload = {
      T1: {
        wwItems: [
          { id: ww1Id, label: 'Written Work 1', max: 20 },
          { id: ww2Id, label: 'Written Work 2', max: 20 }
        ],
        ptItems: [
          { id: pt1Id, label: 'Performance Task 1', max: 50 }
        ],
        qaMax: 100,
        grades: {}
      }
    };

    // Execute the production saveLedger service
    await expect(saveLedger(classAssignmentId, termsPayload, teacherUserId)).resolves.not.toThrow();

    // 1. Fresh gradebook was created with a normal 36-char UUID
    const createdGb = await prisma.gradebooks.findFirst({
      where: { assignment_id: classAssignmentId, term: { key: 'T1' } }
    });
    expect(createdGb).toBeDefined();
    expect(createdGb!.id).toHaveLength(36);

    // 2. WW columns persisted
    const wwCols = await prisma.gradebook_columns.findMany({
      where: { gradebook_id: createdGb!.id, type: 'WW' },
      orderBy: { sort_order: 'asc' }
    });
    expect(wwCols).toHaveLength(2);
    expect(wwCols[0].id).toBe(ww1Id);
    expect(wwCols[1].id).toBe(ww2Id);

    // 3. PT columns persisted
    const ptCols = await prisma.gradebook_columns.findMany({
      where: { gradebook_id: createdGb!.id, type: 'PT' }
    });
    expect(ptCols).toHaveLength(1);
    expect(ptCols[0].id).toBe(pt1Id);

    // 4. QA / Term Assessment column persisted
    const qaCols = await prisma.gradebook_columns.findMany({
      where: { gradebook_id: createdGb!.id, type: 'QA' }
    });
    expect(qaCols).toHaveLength(1);
    const qaCol = qaCols[0];

    // 5. QA column ID length is <= 36
    expect(qaCol.id.length).toBeLessThanOrEqual(36);
    expect(qaCol.id).toHaveLength(36);

    // 6. QA column type is 'QA'
    expect(qaCol.type).toBe('QA');
    expect(qaCol.label).toBe('Term Assessment');
    expect(qaCol.max_score).toBe(100);
  });

  it('proves POST /api/gradebooks/ledger succeeds over HTTP without Prisma P2000', async () => {
    const ww1Id = generateId();
    const pt1Id = generateId();

    const response = await request(app)
      .post('/api/gradebooks/ledger')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classId: classAssignmentId,
        terms: {
          T1: {
            wwItems: [{ id: ww1Id, label: 'WW1', max: 25 }],
            ptItems: [{ id: pt1Id, label: 'PT1', max: 45 }],
            qaMax: 100,
            grades: {}
          }
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const gb = await prisma.gradebooks.findFirst({
      where: { assignment_id: classAssignmentId, term: { key: 'T1' } }
    });
    expect(gb).toBeDefined();

    const qaCol = await prisma.gradebook_columns.findFirst({
      where: { gradebook_id: gb!.id, type: 'QA' }
    });
    expect(qaCol).toBeDefined();
    expect(qaCol!.id.length).toBeLessThanOrEqual(36);
    expect(qaCol!.id).toHaveLength(36);
    expect(qaCol!.type).toBe('QA');
  });
});
