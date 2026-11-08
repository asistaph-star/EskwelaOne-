/**
 * DigiSkwela - WHO 2007 BMI-for-Age & Height-for-Age (HFA) Calculator
 * 
 * Implements:
 * - DepEd Order No. 058, s. 2017 (School Form 8 - Health and Nutrition)
 * - World Health Organization (WHO) Growth Reference 2007 for 5-19 years
 * - Metric Body Mass Index: weight (kg) / [height (m)]^2
 */

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

// Authoritative WHO 2007 BMI reference tables for Boys (Ages 5-19)
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

// Authoritative WHO 2007 BMI reference tables for Girls (Ages 5-19)
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

// Authoritative WHO 2007 Height-for-Age (HFA) in cm for Boys (Ages 5-19)
export const WHO_HFA_BOYS: Record<number, WhoHfaCutoffs> = {
  5:  { sdMinus3: 98.7,  sdMinus2: 103.3, median: 110.0, sdPlus2: 116.7 },
  6:  { sdMinus3: 104.9, sdMinus2: 109.9, median: 116.9, sdPlus2: 123.9 },
  7:  { sdMinus3: 110.7, sdMinus2: 115.9, median: 123.2, sdPlus2: 130.6 },
  8:  { sdMinus3: 116.0, sdMinus2: 121.5, median: 129.1, sdPlus2: 136.8 },
  9:  { sdMinus3: 121.0, sdMinus2: 126.8, median: 134.7, sdPlus2: 142.7 },
  10: { sdMinus3: 125.8, sdMinus2: 131.8, median: 140.1, sdPlus2: 148.5 },
  11: { sdMinus3: 130.4, sdMinus2: 136.7, median: 145.4, sdPlus2: 154.2 },
  12: { sdMinus3: 135.2, sdMinus2: 141.8, median: 151.1, sdPlus2: 160.5 },
  13: { sdMinus3: 140.6, sdMinus2: 147.6, median: 157.5, sdPlus2: 167.4 },
  14: { sdMinus3: 146.6, sdMinus2: 153.9, median: 163.8, sdPlus2: 173.8 },
  15: { sdMinus3: 152.0, sdMinus2: 159.4, median: 169.0, sdPlus2: 178.6 },
  16: { sdMinus3: 155.8, sdMinus2: 163.0, median: 172.4, sdPlus2: 181.7 },
  17: { sdMinus3: 157.9, sdMinus2: 164.8, median: 174.0, sdPlus2: 183.1 },
  18: { sdMinus3: 158.7, sdMinus2: 165.4, median: 174.4, sdPlus2: 183.4 },
  19: { sdMinus3: 158.9, sdMinus2: 165.5, median: 174.4, sdPlus2: 183.4 },
};

// Authoritative WHO 2007 Height-for-Age (HFA) in cm for Girls (Ages 5-19)
export const WHO_HFA_GIRLS: Record<number, WhoHfaCutoffs> = {
  5:  { sdMinus3: 98.0,  sdMinus2: 102.5, median: 109.4, sdPlus2: 116.2 },
  6:  { sdMinus3: 103.9, sdMinus2: 108.8, median: 116.0, sdPlus2: 123.3 },
  7:  { sdMinus3: 109.4, sdMinus2: 114.7, median: 122.2, sdPlus2: 129.8 },
  8:  { sdMinus3: 114.7, sdMinus2: 120.2, median: 128.0, sdPlus2: 135.9 },
  9:  { sdMinus3: 119.8, sdMinus2: 125.6, median: 133.7, sdPlus2: 141.9 },
  10: { sdMinus3: 124.9, sdMinus2: 131.0, median: 139.5, sdPlus2: 148.1 },
  11: { sdMinus3: 130.3, sdMinus2: 136.7, median: 145.5, sdPlus2: 154.5 },
  12: { sdMinus3: 135.7, sdMinus2: 142.1, median: 151.0, sdPlus2: 159.9 },
  13: { sdMinus3: 140.0, sdMinus2: 146.4, median: 154.9, sdPlus2: 163.5 },
  14: { sdMinus3: 142.7, sdMinus2: 148.8, median: 157.1, sdPlus2: 165.4 },
  15: { sdMinus3: 144.1, sdMinus2: 150.0, median: 158.1, sdPlus2: 166.2 },
  16: { sdMinus3: 144.7, sdMinus2: 150.4, median: 158.5, sdPlus2: 166.5 },
  17: { sdMinus3: 144.9, sdMinus2: 150.6, median: 158.6, sdPlus2: 166.6 },
  18: { sdMinus3: 145.0, sdMinus2: 150.6, median: 158.6, sdPlus2: 166.7 },
  19: { sdMinus3: 145.0, sdMinus2: 150.6, median: 158.6, sdPlus2: 166.7 },
};

export interface BmiCalculationResult {
  bmi: number | null;
  status: BmiNutritionalStatus;
  heightCm: number | null;
  weightKg: number | null;
  ageYears: number | null;
  ageMonths: number | null;
  sex: string | null;
  cutoffsApplied: WhoBmiCutoffs | null;
}

