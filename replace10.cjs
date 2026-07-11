const fs = require('fs');

const files = [
  'src/app/teacher/shared/TSidebar.tsx',
  'src/app/student/StudentPortal.tsx',
  'src/app/principal/shared/PSidebar.tsx',
  'src/app/nurse/shared/NSidebar.tsx',
  'src/app/admin/shared/AdminSidebar.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\r\n/g, '\n');
    
    // Replace the exact target structure with 10 spaces indentation (common in these files)
    const target = `<div style={{ padding: "22px 24px", borderBottom: \`1px solid \${C.borderHeavy}\`, display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>\n          <div>\n            <div style={{ color: "#fff"`;
    
    const replacement = `<div style={{ padding: "22px 24px", borderBottom: \`1px solid \${C.borderHeavy}\`, display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>\n          <img src="/school_seal.jpg" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} alt="School Logo" />\n          <div>\n            <div style={{ color: "#fff"`;

    let newContent = content.replace(target, replacement);

    // Try finding with 8 spaces indentation (AdminSidebar has less indentation)
    const target2 = `<div style={{ padding: "22px 24px", borderBottom: \`1px solid \${C.borderHeavy}\`, display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>\n        <div>\n          <div style={{ color: "#fff"`;
    
    const replacement2 = `<div style={{ padding: "22px 24px", borderBottom: \`1px solid \${C.borderHeavy}\`, display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>\n        <img src="/school_seal.jpg" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} alt="School Logo" />\n        <div>\n          <div style={{ color: "#fff"`;

    newContent = newContent.replace(target2, replacement2);
    
    fs.writeFileSync(file, newContent);
    console.log(`Updated ${file}`);
  }
});
