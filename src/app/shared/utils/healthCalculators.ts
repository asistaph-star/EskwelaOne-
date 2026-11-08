/**
 * DigiSkwela - Frontend Health, Age & WHO 2007 BMI/HFA Calculations
 * 
 * Mirrors the authoritative backend engines conforming to:
 * - DepEd Order No. 058, s. 2017 (SF8 Health and Nutrition)
 * - DepEd Order No. 011, s. 2018 (SF1 School Register)
 * - WHO Growth Reference 2007 for 5-19 years
 */

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface DetailedAge {
  years: number;
  months: number;
  totalMonths: number;
  formatted: string;
}

export type BmiNutritionalStatus =
  | 'Severely Wasted'
  | 'Wasted'
  | 'Normal'
  | 'Overweight'
  | 'Obese'
  | 'Pending Verification / Not Calculated';

export type HfaNutritionalStatus =
  | 'Severely Stunted'
  | 'Stunted'
  | 'Normal'
  | 'Tall'
  | 'Pending Verification / Not Calculated';

export interface WhoBmiCutoffs {
  sdMinus3: number;
  sdMinus2: number;
  median: number;
  sdPlus1: number;
  sdPlus2: number;
}

export interface WhoHfaCutoffs {
  sdMinus3: number;
  sdMinus2: number;
  median: number;
  sdPlus2: number;
}

export const WHO_BMI_BOYS: Record<number, WhoBmiCutoffs> = {
  5:  { sdMinus3: 12.1, sdMinus2: 13.0, median: 15.3, sdPlus1: 16.6, sdPlus2: 18.3 },
  6:  { sdMinus3: 12.1, sdMinus2: 13.0, median: 15.3, sdPlus1: 16.8, sdPlus2: 18.5 },
  7:  { sdMinus3: 12.3, sdMinus2: 13.1, median: 15.5, sdPlus1: 17.0, sdPlus2: 19.0 },
  8:  { sdMinus3: 12.4, sdMinus2: 13.3, median: 15.7, sdPlus1: 17.4, sdPlus2: 19.7 },
  9:  { sdMinus3: 12.6, sdMinus2: 13.5, median: 16.0, sdPlus1: 17.9, sdPlus2: 20.5 },
  10: { sdMinus3: 12.8, sdMinus2: 13.7, median: 16.4, sdPlus1: 18.5, sdPlus2: 21.4 },
  11: { sdMinus3: 13.1, sdMinus2: 14.1, median: 16.9, sdPlus1: 19.2, sdPlus2: 22.5 },
  12: { sdMinus3: 13.4, sdMinus2: 14.5, median: 17.5, sdPlus1: 19.9, sdPlus2: 23.6 },
  13: { sdMinus3: 13.8, sdMinus2: 14.9, median: 18.2, sdPlus1: 20.8, sdPlus2: 24.8 },
  14: { sdMinus3: 14.3, sdMinus2: 15.4, median: 19.0, sdPlus1: 21.7, sdPlus2: 25.9 },
  15: { sdMinus3: 14.7, sdMinus2: 15.9, median: 19.8, sdPlus1: 22.6, sdPlus2: 26.9 },
  16: { sdMinus3: 15.1, sdMinus2: 16.5, median: 20.5, sdPlus1: 23.5, sdPlus2: 27.9 },
  17: { sdMinus3: 15.4, sdMinus2: 16.9, median: 21.1, sdPlus1: 24.3, sdPlus2: 28.6 },
  18: { sdMinus3: 15.7, sdMinus2: 17.3, median: 21.7, sdPlus1: 25.0, sdPlus2: 29.3 },
  19: { sdMinus3: 15.9, sdMinus2: 17.6, median: 22.0, sdPlus1: 25.5, sdPlus2: 29.8 },
};

