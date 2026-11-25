import React, { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { CheckCircle2, FileUp, Share2, Sparkles, Wand2 } from 'lucide-react';
import type { FontFamily } from '../types/font';

export interface SharedFontStackPayload {
  name: string;
  fonts: Array<{ id: string; name: string }>;
}

export function encodeSharedFontStack(payload: SharedFontStackPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSharedFontStack(encoded: string): SharedFontStackPayload | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SharedFontStackPayload>;
    if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.fonts)) return null;
    const fonts = parsed.fonts
      .filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string')
      .slice(0, 100);
    if (fonts.length === 0) return null;
    return { name: parsed.name.slice(0, 80), fonts };
  } catch {
    return null;
  }
}

interface SharedStackModalProps {
  stack: SharedFontStackPayload | null;
  allFonts: FontFamily[];
  onImportAndActivate: (stackName: string, fontIds: string[]) => void;
  onClose: () => void;
}

export const SharedStackModal: React.FC<SharedStackModalProps> = ({
  stack,
  allFonts,
  onImportAndActivate,
  onClose,
}) => {
  const matched = useMemo(() => {
    if (!stack) return [];
    const byId = new Map(allFonts.map((f) => [f.id, f]));
    const byName = new Map(allFonts.map((f) => [f.name.toLowerCase(), f]));
    return stack.fonts.map((item) => {
      const found = byId.get(item.id) ?? byName.get(item.name.toLowerCase()) ?? null;
      return { requested: item, found };
    });
  }, [stack, allFonts]);

  if (!stack) return null;
  const matchedIds = matched.map((m) => m.found?.id).filter((id): id is string => Boolean(id));

  return (
    <Dialog
      isOpen={Boolean(stack)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width={500}
      maxHeight="85dvh"
      padding={4}
    >
      <DialogHeader
        title={`Shared Font Stack — ${stack.name}`}
        subtitle="Someone shared a project font stack with you. Import it as a Font List and activate all fonts in 1 click."
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />

      <div className="mt-3 space-y-3 text-[12.5px]">
        <div className="max-h-60 overflow-y-auto divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-background-body)]">
          {matched.map(({ requested, found }) => (
            <div
              key={requested.id}
              className="px-3 py-2 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-medium text-[var(--color-text-primary)] truncate">
                  {requested.name}
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  {found ? `${found.foundry} · Ready to activate` : 'Catalog loading or custom font'}
                </div>
              </div>
              {found && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
            </div>
          ))}
        </div>

        <div className="p-2.5 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] flex items-center justify-between gap-2 text-[11.5px]">
          <span className="text-[var(--color-text-secondary)]">
            Want live 1-click scanning &amp; font apply inside Figma?
          </span>
          <a
            href="https://github.com/hystericmoon/Fontainer/tree/main/plugins/fontainer-figma"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[var(--color-text-primary)] hover:underline shrink-0"
          >
            Install Figma Plugin ↗
          </a>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11.5px] text-[var(--color-text-secondary)]">
            {matchedIds.length} of {stack.fonts.length} fonts ready
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" label="Dismiss" onClick={onClose} />
            <Button
              variant="primary"
              size="sm"
              isDisabled={matchedIds.length === 0}
              label={`Import & Activate (${matchedIds.length})`}
              icon={<Share2 className="w-3.5 h-3.5" />}
              onClick={() => {
                onImportAndActivate(stack.name, matchedIds);
                onClose();
              }}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};

interface MissingFontsModalProps {
  isOpen: boolean;
  allFonts: FontFamily[];
  onActivateIds: (ids: string[]) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

/**
 * Figma / Adobe CC Missing-Font Auto-Activator:
 * Paste missing font names (from Figma, Photoshop, Illustrator, InDesign) or import a JSON manifest,
 * and Fontainer matches & activates them across Google Fonts, Fontshare, Google Drive, and Local fonts.
 */
export const MissingFontsModal: React.FC<MissingFontsModalProps> = ({
  isOpen,
  allFonts,
  onActivateIds,
  onClose,
  onNotify,
}) => {
  const [rawInput, setRawInput] = useState('');

  const parsedQueries = useMemo(() => {
    const trimmed = rawInput.trim();
    if (!trimmed) return [];
    // Support JSON manifest array or newline/comma-separated font names
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const arr = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as { fonts?: unknown[] })?.fonts)
            ? (parsed as { fonts: unknown[] }).fonts
            : [];
        return arr
          .map((item) =>
            typeof item === 'string'
              ? item.trim()
              : typeof (item as { name?: unknown; family?: unknown })?.name === 'string'
                ? String((item as { name: string }).name).trim()
                : typeof (item as { family?: unknown })?.family === 'string'
                  ? String((item as { family: string }).family).trim()
                  : '',
          )
          .filter(Boolean);
      } catch {
        // fall through to line parser
      }
    }
    return Array.from(
      new Set(
        trimmed
          .split(/[\n,;]+/)
          .map((line) => line.replace(/^[-•*\s]+/, '').trim())
          .filter(Boolean),
      ),
    );
  }, [rawInput]);

  const matches = useMemo(() => {
    if (parsedQueries.length === 0) return [];
    return parsedQueries.map((query) => {
      const q = query.toLowerCase();
      const exact = allFonts.find((f) => f.name.toLowerCase() === q);
      const partial =
        exact ??
        allFonts.find(
          (f) => f.name.toLowerCase().includes(q) || q.includes(f.name.toLowerCase()),
        );
      return { query, found: partial ?? null };
    });
  }, [parsedQueries, allFonts]);

  const matchedIds = matches.map((m) => m.found?.id).filter((id): id is string => Boolean(id));

  const handleUploadManifest = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setRawInput(text);
    } catch {
      onNotify('Unable to read manifest file');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width={540}
      maxHeight="88dvh"
      padding={4}
    >
      <DialogHeader
        title="Missing-Font Auto-Activator (Figma / Adobe)"
        subtitle="Paste missing font names from Figma, Photoshop, Illustrator, or InDesign — or load a fonts-manifest.json."
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />

      <div className="mt-3 space-y-3 text-[12.5px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-[var(--color-text-secondary)]">
            One font per line, comma-separated, or JSON manifest:
          </span>
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-body)] text-[11.5px] font-medium cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">
            <FileUp className="w-3.5 h-3.5" />
            <span>Load JSON</span>
            <input
              type="file"
              accept=".json,.txt"
              onChange={(e) => void handleUploadManifest(e)}
              className="hidden"
            />
          </label>
        </div>

        <textarea
          rows={4}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={'Satoshi\nClash Display\nInter\nPlayfair Display'}
          className="w-full p-2.5 rounded-xl bg-[var(--color-background-body)] border border-[var(--color-border)] text-[12px] font-code text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1] resize-none select-text"
        />

        {matches.length > 0 && (
          <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-background-surface)]">
            {matches.map(({ query, found }) => (
              <div key={query} className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-[var(--color-text-primary)] truncate">
                    {query}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)] truncate">
                    {found
                      ? `Matched: ${found.name} (${found.foundry})`
                      : 'Not found in connected libraries'}
                  </div>
                </div>
                {found ? (
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Ready
                  </span>
                ) : (
                  <span className="text-[11px] text-neutral-400 shrink-0">Missing</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="p-2.5 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] flex items-center justify-between gap-2 text-[11.5px]">
          <span className="text-[var(--color-text-secondary)]">
            Want live 1-click scanning &amp; font apply inside Figma?
          </span>
          <a
            href="https://github.com/hystericmoon/Fontainer/tree/main/plugins/fontainer-figma"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[var(--color-text-primary)] hover:underline shrink-0"
          >
            Install Figma Plugin ↗
          </a>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11.5px] text-[var(--color-text-secondary)]">
            {matchedIds.length} matched across Google Fonts, Fontshare &amp; Drive
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" label="Cancel" onClick={onClose} />
            <Button
              variant="primary"
              size="sm"
              isDisabled={matchedIds.length === 0}
              label={`Auto-Activate (${matchedIds.length})`}
              icon={<Wand2 className="w-3.5 h-3.5" />}
              onClick={() => {
                onActivateIds(matchedIds);
                onNotify(`Auto-activated ${matchedIds.length} matched fonts`);
                setRawInput('');
                onClose();
              }}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};
