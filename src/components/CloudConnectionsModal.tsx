import React, { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import {
  CheckCircle2,
  Cloud,
  FolderOpen,
  Globe,
  HardDrive,
  Laptop,
  RefreshCw,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  DriveAuthExpiredError,
  listGoogleDriveFonts,
  type RemoteFontFile,
} from '../services/cloudProviders';
import {
  pickNativeFolder,
  type DetectedLocalDriveFolder,
} from '../services/desktopFontActivator';
import { getGoogleDriveAccessToken } from '../services/firebase';
import type { AdobeKitRecord, LibraryProvider } from '../types/font';

type HubTab = 'foundries' | 'drives' | 'local';

interface CloudConnectionsModalProps {
  isOpen: boolean;
  initialTab?: HubTab;
  user: User | null;
  hasDriveToken: boolean;
  googleTotal: number;
  googleLoading: boolean;
  fontshareTotal: number;
  adobeKits: AdobeKitRecord[];
  onSignInGoogle: () => Promise<unknown>;
  onDriveTokenExpired: () => void;
  onRefreshGoogleFonts: () => Promise<void>;
  onRefreshFontshareFonts: () => Promise<void>;
  onConnectAdobeKit: (kitId: string, name?: string) => Promise<number>;
  onRemoveAdobeKit: (kitId: string) => void;
  onImportGoogleDriveFiles: (files: RemoteFontFile[]) => Promise<number>;
  onActivateAllGoogleDrive: () => Promise<number>;
  localDriveFolders: DetectedLocalDriveFolder[];
  onActivateLocalDriveZeroCopy: (folderPath: string, label: string) => Promise<number>;
  isDesktop?: boolean;
  watchedFolders?: string[];
  onAddWatchedFolder?: (folderPath: string) => Promise<number>;
  onRemoveWatchedFolder?: (folderPath: string) => Promise<void>;
  onScanSystemFonts: () => Promise<number>;
  onConnectLocalFolder: (provider: LibraryProvider, label: string) => Promise<number>;
  onOpenFileUpload: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const GoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ onClick, disabled, label = 'Sign in with Google' }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center gap-2.5 h-9 px-3.5 rounded-lg bg-white text-[#1f1f1f] border border-[#747775]/60 hover:bg-[#f8f9fa] active:bg-[#eef1f4] shadow-xs text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50"
  >
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
    <span>{label}</span>
  </button>
);

export const CloudConnectionsModal: React.FC<CloudConnectionsModalProps> = ({
  isOpen,
  initialTab = 'foundries',
  user,
  hasDriveToken,
  googleTotal,
  googleLoading,
  fontshareTotal,
  adobeKits,
  onSignInGoogle,
  onDriveTokenExpired,
  onRefreshGoogleFonts,
  onRefreshFontshareFonts,
  onConnectAdobeKit,
  onRemoveAdobeKit,
  onImportGoogleDriveFiles,
  onActivateAllGoogleDrive,
  localDriveFolders,
  onActivateLocalDriveZeroCopy,
  isDesktop = false,
  watchedFolders = [],
  onAddWatchedFolder,
  onRemoveWatchedFolder,
  onScanSystemFonts,
  onConnectLocalFolder,
  onOpenFileUpload,
  onClose,
  onNotify,
}) => {
  const [tab, setTab] = useState<HubTab>(initialTab);

  // Adobe Fonts state
  const [kitInput, setKitInput] = useState('');
  const [kitName, setKitName] = useState('');
  const [adobeBusy, setAdobeBusy] = useState(false);
  const [adobeError, setAdobeError] = useState('');

  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<RemoteFontFile[] | null>(null);
  const [selectedDriveIds, setSelectedDriveIds] = useState<string[]>([]);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveError, setDriveError] = useState('');

  // Local OS / Folder state
  const [localBusy, setLocalBusy] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  const [watchPathInput, setWatchPathInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
  }, [isOpen, initialTab]);

  const handleConnectAdobe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitInput.trim()) {
      setAdobeError('Enter your Adobe Fonts Web Project ID (e.g. abc1def) or use.typekit.net URL.');
      return;
    }
    setAdobeBusy(true);
    setAdobeError('');
    try {
      await onConnectAdobeKit(kitInput, kitName);
      setKitInput('');
      setKitName('');
    } catch (err) {
      setAdobeError(err instanceof Error ? err.message : 'Unable to connect Adobe Fonts project');
    } finally {
      setAdobeBusy(false);
    }
  };

  const handleScanGoogleDrive = async () => {
    setDriveBusy(true);
    setDriveError('');
    try {
      let token = getGoogleDriveAccessToken();
      if (!token) {
        const res = (await onSignInGoogle()) as { redirected?: boolean } | undefined;
        if (res?.redirected) {
          return;
        }
        token = getGoogleDriveAccessToken();
      }
      if (!token) {
        throw new Error('Google Drive permission was not granted. Please try signing in again.');
      }
      const files = await listGoogleDriveFonts(token);
      setDriveFiles(files);
      setSelectedDriveIds(files.map((f) => f.id));
      if (files.length === 0) {
        onNotify('No .ttf, .otf, .woff, or .woff2 files found in Google Drive');
      }
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        onDriveTokenExpired();
        setDriveFiles(null);
      }
      setDriveError(err instanceof Error ? err.message : 'Failed to list Google Drive fonts');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleImportDriveSelected = async () => {
    if (!driveFiles) return;
    const chosen = driveFiles.filter((f) => selectedDriveIds.includes(f.id));
    if (chosen.length === 0) return;
    setDriveBusy(true);
    setDriveError('');
    try {
      const count = await onImportGoogleDriveFiles(chosen);
      if (count > 0) onClose();
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        onDriveTokenExpired();
        setDriveFiles(null);
      }
      setDriveError(err instanceof Error ? err.message : 'Failed to download Google Drive fonts');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleActivateAllDrive = async () => {
    setDriveBusy(true);
    setDriveError('');
    try {
      const count = await onActivateAllGoogleDrive();
      if (count > 0) onClose();
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        onDriveTokenExpired();
        setDriveFiles(null);
      }
      setDriveError(err instanceof Error ? err.message : 'Failed to activate Google Drive fonts');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleFolderPick = async (provider: LibraryProvider, label: string) => {
    setLocalBusy(label);
    setLocalError('');
    try {
      const count = await onConnectLocalFolder(provider, label);
      if (count > 0) onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setLocalError(err instanceof Error ? err.message : 'Folder selection cancelled');
    } finally {
      setLocalBusy(null);
    }
  };

  const handleSystemScan = async () => {
    setLocalBusy('system');
    setLocalError('');
    try {
      const count = await onScanSystemFonts();
      if (count > 0) onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to scan installed system fonts');
    } finally {
      setLocalBusy(null);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width={620}
      maxHeight="88dvh"
      padding={4}
    >
      <DialogHeader
        title="Connect Font Sources & Cloud Drives"
        subtitle="Connect live foundries, Google Drive, iCloud Drive, and macOS font folders."
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />

      <div className="mt-3 space-y-4 pb-1 text-[13px] text-[var(--color-text-primary)]">
        <SegmentedControl
          label="Connection Category"
          size="sm"
          value={tab}
          onChange={(v) => setTab(v as HubTab)}
        >
          <SegmentedControlItem
            value="foundries"
            label="Google & Adobe Fonts"
            icon={<Type className="w-3.5 h-3.5" />}
          />
          <SegmentedControlItem
            value="drives"
            label="Cloud Drives"
            icon={<Cloud className="w-3.5 h-3.5" />}
          />
          <SegmentedControlItem
            value="local"
            label="Mac & Local Folders"
            icon={<HardDrive className="w-3.5 h-3.5" />}
          />
        </SegmentedControl>

        {/* TAB 1: GOOGLE FONTS + ADOBE FONTS */}
        {tab === 'foundries' && (
          <div className="space-y-4">
            {/* Live Google Fonts Directory */}
            <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-body)] space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Globe className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-text-primary)]" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[13px]">Google Fonts Live Directory</h3>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Live ({googleTotal.toLocaleString()} families)
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                      Connected directly to Google Fonts with on-demand CSS2 streaming so all
                      families render live without slowing down startup.
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    isDisabled={googleLoading}
                    label={googleLoading ? 'Syncing…' : 'Refresh'}
                    icon={<RefreshCw className={`w-3.5 h-3.5 ${googleLoading ? 'animate-spin' : ''}`} />}
                    onClick={() => void onRefreshGoogleFonts()}
                  />
                </div>
              </div>
            </section>

            {/* Live Fontshare (ITF) Directory */}
            <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-body)] space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Type className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-text-primary)]" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[13px]">Fontshare (Indian Type Foundry)</h3>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Live ({fontshareTotal} families)
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                      100+ free commercial-grade designer fonts (Satoshi, Clash Display, General
                      Sans, Cabinet Grotesk) with 1-click Mac &amp; Windows OS activation.
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    label="Refresh"
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => void onRefreshFontshareFonts()}
                  />
                </div>
              </div>
            </section>

            {/* Live Adobe Fonts (Typekit) Web Projects */}
            <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-surface)] space-y-3">
              <div className="flex items-start gap-2.5">
                <Type className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-text-primary)]" />
                <div>
                  <h3 className="font-semibold text-[13px]">Adobe Fonts (Typekit Web Projects)</h3>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                    Paste your Adobe Fonts Web Project ID (from{' '}
                    <span className="font-code">fonts.adobe.com/my_fonts</span> → Web Projects →{' '}
                    <span className="font-code">use.typekit.net/&lt;id&gt;.css</span>) to load your
                    licensed Adobe Fonts live.
                  </p>
                </div>
              </div>

              <form onSubmit={handleConnectAdobe} className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={kitInput}
                    onChange={(e) => {
                      setKitInput(e.target.value);
                      setAdobeError('');
                    }}
                    placeholder="Project ID or use.typekit.net/abc1def.css"
                    aria-label="Adobe Fonts Project ID"
                    className="h-8 px-2.5 rounded-lg bg-[var(--color-background-body)] border border-[var(--color-border)] text-[12px] font-code text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
                  />
                  <input
                    type="text"
                    value={kitName}
                    onChange={(e) => setKitName(e.target.value)}
                    placeholder="Label (optional, e.g. Brand Kit)"
                    aria-label="Adobe Project Label"
                    className="h-8 px-2.5 rounded-lg bg-[var(--color-background-body)] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
                  />
                </div>
                {adobeError && <p className="text-[11px] text-red-500">{adobeError}</p>}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isDisabled={adobeBusy}
                    label={adobeBusy ? 'Connecting…' : 'Connect Adobe Project'}
                  />
                </div>
              </form>

              {adobeKits.length > 0 && (
                <div className="pt-2 border-t border-[var(--color-border)] space-y-1.5">
                  <div className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                    Connected Adobe Projects
                  </div>
                  {adobeKits.map((kit) => (
                    <div
                      key={kit.kitId}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-background-body)] border border-[var(--color-border)] text-[12px]"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{kit.name}</div>
                        <div className="text-[11px] font-code text-[var(--color-text-secondary)]">
                          Kit {kit.kitId} · {kit.familyCount} families
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveAdobeKit(kit.kitId)}
                        aria-label={`Disconnect Adobe kit ${kit.kitId}`}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: CLOUD DRIVES */}
        {tab === 'drives' && (
          <div className="space-y-3.5">
            {/* Google Drive (1P Workspace OAuth) */}
            <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-body)] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[13px]">Google Drive</h3>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                    Scan your Google Drive for real <code>.ttf</code>, <code>.otf</code>,{' '}
                    <code>.woff</code>, and <code>.woff2</code> files and load them directly with
                    real OpenType metadata.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {user && hasDriveToken ? (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        isDisabled={driveBusy}
                        label={driveBusy ? 'Activating…' : 'Activate All Drive Fonts'}
                        onClick={() => void handleActivateAllDrive()}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        isDisabled={driveBusy}
                        label="Browse Files"
                        onClick={() => void handleScanGoogleDrive()}
                      />
                    </>
                  ) : (
                    <GoogleSignInButton
                      disabled={driveBusy}
                      label={user ? 'Grant Drive Access' : 'Sign in with Google'}
                      onClick={() => void handleActivateAllDrive()}
                    />
                  )}
                </div>
              </div>

              {driveError && <p className="text-[11px] text-red-500">{driveError}</p>}

              {driveFiles && (
                <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-2">
                      <span>Found {driveFiles.length.toLocaleString()} font file(s) in Google Drive</span>
                      {driveFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDriveIds(
                              selectedDriveIds.length === driveFiles.length
                                ? []
                                : driveFiles.map((f) => f.id),
                            )
                          }
                          className="underline hover:text-[var(--color-text-primary)] cursor-pointer"
                        >
                          {selectedDriveIds.length === driveFiles.length ? 'Clear all' : 'Select all'}
                        </button>
                      )}
                    </div>
                    {driveFiles.length > 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        isDisabled={driveBusy || selectedDriveIds.length === 0}
                        label={`Activate ${selectedDriveIds.length.toLocaleString()} Selected`}
                        onClick={() => void handleImportDriveSelected()}
                      />
                    )}
                  </div>
                  {driveFiles.length > 0 && (
                    <div className="max-h-36 overflow-y-auto divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-background-surface)]">
                      {driveFiles.map((file) => {
                        const checked = selectedDriveIds.includes(file.id);
                        return (
                          <label
                            key={file.id}
                            className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] cursor-pointer"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedDriveIds((prev) =>
                                    checked ? prev.filter((id) => id !== file.id) : [...prev, file.id],
                                  )
                                }
                              />
                              <span className="truncate font-code text-[11.5px]">{file.name}</span>
                            </span>
                            <span className="text-[10.5px] font-code text-[var(--color-text-secondary)] shrink-0">
                              {Math.max(1, Math.round(file.size / 1024))} KB
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Auto-Detected Local Google Drive Desktop (Instant Zero-Copy Mode) */}
            {localDriveFolders.length > 0 && (
              <section className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] space-y-2.5">
                <div className="min-w-0">
                  <h3 className="font-semibold text-[13px]">
                    Google Drive Desktop Detected (Instant Zero-Copy)
                  </h3>
                  <p className="text-[11.5px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                    Activate your entire synced Google Drive folder in-place with zero downloading
                    and zero file copying — just like RightFont.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {localDriveFolders.map((folder) => (
                    <div
                      key={folder.path}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-background-surface)] border border-[var(--color-border)]"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium truncate">{folder.label}</div>
                        <div className="text-[10.5px] font-code text-[var(--color-text-secondary)] truncate">
                          {folder.path}
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        isDisabled={driveBusy}
                        label="Activate All In-Place"
                        onClick={async () => {
                          setDriveBusy(true);
                          setDriveError('');
                          try {
                            const count = await onActivateLocalDriveZeroCopy(
                              folder.path,
                              folder.label,
                            );
                            if (count > 0) onClose();
                          } catch (err) {
                            setDriveError(
                              err instanceof Error ? err.message : 'Zero-copy activation failed',
                            );
                          } finally {
                            setDriveBusy(false);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* iCloud Drive, Box, Nextcloud / Synced Folders */}
            <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-surface)] flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[13px]">iCloud Drive, Box &amp; Other Synced Drives</h3>
                <p className="text-[11.5px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                  Select your macOS <strong>iCloud Drive</strong>, <strong>Box Drive</strong>, or{' '}
                  <strong>Nextcloud</strong> folder directly to scan real font files without
                  uploading them anywhere.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  isDisabled={localBusy === 'iCloud Drive'}
                  label="iCloud Drive"
                  icon={<Cloud className="w-3.5 h-3.5" />}
                  onClick={() => void handleFolderPick('icloud', 'iCloud Drive')}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  isDisabled={localBusy === 'Box Drive'}
                  label="Box / Other"
                  icon={<FolderOpen className="w-3.5 h-3.5" />}
                  onClick={() => void handleFolderPick('box', 'Box Drive')}
                />
              </div>
            </section>

            {localError && <p className="text-[11px] text-red-500">{localError}</p>}
          </div>
        )}

        {/* TAB 3: MAC & LOCAL SYSTEM FONTS */}
        {tab === 'local' && (
          <div className="space-y-3">
            <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-body)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Laptop className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-[13px]">Scan Installed Mac / Windows Fonts</h3>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                    Reads your actual installed system fonts directly in the desktop app, or via
                    Chrome, Edge, Brave, and Arc on the web.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  isDisabled={localBusy === 'system'}
                  label={localBusy === 'system' ? 'Scanning…' : 'Scan System Fonts'}
                  onClick={() => void handleSystemScan()}
                />
              </div>
            </section>

            <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-surface)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <FolderOpen className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-[13px]">Mount Local Font Folder</h3>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                    Select <code>~/Library/Fonts</code> or any project directory to parse real
                    OpenType tables, foundries, weights, and glyph maps.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  isDisabled={localBusy === 'Local Folder'}
                  label="Choose Folder"
                  onClick={() => void handleFolderPick('folder', 'Local Folder')}
                />
              </div>
            </section>

            <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-surface)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Upload className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-[13px]">Import Individual Font Files</h3>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                    Drop or browse <code>.ttf</code>, <code>.otf</code>, <code>.woff</code>, or{' '}
                    <code>.woff2</code> files directly into Fontainer.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  label="Upload Files"
                  onClick={() => {
                    onClose();
                    onOpenFileUpload();
                  }}
                />
              </div>
            </section>

            {isDesktop && onAddWatchedFolder && (
              <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-surface)] space-y-2.5">
                <div>
                  <h3 className="font-semibold text-[13px]">
                    Watched Auto-Active Folders (FontBase / RightFont Style)
                  </h3>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                    Any <code>.ttf</code> or <code>.otf</code> font dropped into a watched folder
                    automatically activates in-place with zero copying.
                  </p>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!watchPathInput.trim()) return;
                    setLocalBusy('watch');
                    setLocalError('');
                    try {
                      await onAddWatchedFolder(watchPathInput.trim());
                      setWatchPathInput('');
                    } catch (err) {
                      setLocalError(
                        err instanceof Error ? err.message : 'Unable to watch folder',
                      );
                    } finally {
                      setLocalBusy(null);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={watchPathInput}
                    onChange={(e) => setWatchPathInput(e.target.value)}
                    placeholder="Choose or paste folder path…"
                    className="flex-1 h-8 px-2.5 rounded-lg bg-[var(--color-background-body)] border border-[var(--color-border)] text-[12px] font-code text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    isDisabled={localBusy === 'watch'}
                    label="Browse…"
                    onClick={async () => {
                      const picked = await pickNativeFolder('Select Folder to Watch & Auto-Activate');
                      if (picked) {
                        setLocalBusy('watch');
                        setLocalError('');
                        try {
                          await onAddWatchedFolder(picked);
                        } catch (err) {
                          setLocalError(
                            err instanceof Error ? err.message : 'Unable to watch folder',
                          );
                        } finally {
                          setLocalBusy(null);
                        }
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isDisabled={localBusy === 'watch' || !watchPathInput.trim()}
                    label="Watch"
                  />
                </form>
                {watchedFolders.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {watchedFolders.map((folder) => (
                      <div
                        key={folder}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--color-background-body)] border border-[var(--color-border)] text-[11.5px]"
                      >
                        <span className="font-code truncate">{folder}</span>
                        {onRemoveWatchedFolder && (
                          <button
                            type="button"
                            onClick={() => void onRemoveWatchedFolder(folder)}
                            aria-label={`Stop watching ${folder}`}
                            className="p-1 text-neutral-400 hover:text-red-500 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {localError && <p className="text-[11px] text-red-500">{localError}</p>}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="secondary" size="sm" label="Done" onClick={onClose} />
        </div>
      </div>
    </Dialog>
  );
};
