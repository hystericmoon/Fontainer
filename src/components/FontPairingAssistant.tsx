import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Columns2,
  Copy,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  fetchFontPairings,
  type FontPairingResponse,
  type FontPairingSuggestion,
  type PairingContextPreset,
  type SelectedFontRole,
} from '../services/pairingService';
import type { FontFamily, PreviewSettings, ThemeMode } from '../types/font';
import { buildOpenTypeFeatureSettings } from '../utils/fontFilter';
import { ensureGoogleFontLoaded } from '../utils/fontLoader';

interface FontPairingAssistantProps {
  font: FontFamily;
  allFonts: FontFamily[];
  preview: PreviewSettings;
  theme: ThemeMode;
  onSelectFont: (fontId: string) => void;
  onComparePair: (primaryFontId: string, secondaryFontId: string) => void;
  onToggleActivate: (fontId: string) => void;
  onNotify: (msg: string) => void;
}

const CONTEXT_OPTIONS: Array<{ id: PairingContextPreset; label: string }> = [
  { id: 'saas-ui', label: 'SaaS & UI' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'branding', label: 'Brand & Hero' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'docs', label: 'Docs & Tech' },
  { id: 'portfolio', label: 'Portfolio' },
];

const ROLE_OPTIONS: Array<{ id: SelectedFontRole; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'heading', label: 'As Heading' },
  { id: 'body', label: 'As Body' },
  { id: 'ui', label: 'As UI' },
];

// Session-scoped cache so switching between Inspector tabs or fonts preserves results instantly
const clientPairingCache = new Map<string, FontPairingResponse>();

function makeCacheKey(
  fontId: string,
  context: PairingContextPreset,
  role: SelectedFontRole,
  brief: string,
): string {
  return `${fontId}::${context}::${role}::${brief.trim().toLowerCase()}`;
}

function buildPairingCss(primary: FontFamily, suggestion: FontPairingSuggestion, selectedRole: SelectedFontRole): string {
  const isSuggestionHeading =
    selectedRole === 'body' ||
    selectedRole === 'ui' ||
    /heading|display/i.test(suggestion.role);

  const headingName = isSuggestionHeading ? suggestion.family : primary.name;
  const bodyName = isSuggestionHeading ? primary.name : suggestion.family;
  const headingFallback = /serif/i.test(isSuggestionHeading ? suggestion.classification : primary.classification)
    ? 'serif'
    : /mono/i.test(isSuggestionHeading ? suggestion.classification : primary.classification)
      ? 'monospace'
      : 'sans-serif';
  const bodyFallback = /serif/i.test(isSuggestionHeading ? primary.classification : suggestion.classification)
    ? 'serif'
    : /mono/i.test(isSuggestionHeading ? primary.classification : suggestion.classification)
      ? 'monospace'
      : 'sans-serif';

  const imports: string[] = [];
  if (primary.libraryId === 'lib-google') {
    imports.push(
      `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(primary.name).replace(/%20/g, '+')}:wght@400;600;700&display=swap');`,
    );
  }
  if (suggestion.inGoogleCatalog) {
    imports.push(
      `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(suggestion.family).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap');`,
    );
  }

  return `${imports.length > 0 ? `${imports.join('\n')}\n\n` : ''}:root {
  --font-heading: '${headingName}', ${headingFallback};
  --font-body: '${bodyName}', ${bodyFallback};
}

h1, h2, h3 { font-family: var(--font-heading); }
body, p { font-family: var(--font-body); }`;
}

