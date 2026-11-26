import type {
  DuplicateGroup,
  FilterState,
  FontFamily,
  FontList,
  OpenTypeState,
  SidebarDestination,
  SmartList,
  SmartRule,
} from '../types/font';

export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  classification: 'All',
  format: 'All',
  width: 'All',
  language: 'All',
  status: 'All',
  weightFilter: 'All',
  sort: 'name-asc',
};

export function evaluateSmartRule(font: FontFamily, rule: SmartRule): boolean {
  const val = rule.value.trim().toLowerCase();
  if (!val) return true;

  switch (rule.field) {
    case 'classification':
      return rule.operator === 'contains'
        ? font.classification.toLowerCase().includes(val)
        : font.classification.toLowerCase() === val;

    case 'format':
      return rule.operator === 'contains'
        ? font.format.toLowerCase().includes(val)
        : font.format.toLowerCase() === val;

    case 'foundry':
      return rule.operator === 'contains'
        ? font.foundry.toLowerCase().includes(val)
        : font.foundry.toLowerCase() === val;

    case 'license':
      return rule.operator === 'contains'
        ? font.license.toLowerCase().includes(val)
        : font.license.toLowerCase() === val;

    case 'tag':
      return font.tags.some((t) =>
        rule.operator === 'contains' ? t.toLowerCase().includes(val) : t.toLowerCase() === val,
      );

    case 'isVariable':
      return font.isVariable === (val === 'true' || val === 'yes');

    case 'activated':
      return font.activated === (val === 'true' || val === 'yes');

    case 'minStyles': {
      const target = Number(val);
      if (Number.isNaN(target)) return true;
      return font.styles.length >= target;
    }

    default:
      return true;
  }
}

export function matchesSmartList(font: FontFamily, smartList: SmartList): boolean {
  if (smartList.rules.length === 0) return true;
  if (smartList.matchMode === 'all') {
    return smartList.rules.every((rule) => evaluateSmartRule(font, rule));
  }
  return smartList.rules.some((rule) => evaluateSmartRule(font, rule));
}

export function isRecentFont(font: FontFamily, referenceDateIso?: string): boolean {
  const refTime = referenceDateIso ? new Date(referenceDateIso).getTime() : Date.now();
  const addedTime = new Date(font.addedAt).getTime();
  if (Number.isNaN(addedTime) || Number.isNaN(refTime)) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return refTime - addedTime <= thirtyDaysMs || font.isCustomUpload === true;
}

export function filterByDestination(
  fonts: FontFamily[],
  destination: SidebarDestination,
  fontLists: FontList[],
  smartLists: SmartList[],
): FontFamily[] {
  switch (destination.type) {
    case 'all':
      return fonts;
    case 'activated':
      return fonts.filter((f) => f.activated);
    case 'deactivated':
      return fonts.filter((f) => !f.activated);
    case 'starred':
      return fonts.filter((f) => f.starred);
    case 'recent':
      return fonts.filter((f) => isRecentFont(f));
    case 'icons':
      return [];
    case 'library':
      return fonts.filter((f) => f.libraryId === destination.id);
    case 'list': {
      const list = fontLists.find((l) => l.id === destination.id);
      if (!list) return [];
      const set = new Set(list.fontIds);
      return fonts.filter((f) => set.has(f.id));
    }
    case 'smart': {
      const smart = smartLists.find((s) => s.id === destination.id);
      if (!smart) return [];
      return fonts.filter((f) => matchesSmartList(f, smart));
    }
  }
}

function matchesWeightBand(font: FontFamily, band: FilterState['weightFilter']): boolean {
  if (band === 'All') return true;
  if (band === 'Light') return font.styles.some((s) => s.weight <= 300);
  if (band === 'Regular') return font.styles.some((s) => s.weight >= 400 && s.weight <= 500);
  if (band === 'Bold') return font.styles.some((s) => s.weight >= 600);
  return true;
}

