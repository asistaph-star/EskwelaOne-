import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Role } from '../../shared/types';
import { BookMarked, Eye, EyeOff, ChevronDown, Shield } from 'lucide-react';

export function LoginScreen({ onLogin }: { onLogin:(r:Role)=>void }) {
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