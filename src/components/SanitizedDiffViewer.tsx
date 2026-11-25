import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, ShieldAlert } from 'lucide-react';
import type { SanitizationResult } from '../types/veilnote';

interface SanitizedDiffViewerProps {
  sanitization: SanitizationResult;
}

function renderTokenizedText(text: string) {
  const parts = text.split(/(\[[A-Z_]+_\d+\])/g);
  return parts.map((part, index) => {
    if (/^\[[A-Z_]+_\d+\]$/.test(part)) {
      return (
        <span key={`${part}-${index}`} className="pii-token" title="Redacted locally — never sent to cloud">
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function SanitizedDiffViewer({ sanitization }: SanitizedDiffViewerProps) {
  const [revealValues, setRevealValues] = useState(false);

  const uniqueRows = Object.entries(sanitization.tokenMap).map(([token, original]) => {
    const match = sanitization.entities.find((e) => e.token === token);
    return {
      token,
      original,
      category: match?.category ?? 'PII',
      source: match?.source ?? 'regex',
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--accent-local)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <LockKeyhole size={13} />
            Zero-Leak Sanitized Payload
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
            {sanitization.bytesScrubbed}B scrubbed · 0 PII bytes exposed
          </span>
        </div>

        <div className="sanitized-surface">
          {sanitization.sanitizedText.trim()
            ? renderTokenizedText(sanitization.sanitizedText)
            : 'Enter raw text above to preview live local redaction.'}
        </div>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ShieldAlert size={13} color="var(--accent-pii)" />
            Local Browser PII Vault ({uniqueRows.length} unique tokens)
          </span>
          {uniqueRows.length > 0 && (
            <button
              type="button"
              className="btn"
              style={{ padding: '4px 8px', fontSize: 11 }}
              onClick={() => setRevealValues((prev) => !prev)}
            >
              {revealValues ? <EyeOff size={12} /> : <Eye size={12} />}
              {revealValues ? 'Mask Values' : 'Reveal Local Vault'}
            </button>
          )}
        </div>

        {uniqueRows.length === 0 ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px dashed var(--border-strong)',
              fontSize: 12,
              color: 'var(--ink-muted)',
            }}
          >
            No sensitive entities matched current rules.
          </div>
        ) : (
          <div style={{ maxHeight: 165, overflowY: 'auto', border: '1px solid var(--border-hairline)', borderRadius: 8 }}>
            <table className="vault-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Category</th>
                  <th>Held Locally</th>
                  <th>Detector</th>
                </tr>
              </thead>
              <tbody>
                {uniqueRows.map((row) => (
                  <tr key={row.token}>
                    <td>
                      <span className="pii-token">{row.token}</span>
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>
                      {row.category}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {revealValues ? row.original : '••••••••••••'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                      {row.source === 'on_device_ai' ? 'Gemini Nano' : 'Local Shield'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
