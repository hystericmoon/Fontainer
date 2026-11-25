import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openNativeDialog } from '@tauri-apps/plugin-dialog';

export const APP_VERSION = '1.3.0';
export const GITHUB_REPO = 'hystericmoon/Fontainer';
export const MAC_DMG_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/Fontainer-macOS-Universal.dmg`;
export const WIN_EXE_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/Fontainer-Windows-x64-Setup.exe`;
export const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

export interface OsFontStatus {
  platform: 'macos' | 'windows' | 'linux' | string;
  fontsDir: string;
  activeFontIds: string[];
  activeFileCount: number;
  sessionOnly: boolean;
  temporaryCount: number;
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

export interface DriveBatchFontItem {
  fontId: string;
  fileId: string;
  displayName: string;
  fileName: string;
}

export interface BatchProgressPayload {
  phase: string;
  completed: number;
  total: number;
  currentName: string;
}

export interface BatchActivationSummary {
  activated: number;
  skipped: number;
  failed: number;
  authExpired: boolean;
  activeFontIds: string[];
}

export interface DetectedLocalDriveFolder {
  label: string;
  path: string;
}

export interface ZeroCopyFolderResult {
  folderPath: string;
  activatedCount: number;
  fonts: NativeScannedSystemFont[];
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

export async function activateFontshareFontInOs(
  fontId: string,
  slug: string,
  familyName: string,
): Promise<OsActivationResult | null> {
  if (!isTauriDesktop()) return null;
  return invoke<OsActivationResult>('activate_fontshare_font', {
    fontId,
    slug,
    familyName,
  });
}

export async function activateUrlFontInOs(
  fontId: string,
  familyName: string,
  assetUrls: string[],
): Promise<OsActivationResult | null> {
  if (!isTauriDesktop()) return null;
  return invoke<OsActivationResult>('activate_url_font', {
    fontId,
    familyName,
    assetUrls,
  });
}

export async function setSessionOnlyMode(enabled: boolean): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  return invoke<boolean>('set_session_only_mode', { enabled });
}

export async function listWatchedFolders(): Promise<string[]> {
  if (!isTauriDesktop()) return [];
  return invoke<string[]>('list_watched_folders');
}

export async function watchLocalFolder(folderPath: string): Promise<ZeroCopyFolderResult | null> {
  if (!isTauriDesktop()) return null;
  return invoke<ZeroCopyFolderResult>('watch_local_folder', { folderPath });
}

export async function unwatchLocalFolder(folderPath: string): Promise<string[]> {
  if (!isTauriDesktop()) return [];
  return invoke<string[]>('unwatch_local_folder', { folderPath });
}

/** Opens the native macOS Finder / Windows Explorer folder chooser dialog */
export async function pickNativeFolder(title = 'Choose Font Folder'): Promise<string | null> {
  if (!isTauriDesktop()) return null;
  const selected = await openNativeDialog({
    directory: true,
    multiple: false,
    title,
  });
  return typeof selected === 'string' && selected.trim() ? selected : null;
}

export interface DesktopUpdateInfo {
  latestVersion: string;
  downloadUrl: string;
  releaseUrl: string;
}

/** Checks GitHub Releases (or signed Tauri updater manifest) for a newer desktop version */
export async function checkForDesktopUpdate(
  platform: string | null,
): Promise<DesktopUpdateInfo | null> {
  if (isTauriDesktop()) {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update?.available && update.version) {
        return {
          latestVersion: update.version.replace(/^v/i, '').trim(),
          downloadUrl: platform === 'windows' ? WIN_EXE_DOWNLOAD_URL : MAC_DMG_DOWNLOAD_URL,
          releaseUrl: RELEASES_PAGE_URL,
        };
      }
    } catch {
      // Fall back to GitHub Releases JSON API below
    }
  }
  try {
    const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { tag_name?: string; html_url?: string };
    const latest = (data.tag_name ?? '').replace(/^v/i, '').trim();
    if (!latest || latest === APP_VERSION) return null;
    const isNewer = latest.localeCompare(APP_VERSION, undefined, { numeric: true }) > 0;
    if (!isNewer) return null;
    return {
      latestVersion: latest,
      downloadUrl: platform === 'windows' ? WIN_EXE_DOWNLOAD_URL : MAC_DMG_DOWNLOAD_URL,
      releaseUrl: data.html_url || RELEASES_PAGE_URL,
    };
  } catch {
    return null;
  }
}

