import prisma from './src/config/database'; // Import the extended prisma client

async function main() {
  const lrn = '123456789012';
  try {
    const student = await prisma.student.findUnique({
      where: { lrn }
    });
    console.log('Result using extended prisma client (lrn lookup):', student ? 'FOUND ' + student.id : 'NOT FOUND');
  } catch (e) {
    console.error('Error during query:', e.message);
  }
}
main().finally(() => process.exit(0));
