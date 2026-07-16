import React, { useState } from 'react';
import { PScreen, GradeCardInfo } from '../shared/types';
import { C } from '../shared/constants/tokens';
import { useLayout } from '../App';
import { PSidebar } from './shared/PSidebar';
import { PHeaderBand } from './shared/PHeaderBand';
import { ReadOnlyBanner } from '../shared/components/ReadOnlyBanner';
import { PDashboard } from './dashboard/PDashboard';
import { PMonitoring } from './monitoring/PMonitoring';
import { PAcademics } from './analytics/PAcademics';
import { PTeachers } from './teachers/PTeachers';
import { PInventory } from './inventory/PInventory';
import { PReports } from './reports/PReports';
import { TemplateHubScreen } from '../teacher/templates/TemplateHubScreen';
import { PEventsScreen } from './events/PEventsScreen';
import { PLiveFacultyAttendance } from './attendance/PLiveFacultyAttendance';
import { X } from 'lucide-react';
import { AIAssistantWidget } from '../shared/components/AIAssistantWidget';

export function RegistrarApp({ onLogout }: { onLogout:()=>void }) {
  const [screen, setScreen]   = useState<PScreen>("p-dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const { isMobile, isTablet }  = useLayout();
  const showGradeCard = (_info:GradeCardInfo) => {}; /* read-only: no grade drawer for admin */

  const TITLES: Record<PScreen,string> = {
    "p-dashboard": "Dashboard Overview", "p-monitoring":"Real-Time Monitoring",
    "p-analytics":"Academic Analytics",  "p-teachers":  "Teacher Management",
    "p-inventory": "Inventory",
    "p-reports":  "Reports",             "p-templates": "Template Hub",
    "p-events":   "School Events",       "p-faculty-attendance": "Live Faculty Attendance",
    "p-settings": "Settings",            "p-help":      "Help & Feedback",
  };

  if (screen === "p-faculty-attendance") {
    return <PLiveFacultyAttendance onExit={() => setScreen("p-dashboard")} />;
  }

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:C.paper, fontFamily:"'Inter',sans-serif" }}>
      {!isMobile && <PSidebar active={screen} onNav={setScreen} onLogout={onLogout} collapsed={isTablet} />}
      {isMobile && menuOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex" }}>
          <div onClick={()=>setMenuOpen(false)} style={{ flex:1, background:"rgba(0,0,0,0.5)" }} />
          <div style={{ width:280 }}><PSidebar active={screen} onNav={(s)=>{setScreen(s);setMenuOpen(false);}} onLogout={onLogout} /></div>
          <button onClick={()=>setMenuOpen(false)} style={{ position:"absolute", top:14, right:14, width:34, height:34, borderRadius:20, background:"rgba(255,255,255,0.12)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <X size={16} color="#fff" />
          </button>
        </div>
      )}
      <div className="watermark-bg" style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <PHeaderBand
          title={TITLES[screen]}
          sub="Tuesday, June 10, 2025"
          onMenu={isMobile?()=>setMenuOpen(true):undefined}
          onLogout={onLogout}
          onSettings={() => setScreen("p-settings")}
        />
        <ReadOnlyBanner />
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position: "relative" }}>
          {screen==="p-dashboard"  && <PDashboard  onNav={setScreen} onShowGradeCard={showGradeCard} />}
          {screen==="p-monitoring" && <PMonitoring />}
          {screen==="p-analytics"  && <PAcademics  />}
          {screen==="p-teachers"   && <PTeachers   />}
          {screen==="p-inventory"  && <PInventory   />}
          {screen==="p-reports"    && <PReports     />}
          {screen==="p-templates"  && <TemplateHubScreen role="registrar" />}
          {screen==="p-events"     && <PEventsScreen />}
          {(screen==="p-settings"||screen==="p-help") && (
            <div className="watermark-bg" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: C.m50, padding: 32, textAlign: "center" }}>
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "40px 32px", maxWidth: 400, width: "100%", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: 36, background: C.m100, border: `2px solid ${C.m700}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.m700, boxShadow: "0 4px 12px rgba(139,30,30,0.1)" }}>
                  <span style={{ fontSize: 32 }}>🚧</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 6 }}>{TITLES[screen]}</h3>
                  <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>This administrative module is currently being finalized.</p>
                </div>
                <div style={{ marginTop: 8, padding: "8px 16px", background: C.m100, color: C.m700, borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid rgba(139,30,30,0.1)` }}>
                  Feature Coming Soon
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <AIAssistantWidget role="Registrar" />
    </div>
  );
}
