import React from 'react';
import { C } from '../../../shared/constants/tokens.js';

interface SafeMarkdownRendererProps {
  content: string;
}

/**
 * Parses and renders safe markdown formatted text without external dependencies.
 * Prevents raw markdown artifacts (##, ###, **text**, raw table pipes) from reaching users.
 */
export function SafeMarkdownRenderer({ content }: SafeMarkdownRendererProps) {
  if (!content) return null;

  // Split into lines for block-level parsing
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  // Helper for inline markdown: **bold**, `code`, *italic*
  const renderInline = (text: string): React.ReactNode => {
    // Regex matches **bold**, `code`, or *italic*
    const parts: React.ReactNode[] = [];
    const inlineRegex = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      if (match[2] !== undefined) {
        // **bold**
        parts.push(
          <strong key={`b-${match.index}`} style={{ fontWeight: 700, color: C.m900 }}>
            {match[2]}
          </strong>
        );
      } else if (match[3] !== undefined) {
        // `code`
        parts.push(
          <code
            key={`c-${match.index}`}
            style={{
              background: 'rgba(15,23,42,0.07)',
              padding: '1px 5px',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'monospace',
              color: C.m800,
            }}
          >
            {match[3]}
          </code>
        );
      } else if (match[4] !== undefined) {
        // *italic*
        parts.push(<em key={`i-${match.index}`}>{match[4]}</em>);
      }
      lastIndex = inlineRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Markdown Table Detection (starts and ends with |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map(c => c.trim());
        
        // Find separator line (e.g. |---|---|)
        const hasSeparator = tableLines[1].replace(/[\s\-|:]/g, '') === '';
        const bodyRows = hasSeparator ? tableLines.slice(2) : tableLines.slice(1);

        elements.push(
          <div
            key={`tbl-${elements.length}`}
            style={{
              overflowX: 'auto',
              margin: '8px 0',
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
            }}
          >
            <table
              style={{
                width: '100%',
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
                        padding: '6px 8px',
                        fontWeight: 700,
                        fontSize: 10.5,
                        letterSpacing: '0.02em',
                        borderRight: cIdx < headerRow.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                      }}
                    >
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((rowStr, rIdx) => {
                  const cells = rowStr
                    .slice(1, -1)
                    .split('|')
                    .map(c => c.trim());
                  return (
                    <tr
                      key={rIdx}
                      style={{
                        background: rIdx % 2 === 1 ? '#F1F5F9' : '#FFFFFF',
                        borderTop: '1px solid #E2E8F0',
                      }}
                    >
                      {cells.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            padding: '5px 8px',
                            color: C.t1,
                            fontSize: 11,
                            borderRight: cIdx < cells.length - 1 ? '1px solid #E2E8F0' : 'none',
                          }}
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. Headings (## or ### or #)
    if (trimmed.startsWith('#')) {
      const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        const isMajor = level <= 2;

        elements.push(
          <div
            key={`h-${elements.length}`}
            style={{
              fontSize: isMajor ? 13 : 12,
              fontWeight: 700,
              color: isMajor ? C.m900 : C.m800,
              marginTop: elements.length > 0 ? 8 : 2,
              marginBottom: 4,
              fontFamily: "'Inter', sans-serif",
              letterSpacing: '-0.01em',
            }}
          >
            {renderInline(headingText)}
          </div>
        );
        i++;
        continue;
      }
    }

    // 4. Bullet lists (* or -)
    const bulletMatch = trimmed.match(/^[\*\-]\s+(.*)$/);
    if (bulletMatch) {
      elements.push(
        <div
          key={`li-${elements.length}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            marginTop: 2,
            marginBottom: 2,
            paddingLeft: 2,
          }}
        >
          <span
            style={{
              color: C.m700,
              fontSize: 12,
              lineHeight: 1.4,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            •
          </span>
          <span style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: C.t1 }}>
            {renderInline(bulletMatch[1])}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 5. Numbered lists (1. , 2. )
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div
          key={`oli-${elements.length}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            marginTop: 2,
            marginBottom: 2,
            paddingLeft: 2,
          }}
        >
          <span
            style={{
              color: C.m700,
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.5,
              minWidth: 16,
              flexShrink: 0,
            }}
          >
            {numMatch[1]}.
          </span>
          <span style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: C.t1 }}>
            {renderInline(numMatch[2])}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 6. Regular Paragraph Line
    elements.push(
      <p
        key={`p-${elements.length}`}
        style={{
          margin: '0 0 6px 0',
          fontSize: 12.5,
          lineHeight: 1.55,
          color: C.t1,
          wordBreak: 'break-word',
        }}
      >
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>;
}
