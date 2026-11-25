# VeilNote — Zero-Leak Hybrid AI Workspace

Built for **#BuildHybridAI 2026** using **Firebase AI Logic** (`firebase/ai`), **Chrome Gemini Nano** on-device inference, and **Firebase App Check**.

## Why Hybrid AI?

Teams handling clinical intake notes, client contracts, security incidents, or field aid reports want AI synthesis—but cannot send raw PII, credentials, or financial identifiers to cloud models.

VeilNote solves this with a **two-stage hybrid architecture**:

1. **Stage 1 · Local Privacy Shield (On-Device First):** Runs deterministically inside the browser plus optional on-device **Gemini Nano** (`InferenceMode.ONLY_ON_DEVICE`) to detect and replace names, emails, phone numbers, IBANs, government IDs, addresses, and API keys with reversible tokens (`[PERSON_1]`, `[SECRET_1]`, etc.). Raw values stay inside the local browser vault.
2. **Stage 2 · Hybrid Brief & Escalation (`firebase/ai`):** Calls `getGenerativeModel(ai, { mode, onDeviceParams, inCloudParams })` using **only the scrubbed payload** (plus optional PNG/JPEG attachments). When `PREFER_ON_DEVICE` is selected, inference runs locally on Gemini Nano when available and seamlessly falls back to `gemini-2.5-flash` in the cloud when needed.
3. **Local Re-hydration:** After generation completes, tokens in the structured brief and draft reply are restored strictly inside the browser for one-click copying.

## Key Features

- Real `firebase/ai` hybrid routing (`PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `PREFER_IN_CLOUD`, `ONLY_IN_CLOUD`)
- Live `inferenceSource` telemetry ledger (`on_device` vs `in_cloud`, latency, scrubbed bytes)
- Firebase App Check (`ReCaptchaV3Provider`) integration
- Multimodal image attachment support (`inlineData` JPEG/PNG/WebP)
- 4 realistic domain intake scenarios + custom vault persistence

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

### Configuring Firebase AI Logic & App Check

1. Create a Firebase project in the Firebase Console and register a Web App.
2. Enable **AI Logic (Gemini Developer API)**.
3. Enable **App Check** (reCAPTCHA v3) and copy the site key.
4. Populate `.env.local` **or** click **Firebase Setup** in the top bar of VeilNote to paste your config directly at runtime.

### Testing On-Device Gemini Nano in Chrome

In Chrome desktop supporting Built-in AI, ensure `#optimization-guide-on-device-model` and `#prompt-api-for-gemini-nano` are enabled in `chrome://flags` if required by your Chrome build. VeilNote automatically detects `window.LanguageModel.availability()` and switches Stage 1 and Stage 2 to on-device execution when ready.

## Scripts

- `npm run dev` — Start Vite development server
- `npm run build` — Type-check and build production bundle
- `npm run test` — Run unit tests with Vitest
- `npm run lint` — Lint source files with oxlint

## License

Apache-2.0 — see [LICENSE](LICENSE).
