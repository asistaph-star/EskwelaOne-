/**
 * DIGISKWELA — Frontend Verified Grading Engine
 * Reference: AGONCILLO ECR - SEPT4.xlsx (Calulut Integrated School) & DepEd Order No. 015, s. 2026
 *
 * Implements authoritative client-side calculations strictly identical to the backend engine:
 * 1. WW & PT Percentage Scores & Weighted Scores (Core: 20% WW, 50% PT; Technical: 20% WW, 60% PT)
 * 2. Examinations Breakdown (ST1 30%, ST2 30%, TE 40% -> Overall EX Weight 30% Core / 20% Technical)
 * 3. Initial Grade computation (Full floating precision rounded to 2 d.p. via Half-Up)
 * 4. Official 41-interval Transmutation Table (Table 4, DO 015 s. 2026 & ECR HELPER sheet)
 * 5. Official Performance Descriptors (Advancing, Benchmarking, Connecting, Developing, Emerging)
 * 6. 3-Term Annual Final Grade & Pass/Fail Remarks
 */

export const ADJUSTED_TABLE_2026: ReadonlyArray<readonly [number, number, number]> = [
  [99.50, 100.00, 100],
  [98.32,  99.49,  99],
  [97.14,  98.31,  98],
  [95.96,  97.13,  97],
  [94.78,  95.95,  96],
  [93.60,  94.77,  95],
  [92.42,  93.59,  94],
  [91.24,  92.41,  93],
  [90.06,  91.23,  92],
  [88.88,  90.05,  91],
  [87.70,  88.87,  90],
  [86.52,  87.69,  89],
  [85.34,  86.51,  88],
  [84.16,  85.33,  87],
  [82.98,  84.15,  86],
  [81.80,  82.97,  85],
  [80.62,  81.79,  84],
  [79.44,  80.61,  83],
  [78.26,  79.43,  82],
  [77.08,  78.25,  81],
  [75.90,  77.07,  80],
  [74.72,  75.89,  79],
  [73.54,  74.71,  78],
  [72.36,  73.53,  77],
  [71.18,  72.35,  76],
  [70.00,  71.17,  75], // Minimum passing threshold
  [65.34,  69.99,  74],
  [60.67,  65.33,  73],
  [56.01,  60.66,  72],
  [51.34,  56.00,  71],
  [46.67,  51.33,  70],
  [42.01,  46.66,  69],
  [37.34,  42.00,  68],
  [32.68,  37.33,  67],
  [28.01,  32.67,  66],
  [23.35,  28.00,  65],
  [18.68,  23.34,  64],
  [14.01,  18.67,  63],
  [ 9.35,  14.00,  62],
  [ 4.68,   9.34,  61],
  [ 0.00,   4.67,  60], // Minimum reportable floor
];

export function roundHalfUp(value: number, decimalPlaces: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const absVal = Math.abs(value);
  const [mantissa, exponent] = absVal.toString().split('e');
  const exp = exponent ? Number(exponent) + decimalPlaces : decimalPlaces;
  const shifted = Number(`${mantissa}e${exp}`);
  const rounded = Math.round(shifted);
  const [roundedMantissa, roundedExp] = rounded.toString().split('e');
  const finalExp = roundedExp ? Number(roundedExp) - decimalPlaces : -decimalPlaces;
  return sign * Number(`${roundedMantissa}e${finalExp}`);
}

export function transmuteInitialGrade(ig: number | null): number | null {
  if (ig === null || !Number.isFinite(ig)) return null;
  const clamped = Math.max(0, Math.min(100, roundHalfUp(ig, 2)));
  for (const [lo, hi, tg] of ADJUSTED_TABLE_2026) {
    if (clamped >= lo && clamped <= hi) {
      return tg;
    }
  }
  return 60;
}

export function getPerformanceDescriptor(grade: number | null): string | null {
  if (grade === null || !Number.isFinite(grade)) return null;
  const rounded = Math.round(grade);
  if (rounded >= 90) return 'Advancing';
  if (rounded >= 80) return 'Benchmarking';
  if (rounded >= 75) return 'Connecting';
  if (rounded >= 65) return 'Developing';
  return 'Emerging';
}

export interface ActivityItem {
  id: string;
  label: string;
  max: number;
}

export interface StudentCalculationOutput {
  wwTotal: number;
  wwMax: number;
  wwPS: number;
  wwWS: number;
  ptTotal: number;
  ptMax: number;
  ptPS: number;
  ptWS: number;
  st1Score: number | null;
  st1Max: number;
  st1WS: number | null;
  st2Score: number | null;
  st2Max: number;
  st2WS: number | null;
  teScore: number | null;
  teMax: number;
  teWS: number | null;
  exPS: number | null;
  exWS: number | null;
  initialGrade: number | null;
  termGrade: number | null;
  descriptor: string | null;
  isComplete: boolean;
}

export interface DynamicExamConfig {
  id: string;
  label: string;
  max: number;
  weight: number;
}

