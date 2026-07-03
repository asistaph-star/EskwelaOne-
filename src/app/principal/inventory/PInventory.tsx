import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { P_INVENTORY } from '../../shared/constants/seedData';
import { PTableHeader } from '../shared/PTableHeader';

function Stamp({ label, color, bg }: { label:string; color:string; bg:string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, background: bg }}>
      {label}
    </span>
  );
}

export function PInventory() {
  const [filter, setFilter] = useState("All");
  const shown = filter==="All" ? P_INVENTORY : P_INVENTORY.filter(i=>i.status===filter);
  return (
    <div style={{ flex:1, overflowY:"auto", background:C.paper, padding:24 }}>
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, display:"flex", marginBottom:14 }}>
        {[["1,297","Total Assets",C.t1],["2","Under Repair",C.amber],["3","Borrowed",C.blue],["0","Lost/Damaged",C.green]].map(([v,l,c],i)=>(
          <div key={l} style={{ flex:1, padding:"12px 20px", borderRight:i<3?`1px solid ${C.borderMed}`:"none" }}>
            <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>{l}</div>
            <div style={{ fontSize:24, fontWeight:700, fontFamily:"'Plus Jakarta Sans',sans-serif", color:c, lineHeight:1 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:5, marginBottom:12 }}>
        {["All","Good","Repair","Borrowed"].map(f=>(
          <button key={f} onClick={()=>setFilter(f==="Good"?"Good":f==="Repair"?"Repair":f==="Borrowed"?"Borrowed":"All")}
            style={{ padding:"4px 12px", borderRadius:3, fontSize:11, fontWeight:filter===f?700:400, cursor:"pointer",
              border: filter===f?`1.5px solid ${C.m700}`:`1px solid ${C.borderMed}`,
              background: filter===f?C.m700:"#fff", color: filter===f?"#fff":C.t2 }}>
            {f}
          </button>
        ))}
      </div>
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><PTableHeader cols={["Item","Category","Qty","Condition","Location"]} /></thead>
          <tbody>
            {shown.map((item,i)=>(
              <tr key={item.item} style={{ borderBottom:i<shown.length-1?`0.5px solid ${C.border}`:"none" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                <td style={{ padding:"10px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{item.item}</td>
                <td style={{ padding:"10px 14px", fontSize:10, color:C.t3 }}>{item.cat}</td>
                <td style={{ padding:"10px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:C.t2 }}>{item.qty}</td>
                <td style={{ padding:"10px 14px", fontSize:11, color:C.t2 }}>{item.cond}</td>
                <td style={{ padding:"10px 14px", fontSize:11, color:C.t2 }}>{item.loc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}