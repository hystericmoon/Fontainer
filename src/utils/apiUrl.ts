const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

/**
 * Resolves a backend API path.
 * - Web deployment (Cloud Run / dev server): relative `/api/...`
 * - Standalone Tauri macOS .dmg build: prefixes `VITE_API_BASE_URL`
 */
export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return RAW_API_BASE ? `${RAW_API_BASE}${normalizedPath}` : normalizedPath;
}
