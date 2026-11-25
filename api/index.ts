import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import compression from 'compression';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';

const KIT_ID_RE = /^[a-zA-Z0-9]{4,20}$/;
const MAX_KIT_CSS_BYTES = 512 * 1024;
const GOOGLE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const ADOBE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const PAIRING_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ADOBE_CACHE_ENTRIES = 500;
const MAX_PAIRING_CACHE_ENTRIES = 300;
const MAX_RATE_LIMIT_KEYS = 10_000;

interface GoogleFontCatalogItem {
  family: string;
  category: string;
  designer: string;
  variants: string[];
  subsets: string[];
  axes: string[];
  version: string;
  lastModified: string;
  popularity: number;
  trending: number;
}

interface CachedCatalog {
  fetchedAt: number;
  source: 'google-webfonts-api' | 'google-fonts-metadata';
  etag: string;
  items: GoogleFontCatalogItem[];
}

interface FontshareCatalogItem {
  slug: string;
  family: string;
  category: string;
  designer: string;
  styles: Array<{ label: string; weight: number; italic: boolean }>;
  isVariable: boolean;
  axes: string[];
  features: string[];
  version: string;
  addedAt: string;
  popularity: number;
  trending: number;
}

interface CachedFontshareCatalog {
  fetchedAt: number;
  etag: string;
  items: FontshareCatalogItem[];
}

interface IndieFontCatalogItem {
  id: string;
  family: string;
  foundry: string;
  sourceCollection: 'Collletttivo' | 'UNCUT' | 'Open Foundry' | 'GitHub';
  sourceUrl: string;
  repo: string;
  designer: string;
  category: string;
  license: string;
  previewUrl: string;
  desktopUrls: string[];
  styles: Array<{ label: string; weight: number; italic: boolean }>;
}

interface CachedIndieCatalog {
  fetchedAt: number;
  etag: string;
  items: IndieFontCatalogItem[];
}

interface ParsedAdobeKit {
  kitId: string;
  cssUrl: string;
  families: Array<{
    cssFamily: string;
    displayName: string;
    styles: Array<{ weight: number; italic: boolean }>;
  }>;
}

interface CachedAdobeKit {
  fetchedAt: number;
  data: ParsedAdobeKit;
}

interface CachedPairingResult {
  fetchedAt: number;
  data: unknown;
}

class UpstreamHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let googleCatalogCache: CachedCatalog | null = null;
let googleCatalogInFlight: Promise<CachedCatalog> | null = null;

let fontshareCatalogCache: CachedFontshareCatalog | null = null;
let fontshareCatalogInFlight: Promise<CachedFontshareCatalog> | null = null;

let indieCatalogCache: CachedIndieCatalog | null = null;
let indieCatalogInFlight: Promise<CachedIndieCatalog> | null = null;

const adobeKitCache = new Map<string, CachedAdobeKit>();
const adobeKitInFlight = new Map<string, Promise<ParsedAdobeKit>>();

const pairingCache = new Map<string, CachedPairingResult>();
const pairingInFlight = new Map<string, Promise<Record<string, unknown>>>();

let geminiClient: GoogleGenAI | null = null;
let geminiClientKey = '';

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new UpstreamHttpError(
      503,
      'Gemini API key is not configured on the server. Add GEMINI_API_KEY in your environment variables.',
    );
  }
  if (!geminiClient || geminiClientKey !== apiKey) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 20_000,
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    geminiClientKey = apiKey;
  }
  return geminiClient;
}

// Bounded in-memory per-IP fixed-window rate limiter with automatic sweep
interface RateBucket {
  count: number;
  resetAt: number;
}

const rateLimitStores: Array<Map<string, RateBucket>> = [];

function createRateLimiter(options: { windowMs: number; max: number }) {
  const store = new Map<string, RateBucket>();
  rateLimitStores.push(store);

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    let bucket = store.get(ip);

    if (!bucket || now >= bucket.resetAt) {
      if (store.size >= MAX_RATE_LIMIT_KEYS && !store.has(ip)) {
        const firstKey = store.keys().next().value;
        if (firstKey !== undefined) store.delete(firstKey);
      }
      bucket = { count: 1, resetAt: now + options.windowMs };
      store.set(ip, bucket);
    } else {
      bucket.count += 1;
    }

    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
      });
      return;
    }

    next();
  };
}

export function sweepExpiredCaches(): void {
  const now = Date.now();
  for (const store of rateLimitStores) {
    for (const [key, bucket] of store.entries()) {
      if (now >= bucket.resetAt) store.delete(key);
    }
  }
  for (const [kitId, entry] of adobeKitCache.entries()) {
    if (now - entry.fetchedAt >= ADOBE_CACHE_TTL_MS) {
      adobeKitCache.delete(kitId);
    }
  }
  for (const [cacheKey, entry] of pairingCache.entries()) {
    if (now - entry.fetchedAt >= PAIRING_CACHE_TTL_MS) {
      pairingCache.delete(cacheKey);
    }
  }
}

function buildEtag(seed: string): string {
  const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16);
  return `W/"${hash}"`;
}

