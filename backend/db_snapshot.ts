import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const fks: any[] = await prisma.$queryRaw`
    SELECT tc.table_name, kcu.column_name AS fk_column,
      ccu.table_name AS references_table, ccu.column_name AS references_column,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name, kcu.column_name;
  `;
  
  console.log("table_name | fk_column | references_table | references_column | delete_rule");
  for (const row of fks) {
    console.log(`${row.table_name} | ${row.fk_column} | ${row.references_table} | ${row.references_column} | ${row.delete_rule}`);
  }

  console.log('---SPLIT---');

  const cols: any[] = await prisma.$queryRaw`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `;
  
  console.log("table_name | column_name | data_type | is_nullable");
  for (const row of cols) {
    console.log(`${row.table_name} | ${row.column_name} | ${row.data_type} | ${row.is_nullable}`);
  }
}

main().finally(() => prisma.$disconnect());
