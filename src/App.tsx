import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '@astryxdesign/core';
import { Button } from '@astryxdesign/core/Button';
import {
  CheckCircle2,
  Cloud,
  FolderPlus,
  Loader2,
  MinusCircle,
  RefreshCw,
  RotateCcw,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { defaultThemeSlug, themes } from './astryx-themes';
import { CloudConnectionsModal } from './components/CloudConnectionsModal';
import { CompareView } from './components/CompareView';
import { FilterBar } from './components/FilterBar';
import { FontGrid } from './components/FontGrid';
import { FontRow } from './components/FontRow';
import { InspectorPanel } from './components/InspectorPanel';
import { InstallMacModal } from './components/InstallMacModal';
import {
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
import { countActiveFilterFacets } from './utils/fontFilter';

type ActiveModal =
  | null
  | 'new-list'
  | 'new-smart'
  | 'connections'
  | 'import'
  | 'preferences'
  | 'duplicates'
  | 'quick-switcher'
  | 'install-mac';

const INITIAL_BATCH_SIZE = 60;
const BATCH_STEP = 60;

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
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Record<string, boolean>>({});
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_BATCH_SIZE);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const dragDepthRef = useRef(0);
  const dragWatchdogRef = useRef<number | null>(null);
  const importLocalFontsRef = useRef(store.importLocalFonts);
  importLocalFontsRef.current = store.importLocalFonts;

  // Bulletproof global file drag-and-drop overlay (never sticks when leaving window/iframe)
  useEffect(() => {
    const clearOverlay = () => {
      dragDepthRef.current = 0;
      if (dragWatchdogRef.current !== null) {
        window.clearTimeout(dragWatchdogRef.current);
        dragWatchdogRef.current = null;
      }
      setFileDropOverlay(false);
    };

    const bumpWatchdog = () => {
      if (dragWatchdogRef.current !== null) {
        window.clearTimeout(dragWatchdogRef.current);
      }
      // dragover fires ~every 50ms while hovering; if cursor leaves iframe without firing dragleave, auto-dismiss
      dragWatchdogRef.current = window.setTimeout(clearOverlay, 350);
    };

    const hasFiles = (e: DragEvent) =>
      Boolean(e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files'));

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepthRef.current += 1;
      setFileDropOverlay(true);
      bumpWatchdog();
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setFileDropOverlay(true);
      bumpWatchdog();
    };

    const onDragLeave = (e: DragEvent) => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (
        dragDepthRef.current === 0 ||
        e.relatedTarget === null ||
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        clearOverlay();
      }
    };

    const onDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      clearOverlay();
      if (files && files.length > 0) {
        e.preventDefault();
        void importLocalFontsRef.current(files);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', clearOverlay);
    window.addEventListener('blur', clearOverlay);
    window.addEventListener('pointerdown', clearOverlay);
    document.addEventListener('visibilitychange', clearOverlay);

    return () => {
      clearOverlay();
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', clearOverlay);
      window.removeEventListener('blur', clearOverlay);
      window.removeEventListener('pointerdown', clearOverlay);
      document.removeEventListener('visibilitychange', clearOverlay);
    };
  }, []);

  // Reset pagination batch whenever destination, view mode, or filter changes
  useEffect(() => {
    setVisibleLimit(INITIAL_BATCH_SIZE);
  }, [store.destination, store.filters, store.viewMode]);

  // Progressive infinite scroll for 1,700+ live fonts
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    if (visibleLimit >= store.visibleFonts.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleLimit((prev) => Math.min(prev + BATCH_STEP, store.visibleFonts.length));
        }
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleLimit, store.visibleFonts.length]);

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
        setFileDropOverlay(false);
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

  const renderedFonts = useMemo(
    () => store.visibleFonts.slice(0, visibleLimit),
    [store.visibleFonts, visibleLimit],
  );
  const hasMoreFonts = visibleLimit < store.visibleFonts.length;

  const toggleExpandFamily = (fontId: string) => {
    setExpandedFamilyIds((prev) => ({ ...prev, [fontId]: !prev[fontId] }));
  };

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
      <div className="h-screen w-screen overflow-hidden flex bg-[#FFFFFF] dark:bg-[#1B1B1B] text-[var(--color-text-primary)] relative">
        {/* Left Sidebar */}
        {sidebarOpen && (
          <Sidebar
            destination={store.destination}
            onSelect={store.navigate}
            libraries={store.libraries}
            fontLists={store.fontLists}
            smartLists={store.smartLists}
            counts={store.sidebarCounts}
            duplicateCount={store.duplicateGroups.length}
            onOpenNewList={() => setActiveModal('new-list')}
            onOpenNewSmartList={() => setActiveModal('new-smart')}
            onOpenConnections={() => setActiveModal('connections')}
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
            user={store.user}
            cloudSynced={store.cloudSynced}
            onSignInGoogle={() => void store.signInWithGoogle()}
            onSignOut={() => void store.signOut()}
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
            resultCount={store.visibleFonts.length}
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
            onUpdateFilters={store.updateFilters}
            preview={store.preview}
            onUpdatePreview={store.updatePreview}
            theme={store.theme}
            onToggleTheme={() => store.setTheme(store.theme === 'dark' ? 'light' : 'dark')}
            onOpenImport={() => setActiveModal('import')}
            onOpenConnections={() => setActiveModal('connections')}
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
              onUpdate={store.updateFilters}
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
                  onClick={() => store.batchSetActivation(store.checkedFontIds, true)}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  label="Deactivate"
                  icon={<MinusCircle className="w-3.5 h-3.5" />}
                  onClick={() => store.batchSetActivation(store.checkedFontIds, false)}
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
                      {store.fontLists.length === 0 ? (
                        <div className="px-3 py-1.5 text-neutral-400">No lists yet</div>
                      ) : (
                        store.fontLists.map((list) => (
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
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={store.clearCheckedFonts}
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
                  onToggleCompare={store.toggleCompare}
                  onSelectFont={store.setSelectedFontId}
                />
              ) : store.googleLoading && store.fonts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mb-3" />
                  <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                    Loading live Google Fonts directory…
                  </p>
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Connecting to live font catalog — zero placeholder data.
                  </p>
                </div>
              ) : store.visibleFonts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                  <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                    {store.googleError && store.fonts.length === 0
                      ? 'Could not reach live Google Fonts catalog'
                      : 'No fonts in this view yet'}
                  </p>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-md">
                    {store.googleError && store.fonts.length === 0
                      ? store.googleError
                      : store.filters.search || activeFilterCount > 0
                        ? 'Try clearing your search query or resetting active facet filters.'
                        : 'Connect Adobe Fonts, Google Drive, iCloud Drive, or import local .ttf/.otf/.woff2 files.'}
                  </p>
                  <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
                    {store.googleError && store.fonts.length === 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        label="Retry Google Fonts"
                        icon={<RefreshCw className="w-3.5 h-3.5" />}
                        onClick={() => void store.refreshGoogleFonts(false)}
                      />
                    )}
                    {(store.filters.search || activeFilterCount > 0) && (
                      <Button
                        variant="primary"
                        size="sm"
                        label="Clear Filters"
                        icon={<RotateCcw className="w-3.5 h-3.5" />}
                        onClick={store.resetFilters}
                      />
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      label="Connect Drives & Adobe"
                      icon={<Cloud className="w-3.5 h-3.5" />}
                      onClick={() => setActiveModal('connections')}
                    />
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
                  fonts={renderedFonts}
                  selectedFont={store.selectedFont}
                  preview={store.preview}
                  onSelectFont={store.setSelectedFontId}
                  onToggleActivate={store.toggleFontActivation}
                />
              ) : store.viewMode === 'grid' ? (
                <>
                  <FontGrid
                    fonts={renderedFonts}
                    selectedFontId={store.selectedFont?.id ?? ''}
                    preview={store.preview}
                    compareIds={store.compareIds}
                    onSelectFont={store.setSelectedFontId}
                    onToggleActivate={store.toggleFontActivation}
                    onToggleStar={store.toggleStar}
                    onToggleCompare={store.toggleCompare}
                  />
                  {hasMoreFonts && (
                    <div
                      ref={loadMoreRef}
                      className="px-5 py-6 flex items-center justify-center gap-3 text-[12px] text-neutral-500"
                    >
                      <span className="font-code tabular-nums">
                        Showing {renderedFonts.length.toLocaleString()} of{' '}
                        {store.visibleFonts.length.toLocaleString()} families
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        label="Load More"
                        onClick={() =>
                          setVisibleLimit((prev) =>
                            Math.min(prev + BATCH_STEP, store.visibleFonts.length),
                          )
                        }
                      />
                    </div>
                  )}
                </>
              ) : (
                <div data-testid="font-list">
                  {renderedFonts.map((font) => (
                    <FontRow
                      key={font.id}
                      font={font}
                      libraryName={libraryMap[font.libraryId] ?? 'Library'}
                      preview={store.preview}
                      selected={store.selectedFont?.id === font.id}
                      checked={store.checkedFontIds.includes(font.id)}
                      expanded={Boolean(expandedFamilyIds[font.id])}
                      inCompare={store.compareIds.includes(font.id)}
                      fontLists={store.fontLists}
                      onSelect={() => store.setSelectedFontId(font.id)}
                      onToggleCheck={() => store.toggleCheckedFont(font.id)}
                      onToggleExpand={() => toggleExpandFamily(font.id)}
                      onToggleActivate={() => store.toggleFontActivation(font.id)}
                      onToggleStyleActivate={(styleId) => store.toggleStyleActivation(font.id, styleId)}
                      onToggleStar={() => store.toggleStar(font.id)}
                      onToggleCompare={() => store.toggleCompare(font.id)}
                      onAddToList={(listId) => store.addFontsToList(listId, [font.id])}
                      onRemoveFont={
                        font.isCustomUpload ? () => store.removeFontFamily(font.id) : undefined
                      }
                      onCopyCss={(snippet) => void handleCopyCss(snippet)}
                    />
                  ))}
                  {hasMoreFonts && (
                    <div
                      ref={loadMoreRef}
                      className="px-4 py-6 flex items-center justify-center gap-3 text-[12px] text-neutral-500 border-b border-[var(--color-border)]"
                    >
                      <span className="font-code tabular-nums">
                        Showing {renderedFonts.length.toLocaleString()} of{' '}
                        {store.visibleFonts.length.toLocaleString()} families
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        label="Load More"
                        onClick={() =>
                          setVisibleLimit((prev) =>
                            Math.min(prev + BATCH_STEP, store.visibleFonts.length),
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </main>

            {/* Right Inspector Panel */}
            {inspectorOpen && (
              <InspectorPanel
                font={store.selectedFont}
                allFonts={store.fonts}
                libraryName={
                  store.selectedFont ? libraryMap[store.selectedFont.libraryId] ?? 'Library' : ''
                }
                preview={store.preview}
                theme={store.theme}
                appIntegrations={store.appIntegrations}
                onUpdatePreview={store.updatePreview}
                onUpdateOpenType={store.updateOpenType}
                onToggleActivate={store.toggleFontActivation}
                onSelectFont={store.setSelectedFontId}
                onComparePair={store.compareFontPair}
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

        {/* Production Cloud & Foundry Connections Hub */}
        <CloudConnectionsModal
          isOpen={activeModal === 'connections'}
          user={store.user}
          hasDriveToken={store.hasDriveToken}
          googleTotal={store.googleTotal}
          googleLoading={store.googleLoading}
          adobeKits={store.adobeKits}
          onSignInGoogle={store.signInWithGoogle}
          onDriveTokenExpired={store.invalidateDriveToken}
          onRefreshGoogleFonts={() => store.refreshGoogleFonts(false)}
          onConnectAdobeKit={store.connectAdobeKit}
          onRemoveAdobeKit={store.removeAdobeKit}
          onImportGoogleDriveFiles={store.importGoogleDriveFiles}
          onScanSystemFonts={store.scanSystemFonts}
          onConnectLocalFolder={store.connectLocalFolder}
          onOpenFileUpload={() => setActiveModal('import')}
          onClose={() => setActiveModal(null)}
          onNotify={store.showToast}
        />

        {/* Workspace Modals */}
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

        {activeModal === 'import' && (
          <ImportFontsModal
            libraries={store.libraries}
            onClose={() => setActiveModal(null)}
            onImport={store.importLocalFonts}
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
            onRemove={store.removeFontFamily}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'quick-switcher' && (
          <QuickSwitcherModal
            fonts={store.fonts}
            onToggleActivate={store.toggleFontActivation}
            onSelectFont={(id) => {
              store.setSelectedFontId(id);
              store.navigate({ type: 'all' });
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
        {store.toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[#1b1b1b] dark:bg-[#f1f1f1] text-white dark:text-[#111111] text-[12px] font-medium shadow-lg pointer-events-none"
          >
            {store.toast}
          </div>
        )}
      </div>
    </Theme>
  );
}