export function calculateStudentGrade(
  studentScores: Record<string, string>,
  wwItems: ActivityItem[],
  ptItems: ActivityItem[],
  st1Max: number = 25,
  st2Max: number = 25,
  teMax: number = 50,
  subjectType: 'CORE' | 'TECHNICAL' = 'CORE',
  examItems?: DynamicExamConfig[],
  customWeights?: { ww?: number; pt?: number; qa?: number; ex?: number }
): StudentCalculationOutput {
  const isTechnical = subjectType === 'TECHNICAL';
  const wwWeight = (customWeights?.ww !== undefined ? customWeights.ww : (isTechnical ? 20 : 20)) / 100;
  const ptWeight = (customWeights?.pt !== undefined ? customWeights.pt : (isTechnical ? 60 : 50)) / 100;
  const exWeight = (customWeights?.qa !== undefined ? customWeights.qa : (customWeights?.ex !== undefined ? customWeights.ex : (isTechnical ? 20 : 30))) / 100;

  const parse = (v: any): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  // 1. Written Works
  let wwTotal = 0;
  let wwMax = 0;
  let wwHasMissing = false;
  let wwHasRecorded = false;

  for (const it of wwItems) {
    wwMax += it.max;
    const s = parse(studentScores[it.id]);
    if (s === null) {
      wwHasMissing = true;
    } else {
      wwTotal += s;
      wwHasRecorded = true;
    }
  }

  const wwPS = wwMax > 0 ? (wwTotal / wwMax) * 100 : 0;
  const wwWS = roundHalfUp(wwPS * wwWeight, 2);

  // 2. Performance Tasks
  let ptTotal = 0;
  let ptMax = 0;
  let ptHasMissing = false;
  let ptHasRecorded = false;

  for (const it of ptItems) {
    ptMax += it.max;
    const s = parse(studentScores[it.id]);
    if (s === null) {
      ptHasMissing = true;
    } else {
      ptTotal += s;
      ptHasRecorded = true;
    }
  }

  const ptPS = ptMax > 0 ? (ptTotal / ptMax) * 100 : 0;
  const ptWS = roundHalfUp(ptPS * ptWeight, 2);

  // 3. Examinations (Dynamic examItems or fallback to ST1, ST2, TE)
  let exPS: number | null = null;
  let exWS: number | null = null;
  let st1Score: number | null = null;
  let st2Score: number | null = null;
  let teScore: number | null = null;
  let st1WS: number | null = null;
  let st2WS: number | null = null;
  let teWS: number | null = null;
  let exIsComplete = false;

  if (examItems && examItems.length > 0) {
    const totalWeight = examItems.reduce((acc, it) => acc + (it.weight || 0), 0) || 100;
    let anyMissing = false;
    let accumulatedPS = 0;

    for (const it of examItems) {
      const s = parse(studentScores[it.id]);
      if (it.id === 'st1') {
        st1Score = s;
        st1WS = (s !== null && it.max > 0) ? (s / it.max) * (it.weight || 30) : null;
      } else if (it.id === 'st2') {
        st2Score = s;
        st2WS = (s !== null && it.max > 0) ? (s / it.max) * (it.weight || 30) : null;
      } else if (it.id === 'te' || it.id === 'qa') {
        teScore = s;
        teWS = (s !== null && it.max > 0) ? (s / it.max) * (it.weight || 40) : null;
      }

      if (s === null) {
        anyMissing = true;
      } else if (it.max > 0) {
        accumulatedPS += (s / it.max) * 100 * ((it.weight || 0) / totalWeight);
      }
    }

    exIsComplete = !anyMissing;
    if (exIsComplete) {
      exPS = accumulatedPS;
      exWS = roundHalfUp(exPS * exWeight, 2);
    }
  } else {
    st1Score = parse(studentScores['st1']);
    st2Score = parse(studentScores['st2']);
    teScore  = parse(studentScores['te'] ?? studentScores['qa']);

    st1WS = (st1Score !== null && st1Max > 0) ? (st1Score / st1Max) * 30 : null;
    st2WS = (st2Score !== null && st2Max > 0) ? (st2Score / st2Max) * 30 : null;
    teWS  = (teScore  !== null && teMax  > 0) ? (teScore  / teMax)  * 40 : null;

    if (st1WS !== null && st2WS !== null && teWS !== null) {
      exPS = st1WS + st2WS + teWS;
      exWS = roundHalfUp(exPS * exWeight, 2);
    }
    exIsComplete = st1Score !== null && st2Score !== null && teScore !== null;
  }

  // Completeness check
  const isComplete = !wwHasMissing && !ptHasMissing && exIsComplete;

  let initialGrade: number | null = null;
  let termGrade: number | null = null;
  let descriptor: string | null = null;

  if (isComplete && exWS !== null) {
    initialGrade = roundHalfUp(wwWS + ptWS + exWS, 2);
    termGrade = transmuteInitialGrade(initialGrade);
    descriptor = getPerformanceDescriptor(termGrade);
  }

  return {
    wwTotal,
    wwMax,
    wwPS,
    wwWS,
    ptTotal,
    ptMax,
    ptPS,
    ptWS,
    st1Score,
    st1Max,
    st1WS,
    st2Score,
    st2Max,
    st2WS,
    teScore,
    teMax,
    teWS,
    exPS,
    exWS,
    initialGrade,
    termGrade,
    descriptor,
    isComplete,
  };
}

/**
 * 3-Term Annual Final Grade calculation matching AGONCILLO ECR - SEPT4 & SF9:
 * =IF(COUNT(T1, T2, T3) < 3, "", ROUND(AVERAGE(T1, T2, T3), 0))
 */
export function calculateAnnualFinalGrade(
  term1: number | null | undefined,
  term2: number | null | undefined,
  term3: number | null | undefined
): { finalGrade: number | null; remark: string | null; descriptor: string | null } {
  if (
    term1 === null || term1 === undefined || term1 <= 0 ||
    term2 === null || term2 === undefined || term2 <= 0 ||
    term3 === null || term3 === undefined || term3 <= 0
  ) {
    return { finalGrade: null, remark: null, descriptor: null };
  }

  const finalGrade = Math.round((term1 + term2 + term3) / 3);
  const remark = finalGrade >= 75 ? 'Passed' : 'Failed';
  const descriptor = getPerformanceDescriptor(finalGrade);

  return { finalGrade, remark, descriptor };
}
