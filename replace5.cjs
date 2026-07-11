const fs = require('fs');
let content = fs.readFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', 'utf8');

content = content.replace(
  `import { ChevronDown, FileText, ChevronLeft, Plus, Download, Eye } from 'lucide-react';`,
  `import { ChevronDown, FileText, ChevronLeft, Plus, Download, Eye, Save } from 'lucide-react';`
);

content = content.replace(
  `  function addWW() {\n    const n = wwItems.length+1;\n    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],wwItems:[...prev[quarter].wwItems,{id:\`ww\${n}\`,label:\`WW \${n}\`,max:100}]}}));\n  }`,
  `  function addWW() {\n    const n = wwItems.length+1;\n    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],wwItems:[...prev[quarter].wwItems,{id:\`ww\${n}\`,label:\`WW \${n}\`,max:100}]}}));\n  }\n  function deleteWW(id:string) {\n    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],wwItems:prev[quarter].wwItems.filter(x=>x.id!==id)}}));\n  }`
);

content = content.replace(
  `  function addPT() {\n    const n = ptItems.length+1;\n    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],ptItems:[...prev[quarter].ptItems,{id:\`pt\${n}\`,label:\`PT \${n}\`,max:100}]}}));\n  }`,
  `  function addPT() {\n    const n = ptItems.length+1;\n    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],ptItems:[...prev[quarter].ptItems,{id:\`pt\${n}\`,label:\`PT \${n}\`,max:100}]}}));\n  }\n  function deletePT(id:string) {\n    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],ptItems:prev[quarter].ptItems.filter(x=>x.id!==id)}}));\n  }`
);

content = content.replace(
  `        <div style={{marginLeft:"auto"}}>\n          <button style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",\n            background:C.m700,color:"#fff",borderRadius:4,border:"none",cursor:"pointer",\n            fontSize:12,fontWeight:700}}>\n            <Download size={13}/> Export Excel\n          </button>\n        </div>`,
  `        <div style={{marginLeft:"auto", display:"flex", gap:10}}>\n          <button onClick={() => alert("Grades saved successfully!")} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",\n            background:C.m600,color:"#fff",borderRadius:4,border:"none",cursor:"pointer",\n            fontSize:12,fontWeight:700}}>\n            <Save size={13}/> Save\n          </button>\n          <button style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",\n            background:C.m700,color:"#fff",borderRadius:4,border:"none",cursor:"pointer",\n            fontSize:12,fontWeight:700}}>\n            <Download size={13}/> Export Excel\n          </button>\n        </div>`
);

content = content.replace(
  `              {wwItems.map(it=>\n                subTH(<div style={{lineHeight:1.4}}>\n                  <div style={{fontSize:10,fontWeight:700,color:"#fff",letterSpacing:"0.04em"}}>{it.label}</div>\n                  {MaxInput(it, updateWWMax)}\n                </div>, activeAccent, "#fff", 34, it.id)\n              )}`,
  `              {wwItems.map(it=>\n                subTH(<div style={{lineHeight:1.4, position:"relative"}}>\n                  <button onClick={() => deleteWW(it.id)} title="Delete column" style={{position:"absolute", top:-6, right:-8, background:C.red, border:"none", borderRadius:"50%", color:"#fff", width:14, height:14, fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", paddingBottom:2}}>×</button>\n                  <div style={{fontSize:10,fontWeight:700,color:"#fff",letterSpacing:"0.04em"}}>{it.label}</div>\n                  {MaxInput(it, updateWWMax)}\n                </div>, activeAccent, "#fff", 34, it.id)\n              )}`
);

content = content.replace(
  `              {ptItems.map(it=>\n                subTH(<div style={{lineHeight:1.4}}>\n                  <div style={{fontSize:10,fontWeight:700,color:"#fff",letterSpacing:"0.04em"}}>{it.label}</div>\n                  {MaxInput(it, updatePTMax)}\n                </div>, "hsl(220,50%,30%)", "#fff", 34, it.id)\n              )}`,
  `              {ptItems.map(it=>\n                subTH(<div style={{lineHeight:1.4, position:"relative"}}>\n                  <button onClick={() => deletePT(it.id)} title="Delete column" style={{position:"absolute", top:-6, right:-8, background:C.red, border:"none", borderRadius:"50%", color:"#fff", width:14, height:14, fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", paddingBottom:2}}>×</button>\n                  <div style={{fontSize:10,fontWeight:700,color:"#fff",letterSpacing:"0.04em"}}>{it.label}</div>\n                  {MaxInput(it, updatePTMax)}\n                </div>, "hsl(220,50%,30%)", "#fff", 34, it.id)\n              )}`
);

fs.writeFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', content);
console.log("Done updating GradebookFullScreen.tsx");
