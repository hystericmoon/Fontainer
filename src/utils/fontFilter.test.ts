import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFontFilters,
  buildOpenTypeFeatureSettings,
  countActiveFilterFacets,
  DEFAULT_FILTER_STATE,
  evaluateSmartRule,
  findDuplicateFonts,
  formatFileSize,
  formatFontVersion,
  generateFontCssSnippet,
  matchesSmartList,
} from './fontFilter';
import type { FontFamily, FontList, SmartList } from '../types/font';

const SAMPLE_FONTS: FontFamily[] = [
  {
    id: 'fraunces',
    name: 'Fraunces',
    cssFamily: "'Fraunces', serif",
    foundry: 'Undercase Type',
    designer: 'Phaedra Charles',
    classification: 'Serif',
    format: 'Variable',
    width: 'Normal',
    isVariable: true,
    license: 'SIL OFL 1.1',
    version: '1.0',
    languages: ['Latin', 'Latin Extended'],
    openTypeFeatures: ['liga', 'onum', 'smcp'],
    libraryId: 'lib-google',
    addedAt: '2026-11-15T10:00:00Z',
    starred: true,
    activated: true,
    tags: ['editorial', 'display', 'warm'],
    notes: '',
    styles: [
      { id: 'f-1', name: 'Light', weight: 300, italic: false, postScriptName: 'Fraunces-Light', activated: true, fileSizeKb: 112 },
      { id: 'f-2', name: 'Regular', weight: 400, italic: false, postScriptName: 'Fraunces-Regular', activated: true, fileSizeKb: 118 },
      { id: 'f-3', name: 'Bold', weight: 700, italic: false, postScriptName: 'Fraunces-Bold', activated: true, fileSizeKb: 121 },
    ],
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    cssFamily: "'JetBrains Mono', monospace",
    foundry: 'JetBrains',
    designer: 'Philipp Nurullin',
    classification: 'Monospace',
    format: 'TTF',
    width: 'Normal',
    isVariable: true,
    license: 'SIL OFL 1.1',
    version: '2.304',
    languages: ['Latin', 'Cyrillic', 'Greek'],
    openTypeFeatures: ['liga', 'zero', 'tnum'],
    libraryId: 'lib-local',
    addedAt: '2026-08-01T10:00:00Z',
    starred: false,
    activated: false,
    tags: ['code', 'technical'],
    notes: '',
    styles: [
      { id: 'j-1', name: 'Regular', weight: 400, italic: false, postScriptName: 'JetBrainsMono-Regular', activated: false, fileSizeKb: 95 },
      { id: 'j-2', name: 'Bold', weight: 700, italic: false, postScriptName: 'JetBrainsMono-Bold', activated: false, fileSizeKb: 98 },
    ],
  },
  {
    id: 'fraunces-dup',
    name: 'Fraunces',
    cssFamily: "'Fraunces', serif",
    foundry: 'Undercase Type',
    designer: 'Phaedra Charles',
    classification: 'Serif',
    format: 'OTF',
    width: 'Normal',
    isVariable: false,
    license: 'SIL OFL 1.1',
    version: '0.9',
    languages: ['Latin'],
    openTypeFeatures: ['liga'],
    libraryId: 'lib-icloud',
    addedAt: '2026-05-01T10:00:00Z',
    starred: false,
    activated: true,
    tags: ['archive'],
    notes: '',
    styles: [
      { id: 'fd-1', name: 'Regular', weight: 400, italic: false, postScriptName: 'Fraunces-Regular', activated: true, fileSizeKb: 84 },
    ],
  },
];

const SAMPLE_LISTS: FontList[] = [
  { id: 'list-brand', name: 'Brand Kit', color: '#007AFF', fontIds: ['fraunces'], createdAt: '2026-10-01T00:00:00Z' },
];

const SAMPLE_SMART_LISTS: SmartList[] = [
  {
    id: 'smart-var',
    name: 'Variable Serif',
    matchMode: 'all',
    rules: [
      { id: 'r1', field: 'isVariable', operator: 'equals', value: 'true' },
      { id: 'r2', field: 'classification', operator: 'equals', value: 'Serif' },
    ],
  },
];

test('evaluateSmartRule checks classification, variable flag, and minStyles', () => {
  assert.equal(
    evaluateSmartRule(SAMPLE_FONTS[0], { id: '1', field: 'classification', operator: 'equals', value: 'Serif' }),
    true,
  );
  assert.equal(
    evaluateSmartRule(SAMPLE_FONTS[0], { id: '2', field: 'minStyles', operator: 'gte', value: '3' }),
    true,
  );
  assert.equal(
    evaluateSmartRule(SAMPLE_FONTS[1], { id: '3', field: 'minStyles', operator: 'gte', value: '3' }),
    false,
  );
});

test('matchesSmartList respects matchMode all vs any', () => {
  assert.equal(matchesSmartList(SAMPLE_FONTS[0], SAMPLE_SMART_LISTS[0]), true);
  assert.equal(matchesSmartList(SAMPLE_FONTS[1], SAMPLE_SMART_LISTS[0]), false);

  const anySmart: SmartList = { ...SAMPLE_SMART_LISTS[0], matchMode: 'any' };
  assert.equal(matchesSmartList(SAMPLE_FONTS[1], anySmart), true);
});

