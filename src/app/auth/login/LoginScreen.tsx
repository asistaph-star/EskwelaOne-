import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Role } from '../../shared/types';
import { 
  BookMarked, Eye, EyeOff, Shield, Mail, Lock, 
  GraduationCap, Building2, Users, ShieldCheck, Clock, ChevronDown
} from 'lucide-react';

export function LoginScreen({ onLogin }: { onLogin: (r: Role) => void }) {
  const [role, setRole] = useState<Role>("Teacher");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(role);
    }, 900);
  }

  // Beautiful red-brick university building matching the mockup
  const photoUrl = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1400&h=900&fit=crop&auto=format&q=80";

  return (
    <div style={{ 
      minHeight: "100vh", 
      width: "100vw",
      display: "flex", 
      fontFamily: "'Inter',sans-serif",
      background: "linear-gradient(135deg, #3D0808 0%, #1A0202 100%)",
      overflow: "hidden"
    }}>
        {/* Left Side: Photo & Brand Panel (60% width) */}
        <div style={{ 
          flex: "0 0 58%", 
          position: "relative", 
          overflow: "hidden", 
          display: "flex", 
          flexDirection: "column", 
          justifyContent: "space-between",
          padding: "36px 44px"
        }}>
          {/* Background image & deep maroon overlay */}
          <img src={photoUrl} alt="University Building" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          <div style={{ 
            position: "absolute", 
            inset: 0, 
            background: "linear-gradient(135deg, rgba(61, 8, 8, 0.92) 0%, rgba(26, 2, 2, 0.95) 100%)" 
          }} />

          {/* Top Brand Block */}
          <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ 
              width: 38, height: 38, borderRadius: 8, 
              background: `linear-gradient(135deg, ${C.m600} 0%, ${C.m800} 100%)`, 
              border: "1.5px solid rgba(200, 134, 10, 0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
            }}>
              <BookMarked size={18} color={C.gold} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>ESKWELAONE</div>
              <div style={{ color: C.gold, fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 2 }}>UNIVERSITY PORTAL</div>
            </div>
          </div>

          {/* Middle Main Message block */}
          <div style={{ position: "relative", zIndex: 2, maxWidth: 500, margin: "64px 0" }}>
            <h1 style={{ 
              fontFamily: "'Fraunces',serif", 
              fontSize: 46, 
              fontWeight: 700, 
              color: "#fff", 
              lineHeight: 1.1, 
              margin: "0 0 16px" 
            }}>Education<br />Shapes the Future</h1>
            
            <p style={{ 
              fontSize: 14, 
              color: "rgba(255,255,255,0.7)", 
              lineHeight: 1.7,
              margin: "0 0 28px"
            }}>
              Empowering every learner, supporting every educator, and building a better tomorrow together.
            </p>

            {/* Translucent Commitment Banner */}
            <div style={{ 
              background: "rgba(61, 8, 8, 0.45)", 
              backdropFilter: "blur(12px)", 
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14
            }}>
              <div style={{ 
                width: 36, height: 36, borderRadius: 20, 
                background: "rgba(234,179,8,0.12)", 
                border: "1px solid rgba(234,179,8,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <GraduationCap size={18} color={C.gold} />
              </div>
              <div>
                <div style={{ color: "#fff", fontSize: 11.5, fontWeight: 700 }}>Our Commitment</div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10.5, marginTop: 2, lineHeight: 1.4 }}>
                  Delivering excellence in education through innovation, integrity, and service.
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Footbar Info Row */}
          <div style={{ 
            position: "relative", 
            zIndex: 2, 
            display: "grid", 
            gridTemplateColumns: "repeat(4, 1fr)", 
            gap: 12,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 20
          }}>
            {[
              { icon: Building2, title: "1 University", desc: "One integrated system" },
              { icon: Users, title: "All Roles", desc: "Connected in one portal" },
              { icon: ShieldCheck, title: "Secure Access", desc: "Your data is protected" },
              { icon: Clock, title: "24/7 Access", desc: "Anytime, anywhere" }
            ].map((f, idx) => {
              const Icon = f.icon;
              return (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon size={12} color={C.gold} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{f.title}</span>
                  </div>
                  <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>{f.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Floating rounded card login container */}
        <div style={{ 
          flex: 1, 
          background: "transparent", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          padding: 32,
          position: "relative",
          zIndex: 2
        }}>
          {/* Rounded White Box Card */}
          <div style={{ 
            width: "100%", 
            maxWidth: 420, 
            background: "#fff", 
            borderRadius: 16, 
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            padding: "36px 36px",
            boxSizing: "border-box",
            position: "relative"
          }}>
            {/* Top Right Header Controls */}
            <div style={{ position: "absolute", top: 20, right: 20, display: "flex", alignItems: "center", gap: 10 }}>
              {/* Theme Toggle Sun/Moon switch */}
              <button 
                type="button"
                onClick={() => alert("Theme settings are handled via settings panel.")}
                style={{ 
                  background: C.m50, 
                  border: `1px solid ${C.borderMed}`, 
                  borderRadius: 14, 
                  width: 38, 
                  height: 20, 
                  display: "flex", 
                  alignItems: "center", 
                  padding: "0 2px", 
                  cursor: "pointer" 
                }}
              >
                <div style={{ width: 16, height: 16, borderRadius: 8, background: C.m700, marginLeft: "auto" }} />
              </button>
              
              {/* Language Selector */}
              <div style={{ 
                border: `1px solid ${C.borderMed}`, 
                borderRadius: 4, 
                padding: "2px 8px", 
                fontSize: 10.5, 
                fontWeight: 700, 
                color: C.t2,
                background: C.m50,
                display: "flex",
                alignItems: "center",
                gap: 4
              }}>
                EN <ChevronDown size={10} />
              </div>
            </div>

            {/* Card Titles */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.m700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Welcome back!</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", marginBottom: 6 }}>Sign in to your account</div>
              <div style={{ fontSize: 11.5, color: C.t3, lineHeight: 1.4 }}>Access your university portal to continue managing academic and administrative tasks.</div>
            </div>

            {/* Custom Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 0.5, background: C.borderMed }} />
              <div style={{ width: 18, height: 18, borderRadius: 10, background: C.m50, border: `1px solid ${C.borderMed}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookMarked size={10} color={C.m700} />
              </div>
              <div style={{ flex: 1, height: 0.5, background: C.borderMed }} />
            </div>

            {/* Segmented Controller for Role Selection */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Portal Role</label>
              <div style={{ display: "flex", background: C.m50, padding: 3, borderRadius: 8, gap: 2, border: `1px solid ${C.borderMed}` }}>
                {(["Student", "Teacher", "Principal", "Admin"] as Role[]).map((r) => {
                  const active = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        fontSize: 11,
                        fontWeight: active ? 700 : 500,
                        color: active ? "#fff" : C.t2,
                        background: active ? C.m700 : "transparent",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSignIn}>
              {/* Email Address */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 5 }}>Email Address</label>
                <div style={{ position: "relative" }}>
                  <Mail size={14} color={C.t3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="Enter your institutional email"
                    onFocus={() => setFocused("e")} 
                    onBlur={() => setFocused(null)} 
                    style={{
                      width: "100%", 
                      boxSizing: "border-box",
                      border: focused === "e" ? `1.5px solid ${C.m700}` : `1px solid ${C.borderMed}`,
                      borderRadius: 6, 
                      padding: "10px 12px 10px 34px", 
                      fontSize: 12.5,
                      color: C.t1, 
                      background: focused === "e" ? "#fff" : C.m50,
                      outline: "none", 
                      transition: "all 0.15s", 
                      fontFamily: "'Inter',sans-serif"
                    }} 
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 5 }}>Password</label>
                <div style={{ position: "relative" }}>
                  <Lock size={14} color={C.t3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input 
                    type={show ? "text" : "password"} 
                    value={pass} 
                    onChange={e => setPass(e.target.value)} 
                    placeholder="Enter your password"
                    onFocus={() => setFocused("p")} 
                    onBlur={() => setFocused(null)} 
                    style={{
                      width: "100%", 
                      boxSizing: "border-box",
                      border: focused === "p" ? `1.5px solid ${C.m700}` : `1px solid ${C.borderMed}`,
                      borderRadius: 6, 
                      padding: "10px 40px 10px 34px", 
                      fontSize: 12.5,
                      color: C.t1, 
                      background: focused === "p" ? "#fff" : C.m50,
                      outline: "none", 
                      transition: "all 0.15s", 
                      fontFamily: "'Inter',sans-serif"
                    }} 
                  />
                  <button 
                    type="button"
                    onClick={() => setShow(s => !s)} 
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.t3, display: "flex", alignItems: "center" }}
                  >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <button type="button" style={{ fontSize: 11, color: C.m700, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Forgot password?</button>
                </div>
              </div>

              {/* Remember me */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.t2, cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={e => setRememberMe(e.target.checked)} 
                    style={{ accentColor: C.m700 }}
                  />
                  <span>Remember me</span>
                </label>
              </div>

              {/* Sign In Button */}
              <button 
                type="submit" 
                disabled={loading} 
                style={{ 
                  width: "100%", 
                  padding: "11px", 
                  background: loading ? C.m600 : C.m700, 
                  color: "#fff", 
                  borderRadius: 6, 
                  border: "none", 
                  cursor: loading ? "default" : "pointer", 
                  fontSize: 13.5, 
                  fontWeight: 700, 
                  fontFamily: "'Plus Jakarta Sans',sans-serif", 
                  transition: "background 0.15s", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: 8 
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = C.m800; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = C.m700; }}
              >
                {loading ? (
                  <><svg width="14" height="14" viewBox="0 0 16 16" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2A6 6 0 0 1 14 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Signing in...</>
                ) : (
                  <>Sign In &rarr;</>
                )}
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
              <div style={{ flex: 1, height: 0.5, background: C.borderMed }} />
              <span style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>or continue with</span>
              <div style={{ flex: 1, height: 0.5, background: C.borderMed }} />
            </div>

            {/* DepEd SSO / Security Key Button */}
            <button 
              onClick={() => onLogin(role)} 
              style={{ 
                width: "100%", 
                padding: "9px", 
                background: "#fff", 
                border: `1.5px solid ${C.borderMed}`, 
                borderRadius: 6, 
                cursor: "pointer", 
                fontSize: 12.5, 
                fontWeight: 600, 
                color: C.t1, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: 8, 
                transition: "all 0.15s" 
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.m700; e.currentTarget.style.background = C.m50; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderMed; e.currentTarget.style.background = "#fff"; }}
            >
              <Shield size={13} style={{ color: C.m700 }} /> Use Security Key
            </button>

            {/* Authorized Access Only Banner */}
            <div style={{ 
              marginTop: 18, 
              background: "#f9fafb", 
              border: "1px solid #f3f4f6", 
              padding: 12, 
              borderRadius: 6, 
              display: "flex", 
              gap: 10, 
              alignItems: "flex-start",
              textAlign: "left"
            }}>
              <Shield size={14} color={C.m700} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.t1 }}>Authorized Access Only</div>
                <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2, lineHeight: 1.4 }}>
                  This system is for authorized university personnel and students only. All access is monitored and recorded.
                </div>
              </div>
            </div>
          </div>
        </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}