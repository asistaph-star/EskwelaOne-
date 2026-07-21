import React, { useState } from 'react';
import { GScreen } from '../shared/types';
import { C } from '../shared/constants/tokens';
import { GSidebar } from './shared/GSidebar';
import { GDashboard } from './dashboard/GDashboard';
import { GBehaviorScreen } from './behavior/GBehaviorScreen';
import { GCounselingScreen } from './appointments/GCounselingScreen';
import { StubScreen } from '../shared/components/StubScreen';
import { Settings, HelpCircle, Bell } from 'lucide-react';
import { NotificationDropdown } from '../shared/components/NotificationDropdown';
import { AIAssistantWidget } from '../shared/components/AIAssistantWidget';

export function GuidanceApp({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<GScreen>("g-dashboard");
  const [notifOpen, setNotifOpen] = useState(false);

  const TITLES: Record<GScreen, { title: string; sub: string }> = {
    "g-dashboard": { title: "Guidance Dashboard", sub: "Overview of student cases and counseling schedules" },
    "g-behavior": { title: "Behavioral Reports", sub: "Track and manage student disciplinary cases" },
    "g-counseling": { title: "Counseling Sessions", sub: "Manage student and parent appointments" },
    "g-settings": { title: "Settings", sub: "Guidance Office Preferences" },
    "g-help": { title: "Help & Support", sub: "System assistance and documentation" }
  };

  const current = TITLES[screen];

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: C.bg, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      <GSidebar active={screen} onNav={setScreen} onLogout={onLogout} />
      
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        
        {/* Topbar */}
        <div style={{ height: 72, background: "#fff", borderBottom: `1px solid ${C.borderHeavy}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", flexShrink: 0, zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif" }}>{current.title}</div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{current.sub}</div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <button onClick={() => setNotifOpen(!notifOpen)} style={{ background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.t2, transition: "all 0.15s" }}>
                <Bell size={18} />
                <div style={{ position: "absolute", top: 8, right: 10, width: 8, height: 8, background: C.red, borderRadius: 4, border: "2px solid #fff" }} />
              </button>
              {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
            </div>
            <div style={{ width: 1, height: 24, background: C.borderMed }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Counselor Perez</div>
                <div style={{ fontSize: 11, color: C.t3 }}>Guidance</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", color: C.m900, fontWeight: 800, fontSize: 14 }}>
                GC
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {screen === "g-dashboard" && <GDashboard />}
        {screen === "g-behavior" && <GBehaviorScreen />}
        {screen === "g-counseling" && <GCounselingScreen />}
        
        {(screen === "g-settings" || screen === "g-help") && (
          <div style={{ flex: 1, padding: "40px" }}>
            <StubScreen icon={screen === "g-settings" ? Settings : HelpCircle} label={current.title} desc={current.sub} />
          </div>
        )}
      </div>

      <AIAssistantWidget />
    </div>
  );
}
