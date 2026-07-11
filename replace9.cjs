const fs = require('fs');

let studentPortal = fs.readFileSync('src/app/student/StudentPortal.tsx', 'utf8');
studentPortal = studentPortal.replace(/\r\n/g, '\n');

studentPortal = studentPortal.replace(
  `<div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, letterSpacing: "0.06em" }}>GOOD MORNING</div>\n                    <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Juan Miguel Santos</div>\n                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 2, marginBottom: 6 }}>Tuesday, June 10, 2025 &middot; Week 3, Q1</div>`,
  `<div style={{ color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 6 }}>Juan Miguel Santos</div>`
);
fs.writeFileSync('src/app/student/StudentPortal.tsx', studentPortal);

let teacherDashboard = fs.readFileSync('src/app/teacher/dashboard/DashboardScreen.tsx', 'utf8');
teacherDashboard = teacherDashboard.replace(/\r\n/g, '\n');
teacherDashboard = teacherDashboard.replace(
  `<div style={{ color:"rgba(255,255,255,0.6)", fontSize:10, letterSpacing:"0.06em" }}>GOOD MORNING</div>\n              <div style={{ color:"#fff", fontSize:16, fontWeight:700, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Ms. Ana R. Soriano</div>\n              <div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, marginTop:2, marginBottom:6 }}>Tuesday, June 10, 2025 &middot; Week 3, Q1</div>`,
  `<div style={{ color:"#fff", fontSize:16, fontWeight:700, fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom: 6 }}>Ms. Ana R. Soriano</div>`
);
fs.writeFileSync('src/app/teacher/dashboard/DashboardScreen.tsx', teacherDashboard);

console.log("Removed GOOD MORNING and date from headers");
