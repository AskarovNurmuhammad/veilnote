import { deleteApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check';
import type { RuntimeFirebaseConfig } from '../types/veilnote';

const STORAGE_KEY = 'veilnote.firebaseConfig.v1';
export const DEFAULT_CLOUD_MODEL = 'gemini-3.8-flash';

export function loadFirebaseConfig(): RuntimeFirebaseConfig | null {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<RuntimeFirebaseConfig>;
        if (parsed.apiKey && parsed.projectId && parsed.appId) {
          return {
            apiKey: parsed.apiKey.trim(),
            authDomain:
              parsed.authDomain?.trim() || `${parsed.projectId.trim()}.firebaseapp.com`,
            projectId: parsed.projectId.trim(),
            storageBucket: parsed.storageBucket?.trim(),
            messagingSenderId: parsed.messagingSenderId?.trim(),
            appId: parsed.appId.trim(),
            appCheckSiteKey: parsed.appCheckSiteKey?.trim() || undefined,
            appCheckProvider:
              parsed.appCheckProvider === 'v3' ? 'v3' : 'enterprise',
            appCheckDebugToken: parsed.appCheckDebugToken?.trim() || undefined,
            cloudModel: parsed.cloudModel?.trim() || DEFAULT_CLOUD_MODEL,
          };
        }
      } catch {
        // Ignore malformed local overrides and fall through to env vars
      }
    }
  }

  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const envAppId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();

  if (envApiKey && envProjectId && envAppId) {
    const providerEnv = import.meta.env.VITE_FIREBASE_APP_CHECK_PROVIDER?.trim();
    return {
      apiKey: envApiKey,
      authDomain:
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ||
        `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
      appId: envAppId,
      appCheckSiteKey: import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim() || undefined,
      appCheckProvider: providerEnv === 'v3' ? 'v3' : 'enterprise',
      appCheckDebugToken:
        import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?.trim() || undefined,
      cloudModel: import.meta.env.VITE_FIREBASE_AI_MODEL?.trim() || DEFAULT_CLOUD_MODEL,
    };
  }

  return null;
}

export async function saveFirebaseConfig(config: RuntimeFirebaseConfig | null): Promise<void> {
  if (typeof window !== 'undefined') {
    if (config) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Clean up any existing Firebase app instances so new credentials take effect cleanly
  const apps = getApps();
  await Promise.all(apps.map((app) => deleteApp(app)));
  cachedHandle = null;
}

export interface FirebaseAIHandle {
  app: FirebaseApp;
  ai: AI;
  appCheck: AppCheck | null;
  config: RuntimeFirebaseConfig;
}

let cachedHandle: FirebaseAIHandle | null = null;

/**
 * Initializes Firebase App, Firebase App Check (when site key is provided), and
 * Firebase AI Logic with GoogleAIBackend for hybrid on-device + cloud execution.
 */
export function getFirebaseAIHandle(): FirebaseAIHandle | null {
  const config = loadFirebaseConfig();
  if (!config) return null;

  if (cachedHandle && cachedHandle.config.apiKey === config.apiKey && cachedHandle.config.projectId === config.projectId) {
    return cachedHandle;
  }

  const existing = getApps().find((a) => a.name === 'veilnote-runtime');
  const app =
    existing ??
    initializeApp(
      {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      },
      'veilnote-runtime'
    );

  let appCheck: AppCheck | null = null;
  if (config.appCheckSiteKey && typeof window !== 'undefined') {
    try {
      if (config.appCheckDebugToken) {
        (window as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
          config.appCheckDebugToken === 'true' ? true : config.appCheckDebugToken;
      }
      const provider =
        config.appCheckProvider === 'v3'
          ? new ReCaptchaV3Provider(config.appCheckSiteKey)
          : new ReCaptchaEnterpriseProvider(config.appCheckSiteKey);
      appCheck = initializeAppCheck(app, {
        provider,
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      // App Check may already be initialized or running in test environment
      appCheck = null;
    }
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });

  cachedHandle = { app, ai, appCheck, config };
  return cachedHandle;
}
