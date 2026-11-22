import React, { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import type { FontFamily, PreviewSettings } from '../types/font';
import { buildOpenTypeFeatureSettings } from '../utils/fontFilter';
import { ensureAdobeKitStylesheet, ensureGoogleFontLoaded } from '../utils/fontLoader';

interface WaterfallViewProps {
  fonts: FontFamily[];
  selectedFont: FontFamily | null;
  preview: PreviewSettings;
  onSelectFont: (id: string) => void;
  onToggleActivate: (id: string) => void;
}

const WATERFALL_SIZES = [12, 14, 16, 20, 24, 30, 38, 48, 60, 76];

export const WaterfallView: React.FC<WaterfallViewProps> = ({
  fonts,
  selectedFont,
  preview,
  onSelectFont,
  onToggleActivate,
}) => {
  const activeFont = selectedFont ?? fonts[0] ?? null;
  const [selectedStyleIdx, setSelectedStyleIdx] = useState(0);

  useEffect(() => {
    if (!activeFont) return;
    if (activeFont.adobeKitId) {
      ensureAdobeKitStylesheet(activeFont.adobeKitId);
    } else if (!activeFont.isCustomUpload && activeFont.libraryId === 'lib-google') {
      ensureGoogleFontLoaded(activeFont.name, activeFont.styles);
    }
  }, [activeFont]);

  if (!activeFont) return null;

  const styleVariant =
    activeFont.styles[Math.min(selectedStyleIdx, activeFont.styles.length - 1)] ??
    activeFont.styles[0];
  const featureSettings = buildOpenTypeFeatureSettings(preview.openType);
  const specimenText = preview.text.trim() || 'Sphinx of black quartz, judge my vow';

  return (
    <div data-testid="waterfall-view" className="h-full flex min-h-0">
      {/* Compact Font Picker Rail */}
      <div
        aria-label="Waterfall Font Picker"
        className="w-56 shrink-0 border-r border-[var(--color-border)] overflow-y-auto bg-[#F7F7F7] dark:bg-[#1E1E1E] py-2 px-1.5 space-y-0.5"
      >
        {fonts.map((font) => {
          const isCurrent = font.id === activeFont.id;
          return (
            <button
              key={font.id}
              type="button"
              onClick={() => {
                onSelectFont(font.id);
                setSelectedStyleIdx(0);
              }}
              className={`w-full px-3 py-2 rounded-lg text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                isCurrent
                  ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111]'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className="truncate text-[13px] font-medium">{font.name}</span>
              <span
                className={`text-[11px] font-code tabular-nums shrink-0 ${
                  isCurrent ? 'text-white/75 dark:text-neutral-900/70' : 'text-neutral-400'
                }`}
              >
                {font.styles.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Waterfall Specimen Canvas */}
      <div
        className="flex-1 overflow-y-auto p-6"
        style={{ backgroundColor: preview.backgroundColor || undefined }}
      >
        <div className="flex items-center justify-between gap-4 pb-4 mb-6 border-b border-[var(--color-border)] flex-wrap">
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--color-text-primary)]">
              {activeFont.name}
            </h2>
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {activeFont.foundry} · {activeFont.classification} ·{' '}
              {activeFont.isVariable ? 'Variable' : activeFont.format} · {activeFont.license}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] text-neutral-500 dark:text-neutral-400">
              <span>Style</span>
              <select
                aria-label="Waterfall style variant"
                value={Math.min(selectedStyleIdx, activeFont.styles.length - 1)}
                onChange={(e) => setSelectedStyleIdx(Number(e.target.value))}
                className="h-7 px-2 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none cursor-pointer"
              >
                {activeFont.styles.map((s, idx) => (
                  <option key={s.id} value={idx}>
                    {s.name} ({s.weight})
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant={activeFont.activated ? 'secondary' : 'primary'}
              size="sm"
              label={activeFont.activated ? 'Deactivate' : 'Activate'}
              onClick={() => onToggleActivate(activeFont.id)}
            />
          </div>
        </div>

        {/* Scale Rows */}
        <div className="space-y-5">
          {WATERFALL_SIZES.map((size) => (
            <div
              key={size}
              className="flex items-baseline gap-5 pb-3 border-b border-[var(--color-border)]"
            >
              <span className="w-12 shrink-0 text-[11px] font-code tabular-nums text-neutral-400 dark:text-neutral-500 text-right">
                {size}px
              </span>
              <div
                className="flex-1 min-w-0 truncate text-[var(--color-text-primary)]"
                style={{
                  fontFamily: activeFont.cssFamily,
                  fontWeight: styleVariant?.weight ?? 400,
                  fontStyle: styleVariant?.italic ? 'italic' : 'normal',
                  fontSize: `${size}px`,
                  lineHeight: preview.lineHeight,
                  letterSpacing: `${preview.letterSpacing}em`,
                  textTransform: preview.textCase === 'none' ? undefined : preview.textCase,
                  fontFeatureSettings: featureSettings,
                  color: preview.foregroundColor || undefined,
                }}
              >
                {specimenText}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
