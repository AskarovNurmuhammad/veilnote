# Devpost Submission Copy — VeilNote (#BuildHybridAI 2026)

## Project Name
VeilNote

## Elevator Pitch (Tagline, < 200 chars)
Zero-leak hybrid AI workspace: scrub sensitive PII locally on-device with Gemini Nano before escalating sanitized briefs to Gemini Flash via Firebase AI Logic.

## Inspiration
Clinicians, legal freelancers, support engineers, and NGO field teams constantly work with sensitive notes containing patient names, phone numbers, IBANs, and leaked credentials. They want AI help to triage cases and draft replies—but cannot paste raw PII into cloud LLMs, and field teams often operate offline.

VeilNote solves this by splitting intelligence across **on-device** and **cloud** tiers instead of treating them as interchangeable.

## What it does
- **Stage 1 · Local Privacy Shield:** Scans raw notes locally in the browser using deterministic pattern rules plus optional on-device **Gemini Nano** (`InferenceMode.ONLY_ON_DEVICE`), replacing PII and secrets with reversible tokens (`[PERSON_1]`, `[EMAIL_1]`, `[PHONE_1]`, `[SECRET_1]`). Raw values never leave the browser vault.
- **Stage 2 · Hybrid Brief & Action Plan:** Sends **only the sanitized payload** (plus optional image attachments) through `firebase/ai` (`getGenerativeModel` with `InferenceMode.PREFER_ON_DEVICE`), automatically running locally on Gemini Nano when available and falling back to `gemini-2.5-flash` in the cloud when needed.
- **Local Re-hydration & Telemetry:** Restores real names and contacts strictly inside the browser for one-click copying, while logging exact `inferenceSource` (`on_device` vs `in_cloud`), latency, and scrubbed byte counts in a live Telemetry Ledger.

## How we built it
- **Frontend:** React 19, TypeScript, Vite
- **Hybrid AI:** `firebase@13.4.0` (`firebase/ai` with `GoogleAIBackend`, `InferenceMode`, `InferenceSource`, `onDeviceParams` download monitor, `inCloudParams` structured JSON output)
- **Security:** Firebase App Check (`ReCaptchaV3Provider`) + strict client-side PII vault isolation
- **Testing:** Vitest unit suite verifying PII redaction, token stability, category toggles, and local re-hydration

## Challenges we ran into
- Balancing deterministic precision (catching API keys, IBANs, and phone numbers reliably) with contextual entity recognition on-device without overlapping token replacements.
- Preserving coherent cross-paragraph reasoning in cloud fallback by assigning deterministic, reusable per-entity tokens (`[PERSON_1]`) so the cloud model understands entity relationships without seeing any private data.

## Accomplishments that we're proud of
- Zero-leak architecture where Stage 2 receives 0 raw PII bytes while still producing personalized, re-hydratable action plans and ready-to-send replies.
- Real-time `inferenceSource` telemetry proving when Gemini Nano executes locally versus when Firebase AI Logic escalates to Cloud Gemini.

## What's next for VeilNote
- Encrypted Firestore sync for multi-device team vaults
- Browser extension companion to scrub sensitive tickets directly inside webmail and helpdesks

---

## 2–3 Minute Demo Video Storyboard
1. **0:00–0:25 — The Problem:** Show the *Outpatient Intake Follow-up* or *Client Scope Escalation* note with real names, DOB, IBAN, and exposed API key (`sk-live...`). Explain why pasting this into a cloud LLM violates privacy.
2. **0:25–0:55 — Stage 1 Local Shield:** Show live redaction tokens (`[PERSON_1]`, `[SECRET_1]`, `[FINANCIAL_1]`), toggle `Reveal Local Vault` on/off, and highlight `0 PII bytes exposed`.
3. **0:55–1:40 — Stage 2 Hybrid AI (`firebase/ai`):** Switch `InferenceMode` (`PREFER_ON_DEVICE` / `ONLY_ON_DEVICE` / `ONLY_IN_CLOUD`), click **Run Hybrid AI**, show the structured brief, compliance flags, and **Telemetry Ledger** displaying `inferenceSource` + latency.
4. **1:40–2:15 — Local Re-hydration & Multimodal:** Toggle between `Sanitized Tokens` and `Local Re-hydrated`, copy the ready-to-send reply, and optionally attach a sample image.
5. **2:15–2:30 — Closing:** Show Firebase Setup / App Check badge and GitHub open-source repo.
