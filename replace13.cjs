const fs = require('fs');

let hub = fs.readFileSync('src/app/teacher/classroom/ClassroomHub.tsx', 'utf8');
hub = hub.replace(/\r\n/g, '\n');

// 1. Add gradebookRecords state
const stateTarget = `  const [students, setStudents] = useState<typeof STUDENTS_GR8>(() => {`;
const stateAdd = `  const [gradebookRecords, setGradebookRecords] = useState<typeof GRADEBOOK>(() => {
    try {
      const saved = localStorage.getItem('hub_gradebook');
      if (saved) return JSON.parse(saved);
    } catch(e){}
    return GRADEBOOK;
  });
  const [students, setStudents] = useState<typeof STUDENTS_GR8>(() => {`;

hub = hub.replace(stateTarget, stateAdd);

// 2. Update handleAddStudent
const handleAddTarget = `    setStudents(added);
    localStorage.setItem('hub_students', JSON.stringify(added));
    setShowAddModal(false);`;
const handleAddReplace = `    setStudents(added);
    localStorage.setItem('hub_students', JSON.stringify(added));

    const addedGb = [...gradebookRecords, {
      name: \`\${newStudent.surname}, \${newStudent.first}\`,
      ww: ["", "", "", "", ""],
      pt: ["", "", ""],
      qa: ""
    }] as any;
    setGradebookRecords(addedGb);
    localStorage.setItem('hub_gradebook', JSON.stringify(addedGb));

    setShowAddModal(false);`;

hub = hub.replace(handleAddTarget, handleAddReplace);

// 3. Replace GRADEBOOK.map
hub = hub.replace(/\{GRADEBOOK\.map/g, '{gradebookRecords.map');

fs.writeFileSync('src/app/teacher/classroom/ClassroomHub.tsx', hub);
console.log("ClassroomHub updated for Gradebook synchronization.");
