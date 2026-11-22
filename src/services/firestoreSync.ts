import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { AdobeKitRecord, FontLibrary, FontList, SmartList, ThemeMode } from '../types/font';
import { db, handleFirestoreError, OperationType } from './firebase';

const VALID_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return VALID_ID_RE.test(cleaned) ? cleaned : `id-${Date.now()}`;
}

function clampStr(val: string, max: number): string {
  return String(val ?? '').slice(0, max);
}

type SubCollectionKey = 'libraries' | 'fontLists' | 'smartLists' | 'fontMeta' | 'adobeKits';

// Track existing document IDs per authenticated user (populated from onSnapshot + writes)
// to avoid burning an extra getDoc() read before every updateDoc/setDoc mutation.
const knownDocsByUid = new Map<string, Record<SubCollectionKey, Set<string>>>();

function getKnownSet(uid: string, col: SubCollectionKey): Set<string> {
  let entry = knownDocsByUid.get(uid);
  if (!entry) {
    entry = {
      libraries: new Set(),
      fontLists: new Set(),
      smartLists: new Set(),
      fontMeta: new Set(),
      adobeKits: new Set(),
    };
    knownDocsByUid.set(uid, entry);
  }
  return entry[col];
}

export function clearFirestoreKnownCache(uid?: string): void {
  if (uid) {
    knownDocsByUid.delete(uid);
  } else {
    knownDocsByUid.clear();
  }
}

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code === 'not-found' || (err instanceof Error && err.message.includes('No document to update'));
}

function isPermissionDeniedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code === 'permission-denied';
}

/**
 * Upserts a subcollection document without an upfront getDoc read when the local
 * onSnapshot cache already knows whether the document exists.
 * Falls back cleanly if the remote existence state drifted.
 */
async function smartUpsertSubdoc(
  uid: string,
  col: SubCollectionKey,
  docId: string,
  updatePayload: Record<string, unknown>,
  createPayload: Record<string, unknown>,
): Promise<void> {
  const known = getKnownSet(uid, col);
  const ref = doc(db, 'users', uid, col, docId);

  if (known.has(docId)) {
    try {
      await updateDoc(ref, updatePayload);
      return;
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
      known.delete(docId);
      await setDoc(ref, createPayload);
      known.add(docId);
      return;
    }
  }

  try {
    await setDoc(ref, createPayload);
    known.add(docId);
  } catch (err) {
    // If doc already existed remotely (causing createdAt immutability denial on setDoc), update it.
    if (isPermissionDeniedError(err)) {
      await updateDoc(ref, updatePayload);
      known.add(docId);
      return;
    }
    throw err;
  }
}

export interface CloudFontMeta {
  fontId: string;
  starred: boolean;
  activated: boolean;
  tags: string[];
  notes: string;
}

export interface CloudWorkspaceSnapshot {
  theme?: ThemeMode;
  previewText?: string;
  previewFontSize?: number;
  compareIds?: string[];
}

