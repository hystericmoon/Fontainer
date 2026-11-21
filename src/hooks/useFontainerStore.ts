import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PREVIEW_SETTINGS,
  INITIAL_APP_INTEGRATIONS,
  INITIAL_FONT_LISTS,
  INITIAL_FONTS,
  INITIAL_LIBRARIES,
  INITIAL_SMART_LISTS,
} from '../data/catalog';
import type {
  AppIntegration,
  FilterState,
  FontFamily,
  FontLibrary,
  FontList,
  PreviewSettings,
  SidebarDestination,
  SmartList,
  ThemeMode,
  ViewMode,
} from '../types/font';
import {
  applyFontFilters,
  DEFAULT_FILTER_STATE,
  findDuplicateFonts,
  isRecentFont,
  matchesSmartList,
} from '../utils/fontFilter';
import {
  deleteStoredFontBuffer,
  importLocalFontFile,
  restoreUploadedFonts,
} from '../utils/fontLoader';

const STORAGE_KEY = 'fontainer-state-v1';

interface PersistedState {
  fonts: FontFamily[];
  libraries: FontLibrary[];
  fontLists: FontList[];
  smartLists: SmartList[];
  appIntegrations: AppIntegration[];
  preview: PreviewSettings;
  theme: ThemeMode;
  compareIds: string[];
}

function loadInitialState(): PersistedState {
  if (typeof window === 'undefined') {
    return {
      fonts: INITIAL_FONTS,
      libraries: INITIAL_LIBRARIES,
      fontLists: INITIAL_FONT_LISTS,
      smartLists: INITIAL_SMART_LISTS,
      appIntegrations: INITIAL_APP_INTEGRATIONS,
      preview: DEFAULT_PREVIEW_SETTINGS,
      theme: 'light',
      compareIds: ['plus-jakarta-sans', 'fraunces', 'jetbrains-mono'],
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      fonts: Array.isArray(parsed.fonts) && parsed.fonts.length > 0 ? parsed.fonts : INITIAL_FONTS,
      libraries:
        Array.isArray(parsed.libraries) && parsed.libraries.length > 0
          ? parsed.libraries
          : INITIAL_LIBRARIES,
      fontLists: Array.isArray(parsed.fontLists) ? parsed.fontLists : INITIAL_FONT_LISTS,
      smartLists: Array.isArray(parsed.smartLists) ? parsed.smartLists : INITIAL_SMART_LISTS,
      appIntegrations: Array.isArray(parsed.appIntegrations)
        ? parsed.appIntegrations
        : INITIAL_APP_INTEGRATIONS,
      preview: parsed.preview
        ? {
            ...DEFAULT_PREVIEW_SETTINGS,
            ...parsed.preview,
            openType: {
              ...DEFAULT_PREVIEW_SETTINGS.openType,
              ...(parsed.preview.openType ?? {}),
            },
          }
        : DEFAULT_PREVIEW_SETTINGS,
      theme: parsed.theme === 'dark' || parsed.theme === 'sepia' ? parsed.theme : 'light',
      compareIds:
        Array.isArray(parsed.compareIds) && parsed.compareIds.length > 0
          ? parsed.compareIds
          : ['plus-jakarta-sans', 'fraunces', 'jetbrains-mono'],
    };
  } catch {
    return {
      fonts: INITIAL_FONTS,
      libraries: INITIAL_LIBRARIES,
      fontLists: INITIAL_FONT_LISTS,
      smartLists: INITIAL_SMART_LISTS,
      appIntegrations: INITIAL_APP_INTEGRATIONS,
      preview: DEFAULT_PREVIEW_SETTINGS,
      theme: 'light',
      compareIds: ['plus-jakarta-sans', 'fraunces', 'jetbrains-mono'],
    };
  }
}