export const WHO_BMI_GIRLS: Record<number, WhoBmiCutoffs> = {
  5:  { sdMinus3: 11.7, sdMinus2: 12.7, median: 15.2, sdPlus1: 16.9, sdPlus2: 19.0 },
  6:  { sdMinus3: 11.7, sdMinus2: 12.7, median: 15.3, sdPlus1: 17.0, sdPlus2: 19.2 },
  7:  { sdMinus3: 11.8, sdMinus2: 12.7, median: 15.4, sdPlus1: 17.3, sdPlus2: 19.8 },
  8:  { sdMinus3: 11.9, sdMinus2: 12.9, median: 15.7, sdPlus1: 17.7, sdPlus2: 20.6 },
  9:  { sdMinus3: 12.1, sdMinus2: 13.1, median: 16.1, sdPlus1: 18.3, sdPlus2: 21.5 },
  10: { sdMinus3: 12.4, sdMinus2: 13.5, median: 16.6, sdPlus1: 19.0, sdPlus2: 22.6 },
  11: { sdMinus3: 12.7, sdMinus2: 13.9, median: 17.2, sdPlus1: 19.9, sdPlus2: 23.7 },
  12: { sdMinus3: 13.2, sdMinus2: 14.4, median: 18.0, sdPlus1: 20.8, sdPlus2: 25.0 },
  13: { sdMinus3: 13.6, sdMinus2: 14.9, median: 18.8, sdPlus1: 21.8, sdPlus2: 26.2 },
  14: { sdMinus3: 14.0, sdMinus2: 15.4, median: 19.6, sdPlus1: 22.7, sdPlus2: 27.3 },
  15: { sdMinus3: 14.4, sdMinus2: 15.9, median: 20.2, sdPlus1: 23.5, sdPlus2: 28.2 },
  16: { sdMinus3: 14.6, sdMinus2: 16.2, median: 20.7, sdPlus1: 24.1, sdPlus2: 28.9 },
  17: { sdMinus3: 14.7, sdMinus2: 16.4, median: 21.0, sdPlus1: 24.5, sdPlus2: 29.3 },
  18: { sdMinus3: 14.7, sdMinus2: 16.4, median: 21.3, sdPlus1: 24.8, sdPlus2: 29.5 },
  19: { sdMinus3: 14.7, sdMinus2: 16.5, median: 21.4, sdPlus1: 25.0, sdPlus2: 29.7 },
};

export const WHO_HFA_BOYS: Record<number, WhoHfaCutoffs> = {
  5:  { sdMinus3: 98.7,  sdMinus2: 103.3, median: 110.0, sdPlus2: 116.7 },
  6:  { sdMinus3: 104.9, sdMinus2: 109.6, median: 116.0, sdPlus2: 123.1 },
  7:  { sdMinus3: 110.5, sdMinus2: 115.3, median: 121.7, sdPlus2: 129.2 },
  8:  { sdMinus3: 115.7, sdMinus2: 120.6, median: 127.3, sdPlus2: 135.2 },
  9:  { sdMinus3: 120.5, sdMinus2: 125.6, median: 132.6, sdPlus2: 140.8 },
  10: { sdMinus3: 125.0, sdMinus2: 130.4, median: 137.8, sdPlus2: 146.4 },
  11: { sdMinus3: 129.5, sdMinus2: 135.2, median: 143.1, sdPlus2: 152.2 },
  12: { sdMinus3: 134.3, sdMinus2: 140.3, median: 149.1, sdPlus2: 159.0 },
  13: { sdMinus3: 140.3, sdMinus2: 147.0, median: 156.0, sdPlus2: 166.5 },
  14: { sdMinus3: 147.0, sdMinus2: 154.0, median: 163.2, sdPlus2: 174.0 },
  15: { sdMinus3: 153.0, sdMinus2: 160.0, median: 169.0, sdPlus2: 179.8 },
  16: { sdMinus3: 156.8, sdMinus2: 163.5, median: 172.7, sdPlus2: 183.4 },
  17: { sdMinus3: 158.8, sdMinus2: 165.2, median: 174.4, sdPlus2: 185.1 },
  18: { sdMinus3: 159.6, sdMinus2: 165.9, median: 175.1, sdPlus2: 185.8 },
  19: { sdMinus3: 159.8, sdMinus2: 166.3, median: 175.4, sdPlus2: 186.0 },
};

