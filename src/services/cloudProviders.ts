import type { FontClassification, FontFamily, FontStyleVariant } from '../types/font';
import { ensureAdobeKitStylesheet, parseAndLoadFontBuffer } from '../utils/fontLoader';
import { resolveApiUrl } from '../utils/apiUrl';
import { makeDriveFontId } from './desktopFontActivator';

export interface IntegrationStatusResponse {
  googleFonts: { available: boolean; hasApiKey: boolean };
  adobeFonts: { available: boolean };
}

export interface RemoteFontFile {
  id: string;
  name: string;
  path?: string;
  size: number;
  modifiedTime?: string;
}

export async function fetchIntegrationStatus(): Promise<IntegrationStatusResponse> {
  const resp = await fetch(resolveApiUrl('/api/integrations/status'));
  if (!resp.ok) throw new Error('Unable to fetch integration status');
  return (await resp.json()) as IntegrationStatusResponse;
}

function mapGoogleCategory(cat: string): FontClassification {
  const lower = cat.toLowerCase();
  if (lower.includes('mono')) return 'Monospace';
  if (lower.includes('slab')) return 'Slab Serif';
  if (lower.includes('handwriting') || lower.includes('hand')) return 'Handwritten';
  if (lower.includes('display')) return 'Display';
  if (lower.includes('serif') && !lower.includes('sans')) return 'Serif';
  return 'Sans Serif';
}

