type RuntimeEnv = typeof globalThis & {
  location?: { hostname?: string };
  process?: {
    env?: Record<string, string | undefined>;
  };
};

declare const process: { env?: Record<string, string | undefined> } | undefined;

export function getAIEndpoint(): string | null {
  const runtime = globalThis as RuntimeEnv;
  const configured = process?.env?.EXPO_PUBLIC_KIBBO_AI_URL
    ?? process?.env?.EXPO_PUBLIC_AP_GRADING_URL
    ?? runtime.process?.env?.EXPO_PUBLIC_KIBBO_AI_URL
    ?? runtime.process?.env?.EXPO_PUBLIC_AP_GRADING_URL;
  if (configured) return configured.replace(/\/$/, '');

  // Web dev convenience. Native builds should use EXPO_PUBLIC_AP_GRADING_URL
  // because localhost would point at the phone, not the Mac running the server.
  const hostname = runtime.location?.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8787';
  }
  if (hostname) {
    return '/api';
  }

  return null;
}
