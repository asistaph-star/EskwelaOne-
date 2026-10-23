import React from 'react';
import { C } from '../../../shared/constants/tokens.js';
import { AdaptiveMarkdownTable } from './AdaptiveMarkdownTable.js';
import { sanitizeNarrativeEnums } from '../utils/humanizeValue.js';

interface SafeMarkdownRendererProps {
  content: string;
  hasStructuredData?: boolean;
}

/**
 * Parses and renders safe markdown formatted text without external dependencies.
 * Prevents raw markdown artifacts (##, ###, **, raw table pipes, ---, \---) from reaching users.
 * Strips raw HTML and ensures model output is completely safe.
 */
export function SafeMarkdownRenderer({ content, hasStructuredData = false }: SafeMarkdownRendererProps) {
  if (!content) return null;

  // Split into lines for block-level parsing
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  // Helper for inline markdown: **bold**, `code`, *italic*, enums, escaped artifacts
  const renderInline = (text: string): React.ReactNode => {
    if (!text) return null;

    // 1. Sanitize any raw backend enums, route codes, or HTML entities
    let sanitized = sanitizeNarrativeEnums(text);

    // 2. Strip leading backslashes on markdown symbols (e.g. \* -> *, \_ -> _, \# -> #)
    sanitized = sanitized.replace(/\\([*#_`[\]()\-+!|])/g, '$1');

    // 3. Match **bold**, `code`, or *italic*
    const parts: React.ReactNode[] = [];
    const inlineRegex = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = inlineRegex.exec(sanitized)) !== null) {
      if (match.index > lastIndex) {
        // Strip any dangling lone asterisks, hashes, or backticks in plain text
        const plain = sanitized.substring(lastIndex, match.index)
          .replace(/\*+/g, '')
          .replace(/`+/g, '')
          .replace(/#+/g, '');
        if (plain) parts.push(plain);
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

    if (lastIndex < sanitized.length) {
      const remaining = sanitized.substring(lastIndex)
        .replace(/\*+/g, '')
        .replace(/`+/g, '')
        .replace(/#+/g, '');
      if (remaining) parts.push(remaining);
    }

    if (parts.length > 0) return parts;
    return sanitized.replace(/\*+/g, '').replace(/`+/g, '').replace(/#+/g, '');
  };

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Horizontal Rules / Separator lines (---, \---, ***, \***, ___)
    if (/^\\?[-*_]{3,}$/.test(trimmed)) {
      elements.push(
        <div
          key={`hr-${elements.length}`}
          style={{
            height: 1,
            backgroundColor: '#E2E8F0',
            margin: '8px 0',
            border: 'none',
          }}
        />
      );
      i++;
      continue;
    }

    // 3. Markdown Table Detection (starts and ends with |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      // If structured data cards are already rendered for this message, suppress redundant markdown table
      if (hasStructuredData) {
        continue;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map(c => c.trim());
        
        // Find separator line (e.g. |---|---|)
        const hasSeparator = tableLines[1].replace(/[\s\-|:]/g, '') === '';
        const bodyLines = hasSeparator ? tableLines.slice(2) : tableLines.slice(1);
        const bodyRows = bodyLines.map(rowStr =>
          rowStr
            .slice(1, -1)
            .split('|')
            .map(c => c.trim())
        );

        elements.push(
          <AdaptiveMarkdownTable
            key={`tbl-${elements.length}`}
            headerRow={headerRow}
            bodyRows={bodyRows}
            renderInline={renderInline}
          />
        );
        continue;
      }
    }

    // 4. Headings (##, ###, # or escaped \##)
    const headingMatch = trimmed.match(/^\\?(#{1,6})\s+(.*)$/);
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

    // 5. Bullet lists (*, -, +, •, ·, or escaped \*, \-)
    const bulletMatch = trimmed.match(/^(?:[\*\-+]|\\?[\*\-]|•|·)\s+(.*)$/);
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

    // 6. Numbered lists (1. , 2. )
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

    // 7. Regular Paragraph Line
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
