import {
  getGenerativeModel,
  InferenceMode,
  InferenceSource,
  type Part,
} from 'firebase/ai';
import type {
  BriefTaskType,
  EffectiveExecutionSource,
  EnvironmentCapabilities,
  ImageAttachment,
  PiiCategory,
  RedactionRuleSet,
  SanitizationResult,
  StructuredBrief,
  TelemetryEntry,
} from '../types/veilnote';
import { DEFAULT_CLOUD_MODEL, getFirebaseAIHandle, loadFirebaseConfig } from './firebaseClient';
import { extractJsonObject, sanitizeTextLocally } from './privacyShield';

declare global {
  interface Window {
    LanguageModel?: {
      availability?: () => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
      create?: (options?: Record<string, unknown>) => Promise<{
        prompt: (input: string) => Promise<string>;
        destroy?: () => void;
      }>;
    };
  }
}

export async function probeCapabilities(): Promise<EnvironmentCapabilities> {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const fbConfig = loadFirebaseConfig();

  let chromeBuiltInAI: EnvironmentCapabilities['chromeBuiltInAI'] = 'unavailable';
  if (typeof window !== 'undefined' && window.LanguageModel?.availability) {
    try {
      chromeBuiltInAI = await window.LanguageModel.availability();
    } catch {
      chromeBuiltInAI = 'unavailable';
    }
  }

  return {
    online,
    chromeBuiltInAI,
    firebaseConfigured: Boolean(fbConfig),
    appCheckEnabled: Boolean(fbConfig?.appCheckSiteKey),
    cloudModel: fbConfig?.cloudModel || DEFAULT_CLOUD_MODEL,
  };
}

function makeTelemetryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const SYSTEM_INSTRUCTION = `You are VeilNote's structured triage analyst.
You ONLY receive redacted text where sensitive values have already been replaced locally by tokens like [PERSON_1], [EMAIL_1], [PHONE_1], [FINANCIAL_1], [GOV_ID_1], [SECRET_1], [ADDRESS_1], [DATE_1].
Rules:
1. Preserve every redaction token (e.g., [PERSON_1]) verbatim in your JSON output so the user's browser can re-hydrate them locally.
2. Never invent missing personal details.
3. Return ONLY valid JSON matching this schema:
{
  "headline": "concise 6-10 word title",
  "category": "domain category",
  "urgency": "low" | "medium" | "high" | "critical",
  "executiveSummary": "2-3 sentence synthesis",
  "actionItems": [{"task": "specific next step", "owner": "role or token", "priority": "P1" | "P2" | "P3"}],
  "complianceFlags": ["list of risks, exposed secrets, or policy flags"],
  "draftReply": "professional ready-to-send response preserving tokens"
}`;

function buildTaskPrompt(sanitizedText: string, taskType: BriefTaskType): string {
  const focusMap: Record<BriefTaskType, string> = {
    full_brief: 'Provide a complete executive summary, prioritized action items, compliance risks, and a professional draft reply.',
    action_plan: 'Focus heavily on concrete, ordered P1/P2/P3 execution steps and clear ownership.',
    draft_reply: 'Focus on crafting an empathetic, crisp, ready-to-send draftReply while still populating brief metadata.',
    risk_audit: 'Focus deeply on security, legal, clinical, or financial complianceFlags and mitigation actions.',
  };

  return `Task focus: ${focusMap[taskType]}

Redacted Input:
"""
${sanitizedText}
"""`;
}

