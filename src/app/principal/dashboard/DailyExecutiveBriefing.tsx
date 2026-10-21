import React, { useState, useMemo } from 'react';
import { 
  RefreshCw, 
  AlertCircle, 
  Info, 
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ExecutiveSummaryResponse } from '../../../api/executiveSummary.api';
import { PScreen } from '../../shared/types';
import { 
  getPhilippineDayPart, 
  formatPrincipalGreeting, 
  buildSynthesizedNarrative 
} from './briefingHelpers';

export interface DailyExecutiveBriefingProps {
  summaryData: ExecutiveSummaryResponse | null;
  loading: boolean;
  error: boolean;
  isLiveUpdating?: boolean;
  liveUpdateError?: boolean;
  onRefresh: () => void;
  onNav: (s: PScreen) => void;
  currentUser: { name?: string; firstName?: string; [key: string]: any } | null;
}

export function DailyExecutiveBriefing({
  summaryData,
  loading,
  error,
  isLiveUpdating = false,
  liveUpdateError = false,
  onRefresh,
  onNav,
  currentUser,
}: DailyExecutiveBriefingProps) {
  const [showSources, setShowSources] = useState(false);

  // Time-aware greeting in Asia/Manila (UTC+8)
  const greeting = useMemo(() => {
    const dayPart = getPhilippineDayPart();
    return formatPrincipalGreeting(dayPart, currentUser);
  }, [currentUser]);

  // Concise synthesized executive narrative and action shortcuts
  const narrative = useMemo(() => {
    return buildSynthesizedNarrative(summaryData);
  }, [summaryData]);

  // Initial loading state (only when no cached summary exists yet)
  if (loading && !summaryData) {
    return (
      <div 
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '24px 28px',
          marginBottom: 20,
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
        }}
        className="animate-pulse"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 16, border: '2px solid #0f172a', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
            Compiling today's executive briefing from verified DigiSkwela records...
          </span>
        </div>
      </div>
    );
  }

  // Initial error state (no cached summary available)
  if (error && !summaryData) {
    return (
      <div 
        style={{
          background: '#ffffff',
          border: '1px solid #fecaca',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 20,
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#b91c1c' }}>
              Daily Executive Briefing is temporarily unavailable.
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Live operational metric panels remain accessible below.
            </div>
          </div>
          <button
            onClick={onRefresh}
            style={{
              padding: '6px 14px',
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

  return (
    <section
      aria-label="Daily Executive Briefing"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '24px 28px',
        marginBottom: 20,
        boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* ── 1. Top Bar: Header & Refresh Action ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
        <div>
          <div 
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 16,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1d4ed8' }} />
            <span 
              style={{ 
                fontSize: 9.5, 
                fontWeight: 700, 
                color: '#475569', 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em' 
              }}
            >
              Daily Executive Briefing
            </span>
          </div>

          <h2 
            style={{ 
              fontSize: 22, 
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

        {/* Refresh Briefing Button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 13px',
            borderRadius: 6,
            fontSize: 11.5,
            fontWeight: 600,
            color: '#334155',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.75 : 1,
            transition: 'all 0.15s ease',
          }}
          className="hover:bg-slate-100 transition"
          title="Refresh briefing from live school records"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh Briefing'}</span>
        </button>
      </div>

      {/* ── 2. Refresh Error Notice (if background refresh failed while preserving old data) ── */}
      {(error || liveUpdateError) && summaryData && (
        <div 
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 14,
            fontSize: 12,
            color: '#b45309',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={14} color="#b45309" />
          <span>
            {liveUpdateError
              ? 'Unable to update live briefing. Showing the last available data.'
              : 'Unable to refresh right now. Showing the last available briefing.'}
          </span>
        </div>
      )}

      {/* ── 3. Synthesized Management Narrative (2-4 scannable paragraphs) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {narrative.paragraphs.map((para, idx) => (
          <p 
            key={idx} 
            style={{ 
              fontSize: 13.5, 
              lineHeight: 1.65, 
              color: '#334155', 
              margin: 0, 
              fontWeight: 500,
              fontFamily: "'Plus Jakarta Sans', sans-serif" 
            }}
          >
            {para}
          </p>
        ))}
      </div>

      {/* ── 4. Compact Attention Action Triggers (Only if actionable items exist) ── */}
      {narrative.actions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {narrative.actions.map((act) => (
            <button
              key={act.label}
              onClick={() => onNav(act.screen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 600,
                color: '#0f172a',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="hover:bg-slate-200"
            >
              <span>{act.label}</span>
              <ArrowRight size={11} />
            </button>
          ))}
        </div>
      )}

      {/* ── 5. Footer: Timestamp & Sources Disclosure ── */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 18,
          paddingTop: 12,
          borderTop: '1px solid #f1f5f9',
          fontSize: 11,
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span 
            style={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              background: isLiveUpdating ? '#2563eb' : '#16a34a', 
              display: 'inline-block',
              transition: 'background-color 0.2s ease',
            }} 
            className={isLiveUpdating ? 'animate-ping' : ''}
          />
          <span style={{ fontWeight: 600, color: isLiveUpdating ? '#1d4ed8' : '#334155' }}>
            {isLiveUpdating ? 'Updating…' : 'Live DigiSkwela data'}
          </span>
          <span>•</span>
          <span>Updated {summaryData?.asOfFormatted || 'Just now'}</span>
        </div>

        <button
          onClick={() => setShowSources(!showSources)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 11,
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 600,
          }}
          className="hover:text-slate-900 transition"
          aria-expanded={showSources}
        >
          <Info size={12} />
          <span>Sources</span>
          {showSources ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* ── 6. Provenance & Data Sources Panel (Collapsible) ── */}
      {showSources && (
        <div 
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '14px 18px',
            marginTop: 12,
            fontSize: 12,
            lineHeight: 1.6,
            color: '#334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            <ShieldCheck size={15} color="#16a34a" />
            <span>Executive Briefing Provenance & Grounding Boundaries</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 4 }}>
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
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 4 }}>
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
    </section>
  );
}