export const WHO_HFA_GIRLS: Record<number, WhoHfaCutoffs> = {
  5:  { sdMinus3: 98.0,  sdMinus2: 102.7, median: 109.4, sdPlus2: 116.1 },
  6:  { sdMinus3: 103.9, sdMinus2: 108.6, median: 115.1, sdPlus2: 122.2 },
  7:  { sdMinus3: 109.3, sdMinus2: 114.1, median: 120.8, sdPlus2: 128.2 },
  8:  { sdMinus3: 114.4, sdMinus2: 119.5, median: 126.6, sdPlus2: 134.4 },
  9:  { sdMinus3: 119.5, sdMinus2: 125.0, median: 132.5, sdPlus2: 140.7 },
  10: { sdMinus3: 124.7, sdMinus2: 130.5, median: 138.6, sdPlus2: 147.4 },
  11: { sdMinus3: 130.4, sdMinus2: 136.7, median: 145.0, sdPlus2: 154.4 },
  12: { sdMinus3: 136.0, sdMinus2: 142.5, median: 151.2, sdPlus2: 160.5 },
  13: { sdMinus3: 140.5, sdMinus2: 147.2, median: 155.7, sdPlus2: 164.8 },
  14: { sdMinus3: 143.4, sdMinus2: 149.8, median: 158.5, sdPlus2: 167.3 },
  15: { sdMinus3: 144.8, sdMinus2: 151.1, median: 159.7, sdPlus2: 168.3 },
  16: { sdMinus3: 145.4, sdMinus2: 151.6, median: 160.2, sdPlus2: 168.8 },
  17: { sdMinus3: 145.6, sdMinus2: 151.8, median: 160.4, sdPlus2: 169.0 },
  18: { sdMinus3: 145.6, sdMinus2: 151.8, median: 160.4, sdPlus2: 169.0 },
  19: { sdMinus3: 145.6, sdMinus2: 151.8, median: 160.4, sdPlus2: 169.0 },
};

export function parseDateOnly(input: string | Date | null | undefined): DateParts | null {
  if (!input) return null;
  if (typeof input === 'string') {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { year, month, day };
      }
    }
    const d = new Date(input);
    if (isNaN(d.getTime())) return null;
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  if (input instanceof Date && !isNaN(input.getTime())) {
    return { year: input.getFullYear(), month: input.getMonth() + 1, day: input.getDate() };
  }
  return null;
}

export function calculateAgeAsOf(
  birthDateInput: string | Date | null | undefined,
  referenceDateInput: string | Date | null | undefined
): DetailedAge | null {
  const birth = parseDateOnly(birthDateInput);
  const ref = parseDateOnly(referenceDateInput);
  if (!birth || !ref) return null;

  if (
    ref.year < birth.year ||
    (ref.year === birth.year && ref.month < birth.month) ||
    (ref.year === birth.year && ref.month === birth.month && ref.day < birth.day)
  ) {
    return null;
  }

  let years = ref.year - birth.year;
  let months = ref.month - birth.month;
  let days = ref.day - birth.day;

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months;
  return {
    years,
    months,
    totalMonths,
    formatted: `${years} yrs ${months} mos`,
  };
}

export function calculateMeasurementAge(
  birthDateInput: string | Date | null | undefined,
  measurementDateInput: string | Date | null | undefined
): DetailedAge | null {
  if (!measurementDateInput) return null;
  return calculateAgeAsOf(birthDateInput, measurementDateInput);
}

export function calculateCurrentAge(birthDateInput: string | Date | null | undefined): DetailedAge | null {
  return calculateAgeAsOf(birthDateInput, new Date());
}

export const PROVISIONAL_SF1_AGE_CUTOFF_SY2026_2027 = '2026-06-05';

