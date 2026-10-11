import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { apiClient } from '../../../api/client';
import { PTableHeader } from '../shared/PTableHeader';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  X,
  AlertTriangle,
  Clock,
  RotateCcw,
  FileText
} from 'lucide-react';

export interface BehaviorLogItem {
  id: string;
  student_id: string;
  type: string;
  date: string;
  status: string;
  note: string | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
  reporter_name?: string | null;
  studentName?: string;
  reporter?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface BehaviorSummaryData {
  total: number;
  studentsCount: number;
  statusCounts: Record<string, number>;
  reported: number;
  underInvestigation: number;
  parentNotified: number;
  resolved: number;
}

export function PBehaviorScreen() {
  const [logs, setLogs] = useState<BehaviorLogItem[]>([]);
  const [summary, setSummary] = useState<BehaviorSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  // Filters (for recent incident table)
  const [search, setSearch] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Detail Drawer
  const [selectedLog, setSelectedLog] = useState<BehaviorLogItem | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(false);
      const [logsData, summaryData] = await Promise.all([
        apiClient.get<BehaviorLogItem[]>('/student-services/behavior'),
        apiClient.get<BehaviorSummaryData>('/student-services/behavior/summary')
      ]);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setSummary(summaryData || null);
    } catch (err) {
      console.error('Failed to fetch behavioral data:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Collect distinct types from loaded logs and distinct statuses from summary/logs
  const availableTypes = Array.from(new Set(logs.map(l => l.type).filter(Boolean)));
  const availableStatuses = summary
    ? Array.from(new Set([...Object.keys(summary.statusCounts), ...logs.map(l => l.status)].filter(Boolean)))
    : Array.from(new Set(logs.map(l => l.status).filter(Boolean)));

  // Filter & sort logs within the recent list
  const filteredLogs = logs.filter(log => {
    const s = search.toLowerCase();
    const studentMatch = (log.studentName || '').toLowerCase().includes(s) || (log.student_id || '').toLowerCase().includes(s);
    const typeMatch = (log.type || '').toLowerCase().includes(s);
    const noteMatch = (log.note || '').toLowerCase().includes(s);
    const reporterMatch = (log.reporter_name || '').toLowerCase().includes(s);
    const matchesSearch = !search || studentMatch || typeMatch || noteMatch || reporterMatch;

    const matchesType = selectedType === 'all' || log.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || log.status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  }).sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const resetFilters = () => {
    setSearch('');
    setSelectedType('all');
    setSelectedStatus('all');
    setSortOrder('desc');
  };

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'resolved') return { color: C.green, bg: C.greenBg };
    if (s === 'under investigation') return { color: C.blue, bg: C.blueBg };
    if (s === 'parent notified') return { color: C.amber, bg: C.amberBg };
    if (s === 'reported') return { color: C.red, bg: C.redBg };
    return { color: C.t2, bg: C.paper };
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'transparent', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Behavioral Reports</h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: C.m100, color: C.m700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Read-Only · Administrative Oversight
            </span>
          </div>
          <p style={{ fontSize: 12, color: C.t3, marginTop: 4, marginBottom: 0 }}>
            Institutional overview of student conduct logs, incident cases, and disciplinary statuses across the school.
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: '#fff',
            border: `1px solid ${C.borderMed}`,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            color: C.t2,
            cursor: 'pointer'
          }}
        >
          <RotateCcw size={13} /> Refresh Data
        </button>
      </div>

      {/* Database-Wide Aggregate KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <div style={{ background: '#fff', border: `1.5px solid ${C.borderMed}`, borderLeft: `5px solid ${C.m700}`, borderRadius: 4, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Total Incidents</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>
            {loading ? '...' : (summary?.total ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>School-wide database total</div>
        </div>

        <div style={{ background: '#fff', border: `1.5px solid ${C.borderMed}`, borderLeft: `5px solid ${C.red}`, borderRadius: 4, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Reported</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.red, fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>
            {loading ? '...' : (summary?.reported ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>Initial intake status</div>
        </div>

        <div style={{ background: '#fff', border: `1.5px solid ${C.borderMed}`, borderLeft: `5px solid ${C.blue}`, borderRadius: 4, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Under Investigation</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.blue, fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>
            {loading ? '...' : (summary?.underInvestigation ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>Active Guidance inquiry</div>
        </div>

        <div style={{ background: '#fff', border: `1.5px solid ${C.borderMed}`, borderLeft: `5px solid ${C.green}`, borderRadius: 4, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Resolved Cases</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.green, fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>
            {loading ? '...' : (summary?.resolved ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>Concluded incidents</div>
        </div>

        <div style={{ background: '#fff', border: `1.5px solid ${C.borderMed}`, borderLeft: `5px solid ${C.t2}`, borderRadius: 4, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Students Involved</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>
            {loading ? '...' : (summary?.studentsCount ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>Distinct individuals logged</div>
        </div>
      </div>

      {/* Filter Toolbar (Applied to Recent Incident View) */}
      <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} color={C.t3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search recent incidents by student, type, note, or reporter..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              border: `1px solid ${C.borderMed}`,
              borderRadius: 4,
              fontSize: 12,
              outline: 'none',
              color: C.t1,
              boxSizing: 'border-box'
            }}
          />
        </div>

        {availableTypes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.t3 }}>Type:</label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              style={{ padding: '8px 10px', fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 4, background: '#fff', color: C.t1, outline: 'none' }}
            >
              <option value="all">All Incident Types</option>
              {availableTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        {availableStatuses.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.t3 }}>Status:</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              style={{ padding: '8px 10px', fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 4, background: '#fff', color: C.t1, outline: 'none' }}
            >
              <option value="all">All Statuses</option>
              {availableStatuses.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.t3 }}>Sort:</label>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as 'desc' | 'asc')}
            style={{ padding: '8px 10px', fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 4, background: '#fff', color: C.t1, outline: 'none' }}
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>

        {(search || selectedType !== 'all' || selectedStatus !== 'all' || sortOrder !== 'desc') && (
          <button
            onClick={resetFilters}
            style={{
              padding: '6px 12px',
              background: C.m50,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              color: C.m700,
              cursor: 'pointer'
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Section Title & Description */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.t1, margin: 0 }}>Recent Behavioral Incidents</h2>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
            Displaying the latest recorded incidents (up to 100). Search and filters operate within this recent incident view.
          </div>
        </div>
      </div>

      {/* Content Area: Table / Loading / Error / Empty States */}
      {loading ? (
        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: 48, textAlign: 'center' }}>
          <Clock size={28} color={C.m700} style={{ animation: 'spin 1.5s linear infinite', marginBottom: 12 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>Loading behavioral records & metrics...</div>
        </div>
      ) : error ? (
        <div style={{ background: '#fff', border: `1px solid ${C.red}`, borderRadius: 6, padding: 36, textAlign: 'center' }}>
          <AlertTriangle size={32} color={C.red} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Failed to load behavioral records</div>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 16 }}>Please verify your network connectivity or database service.</div>
          <button
            onClick={fetchData}
            style={{ padding: '8px 18px', background: C.m700, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      ) : (summary?.total ?? 0) === 0 && logs.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: C.m50, border: `1.5px solid ${C.borderMed}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: C.m700 }}>
            <ShieldAlert size={28} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", marginBottom: 6 }}>
            No Behavioral Incident Records in Database
          </div>
          <div style={{ fontSize: 12, color: C.t3, maxWidth: 440, margin: '0 auto', lineHeight: 1.5 }}>
            No student behavioral logs or disciplinary incident records currently exist in the school database. When faculty or Guidance Counselors submit incident reports, they will be aggregated here for administrative review.
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: '40px 24px', textAlign: 'center' }}>
          <Filter size={28} color={C.t3} style={{ marginBottom: 10, opacity: 0.6 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>No Matching Records</div>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 14 }}>No behavioral logs match your active filter criteria within the recent incidents list.</div>
          <button
            onClick={resetFilters}
            style={{ padding: '6px 14px', background: C.m50, color: C.m700, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 6, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <PTableHeader cols={['Date', 'Student Name', 'Incident Type', 'Reported By', 'Status', 'Action']} />
            </thead>
            <tbody>
              {filteredLogs.map((log, idx) => {
                const statusStyle = getStatusColor(log.status);
                const formattedDate = log.date ? new Date(log.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

                return (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: `1px solid ${C.borderLight}`,
                      background: idx % 2 === 0 ? '#fff' : C.ledger,
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.m50}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : C.ledger}
                  >
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.t2, whiteSpace: 'nowrap' }}>
                      {formattedDate}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>
                        {log.studentName || 'Student ID: ' + log.student_id}
                      </div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                        Ref: {log.student_id ? log.student_id.substring(0, 8) + '...' : 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 4, background: C.m100, color: C.m700, fontSize: 11, fontWeight: 700 }}>
                        <AlertTriangle size={12} />
                        {log.type}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.t2 }}>
                      {log.reporter_name || 'Staff / Faculty'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: statusStyle.color,
                          background: statusStyle.bg
                        }}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                      <button
                        onClick={() => setSelectedLog(log)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          background: '#fff',
                          border: `1px solid ${C.borderMed}`,
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.m700,
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', background: C.paper, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.t3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Showing {filteredLogs.length} of {logs.length} recent record(s)</span>
            <span>Total Recorded in Database: {summary?.total ?? 0}</span>
          </div>
        </div>
      )}

      {/* Read-Only Slide-Over Detail Drawer */}
      {selectedLog && (
        <>
          <div
            onClick={() => setSelectedLog(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(10,5,5,0.45)' }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 401,
              width: 460,
              maxWidth: '90vw',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
              overflow: 'hidden'
            }}
          >
            {/* Drawer Header */}
            <div style={{ background: C.m800, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>
                  Incident Report Details
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                  Ref ID: {selectedLog.id}
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Notice Banner */}
              <div style={{ padding: '10px 14px', background: C.m50, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, color: C.m700, lineHeight: 1.5 }}>
                <strong>Administrative Oversight:</strong> This record is displayed in read-only mode. Case investigation, counseling notes, and status updates are strictly governed by the Guidance & Counseling Office.
              </div>

              {/* Incident Details Card */}
              <div style={{ background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Student</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginTop: 2 }}>
                      {selectedLog.studentName || selectedLog.student_id}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Incident Type</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginTop: 2 }}>
                      {selectedLog.type}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date of Incident</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginTop: 2 }}>
                      {selectedLog.date ? new Date(selectedLog.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</div>
                    <div style={{ marginTop: 2 }}>
                      {(() => {
                        const st = getStatusColor(selectedLog.status);
                        return (
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: st.color, background: st.bg }}>
                            {selectedLog.status}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reported By</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginTop: 2 }}>
                    {selectedLog.reporter_name || 'Staff / Faculty'}
                  </div>
                  {selectedLog.reporter?.email && (
                    <div style={{ fontSize: 11, color: C.t3 }}>
                      {selectedLog.reporter.email}
                    </div>
                  )}
                </div>
              </div>

              {/* Narrative / Incident Notes */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} color={C.m700} /> Incident Narrative & Remarks
                </div>
                <div
                  style={{
                    padding: '14px',
                    background: '#fff',
                    border: `1px solid ${C.borderMed}`,
                    borderRadius: 4,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: selectedLog.note ? C.t1 : C.t3,
                    fontStyle: selectedLog.note ? 'normal' : 'italic',
                    minHeight: 100,
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {selectedLog.note || 'No narrative notes or descriptive remarks were recorded for this incident.'}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div style={{ padding: '14px 24px', background: C.paper, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  padding: '8px 18px',
                  background: '#fff',
                  border: `1px solid ${C.borderMed}`,
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.t1,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
