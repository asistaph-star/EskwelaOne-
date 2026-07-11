const fs = require('fs');
let content = fs.readFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', 'utf8');

// Normalize newlines to avoid mismatch
content = content.replace(/\r\n/g, '\n');

// 1. Replace the useState initialization
content = content.replace(
  `  const [allData, setAllData] = useState<Record<QKey,QData>>(Q_SEED);`,
  `  const [allData, setAllData] = useState<Record<QKey,QData>>(() => {\n    try {\n      const saved = localStorage.getItem('eskwela_grades');\n      if (saved) return JSON.parse(saved);\n    } catch(e) {}\n    return Q_SEED;\n  });`
);

// 2. Replace the Save button onClick handler
content = content.replace(
  `          <button onClick={() => alert("Grades saved successfully!")}`,
  `          <button onClick={() => { localStorage.setItem('eskwela_grades', JSON.stringify(allData)); alert("Grades saved successfully!"); }}`
);

fs.writeFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', content);
console.log("Persistence patched successfully!");
