const fs = require('fs');
let content = fs.readFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', 'utf8');

content = content.replace(/\r\n/g, '\n');

// Update imports
content = content.replace(
  `import { ChevronDown, FileText, ChevronLeft, Plus, Download, Eye, Save } from 'lucide-react';`,
  `import { ChevronDown, FileText, ChevronLeft, Plus, Download, Eye, Save, Trash2 } from 'lucide-react';`
);

// Replace WW red button
const oldWWBtn = `<button onClick={() => deleteWW(it.id)} title="Delete column" style={{position:"absolute", top:-6, right:-8, background:C.red, border:"none", borderRadius:"50%", color:"#fff", width:14, height:14, fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", paddingBottom:2}}>×</button>`;
const newWWBtn = `<button onClick={() => deleteWW(it.id)} title="Delete column" style={{position:"absolute", top:2, right:2, background:"transparent", border:"none", color:"rgba(255,255,255,0.6)", width:14, height:14, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0}} onMouseEnter={e=>(e.currentTarget.style.color="#FCA5A5")} onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,0.6)")}><Trash2 size={10}/></button>`;

content = content.replace(oldWWBtn, newWWBtn);

// Replace PT red button
const oldPTBtn = `<button onClick={() => deletePT(it.id)} title="Delete column" style={{position:"absolute", top:-6, right:-8, background:C.red, border:"none", borderRadius:"50%", color:"#fff", width:14, height:14, fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", paddingBottom:2}}>×</button>`;
const newPTBtn = `<button onClick={() => deletePT(it.id)} title="Delete column" style={{position:"absolute", top:2, right:2, background:"transparent", border:"none", color:"rgba(255,255,255,0.6)", width:14, height:14, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0}} onMouseEnter={e=>(e.currentTarget.style.color="#FCA5A5")} onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,0.6)")}><Trash2 size={10}/></button>`;

content = content.replace(oldPTBtn, newPTBtn);

fs.writeFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', content);
console.log("Replaced red x with trash icon");