export function useFontainerStore() {
  const initial = useMemo(() => loadInitialState(), []);

  const [fonts, setFonts] = useState<FontFamily[]>(initial.fonts);
  const [libraries, setLibraries] = useState<FontLibrary[]>(initial.libraries);
  const [fontLists, setFontLists] = useState<FontList[]>(initial.fontLists);
  const [smartLists, setSmartLists] = useState<SmartList[]>(initial.smartLists);
  const [appIntegrations, setAppIntegrations] = useState<AppIntegration[]>(initial.appIntegrations);
  const [preview, setPreview] = useState<PreviewSettings>(initial.preview);
  const [theme, setTheme] = useState<ThemeMode>(initial.theme);
  const [compareIds, setCompareIds] = useState<string[]>(initial.compareIds);

  const [destination, setDestinationState] = useState<SidebarDestination>({ type: 'all' });
  const [history, setHistory] = useState<SidebarDestination[]>([{ type: 'all' }]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFontId, setSelectedFontId] = useState<string>(
    initial.fonts.some((f) => f.id === 'archivo') ? 'archivo' : (initial.fonts[0]?.id ?? ''),
  );
  const [checkedFontIds, setCheckedFontIds] = useState<string[]>([]);
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Restore binary uploaded fonts from IndexedDB on boot
  useEffect(() => {
    void restoreUploadedFonts();
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Persist to localStorage
  useEffect(() => {
    try {
      const payload: PersistedState = {
        fonts,
        libraries,
        fontLists,
        smartLists,
        appIntegrations,
        preview,
        theme,
        compareIds,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }, [fonts, libraries, fontLists, smartLists, appIntegrations, preview, theme, compareIds]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const navigateTo = useCallback(
    (next: SidebarDestination) => {
      setDestinationState(next);
      setCheckedFontIds([]);
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, next];
      });
      setHistoryIndex((idx) => idx + 1);
    },
    [historyIndex],
  );

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIdx = historyIndex - 1;
    setHistoryIndex(nextIdx);
    setDestinationState(history[nextIdx]);
    setCheckedFontIds([]);
  }, [history, historyIndex]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIdx = historyIndex + 1;
    setHistoryIndex(nextIdx);
    setDestinationState(history[nextIdx]);
    setCheckedFontIds([]);
  }, [history, historyIndex]);

  const filteredFonts = useMemo(
    () => applyFontFilters(fonts, destination, filters, fontLists, smartLists),
    [fonts, destination, filters, fontLists, smartLists],
  );

  const selectedFont = useMemo(
    () => fonts.find((f) => f.id === selectedFontId) ?? filteredFonts[0] ?? fonts[0] ?? null,
    [fonts, selectedFontId, filteredFonts],
  );

  const duplicateGroups = useMemo(() => findDuplicateFonts(fonts), [fonts]);

  const counts = useMemo(() => {
    const libraryCounts: Record<string, number> = {};
    for (const lib of libraries) libraryCounts[lib.id] = 0;

    let activated = 0;
    let deactivated = 0;
    let starred = 0;
    let recent = 0;

    for (const font of fonts) {
      if (font.activated) activated += 1;
      else deactivated += 1;
      if (font.starred) starred += 1;
      if (isRecentFont(font)) recent += 1;
      libraryCounts[font.libraryId] = (libraryCounts[font.libraryId] ?? 0) + 1;
    }

    const listCounts: Record<string, number> = {};
    const validIds = new Set(fonts.map((f) => f.id));
    for (const list of fontLists) {
      listCounts[list.id] = list.fontIds.filter((id) => validIds.has(id)).length;
    }

    const smartCounts: Record<string, number> = {};
    for (const smart of smartLists) {
      smartCounts[smart.id] = fonts.filter((f) => matchesSmartList(f, smart)).length;
    }

    return {
      all: fonts.length,
      activated,
      deactivated,
      starred,
      recent,
      libraryCounts,
      listCounts,
      smartCounts,
    };
  }, [fonts, libraries, fontLists, smartLists]);

  const toggleFontActivation = useCallback(
    (fontId: string) => {
      setFonts((prev) =>
        prev.map((font) => {
          if (font.id !== fontId) return font;
          const nextActive = !font.activated;
          return {
            ...font,
            activated: nextActive,
            styles: font.styles.map((s) => ({ ...s, activated: nextActive })),
          };
        }),
      );
    },
    [],
  );

  const toggleStyleActivation = useCallback((fontId: string, styleId: string) => {
    setFonts((prev) =>
      prev.map((font) => {
        if (font.id !== fontId) return font;
        const nextStyles = font.styles.map((s) =>
          s.id === styleId ? { ...s, activated: !s.activated } : s,
        );
        const anyActive = nextStyles.some((s) => s.activated);
        return {
          ...font,
          activated: anyActive,
          styles: nextStyles,
        };
      }),
    );
  }, []);

  const setBatchActivation = useCallback(
    (fontIds: string[], active: boolean) => {
      const idSet = new Set(fontIds);
      setFonts((prev) =>
        prev.map((font) =>
          idSet.has(font.id)
            ? {
                ...font,
                activated: active,
                styles: font.styles.map((s) => ({ ...s, activated: active })),
              }
            : font,
        ),
      );
      showToast(`${active ? 'Activated' : 'Deactivated'} ${fontIds.length} font${fontIds.length === 1 ? '' : 's'}`);
    },
    [showToast],
  );

  const toggleStar = useCallback((fontId: string) => {
    setFonts((prev) =>
      prev.map((font) => (font.id === fontId ? { ...font, starred: !font.starred } : font)),
    );
  }, []);

  const toggleExpandFamily = useCallback((fontId: string) => {
    setExpandedFamilyIds((prev) => ({ ...prev, [fontId]: !prev[fontId] }));
  }, []);

  const toggleCheckedFont = useCallback((fontId: string) => {
    setCheckedFontIds((prev) =>
      prev.includes(fontId) ? prev.filter((id) => id !== fontId) : [...prev, fontId],
    );
  }, []);

  const addTagToFont = useCallback((fontId: string, rawTag: string) => {
    const clean = rawTag.trim().toLowerCase();
    if (!clean) return;
    setFonts((prev) =>
      prev.map((font) =>
        font.id === fontId && !font.tags.includes(clean)
          ? { ...font, tags: [...font.tags, clean] }
          : font,
      ),
    );
  }, []);

  const removeTagFromFont = useCallback((fontId: string, tag: string) => {
    setFonts((prev) =>
      prev.map((font) =>
        font.id === fontId ? { ...font, tags: font.tags.filter((t) => t !== tag) } : font,
      ),
    );
  }, []);

  const updateFontNotes = useCallback((fontId: string, notes: string) => {
    setFonts((prev) => prev.map((f) => (f.id === fontId ? { ...f, notes } : f)));
  }, []);

  const createFontList = useCallback(
    (name: string, color: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newList: FontList = {
        id: `list-${Date.now()}`,
        name: trimmed,
        color,
        fontIds: [],
        createdAt: new Date().toISOString(),
      };
      setFontLists((prev) => [...prev, newList]);
      showToast(`Created Font List "${trimmed}"`);
    },
    [showToast],
  );

  const deleteFontList = useCallback(
    (listId: string) => {
      setFontLists((prev) => prev.filter((l) => l.id !== listId));
      if (destination.type === 'list' && destination.id === listId) {
        navigateTo({ type: 'all' });
      }
      showToast('Deleted Font List');
    },
    [destination, navigateTo, showToast],
  );

  const addFontsToList = useCallback(
    (listId: string, fontIds: string[]) => {
      const list = fontLists.find((l) => l.id === listId);
      setFontLists((prev) =>
        prev.map((l) => {
          if (l.id !== listId) return l;
          const merged = Array.from(new Set([...l.fontIds, ...fontIds]));
          return { ...l, fontIds: merged };
        }),
      );
      if (list) {
        showToast(
          `Added ${fontIds.length} font${fontIds.length === 1 ? '' : 's'} to "${list.name}"`,
        );
      }
    },
    [fontLists, showToast],
  );

  const removeFontFromList = useCallback((listId: string, fontId: string) => {
    setFontLists((prev) =>
      prev.map((l) =>
        l.id === listId ? { ...l, fontIds: l.fontIds.filter((id) => id !== fontId) } : l,
      ),
    );
  }, []);

  const activateAllInList = useCallback(
    (listId: string, active: boolean) => {
      const list = fontLists.find((l) => l.id === listId);
      if (!list || list.fontIds.length === 0) return;
      setBatchActivation(list.fontIds, active);
    },
    [fontLists, setBatchActivation],
  );

  const createSmartList = useCallback(
    (smart: Omit<SmartList, 'id'>) => {
      const next: SmartList = {
        ...smart,
        id: `smart-${Date.now()}`,
      };
      setSmartLists((prev) => [...prev, next]);
      navigateTo({ type: 'smart', id: next.id });
      showToast(`Created Smart List "${next.name}"`);
    },
    [navigateTo, showToast],
  );

  const deleteSmartList = useCallback(
    (smartId: string) => {
      setSmartLists((prev) => prev.filter((s) => s.id !== smartId));
      if (destination.type === 'smart' && destination.id === smartId) {
        navigateTo({ type: 'all' });
      }
      showToast('Deleted Smart List');
    },
    [destination, navigateTo, showToast],
  );

  const addLibrary = useCallback(
    (name: string, provider: FontLibrary['provider'], path: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newLib: FontLibrary = {
        id: `lib-${Date.now()}`,
        name: trimmed,
        provider,
        path: path.trim() || `~/Fonts/${trimmed}`,
        syncedAt: new Date().toISOString(),
        autoSync: true,
      };
      setLibraries((prev) => [...prev, newLib]);
      navigateTo({ type: 'library', id: newLib.id });
      showToast(`Connected library "${trimmed}"`);
    },
    [navigateTo, showToast],
  );

  const syncLibrary = useCallback(
    (libraryId: string) => {
      setLibraries((prev) =>
        prev.map((l) => (l.id === libraryId ? { ...l, syncedAt: new Date().toISOString() } : l)),
      );
      const lib = libraries.find((l) => l.id === libraryId);
      if (lib) showToast(`Synced "${lib.name}"`);
    },
    [libraries, showToast],
  );

  const importFiles = useCallback(
    async (files: FileList | File[], targetLibraryId = 'lib-local') => {
      const valid = Array.from(files).filter((f) => /\.(ttf|otf|woff2?)$/i.test(f.name));
      if (valid.length === 0) {
        showToast('Select valid .ttf, .otf, .woff, or .woff2 font files');
        return 0;
      }

      const imported: FontFamily[] = [];
      for (const file of valid) {
        try {
          const family = await importLocalFontFile(file, targetLibraryId);
          imported.push(family);
        } catch {
          // skip unreadable font binary
        }
      }

      if (imported.length > 0) {
        setFonts((prev) => [...imported, ...prev]);
        setSelectedFontId(imported[0].id);
        showToast(`Imported & activated ${imported.length} font${imported.length === 1 ? '' : 's'}`);
      }
      return imported.length;
    },
    [showToast],
  );

  const removeFont = useCallback(
    (fontId: string) => {
      setFonts((prev) => prev.filter((f) => f.id !== fontId));
      setFontLists((prev) =>
        prev.map((l) => ({ ...l, fontIds: l.fontIds.filter((id) => id !== fontId) })),
      );
      setCompareIds((prev) => prev.filter((id) => id !== fontId));
      void deleteStoredFontBuffer(fontId);
      showToast('Removed font from library');
    },
    [showToast],
  );

  const toggleCompareFont = useCallback(
    (fontId: string) => {
      setCompareIds((prev) => {
        if (prev.includes(fontId)) {
          return prev.filter((id) => id !== fontId);
        }
        if (prev.length >= 4) {
          showToast('Compare supports up to 4 fonts at once');
          return prev;
        }
        showToast('Pinned font to Compare view');
        return [...prev, fontId];
      });
    },
    [showToast],
  );

  const toggleAppAutoActivate = useCallback((appId: string) => {
    setAppIntegrations((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, autoActivate: !app.autoActivate } : app)),
    );
  }, []);

  const applyFontToApp = useCallback(
    (appId: string, font: FontFamily) => {
      setAppIntegrations((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, lastAppliedFont: font.name } : app)),
      );
      const app = appIntegrations.find((a) => a.id === appId);
      if (app) {
        if (!font.activated) {
          toggleFontActivation(font.id);
        }
        showToast(`Applied "${font.name}" to ${app.name}`);
      }
    },
    [appIntegrations, showToast, toggleFontActivation],
  );

  const resetAllData = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setFonts(INITIAL_FONTS);
    setLibraries(INITIAL_LIBRARIES);
    setFontLists(INITIAL_FONT_LISTS);
    setSmartLists(INITIAL_SMART_LISTS);
    setAppIntegrations(INITIAL_APP_INTEGRATIONS);
    setPreview(DEFAULT_PREVIEW_SETTINGS);
    setFilters(DEFAULT_FILTER_STATE);
    setCompareIds(['plus-jakarta-sans', 'fraunces', 'jetbrains-mono']);
    setDestinationState({ type: 'all' });
    setSelectedFontId(INITIAL_FONTS[0].id);
    showToast('Restored default Fontainer library');
  }, [showToast]);

  return {
    fonts,
    filteredFonts,
    libraries,
    fontLists,
    smartLists,
    appIntegrations,
    preview,
    setPreview,
    theme,
    setTheme,
    compareIds,
    toggleCompareFont,
    destination,
    navigateTo,
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.length - 1,
    goBack,
    goForward,
    filters,
    setFilters,
    viewMode,
    setViewMode,
    selectedFont,
    selectedFontId,
    setSelectedFontId,
    checkedFontIds,
    setCheckedFontIds,
    toggleCheckedFont,
    expandedFamilyIds,
    toggleExpandFamily,
    counts,
    duplicateGroups,
    toastMessage,
    showToast,
    toggleFontActivation,
    toggleStyleActivation,
    setBatchActivation,
    toggleStar,
    addTagToFont,
    removeTagFromFont,
    updateFontNotes,
    createFontList,
    deleteFontList,
    addFontsToList,
    removeFontFromList,
    activateAllInList,
    createSmartList,
    deleteSmartList,
    addLibrary,
    syncLibrary,
    importFiles,
    removeFont,
    toggleAppAutoActivate,
    applyFontToApp,
    resetAllData,
  };
}
