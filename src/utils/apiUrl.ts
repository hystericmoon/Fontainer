import { DEFAULT_HOSTED_WEB_URL, isTauriDesktop } from '../services/desktopFontActivator';

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

/**
 * Resolves a backend API path.
 * - Web deployment (Vercel / dev server): relative `/api/...`
 * - Standalone Tauri desktop build (macOS .dmg / Windows .exe): prefixes `VITE_API_BASE_URL`
 *   or defaults to the hosted Vercel API when loaded from `tauri://` / `tauri.localhost`.
 */
export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (RAW_API_BASE) {
    return `${RAW_API_BASE}${normalizedPath}`;
  }
  if (
    isTauriDesktop() &&
    typeof window !== 'undefined' &&
    (window.location.protocol === 'tauri:' || window.location.hostname === 'tauri.localhost')
  ) {
    return `${DEFAULT_HOSTED_WEB_URL}${normalizedPath}`;
  }
  return normalizedPath;
}
