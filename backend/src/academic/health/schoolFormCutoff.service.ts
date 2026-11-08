/**
 * DigiSkwela - Configurable DepEd School Form Cutoff Service
 * 
 * Manages school-form age reference dates per School Year and School Form:
 * - SF1: School Register age calculation reference date (provisional until confirmed).
 * - SF8: Health & Nutrition assessment reference date (strictly measurement-date driven per DO 58 s. 2017).
 * 
 * Configuration is persisted cleanly to local storage without requiring schema alterations or migrations.
 * Preserves historical records: updates to reference dates NEVER rewrite previously recorded health measurements.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuditLog } from '../../audit/audit.service.js';

export interface SchoolFormCutoffConfig {
  academicYear: string;
  formKey: string;
  referenceDate: string | null;
  isProvisional: boolean;
  isMeasurementDateDriven: boolean;
  statusNote: string;
  basis: string;
  updatedByUserId: string | null;
  updatedAt: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.resolve(__dirname, '../../../../backend/storage/config/school_form_cutoffs.json');

// Canonical default cutoffs with verified provisional status for SY 2026–2027
const DEFAULT_CUTOFFS: Record<string, SchoolFormCutoffConfig> = {
  '2026-2027:SF1': {
    academicYear: '2026-2027',
    formKey: 'SF1',
    referenceDate: '2026-06-05',
    isProvisional: true,
    isMeasurementDateDriven: false,
    statusNote: 'PROVISIONAL — AWAITING CALULUT CONFIRMATION (as of 2026-06-05)',
    basis: 'DepEd Order No. 011, s. 2018 / DO 4 s. 2014 first Friday of June baseline',
    updatedByUserId: 'SYSTEM_BOOTSTRAP',
    updatedAt: new Date().toISOString(),
  },
  '2026-2027:SF8': {
    academicYear: '2026-2027',
    formKey: 'SF8',
    referenceDate: null,
    isProvisional: false,
    isMeasurementDateDriven: true,
    statusNote: 'Actual Anthropometric Measurement Date (DepEd Order No. 058, s. 2017)',
    basis: 'DepEd DO 58 s. 2017 mandates nutritional assessment indexed to actual measurement date, NOT school-form cutoff',
    updatedByUserId: 'SYSTEM_BOOTSTRAP',
    updatedAt: new Date().toISOString(),
  },
};

function ensureConfigFile(): Record<string, SchoolFormCutoffConfig> {
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(DEFAULT_CUTOFFS, null, 2), 'utf-8');
      return { ...DEFAULT_CUTOFFS };
    }

    const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CUTOFFS, ...parsed };
  } catch (err) {
    console.warn('[SchoolFormCutoff] Failed to load config from storage, falling back to defaults:', err);
    return { ...DEFAULT_CUTOFFS };
  }
}

function persistConfigFile(data: Record<string, SchoolFormCutoffConfig>) {
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[SchoolFormCutoff] Failed to write config to storage:', err);
  }
}

/**
 * Retrieves the configured reference date for a given academic year and school form.
 */
export function getSchoolFormCutoff(
  academicYear: string = '2026-2027',
  formKey: string = 'SF1'
): SchoolFormCutoffConfig {
  const configs = ensureConfigFile();
  const key = `${academicYear}:${formKey.toUpperCase()}`;

  if (configs[key]) {
    return configs[key];
  }

  // Fallback to SF1 default if specific year is not configured
  if (formKey.toUpperCase() === 'SF1') {
    return {
      academicYear,
      formKey: 'SF1',
      referenceDate: '2026-06-05',
      isProvisional: true,
      isMeasurementDateDriven: false,
      statusNote: `PROVISIONAL — AWAITING CALULUT CONFIRMATION (as of 2026-06-05)`,
      basis: 'DepEd Order No. 011, s. 2018 / DO 4 s. 2014 first Friday of June baseline',
      updatedByUserId: null,
      updatedAt: new Date().toISOString(),
    };
  }

  // SF8 is always measurement-date driven
  return {
    academicYear,
    formKey: 'SF8',
    referenceDate: null,
    isProvisional: false,
    isMeasurementDateDriven: true,
    statusNote: 'Actual Anthropometric Measurement Date (DepEd Order No. 058, s. 2017)',
    basis: 'DepEd DO 58 s. 2017 mandates nutritional assessment indexed to actual measurement date, NOT school-form cutoff',
    updatedByUserId: null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns all active cutoff configurations.
 */
export function listSchoolFormCutoffs(): SchoolFormCutoffConfig[] {
  const configs = ensureConfigFile();
  return Object.values(configs);
}

/**
 * Updates a school form age cutoff reference date.
 * Restricted to School Administrator or Registrar.
 * CRITICAL: Modifying this setting affects future form calculations,
 * and NEVER modifies or rewrites historical StudentHealthMetric records.
 */
export async function updateSchoolFormCutoff(
  academicYear: string,
  formKey: string,
  referenceDate: string,
  isProvisional: boolean,
  basis: string,
  authUserId: string,
  correlationId?: string
): Promise<SchoolFormCutoffConfig> {
  const configs = ensureConfigFile();
  const upperForm = formKey.toUpperCase();
  const key = `${academicYear}:${upperForm}`;

  const statusNote = isProvisional
    ? `PROVISIONAL — AWAITING CALULUT CONFIRMATION (as of ${referenceDate})`
    : `Verified ${upperForm} reference as of ${referenceDate}`;

  const updated: SchoolFormCutoffConfig = {
    academicYear,
    formKey: upperForm,
    referenceDate,
    isProvisional,
    isMeasurementDateDriven: upperForm === 'SF8' ? false : false,
    statusNote,
    basis: basis || 'Authorized school-form institutional configuration',
    updatedByUserId: authUserId,
    updatedAt: new Date().toISOString(),
  };

  configs[key] = updated;
  persistConfigFile(configs);

  await createAuditLog({
    actorUserId: authUserId,
    actorRole: 'ADMIN',
    action: 'SCHOOL_FORM_CUTOFF_UPDATED',
    category: 'ACADEMIC',
    resourceType: 'system_setting',
    resourceId: key,
    targetLabel: `${upperForm} Cutoff ${academicYear} -> ${referenceDate} (${isProvisional ? 'PROVISIONAL' : 'VERIFIED'})`,
    result: 'SUCCESS',
    correlationId,
  }).catch(() => {});

  return updated;
}
