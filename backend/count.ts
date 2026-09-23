import prisma from './src/config/database.js';
async function count() {
  const counts = await Promise.all([
    prisma.studentAllergy.count(),
    prisma.studentMedicalCondition.count(),
    prisma.clinicReferralSymptom.count(),
    prisma.clinicReferralDiagnosis.count(),
    prisma.clinicReferralMedication.count(),
    prisma.clinicReferralTreatment.count()
  ]);
  console.log('Allergies:', counts[0]);
  console.log('Medical Conditions:', counts[1]);
  console.log('Symptoms:', counts[2]);
  console.log('Diagnoses:', counts[3]);
  console.log('Medications:', counts[4]);
  console.log('Treatments:', counts[5]);
}
count().finally(() => prisma.$disconnect());
