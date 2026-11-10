import React, { useState } from 'react';
import { RScreen } from '../shared/types';
import { C } from '../shared/constants/tokens';
import { useLayout } from '../App';
import { RSidebar } from './shared/RSidebar';
import { PHeaderBand } from './shared/PHeaderBand';
import { RDashboard } from './dashboard/RDashboard';
import { REnrollmentScreen } from './enrollment/REnrollmentScreen';
import { RDocRequestsScreen } from './documents/RDocRequestsScreen';
import { RAcademicRecordsScreen } from './records/RAcademicRecordsScreen';
import { ReportCardReleaseConsole } from '../shared/components/ReportCardReleaseConsole';
import { SectionsManagement } from '../admin/operations/SectionsManagement';
import { SchoolYearManagementScreen } from '../shared/components/SchoolYearManagementScreen';
import { RProfileScreen } from './settings/RProfileScreen';
import { X } from 'lucide-react';
import { PrincipalAIAssistant } from './ai/PrincipalAIAssistant';

export function RegistrarApp({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<RScreen>("r-dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const { isMobile, isTablet } = useLayout();

  const TITLES: Record<RScreen, string> = {
    "r-dashboard": "Registrar Overview",
    "r-enrollment": "Student Enrollment",
    "r-records": "Academic Records (SF10)",
    "r-report-cards": "Report Cards (SF9)",
    "r-doc-requests": "Document Requests",
    "r-search": "Academic Records (SF10)",
    "r-sections": "Sections and Rosters",
    "r-school-years": "School Years",
    "r-profile": "My Profile",
    "r-settings": "My Profile",
    "r-help": "Help and Support",
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: C.paper, fontFamily: "'Inter',sans-serif" }}>
      {!isMobile && <RSidebar active={screen} onNav={setScreen} onLogout={onLogout} collapsed={isTablet} />}
      {isMobile && menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div onClick={() => setMenuOpen(false)} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ width: 280 }}><RSidebar active={screen} onNav={(s) => { setScreen(s); setMenuOpen(false); }} onLogout={onLogout} /></div>
          <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="#fff" />
          </button>
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <PHeaderBand
          title={TITLES[screen] || "Registrar Portal"}
          sub="Registrar Office, Calulut Integrated School"
          onMenu={isMobile ? () => setMenuOpen(true) : undefined}
          onLogout={onLogout}
          onSettings={() => setScreen("r-profile")}
        />
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {screen === "r-dashboard" && <RDashboard />}
          {screen === "r-enrollment" && <REnrollmentScreen />}
          {screen === "r-doc-requests" && <RDocRequestsScreen />}
          {(screen === "r-records" || screen === "r-search") && <RAcademicRecordsScreen />}
          {screen === "r-report-cards" && <ReportCardReleaseConsole portal="Registrar" />}
          {screen === "r-sections" && <SectionsManagement readOnly={true} />}
          {screen === "r-school-years" && <SchoolYearManagementScreen portal="Registrar" />}
          {(screen === "r-profile" || screen === "r-settings") && <RProfileScreen />}
          {screen === "r-help" && (
            <div className="watermark-bg" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: C.m50, padding: 32, textAlign: "center" }}>
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "40px 32px", maxWidth: 440, width: "100%", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 32, background: C.m100, border: `2px solid ${C.m700}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.m700 }}>
                  <span style={{ fontSize: 28 }}>ℹ️</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 6 }}>Registrar Help & Information</h3>
                  <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>
                    For technical support, user account provisioning, or credential resets, please contact the IT Administrator. For policy determinations and official report card authorizations, consult the School Principal.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <PrincipalAIAssistant portal="Registrar" role="Registrar" />
    </div>
  );
}