test('applyFontFilters scopes by destination, search, facets, and sorting', () => {
  const activeOnly = applyFontFilters(
    SAMPLE_FONTS,
    { type: 'activated' },
    DEFAULT_FILTER_STATE,
    SAMPLE_LISTS,
    SAMPLE_SMART_LISTS,
  );
  assert.equal(activeOnly.length, 2);

  const listScoped = applyFontFilters(
    SAMPLE_FONTS,
    { type: 'list', id: 'list-brand' },
    DEFAULT_FILTER_STATE,
    SAMPLE_LISTS,
    SAMPLE_SMART_LISTS,
  );
  assert.deepEqual(listScoped.map((f) => f.id), ['fraunces']);

  const searchCyrl = applyFontFilters(
    SAMPLE_FONTS,
    { type: 'all' },
    { ...DEFAULT_FILTER_STATE, language: 'Cyrillic', search: 'jetbrains' },
    SAMPLE_LISTS,
    SAMPLE_SMART_LISTS,
  );
  assert.deepEqual(searchCyrl.map((f) => f.id), ['jetbrains-mono']);

  const sortedByStyles = applyFontFilters(
    SAMPLE_FONTS,
    { type: 'all' },
    { ...DEFAULT_FILTER_STATE, sort: 'styles-desc' },
    SAMPLE_LISTS,
    SAMPLE_SMART_LISTS,
  );
  assert.equal(sortedByStyles[0].id, 'fraunces');
  assert.equal(sortedByStyles[2].id, 'fraunces-dup');
});

test('findDuplicateFonts detects cross-library duplicate font families', () => {
  const dupes = findDuplicateFonts(SAMPLE_FONTS);
  assert.equal(dupes.length, 1);
  assert.equal(dupes[0].displayName, 'Fraunces');
  assert.equal(dupes[0].fonts.length, 2);
  assert.equal(dupes[0].hasActiveConflict, true);
  assert.match(dupes[0].reason, /multiple font libraries/i);
});

test('findDuplicateFonts ignores inactive catalog-only overlaps and flags real conflicts', () => {
  const base = SAMPLE_FONTS[0];
  const inactiveCatalogOverlap: FontFamily[] = [
    { ...base, id: 'anton-fs', name: 'Anton', libraryId: 'lib-fontshare', activated: false },
    { ...base, id: 'anton-gf', name: 'Anton', libraryId: 'lib-google', activated: false },
  ];
  assert.deepEqual(findDuplicateFonts(inactiveCatalogOverlap), []);

  const activeCatalogOverlap: FontFamily[] = [
    { ...base, id: 'anton-gf', name: 'Anton', libraryId: 'lib-google', activated: true },
    { ...base, id: 'anton-fs', name: 'Anton', libraryId: 'lib-fontshare', activated: true },
  ];
  const activeDupes = findDuplicateFonts(activeCatalogOverlap);
  assert.equal(activeDupes.length, 1);
  assert.equal(activeDupes[0].hasActiveConflict, true);
  assert.equal(activeDupes[0].fonts[0].libraryId, 'lib-fontshare');

  const singleLocalPlusInactiveCatalog: FontFamily[] = [
    { ...base, id: 'inter-local', name: 'Inter', libraryId: 'lib-local', isCustomUpload: true, activated: false },
    { ...base, id: 'inter-gf', name: 'Inter', libraryId: 'lib-google', activated: false },
  ];
  assert.deepEqual(findDuplicateFonts(singleLocalPlusInactiveCatalog), []);

  const multiUserOwnedInactive: FontFamily[] = [
    { ...base, id: 'inter-gdrive', name: 'Inter', libraryId: 'lib-gdrive', isCustomUpload: true, activated: false },
    { ...base, id: 'inter-local', name: 'Inter', libraryId: 'lib-local', isCustomUpload: true, activated: false },
    { ...base, id: 'inter-gf', name: 'Inter', libraryId: 'lib-google', activated: false },
  ];
  const userOwnedDupes = findDuplicateFonts(multiUserOwnedInactive);
  assert.equal(userOwnedDupes.length, 1);
  assert.equal(userOwnedDupes[0].hasActiveConflict, false);
  assert.deepEqual(
    userOwnedDupes[0].fonts.map((f) => f.id),
    ['inter-local', 'inter-gdrive'],
  );
});

test('formatFontVersion normalizes prefixes cleanly', () => {
  assert.equal(formatFontVersion('v27'), 'v27');
  assert.equal(formatFontVersion('2.116'), 'v2.116');
  assert.equal(formatFontVersion('Live'), 'Live');
  assert.equal(formatFontVersion(''), '');
});

test('countActiveFilterFacets and formatting utilities work accurately', () => {
  assert.equal(countActiveFilterFacets(DEFAULT_FILTER_STATE), 0);
  assert.equal(
    countActiveFilterFacets({ ...DEFAULT_FILTER_STATE, classification: 'Serif', format: 'Variable' }),
    2,
  );
  assert.equal(formatFileSize(512), '512 KB');
  assert.equal(formatFileSize(1536), '1.50 MB');

  const ot = buildOpenTypeFeatureSettings({
    liga: true,
    dlig: false,
    tnum: true,
    onum: false,
    smcp: false,
    zero: true,
  });
  assert.equal(ot, '"liga" 1, "dlig" 0, "tnum" 1, "onum" 0, "smcp" 0, "zero" 1');

  const css = generateFontCssSnippet(SAMPLE_FONTS[0]);
  assert.match(css, /Fraunces/);
  assert.match(css, /@import url/);
});