export interface HfaCalculationResult {
  status: HfaNutritionalStatus;
  heightCm: number | null;
  ageYears: number | null;
  ageMonths: number | null;
  sex: string | null;
  cutoffsApplied: WhoHfaCutoffs | null;
}

export function normalizeSex(input: string | null | undefined): 'Male' | 'Female' | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s === 'male' || s === 'm' || s === 'boy') return 'Male';
  if (s === 'female' || s === 'f' || s === 'girl') return 'Female';
  return null;
}

export function calculateBmiValue(heightCm: number, weightKg: number): number | null {
  if (!heightCm || heightCm <= 0 || !weightKg || weightKg <= 0) {
    return null;
  }
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
    // Decimal years: e.g. 5.0 -> 60 mos, 5.0833 -> 61 mos, 19.0 -> 228 mos, 19.99 -> 239 mos
    const tm = Math.floor(ageInput * 12 + 0.00001);
    return { totalMonths: tm, ageYears: ageInput };
  }

  return null;
}

/**
 * Classifies BMI-for-Age according to WHO 2007 Growth Reference for 5-19 years.
 * Official age coverage: strictly 61 to 228 completed months (5 yrs 1 mo to 19 yrs 0 mos).
 * Outside 61-228 months: returns 'Pending Verification / Not Calculated'.
 */
export function classifyWhoBmi(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
  ageInput: number | { totalMonths?: number; years?: number; months?: number } | null | undefined,
  sexInput: string | null | undefined
): BmiCalculationResult {
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
      status: 'Pending Verification / Not Calculated',
      heightCm: heightCm ?? null,
      weightKg: weightKg ?? null,
      ageYears: resolvedAge?.ageYears ?? null,
      ageMonths: resolvedAge?.totalMonths ?? null,
      sex: normSex,
      cutoffsApplied: null,
    };
  }

  const { totalMonths, ageYears } = resolvedAge;

  // Strict WHO 2007 reference boundary: 61 to 228 completed months (5 yrs 1 mo to 19 yrs 0 mos)
  if (totalMonths < 61 || totalMonths > 228) {
    const rawBmi = calculateBmiValue(heightCm, weightKg);
    return {
      bmi: rawBmi,
      status: 'Pending Verification / Not Calculated',
      heightCm,
      weightKg,
      ageYears,
      ageMonths: totalMonths,
      sex: normSex,
      cutoffsApplied: null,
    };
  }

  const lookupYear = Math.floor(totalMonths / 12);
  const cutoffs = normSex === 'Male' ? WHO_BMI_BOYS[lookupYear] : WHO_BMI_GIRLS[lookupYear];
  if (!cutoffs) {
    return {
      bmi: null,
      status: 'Pending Verification / Not Calculated',
      heightCm,
      weightKg,
      ageYears,
      ageMonths: totalMonths,
      sex: normSex,
      cutoffsApplied: null,
    };
  }

  // Calculate unrounded metric BMI for classification precision
  const heightM = heightCm / 100;
  const rawBmi = weightKg / (heightM * heightM);
  const displayBmi = parseFloat(rawBmi.toFixed(1));

  // Determine nutritional status using unrounded BMI against authoritative WHO cutoffs
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

/**
 * Classifies Height-for-Age (HFA) according to WHO 2007 Growth Reference for 5-19 years.
 * Official age coverage: strictly 61 to 228 completed months (5 yrs 1 mo to 19 yrs 0 mos).
 * Outside 61-228 months: returns 'Pending Verification / Not Calculated'.
 */
export function classifyWhoHfa(
  heightCm: number | null | undefined,
  ageInput: number | { totalMonths?: number; years?: number; months?: number } | null | undefined,
  sexInput: string | null | undefined
): HfaCalculationResult {
  const normSex = normalizeSex(sexInput);
  const resolvedAge = resolveAgeMonths(ageInput);

  if (heightCm == null || heightCm <= 0 || !resolvedAge || !normSex) {
    return {
      status: 'Pending Verification / Not Calculated',
      heightCm: heightCm ?? null,
      ageYears: resolvedAge?.ageYears ?? null,
      ageMonths: resolvedAge?.totalMonths ?? null,
      sex: normSex,
      cutoffsApplied: null,
    };
  }

  const { totalMonths, ageYears } = resolvedAge;

  // Strict WHO 2007 reference boundary: 61 to 228 completed months (5 yrs 1 mo to 19 yrs 0 mos)
  if (totalMonths < 61 || totalMonths > 228) {
    return {
      status: 'Pending Verification / Not Calculated',
      heightCm,
      ageYears,
      ageMonths: totalMonths,
      sex: normSex,
      cutoffsApplied: null,
    };
  }

  const lookupYear = Math.floor(totalMonths / 12);
  const cutoffs = normSex === 'Male' ? WHO_HFA_BOYS[lookupYear] : WHO_HFA_GIRLS[lookupYear];
  if (!cutoffs) {
    return {
      status: 'Pending Verification / Not Calculated',
      heightCm,
      ageYears,
      ageMonths: totalMonths,
      sex: normSex,
      cutoffsApplied: null,
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
