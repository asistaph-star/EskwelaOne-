const fs = require('fs');

// 1. Fix types/index.ts
let types = fs.readFileSync('src/app/shared/types/index.ts', 'utf8');
types = types.replace(
  'export type GbGrades = Record<number, Record<string, string>>;',
  'export type GbGrades = Record<string | number, Record<string, string>>;'
);
fs.writeFileSync('src/app/shared/types/index.ts', types);

const rosterBlock = `  const ROSTER = (() => {
    try {
      const saved = localStorage.getItem('hub_students');
      if (saved) {
        return JSON.parse(saved).map((s:any) => ({
          id: s.id,
          name: s.surname + ", " + s.first,
          gender: s.gender || "m"
        }));
      }
    } catch(e) {}
    return GB_ROSTER;
  })();\n\n`;

// 2. Fix GradebookFullScreen.tsx
let gbf = fs.readFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', 'utf8');
gbf = gbf.replace(/\r\n/g, '\n');
const gbfTarget = `  const [allData, setAllData] = useState<Record<QKey,QData>>(() => {`;
gbf = gbf.replace(gbfTarget, rosterBlock + gbfTarget);
gbf = gbf.replace(/GB_ROSTER\.map/g, 'ROSTER.map');
gbf = gbf.replace(/GB_ROSTER\.length/g, 'ROSTER.length');
// Fix sid types
gbf = gbf.replace(/sid:number/g, 'sid:number|string');
gbf = gbf.replace(/sid: number/g, 'sid: number | string');
fs.writeFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', gbf);

// 3. Fix QuarterlySummaryScreen.tsx
let qss = fs.readFileSync('src/app/teacher/grades/QuarterlySummaryScreen.tsx', 'utf8');
qss = qss.replace(/\r\n/g, '\n');
const qssTarget = `  const [weights, setWeights] = useState({ww:25,pt:50,qa:25});`;
qss = qss.replace(qssTarget, rosterBlock + qssTarget);
qss = qss.replace(/GB_ROSTER\.map/g, 'ROSTER.map');
qss = qss.replace(/GB_ROSTER\.length/g, 'ROSTER.length');
qss = qss.replace(/sid:number/g, 'sid:number|string');
qss = qss.replace(/sid: number/g, 'sid: number | string');
fs.writeFileSync('src/app/teacher/grades/QuarterlySummaryScreen.tsx', qss);

console.log("Full-screen Gradebooks synchronized with Add Student.");