function parseGoogleVariants(familySlug: string, familyName: string, variants: string[]): FontStyleVariant[] {
  const psBase = familyName.replace(/\s+/g, '');
  const list: FontStyleVariant[] = [];
  const seen = new Set<string>();

  for (const raw of variants) {
    const v = String(raw).toLowerCase();
    const italic = v.includes('i');
    const numeric = v.replace(/[^0-9]/g, '');
    const weight = numeric ? Math.min(900, Math.max(100, Number(numeric))) : 400;
    const key = `${weight}${italic ? 'i' : ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const weightNames: Record<number, string> = {
      100: 'Thin',
      200: 'ExtraLight',
      300: 'Light',
      400: 'Regular',
      500: 'Medium',
      600: 'SemiBold',
      700: 'Bold',
      800: 'ExtraBold',
      900: 'Black',
    };
    const wName = weightNames[weight] ?? `W${weight}`;
    const name = italic ? (weight === 400 ? 'Italic' : `${wName} Italic`) : wName;

    list.push({
      id: `${familySlug}-${key}`,
      name,
      weight,
      italic,
      postScriptName: `${psBase}-${name.replace(/\s+/g, '')}`,
      activated: false,
      fileSizeKb: 0,
    });
  }

  if (list.length === 0) {
    list.push({
      id: `${familySlug}-400`,
      name: 'Regular',
      weight: 400,
      italic: false,
      postScriptName: `${psBase}-Regular`,
      activated: false,
      fileSizeKb: 0,
    });
  }

  return list.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));
}

/** 1. Fetch LIVE Google Fonts Directory (1,700+ real families via /api/google-fonts) */
export async function fetchLiveGoogleFonts(
  libraryId: string,
  limit = 2000,
): Promise<{ total: number; source: string; fonts: FontFamily[] }> {
  const resp = await fetch(resolveApiUrl(`/api/google-fonts?limit=${limit}`));
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Google Fonts directory returned HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as {
    source: string;
    total: number;
    items: Array<{
      family: string;
      category: string;
      designer: string;
      variants: string[];
      subsets: string[];
      axes: string[];
      version: string;
      lastModified: string;
      popularity: number;
    }>;
  };

  const fonts: FontFamily[] = data.items.map((item) => {
    const slug = `gf-${item.family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const classification = mapGoogleCategory(item.category);
    const isVariable = item.axes.length > 0;
    const styles = parseGoogleVariants(slug, item.family, item.variants);
    const fallback =
      classification === 'Serif' || classification === 'Slab Serif'
        ? 'serif'
        : classification === 'Monospace'
          ? 'monospace'
          : 'sans-serif';

    return {
      id: slug,
      name: item.family,
      cssFamily: `'${item.family}', ${fallback}`,
      foundry: 'Google Fonts',
      designer: item.designer,
      classification,
      format: isVariable ? 'Variable' : 'TTF',
      width: /condensed|narrow/i.test(item.family)
        ? 'Condensed'
        : /expanded|wide/i.test(item.family)
          ? 'Expanded'
          : 'Normal',
      isVariable,
      license: 'SIL OFL 1.1 / Apache 2.0',
      version: item.version,
      languages: item.subsets.slice(0, 6).map((s) =>
        s
          .split('-')
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
          .join(' '),
      ),
      openTypeFeatures: isVariable ? ['liga', 'kern', 'tnum', ...item.axes] : ['liga', 'kern'],
      libraryId,
      addedAt: item.lastModified ? `${item.lastModified}T00:00:00Z` : new Date().toISOString(),
      starred: false,
      activated: false,
      tags: [classification.toLowerCase().replace(/\s+/g, '-')],
      notes: '',
      googleFontUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(item.family).replace(/%20/g, '+')}&display=swap`,
      styles,
    };
  });

  return { total: data.total, source: data.source, fonts };
}

/** 2. Fetch LIVE Adobe Fonts (Typekit) Web Project Kit via /api/adobe-fonts/kit/:kitId */
export async function fetchAdobeFontsKit(
  rawInput: string,
  libraryId: string,
): Promise<{ kitId: string; cssUrl: string; fonts: FontFamily[] }> {
  // Allow pasting either a raw kit ID ("abc1def") or full URL ("https://use.typekit.net/abc1def.css")
  const match = rawInput.trim().match(/use\.typekit\.net\/([a-zA-Z0-9]{4,20})\.css/i);
  const kitId = (match ? match[1] : rawInput.trim()).replace(/\.css$/i, '');

  const resp = await fetch(resolveApiUrl(`/api/adobe-fonts/kit/${encodeURIComponent(kitId)}`));
  const data = (await resp.json()) as {
    kitId?: string;
    cssUrl?: string;
    families?: Array<{
      cssFamily: string;
      displayName: string;
      styles: Array<{ weight: number; italic: boolean }>;
    }>;
    error?: string;
  };

  if (!resp.ok || !data.families) {
    throw new Error(data.error || `Unable to load Adobe Fonts project "${kitId}"`);
  }

  ensureAdobeKitStylesheet(kitId);
  const now = new Date().toISOString();

  const fonts: FontFamily[] = data.families.map((fam) => {
    const slug = `adobe-${kitId}-${fam.cssFamily.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const weightNames: Record<number, string> = {
      100: 'Thin',
      200: 'ExtraLight',
      300: 'Light',
      400: 'Regular',
      500: 'Medium',
      600: 'SemiBold',
      700: 'Bold',
      800: 'ExtraBold',
      900: 'Black',
    };
    const styles: FontStyleVariant[] = fam.styles.map((s) => {
      const wName = weightNames[s.weight] ?? `W${s.weight}`;
      const name = s.italic ? (s.weight === 400 ? 'Italic' : `${wName} Italic`) : wName;
      return {
        id: `${slug}-${s.weight}${s.italic ? 'i' : ''}`,
        name,
        weight: s.weight,
        italic: s.italic,
        postScriptName: `${fam.displayName.replace(/\s+/g, '')}-${name.replace(/\s+/g, '')}`,
        activated: true,
        fileSizeKb: 0,
      };
    });

    return {
      id: slug,
      name: fam.displayName,
      cssFamily: `'${fam.cssFamily}', sans-serif`,
      foundry: 'Adobe Fonts (Typekit)',
      designer: `Adobe Web Project ${kitId}`,
      classification: /serif/i.test(fam.displayName)
        ? 'Serif'
        : /mono|code/i.test(fam.displayName)
          ? 'Monospace'
          : 'Sans Serif',
      format: 'WOFF2',
      width: 'Normal',
      isVariable: false,
      license: 'Adobe Creative Cloud Web License',
      version: `Kit ${kitId}`,
      languages: ['Latin'],
      openTypeFeatures: ['liga', 'kern'],
      libraryId,
      addedAt: now,
      starred: false,
      activated: true,
      tags: ['adobe-fonts', `kit-${kitId}`],
      notes: `Synced live from Adobe Fonts Web Project (${data.cssUrl})`,
      adobeKitId: kitId,
      styles,
    };
  });

  return { kitId, cssUrl: data.cssUrl || `https://use.typekit.net/${kitId}.css`, fonts };
}

export class DriveAuthExpiredError extends Error {
  constructor(
    message = 'Google Drive session expired. Please reconnect Google Drive to continue.',
  ) {
    super(message);
    this.name = 'DriveAuthExpiredError';
  }
}

/** 3. Real Google Drive API v3 — full pagination across entire Drive (no 200-file cap) */
export async function listGoogleDriveFonts(accessToken: string): Promise<RemoteFontFile[]> {
  const q = encodeURIComponent(
    "trashed = false and (name contains '.ttf' or name contains '.otf' or name contains '.woff2' or name contains '.woff')",
  );
  const fields = encodeURIComponent('nextPageToken,files(id,name,size,modifiedTime,mimeType)');
  const allFiles: RemoteFontFile[] = [];
  let pageToken = '';
  const MAX_PAGES = 10; // Up to 10,000 font files

  for (let page = 0; page < MAX_PAGES; page++) {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000&orderBy=modifiedTime%20desc${tokenParam}`,
      {
        signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (resp.status === 401 || resp.status === 403) {
      throw new DriveAuthExpiredError();
    }
    if (!resp.ok) {
      throw new Error(`Google Drive returned HTTP ${resp.status}`);
    }
    const json = (await resp.json()) as {
      nextPageToken?: string;
      files?: Array<{ id: string; name: string; size?: string; modifiedTime?: string }>;
    };

    for (const f of json.files ?? []) {
      if (/\.(ttf|otf|woff2?)$/i.test(f.name)) {
        allFiles.push({
          id: f.id,
          name: f.name,
          size: Number(f.size) || 0,
          modifiedTime: f.modifiedTime,
        });
      }
    }

    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }

  return allFiles;
}

function parseDriveFileStyle(fileName: string): {
  familyName: string;
  styleName: string;
  weight: number;
  italic: boolean;
  format: 'OTF' | 'TTF' | 'WOFF2' | 'Variable';
} {
  const lower = fileName.toLowerCase();
  const base = fileName.replace(/\.(ttf|otf|woff2?)$/i, '');
  const isVariable = /variable|vf\b/i.test(base);
  const format = isVariable
    ? 'Variable'
    : lower.endsWith('.otf')
      ? 'OTF'
      : lower.endsWith('.woff2') || lower.endsWith('.woff')
        ? 'WOFF2'
        : 'TTF';

  const normalized = base.replace(/_/g, ' ');
  const dashIdx = normalized.indexOf('-');
  const rawFamily = (dashIdx > 0 ? normalized.slice(0, dashIdx) : normalized)
    .replace(/\b(thin|extralight|ultralight|light|regular|normal|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|variable|vf)\b/gi, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  const familyName = rawFamily || base;

  const italic = /italic|oblique/i.test(normalized);
  const weight = /thin|hairline/i.test(normalized)
    ? 100
    : /extralight|ultralight/i.test(normalized)
      ? 200
      : /light/i.test(normalized)
        ? 300
        : /medium/i.test(normalized)
          ? 500
          : /semibold|demibold|demi/i.test(normalized)
            ? 600
            : /extrabold|ultrabold|heavy/i.test(normalized)
              ? 800
              : /black/i.test(normalized)
                ? 900
                : /bold/i.test(normalized)
                  ? 700
                  : 400;

  const weightLabels: Record<number, string> = {
    100: 'Thin',
    200: 'ExtraLight',
    300: 'Light',
    400: 'Regular',
    500: 'Medium',
    600: 'SemiBold',
    700: 'Bold',
    800: 'ExtraBold',
    900: 'Black',
  };
  const wLabel = weightLabels[weight] ?? 'Regular';
  const styleName = italic ? (weight === 400 ? 'Italic' : `${wLabel} Italic`) : wLabel;

  return { familyName, styleName, weight, italic, format };
}

/**
 * Instantly groups hundreds or thousands of Google Drive font files into clean Font Families
 * (e.g. Regular, Bold, Italic under 1 family row) without downloading or blocking the UI thread.
 */
export function groupDriveFilesIntoFamilies(
  files: RemoteFontFile[],
  libraryId: string,
  activated = true,
): FontFamily[] {
  const buckets = new Map<
    string,
    {
      familyName: string;
      format: 'OTF' | 'TTF' | 'WOFF2' | 'Variable';
      addedAt: string;
      files: Array<{
        file: RemoteFontFile;
        fontId: string;
        styleName: string;
        weight: number;
        italic: boolean;
      }>;
    }
  >();

  for (const file of files) {
    const parsed = parseDriveFileStyle(file.name);
    const key = parsed.familyName.toLowerCase();
    const fontId = makeDriveFontId(file.id);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        familyName: parsed.familyName,
        format: parsed.format,
        addedAt: file.modifiedTime || new Date().toISOString(),
        files: [{ file, fontId, styleName: parsed.styleName, weight: parsed.weight, italic: parsed.italic }],
      });
    } else {
      existing.files.push({
        file,
        fontId,
        styleName: parsed.styleName,
        weight: parsed.weight,
        italic: parsed.italic,
      });
    }
  }

  const families: FontFamily[] = [];
  for (const bucket of buckets.values()) {
    bucket.files.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));
    const primary = bucket.files[0];
    const lower = bucket.familyName.toLowerCase();
    const classification: FontClassification = /mono|code|courier/i.test(lower)
      ? 'Monospace'
      : /slab/i.test(lower)
        ? 'Slab Serif'
        : /script|brush|callig/i.test(lower)
          ? 'Script'
          : /serif|garamond|bodoni|baskerville|times/i.test(lower)
            ? 'Serif'
            : /display|poster|condensed/i.test(lower)
              ? 'Display'
              : 'Sans Serif';
    const fallback =
      classification === 'Serif' || classification === 'Slab Serif'
        ? 'serif'
        : classification === 'Monospace'
          ? 'monospace'
          : 'sans-serif';

    families.push({
      id: primary.fontId,
      name: bucket.familyName,
      cssFamily: `'${bucket.familyName}', ${fallback}`,
      foundry: 'Google Drive',
      designer: 'Google Drive Cloud Library',
      classification,
      format: bucket.format,
      width: /condensed|narrow/i.test(lower)
        ? 'Condensed'
        : /expanded|wide/i.test(lower)
          ? 'Expanded'
          : 'Normal',
      isVariable: bucket.format === 'Variable',
      license: 'User Google Drive Font',
      version: 'Drive',
      languages: ['Latin'],
      openTypeFeatures: ['liga', 'kern'],
      libraryId,
      addedAt: bucket.addedAt,
      starred: false,
      activated,
      tags: ['google-drive', bucket.format.toLowerCase()],
      notes: `Google Drive (${bucket.files.length} ${bucket.files.length === 1 ? 'file' : 'files'})`,
      isCustomUpload: true,
      driveFileId: primary.file.id,
      driveFileName: primary.file.name,
      driveFiles: bucket.files.map((f) => ({
        fontId: f.fontId,
        fileId: f.file.id,
        fileName: f.file.name,
      })),
      sourcePath: `Google Drive/${primary.file.name}`,
      styles: bucket.files.map((f) => ({
        id: `${f.fontId}-${f.weight}${f.italic ? 'i' : ''}`,
        name: f.styleName,
        weight: f.weight,
        italic: f.italic,
        postScriptName: `${bucket.familyName.replace(/\s+/g, '')}-${f.styleName.replace(/\s+/g, '')}`,
        activated,
        fileSizeKb: Math.max(1, Math.round(f.file.size / 1024)),
      })),
    });
  }

  return families.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchGoogleDriveFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<RemoteFontFile> {
  const fields = encodeURIComponent('id,name,size,modifiedTime,mimeType');
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${fields}`,
    {
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (resp.status === 401 || resp.status === 403) {
    throw new DriveAuthExpiredError();
  }
  if (!resp.ok) {
    throw new Error(`Failed to fetch Drive font metadata (HTTP ${resp.status})`);
  }
  const f = (await resp.json()) as { id: string; name: string; size?: string; modifiedTime?: string };
  return {
    id: f.id,
    name: f.name,
    size: Number(f.size) || 0,
    modifiedTime: f.modifiedTime,
  };
}

export async function downloadGoogleDriveFont(
  accessToken: string,
  file: RemoteFontFile,
  libraryId: string,
): Promise<FontFamily> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
    {
      signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (resp.status === 401 || resp.status === 403) {
    throw new DriveAuthExpiredError();
  }
  if (!resp.ok) {
    throw new Error(`Failed to download ${file.name} from Google Drive (HTTP ${resp.status})`);
  }
  const buf = await resp.arrayBuffer();
  return parseAndLoadFontBuffer(buf, file.name, libraryId, {
    id: makeDriveFontId(file.id),
    driveFileId: file.id,
    sourceLabel: 'Google Drive',
    sourcePath: `Google Drive/${file.name}`,
    extraTags: ['google-drive'],
  });
}
