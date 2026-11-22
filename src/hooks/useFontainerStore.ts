import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  DEFAULT_PREVIEW_SETTINGS,
  INITIAL_APP_INTEGRATIONS,
  INITIAL_FONT_LISTS,
  INITIAL_LIBRARIES,
  INITIAL_SMART_LISTS,
} from '../data/catalog';
import {
  downloadGoogleDriveFont,
  DriveAuthExpiredError,
  fetchAdobeFontsKit,
  fetchLiveGoogleFonts,
  type RemoteFontFile,
} from '../services/cloudProviders';
import {
  clearGoogleDriveAccessToken,
  getGoogleDriveAccessToken,
  signInWithGoogle,
  signOutGoogle,
  subscribeAuth,
} from '../services/firebase';
import {
  clearFirestoreKnownCache,
  type CloudFontMeta,
  deleteAdobeKitDoc,
  deleteFontListDoc,
  deleteLibraryDoc,
  deleteSmartListDoc,
  ensureUserWorkspace,
  saveAdobeKitDoc,
  saveFontListDoc,
  saveFontMetaBatch,
  saveFontMetaDoc,
  saveLibraryDoc,
  saveSmartListDoc,
  saveUserWorkspacePatch,
  subscribeUserWorkspace,
} from '../services/firestoreSync';
import type {
  AdobeKitRecord,
  AppIntegration,
  FilterState,
  FontFamily,
  FontLibrary,
  FontList,
  LibraryProvider,
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
  scanLocalDirectoryFonts,
  scanSystemLocalFonts,
} from '../utils/fontLoader';

const STORAGE_KEY = 'fontainer-prod-v2';

interface LocalPersistedState {
  customFonts: FontFamily[];
  libraries: FontLibrary[];
  fontLists: FontList[];
  smartLists: SmartList[];
  adobeKits: AdobeKitRecord[];
  fontMeta: Record<string, CloudFontMeta>;
  appIntegrations: AppIntegration[];
  preview: PreviewSettings;
  theme: ThemeMode;
  compareIds: string[];
}

function loadLocalState(): LocalPersistedState {
  const defaults: LocalPersistedState = {
    customFonts: [],
    libraries: INITIAL_LIBRARIES,
    fontLists: INITIAL_FONT_LISTS,
    smartLists: INITIAL_SMART_LISTS,
    adobeKits: [],
    fontMeta: {},
    appIntegrations: INITIAL_APP_INTEGRATIONS,
    preview: DEFAULT_PREVIEW_SETTINGS,
    theme: 'light',
    compareIds: [],
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<LocalPersistedState>;
    const libs = Array.isArray(parsed.libraries) && parsed.libraries.length > 0
      ? parsed.libraries
      : INITIAL_LIBRARIES;
    const hasGoogle = libs.some((l) => l.id === 'lib-google');
    const hasLocal = libs.some((l) => l.id === 'lib-local');
    const mergedLibs = [
      ...(hasGoogle ? [] : [INITIAL_LIBRARIES[0]]),
      ...(hasLocal ? [] : [INITIAL_LIBRARIES[1]]),
      ...libs,
    ];
    return {
      customFonts: Array.isArray(parsed.customFonts) ? parsed.customFonts : [],
      libraries: mergedLibs,
      fontLists: Array.isArray(parsed.fontLists) ? parsed.fontLists : [],
      smartLists: Array.isArray(parsed.smartLists) && parsed.smartLists.length > 0
        ? parsed.smartLists
        : INITIAL_SMART_LISTS,
      adobeKits: Array.isArray(parsed.adobeKits) ? parsed.adobeKits : [],
      fontMeta: parsed.fontMeta && typeof parsed.fontMeta === 'object' ? parsed.fontMeta : {},
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
      compareIds: Array.isArray(parsed.compareIds) ? parsed.compareIds : [],
    };
  } catch {
    return defaults;
  }
}

