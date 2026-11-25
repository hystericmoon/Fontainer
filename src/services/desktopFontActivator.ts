import { invoke } from '@tauri-apps/api/core';

export interface OsFontStatus {
  platform: 'macos' | 'windows' | 'linux' | string;
  fontsDir: string;
  activeFontIds: string[];
  activeFileCount: number;
}

export interface OsActivationResult {
  fontId: string;
  installed: boolean;
  alreadyActive: boolean;
  fileCount: number;
  fontsDir: string;
}

export interface OsDeactivationResult {
  fontId: string;
  removedFiles: number;
}

export interface DesktopAuthTokens {
  idToken: string;
  accessToken: string | null;
}

export interface GoogleFontStylePayload {
  weight: number;
  italic: boolean;
}

export interface NativeScannedSystemStyle {
  name: string;
  weight: number;
  italic: boolean;
  postScriptName: string;
  fileSizeKb: number;
}

export interface NativeScannedSystemFont {
  family: string;
  format: string;
  sourcePath: string;
  styles: NativeScannedSystemStyle[];
}

export const DEFAULT_HOSTED_WEB_URL = 'https://fontainer-alpha.vercel.app';

/**
 * Returns true only when running inside the Fontainer Tauri v2 desktop app
 * (macOS .app/.dmg or Windows .exe). Always false on Vercel web / browsers.
 */
export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Resolves the hosted web app base URL used by Tauri desktop for API requests
 * and system-browser Google sign-in.
 */
export function getDesktopWebBaseUrl(): string {
  const configured = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '');
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return window.location.origin;
  }
  return DEFAULT_HOSTED_WEB_URL;
}

/**
 * Deterministic Google Drive font ID helper so the exact same Drive file shares
 * the same Firestore fontMeta document across Mac, Windows, and Vercel Web.
 */
export function makeDriveFontId(fileId: string): string {
  const cleaned = fileId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 118);
  return `gdrive-${cleaned}`;
}

export function extractDriveFileId(fontId: string): string | null {
  if (!fontId.startsWith('gdrive-')) return null;
  const raw = fontId.slice('gdrive-'.length).trim();
  return raw.length > 0 ? raw : null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function getOsFontStatus(): Promise<OsFontStatus | null> {
  if (!isTauriDesktop()) return null;
  return invoke<OsFontStatus>('get_os_font_status');
}

export async function activateGoogleFontInOs(
  fontId: string,
  familyName: string,
  styles: GoogleFontStylePayload[],
): Promise<OsActivationResult | null> {
  if (!isTauriDesktop()) return null;
  return invoke<OsActivationResult>('activate_google_font', {
    fontId,
    familyName,
    styles,
  });
}

export async function activateFontBinaryInOs(
  fontId: string,
  displayName: string,
  fileName: string,
  buffer: ArrayBuffer,
): Promise<OsActivationResult | null> {
  if (!isTauriDesktop()) return null;
  const base64Data = arrayBufferToBase64(buffer);
  return invoke<OsActivationResult>('activate_font_binary', {
    fontId,
    displayName,
    fileName,
    base64Data,
  });
}

export async function activateCachedFontInOs(
  fontId: string,
  displayName: string,
): Promise<OsActivationResult | null> {
  if (!isTauriDesktop()) return null;
  return invoke<OsActivationResult>('activate_cached_font', {
    fontId,
    displayName,
  });
}

export async function deactivateOsFont(fontId: string): Promise<OsDeactivationResult | null> {
  if (!isTauriDesktop()) return null;
  return invoke<OsDeactivationResult>('deactivate_os_font', { fontId });
}

export async function openOsFontsFolder(): Promise<string | null> {
  if (!isTauriDesktop()) return null;
  return invoke<string>('open_os_fonts_folder');
}

export async function scanSystemFontsNative(): Promise<NativeScannedSystemFont[]> {
  if (!isTauriDesktop()) return [];
  return invoke<NativeScannedSystemFont[]>('scan_system_fonts');
}

export async function startDesktopAuthSession(
  requestDriveScope: boolean,
): Promise<DesktopAuthTokens> {
  const authBaseUrl = getDesktopWebBaseUrl();
  return invoke<DesktopAuthTokens>('start_desktop_auth_session', {
    authBaseUrl,
    requestDriveScope,
  });
}
