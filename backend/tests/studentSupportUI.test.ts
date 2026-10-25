import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDir = path.resolve(__dirname, '../../src');
const aiToolsScreenPath = path.join(frontendDir, 'app/teacher/ai-tools/AIToolsScreen.tsx');
const tSidebarPath = path.join(frontendDir, 'app/teacher/shared/TSidebar.tsx');
const teacherAppPath = path.join(frontendDir, 'app/teacher/TeacherApp.tsx');
const pAcademicsPath = path.join(frontendDir, 'app/principal/analytics/PAcademics.tsx');
const apiPath = path.join(frontendDir, 'api/studentSupport.api.ts');

describe('DIGISKWELA — PHASE C2: STUDENT SUPPORT INSIGHTS UI & CONTRACT VERIFICATION', () => {
  const aiToolsContent = fs.readFileSync(aiToolsScreenPath, 'utf8');
  const tSidebarContent = fs.readFileSync(tSidebarPath, 'utf8');
  const teacherAppContent = fs.readFileSync(teacherAppPath, 'utf8');
  const pAcademicsContent = fs.readFileSync(pAcademicsPath, 'utf8');
  const apiContent = fs.readFileSync(apiPath, 'utf8');

  // ─── 1. Mock Content Removal Proof ──────────────────────────────────────────
  it('C2-MOCK-01: Zero mock content remains in AIToolsScreen.tsx', () => {
    const prohibitedMockStrings = [
      'Espino',
      'Hernandez',
      'Bondoc',
      'Ocampo',
      'On Track',
      'At-Risk',
      'Frequent Tardiness',
      'Approve & Implement',
      'setTimeout',
      'Pedagogical Action Plans',
      'Automated Class Diagnostics',
      'AI Smart Report Generator',
      'Weak Learning Areas',
    ];

    for (const str of prohibitedMockStrings) {
      const regex = new RegExp(`\\b${str}\\b`, 'i');
      expect(aiToolsContent).not.toMatch(regex);
    }
  });

  // ─── 2. Screen & Navigation Renaming ────────────────────────────────────────
  it('C2-RENAME-01: Navigation, sidebar, header, and page titles are renamed to Student Support Insights', () => {
    // Sidebar
    expect(tSidebarContent).toContain('Student Support Insights');
    expect(tSidebarContent).not.toContain('AI Insights & Reports');

    // TeacherApp Topbar
    expect(teacherAppContent).toContain('Student Support Insights');
    expect(teacherAppContent).toContain('Factual classroom attendance, grades, and gradebook records');

    // AIToolsScreen Component Header
    expect(aiToolsContent).toContain('Student Support Insights');
    expect(aiToolsContent).toContain('Factual classroom attendance, grades, and gradebook records from DigiSkwela.');
  });

  // ─── 3. Real API Integration & Dynamic Threshold ────────────────────────────
  it('C2-REAL-API-01: Component queries real C1 API and renders threshold dynamically from metadata', () => {
    // Imports studentSupportApi
    expect(aiToolsContent).toContain('studentSupportApi');
    expect(aiToolsContent).toContain('getTeacherIndicators');

    // Dynamic threshold extraction
    expect(aiToolsContent).toContain('passingGradeThreshold');
    expect(aiToolsContent).toMatch(/threshold\s*=\s*data\?\.metadata\?\.passingGradeThreshold/);

    // Dynamic threshold used in Explanatory Note & table headers
    expect(aiToolsContent).toContain('A recorded term grade below {threshold} in one term is not a final result');
    expect(aiToolsContent).toContain('Recorded Term Grade Below {threshold}');

    // Attendance window from metadata
    expect(aiToolsContent).toContain('attendanceWindow.startDate');
    expect(aiToolsContent).toContain('attendanceWindow.endDate');
    expect(aiToolsContent).toContain('attendanceWindow.timezone');
  });

  // ─── 4. Query Parameter & Filter Contract ──────────────────────────────────
  it('C2-FILTER-01: Filters query sectionId, subjectId, and term correctly', () => {
    expect(apiContent).toContain('getTeacherIndicators');
    expect(apiContent).toContain('sectionId');
    expect(apiContent).toContain('subjectId');
    expect(apiContent).toContain('term');

    // AIToolsScreen has state hooks for all 3 filters
    expect(aiToolsContent).toContain('selectedSection');
    expect(aiToolsContent).toContain('selectedSubject');
    expect(aiToolsContent).toContain('selectedTerm');

    // Calls getTeacherIndicators with filter state
    expect(aiToolsContent).toMatch(/studentSupportApi\.getTeacherIndicators\(\{\s*sectionId:\s*selectedSection\s*\|\|\s*undefined,\s*subjectId:\s*selectedSubject\s*\|\|\s*undefined,\s*term:\s*selectedTerm\s*!==\s*'all'\s*\?\s*selectedTerm\s*:\s*undefined,\s*\}\)/);
  });

  // ─── 5. Prohibited Risk & Predictive Labels ────────────────────────────────
  it('C2-SAFETY-01: AIToolsScreen contains NO risk scores, rankings, predictive labels, or student PII', () => {
    const prohibitedWords = [
      'riskScore',
      'riskLevel',
      'risk_score',
      'risk_level',
      'dropoutProbability',
      'priorityScore',
      'severity',
      'at risk',
      'dropout risk',
      'problematic',
      'ranking',
      'intervention engine',
    ];

    for (const term of prohibitedWords) {
      expect(aiToolsContent).not.toMatch(new RegExp(`\\b${term}\\b`, 'i'));
    }

    // Prohibited PII
    expect(aiToolsContent).not.toContain('lrn');
    expect(aiToolsContent).not.toContain('guardian');
    expect(aiToolsContent).not.toContain('allergies');
    expect(aiToolsContent).not.toContain('medical');
  });

  // ─── 6. Score of 0 Invariant ───────────────────────────────────────────────
  it('C2-ZERO-SCORE-01: Score of 0 is treated as a valid count, never obscured or converted to missing', () => {
    // Missing scores count is directly rendered
    expect(aiToolsContent).toContain('student.missingScoresCount');
    // Direct zero check renders 0
    expect(aiToolsContent).toContain('<span style={{ color: C.t3, fontWeight: 400 }}>0</span>');
  });

  // ─── 7. Honest States ──────────────────────────────────────────────────────
  it('C2-STATES-01: Honest loading, empty, unauthorized, and error states are implemented', () => {
    // Loading: No fake timers
    expect(aiToolsContent).not.toContain('setTimeout');
    expect(aiToolsContent).toContain('Loading student support records...');

    // Empty: Honest copy
    expect(aiToolsContent).toContain('No students with the selected factual indicators were found for these filters.');
    expect(aiToolsContent).not.toMatch(/everyone is doing well/i);

    // Unauthorized (403)
    expect(aiToolsContent).toContain('You are not authorized to view student support indicators');

    // Error & Retry
    expect(aiToolsContent).toContain('Failed to Load Records');
    expect(aiToolsContent).toContain('Retry Loading');
  });

  // ─── 8. Principal Aggregate Card (PAcademics.tsx) ──────────────────────────
  it('C2-PRN-CARD-01: PAcademics contains Student Support Indicators aggregate card with zero individual names or drilldown', () => {
    expect(pAcademicsContent).toContain('Student Support Indicators');
    expect(pAcademicsContent).toContain('studentSupportApi.getPrincipalAggregate');
    expect(pAcademicsContent).toContain('studentsBelowPassingCount');
    expect(pAcademicsContent).toContain('studentsWithThreeOrMoreAbsencesCount');

    // Prohibited risk labels in Principal card
    expect(pAcademicsContent).not.toMatch(/At Risk/i);
    expect(pAcademicsContent).not.toMatch(/Failing Students/i);
    expect(pAcademicsContent).not.toMatch(/Intervention Priority/i);

    // No student names or student IDs rendered in support aggregates table
    const supportAggTable = pAcademicsContent.slice(
      pAcademicsContent.indexOf('Student Support Indicators (Section Aggregates)'),
      pAcademicsContent.indexOf('Top 10 Performers (School-Wide)')
    );
    expect(supportAggTable).not.toContain('studentId');
    expect(supportAggTable).not.toContain('studentName');
    expect(supportAggTable).not.toContain('studentDisplayName');
  });
});
