import opentype from 'opentype.js';
import { isTauriDesktop, scanSystemFontsNative } from '../services/desktopFontActivator';
import type { FontClassification, FontFamily, FontFormat, FontStyleVariant } from '../types/font';

const DB_NAME = 'fontainer-font-store';
const STORE_NAME = 'uploaded-fonts';
const DB_VERSION = 1;

const FONT_FILE_RE = /\.(ttf|otf|woff2?)$/i;
const loadedGoogleFamilies = new Set<string>();
const loadedFontshareSlugs = new Set<string>();
const loadedRemoteUrls = new Set<string>();
const loadedAdobeKits = new Set<string>();
const loadedCustomFontIds = new Set<string>();

export interface StoredFontBlob {
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

export async function getStoredFontBuffer(id: string): Promise<StoredFontBlob | null> {
  try {
    const db = await openFontDb();
    return await new Promise<StoredFontBlob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as StoredFontBlob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
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

/** Lazily loads a single custom/Drive font preview from IndexedDB only when visible in viewport */
export async function ensureCustomFontLoaded(fontId: string, familyName: string): Promise<void> {
  if (typeof window === 'undefined' || typeof FontFace === 'undefined') return;
  if (loadedCustomFontIds.has(fontId)) return;
  loadedCustomFontIds.add(fontId);

  try {
    const rec = await getStoredFontBuffer(fontId);
    if (!rec) return;
    const face = new FontFace(familyName || rec.familyName, rec.buffer);
    const loaded = await face.load();
    document.fonts.add(loaded);
  } catch {
    // Non-fatal if preview binary isn't cached in IndexedDB (e.g. OS-activated directly by Rust)
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

    // Only eagerly hydrate up to 30 fonts on startup; larger libraries lazy-load as rows enter view
    for (const rec of records.slice(0, 30)) {
      if (loadedCustomFontIds.has(rec.id)) continue;
      loadedCustomFontIds.add(rec.id);
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

/** Dynamically inject a real Google Fonts CSS2 stylesheet for a visible family */
export function ensureGoogleFontLoaded(familyName: string, styles?: FontStyleVariant[]): void {
  if (typeof document === 'undefined' || !familyName) return;
  const key = familyName.trim();
  if (loadedGoogleFamilies.has(key)) return;
  loadedGoogleFamilies.add(key);

  const weights = styles && styles.length > 0
    ? Array.from(new Set(styles.map((s) => s.weight))).sort((a, b) => a - b)
    : [400, 700];
  const hasItalic = styles?.some((s) => s.italic) ?? false;

  const encoded = encodeURIComponent(key).replace(/%20/g, '+');
  const query = hasItalic
    ? `family=${encoded}:ital,wght@${weights.map((w) => `0,${w}`).concat(weights.slice(0, 3).map((w) => `1,${w}`)).join(';')}`
    : `family=${encoded}:wght@${weights.join(';')}`;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  link.dataset.fontainerGfont = key;
  document.head.appendChild(link);
}

/** Dynamically inject a real Fontshare CSS stylesheet on demand */
export function ensureFontshareFontLoaded(slug: string, styles?: FontStyleVariant[]): void {
  if (typeof document === 'undefined' || !slug) return;
  const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!clean || loadedFontshareSlugs.has(clean)) return;
  loadedFontshareSlugs.add(clean);

  const weights =
    styles && styles.length > 0
      ? Array.from(new Set(styles.map((s) => s.weight))).sort((a, b) => a - b)
      : [400, 700];
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://api.fontshare.com/v2/css?f[]=${encodeURIComponent(clean)}@${weights.join(',')}&display=swap`;
  link.dataset.fontainerFontshare = clean;
  document.head.appendChild(link);
}

/** Dynamically load a remote open-source CDN font (Collletttivo / UNCUT / Open Foundry / GitHub) via FontFace */
export async function ensureRemoteFontLoaded(familyName: string, url: string): Promise<void> {
  if (typeof window === 'undefined' || typeof FontFace === 'undefined' || !url || !familyName) return;
  const key = `${familyName}::${url}`;
  if (loadedRemoteUrls.has(key)) return;
  loadedRemoteUrls.add(key);

  try {
    const face = new FontFace(familyName, `url(${url})`);
    const loaded = await face.load();
    document.fonts.add(loaded);
  } catch {
    // Non-fatal if CDN asset is temporarily unavailable
  }
}

/** Dynamically inject a real Adobe Fonts (Typekit) stylesheet */
export function ensureAdobeKitStylesheet(kitId: string): void {
  if (typeof document === 'undefined' || !/^[a-zA-Z0-9]{4,20}$/.test(kitId)) return;
  if (loadedAdobeKits.has(kitId)) return;
  loadedAdobeKits.add(kitId);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://use.typekit.net/${kitId}.css`;
  link.dataset.fontainerAdobeKit = kitId;
  document.head.appendChild(link);
}

function inferFormat(fileName: string): FontFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.otf')) return 'OTF';
  if (lower.endsWith('.woff2') || lower.endsWith('.woff')) return 'WOFF2';
  return 'TTF';
}

function cleanFontName(fileName: string): string {
  const base = fileName.replace(/\.(ttf|otf|woff2?|ttc)$/i, '');
  return (
    base
      .replace(/[-_]+/g, ' ')
      .replace(/\b(regular|bold|italic|light|medium|semibold|variable|vf)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || base
  );
}

function inferClassificationFromName(name: string, isMonospace: boolean): FontClassification {
  if (isMonospace) return 'Monospace';
  const lower = name.toLowerCase();
  if (lower.includes('mono') || lower.includes('code') || lower.includes('courier')) return 'Monospace';
  if (lower.includes('slab')) return 'Slab Serif';
  if (lower.includes('script') || lower.includes('brush') || lower.includes('callig')) return 'Script';
  if (lower.includes('hand') || lower.includes('caveat')) return 'Handwritten';
  if (lower.includes('serif') || lower.includes('garamond') || lower.includes('bodoni') || lower.includes('baskerville') || lower.includes('times')) {
    return 'Serif';
  }
  if (lower.includes('display') || lower.includes('poster') || lower.includes('condensed')) return 'Display';
  return 'Sans Serif';
}

function readNameEntry(
  names: opentype.FontNames | undefined,
  key: string,
): string {
  const map = names as Record<string, unknown> | undefined;
  const entry = map?.[key];
  if (!entry || typeof entry !== 'object') return '';
  const record = entry as Record<string, string>;
  return (record.en || Object.values(record)[0] || '').trim();
}

export async function parseAndLoadFontBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  targetLibraryId: string,
  options?: {
    id?: string;
    driveFileId?: string;
    sourceLabel?: string;
    sourcePath?: string;
    extraTags?: string[];
  },
): Promise<FontFamily> {
  const format = inferFormat(fileName);
  const id = options?.id || `font-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let familyName = cleanFontName(fileName);
  let styleName = /italic/i.test(fileName) ? 'Italic' : 'Regular';
  let weight = /bold/i.test(fileName) ? 700 : /light/i.test(fileName) ? 300 : /medium/i.test(fileName) ? 500 : 400;
  let italic = /italic/i.test(fileName);
  let foundry = options?.sourceLabel || 'Local Font File';
  let designer = 'Embedded OpenType Metadata';
  let license = 'User Licensed Font';
  let version = '1.000';
  let postScriptName = `${familyName.replace(/\s+/g, '')}-${styleName}`;
  let isVariable = /variable|vf/i.test(fileName);
  let openTypeFeatures: string[] = [];
  let customGlyphs: string[] | undefined;
  let isMonospace = false;

  // Parse real OpenType/TrueType binary tables via opentype.js (for .ttf, .otf, .woff)
  if (!fileName.toLowerCase().endsWith('.woff2')) {
    try {
      const parsed = opentype.parse(buffer.slice(0));
      const names = parsed.names;
      const prefFamily = readNameEntry(names, 'preferredFamily') || readNameEntry(names, 'fontFamily');
      const prefSub = readNameEntry(names, 'preferredSubfamily') || readNameEntry(names, 'fontSubfamily');
      const mfg = readNameEntry(names, 'manufacturer');
      const des = readNameEntry(names, 'designer');
      const lic = readNameEntry(names, 'license') || readNameEntry(names, 'copyright');
      const ver = readNameEntry(names, 'version');
      const ps = readNameEntry(names, 'postScriptName');

      if (prefFamily) familyName = prefFamily;
      if (prefSub) styleName = prefSub;
      if (mfg) foundry = mfg;
      if (des) designer = des;
      if (lic) license = lic.slice(0, 96);
      if (ver) version = ver.replace(/^Version\s+/i, '').split(';')[0].trim() || version;
      if (ps) postScriptName = ps;

      const os2 = parsed.tables?.os2 as { usWeightClass?: number; fsSelection?: number } | undefined;
      if (os2?.usWeightClass) weight = os2.usWeightClass;
      if (os2?.fsSelection && (os2.fsSelection & 1) === 1) italic = true;

      const post = parsed.tables?.post as { isFixedPitch?: number } | undefined;
      if (post?.isFixedPitch) isMonospace = true;

      if (parsed.tables && 'fvar' in parsed.tables && parsed.tables.fvar) {
        isVariable = true;
      }

      const gsub = parsed.tables?.gsub as { features?: Array<{ tag: string }> } | undefined;
      if (gsub?.features?.length) {
        openTypeFeatures = Array.from(new Set(gsub.features.map((f) => f.tag))).slice(0, 16);
      }

      // Extract real printable Unicode glyphs directly from the font's cmap
      const glyphs: string[] = [];
      const seen = new Set<number>();
      const total = Math.min(parsed.glyphs.length, 600);
      for (let i = 0; i < total && glyphs.length < 180; i++) {
        const g = parsed.glyphs.get(i);
        if (g.unicode && g.unicode >= 33 && g.unicode <= 0x26ff && !seen.has(g.unicode)) {
          seen.add(g.unicode);
          glyphs.push(String.fromCodePoint(g.unicode));
        }
      }
      if (glyphs.length > 10) {
        customGlyphs = glyphs;
      }
    } catch {
      // Fall back to filename metadata if binary table is non-standard
    }
  }

  if (typeof FontFace !== 'undefined') {
    const face = new FontFace(familyName, buffer.slice(0), {
      weight: String(weight),
      style: italic ? 'italic' : 'normal',
    });
    const loaded = await face.load();
    document.fonts.add(loaded);
  }

  await saveFontBuffer({
    id,
    familyName,
    buffer,
    fileName,
  });

  const fileSizeKb = Math.max(8, Math.round(buffer.byteLength / 1024));
  const classification = inferClassificationFromName(familyName, isMonospace);

  return {
    id,
    name: familyName,
    cssFamily: `'${familyName}', ${classification === 'Serif' ? 'serif' : classification === 'Monospace' ? 'monospace' : 'sans-serif'}`,
    foundry,
    designer,
    classification,
    format: isVariable ? 'Variable' : format,
    width: /condensed|narrow/i.test(familyName) ? 'Condensed' : /expanded|wide/i.test(familyName) ? 'Expanded' : 'Normal',
    isVariable,
    license,
    version,
    languages: ['Latin'],
    openTypeFeatures: openTypeFeatures.length > 0 ? openTypeFeatures : ['liga', 'kern'],
    libraryId: targetLibraryId,
    addedAt: new Date().toISOString(),
    starred: false,
    activated: true,
    tags: Array.from(new Set([format.toLowerCase(), ...(options?.extraTags ?? [])])),
    notes: options?.sourcePath ? `Loaded from ${options.sourcePath}` : `Imported from ${fileName}`,
    isCustomUpload: true,
    driveFileId: options?.driveFileId,
    driveFileName: options?.driveFileId ? fileName : undefined,
    sourcePath: options?.sourcePath || fileName,
    customGlyphs,
    styles: [
      {
        id: `${id}-${weight}${italic ? 'i' : ''}`,
        name: styleName,
        weight,
        italic,
        postScriptName,
        activated: true,
        fileSizeKb,
      },
    ],
  };
}

export async function importLocalFontFile(
  file: File,
  targetLibraryId: string,
  sourcePath?: string,
): Promise<FontFamily> {
  const buffer = await file.arrayBuffer();
  return parseAndLoadFontBuffer(buffer, file.name, targetLibraryId, {
    sourceLabel: 'Local Import',
    sourcePath: sourcePath || file.name,
    extraTags: ['local'],
  });
}

/** Real System Fonts Scan: Native Rust OS scan inside Tauri desktop, or Local Font Access API on Chromium web */
export async function scanSystemLocalFonts(targetLibraryId: string): Promise<FontFamily[]> {
  if (isTauriDesktop()) {
    const nativeFonts = await scanSystemFontsNative();
    const now = new Date().toISOString();
    return nativeFonts.map((nf) => {
      const slug = `sys-${nf.family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
      const classification = inferClassificationFromName(nf.family, false);
      const format: FontFormat = nf.format === 'OTF' ? 'OTF' : 'TTF';
      return {
        id: slug,
        name: nf.family,
        cssFamily: `'${nf.family}', ${classification === 'Serif' ? 'serif' : classification === 'Monospace' ? 'monospace' : 'sans-serif'}`,
        foundry: 'Installed System Font',
        designer: 'OS System Font Catalog',
        classification,
        format,
        width: /condensed|narrow/i.test(nf.family)
          ? 'Condensed'
          : /expanded|wide/i.test(nf.family)
            ? 'Expanded'
            : 'Normal',
        isVariable: false,
        license: 'Installed OS / Local License',
        version: 'System',
        languages: ['Latin'],
        openTypeFeatures: ['liga', 'kern'],
        libraryId: targetLibraryId,
        addedAt: now,
        starred: false,
        activated: true,
        tags: ['system'],
        sourcePath: nf.sourcePath,
        notes: `Detected directly from OS Fonts (${nf.styles.length} installed ${nf.styles.length === 1 ? 'face' : 'faces'}).`,
        styles: nf.styles.map((s, idx) => ({
          id: `${slug}-${idx}`,
          name: s.name || 'Regular',
          weight: s.weight || 400,
          italic: Boolean(s.italic),
          postScriptName: s.postScriptName || `${nf.family.replace(/\s+/g, '')}-${s.name}`,
          activated: true,
          fileSizeKb: s.fileSizeKb || 0,
        })),
      };
    });
  }

  const win = window as unknown as {
    queryLocalFonts?: () => Promise<
      Array<{
        family: string;
        fullName: string;
        postscriptName: string;
        style: string;
      }>
    >;
  };

  if (typeof win.queryLocalFonts !== 'function') {
    throw new Error(
      'Local Font Access API requires Chromium-based browsers (Chrome, Edge, Brave, Arc) on desktop.',
    );
  }

  const localFonts = await win.queryLocalFonts();
  const grouped = new Map<
    string,
    Array<{ fullName: string; postscriptName: string; style: string }>
  >();

  for (const lf of localFonts) {
    if (!lf.family || lf.family.startsWith('.')) continue;
    const list = grouped.get(lf.family) ?? [];
    list.push({
      fullName: lf.fullName,
      postscriptName: lf.postscriptName,
      style: lf.style,
    });
    grouped.set(lf.family, list);
  }

  const now = new Date().toISOString();
  const families: FontFamily[] = [];

  for (const [family, entries] of grouped.entries()) {
    const slug = `sys-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const classification = inferClassificationFromName(family, false);
    const styles: FontStyleVariant[] = entries.map((e, idx) => {
      const s = e.style.toLowerCase();
      const weight = s.includes('thin')
        ? 100
        : s.includes('extralight')
          ? 200
          : s.includes('light')
            ? 300
            : s.includes('medium')
              ? 500
              : s.includes('semibold') || s.includes('demi')
                ? 600
                : s.includes('extrabold') || s.includes('heavy')
                  ? 800
                  : s.includes('black')
                    ? 900
                    : s.includes('bold')
                      ? 700
                      : 400;
      const italic = s.includes('italic') || s.includes('oblique');
      return {
        id: `${slug}-${idx}`,
        name: e.style || 'Regular',
        weight,
        italic,
        postScriptName: e.postscriptName || `${family.replace(/\s+/g, '')}-${e.style}`,
        activated: true,
        fileSizeKb: 0,
      };
    });

    families.push({
      id: slug,
      name: family,
      cssFamily: `'${family}', ${classification === 'Serif' ? 'serif' : classification === 'Monospace' ? 'monospace' : 'sans-serif'}`,
      foundry: 'Installed System Font',
      designer: 'macOS / OS System Catalog',
      classification,
      format: 'OTF',
      width: /condensed|narrow/i.test(family) ? 'Condensed' : /expanded/i.test(family) ? 'Expanded' : 'Normal',
      isVariable: false,
      license: 'Installed OS / Local License',
      version: 'System',
      languages: ['Latin'],
      openTypeFeatures: ['liga', 'kern'],
      libraryId: targetLibraryId,
      addedAt: now,
      starred: false,
      activated: true,
      tags: ['system'],
      notes: `Detected via Local Font Access API (${entries.length} installed faces).`,
      styles,
    });
  }

  return families.sort((a, b) => a.name.localeCompare(b.name));
}

function pickFolderViaFileInput(): Promise<{ folderName: string; files: Array<{ file: File; relPath: string }> }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.style.display = 'none';

    let settled = false;
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    input.onchange = () => {
      if (settled) return;
      settled = true;
      const list = Array.from(input.files ?? []);
      cleanup();
      if (list.length === 0) {
        reject(new DOMException('Folder selection cancelled', 'AbortError'));
        return;
      }
      const firstRel = (list[0] as File & { webkitRelativePath?: string }).webkitRelativePath || '';
      const folderName = firstRel.split('/')[0] || 'Selected Folder';
      const matching = list
        .filter((f) => FONT_FILE_RE.test(f.name))
        .map((file) => ({
          file,
          relPath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        }));
      resolve({ folderName, files: matching });
    };

    input.oncancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException('Folder selection cancelled', 'AbortError'));
    };

    document.body.appendChild(input);
    input.click();
  });
}

/** Real Folder scanner: uses File System Access API on Chromium, or native webkitdirectory picker on macOS Tauri / Safari / Firefox */
export async function scanLocalDirectoryFonts(
  targetLibraryId: string,
  sourceLabel: string,
  maxFiles = 120,
): Promise<{ folderName: string; fonts: FontFamily[] }> {
  const win = window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>;
  };

  let folderName = 'Local Folder';
  const collected: Array<{ file: File; relPath: string }> = [];

  if (typeof win.showDirectoryPicker === 'function') {
    const dirHandle = await win.showDirectoryPicker({ mode: 'read' });
    folderName = dirHandle.name;

    async function walk(handle: FileSystemDirectoryHandle, prefix: string) {
      if (collected.length >= maxFiles) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const [name, entry] of (handle as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
        if (collected.length >= maxFiles) break;
        if (entry.kind === 'file' && FONT_FILE_RE.test(name)) {
          const file = await (entry as FileSystemFileHandle).getFile();
          collected.push({ file, relPath: prefix ? `${prefix}/${name}` : name });
        } else if (entry.kind === 'directory' && !name.startsWith('.')) {
          await walk(entry as FileSystemDirectoryHandle, prefix ? `${prefix}/${name}` : name);
        }
      }
    }

    await walk(dirHandle, dirHandle.name);
  } else {
    const picked = await pickFolderViaFileInput();
    folderName = picked.folderName;
    collected.push(...picked.files.slice(0, maxFiles));
  }

  const fonts: FontFamily[] = [];
  for (const item of collected) {
    try {
      const buf = await item.file.arrayBuffer();
      const loaded = await parseAndLoadFontBuffer(buf, item.file.name, targetLibraryId, {
        sourceLabel,
        sourcePath: item.relPath,
        extraTags: [sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')],
      });
      fonts.push(loaded);
    } catch {
      // skip unreadable font file
    }
  }

  return { folderName, fonts };
}