export function applyFontFilters(
  fonts: FontFamily[],
  destination: SidebarDestination,
  filters: FilterState,
  fontLists: FontList[],
  smartLists: SmartList[],
): FontFamily[] {
  const scoped = filterByDestination(fonts, destination, fontLists, smartLists);
  const query = filters.search.trim().toLowerCase();

  const filtered = scoped.filter((font) => {
    if (query) {
      const haystack = [
        font.name,
        font.foundry,
        font.designer,
        font.classification,
        font.license,
        ...font.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (filters.classification !== 'All' && font.classification !== filters.classification) {
      return false;
    }

    if (filters.format !== 'All') {
      if (filters.format === 'Variable') {
        if (!font.isVariable) return false;
      } else if (font.format !== filters.format) {
        return false;
      }
    }

    if (filters.width !== 'All' && font.width !== filters.width) {
      return false;
    }

    if (filters.language !== 'All') {
      const targetLang = filters.language.toLowerCase();
      const hasMatch = font.languages.some((l) => {
        const lower = l.toLowerCase();
        if (lower === targetLang) return true;
        if (targetLang === 'latin ext' && (lower === 'latin extended' || lower === 'latin ext')) {
          return true;
        }
        return lower.startsWith(`${targetLang} `);
      });
      if (!hasMatch) return false;
    }

    if (filters.status === 'Activated' && !font.activated) return false;
    if (filters.status === 'Deactivated' && font.activated) return false;

    if (!matchesWeightBand(font, filters.weightFilter)) return false;

    return true;
  });

  const sorted = [...filtered];
  switch (filters.sort) {
    case 'trending':
      sorted.sort(
        (a, b) =>
          (a.trendingRank ?? 99999) - (b.trendingRank ?? 99999) || a.name.localeCompare(b.name),
      );
      break;
    case 'popular':
      sorted.sort(
        (a, b) =>
          (a.popularityRank ?? 99999) - (b.popularityRank ?? 99999) || a.name.localeCompare(b.name),
      );
      break;
    case 'newest':
    case 'recent':
      sorted.sort(
        (a, b) =>
          new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime() ||
          a.name.localeCompare(b.name),
      );
      break;
    case 'name-asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'styles-desc':
      sorted.sort((a, b) => b.styles.length - a.styles.length || a.name.localeCompare(b.name));
      break;
  }

  return sorted;
}

export function countActiveFilterFacets(filters: FilterState): number {
  let count = 0;
  if (filters.classification !== 'All') count += 1;
  if (filters.format !== 'All') count += 1;
  if (filters.width !== 'All') count += 1;
  if (filters.language !== 'All') count += 1;
  if (filters.status !== 'All') count += 1;
  if (filters.weightFilter !== 'All') count += 1;
  return count;
}

const BROWSE_CATALOG_LIBRARY_IDS = new Set([
  'lib-google',
  'lib-fontshare',
  'lib-collletttivo',
  'lib-openfoundry',
  'lib-uncut',
]);

export function isBrowseCatalogFont(font: FontFamily): boolean {
  return BROWSE_CATALOG_LIBRARY_IDS.has(font.libraryId) && !font.isCustomUpload;
}

export function getDuplicatePriority(font: FontFamily): number {
  const { libraryId } = font;
  if (libraryId === 'lib-local' || libraryId === 'lib-system-os' || libraryId.startsWith('lib-folder')) {
    return 1;
  }
  if (
    libraryId.startsWith('lib-gdrive') ||
    libraryId.startsWith('lib-icloud') ||
    libraryId.startsWith('lib-box') ||
    libraryId.startsWith('lib-adobe')
  ) {
    return 2;
  }
  if (libraryId === 'lib-collletttivo' || libraryId === 'lib-openfoundry' || libraryId === 'lib-uncut') {
    return 3;
  }
  if (libraryId === 'lib-fontshare') return 4;
  if (libraryId === 'lib-google') return 5;
  return 3;
}

export function formatFontVersion(version?: string): string {
  const trimmed = (version ?? '').trim();
  if (!trimmed) return '';
  if (/^live$/i.test(trimmed)) return 'Live';
  if (/^v\d/i.test(trimmed)) return trimmed;
  return `v${trimmed}`;
}

export function findDuplicateFonts(fonts: FontFamily[]): DuplicateGroup[] {
  const byName = new Map<string, FontFamily[]>();

  for (const font of fonts) {
    const normalized = font.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const list = byName.get(normalized) ?? [];
    list.push(font);
    byName.set(normalized, list);
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [normalizedName, group] of byName.entries()) {
    if (group.length <= 1) continue;

    // Only flag real conflicts: 2+ active copies, or 2+ user-owned (local/synced/uploaded) copies.
    // Inactive entries appearing in multiple free browse catalogs (e.g. Google Fonts & Fontshare) are ignored.
    const relevant = group.filter((f) => f.activated || !isBrowseCatalogFont(f));
    const activeCount = relevant.filter((f) => f.activated).length;
    const userOwnedCount = relevant.filter((f) => !isBrowseCatalogFont(f)).length;
    if (activeCount < 2 && userOwnedCount < 2) continue;

    const sorted = [...relevant].sort(
      (a, b) =>
        getDuplicatePriority(a) - getDuplicatePriority(b) ||
        Number(b.activated) - Number(a.activated) ||
        Number(b.isVariable) - Number(a.isVariable) ||
        b.styles.length - a.styles.length,
    );

    const libs = new Set(sorted.map((g) => g.libraryId));
    const formats = new Set(sorted.map((g) => g.format));
    const hasActiveConflict = activeCount >= 2;

    let reason = 'Duplicate copies in the same library';
    if (hasActiveConflict && libs.size > 1) {
      reason = 'Active across multiple font libraries';
    } else if (hasActiveConflict) {
      reason = 'Multiple active copies in the same library';
    } else if (libs.size > 1) {
      reason = 'Duplicate copies across multiple font libraries';
    } else if (formats.size > 1) {
      reason = 'Conflicting font formats in same library';
    }

    duplicates.push({
      normalizedName,
      displayName: sorted[0].name,
      fonts: sorted,
      reason,
      hasActiveConflict,
    });
  }

  return duplicates.sort(
    (a, b) =>
      Number(Boolean(b.hasActiveConflict)) - Number(Boolean(a.hasActiveConflict)) ||
      a.displayName.localeCompare(b.displayName),
  );
}

export function buildOpenTypeFeatureSettings(ot: OpenTypeState): string {
  const features = [
    `"liga" ${ot.liga ? 1 : 0}`,
    `"dlig" ${ot.dlig ? 1 : 0}`,
    `"tnum" ${ot.tnum ? 1 : 0}`,
    `"onum" ${ot.onum ? 1 : 0}`,
    `"smcp" ${ot.smcp ? 1 : 0}`,
    `"zero" ${ot.zero ? 1 : 0}`,
  ];
  return features.join(', ');
}

export function generateFontCssSnippet(font: FontFamily): string {
  const fallback =
    font.classification === 'Serif' || font.classification === 'Slab Serif'
      ? 'Georgia, serif'
      : font.classification === 'Monospace'
        ? 'ui-monospace, monospace'
        : font.classification === 'Script' || font.classification === 'Handwritten'
          ? 'cursive'
          : 'system-ui, sans-serif';

  const encoded = font.name.replace(/\s+/g, '+');
  const weights = Array.from(new Set(font.styles.map((s) => s.weight))).sort((a, b) => a - b);
  const importLine = font.adobeKitId
    ? `@import url('https://use.typekit.net/${font.adobeKitId}.css');`
    : font.isCustomUpload
      ? `/* Loaded locally from Fontainer Library (${font.format}) */`
      : `@import url('https://fonts.googleapis.com/css2?family=${encoded}:wght@${weights.join(';')}&display=swap');`;

  return `${importLine}

.typography-${font.id} {
  font-family: '${font.name}', ${fallback};
  font-weight: ${weights[0] ?? 400};
}`;
}

export function formatFileSize(totalKb: number): string {
  if (totalKb >= 1024) {
    return `${(totalKb / 1024).toFixed(2)} MB`;
  }
  return `${Math.round(totalKb)} KB`;
}