function normalizeBrief(
  parsed: Record<string, unknown> | null,
  fallbackText: string
): StructuredBrief {
  if (!parsed) {
    return {
      headline: 'Hybrid Analysis Complete',
      category: 'General Triage',
      urgency: 'medium',
      executiveSummary: fallbackText.slice(0, 420) || 'No content generated.',
      actionItems: [
        { task: 'Review generated brief output', owner: 'Operator', priority: 'P2' },
      ],
      complianceFlags: [],
      draftReply: fallbackText,
    };
  }

  const urgencyRaw = String(parsed.urgency ?? 'medium').toLowerCase();
  const urgency: StructuredBrief['urgency'] =
    urgencyRaw === 'low' ||
    urgencyRaw === 'medium' ||
    urgencyRaw === 'high' ||
    urgencyRaw === 'critical'
      ? urgencyRaw
      : 'medium';

  const rawActions = Array.isArray(parsed.actionItems) ? parsed.actionItems : [];
  const actionItems = rawActions
    .map((item) => {
      const obj = (item ?? {}) as Record<string, unknown>;
      const prioRaw = String(obj.priority ?? 'P2').toUpperCase();
      const priority: 'P1' | 'P2' | 'P3' =
        prioRaw === 'P1' || prioRaw === 'P2' || prioRaw === 'P3' ? prioRaw : 'P2';
      return {
        task: String(obj.task ?? '').trim(),
        owner: String(obj.owner ?? 'Owner').trim(),
        priority,
      };
    })
    .filter((a) => a.task.length > 0);

  const flags = Array.isArray(parsed.complianceFlags)
    ? parsed.complianceFlags.map((f) => String(f)).filter(Boolean)
    : [];

  return {
    headline: String(parsed.headline ?? 'Sanitized Case Brief').trim(),
    category: String(parsed.category ?? 'General').trim(),
    urgency,
    executiveSummary: String(parsed.executiveSummary ?? '').trim(),
    actionItems:
      actionItems.length > 0
        ? actionItems
        : [{ task: 'Review sanitized brief and confirm next steps', owner: 'Operator', priority: 'P2' }],
    complianceFlags: flags,
    draftReply: String(parsed.draftReply ?? '').trim(),
  };
}

/**
 * Stage 1: Always runs locally on-device. Uses deterministic pattern scanner plus
 * optional on-device Gemini Nano entity pass (via Firebase ONLY_ON_DEVICE or Chrome LanguageModel)
 * to catch contextual names before any text ever touches the network.
 */
export async function runLocalPrivacyShield(
  rawText: string,
  rules: RedactionRuleSet,
  enableOnDeviceNer: boolean
): Promise<{
  sanitization: SanitizationResult;
  telemetry: TelemetryEntry;
}> {
  const t0 = performance.now();
  const extraEntities: Array<{ value: string; category: PiiCategory }> = [];
  let actualSource: EffectiveExecutionSource = 'local_rules';
  let modelLabel = 'Deterministic PII Scanner';
  let note = 'Regex + heuristic vault executed locally';

  if (enableOnDeviceNer && rules.PERSON && rawText.trim().length > 0) {
    const handle = getFirebaseAIHandle();
    const nerPrompt = `Identify ONLY person full names or company names in the text below that should be redacted. Return JSON: {"entities":[{"value":"exact substring","category":"PERSON"}]}. Text:\n${rawText.slice(0, 1800)}`;

    if (handle) {
      try {
        const nanoOnly = getGenerativeModel(handle.ai, {
          mode: InferenceMode.ONLY_ON_DEVICE,
        });
        const res = await nanoOnly.generateContent(nerPrompt);
        const parsed = extractJsonObject(res.response.text());
        if (parsed && Array.isArray(parsed.entities)) {
          for (const entry of parsed.entities) {
            const obj = entry as Record<string, unknown>;
            if (typeof obj.value === 'string') {
              extraEntities.push({ value: obj.value, category: 'PERSON' });
            }
          }
        }
        actualSource = res.response.inferenceSource ?? InferenceSource.ON_DEVICE;
        modelLabel = 'Gemini Nano (Firebase ONLY_ON_DEVICE)';
        note = 'Local deterministic + on-device Nano contextual NER';
      } catch {
        // On-device model unavailable in current browser; deterministic scanner still protects PII
        note = 'On-device Nano unavailable; deterministic local shield enforced';
      }
    } else if (typeof window !== 'undefined' && window.LanguageModel?.create && window.LanguageModel?.availability) {
      try {
        const avail = await window.LanguageModel.availability();
        if (avail === 'available') {
          const session = await window.LanguageModel.create();
          try {
            const out = await session.prompt(nerPrompt);
            const parsed = extractJsonObject(out);
            if (parsed && Array.isArray(parsed.entities)) {
              for (const entry of parsed.entities) {
                const obj = entry as Record<string, unknown>;
                if (typeof obj.value === 'string') {
                  extraEntities.push({ value: obj.value, category: 'PERSON' });
                }
              }
            }
            actualSource = InferenceSource.ON_DEVICE;
            modelLabel = 'Chrome Gemini Nano (Prompt API)';
            note = 'Local deterministic + Chrome built-in Gemini Nano NER';
          } finally {
            session.destroy?.();
          }
        }
      } catch {
        note = 'Deterministic local shield enforced';
      }
    }
  }

  const sanitization = sanitizeTextLocally(rawText, rules, extraEntities);
  const latencyMs = Math.max(1, Math.round(performance.now() - t0));

  return {
    sanitization,
    telemetry: {
      id: makeTelemetryId(),
      timestamp: new Date().toISOString(),
      stage: 'Stage 1 · Local Shield',
      requestedMode: InferenceMode.ONLY_ON_DEVICE,
      actualSource,
      latencyMs,
      modelLabel,
      piiCount: sanitization.entities.length,
      note,
    },
  };
}

