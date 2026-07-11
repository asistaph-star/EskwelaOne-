import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Plus, X, ChevronDown, FileText, CheckCircle, XCircle, Clock, Calendar, Briefcase, Heart, Baby } from 'lucide-react';

/* ── Shared Stamp ── */
function Stamp({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, background: bg }}>
      {label}
    </span>
  );
}

/* ── Types ── */
interface LeaveRecord {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedOn: string;
  approverNote?: string;
}

/* ── Seed data ── */
const INITIAL_LEAVES: LeaveRecord[] = [
  { id: 1, type: 'Vacation Leave', startDate: '2025-02-14', endDate: '2025-02-14', days: 1, reason: 'Personal errands', status: 'Approved', submittedOn: 'Feb 01, 2025', approverNote: 'Noted. Enjoy your day.' },
  { id: 2, type: 'Sick Leave', startDate: '2025-06-12', endDate: '2025-06-13', days: 2, reason: 'Fever and body aches', status: 'Pending', submittedOn: 'Jun 11, 2025' },
  { id: 3, type: 'Emergency Leave', startDate: '2025-04-03', endDate: '2025-04-03', days: 1, reason: 'Family emergency', status: 'Approved', submittedOn: 'Apr 03, 2025', approverNote: 'Approved. Hope everything is okay.' },
  { id: 4, type: 'Sick Leave', startDate: '2025-01-20', endDate: '2025-01-20', days: 1, reason: 'Medical check-up', status: 'Rejected', submittedOn: 'Jan 18, 2025', approverNote: 'No substitute available. Please reschedule.' },
];

const LEAVE_TYPES = ['Sick Leave', 'Vacation Leave', 'Emergency Leave', 'Maternity / Paternity Leave', 'Service Incentive Leave'];

const BALANCE = [
  { type: 'Sick Leave',       icon: Heart,    total: 15, used: 3,  color: C.red,   bg: C.redBg },
  { type: 'Vacation Leave',   icon: Briefcase, total: 15, used: 1, color: C.m700,  bg: C.m100 },
  { type: 'Emergency Leave',  icon: Clock,    total: 5,  used: 1,  color: C.amber, bg: C.amberBg },
  { type: 'Special Privilege',icon: Calendar, total: 3,  used: 0,  color: '#6366f1', bg: '#ede9fe' },
];

function statusColor(s: LeaveRecord['status']) {
  if (s === 'Approved') return { color: C.green, bg: C.greenBg };
  if (s === 'Rejected') return { color: C.red, bg: C.redBg };
  return { color: C.amber, bg: C.amberBg };
}

function StatusIcon({ status }: { status: LeaveRecord['status'] }) {
  if (status === 'Approved') return <CheckCircle size={13} color={C.green} />;
  if (status === 'Rejected') return <XCircle size={13} color={C.red} />;
  return <Clock size={13} color={C.amber} />;
}

