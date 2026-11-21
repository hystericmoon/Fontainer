import React, { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  Filter,
  LayoutGrid,
  List,
  Menu,
  Moon,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  Settings,
  Sliders,
  Sun,
  Type,
  X,
} from 'lucide-react';
import { PREVIEW_PRESETS } from '../data/catalog';
import type {
  FilterState,
  PreviewSettings,
  SortOption,
  TextAlignMode,
  TextCaseMode,
  ThemeMode,
  ViewMode,
} from '../types/font';

interface ToolbarProps {
  title: string;
  resultCount: number;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  filterBarOpen: boolean;
  activeFilterCount: number;
  onToggleFilterBar: () => void;
  filters: FilterState;
  onUpdateFilters: (patch: Partial<FilterState>) => void;
  preview: PreviewSettings;
  onUpdatePreview: (patch: Partial<PreviewSettings>) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenImport: () => void;
  onOpenQuickSwitcher: () => void;
  onOpenPreferences: () => void;
  showInstallButton?: boolean;
  onOpenInstall?: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  title,
  resultCount,
  sidebarOpen,
  onToggleSidebar,
  inspectorOpen,
  onToggleInspector,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  viewMode,
  onChangeViewMode,
  filterBarOpen,
  activeFilterCount,
  onToggleFilterBar,
  filters,
  onUpdateFilters,
  preview,
  onUpdatePreview,
  theme,
  onToggleTheme,
  onOpenImport,
  onOpenQuickSwitcher,
  onOpenPreferences,
  showInstallButton = false,
  onOpenInstall,
  searchInputRef,
}) => {
  const [presetsOpen, setPresetsOpen] = useState(false);

  const iconBtn = (active = false) =>
    `h-7 w-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0 ${
      active
        ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111]'
        : 'text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-neutral-100'
    }`;

  const viewModes: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
    { id: 'list', label: 'List View', icon: <List className="w-3.5 h-3.5" /> },
    { id: 'grid', label: 'Grid View', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { id: 'waterfall', label: 'Waterfall View', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'compare', label: 'Compare View', icon: <Columns2 className="w-3.5 h-3.5" /> },
  ];

  const caseModes: Array<{ id: TextCaseMode; label: string; title: string }> = [
    { id: 'none', label: 'Aa', title: 'Normal Case' },
    { id: 'uppercase', label: 'AA', title: 'Uppercase' },
    { id: 'lowercase', label: 'aa', title: 'Lowercase' },
  ];

  const alignModes: Array<{ id: TextAlignMode; label: string; icon: React.ReactNode }> = [
    { id: 'left', label: 'Align Left', icon: <AlignLeft className="w-3.5 h-3.5" /> },
    { id: 'center', label: 'Align Center', icon: <AlignCenter className="w-3.5 h-3.5" /> },
    { id: 'right', label: 'Align Right', icon: <AlignRight className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="shrink-0 bg-[#FFFFFF] dark:bg-[#262626] border-b border-[var(--color-border)] select-none">
      {/* Row 1: Unified Astryx + macOS Window Toolbar */}
      <div className="h-12 px-3 flex items-center justify-between gap-2.5 xl:gap-4 border-b border-[var(--color-border)]">
        {/* Left Navigation & Current Title */}
        <div className="flex items-center gap-1.5 xl:gap-2 min-w-0 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            className={iconBtn(sidebarOpen)}
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={onGoBack}
              disabled={!canGoBack}
              aria-label="Navigate Back"
              title="Back"
              className={`${iconBtn(false)} disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onGoForward}
              disabled={!canGoForward}
              aria-label="Navigate Forward"
              title="Forward"
              className={`${iconBtn(false)} disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-baseline gap-2 min-w-0 pl-0.5">
            <h1 className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate max-w-[130px] xl:max-w-[200px]">
              {title}
            </h1>
            <span className="hidden xl:inline text-[12px] font-code tabular-nums text-[var(--color-text-secondary)] whitespace-nowrap shrink-0">
              {resultCount} {resultCount === 1 ? 'family' : 'families'}
            </span>
          </div>
        </div>

        {/* Center Search Input */}
        <div className="relative flex-1 max-w-[290px] min-w-[115px]">
          <Search
            aria-hidden="true"
            className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={filters.search}
            onChange={(e) => onUpdateFilters({ search: e.target.value })}
            placeholder="Search fonts, foundries, tags…"
            aria-label="Search fonts"
            className="w-full h-7 pl-8 pr-7 rounded-lg bg-[#F1F1F1] dark:bg-[#1B1B1B] border border-transparent focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1] focus:bg-white dark:focus:bg-[#141414] text-[12px] text-[var(--color-text-primary)] placeholder:text-neutral-400 outline-none transition-colors"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onUpdateFilters({ search: '' })}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right Controls: Astryx SegmentedControl + Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <SegmentedControl
            label="Font View Mode"
            size="sm"
            value={viewMode}
            onChange={(val) => onChangeViewMode(val as ViewMode)}
          >
            {viewModes.map((m) => (
              <SegmentedControlItem
                key={m.id}
                value={m.id}
                label={m.label}
                icon={m.icon}
                isLabelHidden
              />
            ))}
          </SegmentedControl>

          <button
            type="button"
            onClick={onToggleFilterBar}
            aria-label="Toggle Filter Bar"
            aria-expanded={filterBarOpen}
            title="Filter Fonts"
            className={`h-7 px-2 flex items-center gap-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              filterBarOpen || activeFilterCount > 0
                ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111]'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="font-code tabular-nums text-[11px]">({activeFilterCount})</span>
            )}
          </button>

          <Button
            variant="primary"
            size="sm"
            label="Import Local Fonts"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenImport}
          >
            Import
          </Button>

          <div className="w-px h-4 bg-[var(--color-border)] mx-0.5" aria-hidden="true" />

          {showInstallButton && onOpenInstall && (
            <button
              type="button"
              onClick={onOpenInstall}
              aria-label="Install on Mac"
              title="Install Fontainer on macOS"
              className={iconBtn(false)}
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenQuickSwitcher}
            aria-label="Open Menu Bar Quick Switcher"
            title="Menu Bar Quick Switcher"
            className={iconBtn(false)}
          >
            <Menu className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className={iconBtn(false)}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenPreferences}
            aria-label="Preferences"
            title="Preferences (⌘,)"
            className={iconBtn(false)}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleInspector}
            aria-label={inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
            title={inspectorOpen ? 'Hide Inspector (⌘I)' : 'Show Inspector (⌘I)'}
            className={iconBtn(inspectorOpen)}
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 2: Live Preview Specimen Controls */}
      <div className="h-10 px-3 flex items-center justify-between gap-3 bg-[#F7F7F7] dark:bg-[#1E1E1E]">
        {/* Live Preview Text Input + Presets */}
        <div className="relative flex items-center flex-1 min-w-[200px] max-w-[540px] gap-1.5">
          <Type aria-hidden="true" className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <input
            type="text"
            value={preview.text}
            onChange={(e) => onUpdatePreview({ text: e.target.value })}
            placeholder="Type something to preview…"
            aria-label="Live preview text"
            className="w-full h-7 px-2.5 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1] text-[12px] text-[var(--color-text-primary)] placeholder:text-neutral-400 outline-none transition-colors"
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setPresetsOpen((o) => !o)}
              aria-label="Preview Text Presets"
              aria-expanded={presetsOpen}
              title="Sample Text Presets"
              className="h-7 px-2.5 flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white dark:bg-[#262626] text-[11px] font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white cursor-pointer whitespace-nowrap"
            >
              <span>Presets</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {presetsOpen && (
              <div
                role="menu"
                aria-label="Specimen Presets"
                className="absolute left-0 top-8 z-30 w-72 py-1 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] shadow-lg"
              >
                {PREVIEW_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onUpdatePreview({ text: preset.text });
                      setPresetsOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-[#1b1b1b] hover:text-white dark:hover:bg-[#f1f1f1] dark:hover:text-[#111111] group transition-colors cursor-pointer"
                  >
                    <div className="text-[12px] font-medium text-neutral-800 dark:text-neutral-100 group-hover:text-white dark:group-hover:text-[#111111]">
                      {preset.label}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 group-hover:text-white/80 dark:group-hover:text-neutral-800/80 truncate">
                      {preset.text}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Font Size Slider + Case + Alignment + Sort */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Font Size Slider */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="preview-font-size"
              className="text-[11px] font-code tabular-nums text-neutral-500 dark:text-neutral-400 w-9 text-right shrink-0"
            >
              {preview.fontSize}px
            </label>
            <input
              id="preview-font-size"
              type="range"
              min={14}
              max={96}
              value={preview.fontSize}
              onChange={(e) => onUpdatePreview({ fontSize: Number(e.target.value) })}
              aria-label="Preview font size"
              className="mac-slider w-24"
            />
          </div>

          <div className="w-px h-4 bg-[var(--color-border)]" aria-hidden="true" />

          {/* Text Case Segmented */}
          <div className="flex items-center gap-0.5" role="group" aria-label="Text Case">
            {caseModes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onUpdatePreview({ textCase: c.id })}
                title={c.title}
                aria-label={c.title}
                aria-pressed={preview.textCase === c.id}
                className={`h-6 px-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  preview.textCase === c.id
                    ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111]'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Alignment Segmented */}
          <div className="hidden lg:flex items-center gap-0.5" role="group" aria-label="Text Alignment">
            {alignModes.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onUpdatePreview({ textAlign: a.id })}
                title={a.label}
                aria-label={a.label}
                aria-pressed={preview.textAlign === a.id}
                className={`h-6 w-6 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                  preview.textAlign === a.id
                    ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111]'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                {a.icon}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-[var(--color-border)]" aria-hidden="true" />

          {/* Sort Select */}
          <label className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="sr-only">Sort fonts by</span>
            <select
              aria-label="Sort fonts"
              value={filters.sort}
              onChange={(e) => onUpdateFilters({ sort: e.target.value as SortOption })}
              className="h-6 px-1.5 rounded-md bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[12px] text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer"
            >
              <option value="name-asc">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="styles-desc">Most Styles</option>
              <option value="recent">Recently Added</option>
            </select>
          </label>
        </div>
      </div>
    </header>
  );
};
