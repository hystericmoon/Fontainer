import type { FontFamily, FontFormat } from '../types/font';

const DB_NAME = 'fontainer-font-store';
const STORE_NAME = 'uploaded-fonts';
const DB_VERSION = 1;

interface StoredFontBlob {
  id: string;
  familyName: string;
  buffer: ArrayBuffer;
  fileName: string;
}

function openFontDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFontBuffer(record: StoredFontBlob): Promise<void> {
  try {
    const db = await openFontDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal in private browsing or restricted contexts
  }
}

export async function deleteStoredFontBuffer(id: string): Promise<void> {
  try {
    const db = await openFontDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function restoreUploadedFonts(): Promise<void> {
  if (typeof window === 'undefined' || typeof FontFace === 'undefined') return;
  try {
    const db = await openFontDb();
    const records = await new Promise<StoredFontBlob[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as StoredFontBlob[]);
      req.onerror = () => reject(req.error);
    });

    for (const rec of records) {
      try {
        const face = new FontFace(rec.familyName, rec.buffer);
        const loaded = await face.load();
        document.fonts.add(loaded);
      } catch {
        // skip corrupted blob
      }
    }
  } catch {
    // ignore
  }
}

function inferFormat(fileName: string): FontFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.otf')) return 'OTF';
  if (lower.endsWith('.woff2') || lower.endsWith('.woff')) return 'WOFF2';
  return 'TTF';
}

function cleanFontName(fileName: string): string {
  const base = fileName.replace(/\.(ttf|otf|woff2?|ttc)$/i, '');
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\b(regular|bold|italic|light|medium|semibold|variable|vf)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || base;
}

export async function importLocalFontFile(
  file: File,
  targetLibraryId: string,
): Promise<FontFamily> {
  const buffer = await file.arrayBuffer();
  const familyName = cleanFontName(file.name);
  const format = inferFormat(file.name);
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (typeof FontFace !== 'undefined') {
    const face = new FontFace(familyName, buffer);
    const loaded = await face.load();
    document.fonts.add(loaded);
  }

  await saveFontBuffer({
    id,
    familyName,
    buffer,
    fileName: file.name,
  });

  const fileSizeKb = Math.max(12, Math.round(file.size / 1024));
  const psName = familyName.replace(/\s+/g, '');

  return {
    id,
    name: familyName,
    cssFamily: `'${familyName}', sans-serif`,
    foundry: 'Local Import',
    designer: 'Imported Font File',
    classification: 'Sans Serif',
    format,
    width: 'Normal',
    isVariable: /variable|vf/i.test(file.name),
    license: 'Local User License',
    version: '1.000',
    languages: ['Latin'],
    openTypeFeatures: ['liga', 'tnum'],
    libraryId: targetLibraryId,
    addedAt: new Date().toISOString(),
    starred: false,
    activated: true,
    tags: ['imported', format.toLowerCase()],
    notes: `Imported from ${file.name}`,
    isCustomUpload: true,
    styles: [
      {
        id: `${id}-400`,
        name: 'Regular',
        weight: 400,
        italic: /italic/i.test(file.name),
        postScriptName: `${psName}-Regular`,
        activated: true,
        fileSizeKb,
      },
    ],
  };
}
