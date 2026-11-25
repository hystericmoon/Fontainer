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
import { ICON_CATALOG, IconLibraryView } from './components/IconLibraryView';
import { InspectorPanel } from './components/InspectorPanel';
import { InstallMacModal } from './components/InstallMacModal';
import {
  decodeSharedFontStack,
  encodeSharedFontStack,
  MissingFontsModal,
  SharedStackModal,
  type SharedFontStackPayload,
} from './components/ProjectSyncModals';
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
import {
  checkForDesktopUpdate,
  installDesktopUpdateInApp,
  subscribeDesktopEvents,
  type DesktopUpdateInfo,
} from './services/desktopFontActivator';
import { countActiveFilterFacets } from './utils/fontFilter';

type ActiveModal =
  | null
  | 'new-list'
  | 'new-smart'
  | 'connections'
  | 'import'
  | 'preferences'
  | 'duplicates'
  | 'missing-fonts'
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
  const [sharedStack, setSharedStack] = useState<SharedFontStackPayload | null>(null);
  const [desktopUpdate, setDesktopUpdate] = useState<DesktopUpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [activeSubfolder, setActiveSubfolder] = useState<string>('');

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

  // Listen to native macOS Menu Bar / Windows System Tray events & watched-folder auto-activations
  useEffect(() => {
    if (!store.isDesktop) return;
    let unsub: (() => void) | null = null;
    void subscribeDesktopEvents({
      onOpenQuickSwitcher: () => setActiveModal('quick-switcher'),
      onWatchedFolderUpdated: (count) => {
        store.showToast(
          `Auto-activated ${count} new ${count === 1 ? 'font' : 'fonts'} from watched folder`,
        );
      },
    }).then((fn) => {
      unsub = fn;
    });
    return () => {
      if (unsub) unsub();
    };
  }, [store.isDesktop, store.showToast]);

  // Parse ?share=... project font stack links on mount + check GitHub Releases for desktop updates
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const shareParam = sp.get('share');
    if (shareParam) {
      const decoded = decodeSharedFontStack(shareParam);
      if (decoded) {
        setSharedStack(decoded);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    if (store.isDesktop) {
      void checkForDesktopUpdate(store.osPlatform).then((info) => {
        if (info) setDesktopUpdate(info);
      });
    }
  }, [store.isDesktop, store.osPlatform]);

  // Reset subfolder filter when changing sidebar destination
  useEffect(() => {
    setActiveSubfolder('');
  }, [store.destination]);

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
      case 'icons':
        return 'Icon Sets';
      case 'library':
        return libraryMap[dest.id] ?? 'Font Library';
      case 'list':
        return store.fontLists.find((l) => l.id === dest.id)?.name ?? 'Font List';
      case 'smart':
        return store.smartLists.find((s) => s.id === dest.id)?.name ?? 'Smart List';
    }
  }, [store.destination, libraryMap, store.fontLists, store.smartLists]);

  const activeFilterCount = useMemo(() => countActiveFilterFacets(store.filters), [store.filters]);

  const librarySubfolders = useMemo(() => {
    if (store.destination.type !== 'library') return [];
    const set = new Set<string>();
    for (const f of store.visibleFonts) {
      if (!f.sourcePath) continue;
      const parts = f.sourcePath.replace(/\\/g, '/').split('/').filter(Boolean);
      if (parts.length >= 2) {
        set.add(parts.slice(0, -1).join('/'));
      }
    }
    return Array.from(set).sort().slice(0, 24);
  }, [store.destination.type, store.visibleFonts]);

  const subfolderFilteredFonts = useMemo(() => {
    if (!activeSubfolder) return store.visibleFonts;
    return store.visibleFonts.filter((f) => {
      if (!f.sourcePath) return false;
      const norm = f.sourcePath.replace(/\\/g, '/');
      return norm.startsWith(`${activeSubfolder}/`) || norm.includes(`/${activeSubfolder}/`);
    });
  }, [store.visibleFonts, activeSubfolder]);

  const renderedFonts = useMemo(
    () => subfolderFilteredFonts.slice(0, visibleLimit),
    [subfolderFilteredFonts, visibleLimit],
  );
  const hasMoreFonts = visibleLimit < subfolderFilteredFonts.length;

  // Keyboard-first browsing: ↑/↓ step through fonts, Space toggles activation, S toggles Star
  useEffect(() => {
    const onBrowseKeyDown = (e: KeyboardEvent) => {
      if (activeModal || store.destination.type === 'icons') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (renderedFonts.length === 0) return;

      const curIdx = renderedFonts.findIndex((f) => f.id === store.selectedFont?.id);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = renderedFonts[Math.min(renderedFonts.length - 1, curIdx + 1)];
        if (next) store.setSelectedFontId(next.id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = renderedFonts[Math.max(0, curIdx <= 0 ? 0 : curIdx - 1)];
        if (prev) store.setSelectedFontId(prev.id);
      } else if (e.key === ' ' && store.selectedFont) {
        e.preventDefault();
        store.toggleFontActivation(store.selectedFont.id);
      } else if (e.key.toLowerCase() === 's' && store.selectedFont) {
        e.preventDefault();
        store.toggleStar(store.selectedFont.id);
      }
    };
    window.addEventListener('keydown', onBrowseKeyDown);
    return () => window.removeEventListener('keydown', onBrowseKeyDown);
  }, [activeModal, renderedFonts, store]);

  const handleExportListDevHandoff = async (listId: string) => {
    const list = store.fontLists.find((l) => l.id === listId);
    if (!list || list.fontIds.length === 0) {
      store.showToast('Add fonts to this list before exporting');
      return;
    }
    const items = list.fontIds
      .map((id) => store.fonts.find((f) => f.id === id))
      .filter((f): f is NonNullable<typeof f> => Boolean(f));
    const googleLinks = items
      .filter((f) => f.libraryId === 'lib-google')
      .map(
        (f) =>
          `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.name).replace(/%20/g, '+')}:wght@400;600;700&display=swap" />`,
      );
    const fontshareLinks = items
      .filter((f) => f.fontshareSlug)
      .map(
        (f) =>
          `<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=${f.fontshareSlug}@400,600,700&display=swap" />`,
      );
    const cssVars = items.map(
      (f, idx) =>
        `  --font-${idx === 0 ? 'primary' : idx === 1 ? 'secondary' : `accent-${idx}`}: ${f.cssFamily};`,
    );
    const snippet = [
      `<!-- Fontainer Dev Handoff: ${list.name} -->`,
      ...googleLinks,
      ...fontshareLinks,
      '',
      '<style>',
      ':root {',
      ...cssVars,
      '}',
      '</style>',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(snippet);
      store.showToast(`Copied Dev Handoff (<link> + CSS) for "${list.name}"`);
    } catch {
      store.showToast('Dev Handoff snippet ready');
    }
  };

  const handleShareFontList = async (listId: string) => {
    const list = store.fontLists.find((l) => l.id === listId);
    if (!list || list.fontIds.length === 0) {
      store.showToast('Add at least one font to this list before sharing');
      return;
    }
    const fontEntries = list.fontIds
      .map((id) => store.fonts.find((f) => f.id === id))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
      .map((f) => ({ id: f.id, name: f.name }));
    const encoded = encodeSharedFontStack({ name: list.name, fonts: fontEntries });
    const shareUrl = `https://fontainer-alpha.vercel.app/?share=${encoded}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      store.showToast(`Copied share link for "${list.name}" (${fontEntries.length} fonts)`);
    } catch {
      store.showToast('Share link ready');
    }
  };

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
            onOpenMissingFonts={() => setActiveModal('missing-fonts')}
            onOpenCompare={() => store.setViewMode('compare')}
            compareCount={store.compareIds.length}
            onDeleteList={store.deleteFontList}
            onActivateAllInList={store.activateAllInList}
            onShareList={(id) => void handleShareFontList(id)}
            onExportListDevHandoff={(id) => void handleExportListDevHandoff(id)}
            onDeleteSmartList={store.deleteSmartList}
            onSyncLibrary={store.syncLibrary}
            onActivateAllInLibrary={(libId, active) => void store.activateAllInLibrary(libId, active)}
            onDropFontOnList={(listId, fontId) => store.addFontsToList(listId, [fontId])}
            showInstallAction={!pwa.isInstalled && !store.isDesktop}
            onOpenInstall={() => setActiveModal('install-mac')}
            isDesktop={store.isDesktop}
            osPlatform={store.osPlatform}
            osActiveCount={store.osActiveCount}
            osSyncBusy={store.osSyncBusy}
            sessionOnlyMode={store.sessionOnlyMode}
            onToggleSessionOnlyMode={() => void store.toggleSessionOnlyMode()}
            onOpenOsFontsFolder={() => void store.openOsFontsFolder()}
            desktopUpdate={desktopUpdate}
            updateProgress={updateProgress}
            onInstallDesktopUpdate={() => {
              if (!desktopUpdate || updateProgress !== null) return;
              setUpdateProgress(1);
              store.showToast(`Downloading Fontainer v${desktopUpdate.latestVersion}…`);
              void installDesktopUpdateInApp((pct) => setUpdateProgress(pct)).then((installed) => {
                if (!installed) {
                  setUpdateProgress(null);
                  window.open(desktopUpdate.downloadUrl, '_blank', 'noreferrer');
                  store.showToast('Opened installer download in browser');
                }
              });
            }}
            user={store.user}
            cloudSynced={store.cloudSynced}
            onSignInGoogle={() => void store.signInWithGoogle(false)}
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

          {/* Live Bulk OS Activation Progress Bar */}
          {store.bulkProgress && (
            <div
              role="status"
              className="shrink-0 px-4 py-2 bg-[#F1F1F1] dark:bg-[#222222] border-b border-[var(--color-border)] text-[12px] space-y-1.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium text-[var(--color-text-primary)] truncate">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="truncate">
                    {store.bulkProgress.label}
                    {store.bulkProgress.currentName ? ` — ${store.bulkProgress.currentName}` : ''}
                  </span>
                </span>
                {store.bulkProgress.total > 0 && (
                  <span className="font-code tabular-nums text-[11px] text-[var(--color-text-secondary)] shrink-0">
                    {store.bulkProgress.completed.toLocaleString()} /{' '}
                    {store.bulkProgress.total.toLocaleString()}
                  </span>
                )}
              </div>
              {store.bulkProgress.total > 0 && (
                <div className="h-1 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#1b1b1b] dark:bg-[#f1f1f1] transition-all duration-150"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((store.bulkProgress.completed / store.bulkProgress.total) * 100),
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Desktop Pending Google Drive Auto-Activation Banner */}
          {store.isDesktop && store.pendingDriveSyncIds.length > 0 && (
            <div
              role="status"
              className="shrink-0 px-4 py-1.5 bg-[#F1F1F1] dark:bg-[#242424] border-b border-[var(--color-border)] text-[var(--color-text-primary)] text-[12px] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Cloud className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-secondary)]" />
                <span className="truncate">
                  {store.pendingDriveSyncIds.length} synced Google Drive{' '}
                  {store.pendingDriveSyncIds.length === 1 ? 'font is' : 'fonts are'} ready to
                  auto-activate on this computer.
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                label="Connect Drive to Sync"
                onClick={() => void store.signInWithGoogle(true)}
              />
            </div>
          )}

          <Toolbar
            title={currentTitle}
            resultCount={
              store.destination.type === 'icons' ? ICON_CATALOG.length : store.visibleFonts.length
            }
            resultUnit={store.destination.type === 'icons' ? 'icons' : undefined}
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
            showInstallButton={!pwa.isInstalled && !store.isDesktop}
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

          {/* Nested Subfolder Filter Bar (FontBase style) */}
          {librarySubfolders.length > 1 && (
            <div className="shrink-0 px-4 py-1.5 bg-[#F8F8F8] dark:bg-[#1E1E1E] border-b border-[var(--color-border)] flex items-center gap-1.5 overflow-x-auto text-[11.5px]">
              <button
                type="button"
                onClick={() => setActiveSubfolder('')}
                className={`h-6 px-2 rounded-md shrink-0 cursor-pointer transition-colors ${
                  activeSubfolder === ''
                    ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111] font-medium'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                All Folders
              </button>
              {librarySubfolders.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setActiveSubfolder(sub)}
                  className={`h-6 px-2 rounded-md font-code shrink-0 cursor-pointer transition-colors ${
                    activeSubfolder === sub
                      ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111] font-medium'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {/* Main Viewport + Inspector Split */}
          <div className="flex-1 min-h-0 flex">
            <main
              aria-label="Font Specimens"
              className={`flex-1 min-w-0 h-full overflow-y-auto ${canvasBgClass}`}
            >
              {store.destination.type === 'icons' ? (
                <IconLibraryView onNotify={store.showToast} />
              ) : store.viewMode === 'compare' ? (
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
                onUpdatePreview={store.updatePreview}
                onUpdateOpenType={store.updateOpenType}
                onUpdateVariableAxes={store.updateVariableAxes}
                onToggleActivate={store.toggleFontActivation}
                onSelectFont={store.setSelectedFontId}
                onComparePair={store.compareFontPair}
                onAddTag={store.addTagToFont}
                onRemoveTag={store.removeTagFromFont}
                onUpdateNotes={store.updateFontNotes}
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
          fontshareTotal={store.fontshareTotal}
          indieTotal={store.indieTotal}
          adobeKits={store.adobeKits}
          onSignInGoogle={() => store.signInWithGoogle(true)}
          onDriveTokenExpired={store.invalidateDriveToken}
          onRefreshGoogleFonts={() => store.refreshGoogleFonts(false)}
          onRefreshFontshareFonts={() => store.refreshFontshareFonts(false)}
          onRefreshIndieFoundries={() => store.refreshIndieFoundries(false)}
          onImportGitHubRepo={store.importGitHubRepo}
          onConnectAdobeKit={store.connectAdobeKit}
          onRemoveAdobeKit={store.removeAdobeKit}
          onImportGoogleDriveFiles={store.importGoogleDriveFiles}
          onActivateAllGoogleDrive={store.activateAllGoogleDriveFonts}
          localDriveFolders={store.localDriveFolders}
          onActivateLocalDriveZeroCopy={store.activateLocalDriveZeroCopy}
          isDesktop={store.isDesktop}
          watchedFolders={store.watchedFolders}
          onAddWatchedFolder={store.addWatchedFolder}
          onRemoveWatchedFolder={store.removeWatchedFolder}
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

        <MissingFontsModal
          isOpen={activeModal === 'missing-fonts'}
          allFonts={store.fonts}
          onActivateIds={(ids) => store.batchSetActivation(ids, true)}
          onClose={() => setActiveModal(null)}
          onNotify={store.showToast}
        />

        <SharedStackModal
          stack={sharedStack}
          allFonts={store.fonts}
          onImportAndActivate={(stackName, fontIds) => {
            store.createFontList(stackName, '#1b1b1b');
            store.batchSetActivation(fontIds, true);
            store.showToast(`Activated ${fontIds.length} fonts from "${stackName}"`);
          }}
          onClose={() => setSharedStack(null)}
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
