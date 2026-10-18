import React, { useState, useMemo } from 'react';
import { 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  GraduationCap, 
  Building2, 
  Boxes, 
  Calendar, 
  Info, 
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Activity,
  ClipboardList
} from 'lucide-react';
import { ExecutiveSummaryResponse } from '../../../api/executiveSummary.api';
import { PScreen } from '../../shared/types';
import { C } from '../../shared/constants/tokens';
import { 
  getPhilippineDayPart, 
  formatPrincipalGreeting, 
  buildBriefingSections 
} from './briefingHelpers';

export interface DailyExecutiveBriefingProps {
  summaryData: ExecutiveSummaryResponse | null;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
  onNav: (s: PScreen) => void;
  currentUser: { name?: string; firstName?: string; [key: string]: any } | null;
}

export function DailyExecutiveBriefing({
  summaryData,
  loading,
  error,
  onRefresh,
  onNav,
  currentUser,
}: DailyExecutiveBriefingProps) {
  const [showSources, setShowSources] = useState(false);

  // Time-aware greeting calculated in Asia/Manila
  const greeting = useMemo(() => {
    const dayPart = getPhilippineDayPart();
    return formatPrincipalGreeting(dayPart, currentUser);
  }, [currentUser]);

  // Structured scannable sections parsed from fact metrics
  const sections = useMemo(() => {
    return buildBriefingSections(summaryData);
  }, [summaryData]);

  // Initial loading state (only when no data is cached yet)
  if (loading && !summaryData) {
    return (
      <div 
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '28px 32px',
          marginBottom: 24,
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        }}
        className="animate-pulse"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 18, height: 18, border: '2px solid #0f172a', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
            Compiling today's executive briefing from verified DigiSkwela records...
          </span>
        </div>
      </div>
    );
  }

  // Initial error state (no cached data available)
  if (error && !summaryData) {
    return (
      <div 
        style={{
          background: '#ffffff',
          border: '1px solid #fecaca',
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 24,
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>
              Daily Executive Briefing is temporarily unavailable.
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Live metric panels remain accessible below.
            </div>
          </div>
          <button
            onClick={onRefresh}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#ffffff',
              background: '#0f172a',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const onCampusCount = summaryData?.metrics?.students?.onCampusNow ?? 0;
  const facultyCheckedIn = summaryData?.metrics?.faculty?.checkedInToday ?? 0;
  const facultyTotal = summaryData?.metrics?.faculty?.totalActive ?? 0;

  return (
    <section
      aria-label="Daily Executive Briefing"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 24,
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* ── 1. Header: Pill Kicker, Typography, Controls ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
        <div>
          {/* Refined institutional pill (No orange!) */}
          <div 
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 20,
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              marginBottom: 8,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1d4ed8' }} />
            <span 
              style={{ 
                fontSize: 10, 
                fontWeight: 700, 
                color: '#334155', 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em' 
              }}
            >
              Daily Executive Briefing
            </span>
          </div>

          <h2 
            style={{ 
              fontSize: 24, 
              fontWeight: 700, 
              color: '#0f172a', 
              fontFamily: "'Fraunces', serif", 
              letterSpacing: '-0.015em',
              lineHeight: 1.25,
              margin: 0 
            }}
          >
            {greeting}
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 0, fontWeight: 500 }}>
            Here’s what’s happening at Calulut Integrated School today.
          </p>
        </div>

        {/* Action Controls: Refresh Briefing & Sources */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setShowSources(!showSources)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: '#334155',
              background: showSources ? '#e2e8f0' : '#f8fafc',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Inspect data provenance and sources"
            aria-expanded={showSources}
          >
            <Info size={13} color="#475569" />
            <span>Sources</span>
            {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: '#ffffff',
              background: '#0f172a',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1,
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              transition: 'all 0.15s ease',
            }}
            title="Refresh briefing from live school records"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh Briefing'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Refresh Error Notice (if background refresh failed while preserving old data) ── */}
      {error && summaryData && (
        <div 
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 18,
            fontSize: 12,
            color: '#b45309',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={15} color="#b45309" />
          <span>Unable to refresh right now. Showing the last available briefing.</span>
        </div>
      )}

      {/* ── 3. Executive Command Grid (Asymmetrical, High-Hierarchy Layout) ── */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', 
          gap: 18,
          marginBottom: 20,
        }}
        className="max-lg:grid-cols-1"
      >
        {/* ── LEFT COLUMN: Campus Operations & Academic Cycle ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Card A: Campus Operations Pulse */}
          <div 
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={14} color="#1d4ed8" />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Campus Operations
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 12 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a' }} />
                <span>Live Status</span>
              </div>
            </div>

            {/* Quick-Glance Stat Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.1 }}>
                  {onCampusCount}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginTop: 2 }}>
                  Students on Campus
                </div>
                <div style={{ fontSize: 9.5, color: '#94a3b8' }}>Real-time gate scans</div>
              </div>

              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.1 }}>
                  {facultyCheckedIn} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>/ {facultyTotal}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginTop: 2 }}>
                  Faculty Checked In
                </div>
                <div style={{ fontSize: 9.5, color: '#94a3b8' }}>Active faculty roster</div>
              </div>
            </div>

            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#334155', fontWeight: 500 }}>
              {sections.operations.map((op, idx) => (
                <div key={idx} style={{ marginBottom: idx < sections.operations.length - 1 ? 4 : 0 }}>
                  {op}
                </div>
              ))}
            </div>
          </div>

          {/* Card B: Academic Performance & SF10 Cycle */}
          <div 
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GraduationCap size={14} color="#6d28d9" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Academic Performance
                  </span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
                  DepEd SF10 Cycle
                </span>
              </div>

              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#334155', fontWeight: 500 }}>
                {sections.academics}
              </div>
            </div>

            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={() => onNav('p-analytics')}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1d4ed8',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'gap 0.15s ease',
                }}
                className="hover:underline"
              >
                <span>Explore Academic Analytics</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Needs Attention & Operations ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Card C: Administrative Attention (Action Checklist) */}
          <div 
            style={{
              background: sections.attention.hasItems ? '#fdfcfb' : '#ffffff',
              border: '1px solid #e7e5e4',
              borderLeft: sections.attention.hasItems ? '4px solid #b45309' : '4px solid #16a34a',
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div 
                    style={{ 
                      width: 26, 
                      height: 26, 
                      borderRadius: 6, 
                      background: sections.attention.hasItems ? '#fef3c7' : '#dcfce7', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}
                  >
                    {sections.attention.hasItems ? (
                      <ClipboardList size={14} color="#b45309" />
                    ) : (
                      <CheckCircle2 size={14} color="#16a34a" />
                    )}
                  </div>
                  <span 
                    style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      color: '#1e293b', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.06em' 
                    }}
                  >
                    Needs Your Attention
                  </span>
                </div>

                <span 
                  style={{ 
                    fontSize: 10, 
                    fontWeight: 700, 
                    color: sections.attention.hasItems ? '#92400e' : '#15803d',
                    background: sections.attention.hasItems ? '#fef3c7' : '#dcfce7',
                    padding: '2px 8px',
                    borderRadius: 12,
                  }}
                >
                  {sections.attention.hasItems 
                    ? `${(sections.attention.behaviorCases > 0 ? 1 : 0) + (sections.attention.pendingLeaves > 0 ? 1 : 0) + (sections.attention.inventoryIssues > 0 ? 1 : 0)} Action Items`
                    : 'Clear'}
                </span>
              </div>

              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#334155', fontWeight: 500 }}>
                {sections.attention.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: idx < sections.attention.items.length - 1 ? 8 : 0 }}>
                    {sections.attention.hasItems && (
                      <span style={{ color: '#b45309', fontWeight: 700, marginTop: 1 }}>•</span>
                    )}
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons for Attention Items */}
            {sections.attention.hasItems && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 10, borderTop: '1px solid #f5f5f4' }}>
                {sections.attention.pendingLeaves > 0 && (
                  <button
                    onClick={() => onNav('p-leaves')}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#0f172a',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Review Leaves</span>
                    <ArrowRight size={11} />
                  </button>
                )}
                {sections.attention.behaviorCases > 0 && (
                  <button
                    onClick={() => onNav('p-behavior')}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#0f172a',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>View Behavior</span>
                    <ArrowRight size={11} />
                  </button>
                )}
                {sections.attention.inventoryIssues > 0 && (
                  <button
                    onClick={() => onNav('p-inventory')}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#0f172a',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>View Inventory</span>
                    <ArrowRight size={11} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Card D: Property / Inventory (Rendered only when active issues exist) */}
          {sections.property && (
            <div 
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '14px 16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Boxes size={13} color="#6d28d9" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Property & Operations
                  </span>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#334155', fontWeight: 500 }}>
                  {sections.property}
                </div>
              </div>

              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                <button
                  onClick={() => onNav('p-inventory')}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#6d28d9',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  View Inventory <ArrowRight size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Card E: Upcoming Calendar Events (Rendered only when events exist) */}
          {sections.upcomingEvents && (
            <div 
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '14px 16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={13} color="#059669" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Institutional Calendar
                  </span>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#334155', fontWeight: 500 }}>
                  {sections.upcomingEvents}
                </div>
              </div>

              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                <button
                  onClick={() => onNav('p-events')}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#059669',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  View Calendar <ArrowRight size={11} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Provenance & Data Sources Panel (Collapsible) ── */}
      {showSources && (
        <div 
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '16px 20px',
            marginBottom: 18,
            fontSize: 12,
            lineHeight: 1.6,
            color: '#334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            <ShieldCheck size={16} color="#16a34a" />
            <span>Executive Briefing Provenance & Grounding Boundaries</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 6 }}>
                Authorized Data Domains
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Gate Attendance (Student tap records)</li>
                <li>Faculty Attendance (Biometric & RFID time logs)</li>
                <li>Academics (DepEd SF10 & term gradebooks)</li>
                <li>Discipline & Welfare (Open behavioral cases)</li>
                <li>Operations & Leaves (Leave requests & calendar)</li>
                <li>Property & Inventory (Physical unit status)</li>
              </ul>
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 6 }}>
                Synthesis Architecture
              </div>
              <div>
                <strong>Generation Mode:</strong>{' '}
                {summaryData?.generationMode === 'llm'
                  ? 'AI-generated from grounded DigiSkwela data'
                  : 'Deterministic grounded synthesis'}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Strict Boundary:</strong> Zero access to confidential Clinic medical records or Guidance counseling sessions. Grounded strictly in authorized Principal data.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Footer: Timestamp & Live Status ── */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          paddingTop: 14,
          borderTop: '1px solid #f1f5f9',
          fontSize: 11,
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span 
            style={{ 
              width: 7, 
              height: 7, 
              borderRadius: '50%', 
              background: '#16a34a', 
              display: 'inline-block' 
            }} 
          />
          <span style={{ fontWeight: 600, color: '#334155' }}>
            Generated from live DigiSkwela data
          </span>
          <span>•</span>
          <span>Updated {summaryData?.asOfFormatted || 'Just now'}</span>
        </div>

        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
          Calulut Integrated School • Principal Leadership Dashboard
        </div>
      </div>
    </section>
  );
}
