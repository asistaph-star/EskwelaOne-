const fs = require('fs');
const files = [
  'src/app/teacher/TeacherApp.tsx',
  'src/app/student/StudentPortal.tsx',
  'src/app/principal/PrincipalApp.tsx',
  'src/app/nurse/NurseApp.tsx',
  'src/app/admin/AdminApp.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    
    // The watermark image has src="/school_seal.jpg"
    // Replace the block including the preceding comment if it exists
    text = text.replace(/\{\/\*\s*Global Watermark\s*\*\/\}\s*<img[^>]+src="\/school_seal\.jpg"[^>]+>/gs, '');
    
    // Just in case it doesn't have the comment
    text = text.replace(/<img[^>]+src="\/school_seal\.jpg"[^>]+opacity:\s*0\.05[^>]*>/gs, '');

    fs.writeFileSync(f, text);
    console.log(`Removed watermark from ${f}`);
  }
});