function fmt(d: string) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TLeaveScreen() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>(INITIAL_LEAVES);
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [detail, setDetail] = useState<LeaveRecord | null>(null);
  const [nextId, setNextId] = useState(5);

  /* Form state */
  const [fType, setFType] = useState(LEAVE_TYPES[0]);
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fReason, setFReason] = useState('');

  const calcDays = () => {
    if (!fStart || !fEnd) return 0;
    const diff = (new Date(fEnd).getTime() - new Date(fStart).getTime()) / 86400000;
    return Math.max(0, Math.round(diff) + 1);
  };

  const handleSubmit = () => {
    if (!fStart || !fEnd || !fReason.trim()) return;
    const rec: LeaveRecord = {
      id: nextId,
      type: fType,
      startDate: fStart,
      endDate: fEnd,
      days: calcDays(),
      reason: fReason,
      status: 'Pending',
      submittedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
    setLeaves(p => [rec, ...p]);
    setNextId(n => n + 1);
    setFType(LEAVE_TYPES[0]); setFStart(''); setFEnd(''); setFReason('');
    setModal(false);
  };

  const filtered = filter === 'All' ? leaves : leaves.filter(l => l.status === filter);

  const inputStyle: React.CSSProperties = {
    width: '100%', border: `1px solid ${C.borderMed}`, borderRadius: 4,
    padding: '8px 10px', fontSize: 12, color: C.t1, background: '#fff',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'transparent', padding: 24 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>My Leave Requests</h2>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Submit and track your leave of absence requests · SY 2025–2026</div>
        </div>
        <button onClick={() => setModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.m700, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${C.m700}40` }}>
          <Plus size={14} /> Request Leave
        </button>
      </div>

      {/* ── Leave Balance Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {BALANCE.map(b => {
          const Icon = b.icon;
          const remaining = b.total - b.used;
          const pct = Math.round((remaining / b.total) * 100);
          return (
            <div key={b.type} style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: '14px 16px', borderTop: `3px solid ${b.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{b.type}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: b.color, lineHeight: 1 }}>{remaining}</div>
                  <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>of {b.total} days remaining</div>
                </div>
                <div style={{ background: b.bg, width: 32, height: 32, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color={b.color} />
                </div>
              </div>
              <div style={{ background: C.border, borderRadius: 6, height: 5, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: b.color, borderRadius: 6, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 9, color: C.t3 }}>Used: {b.used}</span>
                <span style={{ fontSize: 9, color: b.color, fontWeight: 700 }}>{pct}% left</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Filter Bar + Table ── */}
      <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: 'hidden' }}>
        {/* Filter tabs */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Request History</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['All','Pending','Approved','Rejected'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: filter === f ? `1.5px solid ${C.m700}` : `1px solid ${C.borderMed}`, background: filter === f ? C.m700 : '#fff', color: filter === f ? '#fff' : C.t2, transition: 'all 0.12s' }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.t3, fontSize: 13 }}>No {filter.toLowerCase()} leave requests.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
                {['Submitted', 'Leave Type', 'Date Range', 'Days', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const { color, bg } = statusColor(l.status);
                return (
                  <tr key={l.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.m50}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: C.t3 }}>{l.submittedOn}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: C.t1 }}>{l.type}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: C.t2, fontFamily: "'JetBrains Mono',monospace" }}>
                      {fmt(l.startDate)}{l.startDate !== l.endDate ? ` – ${fmt(l.endDate)}` : ''}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: C.t1, textAlign: 'center' }}>{l.days}d</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <StatusIcon status={l.status} />
                        <Stamp label={l.status} color={color} bg={bg} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => setDetail(l)}
                        style={{ fontSize: 10, fontWeight: 600, color: C.m700, background: C.m100, border: `1px solid ${C.m700}20`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Submit Modal ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(10,4,4,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 24px 64px rgba(74,10,16,0.35)' }}>
            <div style={{ background: C.m800, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>New Request</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Fraunces',serif" }}>Submit Leave of Absence</div>
              </div>
              <button onClick={() => setModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Leave Type</label>
                <div style={{ position: 'relative' }}>
                  <select value={fType} onChange={e => setFType(e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: 28 }}>
                    {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={12} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: C.t3, pointerEvents: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Start Date</label>
                  <input type="date" value={fStart} onChange={e => setFStart(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>End Date</label>
                  <input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} min={fStart} style={inputStyle} />
                </div>
              </div>
              {fStart && fEnd && (
                <div style={{ background: C.m50, border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: '8px 12px', fontSize: 11, color: C.m700, fontWeight: 600 }}>
                  📅 {calcDays()} working day{calcDays() !== 1 ? 's' : ''} will be deducted from your leave balance.
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Reason / Remarks</label>
                <textarea rows={3} value={fReason} onChange={e => setFReason(e.target.value)} placeholder="Brief description of your leave reason..."
                  style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 4, padding: '8px 12px', fontSize: 10, color: '#92400e' }}>
                <strong>Note:</strong> Attach supporting documents (medical certificate, etc.) to your HR office separately. This form is for official recording only.
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 18px', background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, fontWeight: 500, color: C.t2, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmit}
                disabled={!fStart || !fEnd || !fReason.trim()}
                style={{ padding: '8px 22px', background: (!fStart || !fEnd || !fReason.trim()) ? C.t3 : C.m700, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: (!fStart || !fEnd || !fReason.trim()) ? 'not-allowed' : 'pointer' }}>
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(10,4,4,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 24px 64px rgba(74,10,16,0.35)' }}>
            <div style={{ background: C.m800, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Leave Request Detail</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Fraunces',serif" }}>{detail.type}</div>
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Date Range', `${fmt(detail.startDate)}${detail.startDate !== detail.endDate ? ` – ${fmt(detail.endDate)}` : ''}`],
                ['Days', `${detail.days} day${detail.days !== 1 ? 's' : ''}`],
                ['Submitted On', detail.submittedOn],
                ['Reason', detail.reason],
              ].map(([label, val]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                  <span style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 12, color: C.t1, fontWeight: 500, maxWidth: 220, textAlign: 'right' }}>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>Status</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <StatusIcon status={detail.status} />
                  <Stamp label={detail.status} {...statusColor(detail.status)} />
                </div>
              </div>
              {detail.approverNote && (
                <div style={{ background: detail.status === 'Approved' ? C.greenBg : detail.status === 'Rejected' ? C.redBg : C.amberBg, border: `1px solid ${detail.status === 'Approved' ? 'rgba(22,101,52,0.2)' : detail.status === 'Rejected' ? 'rgba(185,28,28,0.2)' : 'rgba(217,119,6,0.2)'}`, borderRadius: 4, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: detail.status === 'Approved' ? C.green : detail.status === 'Rejected' ? C.red : C.amber, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Approver's Note</div>
                  <div style={{ fontSize: 12, color: C.t1 }}>{detail.approverNote}</div>
                </div>
              )}
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDetail(null)} style={{ padding: '8px 22px', background: C.m700, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
