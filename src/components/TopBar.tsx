import { InferenceMode } from 'firebase/ai';
import {
  Cloud,
  Cpu,
  Lock,
  Settings,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { EnvironmentCapabilities } from '../types/veilnote';

interface TopBarProps {
  capabilities: EnvironmentCapabilities;
  mode: InferenceMode;
  onModeChange: (mode: InferenceMode) => void;
  onOpenSetup: () => void;
}

const MODE_LABELS: Array<{ value: InferenceMode; label: string }> = [
  { value: InferenceMode.PREFER_ON_DEVICE, label: 'Hybrid: Prefer On-Device' },
  { value: InferenceMode.ONLY_ON_DEVICE, label: 'Strict: Only On-Device' },
  { value: InferenceMode.PREFER_IN_CLOUD, label: 'Hybrid: Prefer Cloud' },
  { value: InferenceMode.ONLY_IN_CLOUD, label: 'Cloud Only (Sanitized)' },
];

export function TopBar({
  capabilities,
  mode,
  onModeChange,
  onOpenSetup,
}: TopBarProps) {
  const nanoBadgeClass =
    capabilities.chromeBuiltInAI === 'available'
      ? 'status-pill is-local'
      : 'status-pill';

  return (
    <header className="veil-topbar">
      <div className="veil-brand">
        <div className="veil-logo" aria-hidden="true">
          <Lock size={17} />
        </div>
        <div>
          <div className="veil-brand-title">VeilNote</div>
          <div className="veil-brand-sub">
            Zero-Leak Privacy Shield · Firebase AI Logic Hybrid Workspace
          </div>
        </div>
      </div>

      <div className="veil-status-row">
        <span
          className={`status-pill ${capabilities.online ? 'is-local' : 'is-warn'}`}
          title="Browser network connectivity"
        >
          {capabilities.online ? <Wifi size={13} /> : <WifiOff size={13} />}
          {capabilities.online ? 'Online' : 'Offline Mode'}
        </span>

        <span
          className={nanoBadgeClass}
          title="Chrome Built-in AI (Gemini Nano) availability"
        >
          <Cpu size={13} />
          Nano: {capabilities.chromeBuiltInAI}
        </span>

        <span
          className={`status-pill ${capabilities.firebaseConfigured ? 'is-cloud' : 'is-warn'}`}
          title="Firebase AI Logic cloud fallback status"
        >
          <Cloud size={13} />
          {capabilities.firebaseConfigured
            ? `Cloud: ${capabilities.cloudModel}`
            : 'Cloud: Setup Required'}
        </span>

        <span
          className={`status-pill ${capabilities.appCheckEnabled ? 'is-local' : ''}`}
          title="Firebase App Check protection"
        >
          <ShieldCheck size={13} />
          {capabilities.appCheckEnabled ? 'App Check Active' : 'App Check Off'}
        </span>

        <select
          aria-label="Firebase AI Inference Mode"
          className="mode-select"
          value={mode}
          onChange={(e) => onModeChange(e.target.value as InferenceMode)}
        >
          {MODE_LABELS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button type="button" className="btn" onClick={onOpenSetup}>
          <Settings size={14} />
          Firebase Setup
        </button>
      </div>
    </header>
  );
}
