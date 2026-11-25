import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Switch } from '@astryxdesign/core/Switch';
import {
  AlertTriangle,
  Check,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  DuplicateGroup,
  FontFamily,
  FontLibrary,
  SmartList,
  SmartRule,
  SmartRuleField,
  ThemeMode,
} from '../types/font';
import { matchesSmartList } from '../utils/fontFilter';

const FOLDER_COLORS = ['#1b1b1b', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA', '#8E8E93'];

interface SheetBackdropProps {
  title: string;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}

const SheetBackdrop: React.FC<SheetBackdropProps> = ({
  title,
  onClose,
  width = 460,
  children,
}) => (
  <Dialog
    isOpen
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
    width={width}
    padding={4}
  >
    <DialogHeader
      title={title}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    />
    <div className="mt-4">{children}</div>
  </Dialog>
);

/* 1. New Font List Modal */
export const NewFontListModal: React.FC<{
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
}> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a name for your Font List.');
      return;
    }
    onCreate(name.trim(), color);
    onClose();
  };

  return (
    <SheetBackdrop title="New Font List" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="new-list-name"
            className="block text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1"
          >
            List Name
          </label>
          <input
            id="new-list-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="e.g. Editorial 2026"
            className="w-full h-8 px-2.5 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
          />
          {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
        </div>

        <div>
          <span className="block text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            Folder Tint
          </span>
          <div className="flex items-center gap-2">
            {FOLDER_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setColor(hex)}
                aria-label={`Select color ${hex}`}
                aria-pressed={color === hex}
                className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-transform ${
                  color === hex
                    ? 'scale-110 ring-2 ring-offset-2 ring-[#1b1b1b] dark:ring-[#f1f1f1] dark:ring-offset-[#262626]'
                    : ''
                }`}
                style={{ backgroundColor: hex }}
              >
                {color === hex && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" label="Cancel" onClick={onClose} />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            label="Create List"
            icon={<FolderPlus className="w-3.5 h-3.5" />}
          />
        </div>
      </form>
    </SheetBackdrop>
  );
};

/* 2. New Smart List Modal */
export const NewSmartListModal: React.FC<{
  fonts: FontFamily[];
  onClose: () => void;
  onCreate: (smart: Omit<SmartList, 'id'>) => void;
}> = ({ fonts, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const [rules, setRules] = useState<SmartRule[]>([
    { id: 'r-1', field: 'classification', operator: 'equals', value: 'Serif' },
  ]);
  const [error, setError] = useState('');

  const previewCount = useMemo(() => {
    const draft: SmartList = { id: 'draft', name: 'draft', matchMode, rules };
    return fonts.filter((f) => matchesSmartList(f, draft)).length;
  }, [fonts, matchMode, rules]);

  const updateRule = (id: string, patch: Partial<SmartRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      { id: `r-${Date.now()}`, field: 'isVariable', operator: 'equals', value: 'true' },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a name for the Smart List.');
      return;
    }
    onCreate({ name: name.trim(), matchMode, rules });
    onClose();
  };

  return (
    <SheetBackdrop title="New Smart List" onClose={onClose} width={520}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="smart-list-name"
            className="block text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1"
          >
            Smart List Name
          </label>
          <input
            id="smart-list-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="e.g. Multi-Weight Display Fonts"
            className="w-full h-8 px-2.5 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
          />
          {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-between text-[12px]">
          <label className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <span>Match</span>
            <select
              aria-label="Smart list match mode"
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as 'all' | 'any')}
              className="h-7 px-2 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] outline-none"
            >
              <option value="all">All rules (AND)</option>
              <option value="any">Any rule (OR)</option>
            </select>
          </label>
          <span className="font-code tabular-nums text-[11px] font-medium text-[var(--color-text-primary)]">
            Matches {previewCount} {previewCount === 1 ? 'font' : 'fonts'}
          </span>
        </div>

        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-2">
              <select
                aria-label="Rule field"
                value={rule.field}
                onChange={(e) => {
                  const field = e.target.value as SmartRuleField;
                  const defaultVal =
                    field === 'isVariable' || field === 'activated'
                      ? 'true'
                      : field === 'minStyles'
                        ? '3'
                        : field === 'classification'
                          ? 'Serif'
                          : '';
                  updateRule(rule.id, {
                    field,
                    operator:
                      field === 'minStyles'
                        ? 'gte'
                        : field === 'license' || field === 'foundry' || field === 'tag'
                          ? 'contains'
                          : 'equals',
                    value: defaultVal,
                  });
                }}
                className="h-7 px-2 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none"
              >
                <option value="classification">Classification</option>
                <option value="isVariable">Variable Font</option>
                <option value="activated">Activation Status</option>
                <option value="minStyles">Min Styles</option>
                <option value="format">Format</option>
                <option value="foundry">Foundry</option>
                <option value="license">License</option>
                <option value="tag">Tag</option>
              </select>

              {rule.field === 'classification' ? (
                <select
                  aria-label="Classification value"
                  value={rule.value}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  className="flex-1 h-7 px-2 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[12px]"
                >
                  {['Sans Serif', 'Serif', 'Slab Serif', 'Display', 'Monospace', 'Script', 'Handwritten'].map(
                    (c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ),
                  )}
                </select>
              ) : rule.field === 'isVariable' || rule.field === 'activated' ? (
                <select
                  aria-label="Boolean value"
                  value={rule.value}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  className="flex-1 h-7 px-2 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[12px]"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type={rule.field === 'minStyles' ? 'number' : 'text'}
                  min={1}
                  value={rule.value}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  placeholder="Enter value…"
                  aria-label="Rule value"
                  className="flex-1 h-7 px-2 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[12px] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
                />
              )}

              {rules.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                  aria-label="Remove rule"
                  className="p-1 text-neutral-400 hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-text-primary)] hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Condition</span>
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" label="Cancel" onClick={onClose} />
          <Button type="submit" variant="primary" size="sm" label="Create Smart List" />
        </div>
      </form>
    </SheetBackdrop>
  );
};

/* 3. Add Font Library Modal */
export const AddLibraryModal: React.FC<{
  onClose: () => void;
  onAdd: (name: string, provider: FontLibrary['provider'], path: string) => void;
}> = ({ onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<FontLibrary['provider']>('icloud');
  const [path, setPath] = useState('~/iCloud Drive/Team Fonts');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a library name.');
      return;
    }
    onAdd(name.trim(), provider, path);
    onClose();
  };

  return (
    <SheetBackdrop title="Add Synced Font Library" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="lib-name"
            className="block text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1"
          >
            Library Name
          </label>
          <input
            id="lib-name"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="e.g. Adobe Fonts or Team Shared"
            className="w-full h-8 px-2.5 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
          />
          {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
        </div>

        <div>
          <label
            htmlFor="lib-provider"
            className="block text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1"
          >
            Sync Provider
          </label>
          <select
            id="lib-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as FontLibrary['provider'])}
            className="w-full h-8 px-2 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[13px] outline-none"
          >
            <option value="local">Local macOS Folder</option>
            <option value="gdrive">Google Drive</option>
            <option value="icloud">iCloud Drive</option>
            <option value="google">Google Fonts</option>
            <option value="adobe">Adobe Creative Cloud</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="lib-path"
            className="block text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1"
          >
            Folder Path / Endpoint
          </label>
          <input
            id="lib-path"
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="w-full h-8 px-2.5 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[12px] font-code outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" label="Cancel" onClick={onClose} />
          <Button type="submit" variant="primary" size="sm" label="Connect Library" />
        </div>
      </form>
    </SheetBackdrop>
  );
};

/* 4. Import Local Fonts Modal */
export const ImportFontsModal: React.FC<{
  libraries: FontLibrary[];
  onClose: () => void;
  onImport: (files: FileList | File[], libraryId: string) => Promise<number>;
}> = ({ libraries, onClose, onImport }) => {
  const [targetLib, setTargetLib] = useState(libraries[0]?.id ?? 'lib-local');
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const count = await onImport(files, targetLib);
    setBusy(false);
    if (count > 0) onClose();
  };

  return (
    <SheetBackdrop title="Import Local Fonts" onClose={onClose} width={520}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Destination Library
          </span>
          <select
            value={targetLib}
            onChange={(e) => setTargetLib(e.target.value)}
            className="w-full h-8 px-2 rounded-lg bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[13px] outline-none"
          >
            {libraries.map((lib) => (
              <option key={lib.id} value={lib.id}>
                {lib.name} ({lib.path})
              </option>
            ))}
          </select>
        </label>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={`p-8 rounded-xl border-2 border-dashed text-center transition-colors ${
            isDragging
              ? 'border-[#1b1b1b] dark:border-[#f1f1f1] bg-black/[0.04] dark:bg-white/[0.06]'
              : 'border-[var(--color-border)] bg-[#F7F7F7] dark:bg-[#1B1B1B]'
          }`}
        >
          <Upload className="w-7 h-7 mx-auto text-neutral-400 mb-2" />
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
            Drop .ttf, .otf, .woff, or .woff2 font files here
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">
            Fonts load immediately via the browser FontFace API and persist locally in IndexedDB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".ttf,.otf,.woff,.woff2"
            onChange={(e) => void handleFiles(e.target.files)}
            className="hidden"
          />
          <div className="mt-4 flex justify-center">
            <Button
              variant="primary"
              size="sm"
              isDisabled={busy}
              label={busy ? 'Loading Fonts…' : 'Choose Font Files…'}
              onClick={() => fileInputRef.current?.click()}
            />
          </div>
        </div>
      </div>
    </SheetBackdrop>
  );
};

/* 5. Preferences Modal */
export const PreferencesModal: React.FC<{
  theme: ThemeMode;
  onSetTheme: (theme: ThemeMode) => void;
  onResetLibrary: () => void;
  onClose: () => void;
}> = ({ theme, onSetTheme, onResetLibrary, onClose }) => (
  <SheetBackdrop title="Fontainer Preferences" onClose={onClose} width={520}>
    <div className="space-y-5 text-[12px]">
      <section>
        <h3 className="text-[12px] font-semibold text-[var(--color-text-primary)] mb-2">
          Appearance (Astryx Neutral)
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'light', label: 'Light', desc: 'Astryx Neutral Light' },
              { id: 'dark', label: 'Dark', desc: 'Astryx Obsidian Dark' },
              { id: 'sepia', label: 'Warm Studio', desc: 'Soft Paper Canvas' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSetTheme(t.id)}
              aria-pressed={theme === t.id}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                theme === t.id
                  ? 'border-[#1b1b1b] dark:border-[#f1f1f1] bg-black/[0.04] dark:bg-white/[0.08]'
                  : 'border-[var(--color-border)] hover:border-neutral-400'
              }`}
            >
              <div className="font-semibold text-[var(--color-text-primary)]">{t.label}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-[var(--color-text-primary)]">Clear Local Workspace Cache</div>
          <div className="text-[11px] text-neutral-500">
            Reset local cached preferences, lists, and filters on this device.
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          label="Clear Cache"
          onClick={() => {
            onResetLibrary();
            onClose();
          }}
        />
      </section>
    </div>
  </SheetBackdrop>
);

