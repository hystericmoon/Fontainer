import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '@astryxdesign/core';
import { Button } from '@astryxdesign/core/Button';
import { CheckCircle2, FolderPlus, MinusCircle, RotateCcw, Upload, WifiOff, X } from 'lucide-react';
import { defaultThemeSlug, themes } from './astryx-themes';
import { CompareView } from './components/CompareView';
import { FilterBar } from './components/FilterBar';
import { FontGrid } from './components/FontGrid';
import { FontRow } from './components/FontRow';
import { InspectorPanel } from './components/InspectorPanel';
import { InstallMacModal } from './components/InstallMacModal';
import {
  AddLibraryModal,
  DuplicateFinderModal,
  ImportFontsModal,
  NewFontListModal,
  NewSmartListModal,
  PreferencesModal,
  QuickSwitcherModal,
} from './components/Modals';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { WaterfallView } from './components/WaterfallView';
import { useFontainerStore } from './hooks/useFontainerStore';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import { countActiveFilterFacets, DEFAULT_FILTER_STATE } from './utils/fontFilter';

type ActiveModal =
  | null
  | 'new-list'
  | 'new-smart'
  | 'new-library'
  | 'import'
  | 'preferences'
  | 'duplicates'
  | 'quick-switcher'
  | 'install-mac';

