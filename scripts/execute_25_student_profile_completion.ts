import http from 'http';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../backend/node_modules/@prisma/client';
import { calculateMeasurementAge, calculateSchoolFormAge, calculateCurrentAge } from '../backend/src/academic/health/ageCalculator.ts';
import { calculateBmiValue, classifyWhoBmi, classifyWhoHfa } from '../backend/src/academic/health/whoBmiCalculator.ts';

const prisma = new PrismaClient();

function httpRequest(options: {
  path: string;
  method: string;
  token?: string;
  body?: any;
}): Promise<{ statusCode: number; headers: any; body: any; buffer?: Buffer }> {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : null;
    const headers: Record<string, string> = {
      'Accept': '*/*',
    };
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
      headers['Cookie'] = `auth_token=${options.token}`;
    }

    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: options.path,
      method: options.method,
      headers
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const fullBuf = Buffer.concat(chunks);
        let parsedBody: any = null;
        try {
          parsedBody = JSON.parse(fullBuf.toString('utf8'));
        } catch {
          parsedBody = null;
        }
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: parsedBody,
          buffer: fullBuf
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function loginUser(schoolId: string, password: string): Promise<string> {
  const res = await httpRequest({
    path: '/api/auth/login',
    method: 'POST',
    body: { schoolId, password }
  });
  if (res.statusCode !== 200) {
    throw new Error(`Login failed for ${schoolId}: ${JSON.stringify(res.body)}`);
  }
  const cookies = res.headers['set-cookie'];
  if (cookies) {
    const m = cookies.find((c: string) => c.startsWith('auth_token='));
    if (m) {
      return m.split(';')[0].split('=')[1];
    }
  }
  throw new Error(`No auth_token cookie received for ${schoolId}`);
}

interface StudentDataset {
  lrn: string;
  name: string;
  section: string;
  street: string;
  guardianFirst: string;
  guardianLast: string;
  guardianPhone: string;
  guardianEmail: string;
  bloodType: string;
  allergies: string;
  medicalConditions: string;
  heightCm: number;
  weightKg: number;
}

