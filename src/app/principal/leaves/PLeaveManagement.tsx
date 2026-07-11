import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { CheckCircle, XCircle, Clock, Search, ChevronDown, X, MessageSquare, ClipboardList } from 'lucide-react';

/* ── Stamp ── */
function Stamp({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, background: bg }}>
      {label}
    </span>
  );
}

/* ── Types ── */
type LStatus = 'Pending' | 'Approved' | 'Rejected';

interface LeaveRequest {
  id: number;
  teacher: string;
  position: string;
  section: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  submittedOn: string;
  status: LStatus;
  approverNote?: string;
}

/* ── Seed data ── */
const SEED_REQUESTS: LeaveRequest[] = [
  { id: 1, teacher: 'Navarro, Pedro M.',  position: 'Master Teacher II', section: '7 Makulay', type: 'Vacation Leave',   startDate: '2026-07-11', endDate: '2026-07-11', days: 1, reason: 'Family occasion out of town', submittedOn: 'Jul 09, 2026', status: 'Pending' },
  { id: 2, teacher: 'Batac, Lara B.',     position: 'Teacher III',       section: '7 Masaya',  type: 'Sick Leave',        startDate: '2026-07-14', endDate: '2026-07-15', days: 2, reason: 'Hypertension and dizziness', submittedOn: 'Jul 10, 2026', status: 'Pending' },
  { id: 3, teacher: 'Soriano, Ana R.',    position: 'Teacher I',         section: '8 Rizal',   type: 'Sick Leave',        startDate: '2026-06-25', endDate: '2026-06-25', days: 1, reason: 'Medical check-up', submittedOn: 'Jun 24, 2026', status: 'Approved', approverNote: 'Approved. Please submit medical certificate upon return.' },
  { id: 4, teacher: 'Santiago, Ramon F.', position: 'Teacher III',       section: '9 Einstein',type: 'Emergency Leave',   startDate: '2026-06-20', endDate: '2026-06-20', days: 1, reason: 'Family emergency', submittedOn: 'Jun 20, 2026', status: 'Approved', approverNote: 'Approved. Hope all is well.' },
  { id: 5, teacher: 'Reyes, Maria C.',    position: 'Teacher II',        section: '9 Newton',  type: 'Vacation Leave',    startDate: '2026-06-10', endDate: '2026-06-11', days: 2, reason: 'Province trip', submittedOn: 'Jun 05, 2026', status: 'Rejected', approverNote: 'Examination week. No substitution available.' },
  { id: 6, teacher: 'Dela Cruz, Cynthia', position: 'Master Teacher I',  section: '10 Pilot',  type: 'Sick Leave',        startDate: '2026-07-03', endDate: '2026-07-04', days: 2, reason: 'Flu symptoms', submittedOn: 'Jul 02, 2026', status: 'Approved', approverNote: 'Approved. Get well soon.' },
  { id: 7, teacher: 'Panlilio, Jose L.',  position: 'Teacher II',        section: '8 Aguinaldo', type: 'Maternity / Paternity Leave', startDate: '2026-08-01', endDate: '2026-09-30', days: 60, reason: 'Paternity leave filing', submittedOn: 'Jul 08, 2026', status: 'Pending' },
];

function statusStyle(s: LStatus) {
  if (s === 'Approved') return { color: C.green, bg: C.greenBg };
  if (s === 'Rejected') return { color: C.red, bg: C.redBg };
  return { color: C.amber, bg: C.amberBg };
}

function StatusIcon({ status }: { status: LStatus }) {
  if (status === 'Approved') return <CheckCircle size={13} color={C.green} />;
  if (status === 'Rejected') return <XCircle size={13} color={C.red} />;
  return <Clock size={13} color={C.amber} />;
}

