import React, { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Plus, X } from 'lucide-react';
import type { FontFamily, PreviewSettings } from '../types/font';
import { buildOpenTypeFeatureSettings } from '../utils/fontFilter';
import { ensureAdobeKitStylesheet, ensureGoogleFontLoaded } from '../utils/fontLoader';

interface CompareViewProps {
  allFonts: FontFamily[];
  compareIds: string[];
  preview: PreviewSettings;
  onToggleCompare: (id: string) => void;
  onSelectFont: (id: string) => void;
}

type SurfacePreset = 'default' | 'paper' | 'dark';

export const CompareView: React.FC<CompareViewProps> = ({
  allFonts,
  compareIds,
  preview,
  onToggleCompare,
  onSelectFont,
}) => {
  const [surface, setSurface] = useState<SurfacePreset>('default');
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number>>({});
  const [addFontId, setAddFontId] = useState<string>('');

  const pinnedFonts = compareIds
    .map((id) => allFonts.find((f) => f.id === id))
    .filter((f): f is FontFamily => Boolean(f));

  useEffect(() => {
    for (const font of pinnedFonts) {
      if (font.adobeKitId) {
        ensureAdobeKitStylesheet(font.adobeKitId);
      } else if (!font.isCustomUpload && font.libraryId === 'lib-google') {
        ensureGoogleFontLoaded(font.name, font.styles);
      }
    }
  }, [pinnedFonts]);

  const unpinnedFonts = allFonts.filter((f) => !compareIds.includes(f.id)).slice(0, 200);
  const featureSettings = buildOpenTypeFeatureSettings(preview.openType);
  const specimenText = preview.text.trim() || 'Sphinx of black quartz, judge my vow — 0123456789';

  const surfaceClasses: Record<SurfacePreset, string> = {
    default: 'bg-white dark:bg-[#1B1B1B] text-neutral-900 dark:text-neutral-100',
    paper: 'bg-[#F8F5EE] text-[#1C1917]',
    dark: 'bg-[#121212] text-[#F4F4F5]',
  };

  return (
    <div data-testid="compare-view" className="h-full flex flex-col min-h-0">
      {/* Compare Sub-toolbar */}
      <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[#F7F7F7] dark:bg-[#1E1E1E] flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
            Comparing {pinnedFonts.length} of 4 fonts
          </span>
          {pinnedFonts.length < 4 && unpinnedFonts.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2">
              <select
                aria-label="Select font to add to comparison"
                value={addFontId}
                onChange={(e) => setAddFontId(e.target.value)}
                className="h-7 px-2 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none"
              >
                <option value="">Add font to compare…</option>
                {unpinnedFonts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.classification})
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                isDisabled={!addFontId}
                label="Add"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  if (addFontId) {
                    onToggleCompare(addFontId);
                    setAddFontId('');
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Optical Surface Switcher */}
        <div className="flex items-center gap-1 text-[12px]" role="group" aria-label="Specimen Surface">
          {(
            [
              { id: 'default', label: 'Canvas' },
              { id: 'paper', label: 'Warm Paper' },
              { id: 'dark', label: 'Dark Proof' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSurface(opt.id)}
              aria-pressed={surface === opt.id}
              className={`h-6 px-2.5 rounded-lg transition-colors cursor-pointer ${
                surface === opt.id
                  ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111] font-medium'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Columns */}
      {pinnedFonts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="text-[14px] font-medium text-neutral-700 dark:text-neutral-300">
            No fonts pinned for side-by-side comparison
          </p>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-1">
            Use the picker above or click the Compare icon on any font row to pin up to 4 families.
          </p>
        </div>
      ) : (
        <div
          className={`flex-1 min-h-0 grid divide-x divide-neutral-200/80 dark:divide-neutral-800 overflow-y-auto ${
            pinnedFonts.length === 1
              ? 'grid-cols-1'
              : pinnedFonts.length === 2
                ? 'grid-cols-2'
                : pinnedFonts.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-4'
          }`}
        >
          {pinnedFonts.map((font) => {
            const currentWeight = weightOverrides[font.id] ?? font.styles[0]?.weight ?? 400;
            return (
              <div
                key={font.id}
                className={`flex flex-col min-w-0 p-5 transition-colors ${surfaceClasses[surface]}`}
              >
                <div className="flex items-start justify-between gap-2 pb-3 mb-4 border-b border-current/10">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectFont(font.id)}
                      className="text-[14px] font-semibold hover:underline text-left truncate block cursor-pointer"
                    >
                      {font.name}
                    </button>
                    <div className="text-[11px] opacity-60 truncate">
                      {font.foundry} · {font.classification}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleCompare(font.id)}
                    aria-label={`Remove ${font.name} from comparison`}
                    className="p-1 rounded opacity-60 hover:opacity-100 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Weight selector per column */}
                <div className="mb-4">
                  <select
                    aria-label={`${font.name} comparison weight`}
                    value={currentWeight}
                    onChange={(e) =>
                      setWeightOverrides((prev) => ({ ...prev, [font.id]: Number(e.target.value) }))
                    }
                    className="h-7 px-2 rounded border border-current/15 bg-transparent text-[12px] outline-none cursor-pointer"
                  >
                    {font.styles.map((s) => (
                      <option key={s.id} value={s.weight} className="text-neutral-900">
                        {s.name} ({s.weight})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Large Display Comparison */}
                <div
                  className="mb-6 break-words"
                  style={{
                    fontFamily: font.cssFamily,
                    fontWeight: currentWeight,
                    fontSize: `${preview.fontSize}px`,
                    lineHeight: preview.lineHeight,
                    letterSpacing: `${preview.letterSpacing}em`,
                    textTransform: preview.textCase === 'none' ? undefined : preview.textCase,
                    fontFeatureSettings: featureSettings,
                  }}
                >
                  {specimenText}
                </div>

                {/* Paragraph Reading Specimen */}
                <div
                  className="text-[15px] leading-relaxed opacity-85 mb-6"
                  style={{
                    fontFamily: font.cssFamily,
                    fontWeight: currentWeight,
                    fontFeatureSettings: featureSettings,
                  }}
                >
                  Good typography balances optical rhythm, x-height clarity, and quiet authority
                  across dense paragraphs and large headlines alike. 1234567890.
                </div>

                {/* Character Reference */}
                <div
                  className="mt-auto pt-4 border-t border-current/10 text-[18px] tracking-wider opacity-75 break-all"
                  style={{
                    fontFamily: font.cssFamily,
                    fontWeight: currentWeight,
                    fontFeatureSettings: featureSettings,
                  }}
                >
                  Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
