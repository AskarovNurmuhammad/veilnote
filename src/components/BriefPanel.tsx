import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Copy,
  Cpu,
  Play,
  Sparkles,
} from 'lucide-react';
import { rehydrateTextLocally } from '../lib/privacyShield';
import type {
  BriefTaskType,
  EffectiveExecutionSource,
  StructuredBrief,
  TelemetryEntry,
} from '../types/veilnote';

interface BriefPanelProps {
  brief: StructuredBrief | null;
  tokenMap: Record<string, string>;
  lastSource?: EffectiveExecutionSource;
  telemetry: TelemetryEntry[];
  isRunning: boolean;
  downloadProgress: number | null;
  errorMessage: string | null;
  taskType: BriefTaskType;
  onTaskTypeChange: (task: BriefTaskType) => void;
  onRunPipeline: () => void;
}

const TASK_OPTIONS: Array<{ value: BriefTaskType; label: string }> = [
  { value: 'full_brief', label: 'Full Brief' },
  { value: 'action_plan', label: 'Action Plan' },
  { value: 'draft_reply', label: 'Draft Reply' },
  { value: 'risk_audit', label: 'Risk Audit' },
];

function renderSourceBadge(source?: EffectiveExecutionSource) {
  if (!source) return null;
  if (source === 'on_device') {
    return (
      <span className="status-pill is-local">
        <Cpu size={12} />
        Executed On-Device
      </span>
    );
  }
  if (source === 'in_cloud') {
    return (
      <span className="status-pill is-cloud">
        <Cloud size={12} />
        Cloud Fallback (Sanitized)
      </span>
    );
  }
  if (source === 'demo_preview') {
    return (
      <span className="status-pill is-warn">
        <Sparkles size={12} />
        Local Preview Simulator
      </span>
    );
  }
  return <span className="status-pill">Local Rules</span>;
}

export function BriefPanel({
  brief,
  tokenMap,
  lastSource,
  telemetry,
  isRunning,
  downloadProgress,
  errorMessage,
  taskType,
  onTaskTypeChange,
  onRunPipeline,
}: BriefPanelProps) {
  const [rehydrateView, setRehydrateView] = useState(true);
  const [copied, setCopied] = useState(false);

  const maybeRehydrate = (text: string) =>
    rehydrateView ? rehydrateTextLocally(text, tokenMap) : text;

  const handleCopyReply = async () => {
    if (!brief?.draftReply) return;
    await navigator.clipboard.writeText(maybeRehydrate(brief.draftReply));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="veil-brief-col" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section className="card">
        <div className="card-header">
          <div className="card-title">
            <Sparkles size={14} />
            Hybrid AI Output
          </div>
          {renderSourceBadge(lastSource)}
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="seg-tabs">
              {TASK_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`seg-tab ${taskType === t.value ? 'is-active' : ''}`}
                  onClick={() => onTaskTypeChange(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-emerald"
              disabled={isRunning}
              onClick={onRunPipeline}
            >
              <Play size={13} />
              {isRunning ? 'Running Hybrid Pipeline...' : 'Run Hybrid AI'}
            </button>
          </div>

          {downloadProgress !== null && (
            <div className="status-pill is-local" style={{ borderRadius: 8 }}>
              Downloading on-device Gemini Nano weights: {Math.round(downloadProgress * 100)}%
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--accent-danger-bg)',
                color: 'var(--accent-danger)',
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              {errorMessage}
            </div>
          )}

          {!brief ? (
            <div
              style={{
                padding: '26px 16px',
                textAlign: 'center',
                border: '1px dashed var(--border-strong)',
                borderRadius: 10,
                color: 'var(--ink-secondary)',
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              Click <strong>Run Hybrid AI</strong> to scrub sensitive data locally in Stage 1 and
              generate a structured brief + reply in Stage 2 via Firebase AI Logic.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--border-hairline)',
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
                    {maybeRehydrate(brief.headline)}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 2 }}>
                    {brief.category} · Urgency:{' '}
                    <strong style={{ textTransform: 'uppercase', color: 'var(--ink-primary)' }}>
                      {brief.urgency}
                    </strong>
                  </div>
                </div>

                <div className="seg-tabs" title="Re-hydrate tokens locally in browser">
                  <button
                    type="button"
                    className={`seg-tab ${!rehydrateView ? 'is-active' : ''}`}
                    onClick={() => setRehydrateView(false)}
                  >
                    Sanitized Tokens
                  </button>
                  <button
                    type="button"
                    className={`seg-tab ${rehydrateView ? 'is-active' : ''}`}
                    onClick={() => setRehydrateView(true)}
                  >
                    Local Re-hydrated
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 4 }}>
                  EXECUTIVE SUMMARY
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
                  {maybeRehydrate(brief.executiveSummary)}
                </p>
              </div>

              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 6 }}>
                  ACTION PLAN
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {brief.actionItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border-hairline)',
                        fontSize: 12.5,
                      }}
                    >
                      <CheckCircle2 size={15} color="var(--accent-local)" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <div>{maybeRehydrate(item.task)}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>
                          Owner: {maybeRehydrate(item.owner)}
                        </div>
                      </div>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {brief.complianceFlags.length > 0 && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent-pii)', marginBottom: 6 }}>
                    COMPLIANCE & RISK FLAGS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {brief.complianceFlags.map((flag, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 7,
                          padding: '7px 10px',
                          borderRadius: 8,
                          background: 'var(--accent-pii-bg)',
                          fontSize: 12,
                          color: '#78350f',
                        }}
                      >
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{maybeRehydrate(flag)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-muted)' }}>
                    DRAFT EXTERNAL REPLY
                  </span>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={handleCopyReply}
                  >
                    <Copy size={12} />
                    {copied ? 'Copied' : 'Copy Reply'}
                  </button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: 10,
                    borderRadius: 8,
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-hairline)',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12.5,
                    lineHeight: 1.5,
                  }}
                >
                  {maybeRehydrate(brief.draftReply)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div className="card-title">Hybrid Inference Telemetry Ledger</div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
            {telemetry.length} events
          </span>
        </div>
        <div className="card-body" style={{ padding: 10 }}>
          {telemetry.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', padding: 6 }}>
              No inference runs recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {telemetry.slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: '7px 9px',
                    borderRadius: 8,
                    border: '1px solid var(--border-hairline)',
                    background: 'var(--bg-subtle)',
                    fontSize: 11.5,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{entry.stage}</span>
                    <span className="mono">
                      {entry.actualSource} · {entry.latencyMs}ms
                    </span>
                  </div>
                  <div style={{ color: 'var(--ink-secondary)', marginTop: 2 }}>
                    {entry.modelLabel} · {entry.piiCount} PII tokens protected
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