function buildPreviewBrief(sanitizedText: string, taskType: BriefTaskType): StructuredBrief {
  const firstToken = sanitizedText.match(/\[[A-Z_]+_\d+\]/)?.[0] ?? '[PERSON_1]';
  const hasSecret = sanitizedText.includes('[SECRET_');
  const hasFinancial = sanitizedText.includes('[FINANCIAL_');
  const hasHealthCue = /migraine|vision|pharmacy|insulin|patient|symptom/i.test(sanitizedText);

  const flags: string[] = [];
  if (hasSecret) {
    flags.push('Exposed credential token scrubbed locally before cloud escalation — rotate secret immediately.');
  }
  if (hasFinancial) {
    flags.push('Financial identifier isolated inside local browser vault; zero raw account digits transmitted.');
  }
  if (hasHealthCue) {
    flags.push('Clinical time-sensitive note detected; verify escalation with licensed practitioner.');
  }
  if (flags.length === 0) {
    flags.push('Preview simulator active: connect your Firebase AI Logic project to run live cloud Gemini fallback.');
  }

  const headlineMap: Record<BriefTaskType, string> = {
    full_brief: `Sanitized Intake Brief for ${firstToken}`,
    action_plan: `Prioritized Execution Plan for ${firstToken}`,
    draft_reply: `Ready-to-Send Response Draft for ${firstToken}`,
    risk_audit: `Privacy & Compliance Audit for ${firstToken}`,
  };

  return {
    headline: headlineMap[taskType],
    category: hasHealthCue ? 'Clinical Triage' : hasSecret ? 'Security Ops' : 'Operational Intake',
    urgency: hasSecret || hasHealthCue ? 'high' : 'medium',
    executiveSummary:
      'Local preview generated from the scrubbed payload only. Sensitive entities remain inside your browser vault while sanitized tokens preserve full conversational context.',
    actionItems: [
      {
        task: `Verify priority follow-up requirements for ${firstToken}`,
        owner: 'Intake Coordinator',
        priority: 'P1',
      },
      {
        task: hasSecret
          ? 'Revoke and reissue compromised credential flagged by Stage 1 Shield'
          : 'Confirm timeline and send re-hydrated response from local browser view',
        owner: 'Operations Lead',
        priority: hasSecret ? 'P1' : 'P2',
      },
      {
        task: 'Archive sanitized audit trail after resolution',
        owner: 'Compliance',
        priority: 'P3',
      },
    ],
    complianceFlags: flags,
    draftReply: `Hello ${firstToken},\n\nThank you for sending over these details. We have reviewed your case and prioritized the immediate next steps. Please confirm your availability today so we can finalize resolution without delay.\n\nBest regards,\nSupport Team`,
  };
}

export interface HybridExecutionOptions {
  sanitization: SanitizationResult;
  mode: InferenceMode;
  taskType: BriefTaskType;
  attachment?: ImageAttachment | null;
  allowDemoPreviewWhenUnconfigured?: boolean;
  onDownloadProgress?: (loaded: number) => void;
}

/**
 * Stage 2: Executes Firebase AI Logic Hybrid Inference ONLY on the sanitized text
 * (plus optional image attachment), recording the exact `inferenceSource` returned by the SDK.
 */