export function calculateSchoolFormAge(
  birthDateInput: string | Date | null | undefined,
  verifiedReferenceDate?: string | Date | null
) {
  if (!birthDateInput) {
    return { age: null, isVerified: false, statusNote: 'Missing birthdate', referenceDate: null };
  }
  if (verifiedReferenceDate === null) {
    return { age: null, isVerified: false, statusNote: 'Institutional reference pending', referenceDate: null };
  }
  const effectiveRefDate = verifiedReferenceDate || PROVISIONAL_SF1_AGE_CUTOFF_SY2026_2027;
  const isProvisional = effectiveRefDate === PROVISIONAL_SF1_AGE_CUTOFF_SY2026_2027 && !verifiedReferenceDate;
  const refDateStr = typeof effectiveRefDate === 'string'
    ? effectiveRefDate
    : effectiveRefDate.toISOString().split('T')[0];

  const age = calculateAgeAsOf(birthDateInput, effectiveRefDate);
  return {
    age,
    referenceDate: refDateStr,
    isVerified: !isProvisional,
    statusNote: isProvisional
      ? `PROVISIONAL — AWAITING CALULUT CONFIRMATION (as of ${refDateStr})`
      : `Verified SF1 reference as of ${refDateStr}`,
  };
}

export function normalizeSex(input: string | null | undefined): 'Male' | 'Female' | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s === 'male' || s === 'm' || s === 'boy') return 'Male';
  if (s === 'female' || s === 'f' || s === 'girl') return 'Female';
  return null;
}