export default function App() {
  const store = useFontainerStore();
  const pwa = usePWAInstall();
  const isOnline = useOnlineStatus();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [filterBarOpen, setFilterBarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [batchListMenuOpen, setBatchListMenuOpen] = useState(false);
  const [fileDropOverlay, setFileDropOverlay] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // macOS keyboard shortcuts: ⌘F Search, ⌘, Preferences, ⌘I Inspector, Esc close modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setActiveModal('preferences');
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setInspectorOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const libraryMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const lib of store.libraries) map[lib.id] = lib.name;
    return map;
  }, [store.libraries]);

  const currentTitle = useMemo(() => {
    const dest = store.destination;
    switch (dest.type) {
      case 'all':
        return 'All Fonts';
      case 'activated':
        return 'Activated';
      case 'deactivated':
        return 'Deactivated';
      case 'starred':
        return 'Starred';
      case 'recent':
        return 'Recently Added';
      case 'library':
        return libraryMap[dest.id] ?? 'Font Library';
      case 'list':
        return store.fontLists.find((l) => l.id === dest.id)?.name ?? 'Font List';
      case 'smart':
        return store.smartLists.find((s) => s.id === dest.id)?.name ?? 'Smart List';
    }
  }, [store.destination, libraryMap, store.fontLists, store.smartLists]);

  const activeFilterCount = useMemo(() => countActiveFilterFacets(store.filters), [store.filters]);

  const canvasBgClass =
    store.theme === 'sepia'
      ? 'bg-[#F8F5EE] text-[#1C1917]'
      : 'bg-[#FFFFFF] dark:bg-[#1B1B1B] text-[var(--color-text-primary)]';

  const handleCopyCss = async (snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      store.showToast('Copied CSS @import snippet');
    } catch {
      store.showToast('CSS snippet ready');
    }
  };

  return (
    <Theme theme={themes[defaultThemeSlug]} mode={store.theme === 'dark' ? 'dark' : 'light'}>
      <div
        className="h-screen w-screen overflow-hidden flex bg-[#FFFFFF] dark:bg-[#1B1B1B] text-[var(--color-text-primary)] relative"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setFileDropOverlay(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setFileDropOverlay(false);
        }}
        onDrop={(e) => {
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            setFileDropOverlay(false);
            void store.importFiles(e.dataTransfer.files);
          }
        }}
      >
        {/* Left Sidebar */}
        {sidebarOpen && (
          <Sidebar
            destination={store.destination}
            onSelect={store.navigateTo}
            libraries={store.libraries}
            fontLists={store.fontLists}
            smartLists={store.smartLists}
            counts={store.counts}
            duplicateCount={store.duplicateGroups.length}
            onOpenNewList={() => setActiveModal('new-list')}
            onOpenNewSmartList={() => setActiveModal('new-smart')}
            onOpenNewLibrary={() => setActiveModal('new-library')}
            onOpenDuplicates={() => setActiveModal('duplicates')}
            onOpenCompare={() => store.setViewMode('compare')}
            compareCount={store.compareIds.length}
            onDeleteList={store.deleteFontList}
            onActivateAllInList={store.activateAllInList}
            onDeleteSmartList={store.deleteSmartList}
            onSyncLibrary={store.syncLibrary}
            onDropFontOnList={(listId, fontId) => store.addFontsToList(listId, [fontId])}
            showInstallAction={!pwa.isInstalled}
            onOpenInstall={() => setActiveModal('install-mac')}
          />
        )}

        {/* Center Workspace Column */}
        <div className="flex-1 min-w-0 h-full flex flex-col">
          {/* Offline Banner (only shown when network disconnects) */}
          {!isOnline && (
            <div
              role="status"
              className="shrink-0 px-4 py-1.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[12px] flex items-center gap-2"
            >
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>Offline mode — local font library and cached specimens remain available.</span>
            </div>
          )}

          <Toolbar
            title={currentTitle}
            resultCount={store.filteredFonts.length}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            inspectorOpen={inspectorOpen}
            onToggleInspector={() => setInspectorOpen((v) => !v)}
            canGoBack={store.canGoBack}
            canGoForward={store.canGoForward}
            onGoBack={store.goBack}
            onGoForward={store.goForward}
            viewMode={store.viewMode}
            onChangeViewMode={store.setViewMode}
            filterBarOpen={filterBarOpen}
            activeFilterCount={activeFilterCount}
            onToggleFilterBar={() => setFilterBarOpen((v) => !v)}
            filters={store.filters}
            onUpdateFilters={(patch) => store.setFilters((prev) => ({ ...prev, ...patch }))}
            preview={store.preview}
            onUpdatePreview={(patch) => store.setPreview((prev) => ({ ...prev, ...patch }))}
            theme={store.theme}
            onToggleTheme={() => store.setTheme(store.theme === 'dark' ? 'light' : 'dark')}
            onOpenImport={() => setActiveModal('import')}
            onOpenQuickSwitcher={() => setActiveModal('quick-switcher')}
            onOpenPreferences={() => setActiveModal('preferences')}
            showInstallButton={!pwa.isInstalled}
            onOpenInstall={() => setActiveModal('install-mac')}
            searchInputRef={searchInputRef}
          />

          {/* Collapsible Multi-Facet Filter Bar */}
          {filterBarOpen && (
            <FilterBar
              filters={store.filters}
              onUpdate={(patch) => store.setFilters((prev) => ({ ...prev, ...patch }))}
              activeCount={activeFilterCount}
            />
          )}

          {/* Batch Action Bar (appears when 1+ fonts are checked) */}
          {store.checkedFontIds.length > 0 && (
            <div
              aria-label="Batch Actions"
              className="shrink-0 px-4 py-2 bg-[#F1F1F1] dark:bg-[#262626] border-b border-[var(--color-border)] flex items-center justify-between gap-3 text-[12px]"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-medium text-[var(--color-text-primary)] font-code tabular-nums">
                  {store.checkedFontIds.length} selected
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  label="Activate"
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={() => store.setBatchActivation(store.checkedFontIds, true)}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Deactivate"
                  icon={<MinusCircle className="w-3.5 h-3.5" />}
                  onClick={() => store.setBatchActivation(store.checkedFontIds, false)}
                />

                <div className="relative">
                  <Button
                    variant="secondary"
                    size="sm"
                    label="Add to List"
                    icon={<FolderPlus className="w-3.5 h-3.5" />}
                    onClick={() => setBatchListMenuOpen((o) => !o)}
                  />
                  {batchListMenuOpen && (
                    <div className="absolute left-0 top-9 z-30 w-44 py-1 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] shadow-lg">
                      {store.fontLists.map((list) => (
                        <button
                          key={list.id}
                          type="button"
                          onClick={() => {
                            store.addFontsToList(list.id, store.checkedFontIds);
                            setBatchListMenuOpen(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-[#1b1b1b] hover:text-white dark:hover:bg-[#f1f1f1] dark:hover:text-[#111111] cursor-pointer"
                        >
                          {list.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => store.setCheckedFontIds([])}
                aria-label="Clear selection"
                className="text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          )}

          {/* Main Viewport + Inspector Split */}
          <div className="flex-1 min-h-0 flex">
            <main
              aria-label="Font Specimens"
              className={`flex-1 min-w-0 h-full overflow-y-auto ${canvasBgClass}`}
            >
              {store.viewMode === 'compare' ? (
                <CompareView
                  allFonts={store.fonts}
                  compareIds={store.compareIds}
                  preview={store.preview}
                  onToggleCompare={store.toggleCompareFont}
                  onSelectFont={store.setSelectedFontId}
                />
              ) : store.filteredFonts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                  <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                    No matching fonts found
                  </p>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
                    {store.filters.search || activeFilterCount > 0
                      ? 'Try clearing your search query or resetting active facet filters.'
                      : 'This collection is currently empty. Drag fonts here or import local font files.'}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    {(store.filters.search || activeFilterCount > 0) && (
                      <Button
                        variant="primary"
                        size="sm"
                        label="Clear Filters"
                        icon={<RotateCcw className="w-3.5 h-3.5" />}
                        onClick={() => store.setFilters(DEFAULT_FILTER_STATE)}
                      />
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      label="Import Font Files"
                      icon={<Upload className="w-3.5 h-3.5" />}
                      onClick={() => setActiveModal('import')}
                    />
                  </div>
                </div>
              ) : store.viewMode === 'waterfall' ? (
                <WaterfallView
                  fonts={store.filteredFonts}
                  selectedFont={store.selectedFont}
                  preview={store.preview}
                  onSelectFont={store.setSelectedFontId}
                  onToggleActivate={store.toggleFontActivation}
                />
              ) : store.viewMode === 'grid' ? (
                <FontGrid
                  fonts={store.filteredFonts}
                  selectedFontId={store.selectedFont?.id ?? ''}
                  preview={store.preview}
                  compareIds={store.compareIds}
                  onSelectFont={store.setSelectedFontId}
                  onToggleActivate={store.toggleFontActivation}
                  onToggleStar={store.toggleStar}
                  onToggleCompare={store.toggleCompareFont}
                />
              ) : (
                <div data-testid="font-list">
                  {store.filteredFonts.map((font) => (
                    <FontRow
                      key={font.id}
                      font={font}
                      libraryName={libraryMap[font.libraryId] ?? 'Library'}
                      preview={store.preview}
                      selected={store.selectedFont?.id === font.id}
                      checked={store.checkedFontIds.includes(font.id)}
                      expanded={Boolean(store.expandedFamilyIds[font.id])}
                      inCompare={store.compareIds.includes(font.id)}
                      fontLists={store.fontLists}
                      onSelect={() => store.setSelectedFontId(font.id)}
                      onToggleCheck={() => store.toggleCheckedFont(font.id)}
                      onToggleExpand={() => store.toggleExpandFamily(font.id)}
                      onToggleActivate={() => store.toggleFontActivation(font.id)}
                      onToggleStyleActivate={(styleId) => store.toggleStyleActivation(font.id, styleId)}
                      onToggleStar={() => store.toggleStar(font.id)}
                      onToggleCompare={() => store.toggleCompareFont(font.id)}
                      onAddToList={(listId) => store.addFontsToList(listId, [font.id])}
                      onRemoveFont={font.isCustomUpload ? () => store.removeFont(font.id) : undefined}
                      onCopyCss={(snippet) => void handleCopyCss(snippet)}
                    />
                  ))}
                </div>
              )}
            </main>

            {/* Right Inspector Panel */}
            {inspectorOpen && (
              <InspectorPanel
                font={store.selectedFont}
                libraryName={
                  store.selectedFont ? libraryMap[store.selectedFont.libraryId] ?? 'Library' : ''
                }
                preview={store.preview}
                appIntegrations={store.appIntegrations}
                onUpdatePreview={(patch) => store.setPreview((prev) => ({ ...prev, ...patch }))}
                onUpdateOpenType={(patch) =>
                  store.setPreview((prev) => ({
                    ...prev,
                    openType: { ...prev.openType, ...patch },
                  }))
                }
                onToggleActivate={store.toggleFontActivation}
                onAddTag={store.addTagToFont}
                onRemoveTag={store.removeTagFromFont}
                onUpdateNotes={store.updateFontNotes}
                onToggleAppAutoActivate={store.toggleAppAutoActivate}
                onApplyToApp={store.applyFontToApp}
                onNotify={store.showToast}
              />
            )}
          </div>
        </div>

        {/* Global File Drop Overlay */}
        {fileDropOverlay && (
          <div className="fixed inset-0 z-50 bg-black/15 dark:bg-white/10 backdrop-blur-[2px] border-4 border-dashed border-[#1b1b1b] dark:border-[#f1f1f1] flex items-center justify-center pointer-events-none">
            <div className="px-6 py-4 rounded-xl bg-white dark:bg-[#262626] border border-[var(--color-border)] shadow-2xl text-center">
              <Upload className="w-8 h-8 text-[var(--color-text-primary)] mx-auto mb-2" />
              <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                Drop font files to install into Fontainer
              </p>
              <p className="text-[12px] text-neutral-500 mt-0.5">.ttf · .otf · .woff · .woff2</p>
            </div>
          </div>
        )}

        {/* Modals */}
        {activeModal === 'new-list' && (
          <NewFontListModal
            onClose={() => setActiveModal(null)}
            onCreate={store.createFontList}
          />
        )}

        {activeModal === 'new-smart' && (
          <NewSmartListModal
            fonts={store.fonts}
            onClose={() => setActiveModal(null)}
            onCreate={store.createSmartList}
          />
        )}

        {activeModal === 'new-library' && (
          <AddLibraryModal
            onClose={() => setActiveModal(null)}
            onAdd={store.addLibrary}
          />
        )}

        {activeModal === 'import' && (
          <ImportFontsModal
            libraries={store.libraries}
            onClose={() => setActiveModal(null)}
            onImport={store.importFiles}
          />
        )}

        {activeModal === 'preferences' && (
          <PreferencesModal
            theme={store.theme}
            onSetTheme={store.setTheme}
            appIntegrations={store.appIntegrations}
            onToggleApp={store.toggleAppAutoActivate}
            onResetLibrary={store.resetAllData}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'duplicates' && (
          <DuplicateFinderModal
            groups={store.duplicateGroups}
            libraries={store.libraries}
            onDeactivate={store.toggleFontActivation}
            onRemove={store.removeFont}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'quick-switcher' && (
          <QuickSwitcherModal
            fonts={store.fonts}
            onToggleActivate={store.toggleFontActivation}
            onSelectFont={(id) => {
              store.setSelectedFontId(id);
              store.navigateTo({ type: 'all' });
            }}
            onClose={() => setActiveModal(null)}
          />
        )}

        <InstallMacModal
          isOpen={activeModal === 'install-mac'}
          isInstallable={pwa.isInstallable}
          isInstalled={pwa.isInstalled}
          isSafari={pwa.isSafari}
          isIOS={pwa.isIOS}
          onInstallPwa={pwa.install}
          onClose={() => setActiveModal(null)}
          onNotify={store.showToast}
        />

        {/* Subtle macOS HUD Toast */}
        {store.toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[#1b1b1b] dark:bg-[#f1f1f1] text-white dark:text-[#111111] text-[12px] font-medium shadow-lg pointer-events-none"
          >
            {store.toastMessage}
          </div>
        )}
      </div>
    </Theme>
  );
}
