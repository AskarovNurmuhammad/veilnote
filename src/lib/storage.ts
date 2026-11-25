import type { TelemetryEntry, VaultDocument } from '../types/veilnote';
import { PRESET_DOCUMENTS } from './presets';

const DOCS_KEY = 'veilnote.documents.v1';
const TELEMETRY_KEY = 'veilnote.telemetry.v1';

export function loadVaultDocuments(): VaultDocument[] {
  if (typeof window === 'undefined') return PRESET_DOCUMENTS;
  const raw = window.localStorage.getItem(DOCS_KEY);
  if (!raw) return PRESET_DOCUMENTS;
  try {
    const parsed = JSON.parse(raw) as VaultDocument[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : PRESET_DOCUMENTS;
  } catch {
    return PRESET_DOCUMENTS;
  }
}

export function saveVaultDocuments(docs: VaultDocument[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

export function loadTelemetryLedger(): TelemetryEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(TELEMETRY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TelemetryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function saveTelemetryLedger(entries: TelemetryEntry[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TELEMETRY_KEY, JSON.stringify(entries.slice(0, 40)));
}
