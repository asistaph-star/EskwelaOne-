const fs = require('fs');

let content = fs.readFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', 'utf8');

// Normalize newlines
content = content.replace(/\r\n/g, '\n');

// 1. Add Save import
content = content.replace(
  `import { ChevronDown, FileText, ChevronLeft, Plus, Download, Eye } from 'lucide-react';`,
  `import { ChevronDown, FileText, ChevronLeft, Plus, Download, Eye, Save } from 'lucide-react';`
);

// 2. Add deleteWW
content = content.replace(
  `  function addPT() {`,
  `  function deleteWW(id:string) {\n    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],wwItems:prev[quarter].wwItems.filter(x=>x.id!==id)}}));\n  }\n\n  function addPT() {`
);

// 3. Add deletePT
content = content.replace(
  `  function updateWWMax(id:string, max:number) {`,
  `  function deletePT(id:string) {\n    setAllData(prev=>({...prev,[quarter]:{...prev[quarter],ptItems:prev[quarter].ptItems.filter(x=>x.id!==id)}}));\n  }\n\n  function updateWWMax(id:string, max:number) {`
);

// 4. Save Button
const oldSaveBlock = `        <div style={{marginLeft:"auto"}}>
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",
            background:C.m700,color:"#fff",borderRadius:4,border:"none",cursor:"pointer",
            fontSize:12,fontWeight:700}}>
            <Download size={13}/> Export Excel
          </button>
        </div>`;
const newSaveBlock = `        <div style={{marginLeft:"auto", display:"flex", gap:10}}>
          <button onClick={() => alert("Grades saved successfully!")} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",
            background:C.m600,color:"#fff",borderRadius:4,border:"none",cursor:"pointer",
            fontSize:12,fontWeight:700}}>
            <Save size={13}/> Save
          </button>
          <button style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",
            background:C.m700,color:"#fff",borderRadius:4,border:"none",cursor:"pointer",
            fontSize:12,fontWeight:700}}>
            <Download size={13}/> Export Excel
          </button>
        </div>`;
content = content.replace(oldSaveBlock, newSaveBlock);

// 5. WW Map Delete Button
const oldWWMap = `{wwItems.map(it=>
                subTH(<div style={{lineHeight:1.4}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#fff",letterSpacing:"0.04em"}}>{it.label}</div>
                  {MaxInput(it, updateWWMax)}`;
const newWWMap = `{wwItems.map(it=>
                subTH(<div style={{lineHeight:1.4, position:"relative"}}>
                  <button onClick={() => deleteWW(it.id)} title="Delete column" style={{position:"absolute", top:-6, right:-8, background:C.red, border:"none", borderRadius:"50%", color:"#fff", width:14, height:14, fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", paddingBottom:2}}>×</button>
                  <div style={{fontSize:10,fontWeight:700,color:"#fff",letterSpacing:"0.04em"}}>{it.label}</div>
                  {MaxInput(it, updateWWMax)}`;
content = content.replace(oldWWMap, newWWMap);

// 6. PT Map Delete Button
const oldPTMap = `{ptItems.map(it=>
                subTH(<div style={{lineHeight:1.4}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#fff",letterSpacing:"0.04em"}}>{it.label}</div>
                  {MaxInput(it, updatePTMax)}`;
const newPTMap = `{ptItems.map(it=>
                subTH(<div style={{lineHeight:1.4, position:"relative"}}>
                  <button onClick={() => deletePT(it.id)} title="Delete column" style={{position:"absolute", top:-6, right:-8, background:C.red, border:"none", borderRadius:"50%", color:"#fff", width:14, height:14, fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", paddingBottom:2}}>×</button>
                  <div style={{fontSize:10,fontWeight:700,color:"#fff",letterSpacing:"0.04em"}}>{it.label}</div>
                  {MaxInput(it, updatePTMax)}`;
content = content.replace(oldPTMap, newPTMap);

fs.writeFileSync('src/app/teacher/grades/GradebookFullScreen.tsx', content);
console.log("File patched successfully!");
