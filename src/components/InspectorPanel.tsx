import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import {
  Check,
  Copy,
  Download,
  Grid3X3,
  Info,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  FontFamily,
  OpenTypeState,
  PreviewSettings,
  ThemeMode,
} from '../types/font';
import {
  buildOpenTypeFeatureSettings,
  formatFileSize,
  generateFontCssSnippet,
} from '../utils/fontFilter';
import {
  ensureAdobeKitStylesheet,
  ensureFontshareFontLoaded,
  ensureGoogleFontLoaded,
  ensureRemoteFontLoaded,
} from '../utils/fontLoader';
const FontPairingAssistant = lazy(() =>
  import('./FontPairingAssistant').then((m) => ({ default: m.FontPairingAssistant })),
);

interface InspectorPanelProps {
  font: FontFamily | null;
  allFonts: FontFamily[];
  libraryName: string;
  preview: PreviewSettings;
  theme: ThemeMode;
  onUpdatePreview: (patch: Partial<PreviewSettings>) => void;
  onUpdateOpenType: (patch: Partial<OpenTypeState>) => void;
  onUpdateVariableAxes?: (patch: Partial<NonNullable<PreviewSettings['variableAxes']>>) => void;
  onToggleActivate: (fontId: string) => void;
  onSelectFont: (fontId: string) => void;
  onComparePair: (primaryFontId: string, secondaryFontId: string) => void;
  onAddTag: (fontId: string, tag: string) => void;
  onRemoveTag: (fontId: string, tag: string) => void;
  onUpdateNotes: (fontId: string, notes: string) => void;
  onNotify: (msg: string) => void;
}

type InspectorTab = 'info' | 'pair' | 'preview' | 'glyphs' | 'export';

const GLYPH_SETS: Record<string, string[]> = {
  'Basic Latin': Array.from(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  ),
  'Numerals & Currency': Array.from('0123456789$€£¥¢₹%‰#№°§¶'),
  'Punctuation': Array.from('.,:;!¡?¿—–-_/\\|()[]{}«»“”‘’"\'&@*+^~`'),
  'Extended Latin': Array.from('ÁÀÂÄÃÅÆÇÉÈÊËÍÌÎÏÑÓÒÔÖÕØŒÚÙÛÜÝŸßáàâäãåæçéèêëíìîïñóòôöõøœúùûüýÿ'),
  'Math & Arrows': Array.from('+-×÷=≠≈≤≥∞∑∏√∂∆∫←↑→↓↔↕↗↘↙↖•◦▪▫◊'),
};

const COLOR_SWATCHES = [
  { label: 'Default', fg: '', bg: '' },
  { label: 'Ink / Paper', fg: '#18181B', bg: '#F8F5EE' },
  { label: 'Slate / White', fg: '#0F172A', bg: '#FFFFFF' },
  { label: 'Ivory / Charcoal', fg: '#F4F4F5', bg: '#18181B' },
  { label: 'Cobalt / Ice', fg: '#1D4ED8', bg: '#EFF6FF' },
  { label: 'Amber / Espresso', fg: '#FDE68A', bg: '#1C1917' },
];

