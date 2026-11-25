import { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import {
  DEFAULT_CLOUD_MODEL,
  loadFirebaseConfig,
  saveFirebaseConfig,
} from '../lib/firebaseClient';
import type { RuntimeFirebaseConfig } from '../types/veilnote';

interface FirebaseSetupModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export function FirebaseSetupModal({ onClose, onSaved }: FirebaseSetupModalProps) {
  const existing = loadFirebaseConfig();
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [projectId, setProjectId] = useState(existing?.projectId ?? '');
  const [authDomain, setAuthDomain] = useState(existing?.authDomain ?? '');
  const [appId, setAppId] = useState(existing?.appId ?? '');
  const [appCheckSiteKey, setAppCheckSiteKey] = useState(existing?.appCheckSiteKey ?? '');
  const [cloudModel, setCloudModel] = useState(existing?.cloudModel ?? DEFAULT_CLOUD_MODEL);
  const [snippetInput, setSnippetInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleParseSnippet = () => {
    const extract = (key: string) => {
      const m = snippetInput.match(new RegExp(`${key}\\s*[:=]\\s*["']([^"']+)["']`));
      return m?.[1] ?? '';
    };
    const parsedKey = extract('apiKey');
    const parsedProject = extract('projectId');
    const parsedAuth = extract('authDomain');
    const parsedAppId = extract('appId');

    if (!parsedKey || !parsedProject || !parsedAppId) {
      setError('Could not find apiKey, projectId, and appId in the pasted snippet.');
      return;
    }

    setApiKey(parsedKey);
    setProjectId(parsedProject);
    setAuthDomain(parsedAuth || `${parsedProject}.firebaseapp.com`);
    setAppId(parsedAppId);
    setError(null);
  };

  const handleSave = async () => {
    if (!apiKey.trim() || !projectId.trim() || !appId.trim()) {
      setError('apiKey, projectId, and appId are required to enable live Firebase AI Logic.');
      return;
    }
    const cfg: RuntimeFirebaseConfig = {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      appId: appId.trim(),
      appCheckSiteKey: appCheckSiteKey.trim() || undefined,
      cloudModel: cloudModel.trim() || DEFAULT_CLOUD_MODEL,
    };
    await saveFirebaseConfig(cfg);
    onSaved();
    onClose();
  };

  const handleClear = async () => {
    await saveFirebaseConfig(null);
    onSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Firebase AI Logic Setup">
      <div className="modal-card">
        <div className="card-header">
          <div className="card-title">
            <KeyRound size={15} />
            Firebase AI Logic & App Check Configuration
          </div>
          <button type="button" className="btn" style={{ padding: '4px 8px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-hairline)',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--ink-secondary)',
            }}
          >
            <strong>3-Step Firebase Console Checklist:</strong>
            <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Create or open a Firebase project, register a Web App, and copy <code>firebaseConfig</code>.</li>
              <li>Enable <strong>AI Logic (Gemini Developer API)</strong> in Firebase Console.</li>
              <li>Enable <strong>App Check</strong> with reCAPTCHA v3 and paste the Site Key below (recommended for cloud fallback).</li>
            </ol>
          </div>

          <div>
            <label className="field-label">Quick Paste Firebase Config Snippet (Optional)</label>
            <textarea
              className="field-input mono"
              rows={3}
              placeholder='apiKey: "AIza...", projectId: "my-app", appId: "1:..."'
              value={snippetInput}
              onChange={(e) => setSnippetInput(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              style={{ marginTop: 6, fontSize: 11.5 }}
              onClick={handleParseSnippet}
            >
              Auto-fill from Snippet
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">API Key *</label>
              <input className="field-input mono" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Project ID *</label>
              <input className="field-input mono" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Auth Domain</label>
              <input
                className="field-input mono"
                placeholder="project-id.firebaseapp.com"
                value={authDomain}
                onChange={(e) => setAuthDomain(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">App ID *</label>
              <input className="field-input mono" value={appId} onChange={(e) => setAppId(e.target.value)} />
            </div>
            <div>
              <label className="field-label">App Check reCAPTCHA v3 Site Key</label>
              <input
                className="field-input mono"
                placeholder="6Lc..."
                value={appCheckSiteKey}
                onChange={(e) => setAppCheckSiteKey(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Cloud Fallback Model</label>
              <input
                className="field-input mono"
                value={cloudModel}
                onChange={(e) => setCloudModel(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--accent-danger)', fontWeight: 500 }}>{error}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <button type="button" className="btn" onClick={handleClear}>
              Clear Saved Keys
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                Save & Connect Firebase AI
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
