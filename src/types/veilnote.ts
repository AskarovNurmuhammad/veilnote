import type { InferenceMode, InferenceSource } from 'firebase/ai';

export type PiiCategory =
  | 'EMAIL'
  | 'PHONE'
  | 'PERSON'
  | 'FINANCIAL'
  | 'GOV_ID'
  | 'SECRET'
  | 'ADDRESS'
  | 'DATE';

export interface RedactionRuleSet {
  EMAIL: boolean;
  PHONE: boolean;
  PERSON: boolean;
  FINANCIAL: boolean;
  GOV_ID: boolean;
  SECRET: boolean;
  ADDRESS: boolean;
  DATE: boolean;
}

export interface RedactedEntity {
  token: string;
  category: PiiCategory;
  original: string;
  start: number;
  end: number;
  source: 'regex' | 'on_device_ai';
}

export interface SanitizationResult {
  rawText: string;
  sanitizedText: string;
  entities: RedactedEntity[];
  tokenMap: Record<string, string>;
  bytesRaw: number;
  bytesScrubbed: number;
}

export type BriefTaskType = 'full_brief' | 'action_plan' | 'draft_reply' | 'risk_audit';

export interface StructuredBrief {
  headline: string;
  category: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  executiveSummary: string;
  actionItems: Array<{
    task: string;
    owner: string;
    priority: 'P1' | 'P2' | 'P3';
  }>;
  complianceFlags: string[];
  draftReply: string;
}

export type EffectiveExecutionSource = InferenceSource | 'local_rules' | 'demo_preview';

export interface TelemetryEntry {
  id: string;
  timestamp: string;
  stage: 'Stage 1 · Local Shield' | 'Stage 2 · Hybrid Brief';
  requestedMode: InferenceMode;
  actualSource: EffectiveExecutionSource;
  latencyMs: number;
  modelLabel: string;
  piiCount: number;
  note: string;
}

export interface ImageAttachment {
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  base64Data: string;
  previewUrl: string;
}

export interface VaultDocument {
  id: string;
  title: string;
  domain: string;
  rawText: string;
  updatedAt: string;
  lastBrief?: StructuredBrief;
  lastEntities?: RedactedEntity[];
  lastSource?: EffectiveExecutionSource;
}

export interface RuntimeFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  appCheckSiteKey?: string;
  cloudModel?: string;
}

export interface EnvironmentCapabilities {
  online: boolean;
  chromeBuiltInAI: 'available' | 'downloadable' | 'downloading' | 'unavailable';
  firebaseConfigured: boolean;
  appCheckEnabled: boolean;
  cloudModel: string;
}