async function loadGoogleFontsFromUpstream(): Promise<CachedCatalog> {
  const apiKey = (process.env.GOOGLE_FONTS_API_KEY || '').trim();
  if (apiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&capability=VF&key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(12000) });
      if (resp.ok) {
        const json = (await resp.json()) as {
          items?: Array<{
            family: string;
            category?: string;
            variants?: string[];
            subsets?: string[];
            axes?: Array<{ tag: string }>;
            version?: string;
            lastModified?: string;
          }>;
        };
        const items: GoogleFontCatalogItem[] = (json.items ?? []).map((item, idx) => ({
          family: item.family,
          category: item.category || 'sans-serif',
          designer: 'Google Fonts Foundry',
          variants: item.variants || ['regular'],
          subsets: item.subsets || ['latin'],
          axes: (item.axes || []).map((a) => a.tag),
          version: item.version || 'v1',
          lastModified: item.lastModified || new Date().toISOString().slice(0, 10),
          popularity: idx + 1,
          trending: idx + 1,
        }));
        if (items.length > 0) {
          return {
            fetchedAt: Date.now(),
            source: 'google-webfonts-api',
            etag: buildEtag(`wf:${items.length}:${items[0].family}:${items[items.length - 1].lastModified}`),
            items,
          };
        }
      }
    } catch {
      // Fall through to public Google Fonts directory metadata feed
    }
  }

  // Official public Google Fonts directory metadata feed (returns 1,900+ live families)
  const metaResp = await fetch('https://fonts.google.com/metadata/fonts', {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  });
  if (!metaResp.ok) {
    throw new Error(`Google Fonts directory unavailable (${metaResp.status})`);
  }
  const rawText = await metaResp.text();
  // Google Fonts metadata prefixes JSON with XSSI guard ")]}'"
  const cleaned = rawText.replace(/^\)\]\}'\s*/, '');
  const parsed = JSON.parse(cleaned) as {
    familyMetadataList?: Array<{
      family: string;
      category?: string;
      designers?: string[];
      subsets?: string[];
      axes?: Array<{ tag: string }>;
      fonts?: Record<string, unknown>;
      lastModified?: string;
      popularity?: number;
      trending?: number;
    }>;
  };

  const rawList = parsed.familyMetadataList ?? [];
  const items: GoogleFontCatalogItem[] = rawList
    .filter((f) => f.family && f.category !== 'Icons')
    .sort((a, b) => (a.popularity ?? 9999) - (b.popularity ?? 9999))
    .map((f, idx) => ({
      family: f.family,
      category: f.category || 'Sans Serif',
      designer: f.designers && f.designers.length > 0 ? f.designers.join(', ') : 'Google Fonts Contributor',
      variants: Object.keys(f.fonts || { '400': {} }),
      subsets: (f.subsets || ['latin']).filter((s) => s !== 'menu'),
      axes: (f.axes || []).map((a) => a.tag),
      version: 'Live',
      lastModified: f.lastModified || new Date().toISOString().slice(0, 10),
      popularity: f.popularity ?? idx + 1,
      trending: f.trending ?? f.popularity ?? idx + 1,
    }));

  return {
    fetchedAt: Date.now(),
    source: 'google-fonts-metadata',
    etag: buildEtag(`meta:${items.length}:${items[0]?.family ?? ''}:${items[items.length - 1]?.lastModified ?? ''}`),
    items,
  };
}

/**
 * Fetches Google Fonts catalog with:
 * - 1-hour in-memory cache
 * - Single-flight deduplication (prevents cold-start / expiry thundering herd)
 * - Stale-while-error resilience (serves cached catalog if upstream hiccups)
 */
export async function fetchLiveGoogleFontsCatalog(): Promise<CachedCatalog> {
  if (googleCatalogCache && Date.now() - googleCatalogCache.fetchedAt < GOOGLE_CACHE_TTL_MS) {
    return googleCatalogCache;
  }

  if (googleCatalogInFlight) {
    return googleCatalogInFlight;
  }

  googleCatalogInFlight = loadGoogleFontsFromUpstream()
    .then((fresh) => {
      googleCatalogCache = fresh;
      return fresh;
    })
    .catch((err) => {
      if (googleCatalogCache) {
        console.warn('[Fontainer] Upstream Google Fonts refresh failed; serving stale cache.');
        return googleCatalogCache;
      }
      throw err;
    })
    .finally(() => {
      googleCatalogInFlight = null;
    });

  return googleCatalogInFlight;
}

async function fetchLiveFontshareCatalog(): Promise<CachedFontshareCatalog> {
  if (fontshareCatalogCache && Date.now() - fontshareCatalogCache.fetchedAt < GOOGLE_CACHE_TTL_MS) {
    return fontshareCatalogCache;
  }
  if (fontshareCatalogInFlight) {
    return fontshareCatalogInFlight;
  }

  fontshareCatalogInFlight = (async () => {
    const resp = await fetch('https://api.fontshare.com/v2/fonts?limit=200', {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json', 'User-Agent': 'Fontainer/1.0' },
    });
    if (!resp.ok) {
      throw new Error(`Fontshare directory unavailable (${resp.status})`);
    }
    const json = (await resp.json()) as {
      fonts?: Array<{
        slug?: string;
        name?: string;
        category?: string;
        version?: string;
        inserted_at?: string;
        views?: number;
        views_recent?: number;
        is_hot?: boolean;
        is_top?: boolean;
        designers?: Array<{ name?: string }>;
        publisher?: { name?: string };
        axes?: Array<{ tag?: string }>;
        features?: Array<{ tag?: string }>;
        styles?: Array<{
          is_variable?: boolean;
          is_italic?: boolean;
          weight?: { label?: string; name?: string; number?: number; weight?: number };
        }>;
      }>;
    };

    const items: FontshareCatalogItem[] = (json.fonts ?? [])
      .filter((f) => f.slug && f.name)
      .map((f) => {
        const designerNames = (f.designers ?? [])
          .map((d) => d.name?.trim())
          .filter((n): n is string => Boolean(n));
        const designer =
          designerNames.length > 0
            ? designerNames.join(', ')
            : f.publisher?.name || 'Indian Type Foundry';
        const rawStyles = (f.styles ?? []).filter((s) => !s.is_variable);
        const styles =
          rawStyles.length > 0
            ? rawStyles.map((s) => ({
                label: s.weight?.label || s.weight?.name || 'Regular',
                weight: Math.min(900, Math.max(100, Number(s.weight?.number ?? s.weight?.weight ?? 400))),
                italic: Boolean(s.is_italic),
              }))
            : [{ label: 'Regular', weight: 400, italic: false }];
        const axes = (f.axes ?? []).map((a) => a.tag || '').filter(Boolean);
        const isVariable =
          axes.length > 0 || (f.styles ?? []).some((s) => Boolean(s.is_variable));
        const features = Array.from(
          new Set((f.features ?? []).map((ft) => ft.tag || '').filter(Boolean)),
        ).slice(0, 12);

        return {
          slug: String(f.slug),
          family: String(f.name),
          category: f.category || 'Sans',
          designer,
          styles,
          isVariable,
          axes,
          features: features.length > 0 ? features : ['liga', 'kern'],
          version: f.version || '1.0',
          addedAt: f.inserted_at || new Date().toISOString(),
          popularity: f.views ? Math.max(1, Math.round(10_000_000 / Math.max(1, f.views))) : f.is_top ? 25 : 200,
          trending: f.views_recent
            ? Math.max(1, Math.round(1_000_000 / Math.max(1, f.views_recent)))
            : f.is_hot
              ? 15
              : 250,
        };
      });

    const fresh: CachedFontshareCatalog = {
      fetchedAt: Date.now(),
      etag: buildEtag(`fs:${items.length}:${items[0]?.slug ?? ''}`),
      items,
    };
    fontshareCatalogCache = fresh;
    return fresh;
  })()
    .catch((err) => {
      if (fontshareCatalogCache) return fontshareCatalogCache;
      throw err;
    })
    .finally(() => {
      fontshareCatalogInFlight = null;
    });

  return fontshareCatalogInFlight;
}

