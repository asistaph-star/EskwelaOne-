import React from 'react';
import { C } from '../../shared/constants/tokens';

export function PTableHeader({ cols }: { cols:string[] }) {
  return (
    <tr style={{ background: C.m900 }}>
      {cols.map((col, i) => (
        <th key={i} style={{ padding:"10px 14px", fontSize:9, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.08em", borderLeft:i>0?`1px solid ${C.borderHeavy}`:"none", textAlign:"left" }}>
          {col}
        </th>
      ))}
    </tr>
  );
}