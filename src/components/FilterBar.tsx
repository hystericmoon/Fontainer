import React from 'react';
import { RotateCcw } from 'lucide-react';
import type {
  FilterState,
  FontClassification,
  FontFormat,
  FontWidth,
} from '../types/font';
import { DEFAULT_FILTER_STATE } from '../utils/fontFilter';

interface FilterBarProps {
  filters: FilterState;
  onUpdate: (patch: Partial<FilterState>) => void;
  activeCount: number;
}

const CLASSIFICATIONS: Array<FontClassification | 'All'> = [
  'All',
  'Sans Serif',
  'Serif',
  'Slab Serif',
  'Display',
  'Monospace',
  'Script',
  'Handwritten',
];

const FORMATS: Array<FontFormat | 'All'> = ['All', 'Variable', 'OTF', 'TTF', 'WOFF2'];
const WIDTHS: Array<FontWidth | 'All'> = ['All', 'Condensed', 'Normal', 'Expanded'];
const WEIGHTS: Array<FilterState['weightFilter']> = ['All', 'Light', 'Regular', 'Bold'];
const LANGUAGES = ['All', 'Latin', 'Latin Extended', 'Cyrillic', 'Greek', 'Vietnamese'];
const STATUSES: Array<FilterState['status']> = ['All', 'Activated', 'Deactivated'];

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onUpdate, activeCount }) => {
  const selectClass =
    'h-7 px-2 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1] cursor-pointer';

  return (
    <div
      aria-label="Font Filters"
      className="shrink-0 px-4 py-2.5 bg-[#F1F1F1] dark:bg-[#1B1B1B] border-b border-[var(--color-border)] space-y-2"
    >
      {/* Classification Quick Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Classification Filter">
          {CLASSIFICATIONS.map((cls) => {
            const active = filters.classification === cls;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => onUpdate({ classification: cls })}
                aria-pressed={active}
                className={`h-6 px-2.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111]'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                {cls}
              </button>
            );
          })}
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() =>
              onUpdate({
                classification: DEFAULT_FILTER_STATE.classification,
                format: DEFAULT_FILTER_STATE.format,
                width: DEFAULT_FILTER_STATE.width,
                language: DEFAULT_FILTER_STATE.language,
                status: DEFAULT_FILTER_STATE.status,
                weightFilter: DEFAULT_FILTER_STATE.weightFilter,
              })
            }
            className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-text-primary)] hover:underline cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Facet Dropdowns */}
      <div className="flex items-center gap-2.5 flex-wrap text-[12px]">
        <label className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
          <span>Format</span>
          <select
            aria-label="Filter by format"
            value={filters.format}
            onChange={(e) => onUpdate({ format: e.target.value as FontFormat | 'All' })}
            className={selectClass}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
          <span>Weight</span>
          <select
            aria-label="Filter by weight"
            value={filters.weightFilter}
            onChange={(e) =>
              onUpdate({ weightFilter: e.target.value as FilterState['weightFilter'] })
            }
            className={selectClass}
          >
            {WEIGHTS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
          <span>Width</span>
          <select
            aria-label="Filter by width"
            value={filters.width}
            onChange={(e) => onUpdate({ width: e.target.value as FontWidth | 'All' })}
            className={selectClass}
          >
            {WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
          <span>Language</span>
          <select
            aria-label="Filter by language"
            value={filters.language}
            onChange={(e) => onUpdate({ language: e.target.value })}
            className={selectClass}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
          <span>Status</span>
          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => onUpdate({ status: e.target.value as FilterState['status'] })}
            className={selectClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
};
