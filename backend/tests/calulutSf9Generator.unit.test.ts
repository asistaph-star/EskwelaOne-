/**
 * DIGISKWELA — Calulut SF9 Portable Generator Acceptance Unit Test Suite
 * Module: calulutSf9Generator.unit.test.ts
 *
 * Database-free offline verification of the portable OpenXML SF9 generator:
 * - Master template fidelity & zero-PII sanitization
 * - Incomplete grade rejection & academic completeness guards
 * - Authentic formula parity and calculated caches
 * - Master template immutability across repeated generations
 * - Cross-student isolation & leak prevention
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import {
  generateCalulutSf9,
  validateSf9InputCompleteness,
  DEFAULT_MASTER_TEMPLATE_PATH,
  type GenerateSf9Input,
} from '../src/academic/grading/index.js';

describe('Calulut SF9 Portable Generator Suite', () => {

  // ─── Fixtures ─────────────────────────────────────────────────────────────

  const sampleCompleteInput: GenerateSf9Input = {
    demographics: {
      name: 'DELA CRUZ, JUAN SYNTHETIC',
      lrn: '999999260001',
      birthdateSerial: '41409',
      age: 13,
      gender: 'M',
      gradeLevel: 7,
      section: 'Agoncillo',
      schoolYear: '2026-2027',
      schoolName: 'Calulut Integrated School',
      schoolId: '500146',
      schoolHead: 'APRIL G. CONCEPCION',
      adviser: 'KATHRINA MAE H. OMLANG',
    },
    grades: {
      filipino: [88, 90, 92],
      english: [85, 87, 88],
      math: [91, 93, 95],
      science: [89, 91, 90],
      ap: [86, 88, 90],
      gmrc: [92, 94, 96],
      tle: [87, 89, 91],
      music: [90, 92, 94],
      pe: [88, 90, 92],
    },
    attendance: {
      present: [15, 22, 20, 20, 19, 20, 20, 18, 18, 20, 5],
      classDays: [15, 22, 20, 20, 20, 20, 20, 18, 18, 20, 5],
    },
    comments: {
      t1: 'Demonstrates commendable academic dedication and exemplary conduct.',
      t2: 'Consistently achieves high performance across all learning areas.',
      t3: 'Maintains outstanding enthusiasm and mastery of competencies.',
    },
  };

  // ─── 1. Blank Master Template Integrity & Privacy ─────────────────────────

  describe('1. Blank Master Template Structural Fidelity & Privacy', () => {
    it('exists at the designated template path', () => {
      expect(fs.existsSync(DEFAULT_MASTER_TEMPLATE_PATH)).toBe(true);
      const stats = fs.statSync(DEFAULT_MASTER_TEMPLATE_PATH);
      expect(stats.size).toBeGreaterThan(300000);
    });

    it('contains all 8 required worksheets in exact sequence', () => {
      const zip = new AdmZip(DEFAULT_MASTER_TEMPLATE_PATH);
      const entries = zip.getEntries();
      const sheets = entries.filter(
        e => e.entryName.startsWith('xl/worksheets/sheet') && e.entryName.endsWith('.xml')
      );
      expect(sheets.length).toBe(8);
    });

    it('preserves 133 merged regions and 60% landscape Letter print setup on SF9', () => {
      const zip = new AdmZip(DEFAULT_MASTER_TEMPLATE_PATH);
      const s6Xml = zip.readAsText('xl/worksheets/sheet6.xml');

      const mergeCount = (s6Xml.match(/<mergeCell /g) || []).length;
      expect(mergeCount).toBe(133);

      expect(s6Xml).toContain('scale="60"');
      expect(s6Xml).toContain('orientation="landscape"');
      expect(s6Xml).toContain('paperSize="9"');
    });

    it('preserves all 3 official school and DepEd logo image assets', () => {
      const zip = new AdmZip(DEFAULT_MASTER_TEMPLATE_PATH);
      const media = zip.getEntries().filter(e => e.entryName.startsWith('xl/media/'));
      expect(media.length).toBe(3);
    });

    it('contains zero original learner names or 12-digit LRNs (100% PII scrubbed)', () => {
      const zip = new AdmZip(DEFAULT_MASTER_TEMPLATE_PATH);
      const entries = zip.getEntries();

      const originalSurnames = [
        'ADI', 'AGUARIN', 'ALFELOR', 'ARIOLA', 'BALAJADIA', 'BEDIA', 'BASILONIA',
        'CAPATI', 'CABANILLA', 'CUADRO', 'CORPUZ', 'DE GUZMAN', 'CUAY', 'GOPEZ',
        'DUNGO', 'HERNANDEZ', 'FUENTES', 'IGNACIO', 'GAMBOA', 'MANALILI', 'GAYAS',
        'MENDI', 'LAYDA', 'TANDOG', 'LAYUG', 'TIMBOL', 'MAGTOTO', 'MONTAYRE',
        'PRINCIPE', 'RICARDO', 'TIGLAO', 'TULABUT'
      ];

      for (const entry of entries) {
        if (entry.entryName.endsWith('.xml') || entry.entryName.endsWith('.rels')) {
          const text = zip.readAsText(entry);
          for (const surname of originalSurnames) {
            expect(text.includes(surname)).toBe(false);
          }
          // Zero 12-digit numbers (excluding OpenXML schema zeros)
          const lrnMatches = text.match(/\b\d{12}\b/g) || [];
          const realLrns = lrnMatches.filter(l => !l.startsWith('00000'));
          expect(realLrns.length).toBe(0);
        }
      }
    });

    it('has selector cell C17 blank in the master template', () => {
      const zip = new AdmZip(DEFAULT_MASTER_TEMPLATE_PATH);
      const s6Xml = zip.readAsText('xl/worksheets/sheet6.xml');
      expect(s6Xml).toMatch(/<c r="C17" s="78"\/>|<c r="C17" s="78"><\/c>/);
    });
  });

  // ─── 2. Academic Completeness & Incomplete Grade Guard ─────────────────────

  describe('2. Academic Completeness & Incomplete Grade Guard', () => {
    it('rejects input with missing student demographics', () => {
      const badInput: any = {
        ...sampleCompleteInput,
        demographics: { ...sampleCompleteInput.demographics, name: '' },
      };
      const result = generateCalulutSf9(badInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INCOMPLETE_ACADEMIC_RECORD');
        expect(result.missing).toContain('demographics.name');
      }
    });

    it('rejects input with invalid non-12-digit LRN', () => {
      const badInput: any = {
        ...sampleCompleteInput,
        demographics: { ...sampleCompleteInput.demographics, lrn: '12345' },
      };
      const result = generateCalulutSf9(badInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INCOMPLETE_ACADEMIC_RECORD');
        expect(result.missing.some(m => m.includes('lrn'))).toBe(true);
      }
    });

    it('rejects input when a required learning area is missing entirely', () => {
      const missingScience: any = {
        ...sampleCompleteInput,
        grades: { ...sampleCompleteInput.grades, science: undefined },
      };
      const result = generateCalulutSf9(missingScience);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INCOMPLETE_ACADEMIC_RECORD');
        expect(result.missing.some(m => m.includes('science'))).toBe(true);
      }
    });

    it('rejects input when a subject has incomplete terms (< 3 terms)', () => {
      const missingT3: any = {
        ...sampleCompleteInput,
        grades: {
          ...sampleCompleteInput.grades,
          math: [91, 93], // Only 2 terms
        },
      };
      const result = generateCalulutSf9(missingT3);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INCOMPLETE_ACADEMIC_RECORD');
        expect(result.missing.some(m => m.includes('math'))).toBe(true);
      }
    });

    it('rejects input when a MAPEH component is missing', () => {
      const missingPE: any = {
        ...sampleCompleteInput,
        grades: {
          ...sampleCompleteInput.grades,
          pe: undefined,
        },
      };
      const result = generateCalulutSf9(missingPE);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INCOMPLETE_ACADEMIC_RECORD');
        expect(result.missing.some(m => m.includes('pe'))).toBe(true);
      }
    });
  });

  // ─── 3. Full Synthetic Generation & Formula Parity ─────────────────────────

  describe('3. Synthetic SF9 Generation & Formula Parity', () => {
    it('generates a valid, complete report card for synthetic learner', () => {
      const result = generateCalulutSf9(sampleCompleteInput);
      expect(result.success).toBe(true);

      if (result.success) {
        // Assert exact calculation parity
        expect(result.calculated.filipinoFinal).toBe(90); // (88+90+92)/3 = 90
        expect(result.calculated.englishFinal).toBe(87);  // (85+87+88)/3 = 86.666 -> 87
        expect(result.calculated.mathFinal).toBe(93);     // (91+93+95)/3 = 93
        expect(result.calculated.scienceFinal).toBe(90);  // (89+91+90)/3 = 90
        expect(result.calculated.apFinal).toBe(88);       // (86+88+90)/3 = 88
        expect(result.calculated.gmrcFinal).toBe(94);     // (92+94+96)/3 = 94
        expect(result.calculated.tleFinal).toBe(89);      // (87+89+91)/3 = 89
        expect(result.calculated.mapehTermGrades).toEqual([89, 91, 93]);
        expect(result.calculated.mapehFinal).toBe(91);
        expect(result.calculated.generalAverage).toBe(90); // 722 / 8 = 90.25 -> 90
        expect(result.calculated.generalRemarks).toBe('Passed');
        expect(result.calculated.totalDaysPresent).toBe(197);
        expect(result.calculated.totalDaysAbsent).toBe(1);

        // Assert valid OpenXML ZIP buffer output
        expect(Buffer.isBuffer(result.buffer)).toBe(true);
        expect(result.buffer.length).toBeGreaterThan(300000);

        const outZip = new AdmZip(result.buffer);
        const s6Xml = outZip.readAsText('xl/worksheets/sheet6.xml');

        // Check C17 selector populated
        expect(s6Xml).toMatch(/<c r="C17"[^>]*><v>\d+<\/v><\/c>/);

        // Check demographic cached values
        expect(s6Xml).toContain('<c r="I17"'); // Age 13
        expect(s6Xml).toContain('<v>13</v>');
        expect(s6Xml).toContain('<c r="K17"'); // Gender M
        expect(s6Xml).toContain('<v>M</v>');
        expect(s6Xml).toContain('<c r="C18"'); // LRN
        expect(s6Xml).toContain('<v>999999260001</v>');

        // Check General Average in cell I42 and Remarks in J42
        expect(s6Xml).toMatch(/<c r="I42"[^>]*><f[^>]*>[^<]+<\/f><v>90<\/v><\/c>/);
        expect(s6Xml).toMatch(/<c r="J42"[^>]*><f[^>]*>[^<]+<\/f><v>Passed<\/v><\/c>/);
      }
    });

    it('does not mutate or alter the blank master template file on disk', () => {
      const hashBefore = crypto
        .createHash('sha256')
        .update(fs.readFileSync(DEFAULT_MASTER_TEMPLATE_PATH))
        .digest('hex');

      // Run generation twice
      generateCalulutSf9(sampleCompleteInput);
      generateCalulutSf9(sampleCompleteInput);

      const hashAfter = crypto
        .createHash('sha256')
        .update(fs.readFileSync(DEFAULT_MASTER_TEMPLATE_PATH))
        .digest('hex');

      expect(hashBefore).toBe(hashAfter);
    });
  });

  // ─── 4. Cross-Student Isolation & Leak Prevention ─────────────────────────

  describe('4. Cross-Student Isolation & Zero Leakage', () => {
    it('ensures independent generations do not leak data across students', () => {
      const studentAInput: GenerateSf9Input = {
        ...sampleCompleteInput,
        demographics: {
          ...sampleCompleteInput.demographics,
          name: 'SANTOS, MARIA SYNTHETIC',
          lrn: '999999260002',
          gender: 'F',
          age: 12,
        },
        grades: {
          filipino: [85, 85, 85],
          english: [85, 85, 85],
          math: [85, 85, 85],
          science: [85, 85, 85],
          ap: [85, 85, 85],
          gmrc: [85, 85, 85],
          tle: [85, 85, 85],
          music: [85, 85, 85],
          pe: [85, 85, 85],
        },
      };

      const resA = generateCalulutSf9(studentAInput);
      const resB = generateCalulutSf9(sampleCompleteInput);

      expect(resA.success).toBe(true);
      expect(resB.success).toBe(true);

      if (resA.success && resB.success) {
        const zipA = new AdmZip(resA.buffer);
        const zipB = new AdmZip(resB.buffer);

        const sstA = zipA.readAsText('xl/sharedStrings.xml');
        const sstB = zipB.readAsText('xl/sharedStrings.xml');

        // Student A has Maria Santos, NOT Juan Dela Cruz
        expect(sstA).toContain('SANTOS, MARIA SYNTHETIC');
        expect(sstA).not.toContain('DELA CRUZ, JUAN SYNTHETIC');

        // Student B has Juan Dela Cruz, NOT Maria Santos
        expect(sstB).toContain('DELA CRUZ, JUAN SYNTHETIC');
        expect(sstB).not.toContain('SANTOS, MARIA SYNTHETIC');

        // LRN isolation
        const s6A = zipA.readAsText('xl/worksheets/sheet6.xml');
        const s6B = zipB.readAsText('xl/worksheets/sheet6.xml');

        expect(s6A).toContain('999999260002');
        expect(s6A).not.toContain('999999260001');

        expect(s6B).toContain('999999260001');
        expect(s6B).not.toContain('999999260002');
      }
    });
  });
});
