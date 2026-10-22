import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Table, LayoutList } from 'lucide-react';
import { C } from '../../../shared/constants/tokens.js';
import { StatusBadge } from './StatusBadge.js';
import { formatAiDate } from '../utils/formatAiDate.js';

interface AdaptiveMarkdownTableProps {
  headerRow: string[];
  bodyRows: string[][];
  renderInline: (text: string) => React.ReactNode;
}

/**
 * Responsive AI Structured Table/Card Renderer
 *
 * Implements DigiSkwela responsive rules:
 * - Rule A: Wide data (>3 columns) -> Compact Stacked Record Cards with Progressive Disclosure
 * - Rule B: Simple tables (<=3 columns) -> Clean compact table without vertical letter stacking
 * - Rule C: Unknown Markdown tables -> Safe horizontal-scrolling fallback with minimum column widths
 */
export function AdaptiveMarkdownTable({
  headerRow,
  bodyRows,
  renderInline,
}: AdaptiveMarkdownTableProps) {
  const isWide = headerRow.length > 3;
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(isWide ? 'cards' : 'table');
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const toggleRow = (idx: number) => {
    setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // ─── RULE B: SMALL TABLES (<= 3 COLUMNS) ───────────────────────────────────
  if (!isWide || viewMode === 'table') {
    const minTableWidth = isWide ? Math.max(headerRow.length * 110, 480) : '100%';

    return (
      <div style={{ margin: '8px 0' }}>
        {isWide && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              style={{
                background: 'none',
                border: 'none',
                color: C.m700,
                fontSize: 10.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              <LayoutList size={11} />
              <span>Switch to Card View</span>
            </button>
          </div>
        )}

        <div
          data-testid="ai-table-container"
          style={{
            overflowX: 'auto',
            borderRadius: 6,
            border: '1px solid #CBD5E1',
            background: '#FFFFFF',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <table
            style={{
              width: isWide ? undefined : '100%',
              minWidth: minTableWidth,
              borderCollapse: 'collapse',
              fontSize: 11,
              textAlign: 'left',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <thead>
              <tr style={{ background: C.m900, color: '#FFFFFF' }}>
                {headerRow.map((cell, cIdx) => (
                  <th
                    key={cIdx}
                    style={{
                      padding: '7px 10px',
                      fontWeight: 700,
                      fontSize: 10.5,
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                      borderRight: cIdx < headerRow.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    }}
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((cells, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    background: rIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                    borderTop: '1px solid #E2E8F0',
                  }}
                >
                  {cells.map((cell, cIdx) => {
                    const isStatusCol = /status|state/i.test(headerRow[cIdx] || '');
                    const isDateCol = /date|submitted|start|end|time/i.test(headerRow[cIdx] || '');
                    const formatted = isDateCol ? formatAiDate(cell) : cell;

                    return (
                      <td
                        key={cIdx}
                        style={{
                          padding: '6px 10px',
                          color: C.t1,
                          fontSize: 11,
                          lineHeight: 1.45,
                          whiteSpace: isWide || isStatusCol ? 'nowrap' : 'normal',
                          wordBreak: 'normal',
                          borderRight: cIdx < cells.length - 1 ? '1px solid #E2E8F0' : 'none',
                        }}
                      >
                        {isStatusCol ? (
                          <StatusBadge status={cell} />
                        ) : (
                          renderInline(formatted)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── RULE A: WIDE TABLES -> STACKED RECORD CARDS (PROGRESSIVE DISCLOSURE) ──
  return (
    <div data-testid="ai-stacked-cards-container" style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* View Switcher: Stacked Cards (Default) vs Horizontal Table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
        <span style={{ fontSize: 10, color: C.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {bodyRows.length} Record{bodyRows.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={() => setViewMode('table')}
          title="View as horizontally scrollable table"
          style={{
            background: 'none',
            border: 'none',
            color: C.m700,
            fontSize: 10.5,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          <Table size={11} />
          <span>View as Table</span>
        </button>
      </div>

      {bodyRows.map((cells, rIdx) => {
        // Map fields
        const allFields = headerRow.map((header, cIdx) => ({
          header: header.trim(),
          value: (cells[cIdx] || '').trim(),
          cIdx,
        }));

        // Status field detection
        const statusField = allFields.find(f => /status|state/i.test(f.header));

        // Primary title field detection (applicant, name, title, teacher, student)
        const titleField = allFields.find(f => /applicant|name|teacher|student|employee|title|subject/i.test(f.header));

        // Secondary fields for Progressive Disclosure: IDs, timestamps, or fields past primary set
        const isSecondary = (f: typeof allFields[0]) => {
          if (/^id$|request\s*id|uuid|submitted|created|timestamp/i.test(f.header)) return true;
          return false;
        };

        const primaryFields = allFields.filter(f => {
          if (f === statusField) return false;
          if (f === titleField && titleField) return false;
          return !isSecondary(f);
        });

        const secondaryFields = allFields.filter(f => {
          if (f === statusField) return false;
          if (f === titleField && titleField) return false;
          return isSecondary(f);
        });

        const isExpanded = !!expandedRows[rIdx];

        return (
          <div
            key={rIdx}
            data-testid={`stacked-record-card-${rIdx}`}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Card Header: Title + Status Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: C.m700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {titleField ? titleField.header : 'Record Details'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginTop: 1, wordBreak: 'normal' }}>
                  {titleField ? renderInline(titleField.value) : `Record #${rIdx + 1}`}
                </div>
              </div>

              {statusField && (
                <div style={{ flexShrink: 0 }}>
                  <StatusBadge status={statusField.value} />
                </div>
              )}
            </div>

            {/* Primary Fields (2-column key/value or stacked rows) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 10px' }}>
              {primaryFields.map((f, fIdx) => {
                const isDate = /date|start|end|period/i.test(f.header);
                const displayVal = isDate ? formatAiDate(f.value) : f.value;
                const isFullSpan = f.value.length > 25 || /date|dates/i.test(f.header);

                return (
                  <div
                    key={fIdx}
                    style={{
                      gridColumn: isFullSpan ? '1 / -1' : undefined,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 9.5, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {f.header}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: C.t1, lineHeight: 1.4, wordBreak: 'normal' }}>
                      {renderInline(displayVal)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progressive Disclosure Section for Secondary Details */}
            {secondaryFields.length > 0 && (
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 6, marginTop: 2 }}>
                <button
                  type="button"
                  data-testid={`toggle-details-btn-${rIdx}`}
                  onClick={() => toggleRow(rIdx)}
                  aria-expanded={isExpanded}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: C.m700,
                    fontSize: 10.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 0,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  <span>{isExpanded ? 'Hide details' : 'View details'}</span>
                </button>

                {isExpanded && (
                  <div
                    data-testid={`details-expanded-${rIdx}`}
                    style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      background: '#F8FAFC',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {secondaryFields.map((f, sfIdx) => {
                      const isDate = /submitted|date|time|created/i.test(f.header);
                      const displayVal = isDate ? formatAiDate(f.value) : f.value;

                      return (
                        <div key={sfIdx} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {f.header}
                          </span>
                          <span style={{ fontSize: 11, color: C.t2, fontFamily: /id|uuid|code/i.test(f.header) ? 'monospace' : undefined, wordBreak: 'break-all' }}>
                            {renderInline(displayVal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
