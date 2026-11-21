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

export function isRecentFont(font: FontFamily, referenceDateIso = '2026-11-20T00:00:00Z'): boolean {
  const refTime = new Date(referenceDateIso).getTime();
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

    if (filters.language !== 'All' && !font.languages.includes(filters.language)) {
      return false;
    }

    if (filters.status === 'Activated' && !font.activated) return false;
    if (filters.status === 'Deactivated' && font.activated) return false;

    if (!matchesWeightBand(font, filters.weightFilter)) return false;

    return true;
  });

  const sorted = [...filtered];
  switch (filters.sort) {
    case 'name-asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'styles-desc':
      sorted.sort((a, b) => b.styles.length - a.styles.length || a.name.localeCompare(b.name));
      break;
    case 'recent':
      sorted.sort(
        (a, b) =>
          new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime() ||
          a.name.localeCompare(b.name),
      );
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
    if (group.length > 1) {
      const libs = new Set(group.map((g) => g.libraryId));
      const formats = new Set(group.map((g) => g.format));
      let reason = 'Duplicate family entry';
      if (libs.size > 1) {
        reason = 'Installed across multiple font libraries';
      } else if (formats.size > 1) {
        reason = 'Conflicting font formats in same library';
      }
      duplicates.push({
        normalizedName,
        displayName: group[0].name,
        fonts: group,
        reason,
      });
    }
  }

  return duplicates.sort((a, b) => a.displayName.localeCompare(b.displayName));
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
  const importLine = font.isCustomUpload
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
