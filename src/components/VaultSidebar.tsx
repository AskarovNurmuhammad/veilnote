import { FilePlus2, FolderLock, RotateCcw, Shield } from 'lucide-react';
import type { PiiCategory, RedactionRuleSet, VaultDocument } from '../types/veilnote';

interface VaultSidebarProps {
  documents: VaultDocument[];
  activeDocId: string;
  rules: RedactionRuleSet;
  onSelectDoc: (id: string) => void;
  onNewDoc: () => void;
  onResetPresets: () => void;
  onToggleRule: (category: PiiCategory) => void;
}

const RULE_LABELS: Array<{ key: PiiCategory; label: string }> = [
  { key: 'PERSON', label: 'Names' },
  { key: 'EMAIL', label: 'Emails' },
  { key: 'PHONE', label: 'Phones' },
  { key: 'FINANCIAL', label: 'IBAN / Cards' },
  { key: 'GOV_ID', label: 'Gov / IDs' },
  { key: 'SECRET', label: 'API Keys' },
  { key: 'ADDRESS', label: 'Addresses' },
  { key: 'DATE', label: 'Birthdates' },
];

export function VaultSidebar({
  documents,
  activeDocId,
  rules,
  onSelectDoc,
  onNewDoc,
  onResetPresets,
  onToggleRule,
}: VaultSidebarProps) {
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section className="card">
        <div className="card-header">
          <div className="card-title">
            <FolderLock size={14} />
            Local Vault ({documents.length})
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="btn"
              style={{ padding: '4px 8px', fontSize: 11 }}
              onClick={onResetPresets}
              title="Restore sample scenarios"
            >
              <RotateCcw size={12} />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '4px 9px', fontSize: 11 }}
              onClick={onNewDoc}
            >
              <FilePlus2 size={12} />
              New
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 8 }}>
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className={`doc-item ${doc.id === activeDocId ? 'is-active' : ''}`}
              onClick={() => onSelectDoc(doc.id)}
            >
              <span className="doc-item-title">{doc.title}</span>
              <span className="doc-item-meta">
                {doc.domain} · {doc.lastSource ? doc.lastSource : 'draft'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div className="card-title">
            <Shield size={14} />
            Local Redaction Rules
          </div>
        </div>
        <div className="card-body">
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 11.5,
              color: 'var(--ink-secondary)',
              lineHeight: 1.45,
            }}
          >
            Selected categories are scrubbed locally in your browser before any cloud fallback call.
          </p>
          <div className="rule-chip-grid">
            {RULE_LABELS.map((item) => {
              const active = rules[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`rule-chip ${active ? 'is-on' : ''}`}
                  onClick={() => onToggleRule(item.key)}
                >
                  <span>{item.label}</span>
                  <span className="mono" style={{ fontSize: 10 }}>
                    {active ? 'ON' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </aside>
  );
}