export async function runHybridBrief(
  options: HybridExecutionOptions
): Promise<{
  brief: StructuredBrief;
  telemetry: TelemetryEntry;
}> {
  const {
    sanitization,
    mode,
    taskType,
    attachment,
    allowDemoPreviewWhenUnconfigured = true,
    onDownloadProgress,
  } = options;

  const t0 = performance.now();
  const handle = getFirebaseAIHandle();
  const promptText = buildTaskPrompt(sanitization.sanitizedText, taskType);

  if (!handle) {
    if (!allowDemoPreviewWhenUnconfigured) {
      throw new Error(
        'Firebase AI Logic is not configured. Add your Firebase keys in Setup or .env.local.'
      );
    }

    // Attempt Chrome built-in AI directly if available on device even before Firebase keys are entered
    if (
      mode !== InferenceMode.ONLY_IN_CLOUD &&
      typeof window !== 'undefined' &&
      window.LanguageModel?.availability &&
      window.LanguageModel?.create
    ) {
      try {
        const avail = await window.LanguageModel.availability();
        if (avail === 'available') {
          const session = await window.LanguageModel.create({
            initialPrompts: [{ role: 'system', content: [{ type: 'text', value: SYSTEM_INSTRUCTION }] }],
          });
          try {
            const rawOut = await session.prompt(promptText);
            const parsed = extractJsonObject(rawOut);
            return {
              brief: normalizeBrief(parsed, rawOut),
              telemetry: {
                id: makeTelemetryId(),
                timestamp: new Date().toISOString(),
                stage: 'Stage 2 · Hybrid Brief',
                requestedMode: mode,
                actualSource: InferenceSource.ON_DEVICE,
                latencyMs: Math.max(1, Math.round(performance.now() - t0)),
                modelLabel: 'Chrome Gemini Nano (On-Device)',
                piiCount: sanitization.entities.length,
                note: 'Executed purely on-device without cloud credentials',
              },
            };
          } finally {
            session.destroy?.();
          }
        }
      } catch {
        // Fall through to local preview simulator
      }
    }

    const brief = buildPreviewBrief(sanitization.sanitizedText, taskType);
    return {
      brief,
      telemetry: {
        id: makeTelemetryId(),
        timestamp: new Date().toISOString(),
        stage: 'Stage 2 · Hybrid Brief',
        requestedMode: mode,
        actualSource: 'demo_preview',
        latencyMs: Math.max(1, Math.round(performance.now() - t0)),
        modelLabel: 'Local Preview Simulator (Connect Firebase for Live Cloud)',
        piiCount: sanitization.entities.length,
        note: 'Simulated brief on sanitized text; add Firebase config for live Gemini Flash fallback',
      },
    };
  }

  const cloudModel = handle.config.cloudModel || DEFAULT_CLOUD_MODEL;
  const model = getGenerativeModel(handle.ai, {
    mode,
    onDeviceParams: {
      createOptions: {
        initialPrompts: [
          {
            role: 'system',
            content: [{ type: 'text', value: SYSTEM_INSTRUCTION }],
          },
        ],
        monitor: onDownloadProgress
          ? (monitor) => {
              monitor.addEventListener('downloadprogress', (event) => {
                onDownloadProgress(event.loaded);
              });
            }
          : undefined,
      },
    },
    inCloudParams: {
      model: cloudModel,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    },
  });

  const parts: Array<string | Part> = [promptText];
  if (attachment) {
    parts.push({
      type: 'inlineData',
      inlineData: {
        data: attachment.base64Data,
        mimeType: attachment.mimeType,
      },
    });
  }

  const result = await model.generateContent(parts);
  const rawText = result.response.text();
  const parsed = extractJsonObject(rawText);
  const actualSource: EffectiveExecutionSource =
    result.response.inferenceSource ??
    (mode === InferenceMode.ONLY_ON_DEVICE
      ? InferenceSource.ON_DEVICE
      : InferenceSource.IN_CLOUD);

  return {
    brief: normalizeBrief(parsed, rawText),
    telemetry: {
      id: makeTelemetryId(),
      timestamp: new Date().toISOString(),
      stage: 'Stage 2 · Hybrid Brief',
      requestedMode: mode,
      actualSource,
      latencyMs: Math.max(1, Math.round(performance.now() - t0)),
      modelLabel:
        actualSource === InferenceSource.ON_DEVICE
          ? 'Gemini Nano (Firebase AI On-Device)'
          : `${cloudModel} (Firebase AI Cloud)`,
      piiCount: sanitization.entities.length,
      note: `Firebase AI Logic resolved via ${actualSource} (App Check ${handle.appCheck ? 'active' : 'unconfigured'})`,
    },
  };
}