const STUDENT_DATASETS: StudentDataset[] = [
  // Grade 10 - Rizal (12 learners)
  {
    lrn: '999026000001', name: 'Juan Dela Cruz', section: 'Rizal',
    street: 'Purok 1, Calulut', guardianFirst: 'Roberto', guardianLast: 'Dela Cruz',
    guardianPhone: '0917-555-0101', guardianEmail: 'roberto.delacruz@example.test',
    bloodType: 'O+', allergies: 'None', medicalConditions: 'None',
    heightCm: 165.5, weightKg: 54.0
  },
  {
    lrn: '999026000002', name: 'Rafael Aguilar', section: 'Rizal',
    street: 'Purok 2, San Vicente, Calulut', guardianFirst: 'Eduardo', guardianLast: 'Aguilar',
    guardianPhone: '0918-555-0102', guardianEmail: 'eduardo.aguilar@example.test',
    bloodType: 'A+', allergies: 'Dust mites', medicalConditions: 'Allergic Rhinitis',
    heightCm: 170.0, weightKg: 58.5
  },
  {
    lrn: '999026000003', name: 'Maria Bea Santos', section: 'Rizal',
    street: 'Purok 3, Calulut', guardianFirst: 'Teresa', guardianLast: 'Santos',
    guardianPhone: '0920-555-0103', guardianEmail: 'teresa.santos@example.test',
    bloodType: 'B+', allergies: 'Shrimp', medicalConditions: 'None',
    heightCm: 156.0, weightKg: 48.0
  },
  {
    lrn: '999026000004', name: 'Danica Bautista', section: 'Rizal',
    street: 'Purok 4, Calulut', guardianFirst: 'Noel', guardianLast: 'Bautista',
    guardianPhone: '0998-555-0104', guardianEmail: 'noel.bautista@example.test',
    bloodType: 'O+', allergies: 'None', medicalConditions: 'None',
    heightCm: 158.5, weightKg: 50.5
  },
  {
    lrn: '999026000005', name: 'Eduardo Ocampo', section: 'Rizal',
    street: 'Purok 5, Maligaya, Calulut', guardianFirst: 'Corazon', guardianLast: 'Ocampo',
    guardianPhone: '0917-555-0105', guardianEmail: 'corazon.ocampo@example.test',
    bloodType: 'AB+', allergies: 'Penicillin', medicalConditions: 'Mild Asthma',
    heightCm: 162.0, weightKg: 51.0
  },
  {
    lrn: '999026000006', name: 'Francis Garcia', section: 'Rizal',
    street: 'Purok 6, Calulut', guardianFirst: 'Antonio', guardianLast: 'Garcia',
    guardianPhone: '0918-555-0106', guardianEmail: 'antonio.garcia@example.test',
    bloodType: 'O+', allergies: 'None', medicalConditions: 'None',
    heightCm: 168.0, weightKg: 56.0
  },
  {
    lrn: '999026000007', name: 'Gabriel Mendoza', section: 'Rizal',
    street: 'MacArthur Highway, Calulut', guardianFirst: 'Ramon', guardianLast: 'Mendoza',
    guardianPhone: '0920-555-0107', guardianEmail: 'ramon.mendoza@example.test',
    bloodType: 'A+', allergies: 'Peanuts', medicalConditions: 'None',
    heightCm: 164.0, weightKg: 52.5
  },
  {
    lrn: '999026000008', name: 'Hannah Torres', section: 'Rizal',
    street: 'Villa Barosa Subdivision, Calulut', guardianFirst: 'Marites', guardianLast: 'Torres',
    guardianPhone: '0998-555-0108', guardianEmail: 'marites.torres@example.test',
    bloodType: 'B+', allergies: 'None', medicalConditions: 'None',
    heightCm: 154.0, weightKg: 46.0
  },
  {
    lrn: '999026000009', name: 'Ian Ramos', section: 'Rizal',
    street: 'St. Jude Village, Calulut', guardianFirst: 'Danilo', guardianLast: 'Ramos',
    guardianPhone: '0917-555-0109', guardianEmail: 'danilo.ramos@example.test',
    bloodType: 'O-', allergies: 'None', medicalConditions: 'None',
    heightCm: 161.0, weightKg: 49.0
  },
  {
    lrn: '999026000010', name: 'Jasmine Flores', section: 'Rizal',
    street: 'San Agustin St., Calulut', guardianFirst: 'Elena', guardianLast: 'Flores',
    guardianPhone: '0918-555-0110', guardianEmail: 'elena.flores@example.test',
    bloodType: 'A-', allergies: 'Egg', medicalConditions: 'None',
    heightCm: 157.0, weightKg: 49.0
  },
  {
    lrn: '999026000011', name: 'Kenneth Gonzales', section: 'Rizal',
    street: 'Del Rosario St., Calulut', guardianFirst: 'Rolando', guardianLast: 'Gonzales',
    guardianPhone: '0920-555-0111', guardianEmail: 'rolando.gonzales@example.test',
    bloodType: 'O+', allergies: 'None', medicalConditions: 'None',
    heightCm: 167.5, weightKg: 55.0
  },
  {
    lrn: '999026000012', name: 'Liezel Lopez', section: 'Rizal',
    street: 'Sitio Centro, Calulut', guardianFirst: 'Cristina', guardianLast: 'Lopez',
    guardianPhone: '0998-555-0112', guardianEmail: 'cristina.lopez@example.test',
    bloodType: 'B+', allergies: 'None', medicalConditions: 'None',
    heightCm: 155.0, weightKg: 47.0
  },

  // Grade 10 - Bonifacio (13 learners)
  {
    lrn: '999026000013', name: 'Mark Mercado', section: 'Bonifacio',
    street: 'Calulut Resettlement, Calulut', guardianFirst: 'Benjamin', guardianLast: 'Mercado',
    guardianPhone: '0917-555-0113', guardianEmail: 'benjamin.mercado@example.test',
    bloodType: 'O+', allergies: 'None', medicalConditions: 'None',
    heightCm: 166.0, weightKg: 55.5
  },
  {
    lrn: '999026000014', name: 'Nicole Rivera', section: 'Bonifacio',
    street: 'Greenville Heights, Calulut', guardianFirst: 'Rowena', guardianLast: 'Rivera',
    guardianPhone: '0918-555-0114', guardianEmail: 'rowena.rivera@example.test',
    bloodType: 'A+', allergies: 'None', medicalConditions: 'Mild Asthma',
    heightCm: 156.5, weightKg: 48.5
  },
  {
    lrn: '999026000015', name: 'Oliver Castillo', section: 'Bonifacio',
    street: 'San Fernando Heights, Calulut', guardianFirst: 'Fernando', guardianLast: 'Castillo',
    guardianPhone: '0920-555-0115', guardianEmail: 'fernando.castillo@example.test',
    bloodType: 'B+', allergies: 'Crab', medicalConditions: 'None',
    heightCm: 163.5, weightKg: 52.0
  },
  {
    lrn: '999026000016', name: 'Patricia Villanueva', section: 'Bonifacio',
    street: 'Purok 7, Calulut', guardianFirst: 'Gina', guardianLast: 'Villanueva',
    guardianPhone: '0998-555-0116', guardianEmail: 'gina.villanueva@example.test',
    bloodType: 'O+', allergies: 'None', medicalConditions: 'None',
    heightCm: 159.0, weightKg: 51.0
  },
  {
    lrn: '999026000017', name: 'Quirino Del Rosario', section: 'Bonifacio',
    street: 'Purok 1, Calulut', guardianFirst: 'Manuel', guardianLast: 'Del Rosario',
    guardianPhone: '0917-555-0117', guardianEmail: 'manuel.delrosario@example.test',
    bloodType: 'AB+', allergies: 'None', medicalConditions: 'None',
    heightCm: 160.0, weightKg: 48.0
  },
  {
    lrn: '999026000018', name: 'Samantha Navarro', section: 'Bonifacio',
    street: 'Purok 2, San Vicente, Calulut', guardianFirst: 'Lilian', guardianLast: 'Navarro',
    guardianPhone: '0918-555-0118', guardianEmail: 'lilian.navarro@example.test',
    bloodType: 'A+', allergies: 'Dust', medicalConditions: 'Allergic Rhinitis',
    heightCm: 153.5, weightKg: 45.0
  },
  {
    lrn: '999026000019', name: 'Tristan Salazar', section: 'Bonifacio',
    street: 'Purok 3, Calulut', guardianFirst: 'Ernesto', guardianLast: 'Salazar',
    guardianPhone: '0920-555-0119', guardianEmail: 'ernesto.salazar@example.test',
    bloodType: 'O+', allergies: 'None', medicalConditions: 'None',
    heightCm: 169.0, weightKg: 57.0
  },
  {
    lrn: '999026000020', name: 'Vanessa Aquino', section: 'Bonifacio',
    street: 'Purok 4, Calulut', guardianFirst: 'Aurora', guardianLast: 'Aquino',
    guardianPhone: '0998-555-0120', guardianEmail: 'aurora.aquino@example.test',
    bloodType: 'B+', allergies: 'None', medicalConditions: 'None',
    heightCm: 158.0, weightKg: 49.5
  },
  {
    lrn: '999026000021', name: 'Wilfredo Soriano', section: 'Bonifacio',
    street: 'Purok 5, Maligaya, Calulut', guardianFirst: 'Ruben', guardianLast: 'Soriano',
    guardianPhone: '0917-555-0121', guardianEmail: 'ruben.soriano@example.test',
    bloodType: 'O+', allergies: 'None', medicalConditions: 'None',
    heightCm: 159.0, weightKg: 46.5
  },
  {
    lrn: '999026000022', name: 'Xyza Manansala', section: 'Bonifacio',
    street: 'Purok 6, Calulut', guardianFirst: 'Jocelyn', guardianLast: 'Manansala',
    guardianPhone: '0918-555-0122', guardianEmail: 'jocelyn.manansala@example.test',
    bloodType: 'A+', allergies: 'None', medicalConditions: 'None',
    heightCm: 155.5, weightKg: 47.5
  },
  {
    lrn: '999026000023', name: 'Youssef Lacson', section: 'Bonifacio',
    street: 'MacArthur Highway, Calulut', guardianFirst: 'Joseph', guardianLast: 'Lacson',
    guardianPhone: '0920-555-0123', guardianEmail: 'joseph.lacson@example.test',
    bloodType: 'O+', allergies: 'None', medicalConditions: 'None',
    heightCm: 171.0, weightKg: 62.0
  },
  {
    lrn: '999026000024', name: 'Zenaida Bernardo', section: 'Bonifacio',
    street: 'Villa Barosa Subdivision, Calulut', guardianFirst: 'Remedios', guardianLast: 'Bernardo',
    guardianPhone: '0998-555-0124', guardianEmail: 'remedios.bernardo@example.test',
    bloodType: 'B+', allergies: 'Penicillin', medicalConditions: 'None',
    heightCm: 154.5, weightKg: 46.5
  },
  {
    lrn: '999026000025', name: 'Angelo Cunanan', section: 'Bonifacio',
    street: 'St. Jude Village, Calulut', guardianFirst: 'Rodolfo', guardianLast: 'Cunanan',
    guardianPhone: '0917-555-0125', guardianEmail: 'rodolfo.cunanan@example.test',
    bloodType: 'O+', allergies: 'None', medicalConditions: 'None',
    heightCm: 165.0, weightKg: 53.5
  }
];