export async function ensureUserWorkspace(
  uid: string,
  defaults: {
    displayName?: string | null;
    theme: ThemeMode;
    previewText: string;
    previewFontSize: number;
    compareIds: string[];
  },
): Promise<void> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: sanitizeId(uid),
        displayName: clampStr(defaults.displayName || 'Fontainer User', 120),
        theme: defaults.theme,
        previewText: clampStr(defaults.previewText, 300),
        previewFontSize: Math.min(120, Math.max(12, Math.round(defaults.previewFontSize))),
        compareIds: defaults.compareIds.slice(0, 12).map(sanitizeId),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveUserWorkspacePatch(
  uid: string,
  patch: Partial<{
    displayName: string;
    theme: ThemeMode;
    previewText: string;
    previewFontSize: number;
    compareIds: string[];
  }>,
): Promise<void> {
  const path = `users/${uid}`;
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.displayName !== undefined) payload.displayName = clampStr(patch.displayName, 120);
  if (patch.theme !== undefined) payload.theme = patch.theme;
  if (patch.previewText !== undefined) payload.previewText = clampStr(patch.previewText, 300);
  if (patch.previewFontSize !== undefined) {
    payload.previewFontSize = Math.min(120, Math.max(12, Math.round(patch.previewFontSize)));
  }
  if (patch.compareIds !== undefined) {
    payload.compareIds = patch.compareIds.slice(0, 12).map(sanitizeId);
  }
  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveLibraryDoc(uid: string, lib: FontLibrary): Promise<void> {
  const libId = sanitizeId(lib.id);
  const path = `users/${uid}/libraries/${libId}`;
  const baseFields = {
    name: clampStr(lib.name.trim() || 'Font Library', 120),
    path: clampStr(lib.path, 512),
    ...(lib.remoteId ? { remoteId: clampStr(lib.remoteId, 256) } : {}),
    autoSync: Boolean(lib.autoSync),
    syncedAt: clampStr(lib.syncedAt, 64),
    updatedAt: serverTimestamp(),
  };
  try {
    await smartUpsertSubdoc(uid, 'libraries', libId, baseFields, {
      id: libId,
      ownerId: uid,
      provider: lib.provider,
      ...baseFields,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteLibraryDoc(uid: string, libraryId: string): Promise<void> {
  const libId = sanitizeId(libraryId);
  const path = `users/${uid}/libraries/${libId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'libraries', libId));
    getKnownSet(uid, 'libraries').delete(libId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveFontListDoc(uid: string, list: FontList): Promise<void> {
  const listId = sanitizeId(list.id);
  const path = `users/${uid}/fontLists/${listId}`;
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(list.color) ? list.color : '#1b1b1b';
  const baseFields = {
    name: clampStr(list.name.trim() || 'Untitled List', 120),
    color: safeColor,
    fontIds: list.fontIds.slice(0, 500).map(sanitizeId),
    updatedAt: serverTimestamp(),
  };
  try {
    await smartUpsertSubdoc(uid, 'fontLists', listId, baseFields, {
      id: listId,
      ownerId: uid,
      ...baseFields,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteFontListDoc(uid: string, listId: string): Promise<void> {
  const id = sanitizeId(listId);
  const path = `users/${uid}/fontLists/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'fontLists', id));
    getKnownSet(uid, 'fontLists').delete(id);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSmartListDoc(uid: string, smart: SmartList): Promise<void> {
  const smartId = sanitizeId(smart.id);
  const path = `users/${uid}/smartLists/${smartId}`;
  const baseFields = {
    name: clampStr(smart.name.trim() || 'Smart List', 120),
    matchMode: smart.matchMode === 'any' ? 'any' : 'all',
    rules: smart.rules.slice(0, 20),
    updatedAt: serverTimestamp(),
  };
  try {
    await smartUpsertSubdoc(uid, 'smartLists', smartId, baseFields, {
      id: smartId,
      ownerId: uid,
      ...baseFields,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSmartListDoc(uid: string, smartId: string): Promise<void> {
  const id = sanitizeId(smartId);
  const path = `users/${uid}/smartLists/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'smartLists', id));
    getKnownSet(uid, 'smartLists').delete(id);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function buildFontMetaFields(meta: CloudFontMeta) {
  const safeTags = meta.tags
    .map((t) => clampStr(t.trim().toLowerCase(), 64))
    .filter(Boolean)
    .slice(0, 20);
  return {
    starred: Boolean(meta.starred),
    activated: Boolean(meta.activated),
    tags: safeTags,
    notes: clampStr(meta.notes, 2000),
    updatedAt: serverTimestamp(),
  };
}

export async function saveFontMetaDoc(uid: string, meta: CloudFontMeta): Promise<void> {
  const fid = sanitizeId(meta.fontId);
  const path = `users/${uid}/fontMeta/${fid}`;
  const baseFields = buildFontMetaFields(meta);
  try {
    await smartUpsertSubdoc(uid, 'fontMeta', fid, baseFields, {
      fontId: fid,
      ownerId: uid,
      ...baseFields,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Atomic chunked batch writer for bulk font metadata changes (e.g. bulk activate/deactivate).
 * Uses up to 450 ops per writeBatch commit (well under Firestore's 500-op ceiling).
 */
export async function saveFontMetaBatch(uid: string, items: CloudFontMeta[]): Promise<void> {
  if (items.length === 0) return;
  if (items.length === 1) {
    await saveFontMetaDoc(uid, items[0]);
    return;
  }

  const known = getKnownSet(uid, 'fontMeta');
  const CHUNK_SIZE = 450;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    const touchedIds: string[] = [];

    for (const meta of chunk) {
      const fid = sanitizeId(meta.fontId);
      touchedIds.push(fid);
      const ref = doc(db, 'users', uid, 'fontMeta', fid);
      const baseFields = buildFontMetaFields(meta);
      if (known.has(fid)) {
        batch.update(ref, baseFields);
      } else {
        batch.set(ref, {
          fontId: fid,
          ownerId: uid,
          ...baseFields,
          createdAt: serverTimestamp(),
        });
      }
    }

    try {
      await batch.commit();
      for (const fid of touchedIds) known.add(fid);
    } catch (err) {
      // If a single doc's existence state drifted out of sync with the local cache,
      // recover cleanly per document without failing the batch.
      if (isNotFoundError(err) || isPermissionDeniedError(err)) {
        await Promise.all(chunk.map((item) => saveFontMetaDoc(uid, item)));
      } else {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/fontMeta`);
      }
    }
  }
}

export async function saveAdobeKitDoc(uid: string, kit: AdobeKitRecord): Promise<void> {
  const kid = sanitizeId(kit.kitId);
  const path = `users/${uid}/adobeKits/${kid}`;
  const baseFields = {
    name: clampStr(kit.name.trim() || `Adobe Kit ${kid}`, 120),
    familyCount: Math.max(0, Math.min(500, Math.round(kit.familyCount))),
    updatedAt: serverTimestamp(),
  };
  try {
    await smartUpsertSubdoc(uid, 'adobeKits', kid, baseFields, {
      kitId: kid,
      ownerId: uid,
      ...baseFields,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAdobeKitDoc(uid: string, kitId: string): Promise<void> {
  const kid = sanitizeId(kitId);
  const path = `users/${uid}/adobeKits/${kid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'adobeKits', kid));
    getKnownSet(uid, 'adobeKits').delete(kid);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserWorkspace(
  uid: string,
  callbacks: {
    onWorkspace: (ws: CloudWorkspaceSnapshot) => void;
    onLibraries: (libs: FontLibrary[]) => void;
    onFontLists: (lists: FontList[]) => void;
    onSmartLists: (smart: SmartList[]) => void;
    onFontMeta: (metaMap: Record<string, CloudFontMeta>) => void;
    onAdobeKits: (kits: AdobeKitRecord[]) => void;
  },
): () => void {
  const unsubs: Array<() => void> = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        callbacks.onWorkspace({
          theme: d.theme as ThemeMode | undefined,
          previewText: typeof d.previewText === 'string' ? d.previewText : undefined,
          previewFontSize: typeof d.previewFontSize === 'number' ? d.previewFontSize : undefined,
          compareIds: Array.isArray(d.compareIds) ? (d.compareIds as string[]) : undefined,
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'libraries'), where('ownerId', '==', uid)),
      (snap) => {
        const known = getKnownSet(uid, 'libraries');
        known.clear();
        const libs: FontLibrary[] = snap.docs.map((d) => {
          known.add(d.id);
          const v = d.data();
          return {
            id: String(v.id || d.id),
            name: String(v.name || 'Library'),
            provider: v.provider as FontLibrary['provider'],
            path: String(v.path || ''),
            remoteId: typeof v.remoteId === 'string' ? v.remoteId : undefined,
            autoSync: Boolean(v.autoSync),
            syncedAt: typeof v.syncedAt === 'string' ? v.syncedAt : new Date().toISOString(),
          };
        });
        callbacks.onLibraries(libs);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/libraries`),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'fontLists'), where('ownerId', '==', uid)),
      (snap) => {
        const known = getKnownSet(uid, 'fontLists');
        known.clear();
        const lists: FontList[] = snap.docs.map((d) => {
          known.add(d.id);
          const v = d.data();
          return {
            id: String(v.id || d.id),
            name: String(v.name || 'Font List'),
            color: String(v.color || '#1b1b1b'),
            fontIds: Array.isArray(v.fontIds) ? (v.fontIds as string[]) : [],
            createdAt: new Date().toISOString(),
          };
        });
        callbacks.onFontLists(lists);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/fontLists`),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'smartLists'), where('ownerId', '==', uid)),
      (snap) => {
        const known = getKnownSet(uid, 'smartLists');
        known.clear();
        const smarts: SmartList[] = snap.docs.map((d) => {
          known.add(d.id);
          const v = d.data();
          return {
            id: String(v.id || d.id),
            name: String(v.name || 'Smart List'),
            matchMode: v.matchMode === 'any' ? 'any' : 'all',
            rules: Array.isArray(v.rules) ? (v.rules as SmartList['rules']) : [],
          };
        });
        callbacks.onSmartLists(smarts);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/smartLists`),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'fontMeta'), where('ownerId', '==', uid)),
      (snap) => {
        const known = getKnownSet(uid, 'fontMeta');
        known.clear();
        const map: Record<string, CloudFontMeta> = {};
        for (const d of snap.docs) {
          known.add(d.id);
          const v = d.data();
          const fid = String(v.fontId || d.id);
          map[fid] = {
            fontId: fid,
            starred: Boolean(v.starred),
            activated: Boolean(v.activated),
            tags: Array.isArray(v.tags) ? (v.tags as string[]) : [],
            notes: typeof v.notes === 'string' ? v.notes : '',
          };
        }
        callbacks.onFontMeta(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/fontMeta`),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'adobeKits'), where('ownerId', '==', uid)),
      (snap) => {
        const known = getKnownSet(uid, 'adobeKits');
        known.clear();
        const kits: AdobeKitRecord[] = snap.docs.map((d) => {
          known.add(d.id);
          const v = d.data();
          return {
            kitId: String(v.kitId || d.id),
            name: String(v.name || `Adobe Kit ${d.id}`),
            familyCount: Number(v.familyCount) || 0,
          };
        });
        callbacks.onAdobeKits(kits);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/adobeKits`),
    ),
  );

  return () => {
    for (const u of unsubs) u();
  };
}
