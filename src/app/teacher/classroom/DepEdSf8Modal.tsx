import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../shared/constants/tokens';
import { X, Printer, Download, Heart, Shield, RefreshCw, AlertCircle, FileSpreadsheet, CheckCircle, FileText } from 'lucide-react';
import { apiClient, API_BASE_URL } from '../../../api/client';

interface DepEdSf8ModalProps {
  sectionId: string;
  grade: number | string;
  section: string;
  onClose: () => void;
}

export function DepEdSf8Modal({ sectionId, grade, section, onClose }: DepEdSf8ModalProps) {
  const [period, setPeriod] = useState<'BOSY' | 'EOSY' | 'ALL'>('BOSY');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await apiClient.get(`/academic/health/sf8/sections/${sectionId}?period=${period}`);
      setReport(res?.data || res);
    } catch (err: any) {
      console.error('Failed to load SF8 report:', err);
      setError(err.message || 'Failed to generate official DepEd SF8 report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [sectionId, period]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportXlsx = async () => {
    setIsExportingXlsx(true);
    try {
      const response = await fetch(`${API_BASE_URL}/academic/health/sf8/sections/${sectionId}/export?period=${period}&format=xlsx`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to export SF8 Excel workbook');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition');
      let filename = `DepEd_SF8_Grade${grade}_${section}_${period}.xlsx`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="?([^"]+)"?/.exec(disposition);
        if (matches && matches[1]) filename = matches[1];
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error downloading SF8 Excel:', err);
      alert('Failed to download SF8 Excel workbook: ' + err.message);
    } finally {
      setIsExportingXlsx(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const response = await fetch(`${API_BASE_URL}/academic/health/sf8/sections/${sectionId}/export?period=${period}&format=pdf`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to export SF8 PDF document');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition');
      let filename = `DepEd_SF8_Grade${grade}_${section}_${period}.pdf`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="?([^"]+)"?/.exec(disposition);
        if (matches && matches[1]) filename = matches[1];
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error downloading SF8 PDF:', err);
      alert('Failed to download SF8 PDF document: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/academic/health/sf8/sections/${sectionId}/export?period=${period}&format=csv`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to export SF8 CSV');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition');
      let filename = `DepEd_SF8_Grade${grade}_${section}_${period}.csv`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="?([^"]+)"?/.exec(disposition);
        if (matches && matches[1]) filename = matches[1];
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error downloading SF8 CSV:', err);
      alert('Failed to download SF8 CSV: ' + err.message);
    }
  };

  const renderLearnerTable = (learners: any[], title: string, gender: string, assessedCount: number, unassessedCount: number) => (
    <div style={{ marginBottom: 16 }}>
      <div 
        className={`sf8-gender-banner ${gender === 'Male' ? 'sf8-gender-banner-male' : 'sf8-gender-banner-female'}`}
        style={{
          background: gender === 'Male' ? '#1e3a8a' : '#831843',
          color: '#fff',
          padding: '6px 12px',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          borderRadius: '4px 4px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>{title} ({learners.length} Enrolled | {assessedCount} Assessed | {unassessedCount} Pending)</span>
        <span style={{ fontSize: 9, opacity: 0.85 }}>DepEd DO 058, s. 2017 Format</span>
      </div>

      <table className="sf8-official-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, background: '#fff', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
            <th style={{ padding: '5px 2px', border: '1px solid #cbd5e1', width: '3%', textAlign: 'center' }}>#</th>
            <th style={{ padding: '5px 4px', border: '1px solid #cbd5e1', width: '11%', textAlign: 'left' }}>LRN</th>
            <th style={{ padding: '5px 6px', border: '1px solid #cbd5e1', width: '22%', textAlign: 'left' }}>LEARNER'S NAME (Last, First, Middle)</th>
            <th style={{ padding: '5px 4px', border: '1px solid #cbd5e1', width: '9%', textAlign: 'center' }}>BIRTHDATE</th>
            <th style={{ padding: '5px 4px', border: '1px solid #cbd5e1', width: '6%', textAlign: 'center' }}>AGE</th>
            <th style={{ padding: '5px 4px', border: '1px solid #cbd5e1', width: '5%', textAlign: 'center' }}>WT (kg)</th>
            <th style={{ padding: '5px 4px', border: '1px solid #cbd5e1', width: '5%', textAlign: 'center' }}>HT (m)</th>
            <th style={{ padding: '5px 4px', border: '1px solid #cbd5e1', width: '6%', textAlign: 'center' }}>HT² (m²)</th>
            <th style={{ padding: '5px 4px', border: '1px solid #cbd5e1', width: '5%', textAlign: 'center' }}>BMI</th>
            <th style={{ padding: '5px 4px', border: '1px solid #cbd5e1', width: '9%', textAlign: 'center' }}>BMI STATUS</th>
            <th style={{ padding: '5px 4px', border: '1px solid #cbd5e1', width: '9%', textAlign: 'center' }}>HFA STATUS</th>
            <th style={{ padding: '5px 6px', border: '1px solid #cbd5e1', width: '10%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {learners.length === 0 ? (
            <tr>
              <td colSpan={12} style={{ padding: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}>
                No learners found in this category.
              </td>
            </tr>
          ) : (
            learners.map((l, idx) => {
              const m = period === 'EOSY' ? (l.eosy || l.bosy) : l.bosy;
              const hasMetric = Boolean(m);

              const bmiColor = 
                m?.nutritionalStatusBmi === 'Normal' ? '#166534' :
                m?.nutritionalStatusBmi === 'Overweight' ? '#854d0e' :
                m?.nutritionalStatusBmi === 'Obese' ? '#991b1b' :
                m?.nutritionalStatusBmi === 'Wasted' ? '#c2410c' :
                m?.nutritionalStatusBmi === 'Severely Wasted' ? '#991b1b' : '#64748b';

              const hfaColor = 
                m?.heightForAgeStatus === 'Normal' ? '#166534' :
                m?.heightForAgeStatus === 'Tall' ? '#1e40af' :
                m?.heightForAgeStatus === 'Stunted' ? '#c2410c' :
                m?.heightForAgeStatus === 'Severely Stunted' ? '#991b1b' : '#64748b';

              const htSquared = m?.heightSquaredM2 ?? (m?.heightM ? Number((m.heightM * m.heightM).toFixed(2)) : null);

              return (
                <tr key={l.studentId || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '5px 4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600 }}>{l.rowNumber}</td>
                  <td style={{ padding: '5px 4px', border: '1px solid #cbd5e1', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{l.lrn}</td>
                  <td style={{ padding: '5px 6px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#0f172a' }}>
                    {l.lastName}, {l.firstName} {l.middleName ? `${l.middleName[0]}.` : ''} {l.suffix || ''}
                  </td>
                  <td style={{ padding: '5px 4px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                    {l.birthDate || '—'}
                  </td>
                  <td style={{ padding: '5px 4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600 }}>
                    {hasMetric
                      ? String(m.ageYears)
                      : (l.unassessedAge ? String(l.unassessedAge.years) : '—')}
                  </td>
                  <td style={{ padding: '5px 4px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    {hasMetric ? m.weightKg.toFixed(1) : '—'}
                  </td>
                  <td style={{ padding: '5px 4px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    {hasMetric ? m.heightM.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '5px 4px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    {hasMetric && htSquared ? htSquared.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '5px 4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    {hasMetric ? m.bmi.toFixed(1) : '—'}
                  </td>
                  <td style={{ padding: '5px 6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, color: bmiColor }}>
                    {hasMetric ? m.nutritionalStatusBmi : <span style={{ color: '#b45309', fontWeight: 600 }}>Unassessed</span>}
                  </td>
                  <td style={{ padding: '5px 6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, color: hfaColor }}>
                    {hasMetric ? m.heightForAgeStatus : <span style={{ color: '#b45309', fontWeight: 600 }}>Unassessed</span>}
                  </td>
                  <td style={{ padding: '5px 6px', border: '1px solid #cbd5e1', fontSize: 9, color: hasMetric ? '#475569' : '#94a3b8' }}>
                    {hasMetric ? (m.remarks || 'Baseline Screened') : 'Unmeasured'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{`
        @page {
          size: landscape;
          margin: 8mm 10mm;
        }

        @media screen {
          .sf8-print-only {
            display: none !important;
          }
        }

        @media print {
          /* 1. Reset everything & force exact color rendering */
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          /* 2. Completely remove screen application root and non-print UI */
          #root,
          .sf8-screen-only,
          .sf8-modal-header,
          .sf8-no-print {
            display: none !important;
            visibility: hidden !important;
          }

          /* 3. Configure html & body for direct unclipped page flow */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
          }

          /* 4. Unconstrain modal overlay and containers */
          #deped-sf8-modal-overlay,
          .sf8-modal-overlay,
          .sf8-modal-container,
          .sf8-scroll-body {
            position: static !important;
            inset: auto !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }

          /* 5. Display the official print document */
          #sf8-official-print-document {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
            color: #000000 !important;
          }

          /* 5. Document Header */
          .sf8-print-header {
            text-align: center !important;
            margin-bottom: 8px !important;
            border-bottom: 1.5px solid #000000 !important;
            padding-bottom: 6px !important;
          }

          .sf8-print-country {
            font-size: 8pt !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            color: #1e293b !important;
            margin-bottom: 2px !important;
          }

          .sf8-print-title {
            font-size: 13pt !important;
            font-weight: 900 !important;
            color: #000000 !important;
            margin: 2px 0 !important;
            letter-spacing: -0.01em !important;
          }

          .sf8-print-subtitle {
            font-size: 7.5pt !important;
            font-style: italic !important;
            color: #475569 !important;
          }

          .sf8-print-meta-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 4px 12px !important;
            margin-top: 6px !important;
            font-size: 8pt !important;
            text-align: left !important;
            background: #f8fafc !important;
            padding: 5px 8px !important;
            border: 1px solid #64748b !important;
            border-radius: 0 !important;
          }

          .sf8-print-completeness-bar {
            margin-top: 5px !important;
            background: #ffffff !important;
            border: 1px solid #64748b !important;
            padding: 3px 8px !important;
            display: flex !important;
            justifyContent: space-between !important;
            font-size: 7.5pt !important;
            font-weight: 700 !important;
          }

          /* 6. Official Table & Paged Media Pagination */
          .sf8-official-table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 7.5pt !important;
            margin-bottom: 10px !important;
            page-break-inside: auto !important;
          }

          .sf8-official-table thead {
            display: table-header-group !important; /* CRITICAL: repeats header on every page */
          }

          .sf8-official-table thead th {
            background-color: #0f172a !important;
            color: #ffffff !important;
            border: 1px solid #000000 !important;
            padding: 3px 2px !important;
            text-align: center !important;
            font-weight: 700 !important;
            font-size: 7pt !important;
            line-height: 1.15 !important;
          }

          .sf8-official-table tbody tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            height: 15px !important;
          }

          .sf8-official-table tbody td {
            border: 1px solid #475569 !important;
            padding: 2px 3px !important;
            color: #000000 !important;
            font-size: 7.5pt !important;
            vertical-align: middle !important;
          }

          .sf8-gender-banner {
            page-break-after: avoid !important;
            break-after: avoid !important;
            color: #ffffff !important;
            padding: 4px 8px !important;
            font-weight: 700 !important;
            font-size: 8pt !important;
            border: 1px solid #000000 !important;
            border-bottom: none !important;
            display: flex !important;
            justifyContent: space-between !important;
            align-items: center !important;
          }

          .sf8-gender-banner-male {
            background-color: #1e3a8a !important;
          }

          .sf8-gender-banner-female {
            background-color: #831843 !important;
          }

          /* 7. Summary & Accountability Avoid Break */
          .sf8-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 10px !important;
          }

          .sf8-summary-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 7.5pt !important;
          }

          .sf8-summary-table th, .sf8-summary-table td {
            border: 1px solid #475569 !important;
            padding: 2.5px 5px !important;
          }

          .sf8-signatures-grid {
            margin-top: 20px !important;
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 30px !important;
            font-size: 8pt !important;
            text-align: center !important;
          }

          .sf8-sig-line {
            border-bottom: 1px solid #000000 !important;
            padding-bottom: 4px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
          }

          .sf8-official-disclaimer {
            text-align: center !important;
            margin-top: 14px !important;
            font-size: 6.5pt !important;
            color: #64748b !important;
            font-style: italic !important;
          }
        }
      `}</style>

      <div 
        id="deped-sf8-modal-overlay"
        className="sf8-modal-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: 20
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div 
          className="sf8-modal-container"
          style={{
            background: '#fff',
            borderRadius: 12,
            width: '100%',
            maxWidth: 1240,
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}
        >
          {/* Top Header Controls */}
          <div 
            className="sf8-modal-header sf8-screen-only"
            style={{
              background: '#0f172a',
              color: '#fff',
              padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: '#e11d48',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Heart size={19} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
                DepEd School Form 8 (SF8) — Learner Basic Health and Nutrition Report
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Grade {grade} - {section} • Calulut Integrated School
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Period Switcher */}
            <div style={{ background: '#1e293b', borderRadius: 6, padding: 2, display: 'flex', marginRight: 4 }}>
              <button
                type="button"
                onClick={() => setPeriod('BOSY')}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: period === 'BOSY' ? '#e11d48' : 'transparent',
                  color: '#fff'
                }}
              >
                BOSY Baseline
              </button>
              <button
                type="button"
                onClick={() => setPeriod('EOSY')}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: period === 'EOSY' ? '#e11d48' : 'transparent',
                  color: '#fff'
                }}
              >
                EOSY Post-Assessment
              </button>
            </div>

            {/* Export Excel (.xlsx) Button */}
            <button
              id="btn-export-sf8-xlsx"
              type="button"
              onClick={handleExportXlsx}
              disabled={isExportingXlsx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 13px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(5,150,105,0.25)',
                transition: 'all 0.15s ease'
              }}
              title="Download official DepEd SF8 Excel (.xlsx) formatted workbook"
            >
              <FileSpreadsheet size={13} /> {isExportingXlsx ? 'Exporting...' : 'Export Excel (.xlsx)'}
            </button>

            {/* Export PDF Button */}
            <button
              id="btn-export-sf8-pdf"
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 13px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(220,38,38,0.25)',
                transition: 'all 0.15s ease'
              }}
              title="Download official DepEd SF8 printable PDF document"
            >
              <Download size={13} /> {isExportingPdf ? 'Generating...' : 'Export PDF'}
            </button>

            {/* Export CSV Button */}
            <button
              id="btn-export-sf8-csv"
              type="button"
              onClick={handleExportCsv}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 13px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(37,99,235,0.25)',
                transition: 'all 0.15s ease'
              }}
              title="Download official DepEd SF8 CSV formatted file"
            >
              <FileText size={13} /> CSV
            </button>

            {/* Print Window Button */}
            <button
              id="btn-print-sf8"
              type="button"
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#475569',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 13px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Open browser print preview"
            >
              <Printer size={13} /> Print
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                width: 32,
                height: 32,
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 4
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Report Body Container */}
        <div className="sf8-scroll-body" style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f8fafc' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} />
              <div>Generating official DepEd Form 8 Health and Nutrition Report...</div>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#dc2626' }}>
              <AlertCircle size={24} style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 700 }}>{error}</div>
            </div>
          ) : report ? (
            <div 
              id="sf8-official-print-document" 
              className="sf8-printable-area"
              style={{ 
                background: '#fff', 
                border: '1px solid #cbd5e1', 
                padding: '24px 32px', 
                borderRadius: 8, 
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' 
              }}
            >
              {/* Official DepEd Header */}
              <div className="sf8-print-header" style={{ textAlign: 'center', marginBottom: 20, borderBottom: '2px solid #0f172a', paddingBottom: 16 }}>
                <div className="sf8-print-country" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>Republic of the Philippines • Department of Education</div>
                <div className="sf8-print-title" style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 4, letterSpacing: '-0.01em' }}>
                  SCHOOL FORM 8 (SF8) — LEARNER BASIC HEALTH AND NUTRITION REPORT
                </div>
                <div className="sf8-print-subtitle" style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                  (Conforming to DepEd Order No. 058, s. 2017 & WHO Growth Reference 2007)
                </div>

                {/* Metadata Grid */}
                <div className="sf8-print-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16, fontSize: 10, textAlign: 'left', background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div><strong>School Name:</strong> {report.schoolInfo.schoolName}</div>
                  <div><strong>School ID:</strong> {report.schoolInfo.schoolId}</div>
                  <div><strong>District:</strong> {report.schoolInfo.district}</div>
                  <div><strong>Division:</strong> {report.schoolInfo.division}</div>
                  <div><strong>Region:</strong> {report.schoolInfo.region}</div>
                  <div><strong>School Year:</strong> {report.schoolInfo.schoolYear}</div>
                  <div><strong>Grade & Section:</strong> Grade {report.schoolInfo.gradeLevel} - {report.schoolInfo.sectionName}</div>
                  <div><strong>Assessment Period:</strong> <span style={{ color: '#e11d48', fontWeight: 700 }}>{period === 'BOSY' ? 'BOSY Baseline' : period === 'EOSY' ? 'EOSY Post-Assessment' : 'Full Year (ALL)'}</span></div>
                  {report.schoolInfo.ageCutoffBasis && (
                    <div style={{ gridColumn: 'span 4', fontSize: 9, color: '#64748b', fontStyle: 'italic', borderTop: '1px dashed #cbd5e1', paddingTop: 4, marginTop: 2 }}>
                      <strong>Age Reference Basis:</strong> {report.schoolInfo.ageCutoffBasis}
                    </div>
                  )}
                </div>

                {/* Assessment Completeness Summary Bar */}
                <div className="sf8-print-completeness-bar" style={{
                  marginTop: 10,
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '8px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 10
                }}>
                  <div>
                    <span style={{ color: '#475569' }}>Total Enrolled:</span>{' '}
                    <strong>{report.totalEnrolled.total}</strong>{' '}
                    <span style={{ color: '#94a3b8' }}>({report.totalEnrolled.male} M, {report.totalEnrolled.female} F)</span>
                  </div>
                  <div>
                    <span style={{ color: '#166534' }}>Total Assessed:</span>{' '}
                    <strong style={{ color: '#166534' }}>{report.totalAssessed.total}</strong>{' '}
                    <span style={{ color: '#94a3b8' }}>({report.totalAssessed.male} M, {report.totalAssessed.female} F)</span>
                  </div>
                  <div>
                    <span style={{ color: '#b45309' }}>Pending / Unassessed:</span>{' '}
                    <strong style={{ color: '#b45309' }}>{report.totalUnassessed?.total ?? (report.totalEnrolled.total - report.totalAssessed.total)}</strong>{' '}
                    <span style={{ color: '#94a3b8' }}>({report.totalUnassessed?.male ?? 0} M, {report.totalUnassessed?.female ?? 0} F)</span>
                  </div>
                </div>
              </div>

              {/* Policy Citation Notice (Screen Only) */}
              <div className="sf8-screen-only" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '8px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} color="#2563eb" />
                <div style={{ fontSize: 10, color: '#1e40af' }}>
                  <strong>Calulut Integrated School Policy:</strong> Under DepEd DO 058, s. 2017, the <strong>Class Adviser</strong> and <strong>MAPEH Teacher</strong> are the designated encoders. <strong>No School Nurse is required</strong> for the compilation, certification, and submission of this report.
                </div>
              </div>

              {/* Male Learners Table */}
              {renderLearnerTable(report.learners.male, 'MALE LEARNERS', 'Male', report.totalAssessed.male, report.totalUnassessed?.male ?? 0)}

              {/* Female Learners Table */}
              {renderLearnerTable(report.learners.female, 'FEMALE LEARNERS', 'Female', report.totalAssessed.female, report.totalUnassessed?.female ?? 0)}

              {/* DepEd Summary Statistics Section */}
              <div className="sf8-avoid-break" style={{ marginTop: 24, borderTop: '2px solid #0f172a', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 12, textTransform: 'uppercase' }}>
                  Summary Nutritional Status & Height-for-Age (HFA) Tables
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* BMI Summary Table */}
                  <div>
                    <div style={{ background: '#0f172a', color: '#fff', padding: '5px 10px', fontSize: 10, fontWeight: 700, borderRadius: '4px 4px 0 0' }}>
                      NUTRITIONAL STATUS (BMI-FOR-AGE)
                    </div>
                    <table className="sf8-summary-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, background: '#fff' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Nutritional Category</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 45, textAlign: 'center' }}>Male</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 45, textAlign: 'center' }}>%</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 45, textAlign: 'center' }}>Female</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 45, textAlign: 'center' }}>%</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 50, textAlign: 'center' }}>Total</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 45, textAlign: 'center' }}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((period === 'EOSY' && report.summaryBmi.eosy) ? report.summaryBmi.eosy : report.summaryBmi.bosy).map((row: any) => (
                          <tr key={row.category}>
                            <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{row.category}</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{row.maleCount}</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#64748b' }}>{row.malePercentage}%</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{row.femaleCount}</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#64748b' }}>{row.femalePercentage}%</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700 }}>{row.totalCount}</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, color: '#e11d48' }}>{row.totalPercentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* HFA Summary Table */}
                  <div>
                    <div style={{ background: '#0f172a', color: '#fff', padding: '5px 10px', fontSize: 10, fontWeight: 700, borderRadius: '4px 4px 0 0' }}>
                      HEIGHT-FOR-AGE (STUNTING / GROWTH STATUS)
                    </div>
                    <table className="sf8-summary-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, background: '#fff' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', textAlign: 'left' }}>HFA Growth Status</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 45, textAlign: 'center' }}>Male</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 45, textAlign: 'center' }}>%</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 45, textAlign: 'center' }}>Female</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 45, textAlign: 'center' }}>%</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 50, textAlign: 'center' }}>Total</th>
                          <th style={{ padding: '5px', border: '1px solid #cbd5e1', width: 45, textAlign: 'center' }}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((period === 'EOSY' && report.summaryHfa.eosy) ? report.summaryHfa.eosy : report.summaryHfa.bosy).map((row: any) => (
                          <tr key={row.category}>
                            <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{row.category}</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{row.maleCount}</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#64748b' }}>{row.malePercentage}%</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{row.femaleCount}</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#64748b' }}>{row.femalePercentage}%</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700 }}>{row.totalCount}</td>
                            <td style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>{row.totalPercentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Official DepEd Accountability Signatures (Conducted, Reviewed, Certified Correct) */}
              <div className="sf8-avoid-break sf8-signatures-grid" style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, fontSize: 11, textAlign: 'center' }}>
                <div>
                  <div className="sf8-sig-line" style={{ borderBottom: '1px solid #0f172a', paddingBottom: 6, fontWeight: 700, textTransform: 'uppercase', minHeight: 20 }}>
                    {report.accountability.conductedByName || '\u00A0'}
                  </div>
                  <div style={{ color: '#475569', marginTop: 4, fontWeight: 600 }}>{report.accountability.conductedByRole}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>
                    {report.accountability.conductedByName ? 'Conducted / Assessed By' : 'Conducted / Assessed By (Pending Verification)'}
                  </div>
                </div>

                <div>
                  <div className="sf8-sig-line" style={{ borderBottom: '1px solid #0f172a', paddingBottom: 6, fontWeight: 700, textTransform: 'uppercase', minHeight: 20 }}>
                    {report.accountability.reviewedByName || '\u00A0'}
                  </div>
                  <div style={{ color: '#475569', marginTop: 4, fontWeight: 600 }}>{report.accountability.reviewedByRole}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>
                    {report.accountability.reviewedByName ? 'Reviewed By' : 'Reviewed By (Pending Designation)'}
                  </div>
                </div>

                <div>
                  <div className="sf8-sig-line" style={{ borderBottom: '1px solid #0f172a', paddingBottom: 6, fontWeight: 700, textTransform: 'uppercase', minHeight: 20 }}>
                    {report.accountability.certifiedByName || '\u00A0'}
                  </div>
                  <div style={{ color: '#475569', marginTop: 4, fontWeight: 600 }}>{report.accountability.certifiedByRole}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>
                    {report.accountability.certifiedByName ? 'Certified Correct By' : 'Certified Correct By (Pending Designation)'}
                  </div>
                </div>
              </div>

              {/* Official Disclaimer */}
              <div className="sf8-official-disclaimer" style={{ textAlign: 'center', marginTop: 24, fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>
                {report.accountability.systemDisclaimer} • Generated on {report.accountability.dateGenerated}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
    </>,
    document.body
  );
}
