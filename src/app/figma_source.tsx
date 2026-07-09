<USER_REQUEST>
get here the princial dashboard all we tried to make it work on figma only get the principal code

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, Calendar, FileText, BookOpen, Wrench, HelpCircle,
  Archive, Bell, Search, ChevronDown, ChevronLeft, ChevronRight,
  Users, CalendarCheck, BarChart2, Sparkles, BookMarked, Building2,
  Award, Download, Printer, Plus, ArrowRight, TrendingUp, AlertCircle,
  Star, Zap, Monitor, Upload, Clock, Shield, CheckCircle, FileDown,
  GraduationCap, Eye, EyeOff, Menu, X, Flag, Target, Layers,
  Activity, RefreshCw, Hash, QrCode, UserCheck, Package, FileSpreadsheet, Stethoscope,
} from "lucide-react";
import {
  BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

/* ─── Types ────────────────────────────────────────────────── */
type Role = "Admin" | "Teacher" | "Principal" | "Student";
type TScreen =
  | "dashboard" | "classroom" | "gradebook" | "quarterly-summary"
  | "grades-direct" | "attendance-direct" | "clinic-visits"
  | "ai-tools" | "pro-dev"
  | "calendar" | "templates" | "tutorials" | "tools" | "help";

/* ─── Design Tokens ────────────────────────────────────────── */
const C = {
  m900: "#3D0808", m800: "#6B1616", m700: "#8B1E1E",
  m600: "#A52828", m500: "#BE3333", m100: "#FDECEA", m50: "#FEF5F5",
  gold: "#C8860A", goldLight: "#FEF3DC",
  paper:  "#FAF5F0",   /* warm off-white page bg */
  ledger: "#F5EDE8",   /* row tint */
  border: "rgba(139,30,30,0.15)",
  borderMed: "rgba(139,30,30,0.28)",
  borderHeavy: "rgba(139,30,30,0.5)",
  t1: "#190D0D", t2: "#4A3232", t3: "#8A7070",
  green: "#155E36", greenBg: "#DCFCE7",
  amber: "#92400E", amberBg: "#FEF3C7",
  red: "#911818",   redBg: "#FEE2E2",
  blue: "#1E3A8A",  blueBg: "#DBEAFE",
  purple: "#4C1D95", purpleBg: "#EDE9FE",
  teal: "#0E6674",   tealBg: "#CCFBF1",
};

/* ─── Responsive ────────────────────────────────────────────── */
function useLayout() {
  const get = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    return { isMobile: w < 768, isTablet: w >= 768 && w < 1060 };
  };
  const [l, setL] = useState(get);
  useEffect(() => {
    const h = () => setL(get());
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return l;
}

/* ─── Mock Data ─────────────────────────────────────────────── */
const MY_CLASSES = [
  { id:1, grade:8,  section:"Rizal",    subject:"Mathematics 8",     students:39, completion:72, semester:"1st Semester", adviser:true,  imgHue:"hsl(220,60%,34%)" },
  { id:2, grade:9,  section:"Einstein", subject:"Science 9",         students:36, completion:85, semester:"1st Semester", adviser:false, imgHue:"hsl(160,55%,28%)" },
  { id:3, grade:10, section:"Pilot",    subject:"Filipino 10",       students:32, completion:91, semester:"1st Semester", adviser:true,  imgHue:"hsl(345,55%,32%)" },
];

const TODAY_SCHED = [
  { time:"7:30–8:30",  subject:"Mathematics 8",   section:"Gr. 8 Rizal",    room:"Rm 101", status:"done" },
  { time:"8:30–9:30",  subject:"Science 9",       section:"Gr. 9 Einstein", room:"Rm 204", status:"done" },
  { time:"9:30–10:00", subject:"-",               section:"Break",          room:"",       status:"break" },
  { time:"10:00–11:00",subject:"Filipino 10",     section:"Gr. 10 Pilot",   room:"Rm 312", status:"active" },
  { time:"11:00–12:00",subject:"Mathematics 8",   section:"Gr. 8 Rizal",    room:"Rm 101", status:"upcoming" },
  { time:"1:00–2:00",  subject:"Advisory Period", section:"Gr. 8 Rizal",    room:"Rm 101", status:"upcoming" },
];

const UPCOMING = [
  { date:"Jun 13", label:"LAC Session - Numeracy",        type:"lac",      urgent:false },
  { date:"Jun 14", label:"Q1 Grading deadline",           type:"deadline", urgent:true },
  { date:"Jun 17", label:"Regional seminar - ICT Tools",  type:"seminar",  urgent:false },
  { date:"Jun 20", label:"Parent-Teacher Conference",     type:"ptc",      urgent:false },
  { date:"Jun 25", label:"SF2 submission - Division",     type:"deadline", urgent:true },
];

const STUDENTS_GR8 = [
  { id:1,  lrn:"200001", surname:"Aguilar",    first:"Liza Marie",   gender:"F", avg:88.4, att:"Good Standing", status:"Passed" },
  { id:2,  lrn:"200002", surname:"Bondoc",     first:"Ramon Jr.",    gender:"M", avg:74.2, att:"At Risk",       status:"Failed" },
  { id:3,  lrn:"200003", surname:"Cruz",       first:"Trisha Ann",   gender:"F", avg:93.1, att:"Good Standing", status:"Passed" },
  { id:4,  lrn:"200004", surname:"Delos Reyes",first:"Daniel",       gender:"M", avg:81.7, att:"Good Standing", status:"Passed" },
  { id:5,  lrn:"200005", surname:"Espino",     first:"Hannah Grace", gender:"F", avg:68.5, att:"Poor",          status:"Failed" },
  { id:6,  lrn:"200006", surname:"Ferrer",     first:"Joshua",       gender:"M", avg:90.3, att:"Good Standing", status:"Passed" },
  { id:7,  lrn:"200007", surname:"Gomez",      first:"Angelica",     gender:"F", avg:77.8, att:"Good Standing", status:"Passed" },
  { id:8,  lrn:"200008", surname:"Hernandez",  first:"Mark Ryan",    gender:"M", avg:71.0, att:"At Risk",       status:"Failed" },
];

const GRADEBOOK = [
  { name:"Aguilar, Liza Marie",   ww:[88,90,86,92,89], pt:[91,94,88], qa:90 },
  { name:"Bondoc, Ramon Jr.",     ww:[70,72,68,74,73], pt:[75,73,71], qa:72 },
  { name:"Cruz, Trisha Ann",      ww:[94,96,93,97,95], pt:[97,98,95], qa:96 },
  { name:"Delos Reyes, Daniel",   ww:[80,83,79,84,82], pt:[83,86,81], qa:82 },
  { name:"Espino, Hannah Grace",  ww:[64,68,62,70,67], pt:[69,72,66], qa:68 },
  { name:"Ferrer, Joshua",        ww:[90,92,89,93,91], pt:[93,95,90], qa:93 },
  { name:"Gomez, Angelica",       ww:[76,78,75,80,77], pt:[78,82,75], qa:78 },
  { name:"Hernandez, Mark Ryan",  ww:[68,70,66,72,69], pt:[71,74,68], qa:71 },
];

const BAR_DATA = [
  { subject:"Math",avg:82}, {subject:"Science",avg:88}, {subject:"English",avg:86},
  {subject:"Filipino",avg:83}, {subject:"AP",avg:89}, {subject:"MAPEH",avg:91},
];

const PIE_DATA = [
  { name:"Passed (≥75)", value:28, color:C.green },
  { name:"Conditional",  value:5,  color:C.amber },
  { name:"Failed (<75)", value:6,  color:C.red },
];

const TREND_DATA = [
  {week:"Wk1",att:92},{week:"Wk2",att:94},{week:"Wk3",att:89},
  {week:"Wk4",att:95},{week:"Wk5",att:91},{week:"Wk6",att:96},
];

const CERTS = [
  { title:"Regional Training on 21st Century Teaching",level:"Regional",  hours:16, date:"Mar 2025", points:4 },
  { title:"Division LAC - Numeracy Intervention",     level:"Division",  hours:8,  date:"Feb 2025", points:2 },
  { title:"School-based INSET - ICT Integration",     level:"School",    hours:6,  date:"Jan 2025", points:1.5 },
  { title:"National Summit on K-12 Curriculum",       level:"National",  hours:24, date:"Nov 2024", points:6 },
  { title:"District Science Fair Juror",              level:"District",  hours:8,  date:"Sep 2024", points:2 },
];

const SEMINARS = [
  { date:"Jun 17", title:"Regional ICT Tools Seminar",   level:"Regional", status:"confirmed" },
  { date:"Jun 13", title:"LAC Session - Numeracy",       level:"School",   status:"confirmed" },
  { date:"Jul 3",  title:"Division Summer Reading Camp", level:"Division", status:"pending"   },
  { date:"Jul 15", title:"National Teachers Conference", level:"National", status:"pending"   },
];

/* ─── Helpers ───────────────────────────────────────────────── */
function calcGrade(ww: number[], pt: number[], qa: number) {
  const wwAvg = ww.reduce((a,b)=>a+b,0)/ww.length;
  const ptAvg = pt.reduce((a,b)=>a+b,0)/pt.length;
  return ((wwAvg*0.25)+(ptAvg*0.50)+(qa*0.25)).toFixed(1);
}
function gradeColor(g: number): React.CSSProperties {
  const f: React.CSSProperties = { fontFamily:"'JetBrains Mono',monospace", fontWeight:500, fontSize:12 };
  if (g>=90) return {...f, color:C.green};
  if (g>=75) return {...f, color:C.t2};
  return {...f, color:C.red, background:C.redBg, padding:"1px 5px", borderRadius:3};
}
function levelColor(l: string) {
  if (l==="National")  return { bg:"#FEF3C7", text:C.amber };
  if (l==="Regional")  return { bg:C.blueBg,  text:C.blue };
  if (l==="Division")  return { bg:C.purpleBg,text:C.purple };
  if (l==="School")    return { bg:C.m100,    text:C.m700 };
  return                       { bg:C.tealBg,  text:C.teal };
}

/* ─── Shared micro-components ───────────────────────────────── */

/* Stamp - official rubber-stamp-look badge */
function Stamp({ label, color, bg }: { label:string, color:string, bg:string }) {
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

/* Ledger divider - the signature element repeated throughout */
function LR() {
  return <div style={{ height:0, borderBottom:`1px solid ${C.border}` }} />;
}

/* Document-style panel with maroon header band */
function DocPanel({ title, icon:Icon, children, action }: {
  title:string, icon?:React.ElementType, children:React.ReactNode, action?:React.ReactNode
}) {
  return (
    <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, overflow:"hidden" }}>
      <div style={{ background:C.m800, padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
        {Icon && <Icon size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} />}
        <span style={{ color:"#fff", fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif", letterSpacing:"0.04em", flex:1 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

/* Stat box - document-field aesthetic */
function StatBox({ label, value, sub, accent }: { label:string, value:string|number, sub?:string, accent:string }) {
  return (
    <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"14px 16px", borderTop:`3px solid ${accent}` }}>
      <div style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:700, color:C.t1, lineHeight:1, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.t3, marginTop:5 }}>{sub}</div>}
    </div>
  );
}

/* ─── Login Screen ──────────────────────────────────────────── */
const ROLE_USER: Record<Role, { name:string, initials:string, sub:string }> = {
  Admin:     { name:"Maria B. Cruz",      initials:"MC", sub:"Administrative Officer" },
  Teacher:   { name:"Ana R. Soriano",     initials:"AS", sub:"Class Adviser · Gr. 8 Rizal" },
  Principal: { name:"Dr. Maria Santos",   initials:"MS", sub:"School Principal" },
  Student:   { name:"Santos, Juan Miguel",initials:"SJ", sub:"Grade 10 - Pilot" },
};

function LoginScreen({ onLogin }: { onLogin:(r:Role)=>void }) {
  const [role, setRole]     = useState<Role>("Teacher");
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [show, setShow]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string|null>(null);

  function handleSignIn() {
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(role); }, 900);
  }

  const photoUrl = "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=1400&h=900&fit=crop&auto=format&q=80";

  function inputSt(field: string): React.CSSProperties {
    return {
      width:"100%", boxSizing:"border-box",
      border: focused===field ? `1.5px solid ${C.m700}` : `1px solid ${C.borderMed}`,
      borderRadius:6, padding:"10px 13px", fontSize:13,
      color:C.t1, background: focused===field ? "#fff" : C.m50,
      outline:"none", transition:"all 0.15s", fontFamily:"'Inter',sans-serif",
    };
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", fontFamily:"'Inter',sans-serif" }}>
      {/* Photo panel */}
      <div style={{ flex:"0 0 58%", position:"relative", overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
        <img src={photoUrl} alt="Classroom" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top" }} />
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(to bottom, rgba(61,8,8,0.12) 0%, rgba(61,8,8,0.55) 45%, rgba(61,8,8,0.96) 100%)` }} />
        <div style={{ position:"absolute", top:32, left:36, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:8, background:C.gold, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <BookMarked size={16} color={C.m900} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ color:"#fff", fontSize:14, fontWeight:700, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>EskwelaOne+</div>
            <div style={{ color:"rgba(255,255,255,0.5)", fontSize:10 }}>Education Management System</div>
          </div>
        </div>
        <div style={{ position:"relative", zIndex:2, padding:"0 44px 44px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 14px", borderRadius:20, background:"rgba(200,134,10,0.14)", border:"1px solid rgba(200,134,10,0.35)", marginBottom:18 }}>
            <div style={{ width:5, height:5, borderRadius:3, background:C.gold }} />
            <span style={{ fontSize:10, fontWeight:700, color:C.gold, letterSpacing:"0.08em", textTransform:"uppercase" }}>DepEd · Republic of the Philippines</span>
          </div>
          <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:34, fontWeight:700, color:"#fff", lineHeight:1.15, margin:"0 0 10px" }}>Sindalan National<br />High School</h1>
          <p style={{ fontSize:13, color:"rgba(255,255,255,0.6)", margin:"0 0 28px", lineHeight:1.7 }}>Sindalan, City of San Fernando, Pampanga<br />Schools Division of San Fernando City</p>
          <div style={{ display:"flex" }}>
            {[["107","Students"],["12","Sections"],["SY 25–26","Active"]].map(([v,l],i) => (
              <div key={l} style={{ paddingRight:28, marginRight:28, borderRight:i<2?"1px solid rgba(255,255,255,0.18)":"none" }}>
                <div style={{ fontSize:20, fontWeight:700, color:"#fff", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{v}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div style={{ flex:1, background:"#fff", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", padding:"48px 40px" }}>
        <div style={{ width:"100%", maxWidth:360 }}>
          <div style={{ marginBottom:32 }}>
            <div style={{ fontSize:24, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:6 }}>Welcome back</div>
            <div style={{ fontSize:13, color:C.t3 }}>Sign in with your school credentials to continue.</div>
          </div>

          {/* Role */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:500, color:C.t2, marginBottom:6 }}>Sign in as</label>
            <div style={{ position:"relative" }}>
              <select value={role} onChange={e=>setRole(e.target.value as Role)} style={{ width:"100%", boxSizing:"border-box", border:`1px solid ${C.borderMed}`, borderRadius:6, padding:"10px 36px 10px 13px", fontSize:13, color:C.t1, background:C.m50, outline:"none", appearance:"none", cursor:"pointer" }}>
                <option value="Admin">Admin</option>
                <option value="Teacher">Teacher</option>
                <option value="Principal">Principal</option>
                <option value="Student">Student</option>
              </select>
              <ChevronDown size={13} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:C.t3, pointerEvents:"none" }} />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:500, color:C.t2, marginBottom:6 }}>Email address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="surname@sindalannhs.edu.ph"
              onFocus={()=>setFocused("e")} onBlur={()=>setFocused(null)} style={inputSt("e")} />
          </div>

          {/* Password */}
          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <label style={{ fontSize:12, fontWeight:500, color:C.t2 }}>Password</label>
              <button style={{ fontSize:12, color:C.m700, background:"none", border:"none", cursor:"pointer" }}>Forgot password?</button>
            </div>
            <div style={{ position:"relative" }}>
              <input type={show?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} placeholder="Enter your password"
                onFocus={()=>setFocused("p")} onBlur={()=>setFocused(null)}
                style={{...inputSt("p"), paddingRight:40}} />
              <button onClick={()=>setShow(s=>!s)} style={{ position:"absolute", right:11, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.t3, display:"flex" }}>
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button onClick={handleSignIn} disabled={loading} style={{ width:"100%", padding:"12px", background:loading?C.m600:C.m700, color:"#fff", borderRadius:6, border:"none", cursor:loading?"default":"pointer", fontSize:14, fontWeight:600, fontFamily:"'Plus Jakarta Sans',sans-serif", transition:"background 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
            onMouseEnter={e=>{ if(!loading)(e.currentTarget as HTMLElement).style.background=C.m800; }}
            onMouseLeave={e=>{ if(!loading)(e.currentTarget as HTMLElement).style.background=C.m700; }}
          >
            {loading ? (<><svg width="16" height="16" viewBox="0 0 16 16" style={{animation:"spin 0.8s linear infinite"}}><circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/><path d="M8 2A6 6 0 0 1 14 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>Signing in…</>) : `Sign in as ${role}`}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"22px 0" }}>
            <div style={{ flex:1, height:1, background:C.borderMed }} />
            <span style={{ fontSize:11, color:C.t3 }}>or</span>
            <div style={{ flex:1, height:1, background:C.borderMed }} />
          </div>

          <button onClick={()=>onLogin(role)} style={{ width:"100%", padding:"10px", background:C.m50, border:`1px solid ${C.borderMed}`, borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:500, color:C.t1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.15s" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.m700; (e.currentTarget as HTMLElement).style.background=C.m100;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.borderMed; (e.currentTarget as HTMLElement).style.background=C.m50;}}>
            <Shield size={13} style={{color:C.m700}} /> Continue with DepEd SSO
          </button>

          <div style={{ marginTop:36, textAlign:"center", fontSize:11, color:C.t3, lineHeight:1.8 }}>
            Schools Division of San Fernando City · Region III<br />
            <span style={{color:"#ccc"}}>EskwelaOne+ v1.0 · DepEd Compliant · SY 2025–2026</span>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}

/* ─── Teacher Sidebar ───────────────────────────────────────── */
/* Single flat nav - spec order, no category groupings */
const T_FLAT_NAV = [
  { id:"dashboard",         label:"Dashboard",         icon:LayoutDashboard },
  { id:"classroom",         label:"Classroom Hub",     icon:Hash },
  { id:"grades-direct",     label:"Grades",            icon:FileSpreadsheet },
  { id:"attendance-direct", label:"Attendance",        icon:CalendarCheck },
  { id:"clinic-visits",     label:"Clinic Visits",     icon:Stethoscope },
  { id:"calendar",          label:"Calendar",          icon:Calendar },
  { id:"templates",         label:"Template Hub",      icon:FileText },
  { id:"tools",             label:"Tools",             icon:Wrench },
  { id:"ai-tools",          label:"AI Quick Tools",    icon:Sparkles },
  { id:"pro-dev",           label:"Prof. Development", icon:Award },
];
const T_FOOT_NAV = [
  { id:"tutorials", label:"Tutorials",       icon:BookOpen },
  { id:"help",      label:"Help & Feedback", icon:HelpCircle },
];

function TSidebar({ active, onNav, onLogout, collapsed=false }: {
  active:TScreen, onNav:(s:TScreen)=>void, onLogout:()=>void, collapsed?:boolean
}) {
  const isAct = (id:string) => active===id || (active==="classroom" && id==="dashboard");
  return (
    <div style={{ width:collapsed?52:220, minHeight:"100vh", background:C.m800, display:"flex", flexDirection:"column", flexShrink:0, transition:"width 0.2s" }}>
      {/* Brand */}
      <div style={{ padding:collapsed?"12px 8px":"18px 16px 12px", borderBottom:`1px solid rgba(255,255,255,0.07)` }}>
        <div style={{ display:"flex", alignItems:"center", gap:collapsed?0:10, justifyContent:collapsed?"center":"flex-start" }}>
          <div style={{ width:34, height:34, borderRadius:7, background:C.gold, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <BookMarked size={15} color={C.m900} strokeWidth={2.5} />
          </div>
          {!collapsed && <div>
            <div style={{ color:"#fff", fontSize:13, fontWeight:700, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1.2 }}>EskwelaOne+</div>
            <div style={{ color:"rgba(255,255,255,0.35)", fontSize:9, marginTop:1 }}>Sindalan NHS</div>
          </div>}
        </div>
        {!collapsed && <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:5, padding:"4px 10px", display:"flex", justifyContent:"space-between", marginTop:10 }}>
          <span style={{ color:"rgba(255,255,255,0.4)", fontSize:9, letterSpacing:"0.04em" }}>S.Y. 2025–2026</span>
          <span style={{ background:C.gold, color:C.m900, fontSize:8, fontWeight:700, padding:"1px 5px", borderRadius:8 }}>Q1</span>
        </div>}
      </div>

      {/* Nav - single flat list, no category groupings */}
      <div style={{ flex:1, padding:collapsed?"6px 4px":"8px 10px", overflowY:"auto" }}>
        {!collapsed && <div style={{ color:"rgba(255,255,255,0.22)", fontSize:9, fontWeight:700, letterSpacing:"0.1em", padding:"10px 6px 4px" }}>MAIN</div>}

        {T_FLAT_NAV.map(item => {
          const Icon = item.icon;
          const act = active===item.id || (active==="classroom" && item.id==="classroom");
          return (
            <button key={item.id} onClick={()=>onNav(item.id as TScreen)} title={collapsed?item.label:undefined}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:collapsed?0:9, padding:collapsed?"9px":"7px 8px", borderRadius:6, marginBottom:1, cursor:"pointer", border:"none", textAlign:"left", background:act?"rgba(255,255,255,0.14)":"transparent", justifyContent:collapsed?"center":"flex-start", transition:"background 0.12s" }}
              onMouseEnter={e=>{if(!act)(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.07)";}}
              onMouseLeave={e=>{if(!act)(e.currentTarget as HTMLElement).style.background="transparent";}}>
              <div style={{ width:26, height:26, borderRadius:6, background:act?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon size={13} color={act?"#fff":"rgba(255,255,255,0.55)"} strokeWidth={2} />
              </div>
              {!collapsed && <span style={{ fontSize:12, fontWeight:act?700:400, color:act?"#fff":"rgba(255,255,255,0.55)", flex:1 }}>{item.label}</span>}
            </button>
          );
        })}

        {/* Footer: Tutorials, Help & Feedback, Archived Classes */}
        <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid rgba(255,255,255,0.07)` }}>
          {T_FOOT_NAV.map(item => {
            const Icon = item.icon;
            const act = active===item.id;
            return (
              <button key={item.id} onClick={()=>onNav(item.id as TScreen)} title={collapsed?item.label:undefined}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:collapsed?0:9, padding:collapsed?"9px":"6px 8px", borderRadius:6, marginBottom:1, cursor:"pointer", border:"none", background:act?"rgba(255,255,255,0.08)":"transparent", textAlign:"left", justifyContent:collapsed?"center":"flex-start" }}
                onMouseEnter={e=>{if(!act)(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)";}}
                onMouseLeave={e=>{if(!act)(e.currentTarget as HTMLElement).style.background="transparent";}}>
                {collapsed
                  ? <div style={{ width:26, height:26, borderRadius:6, background:"rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon size={13} color="rgba(255,255,255,0.3)" /></div>
                  : <><Icon size={12} color={act?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.3)"} />
                     <span style={{ fontSize:11, color:act?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.3)" }}>{item.label}</span></>}
              </button>
            );
          })}
          {!collapsed && (
            <button style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"6px 8px", borderRadius:6, cursor:"pointer", border:"none", background:"transparent", textAlign:"left" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
              <Archive size={12} color="rgba(255,255,255,0.25)" />
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>Archived Classes</span>
            </button>
          )}
        </div>
      </div>

      {/* User pill */}
      <div style={{ borderTop:`1px solid rgba(255,255,255,0.07)`, padding:collapsed?"8px 4px":"10px 12px" }}>
        {!collapsed ? (
          <div style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 8px", borderRadius:7, cursor:"pointer" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.06)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
            <div style={{ width:30, height:30, borderRadius:20, background:C.m600, border:`2px solid ${C.gold}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontSize:10, fontWeight:800, color:C.gold }}>AS</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.85)", lineHeight:1.3 }}>Ana R. Soriano</div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)" }}>Class Adviser · Gr. 8</div>
            </div>
            <button onClick={onLogout} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.3)", display:"flex" }}><ArrowRight size={11} /></button>
          </div>
        ) : (
          <div style={{ display:"flex", justifyContent:"center" }}>
            <div style={{ width:30, height:30, borderRadius:20, background:C.m600, border:`2px solid ${C.gold}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:10, fontWeight:800, color:C.gold }}>AS</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Topbar ────────────────────────────────────────────────── */
function TTopbar({ title, sub, onMenu }: { title:string, sub?:string, onMenu?:()=>void }) {
  return (
    <div style={{ height:54, background:"#fff", borderBottom:`2px solid ${C.m700}`, display:"flex", alignItems:"center", padding:"0 20px", gap:12, flexShrink:0 }}>
      {onMenu && <button onClick={onMenu} style={{ width:34, height:34, borderRadius:6, background:C.m50, border:`1px solid ${C.borderMed}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}><Menu size={17} color={C.t2} /></button>}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{title}</div>
        {sub && <div style={{ fontSize:10, color:C.t3, marginTop:0.5 }}>{sub}</div>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ background:C.m100, color:C.m700, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, border:`1px solid rgba(139,30,30,0.2)`, whiteSpace:"nowrap" }}>Q1 · SY 2025–2026</span>
        <div style={{ display:"flex", alignItems:"center", gap:7, background:C.m50, border:`1px solid ${C.borderMed}`, borderRadius:6, padding:"6px 10px" }}>
          <Search size={12} color={C.t3} />
          <input placeholder="Search…" style={{ background:"transparent", border:"none", outline:"none", fontSize:12, color:C.t1, width:90 }} />
        </div>
        <button style={{ position:"relative", padding:7, borderRadius:6, background:"transparent", border:"none", cursor:"pointer" }}>
          <Bell size={16} color={C.t2} />
          <span style={{ position:"absolute", top:6, right:6, width:6, height:6, borderRadius:10, background:C.red, border:"1.5px solid #fff" }} />
        </button>
      </div>
    </div>
  );
}

/* ─── Student grade snapshot per section (dashboard widget) ─── */
/* per-student subject breakdown for attention widget */
const SECTION_GRADES: Record<string, {id:number,surname:string,first:string,subject:string,avg:number,status:string}[]> = {
  "Rizal (Gr.8)": [
    {id:1, surname:"Aguilar",      first:"Liza Marie",   subject:"Mathematics 8",  avg:88.1, status:"Passed"},
    {id:5, surname:"Espino",       first:"Hannah Grace",  subject:"Mathematics 8",  avg:68.5, status:"Failing"},
    {id:2, surname:"Bondoc",       first:"Ramon Jr.",     subject:"Mathematics 8",  avg:73.8, status:"At Risk"},
    {id:8, surname:"Hernandez",    first:"Mark Ryan",     subject:"Mathematics 8",  avg:71.0, status:"Failing"},
    {id:5, surname:"Espino",       first:"Hannah Grace",  subject:"Science 8",      avg:72.1, status:"At Risk"},
    {id:3, surname:"Cruz",         first:"Trisha Ann",    subject:"Mathematics 8",  avg:93.1, status:"Passed"},
    {id:6, surname:"Ferrer",       first:"Joshua",        subject:"Mathematics 8",  avg:90.3, status:"Passed"},
  ],
  "Einstein (Gr.9)": [
    {id:11,surname:"Torres",       first:"Bea Angelica",  subject:"Science 9",      avg:74.1, status:"At Risk"},
    {id:14,surname:"Reyes",        first:"Carlo Jose",    subject:"Science 9",      avg:73.2, status:"At Risk"},
    {id:14,surname:"Reyes",        first:"Carlo Jose",    subject:"Mathematics 9",  avg:69.8, status:"Failing"},
    {id:12,surname:"Villanueva",   first:"Mark Anthony",  subject:"Science 9",      avg:82.5, status:"Passed"},
    {id:13,surname:"Bautista",     first:"Camille",       subject:"Science 9",      avg:90.2, status:"Passed"},
  ],
  "Pilot (Gr.10)": [
    {id:23,surname:"Ocampo",       first:"Renz Adrian",   subject:"Filipino 10",    avg:69.8, status:"Failing"},
    {id:21,surname:"Santos",       first:"Juan Miguel",   subject:"Filipino 10",    avg:78.3, status:"At Risk"},
    {id:22,surname:"Garcia",       first:"Ana Kristine",  subject:"Filipino 10",    avg:95.1, status:"Passed"},
    {id:24,surname:"Flores",       first:"Janine Mae",    subject:"Filipino 10",    avg:85.4, status:"Passed"},
  ],
};

function StudentsNeedingAttention({ onStudentClick }: { onStudentClick:(id:number,name:string,section:string,grade:number)=>void }) {
  const sectionKeys = Object.keys(SECTION_GRADES);
  const [activeSection, setActiveSection] = useState(sectionKeys[0]);

  const all = SECTION_GRADES[activeSection] ?? [];
  const needsAttention = all.filter(r => r.status === "Failing" || r.status === "At Risk")
                            .sort((a,b)=>a.avg-b.avg);
  const failingCount = all.filter(r=>r.status==="Failing").length;
  const atRiskCount  = all.filter(r=>r.status==="At Risk").length;

  const sectionGrade = (key:string) => key.match(/Gr\.(\d+)/)?.[1] ?? "8";

  return (
    <div style={{ marginBottom:18 }}>
      {/* Header row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Students Needing Attention</div>
          <span style={{ padding:"2px 8px", borderRadius:20, background:C.redBg, fontSize:10, fontWeight:700, color:C.red }}>🔴 {failingCount} Failing</span>
          <span style={{ padding:"2px 8px", borderRadius:20, background:C.amberBg, fontSize:10, fontWeight:700, color:C.amber }}>🟡 {atRiskCount} At Risk</span>
        </div>
        {/* Section tabs */}
        <div style={{ display:"flex", gap:2 }}>
          {sectionKeys.map(s=>(
            <button key={s} onClick={()=>setActiveSection(s)}
              style={{ padding:"4px 10px", borderRadius:4, fontSize:11, fontWeight:activeSection===s?700:400, cursor:"pointer", transition:"all 0.1s",
                border: activeSection===s?`1.5px solid ${C.m700}`:`1px solid ${C.borderMed}`,
                background: activeSection===s?C.m700:"#fff", color: activeSection===s?"#fff":C.t2 }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {needsAttention.length === 0 ? (
        <div style={{ padding:"14px 18px", background:C.greenBg, border:`1px solid rgba(22,101,52,0.2)`, borderRadius:4, display:"flex", alignItems:"center", gap:8 }}>
          <CheckCircle size={15} color={C.green}/>
          <span style={{ fontSize:12, fontWeight:600, color:C.green }}>All students in this section are passing. No intervention needed.</span>
        </div>
      ) : (
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, overflow:"hidden" }}>
          <div style={{ background:C.m800, display:"grid", gridTemplateColumns:"16px 1fr 1fr 80px 90px", padding:"7px 14px", gap:10, alignItems:"center" }}>
            {["","Student Name","Subject","Grade","Status"].map(h=>(
              <span key={h} style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.6)", textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</span>
            ))}
          </div>
          {needsAttention.map((r,i)=>{
            const isFailing = r.status==="Failing";
            const rowBg = isFailing ? `${C.redBg}80` : `${C.amberBg}60`;
            return (
              <div key={`${r.id}-${r.subject}`} style={{ display:"grid", gridTemplateColumns:"16px 1fr 1fr 80px 90px", padding:"8px 14px", gap:10, borderBottom:`0.5px solid ${C.border}`, background:rowBg, alignItems:"center" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=rowBg;}}>
                <span style={{ fontSize:12 }}>{isFailing?"🔴":"🟡"}</span>
                <button onClick={()=>onStudentClick(r.id, `${r.surname}, ${r.first}`, activeSection.split(" ")[0], parseInt(sectionGrade(activeSection)))}
                  style={{ background:"none", border:"none", cursor:"pointer", textAlign:"left", padding:0 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:isFailing?C.red:C.amber, textDecoration:"underline dotted" }}>
                    {r.surname}, {r.first}
                  </span>
                </button>
                <span style={{ fontSize:11, color:C.t2 }}>{r.subject}</span>
                <span style={{ fontSize:14, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:isFailing?C.red:C.amber }}>{r.avg.toFixed(1)}</span>
                <Stamp label={r.status.toUpperCase()} color={isFailing?"#fff":C.amber} bg={isFailing?C.red:C.amberBg} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── SCREEN 1 - Dashboard Overview ────────────────────────── */
function DashboardScreen({ onNav, onClassClick, onShowGradeCard }: { onNav:(s:TScreen)=>void, onClassClick:(id:number)=>void, onShowGradeCard:(info:GradeCardInfo)=>void }) {

  const ATT = [
    { label:"Gr. 8 Rizal",    present:33, absent:1, late:1, total:35 },
    { label:"Gr. 9 Einstein", present:30, absent:1, late:1, total:32 },
    { label:"Gr. 10 Pilot",   present:29, absent:0, late:1, total:30 },
  ];

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
    <div style={{ flex:1, overflowY:"auto", background: "transparent" }}>

      {/* ════════════════════════════════════════════════
          TOP HEADER BAND - only maroon section on page
          ════════════════════════════════════════════════ */}
      <div style={{ background:C.m800, padding:"16px 28px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>

          {/* Left: greeting + name + rank badge */}
          <div>
            <div style={{ color:"rgba(255,255,255,0.5)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>
              Good morning
            </div>
            <div style={{ color:"#fff", fontSize:20, fontWeight:700, fontFamily:"'Fraunces',serif", lineHeight:1, marginBottom:7 }}>
              Ms. Ana R. Soriano
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ color:"rgba(255,255,255,0.6)", fontSize:11 }}>Teacher II · 2 years in rank</span>
              <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, background:"rgba(245,158,11,0.2)", border:"1px solid rgba(245,158,11,0.4)", fontSize:10, fontWeight:700, color:"#FCD34D" }}>
                ● Up for evaluation
              </span>
            </div>
          </div>

          {/* Right: date / week / quarter / SY */}
          <div style={{ textAlign:"right" }}>
            <div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, marginBottom:5 }}>
              Tuesday, June 10, 2025
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
              <span style={{ color:"rgba(255,255,255,0.7)", fontSize:11, fontWeight:500 }}>Week 3</span>
              <span style={{ color:"rgba(255,255,255,0.25)" }}>·</span>
              <span style={{ color:"rgba(255,255,255,0.7)", fontSize:11, fontWeight:500 }}>Quarter 1</span>
              <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, background:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.8)", fontSize:10, fontWeight:600 }}>
                SY 2025–2026
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════
          STAT ROW - unified bar, hairline-separated
          ════════════════════════════════════════════════ */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.borderMed}`, display:"flex" }}>
        {[
          { label:"Sections",         value:"3",     sub:"assigned" },
          { label:"Total Students",   value:"97",    sub:"across all sections" },
          { label:"Attendance Rate",  value:"94.2%", sub:"today · own sections" },
          { label:"Pending Grades",   value:"12",    sub:"items to encode" },
        ].map((s, i) => (
          <div key={s.label} style={{ flex:1, padding:"14px 24px", borderRight:i<3?`1px solid ${C.borderMed}`:"none" }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:700, color:C.t1, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1, marginBottom:4 }}>{s.value}</div>
            <div style={{ fontSize:10, color:C.t3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════
          MAIN CONTENT - 65% / 35% split
          ════════════════════════════════════════════════ */}
      <div style={{ display:"grid", gridTemplateColumns:"65fr 35fr", minHeight:0 }}>

        {/* ── LEFT COLUMN (65%) ─────────────────────── */}
        <div style={{ borderRight:`1px solid ${C.borderMed}`, padding:"24px 28px" }}>

          {/* Students Needing Attention */}
          <StudentsNeedingAttention onStudentClick={(id,name,section,grade)=>{
            onShowGradeCard({ name, section, grade });
          }} />

          {/* Section divider before class cards */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", margin:"20px 0 12px" }}>
            <span style={{ fontSize:12, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>My Assigned Sections</span>
            <button onClick={()=>onNav("classroom")} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, color:C.m700, background:"none", border:"none", cursor:"pointer", padding:0 }}>
              Open Classroom Hub <ArrowRight size={11} />
            </button>
          </div>

          {/* Class cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {MY_CLASSES.map(cls => (
              <button key={cls.id} onClick={()=>onClassClick(cls.id)}
                style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderLeft:`3px solid ${C.m700}`, borderRadius:3, cursor:"pointer", textAlign:"left", padding:0, overflow:"hidden", transition:"background 0.12s" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#fff";}}>
                <div style={{ padding:"12px 14px" }}>
                  <span style={{ fontSize:9, fontWeight:700, color:C.m700, textTransform:"uppercase", letterSpacing:"0.07em" }}>
                    Grade {cls.grade}
                  </span>
                  <div style={{ fontSize:17, fontWeight:800, color:C.t1, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1.1, margin:"5px 0 10px" }}>
                    {cls.section}
                  </div>
                  {[
                    ["Subject",  cls.subject],
                    ["Students", `${cls.students}`],
                    ["Semester", cls.semester],
                    ["Adviser",  cls.adviser ? "✓ Class Adviser" : "Subject Only"],
                  ].map(([l,v]) => (
                    <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:`0.5px solid ${C.border}` }}>
                      <span style={{ fontSize:9, color:C.t3, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</span>
                      <span style={{ fontSize:11, color: l==="Adviser"&&cls.adviser ? C.green : C.t1, fontWeight:500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

        </div>

        {/* ── RIGHT COLUMN (35%) ────────────────────── */}
        <div style={{ padding:"24px 24px" }}>

          {/* Section label */}
          <div style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:12 }}>
            Attendance Today · June 10, 2025
          </div>

          {/* Attendance per section - stacked rows */}
          <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:24 }}>
            {ATT.map((s, i) => {
              const rate = Math.round((s.present / s.total) * 100);
              const rc   = rate >= 90 ? C.green : rate >= 80 ? C.amber : C.red;
              return (
                <div key={s.label} style={{ padding:"11px 14px", borderBottom: i < ATT.length-1 ? `0.5px solid ${C.border}` : "none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:C.t1 }}>{s.label}</span>
                    <span style={{ fontSize:14, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:rc }}>{rate}%</span>
                  </div>
                  <div style={{ display:"flex", gap:5, marginBottom:6 }}>
                    {([[s.present,"P",C.green,C.greenBg],[s.absent,"A",C.red,C.redBg],[s.late,"L",C.amber,C.amberBg]] as [number,string,string,string][]).map(([n,lbl,c,bg])=>(
                      <span key={lbl} style={{ fontSize:10, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:c, background:bg, padding:"1px 7px", borderRadius:20 }}>
                        {n}{lbl}
                      </span>
                    ))}
                  </div>
                  <div style={{ height:3, background:C.m100 }}>
                    <div style={{ height:"100%", width:`${rate}%`, background:rc }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section label */}
          <div style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:12 }}>
            Quick Actions
          </div>

          {/* Quick actions - vertical list */}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {([
              { icon:CalendarCheck, label:"Take Attendance", screen:"attendance-direct" as TScreen },
              { icon:FileText,      label:"Enter Grades",    screen:"grades-direct"     as TScreen },
              { icon:FileDown,      label:"Export SF2",      screen:"attendance-direct" as TScreen },
            ]).map(a => {
              const Icon = a.icon;
              return (
                <button key={a.label} onClick={()=>onNav(a.screen)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", border:`1px solid ${C.borderMed}`, background:"#fff", cursor:"pointer", textAlign:"left", transition:"all 0.1s", width:"100%", borderRadius:3 } as React.CSSProperties}
                  onMouseEnter={e
<truncated 277470 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.