/* 6. Duplicate Font Finder Modal (with 1-Click Bulk Resolve by Source) */
export const DuplicateFinderModal: React.FC<{
  groups: DuplicateGroup[];
  libraries: FontLibrary[];
  onDeactivate: (fontId: string) => void;
  onBulkDeactivate: (fontIds: string[], label?: string) => void;
  onRemove: (fontId: string) => void;
  onClose: () => void;
}> = ({ groups, libraries, onDeactivate, onBulkDeactivate, onRemove, onClose }) => {
  const getLibName = (id: string) => libraries.find((l) => l.id === id)?.name ?? 'Library';

  // Count active duplicate copies per library so users can bulk-deactivate by source in 1 click
  const libraryDupSummary = useMemo(() => {
    const counts = new Map<string, { libId: string; libName: string; activeIds: string[]; totalIds: string[] }>();
    for (const group of groups) {
      for (const font of group.fonts) {
        const entry = counts.get(font.libraryId) ?? {
          libId: font.libraryId,
          libName: getLibName(font.libraryId),
          activeIds: [],
          totalIds: [],
        };
        entry.totalIds.push(font.id);
        if (font.activated) entry.activeIds.push(font.id);
        counts.set(font.libraryId, entry);
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.activeIds.length - a.activeIds.length || b.totalIds.length - a.totalIds.length);
  }, [groups, libraries]);

  // Smart Keep Best: keeps highest-priority copy per group & collects all other active duplicate IDs
  const smartExtraActiveIds = useMemo(() => {
    const priority = (libId: string) => {
      if (libId === 'lib-local' || libId.startsWith('lib-folder')) return 1;
      if (libId.startsWith('lib-gdrive')) return 2;
      if (libId === 'lib-collletttivo' || libId === 'lib-openfoundry' || libId === 'lib-uncut') return 3;
      if (libId === 'lib-fontshare') return 4;
      if (libId === 'lib-google') return 5;
      return 3;
    };
    const toDeactivate: string[] = [];
    for (const group of groups) {
      const activeInGroup = group.fonts.filter((f) => f.activated);
      if (activeInGroup.length <= 1) continue;
      const sorted = [...activeInGroup].sort((a, b) => priority(a.libraryId) - priority(b.libraryId));
      for (let i = 1; i < sorted.length; i += 1) {
        toDeactivate.push(sorted[i].id);
      }
    }
    return toDeactivate;
  }, [groups]);

  return (
    <SheetBackdrop title="Duplicate Font Finder" onClose={onClose} width={600}>
      {groups.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[14px] font-medium text-[var(--color-text-primary)]">
            No duplicate font families detected
          </p>
          <p className="text-[12px] text-neutral-500 mt-1">
            All installed fonts across your local and synced libraries have unique family names.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[66vh] overflow-y-auto pr-0.5">
          {/* Bulk Resolve Bar */}
          <div className="p-3.5 rounded-xl bg-[#F7F7F7] dark:bg-[#1B1B1B] border border-[var(--color-border)] space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">
                  Bulk Resolve ({groups.length} duplicate {groups.length === 1 ? 'family' : 'families'})
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Deactivate redundant copies by source in 1 click instead of one-by-one.
                </p>
              </div>
              {smartExtraActiveIds.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  label={`Keep Best Copy (${smartExtraActiveIds.length} off)`}
                  onClick={() =>
                    onBulkDeactivate(
                      smartExtraActiveIds,
                      `Kept best copy & deactivated ${smartExtraActiveIds.length} active duplicates`,
                    )
                  }
                />
              )}
            </div>

            {libraryDupSummary.some((item) => item.activeIds.length > 0) && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[var(--color-border)]">
                {libraryDupSummary
                  .filter((item) => item.activeIds.length > 0)
                  .map((item) => (
                    <Button
                      key={item.libId}
                      variant="secondary"
                      size="sm"
                      label={`Deactivate ${item.activeIds.length} in ${item.libName}`}
                      onClick={() =>
                        onBulkDeactivate(
                          item.activeIds,
                          `Deactivated ${item.activeIds.length} duplicate ${item.libName} copies`,
                        )
                      }
                    />
                  ))}
              </div>
            )}
          </div>

          {groups.map((group) => (
            <div
              key={group.normalizedName}
              className="rounded-xl border border-[var(--color-border)] overflow-hidden"
            >
              <div className="px-3.5 py-2 bg-[#F7F7F7] dark:bg-[#1B1B1B] border-b border-[var(--color-border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {group.displayName}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500">{group.reason}</span>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {group.fonts.map((font) => (
                  <div
                    key={font.id}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-[12px]"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--color-text-primary)]">
                        {getLibName(font.libraryId)} · {font.isVariable ? 'Variable' : font.format}
                      </div>
                      <div className="text-[11px] font-code tabular-nums text-neutral-500">
                        v{font.version} · {font.styles.length} styles ·{' '}
                        {font.activated ? 'Active' : 'Inactive'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {font.activated && (
                        <Button
                          variant="secondary"
                          size="sm"
                          label="Deactivate"
                          onClick={() => onDeactivate(font.id)}
                        />
                      )}
                      {font.isCustomUpload && (
                        <Button
                          variant="destructive"
                          size="sm"
                          label="Remove Copy"
                          onClick={() => onRemove(font.id)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SheetBackdrop>
  );
};

/* 7. Menu Bar Quick Switcher (RightFont's macOS status bar popover) */
export const QuickSwitcherModal: React.FC<{
  fonts: FontFamily[];
  onToggleActivate: (id: string) => void;
  onSelectFont: (id: string) => void;
  onClose: () => void;
}> = ({ fonts, onToggleActivate, onSelectFont, onClose }) => {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? fonts.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.classification.toLowerCase().includes(q) ||
            f.foundry.toLowerCase().includes(q),
        )
      : fonts;
    return list.slice(0, 12);
  }, [fonts, query]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu Bar Quick Switcher"
      className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-14 bg-black/20"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[340px] rounded-xl bg-white dark:bg-[#262626] border border-[var(--color-border)] shadow-2xl overflow-hidden">
        <div className="p-2.5 border-b border-[var(--color-border)] flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Quick activate or jump to font…"
            aria-label="Quick switcher search"
            className="flex-1 bg-transparent text-[13px] text-[var(--color-text-primary)] outline-none placeholder:text-neutral-400"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quick Switcher"
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--color-border)]">
          {matches.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-neutral-500">
              No matching fonts found.
            </div>
          ) : (
            matches.map((font) => (
              <div
                key={font.id}
                className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectFont(font.id);
                    onClose();
                  }}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div
                    className="text-[16px] text-[var(--color-text-primary)] truncate"
                    style={{ fontFamily: font.cssFamily }}
                  >
                    {font.name}
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {font.classification} · {font.styles.length} styles
                  </div>
                </button>

                <Switch
                  size="sm"
                  isLabelHidden
                  label={`${font.activated ? 'Deactivate' : 'Activate'} ${font.name}`}
                  value={font.activated}
                  onChange={() => onToggleActivate(font.id)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
