const fs = require('fs');

let hub = fs.readFileSync('src/app/teacher/classroom/ClassroomHub.tsx', 'utf8');
hub = hub.replace(/\r\n/g, '\n');

// Replace the students state initializer to be more robust:
// - Validate that stored data has the correct shape (surname + first fields)
// - Always start from STUDENTS_GR8 and only append valid new students
const oldStudentState = `  const [students, setStudents] = useState<typeof STUDENTS_GR8>(() => {
    try {
      const saved = localStorage.getItem('hub_students');
      if (saved) return JSON.parse(saved);
    } catch(e){}
    return STUDENTS_GR8;
  });`;

const newStudentState = `  const [students, setStudents] = useState<typeof STUDENTS_GR8>(() => {
    try {
      const saved = localStorage.getItem('hub_students');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only append students that were manually added (string IDs starting with 's')
        // Always keep the base STUDENTS_GR8 to preserve the original 8 students with correct data
        const newOnes = parsed.filter((s: any) => typeof s.id === 'string' && s.id.startsWith('s') && s.surname && s.first);
        return [...STUDENTS_GR8, ...newOnes];
      }
    } catch(e){}
    return STUDENTS_GR8;
  });`;

hub = hub.replace(oldStudentState, newStudentState);

// Also update handleAddStudent to only save the "new" students (not the whole list including base ones)
// so localStorage doesn't store the base 8 again
const oldHandle = `    setStudents(added);
    localStorage.setItem('hub_students', JSON.stringify(added));`;

const newHandle = `    setStudents(added);
    // Only persist the newly added students (not the original STUDENTS_GR8 base)
    const newOnly = added.filter((s: any) => typeof s.id === 'string' && s.id.startsWith('s'));
    localStorage.setItem('hub_students', JSON.stringify(newOnly));`;

hub = hub.replace(oldHandle, newHandle);

fs.writeFileSync('src/app/teacher/classroom/ClassroomHub.tsx', hub);
console.log("ClassroomHub: students state fixed to always merge STUDENTS_GR8 + new students.");