interface JsDelivrNode {
  type: 'file' | 'directory';
  name: string;
  files?: JsDelivrNode[];
}

function flattenJsDelivrTree(nodes: JsDelivrNode[], prefix = ''): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    const full = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'directory' && Array.isArray(node.files)) {
      if (!node.name.startsWith('.') && node.name !== '__MACOSX') {
        out.push(...flattenJsDelivrTree(node.files, full));
      }
    } else if (node.type === 'file') {
      out.push(full);
    }
  }
  return out;
}

async function resolveGitHubFontRepo(
  repo: string,
  preferredBranch?: string,
): Promise<{ branch: string; previewUrl: string; desktopUrls: string[]; styles: Array<{ label: string; weight: number; italic: boolean }> }> {
  const branches = preferredBranch ? [preferredBranch, 'main', 'master'] : ['main', 'master'];
  const tried = new Set<string>();

  for (const branch of branches) {
    if (tried.has(branch)) continue;
    tried.add(branch);
    try {
      const resp = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${repo}@${branch}`, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json', 'User-Agent': 'Fontainer/1.0' },
      });
      if (!resp.ok) continue;
      const json = (await resp.json()) as { files?: JsDelivrNode[] };
      const allPaths = flattenJsDelivrTree(json.files ?? []);
      const otfPaths = allPaths.filter((p) => /\.otf$/i.test(p) && !/variable/i.test(p));
      const ttfPaths = allPaths.filter((p) => /\.ttf$/i.test(p) && !/variable/i.test(p));
      const woff2Paths = allPaths.filter((p) => /\.woff2$/i.test(p));
      const desktopPaths = (otfPaths.length > 0 ? otfPaths : ttfPaths).slice(0, 18);
      if (desktopPaths.length === 0 && woff2Paths.length === 0) continue;

      const encodePath = (p: string) =>
        p
          .split('/')
          .map((seg) => encodeURIComponent(seg))
          .join('/');

      const desktopUrls = desktopPaths.map(
        (p) => `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${encodePath(p)}`,
      );
      const regularPreviewPath =
        woff2Paths.find((p) => /regular|book|normal|400/i.test(p)) ??
        woff2Paths[0] ??
        desktopPaths.find((p) => /regular|book|normal|400/i.test(p)) ??
        desktopPaths[0];
      const previewUrl = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${encodePath(regularPreviewPath)}`;

      const styleSource = desktopPaths.length > 0 ? desktopPaths : woff2Paths.slice(0, 12);
      const seenStyles = new Set<string>();
      const styles: Array<{ label: string; weight: number; italic: boolean }> = [];
      for (const p of styleSource) {
        const fileName = p.split('/').pop() ?? p;
        const lower = fileName.toLowerCase();
        const italic = /italic|oblique/i.test(lower);
        const weight = /thin|hairline/i.test(lower)
          ? 100
          : /extralight|ultralight/i.test(lower)
            ? 200
            : /light/i.test(lower)
              ? 300
              : /medium/i.test(lower)
                ? 500
                : /semibold|demi/i.test(lower)
                  ? 600
                  : /extrabold|heavy/i.test(lower)
                    ? 800
                    : /black/i.test(lower)
                      ? 900
                      : /bold/i.test(lower)
                        ? 700
                        : 400;
        const key = `${weight}-${italic}`;
        if (seenStyles.has(key)) continue;
        seenStyles.add(key);
        const wMap: Record<number, string> = {
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
        const base = wMap[weight] ?? 'Regular';
        const label = italic ? (weight === 400 ? 'Italic' : `${base} Italic`) : base;
        styles.push({ label, weight, italic });
      }
      styles.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));

      return { branch, previewUrl, desktopUrls, styles };
    } catch {
      // try next branch
    }
  }
  throw new UpstreamHttpError(404, `No downloadable .otf, .ttf, or .woff2 font files found in github.com/${repo}.`);
}