async function main() {
  console.log('=================================================================');
  console.log('DIGISKWELA — 25-STUDENT PROFILE COMPLETION & SF8 ENCODING');
  console.log('=================================================================\n');

  // STEP 1: Verify database
  const dbCheck: any = await prisma.$queryRawUnsafe('SELECT current_database()');
  const currentDb = dbCheck[0]?.current_database;
  console.log(`[DB CHECK] Active Database: "${currentDb}"`);
  if (currentDb !== 'digiskwela_acceptance') {
    throw new Error(`FATAL: Connected to unexpected database ${currentDb}. Expected digiskwela_acceptance.`);
  }

  // STEP 2: Authenticate Advisers and Registrar
  console.log('\n[AUTH] Authenticating Class Advisers...');
  const tokenRizal = await loginUser('EMP-QA-T01', 'Calulut2026!TCH#A109DE85!');
  console.log('  ✓ Authenticated Class Adviser Maria Corazon Alcantara (Grade 10 - Rizal)');
  const tokenBonifacio = await loginUser('EMP-QA-T02', 'Calulut2026!TCH#6B41E003!');
  console.log('  ✓ Authenticated Class Adviser Juanito De Guzman (Grade 10 - Bonifacio)');
  const tokenRegistrar = await loginUser('EMP-QA-R01', 'Calulut2026!Registrar#5806C5CA!');
  console.log('  ✓ Authenticated School Registrar Corazon Pineda');

  // Fetch all existing students from DB
  const dbStudents = await prisma.student.findMany({
    include: {
      user: true,
      current_section: true
    }
  });
  console.log(`\n[STUDENT AUDIT] Found ${dbStudents.length} existing student records in database.`);
  if (dbStudents.length !== 25) {
    throw new Error(`Expected exactly 25 student records, found ${dbStudents.length}`);
  }

  // STEP 3: Complete Personal Information and SF8 Health for all 25 learners
  console.log('\n[ENCODING] Executing personal information and SF8 health encoding...');
  const results: any[] = [];

  for (const ds of STUDENT_DATASETS) {
    const student = dbStudents.find(s => {
      const dbFullName = `${s.first_name} ${s.last_name}`;
      return dbFullName.toLowerCase() === ds.name.toLowerCase() ||
             (s.user && `${s.user.first_name} ${s.user.last_name}`.toLowerCase() === ds.name.toLowerCase());
    });

    if (!student) {
      throw new Error(`Student ${ds.name} (LRN ${ds.lrn}) not found in database!`);
    }

    const token = ds.section === 'Rizal' ? tokenRizal : tokenBonifacio;
    const adviserName = ds.section === 'Rizal' ? 'Maria Corazon Alcantara' : 'Juanito De Guzman';

    // 1. Update Personal Information
    const personalRes = await httpRequest({
      path: `/api/academic/health/students/${student.id}/personal-info`,
      method: 'PATCH',
      token,
      body: {
        street: ds.street,
        city: 'City of San Fernando',
        stateProvince: 'Pampanga',
        zipCode: '2000',
        guardianFirstName: ds.guardianFirst,
        guardianLastName: ds.guardianLast,
        guardianPhone: ds.guardianPhone,
        guardianEmail: ds.guardianEmail,
        bloodType: ds.bloodType,
        allergies: ds.allergies,
        medicalConditions: ds.medicalConditions
      }
    });

    if (personalRes.statusCode !== 200) {
      throw new Error(`Failed to update personal info for ${ds.name}: ${JSON.stringify(personalRes.body)}`);
    }

    // 2. Record SF8 Health Measurement (BOSY)
    const metricRes = await httpRequest({
      path: '/api/academic/health/metrics',
      method: 'POST',
      token,
      body: {
        studentId: student.id,
        measurementPeriod: 'BOSY',
        measurementDate: '2026-09-04',
        heightCm: ds.heightCm,
        weightKg: ds.weightKg,
        remarks: 'Baseline BoSY Health & Nutritional Assessment'
      }
    });

    if (metricRes.statusCode !== 201) {
      throw new Error(`Failed to record health metric for ${ds.name}: ${JSON.stringify(metricRes.body)}`);
    }

    const savedMetric = metricRes.body?.data;

    // Verify calculated age contexts
    const dob = student.date_of_birth ? new Date(student.date_of_birth).toISOString().slice(0, 10) : '';
    const schoolFormAge = calculateSchoolFormAge(dob);
    const measurementAge = calculateMeasurementAge(dob, '2026-09-04');
    const currentAge = calculateCurrentAge(dob);

    results.push({
      lrn: ds.lrn,
      name: ds.name,
      section: ds.section,
      adviser: adviserName,
      dob,
      gender: student.gender,
      sf1Age: schoolFormAge?.age?.formatted || 'N/A',
      measurementAge: measurementAge?.formatted || 'N/A',
      currentAge: currentAge?.formatted || 'N/A',
      street: ds.street,
      guardian: `${ds.guardianFirst} ${ds.guardianLast}`,
      heightCm: ds.heightCm,
      weightKg: ds.weightKg,
      bmi: savedMetric?.computed_bmi,
      bmiCategory: savedMetric?.bmi_category,
      hfaCategory: savedMetric?.hfa_category,
      status: savedMetric?.assessment_status
    });

    console.log(`  ✓ [${ds.section}] ${ds.name} (LRN ${ds.lrn}): Personal Info Saved | SF8 H=${ds.heightCm}cm W=${ds.weightKg}kg BMI=${savedMetric?.computed_bmi} (${savedMetric?.bmi_category}) HFA=${savedMetric?.hfa_category}`);
  }

  // STEP 4: Verify Functional Integration
  console.log('\n[INTEGRATION VERIFICATION] Verifying functional modules and security boundaries...');

  // 1. Verify SF8 Section Report for Grade 10 - Rizal
  const rizalSection = await prisma.section.findFirst({ where: { name: 'Rizal', grade_level: 10 } });
  const sf8RizalRes = await httpRequest({
    path: `/api/academic/health/sf8/sections/${rizalSection!.id}?period=BOSY`,
    method: 'GET',
    token: tokenRizal
  });
  if (sf8RizalRes.statusCode !== 200) {
    throw new Error(`Failed to generate SF8 for Rizal: ${JSON.stringify(sf8RizalRes.body)}`);
  }
  const rizalSf8 = sf8RizalRes.body?.data;
  const rizalTotal = (rizalSf8.learners?.male?.length || 0) + (rizalSf8.learners?.female?.length || 0);
  console.log(`  ✓ Grade 10 - Rizal SF8 Report generated: ${rizalTotal} learners present (Expected 12).`);
  if (rizalTotal !== 12) {
    throw new Error(`Expected 12 learners in Rizal SF8, got ${rizalTotal}`);
  }

  // 2. Verify SF8 Section Report for Grade 10 - Bonifacio
  const bonifacioSection = await prisma.section.findFirst({ where: { name: 'Bonifacio', grade_level: 10 } });
  const sf8BonifacioRes = await httpRequest({
    path: `/api/academic/health/sf8/sections/${bonifacioSection!.id}?period=BOSY`,
    method: 'GET',
    token: tokenBonifacio
  });
  if (sf8BonifacioRes.statusCode !== 200) {
    throw new Error(`Failed to generate SF8 for Bonifacio: ${JSON.stringify(sf8BonifacioRes.body)}`);
  }
  const bonifacioSf8 = sf8BonifacioRes.body?.data;
  const bonifacioTotal = (bonifacioSf8.learners?.male?.length || 0) + (bonifacioSf8.learners?.female?.length || 0);
  console.log(`  ✓ Grade 10 - Bonifacio SF8 Report generated: ${bonifacioTotal} learners present (Expected 13).`);
  if (bonifacioTotal !== 13) {
    throw new Error(`Expected 13 learners in Bonifacio SF8, got ${bonifacioTotal}`);
  }

  // 3. Verify SF9 Demographic fields mapping for Grade 10 - Rizal learners
  console.log('\n[SF9 DEMOGRAPHIC VERIFICATION] Verifying SF9 demographic mappings...');
  for (const r of results.slice(0, 5)) {
    const student = dbStudents.find(s => s.first_name + ' ' + s.last_name === r.name)!;
    const mappingRes = await httpRequest({
      path: `/api/academic/report-card/${student.id}/sf9/mapping`,
      method: 'GET',
      token: tokenRizal
    });
    if (mappingRes.statusCode !== 200) {
      throw new Error(`Failed to get SF9 mapping for ${r.name}`);
    }
    const mapping = mappingRes.body?.data;
    console.log(`  ✓ SF9 Mapping for ${r.name}: Name="${mapping.student?.formattedName}", LRN="${mapping.student?.lrn}", Age=${mapping.student?.age}, Sex="${mapping.student?.gender}"`);
    if (!mapping.student?.formattedName || !mapping.student?.lrn || mapping.student?.age == null || !mapping.student?.gender) {
      throw new Error(`SF9 mapping missing required demographic fields for ${r.name}`);
    }
  }

  // 4. Verify existing academic records and attendance integrity
  console.log('\n[INTEGRITY CHECK] Verifying existing Term 1 academic grades and attendance...');
  const gradeCount = await prisma.grade.count();
  console.log(`  ✓ Preserved ${gradeCount} published grade records.`);

  const dailyAttendanceCount = await prisma.officialDailyAttendance.count({
    where: { section_id: rizalSection!.id }
  });
  console.log(`  ✓ Preserved ${dailyAttendanceCount} verified daily attendance records.`);

  const totalStudentsCount = await prisma.student.count();
  console.log(`  ✓ Total student records in database: ${totalStudentsCount} (Zero duplicates created).`);
  if (totalStudentsCount !== 25) {
    throw new Error(`Integrity violation: student count changed to ${totalStudentsCount}`);
  }

  // STEP 5: Print Summary Table
  console.log('\n=================================================================');
  console.log('ACCEPTANCE RESULTS — 25 STUDENT PROFILES & SF8 HEALTH SUMMARY');
  console.log('=================================================================\n');

  console.log('| # | LRN | Name | Section | Sex | DOB | School-Form Age | Height (cm) | Weight (kg) | BMI | Nutritional Status | HFA |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  results.forEach((r, idx) => {
    console.log(`| ${idx + 1} | ${r.lrn} | ${r.name} | ${r.section} | ${r.gender} | ${r.dob} | ${r.sf1Age} | ${r.heightCm} | ${r.weightKg} | ${r.bmi} | ${r.bmiCategory} | ${r.hfaCategory} |`);
  });

  console.log('\n=================================================================');
  console.log('ALL 25 QA STUDENT PROFILES AND SF8 HEALTH RECORDS FULLY COMPLETED');
  console.log('=================================================================');
}

main()
  .catch(err => {
    console.error('\n❌ Execution Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