const OPENTYPE_CONTROLS: Array<{ key: keyof OpenTypeState; code: string; label: string; sample: string }> = [
  { key: 'liga', code: 'liga', label: 'Standard Ligatures', sample: 'fi fl ff' },
  { key: 'dlig', code: 'dlig', label: 'Discretionary Ligatures', sample: 'st ct' },
  { key: 'tnum', code: 'tnum', label: 'Tabular Figures', sample: '012345' },
  { key: 'onum', code: 'onum', label: 'Oldstyle Figures', sample: '1984' },
  { key: 'smcp', code: 'smcp', label: 'Small Caps', sample: 'Small' },
  { key: 'zero', code: 'zero', label: 'Slashed Zero', sample: '0O0' },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  font,
  allFonts,
  libraryName,
  preview,
  theme,
  onUpdatePreview,
  onUpdateOpenType,
  onUpdateVariableAxes,
  onToggleActivate,
  onSelectFont,
  onComparePair,
  onAddTag,
  onRemoveTag,
  onUpdateNotes,
  onNotify,
}) => {
  const [tab, setTab] = useState<InspectorTab>('info');
  const [tagInput, setTagInput] = useState('');
  const [glyphCategory, setGlyphCategory] = useState<string>('Basic Latin');
  const [glyphSearch, setGlyphSearch] = useState<string>('');
  const [selectedGlyph, setSelectedGlyph] = useState<string>('&');
  const [copiedCss, setCopiedCss] = useState(false);
  const [scaleRatio, setScaleRatio] = useState<number>(1.25);

  useEffect(() => {
    if (!font) return;
    if (font.adobeKitId) {
      ensureAdobeKitStylesheet(font.adobeKitId);
    } else if (font.fontshareSlug) {
      ensureFontshareFontLoaded(font.fontshareSlug, font.styles);
    } else if (font.remotePreviewUrl) {
      void ensureRemoteFontLoaded(font.name, font.remotePreviewUrl);
    } else if (!font.isCustomUpload && font.libraryId === 'lib-google') {
      ensureGoogleFontLoaded(font.name, font.styles);
    }
  }, [font]);

  const glyphSets = useMemo(() => {
    if (font?.customGlyphs && font.customGlyphs.length > 0) {
      return {
        'Embedded OpenType Glyphs': font.customGlyphs,
        ...GLYPH_SETS,
      };
    }
    return GLYPH_SETS;
  }, [font?.customGlyphs]);

  const activeGlyphCategory = glyphSets[glyphCategory] ? glyphCategory : Object.keys(glyphSets)[0];

  const totalSizeKb = useMemo(
    () => (font ? font.styles.reduce((acc, s) => acc + s.fileSizeKb, 0) : 0),
    [font],
  );

  if (!font) {
    return (
      <aside
        aria-label="Font Inspector"
        className="w-[348px] shrink-0 h-full border-l border-[var(--color-border)] bg-[#F1F1F1] dark:bg-[#1B1B1B] flex items-center justify-center p-6 text-center text-[13px] text-neutral-500"
      >
        Select a font family to inspect metadata, AI pairings, OpenType features, and glyphs.
      </aside>
    );
  }

  const featureSettings = buildOpenTypeFeatureSettings(preview.openType);
  const cssSnippet = generateFontCssSnippet(font);
  const glyphCodePoint = `U+${(selectedGlyph.codePointAt(0) ?? 38)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0')}`;
  const glyphHtmlEntity = `&#${selectedGlyph.codePointAt(0) ?? 38};`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(`Copied ${label}`);
    } catch {
      onNotify(`${label} ready`);
    }
  };

  const downloadSvgSpecimen = () => {
    const safeName = font.name.replace(/[<>&"]/g, '');
    const safeText = (preview.text || font.name).replace(/[<>&"]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="360" viewBox="0 0 960 360">
  <rect width="960" height="360" fill="${preview.backgroundColor || '#FFFFFF'}"/>
  <text x="48" y="64" font-family="sans-serif" font-size="14" fill="#6B7280">${safeName} · ${font.foundry} · ${font.styles.length} styles</text>
  <text x="48" y="176" font-family="${font.name}, sans-serif" font-size="64" fill="${preview.foregroundColor || '#111827'}">${safeName}</text>
  <text x="48" y="246" font-family="${font.name}, sans-serif" font-size="24" fill="${preview.foregroundColor || '#374151'}">${safeText.slice(0, 62)}</text>
  <text x="48" y="312" font-family="${font.name}, sans-serif" font-size="18" fill="#6B7280">ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</text>
</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${font.id}-specimen.svg`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Downloaded ${font.name} SVG specimen`);
  };

  const tabs: Array<{ id: InspectorTab; label: string; icon: React.ReactNode }> = [
    { id: 'info', label: 'Info', icon: <Info className="w-3.5 h-3.5" /> },
    { id: 'pair', label: 'Pair', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'preview', label: 'Style', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'glyphs', label: 'Glyphs', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
    { id: 'export', label: 'Export', icon: <Download className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside
      aria-label="Font Inspector"
      className="w-[348px] shrink-0 h-full flex flex-col border-l border-[var(--color-border)] bg-[#F1F1F1] dark:bg-[#1B1B1B] select-none"
    >
      {/* Selected Font Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-white dark:bg-[#262626] shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] truncate">
              {font.name}
            </h2>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              {font.foundry} · {font.styles.length} styles
            </p>
          </div>
          <Button
            variant={font.activated ? 'secondary' : 'primary'}
            size="sm"
            label={font.activated ? 'Active' : 'Activate'}
            onClick={() => onToggleActivate(font.id)}
          />
        </div>

        {/* Astryx SegmentedControl Inspector Tabs */}
        <div className="mt-3">
          <SegmentedControl
            label="Inspector Tabs"
            size="sm"
            value={tab}
            onChange={(val) => setTab(val as InspectorTab)}
          >
            {tabs.map((t) => (
              <SegmentedControlItem
                key={t.id}
                value={t.id}
                label={t.label}
              />
            ))}
          </SegmentedControl>
        </div>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-[12px]">
        {tab === 'info' && (
          <>
            {/* Live Specimen Banner */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#262626] border border-[var(--color-border)]">
              <div
                className="text-[32px] leading-tight text-[var(--color-text-primary)] truncate"
                style={{ fontFamily: font.cssFamily, fontFeatureSettings: featureSettings }}
              >
                AaBbCc 123
              </div>
              <div className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                {font.classification} · {font.width} · {font.isVariable ? 'Variable' : font.format}
              </div>
            </div>

            {/* Technical Metadata Table */}
            <section aria-label="Font Technical Details">
              <h3 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
                Details
              </h3>
              <dl className="divide-y divide-[var(--color-border)] border-t border-b border-[var(--color-border)]">
                {[
                  ['Foundry', font.foundry],
                  ['Designer', font.designer],
                  ['Library', libraryName],
                  [
                    'Format',
                    font.format === 'Variable'
                      ? 'Variable (OTF/TTF)'
                      : font.isVariable
                        ? `${font.format} (Variable)`
                        : font.format,
                  ],
                  ['Version', font.version],
                  ['License', font.license],
                  ['Disk Size', totalSizeKb > 0 ? formatFileSize(totalSizeKb) : 'Cloud / Web'],
                  ['Languages', font.languages.join(', ')],
                ].map(([label, value]) => (
                  <div key={label} className="py-1.5 flex items-start justify-between gap-3">
                    <dt className="text-neutral-500 dark:text-neutral-400 shrink-0">{label}</dt>
                    <dd className="text-right text-[var(--color-text-primary)] font-medium break-words">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Tags Manager */}
            <section aria-label="Font Tags">
              <h3 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
                Tags
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (tagInput.trim()) {
                    onAddTag(font.id, tagInput);
                    setTagInput('');
                  }
                }}
                className="flex items-center gap-1.5 mb-2.5"
              >
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add tag (e.g. headline)…"
                  aria-label="Add custom tag"
                  className="flex-1 h-7 px-2.5 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
                />
                <button
                  type="submit"
                  aria-label="Save tag"
                  className="h-7 px-2 rounded-lg bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111] hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>

              {font.tags.length === 0 ? (
                <p className="text-[11px] text-neutral-400">No tags assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-x-2.5 gap-y-1.5">
                  {font.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-[12px] text-neutral-700 dark:text-neutral-300"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveTag(font.id, tag)}
                        aria-label={`Remove tag ${tag}`}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Notes */}
            <section aria-label="Font Notes">
              <label
                htmlFor="inspector-font-notes"
                className="block text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5"
              >
                Notes
              </label>
              <textarea
                id="inspector-font-notes"
                rows={3}
                value={font.notes}
                onChange={(e) => onUpdateNotes(font.id, e.target.value)}
                placeholder="Add usage notes, pairing ideas, or client project info…"
                className="w-full p-2.5 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1] resize-none select-text"
              />
            </section>
          </>
        )}

        {tab === 'pair' && (
          <Suspense
            fallback={
              <div className="p-4 text-[12px] text-neutral-500">Loading pairing assistant…</div>
            }
          >
            <FontPairingAssistant
              font={font}
              allFonts={allFonts}
              preview={preview}
              theme={theme}
              onSelectFont={onSelectFont}
              onComparePair={onComparePair}
              onToggleActivate={onToggleActivate}
              onNotify={onNotify}
            />
          </Suspense>
        )}

        {tab === 'preview' && (
          <>
            {/* Typography Sliders */}
            <section aria-label="Spacing Controls" className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  Typography Metrics
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePreview({
                      fontSize: 34,
                      lineHeight: 1.25,
                      letterSpacing: 0,
                      foregroundColor: '',
                      backgroundColor: '',
                    })
                  }
                  className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-primary)] hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <label htmlFor="insp-size" className="text-neutral-600 dark:text-neutral-300">
                    Size
                  </label>
                  <span className="font-code tabular-nums text-neutral-500">{preview.fontSize}px</span>
                </div>
                <input
                  id="insp-size"
                  type="range"
                  min={14}
                  max={96}
                  value={preview.fontSize}
                  onChange={(e) => onUpdatePreview({ fontSize: Number(e.target.value) })}
                  className="mac-slider w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <label htmlFor="insp-lh" className="text-neutral-600 dark:text-neutral-300">
                    Line Height
                  </label>
                  <span className="font-code tabular-nums text-neutral-500">
                    {preview.lineHeight.toFixed(2)}
                  </span>
                </div>
                <input
                  id="insp-lh"
                  type="range"
                  min={0.9}
                  max={2.2}
                  step={0.05}
                  value={preview.lineHeight}
                  onChange={(e) => onUpdatePreview({ lineHeight: Number(e.target.value) })}
                  className="mac-slider w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <label htmlFor="insp-ls" className="text-neutral-600 dark:text-neutral-300">
                    Tracking
                  </label>
                  <span className="font-code tabular-nums text-neutral-500">
                    {preview.letterSpacing > 0 ? '+' : ''}
                    {preview.letterSpacing.toFixed(2)}em
                  </span>
                </div>
                <input
                  id="insp-ls"
                  type="range"
                  min={-0.08}
                  max={0.25}
                  step={0.01}
                  value={preview.letterSpacing}
                  onChange={(e) => onUpdatePreview({ letterSpacing: Number(e.target.value) })}
                  className="mac-slider w-full"
                />
              </div>
            </section>

            {/* Color Contrast Swatches */}
            <section aria-label="Specimen Colors">
              <h3 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
                Specimen Contrast
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                {COLOR_SWATCHES.map((swatch) => {
                  const active =
                    preview.foregroundColor === swatch.fg &&
                    preview.backgroundColor === swatch.bg;
                  return (
                    <button
                      key={swatch.label}
                      type="button"
                      onClick={() =>
                        onUpdatePreview({
                          foregroundColor: swatch.fg,
                          backgroundColor: swatch.bg,
                        })
                      }
                      className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-[#1b1b1b] dark:border-[#f1f1f1] ring-1 ring-[#1b1b1b] dark:ring-[#f1f1f1]'
                          : 'border-[var(--color-border)] hover:border-neutral-400'
                      }`}
                      style={{
                        backgroundColor: swatch.bg || undefined,
                        color: swatch.fg || undefined,
                      }}
                    >
                      <div className="text-[13px] font-semibold" style={{ fontFamily: font.cssFamily }}>
                        Aa
                      </div>
                      <div className="text-[10px] opacity-75 truncate">{swatch.label}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Variable Font Axis Sliders */}
            {font.isVariable && onUpdateVariableAxes && (
              <section aria-label="Variable Font Axes" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                    Variable Axes
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateVariableAxes({ wght: 400, wdth: 100, slnt: 0, opsz: 14 })
                    }
                    className="text-[11px] font-medium text-[var(--color-text-primary)] hover:underline cursor-pointer"
                  >
                    Reset Axes
                  </button>
                </div>

                {[
                  {
                    key: 'wght' as const,
                    label: 'Weight (wght)',
                    min: 100,
                    max: 900,
                    step: 10,
                    val: preview.variableAxes?.wght ?? 400,
                  },
                  {
                    key: 'wdth' as const,
                    label: 'Width (wdth)',
                    min: 50,
                    max: 150,
                    step: 5,
                    val: preview.variableAxes?.wdth ?? 100,
                  },
                  {
                    key: 'slnt' as const,
                    label: 'Slant (slnt)',
                    min: -12,
                    max: 0,
                    step: 1,
                    val: preview.variableAxes?.slnt ?? 0,
                  },
                  {
                    key: 'opsz' as const,
                    label: 'Optical Size (opsz)',
                    min: 8,
                    max: 144,
                    step: 2,
                    val: preview.variableAxes?.opsz ?? 14,
                  },
                ].map((axis) => (
                  <div key={axis.key}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <label htmlFor={`axis-${axis.key}`} className="text-neutral-600 dark:text-neutral-300">
                        {axis.label}
                      </label>
                      <span className="font-code tabular-nums text-neutral-500">{axis.val}</span>
                    </div>
                    <input
                      id={`axis-${axis.key}`}
                      type="range"
                      min={axis.min}
                      max={axis.max}
                      step={axis.step}
                      value={axis.val}
                      onChange={(e) => onUpdateVariableAxes({ [axis.key]: Number(e.target.value) })}
                      className="mac-slider w-full"
                    />
                  </div>
                ))}
              </section>
            )}

            {/* OpenType Features */}
            <section aria-label="OpenType Features">
              <h3 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
                OpenType Features
              </h3>
              <div className="space-y-1.5">
                {OPENTYPE_CONTROLS.map((ot) => {
                  const enabled = preview.openType[ot.key];
                  return (
                    <label
                      key={ot.key}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => onUpdateOpenType({ [ot.key]: !enabled })}
                          className="rounded accent-[#1b1b1b] dark:accent-[#f1f1f1] cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="text-[12px] text-[var(--color-text-primary)] truncate">
                            {ot.label}
                          </div>
                          <div className="text-[10px] font-code text-neutral-400">{ot.code}</div>
                        </div>
                      </div>
                      <span
                        className="text-[14px] text-neutral-600 dark:text-neutral-300 shrink-0"
                        style={{
                          fontFamily: font.cssFamily,
                          fontFeatureSettings: `"${ot.code}" ${enabled ? 1 : 0}`,
                        }}
                      >
                        {ot.sample}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {tab === 'glyphs' && (
          <>
            {/* Enlarged Glyph Inspector */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#262626] border border-[var(--color-border)] flex items-center justify-between gap-4">
              <div
                data-testid="selected-glyph-preview"
                className="w-20 h-20 rounded-lg bg-[#F1F1F1] dark:bg-[#1B1B1B] border border-[var(--color-border)] flex items-center justify-center text-[48px] text-[var(--color-text-primary)] shrink-0"
                style={{ fontFamily: font.cssFamily, fontFeatureSettings: featureSettings }}
              >
                {selectedGlyph}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                  Glyph Inspector
                </div>
                <div className="text-[11px] font-code tabular-nums text-neutral-500">
                  {glyphCodePoint} · {glyphHtmlEntity}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  label="Copy Glyph"
                  icon={<Copy className="w-3 h-3" />}
                  onClick={() => void copyToClipboard(selectedGlyph, `glyph "${selectedGlyph}"`)}
                />
              </div>
            </div>

            {/* Category Selector + Glyph Search */}
            <div className="space-y-2">
              <input
                type="search"
                value={glyphSearch}
                onChange={(e) => setGlyphSearch(e.target.value)}
                placeholder="Search glyph or Unicode (e.g. €, 00A9, →)…"
                aria-label="Search glyphs"
                className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
              />
              <label className="block">
                <span className="sr-only">Glyph Category</span>
                <select
                  aria-label="Glyph Category"
                  value={activeGlyphCategory}
                  onChange={(e) => setGlyphCategory(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none cursor-pointer"
                >
                  {Object.keys(glyphSets).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat} ({glyphSets[cat].length})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Character Map Grid */}
            <div
              role="grid"
              aria-label="Character Map"
              className="grid grid-cols-6 gap-1"
            >
              {(glyphSearch.trim()
                ? Array.from(new Set(Object.values(glyphSets).flat())).filter((char) => {
                    const q = glyphSearch.trim().toLowerCase();
                    const hex = (char.codePointAt(0) ?? 0).toString(16).padStart(4, '0').toLowerCase();
                    return char.toLowerCase().includes(q) || hex.includes(q.replace(/^u\+/, ''));
                  })
                : glyphSets[activeGlyphCategory] ?? []
              ).map((char, idx) => {
                const isSelected = selectedGlyph === char;
                return (
                  <button
                    key={`${char}-${idx}`}
                    type="button"
                    onClick={() => setSelectedGlyph(char)}
                    onDoubleClick={() => void copyToClipboard(char, `glyph "${char}"`)}
                    title="Click to inspect · Double-click to copy"
                    aria-label={`Inspect glyph ${char}`}
                    aria-pressed={isSelected}
                    className={`h-10 flex items-center justify-center rounded-lg border text-[18px] transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1b1b1b] text-white border-[#1b1b1b] dark:bg-[#f1f1f1] dark:text-[#111111] dark:border-[#f1f1f1]'
                        : 'bg-white dark:bg-[#262626] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-neutral-500'
                    }`}
                    style={{ fontFamily: font.cssFamily }}
                  >
                    {char}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === 'export' && (
          <>
            {/* CSS / Web Export */}
            <section aria-label="Web CSS Export">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  CSS Export
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    void copyToClipboard(cssSnippet, 'CSS snippet');
                    setCopiedCss(true);
                    window.setTimeout(() => setCopiedCss(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-primary)] hover:underline cursor-pointer"
                >
                  {copiedCss ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCss ? 'Copied' : 'Copy CSS'}</span>
                </button>
              </div>
              <pre className="p-2.5 rounded-lg bg-white dark:bg-[#141414] border border-[var(--color-border)] text-[10.5px] font-code text-neutral-700 dark:text-neutral-300 overflow-x-auto select-text leading-relaxed">
                {cssSnippet}
              </pre>

              <div className="mt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  width="100%"
                  label="Download SVG Specimen Sheet"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={downloadSvgSpecimen}
                />
              </div>
            </section>

            {/* Type Scale & Design Tokens Exporter */}
            <section aria-label="Type Scale & Design Tokens" className="space-y-2.5 pt-2 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  Type Scale &amp; Tokens
                </h3>
                <select
                  aria-label="Type scale ratio"
                  value={scaleRatio}
                  onChange={(e) => setScaleRatio(Number(e.target.value))}
                  className="h-6 px-1.5 rounded-md bg-white dark:bg-[#262626] border border-[var(--color-border)] text-[11px] text-[var(--color-text-primary)] outline-none cursor-pointer"
                >
                  <option value={1.2}>1.20 Minor Third</option>
                  <option value={1.25}>1.25 Major Third</option>
                  <option value={1.333}>1.33 Perfect Fourth</option>
                  <option value={1.414}>1.41 Augmented Fourth</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#262626] border border-[var(--color-border)] space-y-2">
                {[
                  { label: 'Display', step: 4 },
                  { label: 'H1', step: 3 },
                  { label: 'H2', step: 2 },
                  { label: 'H3', step: 1 },
                  { label: 'Body', step: 0 },
                ].map(({ label, step }) => {
                  const px = Math.round(16 * Math.pow(scaleRatio, step));
                  return (
                    <div key={label} className="flex items-baseline justify-between gap-2">
                      <span
                        className="truncate text-[var(--color-text-primary)]"
                        style={{
                          fontFamily: font.cssFamily,
                          fontSize: `${Math.min(px, 34)}px`,
                          lineHeight: 1.15,
                        }}
                      >
                        {label} — {font.name}
                      </span>
                      <span className="font-code tabular-nums text-[10px] text-neutral-400 shrink-0">
                        {px}px
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  label="Copy CSS Vars"
                  icon={<Copy className="w-3 h-3" />}
                  onClick={() => {
                    const steps = [
                      ['--text-body', 0],
                      ['--text-h3', 1],
                      ['--text-h2', 2],
                      ['--text-h1', 3],
                      ['--text-display', 4],
                    ] as const;
                    const vars = [
                      `:root {`,
                      `  --font-primary: ${font.cssFamily};`,
                      ...steps.map(
                        ([name, s]) => `  ${name}: ${(Math.pow(scaleRatio, s)).toFixed(3)}rem;`,
                      ),
                      `}`,
                    ].join('\n');
                    void copyToClipboard(vars, 'CSS Type Scale tokens');
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Tailwind"
                  icon={<Copy className="w-3 h-3" />}
                  onClick={() => {
                    const tw = [
                      `@theme {`,
                      `  --font-display: ${font.cssFamily};`,
                      `  --text-h1: ${Math.pow(scaleRatio, 3).toFixed(3)}rem;`,
                      `  --text-h2: ${Math.pow(scaleRatio, 2).toFixed(3)}rem;`,
                      `  --text-h3: ${Math.pow(scaleRatio, 1).toFixed(3)}rem;`,
                      `}`,
                    ].join('\n');
                    void copyToClipboard(tw, 'Tailwind v4 @theme tokens');
                  }}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
};
