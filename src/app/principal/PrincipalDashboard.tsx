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
import { PWelfare } from './welfare/PWelfare';
import { PInventory } from './inventory/PInventory';
import { PReports } from './reports/PReports';
import { TemplateHubScreen } from '../teacher/templates/TemplateHubScreen';
import { PEventsScreen } from './events/PEventsScreen';
import { X } from 'lucide-react';

export function PrincipalDashboard({ onLogout }: { onLogout:()=>void }) {
  const [screen, setScreen]   = useState<PScreen>("p-dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const { isMobile, isTablet }  = useLayout();
  const showGradeCard = (_info:GradeCardInfo) => {}; /* read-only: no grade drawer for principal */

  const TITLES: Record<PScreen,string> = {
    "p-dashboard": "Dashboard Overview", "p-monitoring":"Real-Time Monitoring",
    "p-analytics":"Academic Analytics",  "p-teachers":  "Teacher Management",
    "p-welfare":  "Student Welfare",     "p-inventory": "Inventory",
    "p-reports":  "Reports",             "p-templates": "Template Hub",
    "p-events":   "School Events",
    "p-settings": "Settings",            "p-help":      "Help & Feedback",
  };

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
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <PHeaderBand
          title={TITLES[screen]}
          sub="Tuesday, June 10, 2025"
          onMenu={isMobile?()=>setMenuOpen(true):undefined}
          onLogout={onLogout}
          onSettings={() => setScreen("p-settings")}
        />
        <ReadOnlyBanner />
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {screen==="p-dashboard"  && <PDashboard  onNav={setScreen} onShowGradeCard={showGradeCard} />}
          {screen==="p-monitoring" && <PMonitoring />}
          {screen==="p-analytics"  && <PAcademics  />}
          {screen==="p-teachers"   && <PTeachers   />}
          {screen==="p-welfare"    && <PWelfare     />}
          {screen==="p-inventory"  && <PInventory   />}
          {screen==="p-reports"    && <PReports     />}
          {screen==="p-templates"  && <TemplateHubScreen />}
          {screen==="p-events"     && <PEventsScreen />}
          {(screen==="p-settings"||screen==="p-help") && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, background:C.paper }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>{TITLES[screen]}</div>
              <div style={{ fontSize:12, color:C.t3 }}>This section is coming soon.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Other role stubs ──────────────────────────────────────── */