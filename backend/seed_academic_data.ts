import { PrismaClient } from '@prisma/client';
import { randomUUID as generateId } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Setting up mock academic data for Teacher Portal testing...');

  // 1. Create Academic Year
  let year = await prisma.academicYear.findFirst({ where: { is_current: true } });
  if (!year) {
    year = await prisma.academicYear.create({
      data: {
        id: generateId(),
        name: 'SY 2025-2026',
        start_date: new Date('2025-06-01'),
        end_date: new Date('2026-04-30'),
        is_current: true,
      }
    });
    console.log(`Created Academic Year: ${year.name}`);
  } else {
    console.log(`Using existing Academic Year: ${year.name}`);
  }

  // 2. Create Terms
  const termsData = [
    { key: 'T1', name: '1st Quarter' },
    { key: 'T2', name: '2nd Quarter' },
    { key: 'T3', name: '3rd Quarter' },
    { key: 'T4', name: '4th Quarter' },
  ];
  for (const t of termsData) {
    const existing = await prisma.term.findFirst({ where: { academic_year_id: year.id, key: t.key } });
    if (!existing) {
      await prisma.term.create({
        data: {
          id: generateId(),
          academic_year_id: year.id,
          key: t.key,
          name: t.name,
          start_date: new Date('2025-06-01'),
          end_date: new Date('2025-08-31'),
        }
      });
      console.log(`Created Term: ${t.name}`);
    }
  }

  // 3. Rename "Test Teacher" to "Ana R. Soriano"
  let teacher = await prisma.teacher.findFirst({
    include: { user: true }
  });
  if (teacher && teacher.user.first_name === 'Test') {
    await prisma.user.update({
      where: { id: teacher.user.id },
      data: {
        first_name: 'Ana',
        last_name: 'Soriano',
        middle_name: 'R.',
      }
    });
    console.log(`Renamed teacher to Ana R. Soriano`);
  } else if (!teacher) {
     console.log("No teacher found, please ensure a teacher exists in the DB.");
     return;
  }

  // 4. Create Subjects
  const subjectsData = ['Mathematics 8', 'Science 9', 'Filipino 10'];
  const subjects = [];
  for (const sName of subjectsData) {
    let sub = await prisma.subject.findFirst({ where: { name: sName } });
    if (!sub) {
      sub = await prisma.subject.create({
        data: { id: generateId(), name: sName, code: sName.substring(0, 4).toUpperCase() }
      });
      console.log(`Created Subject: ${sName}`);
    }
    subjects.push(sub);
  }

  // 5. Create Sections
  const sectionsData = [
    { name: 'Rizal', grade_level: 8 },
    { name: 'Einstein', grade_level: 9 },
    { name: 'Pilot', grade_level: 10 },
  ];
  const sections = [];
  for (const sData of sectionsData) {
    let sec = await prisma.section.findFirst({ where: { name: sData.name, academic_year_id: year.id } });
    if (!sec) {
      sec = await prisma.section.create({
        data: {
          id: generateId(),
          academic_year_id: year.id,
          name: sData.name,
          grade_level: sData.grade_level
        }
      });
      console.log(`Created Section: Grade ${sData.grade_level} ${sData.name}`);
    }
    sections.push(sec);
  }

  // 6. Assign Teacher to Sections
  // Assignments: Math 8 - Rizal, Science 9 - Einstein, Filipino 10 - Pilot
  for (let i = 0; i < 3; i++) {
    const existingAssign = await prisma.teacherSubjectAssignment.findFirst({
      where: { teacher_id: teacher.id, section_id: sections[i].id, subject_id: subjects[i].id }
    });
    if (!existingAssign) {
      await prisma.teacherSubjectAssignment.create({
        data: {
          id: generateId(),
          teacher_id: teacher.id,
          section_id: sections[i].id,
          subject_id: subjects[i].id,
          academic_year_id: year.id
        }
      });
      console.log(`Assigned Ana R. Soriano to ${subjects[i].name} in ${sections[i].name}`);
    }
  }

  console.log('Mock academic data setup complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
