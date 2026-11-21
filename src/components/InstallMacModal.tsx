import React, { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Check, Copy, Download, Laptop, Terminal } from 'lucide-react';

interface InstallMacModalProps {
  isOpen: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isSafari: boolean;
  isIOS: boolean;
  onInstallPwa: () => Promise<boolean>;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const TAURI_DMG_SNIPPET = `npm install --legacy-peer-deps && npm install -D @tauri-apps/cli@^2 --legacy-peer-deps
npx tauri init --ci --app-name Fontainer \\
  --window-title Fontainer --frontend-dist ../dist \\
  --dev-url http://localhost:3000 \\
  --before-dev-command "npm run dev" \\
  --before-build-command "npm run build"
sed -i '' 's/"com.tauri.dev"/"com.fontainer.app"/' src-tauri/tauri.conf.json
npx tauri icon public/pwa-512x512.png
npx tauri build --bundles dmg`;

export const InstallMacModal: React.FC<InstallMacModalProps> = ({
  isOpen,
  isInstallable,
  isInstalled,
  isSafari,
  isIOS,
  onInstallPwa,
  onClose,
  onNotify,
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(TAURI_DMG_SNIPPET);
      setCopiedCmd(true);
      onNotify('Copied Tauri v2 .dmg build commands');
      window.setTimeout(() => setCopiedCmd(false), 1800);
    } catch {
      onNotify('Commands ready to copy');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width={560}
      maxHeight="88dvh"
      padding={4}
    >
      <DialogHeader
        title="Install Fontainer on macOS"
        subtitle="Add directly to your macOS Dock now, or package a standalone .dmg installer."
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />

      <div className="mt-3 space-y-4 pb-1 text-[13px] text-[var(--color-text-primary)]">
        {/* Option 1: Instant macOS Dock / Standalone PWA */}
        <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-body)] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <Laptop className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-text-primary)]" />
              <div className="min-w-0">
                <h3 className="font-semibold text-[13px] text-[var(--color-text-primary)]">
                  1. Instant macOS Dock App (Recommended — No .dmg needed)
                </h3>
                <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                  Installs as a standalone macOS desktop window with offline font caching, Dock icon,
                  and Launchpad entry.
                </p>
              </div>
            </div>
          </div>

          {isInstalled ? (
            <p className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
              Fontainer is already running as an installed standalone app.
            </p>
          ) : isInstallable ? (
            <div className="pt-1">
              <Button
                variant="primary"
                size="sm"
                label="Install Fontainer App"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={async () => {
                  const accepted = await onInstallPwa();
                  if (accepted) {
                    onNotify('Fontainer installed as a desktop app');
                    onClose();
                  }
                }}
              />
            </div>
          ) : isIOS ? (
            <ol className="list-decimal list-inside space-y-1 text-[12px] text-[var(--color-text-secondary)]">
              <li>Tap the <strong>Share</strong> button in Safari.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            </ol>
          ) : (
            <div className="space-y-2 text-[12px] text-[var(--color-text-secondary)]">
              <div className="p-3 rounded-lg bg-[var(--color-background-surface)] border border-[var(--color-border)] space-y-1.5">
                <div className="font-semibold text-[var(--color-text-primary)]">
                  {isSafari ? 'In Safari on macOS (Sonoma / Sequoia):' : 'In Safari on macOS:'}
                </div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open the shared app URL in <strong>Safari</strong>.</li>
                  <li>Choose <strong>File → Add to Dock…</strong> in the top menu bar.</li>
                  <li>Click <strong>Add</strong> — Fontainer appears in your Dock &amp; Applications.</li>
                </ol>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-background-surface)] border border-[var(--color-border)] space-y-1">
                <div className="font-semibold text-[var(--color-text-primary)]">
                  In Chrome, Edge, or Brave on macOS:
                </div>
                <p>
                  Click the <strong>Install</strong> icon in the right side of the address bar (or{' '}
                  <strong>⋮ → Cast, save, and share → Install page as app…</strong>).
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Option 2: Native macOS .dmg via GitHub Actions or Tauri v2 */}
        <section className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-surface)] space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <Terminal className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-text-secondary)]" />
              <div className="min-w-0">
                <h3 className="font-semibold text-[13px] text-[var(--color-text-primary)]">
                  2. Native macOS .dmg (GitHub Actions or Local Mac)
                </h3>
                <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                  Push to GitHub and run the included <strong>Build macOS .dmg</strong> Action for a
                  universal Apple Silicon + Intel <code>.dmg</code>, or build locally with Tauri v2:
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Button
                variant="secondary"
                size="sm"
                label={copiedCmd ? 'Copied' : 'Copy'}
                icon={copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                onClick={() => void handleCopy()}
              />
            </div>
          </div>
          <pre className="p-3 rounded-lg bg-[var(--color-background-body)] border border-[var(--color-border)] text-[11px] font-code text-[var(--color-text-primary)] max-h-36 overflow-auto whitespace-pre leading-relaxed select-text">
            {TAURI_DMG_SNIPPET}
          </pre>
        </section>

        <div className="flex justify-end pt-1">
          <Button variant="secondary" size="sm" label="Done" onClick={onClose} />
        </div>
      </div>
    </Dialog>
  );
};
