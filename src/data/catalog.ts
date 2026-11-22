import type {
  AppIntegration,
  FontFamily,
  FontLibrary,
  FontList,
  PreviewSettings,
  SmartList,
} from '../types/font';

export const INITIAL_LIBRARIES: FontLibrary[] = [
  {
    id: 'lib-google',
    name: 'Google Fonts',
    provider: 'google',
    path: 'https://fonts.google.com',
    syncedAt: new Date().toISOString(),
    autoSync: true,
  },
  {
    id: 'lib-local',
    name: 'Local & Imported',
    provider: 'local',
    path: 'Local Device (IndexedDB / OS)',
    syncedAt: new Date().toISOString(),
    autoSync: false,
  },
];

export const INITIAL_FONT_LISTS: FontList[] = [];

export const INITIAL_SMART_LISTS: SmartList[] = [
  {
    id: 'smart-variable',
    name: 'Variable Fonts',
    matchMode: 'all',
    rules: [{ id: 'r1', field: 'isVariable', operator: 'equals', value: 'true' }],
  },
  {
    id: 'smart-mono',
    name: 'Monospace Faces',
    matchMode: 'all',
    rules: [{ id: 'r2', field: 'classification', operator: 'equals', value: 'Monospace' }],
  },
];

export const INITIAL_APP_INTEGRATIONS: AppIntegration[] = [
  {
    id: 'figma',
    name: 'Figma',
    bundleId: 'com.figma.Desktop',
    autoActivate: true,
    detected: true,
  },
  {
    id: 'photoshop',
    name: 'Adobe Photoshop',
    bundleId: 'com.adobe.Photoshop',
    autoActivate: true,
    detected: true,
  },
  {
    id: 'illustrator',
    name: 'Adobe Illustrator',
    bundleId: 'com.adobe.illustrator',
    autoActivate: true,
    detected: true,
  },
  {
    id: 'indesign',
    name: 'Adobe InDesign',
    bundleId: 'com.adobe.InDesign',
    autoActivate: false,
    detected: true,
  },
  {
    id: 'sketch',
    name: 'Sketch',
    bundleId: 'com.bohemiancoding.sketch3',
    autoActivate: false,
    detected: true,
  },
];

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  text: 'Sphinx of black quartz, judge my vow — 0123456789',
  fontSize: 34,
  lineHeight: 1.25,
  letterSpacing: 0,
  textCase: 'none',
  textAlign: 'left',
  foregroundColor: '',
  backgroundColor: '',
  openType: {
    liga: true,
    dlig: false,
    tnum: false,
    onum: false,
    smcp: false,
    zero: false,
  },
};

export const PREVIEW_PRESETS: Array<{ label: string; text: string }> = [
  { label: 'Pangram', text: 'Sphinx of black quartz, judge my vow — 0123456789' },
  { label: 'Editorial Headline', text: 'The Quiet Craft of Swiss Typography & Modern Grid Systems' },
  { label: 'Alphabet', text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz' },
  { label: 'Numerals & Symbols', text: '0123456789 $4,280.95 €990 £120 % # & @ — (1984–2026)' },
  { label: 'Code & Ligatures', text: 'const sync = (a !== b) => a >= 0 && b <= 99; // fi fl ->' },
];

// Production builds start with zero fake fonts; live Google Fonts, Adobe Kits, Cloud Drives, and Local files populate dynamically.
export const INITIAL_FONTS: FontFamily[] = [];
