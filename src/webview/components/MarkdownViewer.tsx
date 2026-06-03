import React from 'react';

interface Props {
  content: string;
}

export default function MarkdownViewer({ content }: Props) {
  return (
    <div style={styles.container}>
      {parseBlocks(content)}
    </div>
  );
}

// ─── Block parser ────────────────────────────────────────────────────────────

let _key = 0;
const key = () => String(++_key);

function parseBlocks(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block ```[lang]
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push(
        <pre key={key()} style={styles.pre}>
          {lang && <span style={styles.langTag}>{lang}</span>}
          <code style={styles.code}>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Heading  # … ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const depth = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const Tag = `h${depth}` as keyof JSX.IntrinsicElements;
      nodes.push(
        <Tag key={key()} style={headingStyle(depth)}>
          {parseInline(headingMatch[2])}
        </Tag>,
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(---+|===+|\*\*\*+)\s*$/.test(line.trim()) && line.trim().length >= 3) {
      nodes.push(<hr key={key()} style={styles.hr} />);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <blockquote key={key()} style={styles.blockquote}>
          {parseBlocks(quoteLines.join('\n'))}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (/^[ \t]*[-*+]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[ \t]*[-*+]\s+/.test(lines[i])) {
        const text = lines[i].replace(/^[ \t]*[-*+]\s+/, '');
        items.push(<li key={i} style={styles.li}>{parseInline(text)}</li>);
        i++;
      }
      nodes.push(<ul key={key()} style={styles.ul}>{items}</ul>);
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) {
        const text = lines[i].replace(/^\d+[.)]\s+/, '');
        items.push(<li key={i} style={styles.li}>{parseInline(text)}</li>);
        i++;
      }
      nodes.push(<ol key={key()} style={styles.ol}>{items}</ol>);
      continue;
    }

    // Table (line has pipes and next non-empty line is separator)
    if (line.includes('|')) {
      const tableStart = i;
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const table = parseTable(tableLines);
      if (table) {
        nodes.push(<React.Fragment key={key()}>{table}</React.Fragment>);
      } else {
        // Not a valid table, re-parse as paragraphs
        i = tableStart;
        nodes.push(parseParagraph(lines, i));
        i++;
      }
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph: collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !/^[ \t]*[-*+]\s+/.test(lines[i]) &&
      !/^\d+[.)]\s+/.test(lines[i]) &&
      !/^(---+|===+|\*\*\*+)\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      nodes.push(
        <p key={key()} style={styles.p}>
          {parseInline(paraLines.join(' '))}
        </p>,
      );
    } else {
      i++;
    }
  }

  return nodes;
}

function parseParagraph(lines: string[], i: number): React.ReactNode {
  return <p key={key()} style={styles.p}>{parseInline(lines[i])}</p>;
}

// ─── Table parser ─────────────────────────────────────────────────────────────

function parseTable(lines: string[]): React.ReactNode | null {
  // Need at least header + separator
  if (lines.length < 2) return null;

  const sep = lines.find((l) => /^\|?[\s:|-]+\|?$/.test(l.trim()));
  if (!sep) return null;

  const sepIdx = lines.indexOf(sep);
  const headerLines = lines.slice(0, sepIdx);
  const bodyLines = lines.slice(sepIdx + 1);

  const splitRow = (row: string) =>
    row
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

  const headers = headerLines.flatMap(splitRow);
  const rows = bodyLines.map(splitRow);

  return (
    <div style={{ overflowX: 'auto', marginBottom: '0.8em' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {headers.map((h, j) => (
              <th key={j} style={styles.th}>{parseInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'var(--vscode-list-hoverBackground)' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={styles.td}>{parseInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Inline parser ────────────────────────────────────────────────────────────

// Tokenizes inline markdown into React nodes using a single-pass regex approach.
const INLINE_RE =
  /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|~~(.+?)~~)/gs;

function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  INLINE_RE.lastIndex = 0; // reset stateful regex

  while ((match = INLINE_RE.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const [, , boldItalic, bold, boldUnd, italic, italicStar, code, linkText, linkUrl, strike] = match;

    if (boldItalic)       parts.push(<strong key={k++}><em>{boldItalic}</em></strong>);
    else if (bold)        parts.push(<strong key={k++}>{bold}</strong>);
    else if (boldUnd)     parts.push(<strong key={k++}>{boldUnd}</strong>);
    else if (italic)      parts.push(<em key={k++}>{italic}</em>);
    else if (italicStar)  parts.push(<em key={k++}>{italicStar}</em>);
    else if (code)        parts.push(<code key={k++} style={styles.inlineCode}>{code}</code>);
    else if (linkText && linkUrl) parts.push(
      <span key={k++} style={styles.link} title={linkUrl}>{linkText}</span>,
    );
    else if (strike)      parts.push(<del key={k++}>{strike}</del>);

    lastIndex = INLINE_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 0 ? text : parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function headingStyle(depth: number): React.CSSProperties {
  const sizes = ['1.5em', '1.25em', '1.1em', '1em', '0.9em', '0.85em'];
  return {
    fontSize: sizes[depth - 1] ?? '1em',
    fontWeight: depth <= 2 ? 700 : 600,
    marginTop: depth === 1 ? '0.2em' : '0.9em',
    marginBottom: '0.3em',
    paddingBottom: depth <= 2 ? '0.2em' : undefined,
    borderBottom: depth <= 2 ? '1px solid var(--vscode-panel-border, #444)' : undefined,
    color: 'var(--vscode-foreground)',
    lineHeight: 1.3,
  };
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '14px 16px 24px',
    lineHeight: 1.65,
    fontSize: '0.9em',
    color: 'var(--vscode-foreground)',
  },
  p: {
    marginBottom: '0.65em',
  },
  ul: {
    paddingLeft: '1.5em',
    marginBottom: '0.65em',
  },
  ol: {
    paddingLeft: '1.5em',
    marginBottom: '0.65em',
  },
  li: {
    marginBottom: '0.2em',
  },
  pre: {
    position: 'relative',
    background: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-panel-border, #3a3a3a)',
    borderRadius: 5,
    padding: '10px 12px',
    overflowX: 'auto',
    marginBottom: '0.85em',
    fontSize: '0.88em',
  },
  langTag: {
    position: 'absolute',
    top: 4,
    right: 8,
    fontSize: '0.75em',
    opacity: 0.45,
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    userSelect: 'none',
  },
  code: {
    display: 'block',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    color: 'var(--vscode-editor-foreground)',
    whiteSpace: 'pre',
  },
  inlineCode: {
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    background: 'var(--vscode-textCodeBlock-background)',
    color: 'var(--vscode-textPreformat-foreground)',
    padding: '1px 5px',
    borderRadius: 3,
    fontSize: '0.92em',
  },
  blockquote: {
    borderLeft: '3px solid var(--vscode-activityBarBadge-background, #007acc)',
    paddingLeft: 12,
    marginLeft: 0,
    marginBottom: '0.65em',
    opacity: 0.82,
  },
  hr: {
    border: 'none',
    borderTop: '1px solid var(--vscode-panel-border, #3a3a3a)',
    margin: '1em 0',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: '0.88em',
  },
  th: {
    border: '1px solid var(--vscode-panel-border, #3a3a3a)',
    padding: '5px 10px',
    background: 'var(--vscode-editor-inactiveSelectionBackground)',
    fontWeight: 600,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  td: {
    border: '1px solid var(--vscode-panel-border, #3a3a3a)',
    padding: '4px 10px',
    verticalAlign: 'top',
  },
  link: {
    color: 'var(--vscode-textLink-foreground)',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
};
