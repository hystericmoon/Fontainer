import React, { useEffect, useRef, useState } from 'react';
import { Switch } from '@astryxdesign/core/Switch';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Columns2,
  Copy,
  FolderPlus,
  Star,
  Trash2,
} from 'lucide-react';
import type { FontFamily, FontList, PreviewSettings } from '../types/font';
import { buildOpenTypeFeatureSettings, generateFontCssSnippet } from '../utils/fontFilter';
import {
  ensureAdobeKitStylesheet,
  ensureCustomFontLoaded,
  ensureFontshareFontLoaded,
  ensureGoogleFontLoaded,
} from '../utils/fontLoader';

interface FontRowProps {
  font: FontFamily;
  libraryName: string;
  preview: PreviewSettings;
  selected: boolean;
  checked: boolean;
  expanded: boolean;
  inCompare: boolean;
  fontLists: FontList[];
  onSelect: () => void;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
  onToggleActivate: () => void;
  onToggleStyleActivate: (styleId: string) => void;
  onToggleStar: () => void;
  onToggleCompare: () => void;
  onAddToList: (listId: string) => void;
  onRemoveFont?: () => void;
  onCopyCss: (snippet: string) => void;
}

export const FontRow: React.FC<FontRowProps> = ({
  font,
  libraryName,
  preview,
  selected,
  checked,
  expanded,
  inCompare,
  fontLists,
  onSelect,
  onToggleCheck,
  onToggleExpand,
  onToggleActivate,
  onToggleStyleActivate,
  onToggleStar,
  onToggleCompare,
  onAddToList,
  onRemoveFont,
  onCopyCss,
}) => {
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const rowRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const loadFace = () => {
      if (font.adobeKitId) {
        ensureAdobeKitStylesheet(font.adobeKitId);
      } else if (font.fontshareSlug) {
        ensureFontshareFontLoaded(font.fontshareSlug, font.styles);
      } else if (font.isCustomUpload) {
        void ensureCustomFontLoaded(font.id, font.name);
      } else if (font.libraryId === 'lib-google') {
        ensureGoogleFontLoaded(font.name, font.styles);
      }
    };

    const el = rowRef.current;
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

  const featureSettings = buildOpenTypeFeatureSettings(preview.openType);
  const specimenText = preview.text.trim() || font.name;
  const activeStylesCount = font.styles.filter((s) => s.activated).length;

  const variationSettings =
    font.isVariable && preview.variableAxes
      ? `"wght" ${preview.variableAxes.wght}, "wdth" ${preview.variableAxes.wdth}, "slnt" ${preview.variableAxes.slnt}, "opsz" ${preview.variableAxes.opsz}`
      : undefined;

  const specimenStyle: React.CSSProperties = {
    fontFamily: font.cssFamily,
    fontSize: `${preview.fontSize}px`,
    lineHeight: preview.lineHeight,
    letterSpacing: `${preview.letterSpacing}em`,
    textTransform: preview.textCase === 'none' ? undefined : preview.textCase,
    textAlign: preview.textAlign,
    fontFeatureSettings: featureSettings,
    fontVariationSettings: variationSettings,
    color: preview.foregroundColor || undefined,
  };

  return (
    <article
      ref={rowRef}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/fontainer-font-id', font.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      data-testid={`font-row-${font.id}`}
      className={`group border-b border-[var(--color-border)] transition-colors ${
        selected
          ? 'bg-black/[0.04] dark:bg-white/[0.06]'
          : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
      }`}
      style={{
        backgroundColor: preview.backgroundColor || undefined,
      }}
    >
      {/* Row Header Bar */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Batch Checkbox */}
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleCheck}
            aria-label={`Select ${font.name}`}
            className={`w-3.5 h-3.5 shrink-0 rounded accent-[#1b1b1b] dark:accent-[#f1f1f1] cursor-pointer transition-opacity ${
              checked ? 'opacity-100' : 'opacity-30 group-hover:opacity-100 focus:opacity-100'
            }`}
          />

          {/* Activation Switch (Astryx Switch) */}
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center">
            <Switch
              size="sm"
              isLabelHidden
              label={font.activated ? `Deactivate ${font.name}` : `Activate ${font.name}`}
              value={font.activated}
              onChange={() => onToggleActivate()}
            />
          </div>

          {/* Expand Styles Button */}
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${font.name} styles` : `Expand ${font.name} styles`}
            className="flex items-center gap-1 text-left shrink-0 max-w-[200px] cursor-pointer group/name"
          >
            <span className="shrink-0 text-neutral-400 group-hover/name:text-neutral-700 dark:group-hover/name:text-neutral-200">
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
              {font.name}
            </span>
          </button>

          {/* Clean Unboxed Metadata */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 min-w-0 flex-1 overflow-hidden whitespace-nowrap">
            <span className="font-code tabular-nums shrink-0">
              {activeStylesCount}/{font.styles.length} styles
            </span>
            <span aria-hidden="true" className="hidden xl:inline shrink-0">·</span>
            <span className="hidden xl:inline shrink-0">{font.classification}</span>
            <span aria-hidden="true" className="hidden xl:inline shrink-0">·</span>
            <span className="hidden xl:inline shrink-0">{font.isVariable ? 'Variable' : font.format}</span>
            <span aria-hidden="true" className="hidden 2xl:inline shrink-0">·</span>
            <span className="hidden 2xl:inline truncate">{libraryName}</span>
          </div>
        </div>

        {/* Right Quick Actions */}
        <div className="flex items-center gap-1 shrink-0 relative">
          <button
            type="button"
            onClick={onToggleStar}
            aria-label={font.starred ? `Unstar ${font.name}` : `Star ${font.name}`}
            aria-pressed={font.starred}
            title={font.starred ? 'Remove from Starred' : 'Add to Starred'}
            className={`h-6 w-6 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
              font.starred
                ? 'text-amber-500'
                : 'text-neutral-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${font.starred ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onToggleCompare}
            aria-label={inCompare ? `Remove ${font.name} from Compare` : `Compare ${font.name}`}
            aria-pressed={inCompare}
            title={inCompare ? 'Pinned in Compare' : 'Pin to Compare View'}
            className={`h-6 w-6 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
              inCompare
                ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111]'
                : 'text-neutral-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>

          {/* Add to List Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setListMenuOpen((o) => !o)}
              aria-label={`Add ${font.name} to Font List`}
              aria-expanded={listMenuOpen}
              title="Add to Font List"
              className="h-6 w-6 flex items-center justify-center rounded-md text-neutral-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            {listMenuOpen && (
              <div
                role="menu"
                aria-label={`Add ${font.name} to list`}
                className="absolute right-0 top-7 z-30 w-48 py-1 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] shadow-lg text-[12px]"
              >
                <div className="px-3 py-1 text-[11px] font-medium text-neutral-400">
                  Add to Font List
                </div>
                {fontLists.length === 0 ? (
                  <div className="px-3 py-1.5 text-neutral-400">No lists yet</div>
                ) : (
                  fontLists.map((list) => {
                    const alreadyIn = list.fontIds.includes(font.id);
                    return (
                      <button
                        key={list.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onAddToList(list.id);
                          setListMenuOpen(false);
                        }}
                        className="w-full px-3 py-1.5 flex items-center justify-between text-left text-neutral-700 dark:text-neutral-200 hover:bg-[#1b1b1b] hover:text-white dark:hover:bg-[#f1f1f1] dark:hover:text-[#111111] transition-colors cursor-pointer"
                      >
                        <span className="truncate">{list.name}</span>
                        {alreadyIn && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onCopyCss(generateFontCssSnippet(font))}
            aria-label={`Copy CSS for ${font.name}`}
            title="Copy CSS @import"
            className="h-6 w-6 flex items-center justify-center rounded-md text-neutral-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {font.isCustomUpload && onRemoveFont && (
            <button
              type="button"
              onClick={onRemoveFont}
              aria-label={`Remove ${font.name}`}
              title="Remove uploaded font"
              className="h-6 w-6 flex items-center justify-center rounded-md text-neutral-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Live Specimen Preview Button */}
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Inspect ${font.name}`}
        className="w-full px-4 pt-1 pb-4 text-left block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1b1b1b] dark:focus-visible:ring-[#f1f1f1]"
      >
        <div
          className={`w-full overflow-hidden text-ellipsis whitespace-nowrap transition-opacity ${
            font.activated
              ? 'text-neutral-950 dark:text-neutral-50'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
          style={specimenStyle}
        >
          {specimenText}
        </div>
      </button>

      {/* Expandable Family Styles Drawer */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 ml-7 border-t border-[var(--color-border)] space-y-2">
          {font.styles.map((style) => (
            <div
              key={style.id}
              className="flex items-center gap-3 py-1.5 border-b border-black/[0.05] dark:border-white/[0.06] last:border-b-0"
            >
              <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center">
                <Switch
                  size="sm"
                  isLabelHidden
                  label={`${style.activated ? 'Deactivate' : 'Activate'} ${font.name} ${style.name}`}
                  value={style.activated}
                  onChange={() => onToggleStyleActivate(style.id)}
                />
              </div>

              <div className="w-36 shrink-0">
                <div className="text-[12px] font-medium text-neutral-800 dark:text-neutral-200">
                  {style.name}
                </div>
                <div className="text-[10px] font-code tabular-nums text-neutral-400">
                  {style.weight}
                  {style.fileSizeKb > 0 ? ` · ${style.fileSizeKb} KB` : ''}
                </div>
              </div>

              <div
                className={`flex-1 truncate ${
                  style.activated
                    ? 'text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-400 dark:text-neutral-500'
                }`}
                style={{
                  fontFamily: font.cssFamily,
                  fontWeight: style.weight,
                  fontStyle: style.italic ? 'italic' : 'normal',
                  fontSize: `${Math.min(Math.max(preview.fontSize * 0.72, 16), 44)}px`,
                  fontFeatureSettings: featureSettings,
                  textTransform: preview.textCase === 'none' ? undefined : preview.textCase,
                }}
              >
                {specimenText}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
};