/** Downloads, verifies, installs, and relaunches Fontainer silently inside the desktop app */
export async function installDesktopUpdateInApp(
  onProgress?: (percent: number) => void,
): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const { relaunch } = await import('@tauri-apps/plugin-process');
    const update = await check();
    if (!update?.available) return false;

    let totalBytes = 0;
    let downloadedBytes = 0;
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        totalBytes = event.data.contentLength ?? 0;
        onProgress?.(5);
      } else if (event.event === 'Progress') {
        downloadedBytes += event.data.chunkLength;
        if (totalBytes > 0) {
          onProgress?.(Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)));
        }
      } else if (event.event === 'Finished') {
        onProgress?.(100);
      }
    });

    await relaunch();
    return true;
  } catch {
    return false;
  }
}

export async function subscribeDesktopEvents(callbacks: {
  onOpenQuickSwitcher?: () => void;
  onWatchedFolderUpdated?: (addedCount: number) => void;
}): Promise<() => void> {
  if (!isTauriDesktop()) return () => {};
  const unsubs: Array<() => void> = [];
  if (callbacks.onOpenQuickSwitcher) {
    unsubs.push(
      await listen('open-quick-switcher', () => {
        callbacks.onOpenQuickSwitcher?.();
      }),
    );
  }
  if (callbacks.onWatchedFolderUpdated) {
    unsubs.push(
      await listen<number>('watched-folder-updated', (e) => {
        callbacks.onWatchedFolderUpdated?.(Number(e.payload) || 0);
      }),
    );
  }
  return () => {
    for (const u of unsubs) u();
  };
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

export async function batchActivateDriveFonts(
  accessToken: string,
  items: DriveBatchFontItem[],
): Promise<BatchActivationSummary | null> {
  if (!isTauriDesktop()) return null;
  return invoke<BatchActivationSummary>('batch_activate_drive_fonts', {
    accessToken,
    items,
  });
}

export interface GoogleBatchFontItem {
  fontId: string;
  familyName: string;
  styles: Array<{ weight: number; italic: boolean }>;
}

export async function batchActivateGoogleFonts(
  items: GoogleBatchFontItem[],
): Promise<BatchActivationSummary | null> {
  if (!isTauriDesktop()) return null;
  return invoke<BatchActivationSummary>('batch_activate_google_fonts', {
    items,
  });
}

export async function batchDeactivateOsFonts(fontIds: string[]): Promise<number> {
  if (!isTauriDesktop() || fontIds.length === 0) return 0;
  return invoke<number>('batch_deactivate_os_fonts', { fontIds });
}

export async function detectLocalGoogleDriveFolders(): Promise<DetectedLocalDriveFolder[]> {
  if (!isTauriDesktop()) return [];
  return invoke<DetectedLocalDriveFolder[]>('detect_local_google_drive_folders');
}

export async function activateLocalDriveFolderZeroCopy(
  folderPath: string,
): Promise<ZeroCopyFolderResult | null> {
  if (!isTauriDesktop()) return null;
  return invoke<ZeroCopyFolderResult>('activate_local_drive_folder_zero_copy', {
    folderPath,
  });
}

export async function subscribeBatchProgress(
  onProgress: (payload: BatchProgressPayload) => void,
): Promise<() => void> {
  if (!isTauriDesktop()) return () => {};
  const unlisten = await listen<BatchProgressPayload>('font-sync-progress', (event) => {
    onProgress(event.payload);
  });
  return unlisten;
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
