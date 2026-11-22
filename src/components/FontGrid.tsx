import React, { useEffect, useRef } from 'react';
import { Switch } from '@astryxdesign/core/Switch';
import { Columns2, Star } from 'lucide-react';
import type { FontFamily, PreviewSettings } from '../types/font';
import { buildOpenTypeFeatureSettings } from '../utils/fontFilter';
import { ensureAdobeKitStylesheet, ensureGoogleFontLoaded } from '../utils/fontLoader';

interface FontGridProps {
  fonts: FontFamily[];
  selectedFontId: string;
  preview: PreviewSettings;
  compareIds: string[];
  onSelectFont: (id: string) => void;
  onToggleActivate: (id: string) => void;
  onToggleStar: (id: string) => void;
  onToggleCompare: (id: string) => void;
}

const FontGridCard: React.FC<{
  font: FontFamily;
  selected: boolean;
  inCompare: boolean;
  preview: PreviewSettings;
  featureSettings: string;
  specimenText: string;
  onSelectFont: (id: string) => void;
  onToggleActivate: (id: string) => void;
  onToggleStar: (id: string) => void;
  onToggleCompare: (id: string) => void;
}> = ({
  font,
  selected,
  inCompare,
  preview,
  featureSettings,
  specimenText,
  onSelectFont,
  onToggleActivate,
  onToggleStar,
  onToggleCompare,
}) => {
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const loadFace = () => {
      if (font.adobeKitId) {
        ensureAdobeKitStylesheet(font.adobeKitId);
      } else if (!font.isCustomUpload && font.libraryId === 'lib-google') {
        ensureGoogleFontLoaded(font.name, font.styles);
      }
    };
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      loadFace();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadFace();
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [font.adobeKitId, font.isCustomUpload, font.libraryId, font.name, font.styles]);

  return (
    <article
      ref={cardRef}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/fontainer-font-id', font.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={`group flex flex-col rounded-xl border transition-colors ${
        selected
          ? 'border-[#1b1b1b] dark:border-[#f1f1f1] bg-black/[0.02] dark:bg-white/[0.05]'
          : 'border-[var(--color-border)] bg-white dark:bg-[#262626] hover:border-neutral-400 dark:hover:border-neutral-600'
      }`}
    >
      {/* Card Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center">
            <Switch
              size="sm"
              isLabelHidden
              label={font.activated ? `Deactivate ${font.name}` : `Activate ${font.name}`}
              value={font.activated}
              onChange={() => onToggleActivate(font.id)}
            />
          </div>
          <span className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
            {font.name}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onToggleStar(font.id)}
            aria-label={font.starred ? `Unstar ${font.name}` : `Star ${font.name}`}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              font.starred
                ? 'text-amber-500'
                : 'text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${font.starred ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onToggleCompare(font.id)}
            aria-label={inCompare ? `Remove ${font.name} from Compare` : `Compare ${font.name}`}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              inCompare
                ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111]'
                : 'text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Specimen Click Area */}
      <button
        type="button"
        onClick={() => onSelectFont(font.id)}
        aria-label={`Inspect ${font.name}`}
        className="flex-1 px-4 py-3 text-left flex flex-col justify-between gap-3 cursor-pointer"
        style={{ backgroundColor: preview.backgroundColor || undefined }}
      >
        <div
          className={`text-[52px] leading-none tracking-tight ${
            font.activated
              ? 'text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}
          style={{
            fontFamily: font.cssFamily,
            fontFeatureSettings: featureSettings,
            color: preview.foregroundColor || undefined,
          }}
        >
          Ag
        </div>
        <p
          className={`line-clamp-2 leading-snug ${
            font.activated
              ? 'text-neutral-700 dark:text-neutral-300'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}
          style={{
            fontFamily: font.cssFamily,
            fontSize: `${Math.min(Math.max(preview.fontSize * 0.55, 14), 24)}px`,
            fontFeatureSettings: featureSettings,
            textTransform: preview.textCase === 'none' ? undefined : preview.textCase,
            color: preview.foregroundColor || undefined,
          }}
        >
          {specimenText}
        </p>
      </button>

      {/* Clean Unboxed Metadata Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
        <span className="truncate">{font.foundry}</span>
        <span className="font-code tabular-nums whitespace-nowrap shrink-0">
          {font.styles.length} styles · {font.isVariable ? 'Variable' : font.format}
        </span>
      </div>
    </article>
  );
};

export const FontGrid: React.FC<FontGridProps> = ({
  fonts,
  selectedFontId,
  preview,
  compareIds,
  onSelectFont,
  onToggleActivate,
  onToggleStar,
  onToggleCompare,
}) => {
  const featureSettings = buildOpenTypeFeatureSettings(preview.openType);
  const specimenText = preview.text.trim() || 'Typography specimen';

  return (
    <div
      data-testid="font-grid"
      className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
    >
      {fonts.map((font) => (
        <FontGridCard
          key={font.id}
          font={font}
          selected={font.id === selectedFontId}
          inCompare={compareIds.includes(font.id)}
          preview={preview}
          featureSettings={featureSettings}
          specimenText={specimenText}
          onSelectFont={onSelectFont}
          onToggleActivate={onToggleActivate}
          onToggleStar={onToggleStar}
          onToggleCompare={onToggleCompare}
        />
      ))}
    </div>
  );
};
