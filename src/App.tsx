import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { InferenceMode } from 'firebase/ai';
import { FileText, ImagePlus, ShieldCheck, Trash2 } from 'lucide-react';
import { BriefPanel } from './components/BriefPanel';
import { FirebaseSetupModal } from './components/FirebaseSetupModal';
import { SanitizedDiffViewer } from './components/SanitizedDiffViewer';
import { TopBar } from './components/TopBar';
import { VaultSidebar } from './components/VaultSidebar';
import {
  probeCapabilities,
  runHybridBrief,
  runLocalPrivacyShield,
} from './lib/hybridEngine';
import { PRESET_DOCUMENTS } from './lib/presets';
import { DEFAULT_REDACTION_RULES, sanitizeTextLocally } from './lib/privacyShield';
import {
  loadTelemetryLedger,
  loadVaultDocuments,
  saveTelemetryLedger,
  saveVaultDocuments,
} from './lib/storage';
import type {
  BriefTaskType,
  EnvironmentCapabilities,
  ImageAttachment,
  PiiCategory,
  RedactionRuleSet,
  TelemetryEntry,
  VaultDocument,
} from './types/veilnote';

export function App() {
  const [documents, setDocuments] = useState<VaultDocument[]>(() => loadVaultDocuments());
  const [activeDocId, setActiveDocId] = useState<string>(() => loadVaultDocuments()[0]?.id ?? '');
  const [rules, setRules] = useState<RedactionRuleSet>(DEFAULT_REDACTION_RULES);
  const [mode, setMode] = useState<InferenceMode>(InferenceMode.PREFER_ON_DEVICE);
  const [taskType, setTaskType] = useState<BriefTaskType>('full_brief');
  const [enableOnDeviceNer, setEnableOnDeviceNer] = useState(true);

  const [capabilities, setCapabilities] = useState<EnvironmentCapabilities>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    chromeBuiltInAI: 'unavailable',
    firebaseConfigured: false,
    appCheckEnabled: false,
    cloudModel: 'gemini-2.5-flash',
  });

  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryEntry[]>(() => loadTelemetryLedger());
  const [isRunning, setIsRunning] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);

  const refreshCapabilities = useCallback(async () => {
    const caps = await probeCapabilities();
    setCapabilities(caps);
  }, []);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      const caps = await probeCapabilities();
      if (active) setCapabilities(caps);
    };
    void sync();
    const onNetChange = () => void sync();
    window.addEventListener('online', onNetChange);
    window.addEventListener('offline', onNetChange);
    return () => {
      active = false;
      window.removeEventListener('online', onNetChange);
      window.removeEventListener('offline', onNetChange);
    };
  }, []);

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) ?? documents[0],
    [documents, activeDocId]
  );

  const liveSanitization = useMemo(
    () => sanitizeTextLocally(activeDoc?.rawText ?? '', rules),
    [activeDoc?.rawText, rules]
  );

  const updateActiveDoc = (patch: Partial<VaultDocument>) => {
    if (!activeDoc) return;
    setDocuments((prev) => {
      const next = prev.map((d) =>
        d.id === activeDoc.id
          ? { ...d, ...patch, updatedAt: new Date().toISOString() }
          : d
      );
      saveVaultDocuments(next);
      return next;
    });
  };

  const handleNewDoc = () => {
    const id = `note-${Date.now()}`;
    const newDoc: VaultDocument = {
      id,
      title: 'Untitled Sensitive Note',
      domain: 'Custom Vault',
      updatedAt: new Date().toISOString(),
      rawText:
        'Client: Jordan Lee\nEmail: jordan.lee@example.org\nPhone: +1 415-555-0148\n\nNotes:\nWrite or paste private intake details here.',
    };
    setDocuments((prev) => {
      const next = [newDoc, ...prev];
      saveVaultDocuments(next);
      return next;
    });
    setActiveDocId(id);
    setErrorMessage(null);
  };

  const handleResetPresets = () => {
    setDocuments(PRESET_DOCUMENTS);
    saveVaultDocuments(PRESET_DOCUMENTS);
    setActiveDocId(PRESET_DOCUMENTS[0].id);
    setErrorMessage(null);
  };

  const handleToggleRule = (category: PiiCategory) => {
    setRules((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMessage('Only PNG, JPEG, or WebP images are supported for multimodal hybrid inference.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64Data = result.split(',')[1] ?? '';
      setAttachment({
        name: file.name,
        mimeType: file.type as ImageAttachment['mimeType'],
        base64Data,
        previewUrl: result,
      });
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRunPipeline = async () => {
    if (!activeDoc || !activeDoc.rawText.trim()) {
      setErrorMessage('Add some text to the raw vault before running the pipeline.');
      return;
    }

    setIsRunning(true);
    setErrorMessage(null);
    setDownloadProgress(null);

    try {
      // Stage 1: On-Device / Local Privacy Shield
      const shieldResult = await runLocalPrivacyShield(
        activeDoc.rawText,
        rules,
        enableOnDeviceNer
      );

      // Stage 2: Firebase AI Logic Hybrid Brief using ONLY scrubbed payload
      const briefResult = await runHybridBrief({
        sanitization: shieldResult.sanitization,
        mode,
        taskType,
        attachment,
        allowDemoPreviewWhenUnconfigured: true,
        onDownloadProgress: (loaded) => {
          setDownloadProgress(loaded >= 1 ? null : loaded);
        },
      });

      const nextTelemetry = [
        briefResult.telemetry,
        shieldResult.telemetry,
        ...telemetry,
      ].slice(0, 40);

      setTelemetry(nextTelemetry);
      saveTelemetryLedger(nextTelemetry);

      updateActiveDoc({
        lastBrief: briefResult.brief,
        lastEntities: shieldResult.sanitization.entities,
        lastSource: briefResult.telemetry.actualSource,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Hybrid inference failed.';
      setErrorMessage(msg);
    } finally {
      setIsRunning(false);
      setDownloadProgress(null);
    }
  };

  if (!activeDoc) return null;

  return (
    <div className="veil-shell">
      <TopBar
        capabilities={capabilities}
        mode={mode}
        onModeChange={setMode}
        onOpenSetup={() => setShowSetupModal(true)}
      />

      <main className="veil-grid">
        <VaultSidebar
          documents={documents}
          activeDocId={activeDoc.id}
          rules={rules}
          onSelectDoc={(id) => {
            setActiveDocId(id);
            setErrorMessage(null);
          }}
          onNewDoc={handleNewDoc}
          onResetPresets={handleResetPresets}
          onToggleRule={handleToggleRule}
        />

        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <FileText size={14} />
              Raw Private Vault & Live Redaction Diff
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                color: 'var(--ink-secondary)',
                cursor: 'pointer',
              }}
              title="Run Gemini Nano locally before regex to catch extra names"
            >
              <input
                type="checkbox"
                checked={enableOnDeviceNer}
                onChange={(e) => setEnableOnDeviceNer(e.target.checked)}
              />
              On-Device NER Assist
            </label>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 8 }}>
              <div>
                <label className="field-label" htmlFor="doc-title-input">
                  Case Title
                </label>
                <input
                  id="doc-title-input"
                  className="field-input"
                  value={activeDoc.title}
                  onChange={(e) => updateActiveDoc({ title: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="doc-domain-input">
                  Domain
                </label>
                <input
                  id="doc-domain-input"
                  className="field-input"
                  value={activeDoc.domain}
                  onChange={(e) => updateActiveDoc({ domain: e.target.value })}
                />
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
                  <ShieldCheck size={13} color="var(--ink-primary)" />
                  Raw Input (Stays 100% Inside Browser)
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="btn" style={{ padding: '4px 8px', fontSize: 11 }}>
                    <ImagePlus size={12} />
                    {attachment ? 'Replace Image' : 'Attach Image'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              </div>

              <textarea
                aria-label="Raw private note input"
                className="raw-textarea"
                value={activeDoc.rawText}
                onChange={(e) => updateActiveDoc({ rawText: e.target.value })}
                placeholder="Paste clinical notes, client emails, legal drafts, or incident logs containing sensitive fields..."
              />

              {attachment && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-hairline)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img
                      src={attachment.previewUrl}
                      alt={attachment.name}
                      style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 5 }}
                    />
                    <span style={{ fontSize: 12 }}>{attachment.name}</span>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => setAttachment(null)}
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                </div>
              )}
            </div>

            <SanitizedDiffViewer sanitization={liveSanitization} />
          </div>
        </section>

        <BriefPanel
          brief={activeDoc.lastBrief ?? null}
          tokenMap={liveSanitization.tokenMap}
          lastSource={activeDoc.lastSource}
          telemetry={telemetry}
          isRunning={isRunning}
          downloadProgress={downloadProgress}
          errorMessage={errorMessage}
          taskType={taskType}
          onTaskTypeChange={setTaskType}
          onRunPipeline={handleRunPipeline}
        />
      </main>

      {showSetupModal && (
        <FirebaseSetupModal
          onClose={() => setShowSetupModal(false)}
          onSaved={() => void refreshCapabilities()}
        />
      )}
    </div>
  );
}

export default App;