// Verified SIL OFL 1.1 open-source indie typefaces from Collletttivo (16), Open Foundry (15), and UNCUT (15)
const CURATED_INDIE_REPOS: Array<{
  id: string;
  family: string;
  foundry: string;
  sourceCollection: 'Collletttivo' | 'UNCUT' | 'Open Foundry';
  sourceUrl: string;
  repo: string;
  branch: string;
  designer: string;
  category: string;
  license: string;
}> = [
  // Collletttivo (16/16 — full official open-source catalog)
  { id: 'indie-apfel-grotezk', family: 'Apfel Grotezk', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/apfel-grotezk', branch: 'main', designer: 'Luigi Gorlero (Collletttivo)', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-absans', family: 'Absans', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/absans', branch: 'main', designer: 'Valerio Monopoli (Collletttivo)', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-ortica', family: 'Ortica', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/ortica', branch: 'main', designer: 'Benedetta Bovani (Collletttivo)', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-mazius-display', family: 'Mazius Display', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/mazius-display', branch: 'main', designer: 'Collletttivo', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-ronzino', family: 'Ronzino', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/ronzino', branch: 'main', designer: 'Luigi Gorlero (Collletttivo)', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-halibut', family: 'Halibut', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/halibut', branch: 'main', designer: 'Collletttivo', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-coconat', family: 'Coconat', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/coconat', branch: 'main', designer: 'Sara Lavazza (Collletttivo)', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-messapia', family: 'Messapia', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/messapia', branch: 'main', designer: 'Luca Marsano (Collletttivo)', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-ribes', family: 'Ribes', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/ribes', branch: 'main', designer: 'Collletttivo', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-aujournuit', family: 'Aujournuit', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/aujournuit', branch: 'main', designer: 'Collletttivo', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-sneaky-times', family: 'Sneaky Times', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/sneaky-times', branch: 'main', designer: 'Collletttivo', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-borges', family: 'Borges', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/borges', branch: 'main', designer: 'Collletttivo', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-mattone', family: 'Mattone', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/mattone', branch: 'main', designer: 'Nunzio Mazzaferro (Collletttivo)', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-necto-mono', family: 'Necto Mono', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/necto-mono', branch: 'main', designer: 'Marco Ballarè (Collletttivo)', category: 'Monospace', license: 'SIL OFL 1.1' },
  { id: 'indie-sinistre', family: 'Sinistre', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/sinistre', branch: 'main', designer: 'Jules Durand (Collletttivo)', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-sprat', family: 'Sprat', foundry: 'Collletttivo', sourceCollection: 'Collletttivo', sourceUrl: 'https://www.collletttivo.it', repo: 'collletttivo/sprat', branch: 'main', designer: 'Ethan Nakache (Collletttivo)', category: 'Serif', license: 'SIL OFL 1.1' },

  // Open Foundry (15 verified SIL OFL 1.1 open-source typefaces)
  { id: 'indie-space-grotesk', family: 'Space Grotesk', foundry: 'Open Foundry', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com', repo: 'floriankarsten/space-grotesk', branch: 'master', designer: 'Florian Karsten', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-jost', family: 'Jost*', foundry: 'indestructible type* (Open Foundry)', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com', repo: 'indestructible-type/Jost', branch: 'master', designer: 'Owen Earl', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-young-serif', family: 'Young Serif', foundry: 'NoirBlancRouge (Open Foundry)', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com/fonts/young-serif', repo: 'noirblancrouge/YoungSerif', branch: 'master', designer: 'Bastien Sozeau', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-cotham-sans', family: 'Cotham Sans', foundry: 'Open Foundry', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com/fonts/cotham-sans', repo: 'sebsan/Cotham', branch: 'master', designer: 'Sebastien Sanfilippo', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-bagnard', family: 'Bagnard', foundry: 'Open Foundry', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com/fonts/bagnard', repo: 'sebsan/Bagnard', branch: 'master', designer: 'Sebastien Sanfilippo', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-eb-garamond', family: 'EB Garamond', foundry: 'Open Foundry', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com/fonts/eb-garamond', repo: 'octaviopardo/EBGaramond12', branch: 'master', designer: 'Georg Duffner & Octavio Pardo', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-libre-baskerville', family: 'Libre Baskerville', foundry: 'Impallari Type (Open Foundry)', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com/fonts/libre-baskerville', repo: 'impallari/Libre-Baskerville', branch: 'master', designer: 'Pablo Impallari', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-league-spartan', family: 'League Spartan', foundry: 'The League of Moveable Type', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com', repo: 'theleagueof/league-spartan', branch: 'master', designer: 'Matt Bailey & Tyler Finck', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-ostrich-sans', family: 'Ostrich Sans', foundry: 'The League of Moveable Type', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com/fonts/ostrich-sans', repo: 'theleagueof/ostrich-sans', branch: 'master', designer: 'Tyler Finck', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-junction', family: 'Junction', foundry: 'The League of Moveable Type', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com', repo: 'theleagueof/junction', branch: 'master', designer: 'Caroline Hadilaksono', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-orbitron', family: 'Orbitron', foundry: 'The League of Moveable Type', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com', repo: 'theleagueof/orbitron', branch: 'master', designer: 'Matt McInerney', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-chunk', family: 'ChunkFive', foundry: 'The League of Moveable Type', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com', repo: 'theleagueof/chunk', branch: 'master', designer: 'Meredith Mandel', category: 'Slab Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-sorts-mill-goudy', family: 'Sorts Mill Goudy', foundry: 'The League of Moveable Type', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com', repo: 'theleagueof/sorts-mill-goudy', branch: 'master', designer: 'Barry Schwartz', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-linden-hill', family: 'Linden Hill', foundry: 'The League of Moveable Type', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com', repo: 'theleagueof/linden-hill', branch: 'master', designer: 'Barry Schwartz', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-goudy-bookletter', family: 'Goudy Bookletter 1911', foundry: 'The League of Moveable Type', sourceCollection: 'Open Foundry', sourceUrl: 'https://open-foundry.com', repo: 'theleagueof/goudy-bookletter-1911', branch: 'master', designer: 'Barry Schwartz', category: 'Serif', license: 'SIL OFL 1.1' },

  // UNCUT (15 verified SIL OFL 1.1 open-source typefaces featured on uncut.wtf)
  { id: 'indie-uncut-sans', family: 'Uncut Sans', foundry: 'UNCUT', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf/sans-serif/uncut-sans/', repo: 'kaspernordkvist/uncut_sans', branch: 'main', designer: 'Kasper Nordkvist (UNCUT)', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-bricolage-grotesque', family: 'Bricolage Grotesque', foundry: 'Atelier Triay (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'ateliertriay/bricolage', branch: 'main', designer: 'Mathieu Triay', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-instrument-serif', family: 'Instrument Serif', foundry: 'Instrument (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'Instrument/instrument-serif', branch: 'main', designer: 'Rodrigo Fuenzalida', category: 'Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-instrument-sans', family: 'Instrument Sans', foundry: 'Instrument (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'Instrument/instrument-sans', branch: 'master', designer: 'Rodrigo Fuenzalida', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-mona-sans', family: 'Mona Sans', foundry: 'GitHub & Degarism (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'github/mona-sans', branch: 'main', designer: 'Degarism & GitHub', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-plus-jakarta-sans', family: 'Plus Jakarta Sans', foundry: 'Tokotype (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'tokotype/PlusJakartaSans', branch: 'master', designer: 'Gumpita Rahayu', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-space-mono', family: 'Space Mono', foundry: 'Colophon Foundry (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'googlefonts/spacemono', branch: 'main', designer: 'Colophon Foundry', category: 'Monospace', license: 'SIL OFL 1.1' },
  { id: 'indie-jetbrains-mono', family: 'JetBrains Mono', foundry: 'JetBrains (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'JetBrains/JetBrainsMono', branch: 'master', designer: 'Philipp Nurullin', category: 'Monospace', license: 'SIL OFL 1.1' },
  { id: 'indie-redhat-display', family: 'Red Hat Display', foundry: 'MCKL (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'RedHatOfficial/RedHatFont', branch: 'master', designer: 'Jeremy Mickel', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-epilogue', family: 'Epilogue', foundry: 'Etcetera Type Co (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'Etcetera-Type-Co/Epilogue', branch: 'master', designer: 'Tyler Finck', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-be-vietnam-pro', family: 'Be Vietnam Pro', foundry: 'BetterGUI (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'bettergui/BeVietnamPro', branch: 'main', designer: 'Gabriel Lam', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-sora', family: 'Sora', foundry: 'Barnbrook (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'sora-xor/sora-font', branch: 'master', designer: 'Jonathan Barnbrook & Julián Moncada', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-dm-sans', family: 'DM Sans', foundry: 'Colophon Foundry (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'googlefonts/dm-fonts', branch: 'main', designer: 'Colophon Foundry', category: 'Sans Serif', license: 'SIL OFL 1.1' },
  { id: 'indie-archivo-black', family: 'Archivo Black', foundry: 'Omnibus-Type (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'Omnibus-Type/ArchivoBlack', branch: 'master', designer: 'Héctor Gatti', category: 'Display', license: 'SIL OFL 1.1' },
  { id: 'indie-outfit', family: 'Outfit', foundry: 'Outfit.io (UNCUT)', sourceCollection: 'UNCUT', sourceUrl: 'https://uncut.wtf', repo: 'Outfitio/Outfit-Fonts', branch: 'main', designer: 'Rodrigo Fuenzalida', category: 'Sans Serif', license: 'SIL OFL 1.1' },
];

async function fetchLiveIndieFoundriesCatalog(): Promise<CachedIndieCatalog> {
  if (indieCatalogCache && Date.now() - indieCatalogCache.fetchedAt < GOOGLE_CACHE_TTL_MS) {
    return indieCatalogCache;
  }
  if (indieCatalogInFlight) {
    return indieCatalogInFlight;
  }

  indieCatalogInFlight = (async () => {
    const settled = await Promise.all(
      CURATED_INDIE_REPOS.map(async (entry): Promise<IndieFontCatalogItem | null> => {
        try {
          const resolved = await resolveGitHubFontRepo(entry.repo, entry.branch);
          return {
            id: entry.id,
            family: entry.family,
            foundry: entry.foundry,
            sourceCollection: entry.sourceCollection,
            sourceUrl: entry.sourceUrl,
            repo: entry.repo,
            designer: entry.designer,
            category: entry.category,
            license: entry.license,
            previewUrl: resolved.previewUrl,
            desktopUrls: resolved.desktopUrls,
            styles: resolved.styles,
          } satisfies IndieFontCatalogItem;
        } catch {
          return null;
        }
      }),
    );

    const items = settled.filter((item): item is IndieFontCatalogItem => Boolean(item));
    const fresh: CachedIndieCatalog = {
      fetchedAt: Date.now(),
      etag: buildEtag(`indie:${items.length}:${items[0]?.id ?? ''}`),
      items,
    };
    indieCatalogCache = fresh;
    return fresh;
  })().finally(() => {
    indieCatalogInFlight = null;
  });

  return indieCatalogInFlight;
}

function parseAdobeTypekitCss(cssText: string, kitId: string): ParsedAdobeKit {
  const faceRegex = /@font-face\s*\{([^}]+)\}/gi;
  const familyMap = new Map<
    string,
    {
      cssFamily: string;
      displayName: string;
      styles: Array<{ weight: number; italic: boolean }>;
    }
  >();

  let match: RegExpExecArray | null;
  while ((match = faceRegex.exec(cssText)) !== null) {
    const block = match[1];
    const famMatch = /font-family\s*:\s*["']?([^;"']+)["']?/i.exec(block);
    if (!famMatch) continue;
    const rawFam = famMatch[1].trim();
    const weightMatch = /font-weight\s*:\s*(\d+|normal|bold)/i.exec(block);
    const styleMatch = /font-style\s*:\s*(italic|oblique|normal)/i.exec(block);

    let weight = 400;
    if (weightMatch) {
      const w = weightMatch[1].toLowerCase();
      weight = w === 'bold' ? 700 : w === 'normal' ? 400 : Math.min(900, Math.max(100, Number(w) || 400));
    }
    const italic = Boolean(styleMatch && styleMatch[1].toLowerCase() !== 'normal');

    const displayName = rawFam
      .split(/[-_]+/)
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
      .join(' ')
      .trim();

    const existing = familyMap.get(rawFam) ?? {
      cssFamily: rawFam,
      displayName: displayName || rawFam,
      styles: [],
    };
    const dup = existing.styles.some((s) => s.weight === weight && s.italic === italic);
    if (!dup) {
      existing.styles.push({ weight, italic });
    }
    familyMap.set(rawFam, existing);
  }

  return {
    kitId,
    cssUrl: `https://use.typekit.net/${kitId}.css`,
    families: Array.from(familyMap.values()).map((f) => ({
      ...f,
      styles: f.styles.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic)),
    })),
  };
}

async function fetchAdobeKitCached(kitId: string): Promise<ParsedAdobeKit> {
  const cached = adobeKitCache.get(kitId);
  if (cached && Date.now() - cached.fetchedAt < ADOBE_CACHE_TTL_MS) {
    return cached.data;
  }

  const inflight = adobeKitInFlight.get(kitId);
  if (inflight) return inflight;

  const task = (async () => {
    const resp = await fetch(`https://use.typekit.net/${kitId}.css`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Fontainer/1.0' },
    });
    if (!resp.ok) {
      throw new UpstreamHttpError(
        resp.status === 404 ? 404 : 502,
        resp.status === 404
          ? `Adobe Fonts project "${kitId}" was not found. Confirm the Project ID in Adobe Fonts → Web Projects.`
          : `Adobe Fonts returned HTTP ${resp.status}.`,
      );
    }

    const contentLength = Number(resp.headers.get('content-length') || '0');
    if (contentLength > MAX_KIT_CSS_BYTES) {
      throw new UpstreamHttpError(413, 'Adobe Fonts stylesheet exceeded maximum supported size.');
    }

    const cssText = await resp.text();
    if (Buffer.byteLength(cssText, 'utf8') > MAX_KIT_CSS_BYTES) {
      throw new UpstreamHttpError(413, 'Adobe Fonts stylesheet exceeded maximum supported size.');
    }

    const parsed = parseAdobeTypekitCss(cssText, kitId);
    if (parsed.families.length === 0) {
      throw new UpstreamHttpError(422, `Project "${kitId}" loaded but contains no @font-face declarations yet.`);
    }

    if (adobeKitCache.size >= MAX_ADOBE_CACHE_ENTRIES && !adobeKitCache.has(kitId)) {
      const oldestKey = adobeKitCache.keys().next().value;
      if (oldestKey !== undefined) adobeKitCache.delete(oldestKey);
    }
    adobeKitCache.set(kitId, { fetchedAt: Date.now(), data: parsed });
    return parsed;
  })().finally(() => {
    adobeKitInFlight.delete(kitId);
  });

  adobeKitInFlight.set(kitId, task);
  return task;
}

export interface CreateApiAppOptions {
  enableCompression?: boolean;
}

export function createApiApp(options: CreateApiAppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Baseline security headers (iframe-compatible)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Allow standalone Tauri macOS .dmg WebView origins + optional ALLOWED_ORIGINS env list to call /api/*
  const allowedOrigins = new Set<string>([
    'tauri://localhost',
    'http://tauri.localhost',
    'https://tauri.localhost',
  ]);
  for (const raw of (process.env.ALLOWED_ORIGINS || '').split(',')) {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (trimmed) allowedOrigins.add(trimmed);
  }

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  // Gzip / deflate response compression for standalone Node / Cloud Run (Vercel Edge compresses automatically)
  const shouldCompress = options.enableCompression ?? process.env.VERCEL !== '1';
  if (shouldCompress) {
    app.use(compression({ threshold: 1024 }));
  }

  const jsonParser = express.json({ limit: '1mb' });
  app.use((req, res, next) => {
    if (req.body !== undefined && typeof req.body === 'object') {
      next();
      return;
    }
    jsonParser(req, res, next);
  });

  const catalogLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
  const adobeLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
  const pairingLimiter = createRateLimiter({ windowMs: 60_000, max: 15 });

  // Liveness & readiness probe (Cloud Run & Vercel)
  app.get('/healthz', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      runtime: process.env.VERCEL === '1' ? 'vercel' : 'node',
      uptimeSeconds: Math.floor(process.uptime()),
      catalogCached: Boolean(googleCatalogCache),
      catalogCount: googleCatalogCache?.items.length ?? 0,
    });
  });

  // Integration availability endpoint
  app.get('/api/integrations/status', catalogLimiter, (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.json({
      googleFonts: { available: true, hasApiKey: Boolean(process.env.GOOGLE_FONTS_API_KEY) },
      adobeFonts: { available: true },
    });
  });

  // 1. Live Google Fonts Directory Proxy (Edge-cached, ETag-enabled, single-flight)
  app.get('/api/google-fonts', catalogLimiter, async (req, res) => {
    try {
      const catalog = await fetchLiveGoogleFontsCatalog();
      const q = String(req.query.q || '').trim().toLowerCase();
      const category = String(req.query.category || '').trim().toLowerCase();
      const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 250));
      const offset = Math.max(0, Number(req.query.offset) || 0);

      const responseEtag =
        !q && (!category || category === 'all') && offset === 0
          ? `${catalog.etag.slice(0, -1)}-${limit}"`
          : buildEtag(`${catalog.etag}:${q}:${category}:${offset}:${limit}`);

      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
      res.setHeader('ETag', responseEtag);

      if (req.headers['if-none-match'] === responseEtag) {
        res.status(304).end();
        return;
      }

      let filtered = catalog.items;
      if (q) {
        filtered = filtered.filter(
          (f) => f.family.toLowerCase().includes(q) || f.designer.toLowerCase().includes(q),
        );
      }
      if (category && category !== 'all') {
        filtered = filtered.filter((f) => f.category.toLowerCase() === category);
      }

      res.json({
        source: catalog.source,
        total: catalog.items.length,
        matched: filtered.length,
        items: filtered.slice(offset, offset + limit),
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to load live Google Fonts directory',
      });
    }
  });

  // 1b. Live Fontshare Directory Proxy (100+ free commercial designer fonts by ITF)
  app.get('/api/fontshare-fonts', catalogLimiter, async (req, res) => {
    try {
      const catalog = await fetchLiveFontshareCatalog();
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
      res.setHeader('ETag', catalog.etag);
      if (req.headers['if-none-match'] === catalog.etag) {
        res.status(304).end();
        return;
      }
      res.json({
        source: 'fontshare-v2',
        total: catalog.items.length,
        items: catalog.items,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to load Fontshare catalog',
      });
    }
  });

  // 1c. Live Indie & Open Foundries Proxy (Collletttivo, UNCUT, Open Foundry — SIL OFL 1.1 via jsDelivr)
  app.get('/api/indie-foundries', catalogLimiter, async (req, res) => {
    try {
      const catalog = await fetchLiveIndieFoundriesCatalog();
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
      res.setHeader('ETag', catalog.etag);
      if (req.headers['if-none-match'] === catalog.etag) {
        res.status(304).end();
        return;
      }
      res.json({
        source: 'indie-ofl-jsdelivr',
        total: catalog.items.length,
        items: catalog.items,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to load Indie Foundries catalog',
      });
    }
  });

  // 1d. Import ANY open-source GitHub font repository (from UNCUT, Collletttivo, Open Foundry, etc.)
  app.get('/api/github-fonts', adobeLimiter, async (req, res) => {
    const rawRepo = String(req.query.repo || '').trim();
    const cleaned = rawRepo
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '');
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length < 2 || !/^[a-zA-Z0-9._-]+$/.test(parts[0]) || !/^[a-zA-Z0-9._-]+$/.test(parts[1])) {
      res.status(400).json({
        error: 'Enter a valid GitHub repository (e.g. collletttivo/apfel-grotezk or https://github.com/kaspernordkvist/uncut_sans).',
      });
      return;
    }
    const repo = `${parts[0]}/${parts[1]}`;
    try {
      const resolved = await resolveGitHubFontRepo(repo);
      const prettyName = parts[1]
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800');
      res.json({
        repo,
        branch: resolved.branch,
        family: prettyName,
        previewUrl: resolved.previewUrl,
        desktopUrls: resolved.desktopUrls,
        styles: resolved.styles,
      });
    } catch (err) {
      if (err instanceof UpstreamHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to inspect GitHub font repository',
      });
    }
  });

  // 2. Live Adobe Fonts (Typekit) Web Project Kit Proxy (rate-limited, Edge-cached, single-flight)
  app.get('/api/adobe-fonts/kit/:kitId', adobeLimiter, async (req, res) => {
    const kitId = String(req.params.kitId || '').trim();
    if (!KIT_ID_RE.test(kitId)) {
      res.status(400).json({
        error: 'Invalid Adobe Fonts Project ID. Use the 6–8 character ID from use.typekit.net/<id>.css.',
      });
      return;
    }

    try {
      const parsed = await fetchAdobeKitCached(kitId);
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600');
      res.json(parsed);
    } catch (err) {
      if (err instanceof UpstreamHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to reach Adobe Fonts (use.typekit.net)',
      });
    }
  });

  // 3. AI-Powered Font Pairing Assistant (Server-side Gemini API via @google/genai)
  const ALLOWED_CONTEXTS: Record<string, string> = {
    'saas-ui': 'Modern SaaS application, product dashboard, and clean UI layouts',
    editorial: 'Editorial publishing, long-form articles, essays, and magazine typography',
    branding: 'Brand identity, hero headlines, and expressive studio websites',
    marketing: 'High-conversion marketing landing pages, campaigns, and product launches',
    docs: 'Technical documentation, developer portals, and code-heavy reading interfaces',
    portfolio: 'Creative portfolio, architecture, photography, and design showcases',
  };
  const ALLOWED_ROLES = new Set(['auto', 'heading', 'body', 'ui']);

  app.post('/api/font-pairings', pairingLimiter, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const body = req.body as {
      font?: {
        name?: unknown;
        classification?: unknown;
        foundry?: unknown;
        width?: unknown;
        isVariable?: unknown;
        stylesCount?: unknown;
        weights?: unknown;
        tags?: unknown;
      };
      context?: unknown;
      selectedRole?: unknown;
      customBrief?: unknown;
      theme?: unknown;
      previewText?: unknown;
      userLibraryFamilies?: unknown;
      forceRefresh?: unknown;
    };

    const fontName = String(body?.font?.name || '').trim().slice(0, 80);
    if (!fontName) {
      res.status(400).json({ error: 'A selected font family name is required.' });
      return;
    }

    const rawContext = String(body?.context || 'saas-ui').trim().toLowerCase();
    const contextKey = rawContext in ALLOWED_CONTEXTS ? rawContext : 'saas-ui';
    const rawRole = String(body?.selectedRole || 'auto').trim().toLowerCase();
    const selectedRole = ALLOWED_ROLES.has(rawRole) ? rawRole : 'auto';
    const customBrief = String(body?.customBrief || '').trim().slice(0, 160);
    const theme = String(body?.theme || 'light').trim().slice(0, 16);
    const previewText = String(body?.previewText || '').trim().slice(0, 120);
    const classification = String(body?.font?.classification || 'Sans Serif').trim().slice(0, 40);
    const width = String(body?.font?.width || 'Normal').trim().slice(0, 24);
    const isVariable = Boolean(body?.font?.isVariable);
    const weights = Array.isArray(body?.font?.weights)
      ? body.font.weights
          .map((w) => Number(w))
          .filter((w) => Number.isFinite(w) && w >= 100 && w <= 900)
          .slice(0, 10)
      : [400];
    const userLibraryFamilies = Array.isArray(body?.userLibraryFamilies)
      ? body.userLibraryFamilies
          .map((f) => String(f).trim().slice(0, 64))
          .filter((f) => f && f.toLowerCase() !== fontName.toLowerCase())
          .slice(0, 30)
      : [];
    const forceRefresh = Boolean(body?.forceRefresh);

    const cacheKey = crypto
      .createHash('sha1')
      .update(
        JSON.stringify({
          fontName: fontName.toLowerCase(),
          classification,
          contextKey,
          selectedRole,
          customBrief: customBrief.toLowerCase(),
          theme,
        }),
      )
      .digest('hex');

    if (!forceRefresh) {
      const cached = pairingCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < PAIRING_CACHE_TTL_MS) {
        res.json({ ...(cached.data as Record<string, unknown>), cached: true });
        return;
      }
      const existingInflight = pairingInFlight.get(cacheKey);
      if (existingInflight) {
        try {
          const sharedPayload = await existingInflight;
          res.json(sharedPayload);
          return;
        } catch (err) {
          if (err instanceof UpstreamHttpError) {
            res.status(err.status).json({ error: err.message });
            return;
          }
          res.status(502).json({ error: err instanceof Error ? err.message : 'Unable to generate font pairings.' });
          return;
        }
      }
    }

    const runPairingTask = async (): Promise<Record<string, unknown>> => {
      const ai = getGeminiClient();

      // Build fast canonical lookup from the cached Google Fonts directory without bloating the prompt
      let catalogLookup = new Map<string, string>();
      try {
        const catalog = await fetchLiveGoogleFontsCatalog();
        catalogLookup = new Map(catalog.items.map((item) => [item.family.toLowerCase(), item.family]));
      } catch {
        // Proceed even if catalog metadata temporarily unavailable
      }

      const roleDirective =
        selectedRole === 'heading'
          ? `Use "${fontName}" for HEADINGS; suggest complementary fonts for Body, UI/Labels, and Code/Accent.`
          : selectedRole === 'body'
            ? `Use "${fontName}" for BODY COPY; suggest complementary fonts for Headings/Display, UI/Labels, and Accent/Mono.`
            : selectedRole === 'ui'
              ? `Use "${fontName}" for UI CONTROLS & LABELS; suggest complementary fonts for Display Headings, Body copy, and Mono.`
              : `Pick the best primary role for "${fontName}" and suggest 3 complementary partner fonts covering Headings, Body, and UI/Accent.`;

      const prompt = [
        `Analyze the typeface "${fontName}" (${classification}, ${width} width${isVariable ? ', variable' : ''}, weights: ${weights.join(', ') || '400'}) and suggest 3 complementary Google Fonts pairings.`,
        `Context: ${ALLOWED_CONTEXTS[contextKey]} (${theme} mode).`,
        customBrief ? `Brief: ${customBrief}` : '',
        previewText ? `Sample text: "${previewText}"` : '',
        `Role guidance: ${roleDirective}`,
        userLibraryFamilies.length > 0
          ? `User workspace fonts you may also consider: ${userLibraryFamilies.slice(0, 15).join(', ')}`
          : '',
        `Rules: Never suggest "${fontName}" itself. Use exact real Google Fonts family names (or listed workspace fonts). Keep rationale crisp (1-2 sentences).`,
      ]
        .filter(Boolean)
        .join('\n');

      const requestParams = {
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a principal typographer and design systems director. Return concise, high-craft font pairings strictly matching the JSON schema.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.OBJECT,
                properties: {
                  personality: {
                    type: Type.STRING,
                    description: '2-4 word typographic personality (e.g. Neo-grotesque precision)',
                  },
                  idealRole: {
                    type: Type.STRING,
                    description: 'Heading, Body, UI, or Accent',
                  },
                  summary: {
                    type: Type.STRING,
                    description: 'One concise sentence assessing the typeface.',
                  },
                },
                required: ['personality', 'idealRole', 'summary'],
              },
              pairings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    family: {
                      type: Type.STRING,
                      description: 'Exact Google Fonts family name (e.g. Inter, Newsreader, JetBrains Mono).',
                    },
                    role: {
                      type: Type.STRING,
                      description: 'Heading, Body, UI & Labels, Code / Mono, or Accent.',
                    },
                    classification: {
                      type: Type.STRING,
                      description: 'Sans Serif, Serif, Slab Serif, Display, or Monospace.',
                    },
                    rationale: {
                      type: Type.STRING,
                      description: '1-2 concise sentences explaining why this pairing works typographically.',
                    },
                    recommendedWeights: {
                      type: Type.STRING,
                      description: 'e.g. 400 Regular / 500 Medium.',
                    },
                    sizeRatio: {
                      type: Type.STRING,
                      description: 'e.g. 15px / 1.6 leading or 2.0x heading ratio.',
                    },
                    harmonyScore: {
                      type: Type.INTEGER,
                      description: 'Harmony score from 82 to 99.',
                    },
                    sampleHeadline: {
                      type: Type.STRING,
                      description: 'Short 3-6 word headline matching the design context.',
                    },
                    sampleBody: {
                      type: Type.STRING,
                      description: 'Short 1-sentence body/UI copy (8-15 words).',
                    },
                  },
                  required: [
                    'family',
                    'role',
                    'classification',
                    'rationale',
                    'recommendedWeights',
                    'sizeRatio',
                    'harmonyScore',
                    'sampleHeadline',
                    'sampleBody',
                  ],
                },
              },
            },
            required: ['analysis', 'pairings'],
          },
        },
      };

      const response = await ai.models.generateContent(requestParams);
      const responseText = response.text;

      if (!responseText) {
        throw new Error('Empty response from Gemini API.');
      }

      const parsed = JSON.parse(responseText.trim()) as {
        analysis?: { personality?: string; idealRole?: string; summary?: string };
        pairings?: Array<{
          family?: string;
          role?: string;
          classification?: string;
          rationale?: string;
          recommendedWeights?: string;
          sizeRatio?: string;
          harmonyScore?: number;
          sampleHeadline?: string;
          sampleBody?: string;
        }>;
      };

      const seenFamilies = new Set<string>([fontName.toLowerCase()]);
      const pairings = (parsed.pairings ?? [])
        .map((p) => {
          const rawFamily = String(p.family || '').trim();
          if (!rawFamily) return null;
          const lower = rawFamily.toLowerCase();
          if (seenFamilies.has(lower)) return null;
          seenFamilies.add(lower);

          const canonical = catalogLookup.get(lower);
          return {
            family: canonical || rawFamily,
            role: String(p.role || 'Body').slice(0, 32),
            classification: String(p.classification || 'Sans Serif').slice(0, 32),
            rationale: String(p.rationale || '').slice(0, 320),
            recommendedWeights: String(p.recommendedWeights || '400 Regular').slice(0, 64),
            sizeRatio: String(p.sizeRatio || '1.5x scale').slice(0, 64),
            harmonyScore: Math.max(60, Math.min(99, Math.round(Number(p.harmonyScore) || 90))),
            sampleHeadline: String(p.sampleHeadline || `${fontName} × ${canonical || rawFamily}`).slice(0, 90),
            sampleBody: String(
              p.sampleBody || 'Balanced hierarchy with clear optical rhythm across headings and interface copy.',
            ).slice(0, 180),
            inGoogleCatalog: Boolean(canonical),
          };
        })
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .slice(0, 4);

      if (pairings.length === 0) {
        throw new UpstreamHttpError(502, 'Gemini did not return valid pairing suggestions. Please try again.');
      }

      const payload: Record<string, unknown> = {
        fontName,
        context: contextKey,
        selectedRole,
        analysis: {
          personality: String(parsed.analysis?.personality || `${classification} voice`).slice(0, 80),
          idealRole: String(parsed.analysis?.idealRole || 'Heading').slice(0, 32),
          summary: String(
            parsed.analysis?.summary ||
              `A versatile ${classification.toLowerCase()} typeface suited for clear typographic hierarchy.`,
          ).slice(0, 260),
        },
        pairings,
      };

      if (pairingCache.size >= MAX_PAIRING_CACHE_ENTRIES && !pairingCache.has(cacheKey)) {
        const oldestKey = pairingCache.keys().next().value;
        if (oldestKey !== undefined) pairingCache.delete(oldestKey);
      }
      pairingCache.set(cacheKey, { fetchedAt: Date.now(), data: payload });

      return payload;
    };

    const task = runPairingTask().finally(() => {
      if (pairingInFlight.get(cacheKey) === task) {
        pairingInFlight.delete(cacheKey);
      }
    });
    pairingInFlight.set(cacheKey, task);

    try {
      const payload = await task;
      res.json(payload);
    } catch (err) {
      if (err instanceof UpstreamHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      const status = (err as { status?: number })?.status;
      const rawMsg = err instanceof Error ? err.message : 'Unable to generate font pairings.';
      if (status === 400 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(rawMsg)) {
        res.status(502).json({
          error: 'Gemini API authentication failed. Check GEMINI_API_KEY in your server environment variables.',
        });
        return;
      }
      if (status === 429 || /RESOURCE_EXHAUSTED/i.test(rawMsg)) {
        res.status(429).json({
          error: 'Gemini API quota reached. Please wait a moment or check your billing quota.',
        });
        return;
      }
      if (/timeout|aborted/i.test(rawMsg)) {
        res.status(504).json({
          error: 'AI pairing request timed out. Please retry.',
        });
        return;
      }
      res.status(502).json({ error: rawMsg });
    }
  });

  // Clean JSON fallback for malformed request bodies or unexpected middleware errors
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(status).json({ error: message });
  });

  return app;
}

// Self-contained Vercel Serverless Function handler (zero cross-file relative imports for Node ESM safety)
let cachedVercelApp: Express | null = null;

export default function handler(req: Request, res: Response) {
  if (!cachedVercelApp) {
    cachedVercelApp = createApiApp({ enableCompression: false });
  }
  return cachedVercelApp(req, res);
}