function fmt(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PLeaveManagement() {
  const [requests, setRequests] = useState<LeaveRequest[]>(SEED_REQUESTS);
  const [filter, setFilter] = useState<'All' | LStatus>('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [rejectModal, setRejectModal] = useState<LeaveRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [detail, setDetail] = useState<LeaveRequest | null>(null);

  /* Summary counts */
  const pending = requests.filter(r => r.status === 'Pending').length;
  const approvedMonth = requests.filter(r => r.status === 'Approved').length;
  const totalDays = requests.filter(r => r.status === 'Approved').reduce((s, r) => s + r.days, 0);

  /* Actions */
  const approve = (id: number) => {
    setRequests(p => p.map(r => r.id === id ? { ...r, status: 'Approved', approverNote: 'Approved by the School Head.' } : r));
  };
  const reject = (id: number, note: string) => {
    setRequests(p => p.map(r => r.id === id ? { ...r, status: 'Rejected', approverNote: note || 'Rejected by the School Head.' } : r));
    setRejectModal(null);
    setRejectNote('');
  };

  const LEAVE_TYPES = ['All', 'Sick Leave', 'Vacation Leave', 'Emergency Leave', 'Maternity / Paternity Leave', 'Service Incentive Leave'];

  const visible = requests.filter(r => {
    if (filter !== 'All' && r.status !== filter) return false;
    if (typeFilter !== 'All' && r.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!r.teacher.toLowerCase().includes(q) && !r.type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: '7px 10px',
    fontSize: 12, color: C.t1, background: '#fff', outline: 'none',
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'transparent', padding: 24 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <ClipboardList size={20} color={C.m700} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>Leave Management</h2>
        </div>
        <div style={{ fontSize: 12, color: C.t3 }}>Review and act on teacher leave of absence requests · SY 2025–2026</div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Pending Requests', value: pending, sub: 'Awaiting your action', color: C.amber, bg: C.amberBg, icon: Clock },
          { label: 'Approved This Year', value: approvedMonth, sub: 'Leave requests granted', color: C.green, bg: C.greenBg, icon: CheckCircle },
          { label: 'Total Leave Days Granted', value: `${totalDays}d`, sub: 'Across all approved requests', color: C.m700, bg: C.m100, icon: ClipboardList },
        ].map(({ label, value, sub, color, bg, icon: Icon }) => (
          <div key={label} style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderLeft: `4px solid ${color}`, borderRadius: 4, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: bg, width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter / Search Bar ── */}
      <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Status pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['All','Pending','Approved','Rejected'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: filter === f ? `1.5px solid ${C.m700}` : `1px solid ${C.borderMed}`, background: filter === f ? C.m700 : '#fff', color: filter === f ? '#fff' : C.t2, transition: 'all 0.12s' }}>
                {f}{f === 'Pending' && pending > 0 ? ` (${pending})` : ''}
              </button>
            ))}
          </div>

          {/* Leave type */}
          <div style={{ position: 'relative' }}>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inputStyle, paddingRight: 24, appearance: 'none', fontSize: 11 }}>
              {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: C.t3, pointerEvents: 'none' }} />
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.t3 }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teacher name..."
              style={{ ...inputStyle, paddingLeft: 28, width: '100%', boxSizing: 'border-box', fontSize: 11 }} />
          </div>

          <span style={{ fontSize: 11, color: C.t3, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {visible.length} of {requests.length} requests
          </span>
        </div>

        {/* ── Table ── */}
        {visible.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.t3, fontSize: 13 }}>No matching requests found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
                {['Teacher', 'Leave Type', 'Date Range', 'Days', 'Submitted', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const { color, bg } = statusStyle(r.status);
                return (
                  <tr key={r.id} style={{ borderBottom: i < visible.length - 1 ? `1px solid ${C.border}` : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{r.teacher}</div>
                      <div style={{ fontSize: 10, color: C.t3 }}>{r.position} · {r.section}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.t2 }}>{r.type}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: C.t2, fontFamily: "'JetBrains Mono',monospace" }}>
                      {fmt(r.startDate)}{r.startDate !== r.endDate ? <><br /><span style={{ color: C.t3 }}>→ {fmt(r.endDate)}</span></> : ''}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.t1, textAlign: 'center' }}>{r.days}d</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: C.t3 }}>{r.submittedOn}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <StatusIcon status={r.status} />
                        <Stamp label={r.status} color={color} bg={bg} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => setDetail(r)}
                          style={{ fontSize: 10, fontWeight: 600, color: C.m700, background: C.m100, border: `1px solid ${C.m700}20`, borderRadius: 4, padding: '4px 9px', cursor: 'pointer' }}>
                          View
                        </button>
                        {r.status === 'Pending' && (<>
                          <button onClick={() => approve(r.id)}
                            style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: C.green, border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
                            ✓ Approve
                          </button>
                          <button onClick={() => { setRejectModal(r); setRejectNote(''); }}
                            style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: C.red, border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
                            ✕ Reject
                          </button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(10,4,4,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setRejectModal(null); }}>
          <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 24px 64px rgba(74,10,16,0.35)' }}>
            <div style={{ background: '#7f1d1d', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Leave Request</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Fraunces',serif" }}>Reject: {rejectModal.teacher}</div>
              </div>
              <button onClick={() => setRejectModal(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ background: C.redBg, border: `1px solid rgba(185,28,28,0.15)`, borderRadius: 4, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{rejectModal.type} · {rejectModal.days} day{rejectModal.days !== 1 ? 's' : ''}</div>
                <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{fmt(rejectModal.startDate)}{rejectModal.startDate !== rejectModal.endDate ? ` – ${fmt(rejectModal.endDate)}` : ''}</div>
              </div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                <MessageSquare size={10} style={{ marginRight: 4 }} />Reason for Rejection (optional)
              </label>
              <textarea rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                placeholder="e.g. No substitute available during examination week..."
                style={{ width: '100%', border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: '8px 10px', fontSize: 12, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: C.t1 }} />
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectModal(null)} style={{ padding: '8px 18px', background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, fontWeight: 500, color: C.t2, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => reject(rejectModal.id, rejectNote)}
                style={{ padding: '8px 22px', background: C.red, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(10,4,4,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 430, overflow: 'hidden', boxShadow: '0 24px 64px rgba(74,10,16,0.35)' }}>
            <div style={{ background: C.m800, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Leave Request Detail</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Fraunces',serif" }}>{detail.teacher}</div>
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Position', `${detail.position} · ${detail.section}`],
                ['Leave Type', detail.type],
                ['Date Range', `${fmt(detail.startDate)}${detail.startDate !== detail.endDate ? ` – ${fmt(detail.endDate)}` : ''}`],
                ['Duration', `${detail.days} day${detail.days !== 1 ? 's' : ''}`],
                ['Submitted On', detail.submittedOn],
                ['Reason', detail.reason],
              ].map(([label, val]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                  <span style={{ fontSize: 11, color: C.t3, fontWeight: 600, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 12, color: C.t1, maxWidth: 240, textAlign: 'right' }}>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                <span style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>Status</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <StatusIcon status={detail.status} />
                  <Stamp label={detail.status} {...statusStyle(detail.status)} />
                </div>
              </div>
              {detail.approverNote && (
                <div style={{ background: detail.status === 'Approved' ? C.greenBg : C.redBg, border: `1px solid ${detail.status === 'Approved' ? 'rgba(22,101,52,0.2)' : 'rgba(185,28,28,0.2)'}`, borderRadius: 4, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: detail.status === 'Approved' ? C.green : C.red, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Approver's Note</div>
                  <div style={{ fontSize: 12, color: C.t1 }}>{detail.approverNote}</div>
                </div>
              )}
              {detail.status === 'Pending' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => { approve(detail.id); setDetail({ ...detail, status: 'Approved', approverNote: 'Approved by the School Head.' }); }}
                    style={{ flex: 1, padding: '9px', background: C.green, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => { setDetail(null); setRejectModal(detail); setRejectNote(''); }}
                    style={{ flex: 1, padding: '9px', background: C.red, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ✕ Reject
                  </button>
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
