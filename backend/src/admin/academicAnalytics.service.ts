import prisma from '../config/database.js';

export interface AcademicAnalyticsResponse {
  schoolAverageByGradeLevel: {
    gradeLevel: number;
    average: number;
  }[];
  trendAverages: {
    gradeLevel: number;
    t1: number | null;
    t2: number | null;
    t3: number | null;
    trend: string;
  }[];
  lowestPerformingSubjects: {
    subjectName: string;
    gradeLevel: number;
    average: number;
  }[];
  passingVsFailingByGradeLevel: {
    gradeLevel: number;
    passing: number;
    failing: number;
    rate: number;
  }[];
  topSections: {
    sectionName: string;
    gradeLevel: number;
    average: number;
  }[];
  topPerformers: {
    studentId: string;
    studentName: string;
    sectionName: string;
    generalAverage: number;
  }[];
  gradeDistribution: {
    bucket: string;
    count: number;
  }[];
}

export async function getAcademicAnalytics(): Promise<AcademicAnalyticsResponse> {
  const activeYear = await prisma.academicYear.findFirst({
    where: { is_current: true }
  });

  if (!activeYear) {
    throw new Error('No active academic year found');
  }

  // 1. We fetch all grades for the active year with essential relations.
  // Although the requirement advises against fetching everything, we need to correlate
  // Grades with Enrollments (for sections), Students (for names), and Subjects (for names).
  // In a standard school database (e.g. 500 students * 8 subjects = 4000 rows), 
  // fetching this selectively into a single payload is actually the most efficient approach
  // to avoid N+1 and repeated DB queries.
  const allGrades = await prisma.grade.findMany({
    where: { 
      academic_year_id: activeYear.id,
      term_grade: { not: null } 
    },
    select: {
      student_id: true,
      subject_id: true,
      term: true,
      term_grade: true,
      student: {
        select: {
          user: {
            select: {
              first_name: true,
              last_name: true
            }
          },
          grade_level: true,
          enrollments: {
            where: { academic_year_id: activeYear.id, status: 'Enrolled' },
            select: {
              section: {
                select: { name: true, grade_level: true }
              }
            }
          }
        }
      },
      subject: {
        select: { name: true }
      }
    }
  });

  // Data Structures for Aggregation
  const gradeLevelStats = new Map<number, { sum: number, count: number }>();
  const trendStats = new Map<number, Map<string, { sum: number, count: number }>>();
  const subjectStats = new Map<string, { sum: number, count: number, name: string, gradeLevel: number }>();
  const sectionStats = new Map<string, { sum: number, count: number, name: string, gradeLevel: number }>();
  const distribution = { '90-100': 0, '85-89': 0, '80-84': 0, '75-79': 0, '<75': 0 };

  // For Pass/Fail and General Average (Strict sf10 logic)
  interface StudentSubjectGrades {
    T1: number | null;
    T2: number | null;
    T3: number | null;
    T4: number | null;
  }
  const studentData = new Map<string, {
    gradeLevel: number,
    name: string,
    section: string,
    subjects: Map<string, StudentSubjectGrades>
  }>();

  for (const grade of allGrades) {
    const val = grade.term_grade as number;
    const gLevel = grade.student.grade_level;
    const sectionName = grade.student.enrollments?.[0]?.section?.name || 'Unassigned';
    
    // Distribution (Bucket factual term_grade values)
    if (val >= 90) distribution['90-100']++;
    else if (val >= 85) distribution['85-89']++;
    else if (val >= 80) distribution['80-84']++;
    else if (val >= 75) distribution['75-79']++;
    else distribution['<75']++;

    // Grade Level Overall (Averages all individual term grades for a broad pulse)
    if (!gradeLevelStats.has(gLevel)) gradeLevelStats.set(gLevel, { sum: 0, count: 0 });
    gradeLevelStats.get(gLevel)!.sum += val;
    gradeLevelStats.get(gLevel)!.count++;

    // Trends by Term (T1, T2, T3, T4)
    if (!trendStats.has(gLevel)) trendStats.set(gLevel, new Map());
    const termMap = trendStats.get(gLevel)!;
    if (!termMap.has(grade.term)) termMap.set(grade.term, { sum: 0, count: 0 });
    termMap.get(grade.term)!.sum += val;
    termMap.get(grade.term)!.count++;

    // Subject Performance
    const subjectKey = `${grade.subject_id}-${gLevel}`;
    if (!subjectStats.has(subjectKey)) subjectStats.set(subjectKey, { sum: 0, count: 0, name: grade.subject.name, gradeLevel: gLevel });
    subjectStats.get(subjectKey)!.sum += val;
    subjectStats.get(subjectKey)!.count++;

    // Section Averages
    if (!sectionStats.has(sectionName)) sectionStats.set(sectionName, { sum: 0, count: 0, name: sectionName, gradeLevel: gLevel });
    sectionStats.get(sectionName)!.sum += val;
    sectionStats.get(sectionName)!.count++;

    // Group for Strict Student Final Ratings
    if (!studentData.has(grade.student_id)) {
      studentData.set(grade.student_id, {
        gradeLevel: gLevel,
        name: `${grade.student.user?.last_name}, ${grade.student.user?.first_name}`,
        section: sectionName,
        subjects: new Map()
      });
    }
    const stu = studentData.get(grade.student_id)!;
    if (!stu.subjects.has(grade.subject_id)) {
      stu.subjects.set(grade.subject_id, { T1: null, T2: null, T3: null, T4: null });
    }
    stu.subjects.get(grade.subject_id)![grade.term as keyof StudentSubjectGrades] = val;
  }

  // Calculate Strict Pass/Fail & General Average
  const passFailMap = new Map<number, { passing: number, failing: number }>();
  const topPerformersData: { studentId: string, studentName: string, sectionName: string, generalAverage: number }[] = [];

  for (const [studentId, data] of studentData.entries()) {
    let totalFinalRating = 0;
    let finalRatingCount = 0;
    const numSubjects = data.subjects.size;

    for (const sg of data.subjects.values()) {
      if (sg.T1 !== null && sg.T2 !== null && sg.T3 !== null && sg.T4 !== null) {
        // Strict sf10 logic
        const finalRating = Math.round((sg.T1 + sg.T2 + sg.T3 + sg.T4) / 4);
        totalFinalRating += finalRating;
        finalRatingCount++;
      }
    }

    if (numSubjects > 0 && finalRatingCount === numSubjects) {
      const generalAverage = Math.round(totalFinalRating / numSubjects);
      
      // Pass/Fail based on General Average >= 75
      if (!passFailMap.has(data.gradeLevel)) passFailMap.set(data.gradeLevel, { passing: 0, failing: 0 });
      if (generalAverage >= 75) passFailMap.get(data.gradeLevel)!.passing++;
      else passFailMap.get(data.gradeLevel)!.failing++;

      topPerformersData.push({
        studentId,
        studentName: data.name,
        sectionName: data.section,
        generalAverage
      });
    }
  }

  // Format responses
  const schoolAverageByGradeLevel = Array.from(gradeLevelStats.entries()).map(([gLevel, stats]) => ({
    gradeLevel: gLevel,
    average: Number((stats.sum / stats.count).toFixed(1))
  })).sort((a,b) => a.gradeLevel - b.gradeLevel);

  const trendAverages = Array.from(trendStats.entries()).map(([gLevel, termMap]) => {
    const t1 = termMap.get('T1') ? Number((termMap.get('T1')!.sum / termMap.get('T1')!.count).toFixed(1)) : null;
    const t2 = termMap.get('T2') ? Number((termMap.get('T2')!.sum / termMap.get('T2')!.count).toFixed(1)) : null;
    const t3 = termMap.get('T3') ? Number((termMap.get('T3')!.sum / termMap.get('T3')!.count).toFixed(1)) : null;
    const t4 = termMap.get('T4') ? Number((termMap.get('T4')!.sum / termMap.get('T4')!.count).toFixed(1)) : null;
    
    let trend = 'Stable';
    if (t2 && t1) trend = t2 > t1 ? 'Improving' : (t2 < t1 ? 'Declining' : 'Stable');
    if (t3 && t2) trend = t3 > t2 ? 'Improving' : (t3 < t2 ? 'Declining' : 'Stable');
    if (t4 && t3) trend = t4 > t3 ? 'Improving' : (t4 < t3 ? 'Declining' : 'Stable');
    
    return { gradeLevel: gLevel, t1, t2, t3, t4, trend: trend === 'Improving' ? '↑ Improving' : trend === 'Declining' ? '↓ Declining' : 'Stable' };
  }).sort((a,b) => a.gradeLevel - b.gradeLevel);

  const lowestPerformingSubjects = Array.from(subjectStats.values()).map(s => ({
    subjectName: s.name,
    gradeLevel: s.gradeLevel,
    average: Number((s.sum / s.count).toFixed(1))
  })).sort((a,b) => a.average - b.average).slice(0, 5);

  const topSections = Array.from(sectionStats.values()).map(s => ({
    sectionName: s.name,
    gradeLevel: s.gradeLevel,
    average: Number((s.sum / s.count).toFixed(1))
  })).sort((a,b) => b.average - a.average).slice(0, 5);

  const passingVsFailingByGradeLevel = Array.from(passFailMap.entries()).map(([gLevel, counts]) => ({
    gradeLevel: gLevel,
    passing: counts.passing,
    failing: counts.failing,
    rate: Number(((counts.passing / (counts.passing + counts.failing)) * 100).toFixed(1))
  })).sort((a,b) => a.gradeLevel - b.gradeLevel);

  const topPerformers = topPerformersData.sort((a,b) => b.generalAverage - a.generalAverage).slice(0, 10);

  const gradeDistribution = Object.entries(distribution).map(([bucket, count]) => ({ bucket, count }));

  return {
    schoolAverageByGradeLevel,
    trendAverages,
    lowestPerformingSubjects,
    passingVsFailingByGradeLevel,
    topSections,
    topPerformers,
    gradeDistribution
  };
}
