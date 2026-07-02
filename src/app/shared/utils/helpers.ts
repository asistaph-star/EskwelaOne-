

import { C } from '../constants/tokens';
import { AStatus, GradeRecord } from '../types';

export function fa(sg: { q1: number; q2: number; q3: number }) {
  return Math.round(((sg.q1 + sg.q2 + sg.q3) / 3) * 10) / 10;
}

export function sColor(s: AStatus): string {
  return s === "P" ? C.green : s === "A" ? C.red : s === "L" ? C.amber : C.teal;
}

export function sBg(s: AStatus): string {
  return s === "P" ? C.greenBg : s === "A" ? C.redBg : s === "L" ? C.amberBg : C.tealBg;
}

export const TRAFFIC = (s: string) => {
  const v = parseInt(s);
  return v >= 95 ? C.green : v >= 90 ? C.blue : v >= 80 ? C.amber : C.red;
};

export function gradeAvg(rec?: GradeRecord): number {
  if (!rec) return 0;
  const qCount = rec.curriculum === "old" && rec.q4 ? 4 : 3;
  const sum = (rec.q1 || 0) + (rec.q2 || 0) + (rec.q3 || 0) + ((rec.q4) || 0);
  return Math.round(sum / qCount);
}

export function levelColor(l: string) {
  if (l==="National")  return { bg:"#FEF3C7", text:C.amber };
  if (l==="Regional")  return { bg:C.blueBg,  text:C.blue };
  if (l==="Division")  return { bg:C.purpleBg,text:C.purple };
  if (l==="School")    return { bg:C.m100,    text:C.m700 };
  return                       { bg:C.tealBg,  text:C.teal };
}

export function gradeColor(g: number): React.CSSProperties {
  const f: React.CSSProperties = { fontFamily:"'JetBrains Mono',monospace", fontWeight:500, fontSize:12 };
  if (g>=90) return {...f, color:C.green};
  if (g>=75) return {...f, color:C.t2};
  return {...f, color:C.red, background:C.redBg, padding:"1px 5px", borderRadius:3};
}

export function calcGrade(ww: number[], pt: number[], qa: number) {
  const wwAvg = ww.reduce((a,b)=>a+b,0)/ww.length;
  const ptAvg = pt.reduce((a,b)=>a+b,0)/pt.length;
  return ((wwAvg*0.25)+(ptAvg*0.50)+(qa*0.25)).toFixed(1);
}

export const teacherTraffic = (s:string) =>
  s==="green" ? { bg:C.greenBg, color:C.green, label:"Year 1" }
  : s==="amber" ? { bg:C.amberBg, color:C.amber, label:"Year 2" }
  : { bg:C.redBg, color:C.red, label:"Year 3 · Eligible" };