export function calculateBmiValue(heightCm: number, weightKg: number): number | null {
  if (!heightCm || heightCm <= 0 || !weightKg || weightKg <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return parseFloat(bmi.toFixed(1));
}

/**
 * Resolves total completed months from an age input.
 * Supports:
 * - DetailedAge / object { totalMonths, years, months }
 * - Direct completed months (number >= 30, e.g. 60, 61, 228, 229)
 * - Decimal years (number < 30, e.g. 5.0 -> 60 mos, 5.0833 -> 61 mos, 19.0 -> 228 mos, 19.99 -> 239 mos)
 */
export function resolveAgeMonths(
  ageInput: number | { totalMonths?: number; years?: number; months?: number } | null | undefined
): { totalMonths: number; ageYears: number } | null {
  if (ageInput == null) return null;

  if (typeof ageInput === 'object') {
    if (typeof ageInput.totalMonths === 'number') {
      const y = typeof ageInput.years === 'number' ? ageInput.years : Math.floor(ageInput.totalMonths / 12);
      const m = typeof ageInput.months === 'number' ? ageInput.months : (ageInput.totalMonths % 12);
      return { totalMonths: ageInput.totalMonths, ageYears: y + m / 12 };
    }
    if (typeof ageInput.years === 'number') {
      const m = ageInput.months || 0;
      return { totalMonths: ageInput.years * 12 + m, ageYears: ageInput.years + m / 12 };
    }
    return null;
  }

  if (typeof ageInput === 'number') {
    if (isNaN(ageInput) || ageInput <= 0) return null;
    if (ageInput >= 30) {
      const tm = Math.floor(ageInput);
      return { totalMonths: tm, ageYears: tm / 12 };
    }
    const tm = Math.floor(ageInput * 12 + 0.00001);
    return { totalMonths: tm, ageYears: ageInput };
  }

  return null;
}

export function classifyWhoBmi(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
  ageInput: number | { totalMonths?: number; years?: number; months?: number } | null | undefined,
  sexInput: string | null | undefined
) {
  const normSex = normalizeSex(sexInput);
  const resolvedAge = resolveAgeMonths(ageInput);

  if (
    heightCm == null || heightCm <= 0 ||
    weightKg == null || weightKg <= 0 ||
    !resolvedAge ||
    !normSex
  ) {
    return {
      bmi: null,
      status: 'Pending Verification / Not Calculated' as BmiNutritionalStatus,
      heightCm: heightCm ?? null,
      weightKg: weightKg ?? null,
      ageYears: resolvedAge?.ageYears ?? null,
      ageMonths: resolvedAge?.totalMonths ?? null,
      sex: normSex,
    };
  }

  const { totalMonths, ageYears } = resolvedAge;

  // Strict WHO 2007 reference boundary: 61 to 228 completed months (5 yrs 1 mo to 19 yrs 0 mos)
  if (totalMonths < 61 || totalMonths > 228) {
    const rawBmi = calculateBmiValue(heightCm, weightKg);
    return {
      bmi: rawBmi,
      status: 'Pending Verification / Not Calculated' as BmiNutritionalStatus,
      heightCm,
      weightKg,
      ageYears,
      ageMonths: totalMonths,
      sex: normSex,
    };
  }

  const lookupYear = Math.floor(totalMonths / 12);
  const cutoffs = normSex === 'Male' ? WHO_BMI_BOYS[lookupYear] : WHO_BMI_GIRLS[lookupYear];
  if (!cutoffs) {
    return {
      bmi: null,
      status: 'Pending Verification / Not Calculated' as BmiNutritionalStatus,
      heightCm,
      weightKg,
      ageYears,
      ageMonths: totalMonths,
      sex: normSex,
    };
  }

  const heightM = heightCm / 100;
  const rawBmi = weightKg / (heightM * heightM);
  const displayBmi = parseFloat(rawBmi.toFixed(1));

  let status: BmiNutritionalStatus;
  if (rawBmi < cutoffs.sdMinus3) {
    status = 'Severely Wasted';
  } else if (rawBmi < cutoffs.sdMinus2) {
    status = 'Wasted';
  } else if (rawBmi <= cutoffs.sdPlus1) {
    status = 'Normal';
  } else if (rawBmi <= cutoffs.sdPlus2) {
    status = 'Overweight';
  } else {
    status = 'Obese';
  }

  return {
    bmi: displayBmi,
    status,
    heightCm,
    weightKg,
    ageYears,
    ageMonths: totalMonths,
    sex: normSex,
    cutoffsApplied: cutoffs,
  };
}

export function classifyWhoHfa(
  heightCm: number | null | undefined,
  ageInput: number | { totalMonths?: number; years?: number; months?: number } | null | undefined,
  sexInput: string | null | undefined
) {
  const normSex = normalizeSex(sexInput);
  const resolvedAge = resolveAgeMonths(ageInput);

  if (heightCm == null || heightCm <= 0 || !resolvedAge || !normSex) {
    return {
      status: 'Pending Verification / Not Calculated' as HfaNutritionalStatus,
      heightCm: heightCm ?? null,
      ageYears: resolvedAge?.ageYears ?? null,
      ageMonths: resolvedAge?.totalMonths ?? null,
      sex: normSex,
    };
  }

  const { totalMonths, ageYears } = resolvedAge;

  // Strict WHO 2007 reference boundary: 61 to 228 completed months (5 yrs 1 mo to 19 yrs 0 mos)
  if (totalMonths < 61 || totalMonths > 228) {
    return {
      status: 'Pending Verification / Not Calculated' as HfaNutritionalStatus,
      heightCm,
      ageYears,
      ageMonths: totalMonths,
      sex: normSex,
    };
  }

  const lookupYear = Math.floor(totalMonths / 12);
  const cutoffs = normSex === 'Male' ? WHO_HFA_BOYS[lookupYear] : WHO_HFA_GIRLS[lookupYear];
  if (!cutoffs) {
    return {
      status: 'Pending Verification / Not Calculated' as HfaNutritionalStatus,
      heightCm,
      ageYears,
      ageMonths: totalMonths,
      sex: normSex,
    };
  }

  let status: HfaNutritionalStatus;
  if (heightCm < cutoffs.sdMinus3) {
    status = 'Severely Stunted';
  } else if (heightCm < cutoffs.sdMinus2) {
    status = 'Stunted';
  } else if (heightCm <= cutoffs.sdPlus2) {
    status = 'Normal';
  } else {
    status = 'Tall';
  }

  return {
    status,
    heightCm,
    ageYears,
    ageMonths: totalMonths,
    sex: normSex,
    cutoffsApplied: cutoffs,
  };
}
