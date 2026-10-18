import React, { useState, useMemo } from 'react';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  GraduationCap, 
  Building2, 
  Boxes, 
  Calendar, 
  Info, 
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp
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
          border: `1px solid ${C.borderMed}`,
          borderTop: `4px solid ${C.gold}`,
          borderRadius: 8,
          padding: '24px 28px',
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
        className="animate-pulse"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 16, border: `2px solid ${C.gold}`, borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>
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
          borderTop: `4px solid ${C.red}`,
          borderRadius: 8,
          padding: '20px 24px',
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>
              Daily Executive Briefing is temporarily unavailable.
            </div>
            <div style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>
              Live metric panels remain accessible below.
            </div>
          </div>
          <button
            onClick={onRefresh}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              color: '#ffffff',
              background: C.m700,
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

  return (
    <section
      aria-label="Daily Executive Briefing"
      style={{
        background: '#ffffff',
        border: `1px solid ${C.borderMed}`,
        borderTop: `4px solid ${C.gold}`,
        borderRadius: 8,
        padding: '24px 28px',
        marginBottom: 24,
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* ── 1. Header Row: Title, Greeting, Controls ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div 
            style={{ 
              fontSize: 10, 
              fontWeight: 800, 
              color: '#92400e', 
              textTransform: 'uppercase', 
              letterSpacing: '0.1em',
              marginBottom: 4 
            }}
          >
            Daily Executive Briefing
          </div>
          <h2 
            style={{ 
              fontSize: 22, 
              fontWeight: 700, 
              color: C.t1, 
              fontFamily: "'Fraunces', serif", 
              lineHeight: 1.25,
              margin: 0 
            }}
          >
            {greeting}
          </h2>
          <p style={{ fontSize: 13, color: C.t3, marginTop: 4, marginBottom: 0, fontWeight: 500 }}>
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
              gap: 5,
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: C.t2,
              background: showSources ? '#e2e8f0' : '#f8fafc',
              border: `1px solid ${C.borderMed}`,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            title="Inspect data provenance and sources"
            aria-expanded={showSources}
          >
            <Info size={13} color={C.t3} />
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
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: C.m800,
              background: C.m50,
              border: `1px solid ${C.m200}`,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
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
            borderRadius: 6,
            padding: '8px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: '#b45309',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertTriangle size={14} color="#b45309" />
          <span>Unable to refresh right now. Showing the last available briefing.</span>
        </div>
      )}

      {/* ── 3. Structured Executive Sections ── */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: 16,
          marginBottom: 18,
        }}
      >
        {/* Section A: School Operations */}
        <div 
          style={{
            background: '#f8fafc',
            border: `1px solid #e2e8f0`,
            borderRadius: 6,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Building2 size={14} color={C.m700} />
              <span style={{ fontSize: 10, fontWeight: 800, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                School Operations
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: C.t1, fontWeight: 500 }}>
              {sections.operations.map((op, idx) => (
                <div key={idx} style={{ marginBottom: idx < sections.operations.length - 1 ? 4 : 0 }}>
                  {op}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section B: Needs Your Attention */}
        <div 
          style={{
            background: sections.attention.hasItems ? '#fffdf7' : '#f8fafc',
            border: `1px solid ${sections.attention.hasItems ? '#fde68a' : '#e2e8f0'}`,
            borderRadius: 6,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              {sections.attention.hasItems ? (
                <AlertTriangle size={14} color="#d97706" />
              ) : (
                <CheckCircle2 size={14} color={C.green} />
              )}
              <span 
                style={{ 
                  fontSize: 10, 
                  fontWeight: 800, 
                  color: sections.attention.hasItems ? '#92400e' : C.t2, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em' 
                }}
              >
                Needs Your Attention
              </span>
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.55, color: C.t1, fontWeight: 500 }}>
              {sections.attention.items.map((item, idx) => (
                <div key={idx} style={{ marginBottom: idx < sections.attention.items.length - 1 ? 4 : 0 }}>
                  {sections.attention.hasItems ? `• ${item}` : item}
                </div>
              ))}
            </div>
          </div>

          {/* Contextual Action Links */}
          {sections.attention.hasItems && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12, paddingTop: 8, borderTop: '1px dashed #fde68a' }}>
              {sections.attention.pendingLeaves > 0 && (
                <button
                  onClick={() => onNav('p-leaves')}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.m800,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  Review Leaves <ArrowRight size={11} />
                </button>
              )}
              {sections.attention.behaviorCases > 0 && (
                <button
                  onClick={() => onNav('p-behavior')}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.m800,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  View Behavior Reports <ArrowRight size={11} />
                </button>
              )}
              {sections.attention.inventoryIssues > 0 && (
                <button
                  onClick={() => onNav('p-inventory')}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.m800,
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
              )}
            </div>
          )}
        </div>

        {/* Section C: Academic Status */}
        <div 
          style={{
            background: '#f8fafc',
            border: `1px solid #e2e8f0`,
            borderRadius: 6,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <GraduationCap size={14} color={C.blue} />
              <span style={{ fontSize: 10, fontWeight: 800, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Academic Performance
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: C.t1, fontWeight: 500 }}>
              {sections.academics}
            </div>
          </div>

          <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #edf2f7' }}>
            <button
              onClick={() => onNav('p-analytics')}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.blue,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              Academic Analytics <ArrowRight size={11} />
            </button>
          </div>
        </div>

        {/* Section D: Property / Inventory (Rendered only when active issues exist) */}
        {sections.property && (
          <div 
            style={{
              background: '#f8fafc',
              border: `1px solid #e2e8f0`,
              borderRadius: 6,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Boxes size={14} color="#7c3aed" />
                <span style={{ fontSize: 10, fontWeight: 800, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Property & Operations
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: C.t1, fontWeight: 500 }}>
                {sections.property}
              </div>
            </div>

            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #edf2f7' }}>
              <button
                onClick={() => onNav('p-inventory')}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#7c3aed',
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

        {/* Section E: Upcoming Calendar Events (Rendered only when events exist) */}
        {sections.upcomingEvents && (
          <div 
            style={{
              background: '#f8fafc',
              border: `1px solid #e2e8f0`,
              borderRadius: 6,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Calendar size={14} color={C.green} />
                <span style={{ fontSize: 10, fontWeight: 800, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Institutional Calendar
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: C.t1, fontWeight: 500 }}>
                {sections.upcomingEvents}
              </div>
            </div>

            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #edf2f7' }}>
              <button
                onClick={() => onNav('p-events')}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.green,
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

      {/* ── 4. Provenance & Data Sources Panel (Collapsible) ── */}
      {showSources && (
        <div 
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            padding: '14px 18px',
            marginBottom: 16,
            fontSize: 12,
            lineHeight: 1.6,
            color: C.t2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: C.t1, marginBottom: 6 }}>
            <ShieldCheck size={15} color={C.green} />
            <span>Executive Briefing Provenance & Grounding Boundaries</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3, marginBottom: 4 }}>
                Authorized Data Domains
              </div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>Gate Attendance (Student tap records)</li>
                <li>Faculty Attendance (Biometric & RFID time logs)</li>
                <li>Academics (DepEd SF10 & term gradebooks)</li>
                <li>Discipline & Welfare (Open behavioral cases)</li>
                <li>Operations & Leaves (Leave requests & calendar)</li>
                <li>Property & Inventory (Physical unit status)</li>
              </ul>
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3, marginBottom: 4 }}>
                Synthesis Architecture
              </div>
              <div>
                <strong>Generation Mode:</strong>{' '}
                {summaryData?.generationMode === 'llm'
                  ? 'AI-generated from grounded DigiSkwela data'
                  : 'Deterministic grounded synthesis'}
              </div>
              <div style={{ marginTop: 4 }}>
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
          paddingTop: 12,
          borderTop: '1px solid #f1f5f9',
          fontSize: 11,
          color: C.t3,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span 
            style={{ 
              width: 7, 
              height: 7, 
              borderRadius: '50%', 
              background: C.green, 
              display: 'inline-block' 
            }} 
          />
          <span style={{ fontWeight: 600, color: C.t2 }}>
            Generated from live DigiSkwela data
          </span>
          <span>•</span>
          <span>Updated {summaryData?.asOfFormatted || 'Just now'}</span>
        </div>

        <div style={{ fontSize: 10.5, color: C.t3 }}>
          Calulut Integrated School • Principal Leadership Dashboard
        </div>
      </div>
    </section>
  );
}
