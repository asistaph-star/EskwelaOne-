import React from 'react';
import { C } from '../constants/tokens';

export function Stamp({ label, color, bg }: { label:string, color:string, bg:string }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      background:bg, color, fontSize:9, fontWeight:700,
      letterSpacing:"0.1em", textTransform:"uppercase",
      padding:"2px 7px", borderRadius:3,
      fontFamily:"'Inter',sans-serif",
    }}>
      {label}
    </span>
  );
}