export function useFontainerStore() {
  const initial = useMemo(() => loadLocalState(), []);

  // Auth & Cloud Sync State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasDriveToken, setHasDriveToken] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);

  // Live Font Sources (Zero fake data)
  const [googleFonts, setGoogleFonts] = useState<FontFamily[]>([]);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleTotal, setGoogleTotal] = useState(0);
  const [adobeFonts, setAdobeFonts] = useState<FontFamily[]>([]);
  const [customFonts, setCustomFonts] = useState<FontFamily[]>(initial.customFonts);
  const [adobeKits, setAdobeKits] = useState<AdobeKitRecord[]>(initial.adobeKits);

  // User Workspace Organization
  const [libraries, setLibraries] = useState<FontLibrary[]>(initial.libraries);
  const [fontLists, setFontLists] = useState<FontList[]>(initial.fontLists);
  const [smartLists, setSmartLists] = useState<SmartList[]>(initial.smartLists);
  const [fontMeta, setFontMeta] = useState<Record<string, CloudFontMeta>>(initial.fontMeta);
  const [appIntegrations, setAppIntegrations] = useState<AppIntegration[]>(initial.appIntegrations);
  const [preview, setPreview] = useState<PreviewSettings>(initial.preview);
  const [theme, setTheme] = useState<ThemeMode>(initial.theme);
  const [compareIds, setCompareIds] = useState<string[]>(initial.compareIds);

  // Navigation & UI state
  const [destination, setDestinationState] = useState<SidebarDestination>({ type: 'all' });
  const [history, setHistory] = useState<SidebarDestination[]>([{ type: 'all' }]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [selectedFontId, setSelectedFontId] = useState<string | null>(null);
  const [checkedFontIds, setCheckedFontIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const hydratedKitsRef = useRef<Set<string>>(new Set());
  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const fontMetaRef = useRef<Record<string, CloudFontMeta>>(fontMeta);
  fontMetaRef.current = fontMeta;

  // Debounced Firestore write buffers (prevents per-keystroke / per-slider-tick write floods)
  const workspacePatchTimerRef = useRef<number | null>(null);
  const pendingWorkspacePatchRef = useRef<{
    previewText?: string;
    previewFontSize?: number;
  }>({});
  const notesTimersRef = useRef<Map<string, number>>(new Map());
  const pendingNotesRef = useRef<Map<string, CloudFontMeta>>(new Map());

  const flushPendingCloudWrites = useCallback(() => {
    const uid = userRef.current?.uid;
    if (workspacePatchTimerRef.current !== null) {
      window.clearTimeout(workspacePatchTimerRef.current);
      workspacePatchTimerRef.current = null;
    }
    const wsPatch = pendingWorkspacePatchRef.current;
    if (uid && (wsPatch.previewText !== undefined || wsPatch.previewFontSize !== undefined)) {
      pendingWorkspacePatchRef.current = {};
      void saveUserWorkspacePatch(uid, wsPatch).catch(() => {});
    } else {
      pendingWorkspacePatchRef.current = {};
    }

    for (const timer of notesTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    notesTimersRef.current.clear();

    if (uid && pendingNotesRef.current.size > 0) {
      const items = Array.from(pendingNotesRef.current.values());
      pendingNotesRef.current.clear();
      void saveFontMetaBatch(uid, items).catch(() => {});
    } else {
      pendingNotesRef.current.clear();
    }
  }, []);

  useEffect(() => {
    const onPageHide = () => flushPendingCloudWrites();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      flushPendingCloudWrites();
    };
  }, [flushPendingCloudWrites]);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Restore local IndexedDB uploaded font binaries on mount
  useEffect(() => {
    void restoreUploadedFonts();
  }, []);

  // Load REAL Live Google Fonts Directory on startup
  const refreshGoogleFonts = useCallback(async (silent = false) => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const res = await fetchLiveGoogleFonts('lib-google', 2000);
      setGoogleFonts(res.fonts);
      setGoogleTotal(res.total);
      setLibraries((prev) =>
        prev.map((l) => (l.id === 'lib-google' ? { ...l, syncedAt: new Date().toISOString() } : l)),
      );
      if (!silent) {
        showToast(`Synced ${res.fonts.length.toLocaleString()} live Google Fonts`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach Google Fonts';
      setGoogleError(msg);
      if (!silent) showToast(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void refreshGoogleFonts(true);
  }, [refreshGoogleFonts]);

  // Hydrate any persisted Adobe Fonts Web Project kits live
  useEffect(() => {
    for (const kit of adobeKits) {
      if (hydratedKitsRef.current.has(kit.kitId)) continue;
      hydratedKitsRef.current.add(kit.kitId);
      const libId = `lib-adobe-${kit.kitId}`;
      void fetchAdobeFontsKit(kit.kitId, libId)
        .then((res) => {
          setAdobeFonts((prev) => {
            const withoutKit = prev.filter((f) => f.adobeKitId !== res.kitId);
            return [...res.fonts, ...withoutKit];
          });
        })
        .catch(() => {
          // Kit may be unreachable offline; keep record for manual refresh
        });
    }
  }, [adobeKits]);

  // Subscribe to Firebase Auth
  useEffect(() => {
    return subscribeAuth((u, driveReady) => {
      setUser(u);
      setHasDriveToken(driveReady);
      setAuthReady(true);
      if (!u) setCloudSynced(false);
    });
  }, []);

  // Subscribe to Firestore Multi-User Workspace once authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    let active = true;
    let unsub: (() => void) | null = null;

    void (async () => {
      await ensureUserWorkspace(user.uid, {
        displayName: user.displayName,
        theme,
        previewText: preview.text,
        previewFontSize: preview.fontSize,
        compareIds,
      });
      if (!active) return;

      unsub = subscribeUserWorkspace(user.uid, {
        onWorkspace: (ws) => {
          if (ws.theme) setTheme(ws.theme);
          // Avoid overwriting in-progress local typing / slider drag while a debounced save is pending
          const hasPendingText = pendingWorkspacePatchRef.current.previewText !== undefined;
          const hasPendingSize = pendingWorkspacePatchRef.current.previewFontSize !== undefined;
          if (
            (!hasPendingText && ws.previewText !== undefined) ||
            (!hasPendingSize && ws.previewFontSize !== undefined)
          ) {
            setPreview((prev) => ({
              ...prev,
              ...(!hasPendingText && ws.previewText !== undefined ? { text: ws.previewText } : {}),
              ...(!hasPendingSize && ws.previewFontSize !== undefined ? { fontSize: ws.previewFontSize } : {}),
            }));
          }
          if (ws.compareIds) setCompareIds(ws.compareIds);
          setCloudSynced(true);
        },
        onLibraries: (cloudLibs) => {
          if (cloudLibs.length === 0) return;
          setLibraries((prev) => {
            const base = prev.filter((l) => l.id === 'lib-google' || l.id === 'lib-local');
            const custom = cloudLibs.filter((l) => l.id !== 'lib-google' && l.id !== 'lib-local');
            return [...base, ...custom];
          });
        },
        onFontLists: (cloudLists) => setFontLists(cloudLists),
        onSmartLists: (cloudSmart) => {
          if (cloudSmart.length > 0) setSmartLists(cloudSmart);
        },
        onFontMeta: (cloudMeta) => setFontMeta(cloudMeta),
        onAdobeKits: (kits) => setAdobeKits(kits),
      });
    })();

    return () => {
      active = false;
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user?.uid]);

  // Apply theme class immediately and debounce localStorage serialization (300ms)
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const persist = () => {
      try {
        const state: LocalPersistedState = {
          customFonts: customFonts.slice(0, 500),
          libraries,
          fontLists,
          smartLists,
          adobeKits,
          fontMeta,
          appIntegrations,
          preview,
          theme,
          compareIds,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore storage quota
      }
    };

    const timer = window.setTimeout(persist, 300);
    const onPageHide = () => {
      window.clearTimeout(timer);
      persist();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [
    customFonts,
    libraries,
    fontLists,
    smartLists,
    adobeKits,
    fontMeta,
    appIntegrations,
    preview,
    theme,
    compareIds,
  ]);

  // Merge all real font sources + apply per-user metadata overrides (starred, activated, tags, notes)
  const fonts: FontFamily[] = useMemo(() => {
    const combined = [...customFonts, ...adobeFonts, ...googleFonts];
    return combined.map((font) => {
      const override = fontMeta[font.id];
      if (!override) return font;
      return {
        ...font,
        starred: override.starred,
        activated: override.activated,
        tags: override.tags.length > 0 ? override.tags : font.tags,
        notes: override.notes || font.notes,
        styles: font.styles.map((s) => ({ ...s, activated: override.activated })),
      };
    });
  }, [customFonts, adobeFonts, googleFonts, fontMeta]);

  // Auto-select first available font for the inspector
  useEffect(() => {
    if (!selectedFontId && fonts.length > 0) {
      setSelectedFontId(fonts[0].id);
    }
  }, [fonts, selectedFontId]);

  const handleSignInGoogle = useCallback(async () => {
    try {
      const res = await signInWithGoogle(true);
      if (res.redirected || !res.user) {
        showToast('Redirecting to Google sign-in…');
        return res;
      }
      setUser(res.user);
      setHasDriveToken(Boolean(res.accessToken));
      showToast(`Signed in as ${res.user.displayName || res.user.email} — Cloud sync & Google Drive ready`);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      showToast(msg);
      throw err;
    }
  }, [showToast]);

  const handleSignOut = useCallback(async () => {
    flushPendingCloudWrites();
    clearFirestoreKnownCache(user?.uid);
    await signOutGoogle();
    setUser(null);
    setHasDriveToken(false);
    setCloudSynced(false);
    showToast('Signed out — local mode active');
  }, [flushPendingCloudWrites, showToast, user?.uid]);

  const invalidateDriveToken = useCallback(() => {
    clearGoogleDriveAccessToken();
    setHasDriveToken(false);
  }, []);

  const navigate = useCallback(
    (dest: SidebarDestination) => {
      setDestinationState(dest);
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, dest];
      });
      setHistoryIndex((i) => i + 1);
      setCheckedFontIds([]);
      if (viewMode === 'compare') setViewMode('list');
    },
    [historyIndex, viewMode],
  );

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIdx = historyIndex - 1;
    setHistoryIndex(nextIdx);
    setDestinationState(history[nextIdx]);
  }, [history, historyIndex]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIdx = historyIndex + 1;
    setHistoryIndex(nextIdx);
    setDestinationState(history[nextIdx]);
  }, [history, historyIndex]);

  const visibleFonts = useMemo(
    () => applyFontFilters(fonts, destination, filters, fontLists, smartLists),
    [fonts, destination, filters, fontLists, smartLists],
  );

  const selectedFont = useMemo(
    () => fonts.find((f) => f.id === selectedFontId) ?? visibleFonts[0] ?? null,
    [fonts, selectedFontId, visibleFonts],
  );

  const duplicateGroups = useMemo(() => findDuplicateFonts(fonts), [fonts]);

  const compareFonts = useMemo(
    () => compareIds.map((id) => fonts.find((f) => f.id === id)).filter((f): f is FontFamily => Boolean(f)),
    [compareIds, fonts],
  );

  const sidebarCounts = useMemo(() => {
    const libraryCounts: Record<string, number> = {};
    for (const lib of libraries) libraryCounts[lib.id] = 0;
    let activated = 0;
    let deactivated = 0;
    let starred = 0;
    let recent = 0;

    for (const f of fonts) {
      if (f.activated) activated += 1;
      else deactivated += 1;
      if (f.starred) starred += 1;
      if (isRecentFont(f)) recent += 1;
      libraryCounts[f.libraryId] = (libraryCounts[f.libraryId] ?? 0) + 1;
    }

    const listCounts: Record<string, number> = {};
    const fontIdSet = new Set(fonts.map((f) => f.id));
    for (const l of fontLists) {
      listCounts[l.id] = l.fontIds.filter((id) => fontIdSet.has(id)).length;
    }

    const smartCounts: Record<string, number> = {};
    for (const s of smartLists) {
      smartCounts[s.id] = fonts.filter((f) => matchesSmartList(f, s)).length;
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

  // Helper to update per-user font metadata & sync to Firestore if signed in
  const updateFontUserMeta = useCallback(
    (fontId: string, updater: (cur: CloudFontMeta, base?: FontFamily) => CloudFontMeta) => {
      const base = fonts.find((f) => f.id === fontId);
      setFontMeta((prev) => {
        const cur: CloudFontMeta = prev[fontId] ?? {
          fontId,
          starred: base?.starred ?? false,
          activated: base?.activated ?? false,
          tags: base?.tags ?? [],
          notes: base?.notes ?? '',
        };
        const next = updater(cur, base);
        if (user) {
          void saveFontMetaDoc(user.uid, next);
        }
        return { ...prev, [fontId]: next };
      });
    },
    [fonts, user],
  );

  const toggleFontActivation = useCallback(
    (fontId: string) => {
      updateFontUserMeta(fontId, (cur) => {
        const nextActive = !cur.activated;
        showToast(nextActive ? 'Font activated' : 'Font deactivated');
        return { ...cur, activated: nextActive };
      });
    },
    [updateFontUserMeta, showToast],
  );

  const toggleStyleActivation = useCallback(
    (fontId: string, _styleId: string) => {
      toggleFontActivation(fontId);
    },
    [toggleFontActivation],
  );

  const batchSetActivation = useCallback(
    (ids: string[], activated: boolean) => {
      if (ids.length === 0) return;
      const uniqueIds = Array.from(new Set(ids));
      const fontMap = new Map(fonts.map((f) => [f.id, f]));
      const currentMeta = fontMetaRef.current;
      const updatedBatch: CloudFontMeta[] = uniqueIds.map((fontId) => {
        const base = fontMap.get(fontId);
        const cur: CloudFontMeta = currentMeta[fontId] ?? {
          fontId,
          starred: base?.starred ?? false,
          activated: base?.activated ?? false,
          tags: base?.tags ?? [],
          notes: base?.notes ?? '',
        };
        return { ...cur, activated };
      });

      setFontMeta((prev) => {
        const nextMap = { ...prev };
        for (const item of updatedBatch) {
          nextMap[item.fontId] = item;
        }
        return nextMap;
      });

      if (user && updatedBatch.length > 0) {
        void saveFontMetaBatch(user.uid, updatedBatch);
      }
      showToast(
        `${activated ? 'Activated' : 'Deactivated'} ${uniqueIds.length} font ${uniqueIds.length === 1 ? 'family' : 'families'}`,
      );
    },
    [fonts, user, showToast],
  );

  const toggleStar = useCallback(
    (fontId: string) => {
      updateFontUserMeta(fontId, (cur) => ({ ...cur, starred: !cur.starred }));
    },
    [updateFontUserMeta],
  );

  const addTagToFont = useCallback(
    (fontId: string, rawTag: string) => {
      const tag = rawTag.trim().toLowerCase().replace(/^#/, '');
      if (!tag) return;
      updateFontUserMeta(fontId, (cur) => ({
        ...cur,
        tags: cur.tags.includes(tag) ? cur.tags : [...cur.tags, tag].slice(0, 20),
      }));
    },
    [updateFontUserMeta],
  );

  const removeTagFromFont = useCallback(
    (fontId: string, tag: string) => {
      updateFontUserMeta(fontId, (cur) => ({
        ...cur,
        tags: cur.tags.filter((t) => t !== tag),
      }));
    },
    [updateFontUserMeta],
  );

  const updateFontNotes = useCallback(
    (fontId: string, notes: string) => {
      const clamped = notes.slice(0, 2000);
      const base = fonts.find((f) => f.id === fontId);
      setFontMeta((prev) => {
        const cur: CloudFontMeta = prev[fontId] ?? {
          fontId,
          starred: base?.starred ?? false,
          activated: base?.activated ?? false,
          tags: base?.tags ?? [],
          notes: base?.notes ?? '',
        };
        const next: CloudFontMeta = { ...cur, notes: clamped };
        if (user) {
          pendingNotesRef.current.set(fontId, next);
          const existingTimer = notesTimersRef.current.get(fontId);
          if (existingTimer !== undefined) window.clearTimeout(existingTimer);
          const timer = window.setTimeout(() => {
            notesTimersRef.current.delete(fontId);
            const latest = pendingNotesRef.current.get(fontId);
            pendingNotesRef.current.delete(fontId);
            if (latest && userRef.current) {
              void saveFontMetaDoc(userRef.current.uid, latest);
            }
          }, 600);
          notesTimersRef.current.set(fontId, timer);
        }
        return { ...prev, [fontId]: next };
      });
    },
    [fonts, user],
  );

  const removeFontFamily = useCallback(
    (fontId: string) => {
      setCustomFonts((prev) => prev.filter((f) => f.id !== fontId));
      setAdobeFonts((prev) => prev.filter((f) => f.id !== fontId));
      setFontLists((prev) =>
        prev.map((l) => {
          const next = { ...l, fontIds: l.fontIds.filter((id) => id !== fontId) };
          if (user && next.fontIds.length !== l.fontIds.length) void saveFontListDoc(user.uid, next);
          return next;
        }),
      );
      setCompareIds((prev) => prev.filter((id) => id !== fontId));
      setCheckedFontIds((prev) => prev.filter((id) => id !== fontId));
      void deleteStoredFontBuffer(fontId);
      showToast('Removed font family');
    },
    [showToast, user],
  );

  // Font Lists
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
      if (user) void saveFontListDoc(user.uid, newList);
      navigate({ type: 'list', id: newList.id });
      showToast(`Created Font List "${trimmed}"`);
    },
    [navigate, showToast, user],
  );

  const deleteFontList = useCallback(
    (listId: string) => {
      setFontLists((prev) => prev.filter((l) => l.id !== listId));
      if (user) void deleteFontListDoc(user.uid, listId);
      if (destination.type === 'list' && destination.id === listId) {
        navigate({ type: 'all' });
      }
      showToast('Deleted Font List');
    },
    [destination, navigate, showToast, user],
  );

  const addFontsToList = useCallback(
    (listId: string, ids: string[]) => {
      setFontLists((prev) =>
        prev.map((l) => {
          if (l.id !== listId) return l;
          const merged = Array.from(new Set([...l.fontIds, ...ids]));
          const next = { ...l, fontIds: merged };
          if (user) void saveFontListDoc(user.uid, next);
          return next;
        }),
      );
      const target = fontLists.find((l) => l.id === listId);
      showToast(`Added ${ids.length} ${ids.length === 1 ? 'font' : 'fonts'} to "${target?.name ?? 'list'}"`);
    },
    [fontLists, showToast, user],
  );

  const activateAllInList = useCallback(
    (listId: string, active: boolean) => {
      const list = fontLists.find((l) => l.id === listId);
      if (!list) return;
      batchSetActivation(list.fontIds, active);
    },
    [fontLists, batchSetActivation],
  );

  // Smart Lists
  const createSmartList = useCallback(
    (smart: Omit<SmartList, 'id'>) => {
      const created: SmartList = { ...smart, id: `smart-${Date.now()}` };
      setSmartLists((prev) => [...prev, created]);
      if (user) void saveSmartListDoc(user.uid, created);
      navigate({ type: 'smart', id: created.id });
      showToast(`Created Smart List "${created.name}"`);
    },
    [navigate, showToast, user],
  );

  const deleteSmartList = useCallback(
    (smartId: string) => {
      setSmartLists((prev) => prev.filter((s) => s.id !== smartId));
      if (user) void deleteSmartListDoc(user.uid, smartId);
      if (destination.type === 'smart' && destination.id === smartId) {
        navigate({ type: 'all' });
      }
      showToast('Deleted Smart List');
    },
    [destination, navigate, showToast, user],
  );

  // Real Library Connections
  const ensureLibraryExists = useCallback(
    (lib: FontLibrary) => {
      setLibraries((prev) => {
        const exists = prev.some((l) => l.id === lib.id);
        const next = exists
          ? prev.map((l) => (l.id === lib.id ? { ...l, ...lib } : l))
          : [...prev, lib];
        return next;
      });
      if (user && lib.id !== 'lib-google' && lib.id !== 'lib-local') {
        void saveLibraryDoc(user.uid, lib);
      }
    },
    [user],
  );

  const addLibrary = useCallback(
    (name: string, provider: LibraryProvider, path: string) => {
      const lib: FontLibrary = {
        id: `lib-${provider}-${Date.now()}`,
        name: name.trim() || 'Connected Library',
        provider,
        path: path.trim() || 'Connected',
        syncedAt: new Date().toISOString(),
        autoSync: true,
      };
      ensureLibraryExists(lib);
      navigate({ type: 'library', id: lib.id });
      showToast(`Connected library "${lib.name}"`);
      return lib;
    },
    [ensureLibraryExists, navigate, showToast],
  );

  // REAL Adobe Fonts Web Project Connection
  const connectAdobeKit = useCallback(
    async (rawKitId: string, customName?: string) => {
      const cleanPreview = rawKitId.trim();
      const tempLibId = `lib-adobe-${cleanPreview.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`;
      const res = await fetchAdobeFontsKit(rawKitId, tempLibId);
      const libId = `lib-adobe-${res.kitId}`;
      const fixedFonts = res.fonts.map((f) => ({ ...f, libraryId: libId }));

      const lib: FontLibrary = {
        id: libId,
        name: customName?.trim() || `Adobe Fonts (${res.kitId})`,
        provider: 'adobe',
        path: res.cssUrl,
        remoteId: res.kitId,
        syncedAt: new Date().toISOString(),
        autoSync: true,
      };
      ensureLibraryExists(lib);

      const kitRec: AdobeKitRecord = {
        kitId: res.kitId,
        name: lib.name,
        familyCount: fixedFonts.length,
      };
      hydratedKitsRef.current.add(res.kitId);
      setAdobeKits((prev) => [...prev.filter((k) => k.kitId !== res.kitId), kitRec]);
      setAdobeFonts((prev) => [...fixedFonts, ...prev.filter((f) => f.adobeKitId !== res.kitId)]);
      if (user) void saveAdobeKitDoc(user.uid, kitRec);

      navigate({ type: 'library', id: libId });
      showToast(`Connected Adobe Fonts project "${res.kitId}" (${fixedFonts.length} families)`);
      return fixedFonts.length;
    },
    [ensureLibraryExists, navigate, showToast, user],
  );

  const removeAdobeKit = useCallback(
    (kitId: string) => {
      const libId = `lib-adobe-${kitId}`;
      hydratedKitsRef.current.delete(kitId);
      setAdobeKits((prev) => prev.filter((k) => k.kitId !== kitId));
      setAdobeFonts((prev) => prev.filter((f) => f.adobeKitId !== kitId));
      setLibraries((prev) => prev.filter((l) => l.id !== libId));
      if (user) {
        void deleteAdobeKitDoc(user.uid, kitId);
        void deleteLibraryDoc(user.uid, libId);
      }
      if (destination.type === 'library' && destination.id === libId) {
        navigate({ type: 'all' });
      }
      showToast(`Disconnected Adobe Fonts project "${kitId}"`);
    },
    [destination, navigate, showToast, user],
  );

  // REAL Google Drive Import (bounded concurrency + automatic expired-token handling)
  const importGoogleDriveFiles = useCallback(
    async (files: RemoteFontFile[]) => {
      const token = getGoogleDriveAccessToken();
      if (!token) throw new DriveAuthExpiredError('Sign in with Google to access Google Drive.');

      const libId = 'lib-gdrive';
      ensureLibraryExists({
        id: libId,
        name: 'Google Drive',
        provider: 'gdrive',
        path: 'drive.google.com',
        syncedAt: new Date().toISOString(),
        autoSync: true,
      });

      const imported: FontFamily[] = [];
      const CONCURRENCY = 4;
      let cursor = 0;
      let authError: DriveAuthExpiredError | null = null;

      async function worker() {
        while (cursor < files.length && !authError) {
          const idx = cursor++;
          const file = files[idx];
          try {
            const family = await downloadGoogleDriveFont(token!, file, libId);
            imported.push(family);
          } catch (err) {
            if (err instanceof DriveAuthExpiredError) {
              authError = err;
              return;
            }
            // continue loading remaining valid font files
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()),
      );

      if (authError) {
        invalidateDriveToken();
        throw authError;
      }

      if (imported.length > 0) {
        setCustomFonts((prev) => [...imported, ...prev]);
        setSelectedFontId(imported[0].id);
        navigate({ type: 'library', id: libId });
        showToast(`Loaded ${imported.length} real font ${imported.length === 1 ? 'file' : 'files'} from Google Drive`);
      }
      return imported.length;
    },
    [ensureLibraryExists, invalidateDriveToken, navigate, showToast],
  );

  // REAL Local Mac / OS System Fonts Scan (queryLocalFonts)
  const scanSystemFonts = useCallback(async () => {
    const libId = 'lib-system-os';
    const detected = await scanSystemLocalFonts(libId);
    ensureLibraryExists({
      id: libId,
      name: 'System Fonts',
      provider: 'local',
      path: 'OS Installed Fonts',
      syncedAt: new Date().toISOString(),
      autoSync: false,
    });
    setCustomFonts((prev) => [...detected, ...prev.filter((f) => f.libraryId !== libId)]);
    if (detected.length > 0) setSelectedFontId(detected[0].id);
    navigate({ type: 'library', id: libId });
    showToast(`Loaded ${detected.length} installed system font families`);
    return detected.length;
  }, [ensureLibraryExists, navigate, showToast]);

  // REAL Folder Scan (iCloud Drive, Box Drive, ~/Library/Fonts)
  const connectLocalFolder = useCallback(
    async (provider: LibraryProvider, label: string) => {
      const libId = `lib-${provider}-${Date.now()}`;
      const { folderName, fonts: scanned } = await scanLocalDirectoryFonts(libId, label);
      ensureLibraryExists({
        id: libId,
        name: `${label} — ${folderName}`,
        provider,
        path: folderName,
        syncedAt: new Date().toISOString(),
        autoSync: false,
      });
      if (scanned.length > 0) {
        setCustomFonts((prev) => [...scanned, ...prev]);
        setSelectedFontId(scanned[0].id);
        navigate({ type: 'library', id: libId });
        showToast(`Loaded ${scanned.length} font ${scanned.length === 1 ? 'file' : 'files'} from ${folderName}`);
      } else {
        showToast(`No .ttf, .otf, .woff, or .woff2 files found in "${folderName}"`);
      }
      return scanned.length;
    },
    [ensureLibraryExists, navigate, showToast],
  );

  const syncLibrary = useCallback(
    (libraryId: string) => {
      if (libraryId === 'lib-google') {
        void refreshGoogleFonts(false);
        return;
      }
      const lib = libraries.find((l) => l.id === libraryId);
      if (lib?.provider === 'adobe' && lib.remoteId) {
        void connectAdobeKit(lib.remoteId, lib.name).catch((err) => {
          showToast(err instanceof Error ? err.message : 'Adobe kit refresh failed');
        });
        return;
      }
      setLibraries((prev) =>
        prev.map((l) => (l.id === libraryId ? { ...l, syncedAt: new Date().toISOString() } : l)),
      );
      showToast(`Refreshed "${lib?.name ?? 'Library'}"`);
    },
    [libraries, refreshGoogleFonts, connectAdobeKit, showToast],
  );

  const importLocalFonts = useCallback(
    async (files: FileList | File[], targetLibraryId = 'lib-local') => {
      const fileArray = Array.from(files).filter((f) => /\.(ttf|otf|woff2?)$/i.test(f.name));
      if (fileArray.length === 0) {
        showToast('Select .ttf, .otf, .woff, or .woff2 font files');
        return 0;
      }
      const imported: FontFamily[] = [];
      for (const file of fileArray) {
        try {
          const family = await importLocalFontFile(file, targetLibraryId);
          imported.push(family);
        } catch {
          showToast(`Could not load ${file.name}`);
        }
      }
      if (imported.length > 0) {
        setCustomFonts((prev) => [...imported, ...prev]);
        setSelectedFontId(imported[0].id);
        showToast(`Imported ${imported.length} real font ${imported.length === 1 ? 'file' : 'files'}`);
      }
      return imported.length;
    },
    [showToast],
  );

  const toggleCompare = useCallback(
    (fontId: string) => {
      setCompareIds((prev) => {
        const next = prev.includes(fontId)
          ? prev.filter((id) => id !== fontId)
          : prev.length >= 6
            ? prev
            : [...prev, fontId];
        if (prev.length >= 6 && !prev.includes(fontId)) {
          showToast('Compare supports up to 6 fonts at once');
          return prev;
        }
        if (user) void saveUserWorkspacePatch(user.uid, { compareIds: next });
        return next;
      });
    },
    [showToast, user],
  );

  const compareFontPair = useCallback(
    (primaryFontId: string, secondaryFontId: string) => {
      const pair = Array.from(new Set([primaryFontId, secondaryFontId]));
      setCompareIds((prev) => {
        const merged = Array.from(new Set([...pair, ...prev])).slice(0, 6);
        if (user) void saveUserWorkspacePatch(user.uid, { compareIds: merged });
        return merged;
      });
      setViewMode('compare');
      showToast('Opened pairing in Compare View');
    },
    [showToast, user],
  );

  const toggleCheckedFont = useCallback((fontId: string) => {
    setCheckedFontIds((prev) =>
      prev.includes(fontId) ? prev.filter((id) => id !== fontId) : [...prev, fontId],
    );
  }, []);

  const clearCheckedFonts = useCallback(() => setCheckedFontIds([]), []);

  const toggleAppAutoActivate = useCallback((appId: string) => {
    setAppIntegrations((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, autoActivate: !a.autoActivate } : a)),
    );
  }, []);

  const applyFontToApp = useCallback(
    (appId: string, font: FontFamily) => {
      const target = appIntegrations.find((a) => a.id === appId);
      setAppIntegrations((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, lastAppliedFont: font.name } : a)),
      );
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(`font-family: ${font.cssFamily};`);
      }
      showToast(`Copied "${font.name}" CSS for ${target?.name ?? 'app'}`);
    },
    [appIntegrations, showToast],
  );

  const updatePreview = useCallback(
    (patch: Partial<PreviewSettings>) => {
      setPreview((prev) => {
        const next = { ...prev, ...patch };
        if (user && (patch.text !== undefined || patch.fontSize !== undefined)) {
          if (patch.text !== undefined) pendingWorkspacePatchRef.current.previewText = patch.text;
          if (patch.fontSize !== undefined) pendingWorkspacePatchRef.current.previewFontSize = patch.fontSize;
          if (workspacePatchTimerRef.current !== null) {
            window.clearTimeout(workspacePatchTimerRef.current);
          }
          workspacePatchTimerRef.current = window.setTimeout(() => {
            workspacePatchTimerRef.current = null;
            const pending = pendingWorkspacePatchRef.current;
            pendingWorkspacePatchRef.current = {};
            if (
              userRef.current &&
              (pending.previewText !== undefined || pending.previewFontSize !== undefined)
            ) {
              void saveUserWorkspacePatch(userRef.current.uid, pending);
            }
          }, 600);
        }
        return next;
      });
    },
    [user],
  );

  const updateOpenType = useCallback((patch: Partial<PreviewSettings['openType']>) => {
    setPreview((prev) => ({ ...prev, openType: { ...prev.openType, ...patch } }));
  }, []);

  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
  }, []);

  const handleSetTheme = useCallback(
    (nextTheme: ThemeMode) => {
      setTheme(nextTheme);
      if (user) void saveUserWorkspacePatch(user.uid, { theme: nextTheme });
    },
    [user],
  );

  const resetAllData = useCallback(() => {
    setCustomFonts([]);
    setAdobeFonts([]);
    setAdobeKits([]);
    setLibraries(INITIAL_LIBRARIES);
    setFontLists([]);
    setSmartLists(INITIAL_SMART_LISTS);
    setFontMeta({});
    setPreview(DEFAULT_PREVIEW_SETTINGS);
    setCompareIds([]);
    setFilters(DEFAULT_FILTER_STATE);
    setDestinationState({ type: 'all' });
    window.localStorage.removeItem(STORAGE_KEY);
    showToast('Cleared local workspace cache');
  }, [showToast]);

  return {
    // Auth & Sync
    user,
    authReady,
    hasDriveToken,
    cloudSynced,
    signInWithGoogle: handleSignInGoogle,
    signOut: handleSignOut,
    invalidateDriveToken,
    // Live Sources
    googleLoading,
    googleError,
    googleTotal,
    adobeKits,
    refreshGoogleFonts,
    connectAdobeKit,
    removeAdobeKit,
    importGoogleDriveFiles,
    scanSystemFonts,
    connectLocalFolder,
    // Core Workspace
    fonts,
    visibleFonts,
    libraries,
    fontLists,
    smartLists,
    appIntegrations,
    preview,
    theme,
    setTheme: handleSetTheme,
    destination,
    navigate,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    viewMode,
    setViewMode,
    filters,
    updateFilters,
    resetFilters,
    selectedFont,
    selectedFontId,
    setSelectedFontId,
    checkedFontIds,
    toggleCheckedFont,
    clearCheckedFonts,
    compareIds,
    compareFonts,
    toggleCompare,
    compareFontPair,
    duplicateGroups,
    sidebarCounts,
    toast,
    showToast,
    toggleFontActivation,
    toggleStyleActivation,
    batchSetActivation,
    toggleStar,
    addTagToFont,
    removeTagFromFont,
    updateFontNotes,
    removeFontFamily,
    createFontList,
    deleteFontList,
    addFontsToList,
    activateAllInList,
    createSmartList,
    deleteSmartList,
    addLibrary,
    syncLibrary,
    importLocalFonts,
    toggleAppAutoActivate,
    applyFontToApp,
    updatePreview,
    updateOpenType,
    resetAllData,
  };
}