export const FontPairingAssistant: React.FC<FontPairingAssistantProps> = ({
  font,
  allFonts,
  preview,
  theme,
  onSelectFont,
  onComparePair,
  onToggleActivate,
  onNotify,
}) => {
  const [context, setContext] = useState<PairingContextPreset>('saas-ui');
  const [selectedRole, setSelectedRole] = useState<SelectedFontRole>('auto');
  const [customBrief, setCustomBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FontPairingResponse | null>(null);
  const [copiedFamily, setCopiedFamily] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const catalogByLowerName = useMemo(() => {
    const map = new Map<string, FontFamily>();
    for (const f of allFonts) {
      map.set(f.name.toLowerCase(), f);
    }
    return map;
  }, [allFonts]);

  const userCustomFamilies = useMemo(
    () =>
      allFonts
        .filter((f) => f.libraryId !== 'lib-google' && f.id !== font.id)
        .map((f) => f.name)
        .slice(0, 30),
    [allFonts, font.id],
  );

  // Restore cached pairing when switching fonts or options; abort stale requests
  useEffect(() => {
    abortRef.current?.abort();
    setLoading(false);
    setError(null);
    const key = makeCacheKey(font.id, context, selectedRole, customBrief);
    setResult(clientPairingCache.get(key) ?? null);
  }, [font.id, context, selectedRole, customBrief]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Load real Google Fonts stylesheets for every suggested pairing so live lockups render authentically
  useEffect(() => {
    if (!result) return;
    for (const pairing of result.pairings) {
      const matched = catalogByLowerName.get(pairing.family.toLowerCase());
      if (matched && matched.libraryId === 'lib-google') {
        ensureGoogleFontLoaded(matched.name, matched.styles);
      } else if (pairing.inGoogleCatalog) {
        ensureGoogleFontLoaded(pairing.family);
      }
    }
  }, [result, catalogByLowerName]);

  const runAnalysis = useCallback(
    async (forceRefresh = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const key = makeCacheKey(font.id, context, selectedRole, customBrief);
      if (!forceRefresh && clientPairingCache.has(key)) {
        setResult(clientPairingCache.get(key) ?? null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      let timedOut = false;
      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 22_000);

      try {
        const data = await fetchFontPairings(
          {
            font,
            context,
            selectedRole,
            customBrief,
            theme,
            previewText: preview.text,
            userLibraryFamilies: userCustomFamilies,
            forceRefresh,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        clientPairingCache.set(key, data);
        setResult(data);
      } catch (err) {
        if (timedOut) {
          setError('Font pairing request timed out. Please try again.');
          return;
        }
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unable to generate font pairings.');
      } finally {
        window.clearTimeout(timeoutId);
        if (abortRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [font, context, selectedRole, customBrief, theme, preview.text, userCustomFamilies],
  );

  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  const featureSettings = buildOpenTypeFeatureSettings(preview.openType);

  const handleCopyPairingCss = async (suggestion: FontPairingSuggestion) => {
    const css = buildPairingCss(font, suggestion, selectedRole);
    try {
      await navigator.clipboard.writeText(css);
      setCopiedFamily(suggestion.family);
      onNotify(`Copied CSS pairing (${font.name} + ${suggestion.family})`);
      window.setTimeout(() => {
        setCopiedFamily((cur) => (cur === suggestion.family ? null : cur));
      }, 1800);
    } catch {
      onNotify('Pairing CSS ready');
    }
  };

  return (
    <div className="space-y-4">
      {/* Context & Role Configuration */}
      <section
        aria-label="Font Pairing Context"
        className="p-3 rounded-xl bg-white dark:bg-[#262626] border border-[var(--color-border)] space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-text-primary)]" />
            <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)]">
              AI Pairing Assistant
            </h3>
          </div>
          <span className="text-[10px] font-code text-neutral-400">Gemini</span>
        </div>

        {/* Layout Context Grid */}
        <div>
          <span className="block text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
            Layout Context
          </span>
          <div className="grid grid-cols-3 gap-1">
            {CONTEXT_OPTIONS.map((opt) => {
              const active = context === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setContext(opt.id)}
                  aria-pressed={active}
                  className={`h-7 px-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer truncate border ${
                    active
                      ? 'bg-[#1b1b1b] text-white border-[#1b1b1b] dark:bg-[#f1f1f1] dark:text-[#111111] dark:border-[#f1f1f1]'
                      : 'bg-[#F1F1F1] dark:bg-[#1B1B1B] text-neutral-700 dark:text-neutral-300 border-transparent hover:border-[var(--color-border)]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Role of Selected Font */}
        <div>
          <span className="block text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
            Use {font.name}
          </span>
          <div className="grid grid-cols-4 gap-1">
            {ROLE_OPTIONS.map((opt) => {
              const active = selectedRole === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedRole(opt.id)}
                  aria-pressed={active}
                  className={`h-7 px-1 rounded-md text-[10.5px] font-medium transition-colors cursor-pointer truncate border ${
                    active
                      ? 'bg-[#1b1b1b] text-white border-[#1b1b1b] dark:bg-[#f1f1f1] dark:text-[#111111] dark:border-[#f1f1f1]'
                      : 'bg-[#F1F1F1] dark:bg-[#1B1B1B] text-neutral-700 dark:text-neutral-300 border-transparent hover:border-[var(--color-border)]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Project Brief */}
        <div>
          <label
            htmlFor="pairing-custom-brief"
            className="block text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 mb-1"
          >
            Project Mood / Notes (optional)
          </label>
          <input
            id="pairing-custom-brief"
            type="text"
            maxLength={160}
            value={customBrief}
            onChange={(e) => setCustomBrief(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                e.preventDefault();
                void runAnalysis(false);
              }
            }}
            placeholder="e.g. minimalist fintech, warm editorial…"
            className="w-full h-7 px-2.5 rounded-lg bg-[#F1F1F1] dark:bg-[#1B1B1B] border border-[var(--color-border)] text-[11.5px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1] select-text"
          />
        </div>

        <div className="flex items-center gap-1.5 pt-0.5">
          <div className="flex-1">
            <Button
              variant="primary"
              size="sm"
              width="100%"
              isDisabled={loading}
              label={loading ? 'Analyzing…' : result ? 'Update Pairings' : 'Suggest Pairings'}
              icon={<Sparkles className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />}
              onClick={() => void runAnalysis(Boolean(result))}
            />
          </div>
          {loading && (
            <Button
              variant="secondary"
              size="sm"
              label="Cancel"
              onClick={cancelAnalysis}
            />
          )}
          {result && !loading && (
            <button
              type="button"
              onClick={() => void runAnalysis(true)}
              aria-label="Regenerate font pairings"
              title="Regenerate pairings"
              className="h-8 w-8 shrink-0 rounded-lg border border-[var(--color-border)] bg-[#F1F1F1] dark:bg-[#1B1B1B] flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-[var(--color-text-primary)] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-[11.5px] flex items-start gap-2 leading-relaxed"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void runAnalysis(true)}
              className="mt-1.5 text-[11px] font-semibold underline cursor-pointer"
            >
              Retry analysis
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-2.5" aria-live="polite" aria-busy="true">
          <div className="p-3 rounded-xl bg-white dark:bg-[#262626] border border-[var(--color-border)] animate-pulse space-y-2">
            <div className="h-3 w-28 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-2.5 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-white dark:bg-[#262626] border border-[var(--color-border)] animate-pulse space-y-2.5"
            >
              <div className="flex justify-between">
                <div className="h-3.5 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-3.5 w-14 rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
              <div className="h-14 w-full rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-2.5 w-5/6 rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      )}

      {/* Empty Prompt State */}
      {!loading && !result && !error && (
        <div className="p-4 rounded-xl border border-dashed border-[var(--color-border)] bg-white/60 dark:bg-[#262626]/50 text-center space-y-1.5">
          <p className="text-[12px] font-medium text-[var(--color-text-primary)]">
            Pair {font.name} with complementary typefaces
          </p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Pick a layout context above and click <strong>Suggest Pairings</strong> to analyze stroke
            contrast, x-height, and hierarchy with live typography previews.
          </p>
        </div>
      )}

      {/* Gemini Typographic Analysis + Live Pairing Cards */}
      {!loading && result && (
        <div className="space-y-3" data-testid="pairing-results">
          {/* Selected Font Profile */}
          <section
            aria-label="Selected Font Analysis"
            className="p-3 rounded-xl bg-white dark:bg-[#262626] border border-[var(--color-border)] space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[var(--color-text-primary)] truncate">
                {result.analysis.personality}
              </span>
              <span className="text-[10px] font-code px-1.5 py-0.5 rounded bg-[#F1F1F1] dark:bg-[#1B1B1B] text-neutral-600 dark:text-neutral-300 shrink-0">
                Best: {result.analysis.idealRole}
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {result.analysis.summary}
            </p>
          </section>

          {/* Complementary Pairing Cards */}
          <div className="space-y-2.5">
            {result.pairings.map((pairing) => {
              const matchedCatalogFont = catalogByLowerName.get(pairing.family.toLowerCase()) ?? null;
              const fallbackGeneric = /serif/i.test(pairing.classification)
                ? 'serif'
                : /mono/i.test(pairing.classification)
                  ? 'monospace'
                  : 'sans-serif';
              const partnerCssFamily = matchedCatalogFont
                ? matchedCatalogFont.cssFamily
                : `'${pairing.family}', ${fallbackGeneric}`;

              // Place heading vs body font in the right visual slot for the live lockup
              const partnerIsHeading =
                selectedRole === 'body' ||
                selectedRole === 'ui' ||
                /heading|display/i.test(pairing.role);

              const headlineFamily = partnerIsHeading ? partnerCssFamily : font.cssFamily;
              const bodyFamily = partnerIsHeading ? font.cssFamily : partnerCssFamily;
              const isCopied = copiedFamily === pairing.family;

              return (
                <article
                  key={`${pairing.family}-${pairing.role}`}
                  data-testid="pairing-card"
                  className="p-3 rounded-xl bg-white dark:bg-[#262626] border border-[var(--color-border)] space-y-2.5"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                          {pairing.family}
                        </h4>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F1F1F1] dark:bg-[#1B1B1B] text-neutral-600 dark:text-neutral-300 shrink-0">
                          {pairing.role}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                        {pairing.classification} · {pairing.recommendedWeights}
                      </p>
                    </div>
                    <div
                      title="Typographic harmony score"
                      className="text-[11px] font-code tabular-nums font-semibold text-[var(--color-text-primary)] shrink-0"
                    >
                      {pairing.harmonyScore}%
                    </div>
                  </div>

                  {/* Live Paired Typography Lockup */}
                  <div
                    className="p-3 rounded-lg border border-[var(--color-border)] bg-[#FAFAFA] dark:bg-[#1B1B1B] space-y-1.5 overflow-hidden"
                    style={{
                      backgroundColor: preview.backgroundColor || undefined,
                      color: preview.foregroundColor || undefined,
                    }}
                  >
                    <div
                      className="text-[18px] leading-snug font-semibold tracking-tight text-[var(--color-text-primary)]"
                      style={{
                        fontFamily: headlineFamily,
                        fontFeatureSettings: featureSettings,
                        color: preview.foregroundColor || undefined,
                      }}
                    >
                      {pairing.sampleHeadline}
                    </div>
                    <p
                      className="text-[12.5px] leading-relaxed text-neutral-600 dark:text-neutral-300"
                      style={{
                        fontFamily: bodyFamily,
                        fontFeatureSettings: featureSettings,
                        color: preview.foregroundColor || undefined,
                        opacity: preview.foregroundColor ? 0.85 : undefined,
                      }}
                    >
                      {pairing.sampleBody}
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[9.5px] font-code text-neutral-400">
                      <span className="truncate">
                        H: {partnerIsHeading ? pairing.family : font.name} · B:{' '}
                        {partnerIsHeading ? font.name : pairing.family}
                      </span>
                      <span className="shrink-0 ml-2">{pairing.sizeRatio}</span>
                    </div>
                  </div>

                  {/* Rationale */}
                  <p className="text-[11.5px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    {pairing.rationale}
                  </p>

                  {/* Action Row */}
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {matchedCatalogFont && (
                        <>
                          <button
                            type="button"
                            onClick={() => onComparePair(font.id, matchedCatalogFont.id)}
                            className="h-6 px-2 rounded-md bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111] hover:opacity-90 text-[10.5px] font-medium transition-opacity cursor-pointer inline-flex items-center gap-1"
                          >
                            <Columns2 className="w-3 h-3" />
                            <span>Compare</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleActivate(matchedCatalogFont.id)}
                            className="h-6 px-2 rounded-md bg-[#F1F1F1] dark:bg-[#1B1B1B] border border-[var(--color-border)] hover:border-neutral-400 text-[10.5px] font-medium text-[var(--color-text-primary)] transition-colors cursor-pointer"
                          >
                            {matchedCatalogFont.activated ? 'Active' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectFont(matchedCatalogFont.id)}
                            aria-label={`Inspect ${matchedCatalogFont.name}`}
                            title={`Inspect ${matchedCatalogFont.name}`}
                            className="h-6 w-6 rounded-md bg-[#F1F1F1] dark:bg-[#1B1B1B] border border-[var(--color-border)] hover:border-neutral-400 text-neutral-600 dark:text-neutral-300 flex items-center justify-center cursor-pointer"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCopyPairingCss(pairing)}
                      className="h-6 px-2 rounded-md bg-[#F1F1F1] dark:bg-[#1B1B1B] border border-[var(--color-border)] hover:border-neutral-400 text-[10.5px] font-medium text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0"
                    >
                      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{isCopied ? 'Copied' : 'CSS'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
