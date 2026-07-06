const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/teacher/classroom/ClassroomHub.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Match:
// <<<<<<< HEAD(optional \r\n)
// (content A)
// =======(optional \r\n)
// (content B)
// >>>>>>> (anything to end of line)(optional \r\n)
const conflictRegex = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>>[^\r\n]*\r?\n/g;

let matches = 0;
content = content.replace(conflictRegex, (match, p1, p2) => {
  matches++;
  return p1 + p2;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Resolved ${matches} conflicts in ClassroomHub.tsx by keeping both contents.`);
