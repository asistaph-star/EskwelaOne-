const fs = require('fs');

// The correct ROSTER block: always start from GB_ROSTER, then append new students from localStorage
const correctRosterBlock = `  const ROSTER = (() => {
    try {
      const saved = localStorage.getItem('hub_students');
      if (saved) {
        const stored = JSON.parse(saved);
        // Start from GB_ROSTER (the original 8 students with numeric IDs)
        // then append any extra students that were added via the form
        const newStudents = stored
          .filter((s:any) => typeof s.id === 'string' && s.id.startsWith('s'))
          .map((s:any, i:number) => ({
            id: 100 + i,
            surname: s.surname || s.name || '',
            first: s.first || ''
          }));
        return [...GB_ROSTER, ...newStudents];
      }
    } catch(e) {}
    return GB_ROSTER;
  })();\n\n`;

// ── GradebookFullScreen ──
let gbf = fs.readFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', 'utf8');
gbf = gbf.replace(/\r\n/g, '\n');

// Remove the broken ROSTER block and replace with correct one
gbf = gbf.replace(
  /  const ROSTER = \(\(\) => \{[\s\S]*?return GB_ROSTER;\n  \}\)\(\);\n\n/,
  correctRosterBlock
);

fs.writeFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', gbf);

// ── QuarterlySummaryScreen ──
let qss = fs.readFileSync('src/app/teacher/grades/QuarterlySummaryScreen.tsx', 'utf8');
qss = qss.replace(/\r\n/g, '\n');

// Check if ROSTER block was added (it's missing the newStudents in QuarterlySummaryScreen)
if (qss.includes('const ROSTER = (() => {')) {
  qss = qss.replace(
    /  const ROSTER = \(\(\) => \{[\s\S]*?return GB_ROSTER;\n  \}\)\(\);\n\n/,
    correctRosterBlock
  );
} else {
  // Inject before const [weights]
  qss = qss.replace(
    `  const [weights]  = useState({ww:25,pt:50,qa:25});`,
    correctRosterBlock + `  const [weights]  = useState({ww:25,pt:50,qa:25});`
  );
}

fs.writeFileSync('src/app/teacher/grades/QuarterlySummaryScreen.tsx', qss);

console.log("Done — ROSTER now starts from GB_ROSTER + appends new students.");
