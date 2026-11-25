export type FontClassification =
  | 'Sans Serif'
  | 'Serif'
  | 'Slab Serif'
  | 'Display'
  | 'Monospace'
  | 'Script'
  | 'Handwritten';

export type FontFormat = 'OTF' | 'TTF' | 'WOFF2' | 'Variable';

export type FontWidth = 'Condensed' | 'Normal' | 'Expanded';

export type ViewMode = 'list' | 'grid' | 'waterfall' | 'compare';

export type ThemeMode = 'light' | 'dark' | 'sepia';

export type TextCaseMode = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export type TextAlignMode = 'left' | 'center' | 'right';

export type SortOption = 'name-asc' | 'name-desc' | 'styles-desc' | 'recent';

export type LibraryProvider =
  | 'local'
  | 'google'
  | 'adobe'
  | 'gdrive'
  | 'icloud'
  | 'box'
  | 'folder';

export type SidebarDestination =
  | { type: 'all' }
  | { type: 'activated' }
  | { type: 'deactivated' }
  | { type: 'starred' }
  | { type: 'recent' }
  | { type: 'library'; id: string }
  | { type: 'list'; id: string }
  | { type: 'smart'; id: string };

export interface FontStyleVariant {
  id: string;
  name: string;
  weight: number;
  italic: boolean;
  postScriptName: string;
  activated: boolean;
  fileSizeKb: number;
}

export interface FontFamily {
  id: string;
  name: string;
  cssFamily: string;
  foundry: string;
  designer: string;
  classification: FontClassification;
  format: FontFormat;
  width: FontWidth;
  isVariable: boolean;
  license: string;
  version: string;
  languages: string[];
  openTypeFeatures: string[];
  libraryId: string;
  addedAt: string;
  starred: boolean;
  activated: boolean;
  tags: string[];
  notes: string;
  isCustomUpload?: boolean;
  googleFontUrl?: string;
  adobeKitId?: string;
  sourcePath?: string;
  customGlyphs?: string[];
  styles: FontStyleVariant[];
}

export interface FontLibrary {
  id: string;
  name: string;
  provider: LibraryProvider;
  path: string;
  remoteId?: string;
  syncedAt: string;
  autoSync: boolean;
}

export interface AdobeKitRecord {
  kitId: string;
  name: string;
  familyCount: number;
}

export interface FontList {
  id: string;
  name: string;
  color: string;
  fontIds: string[];
  createdAt: string;
}

export type SmartRuleField =
  | 'classification'
  | 'format'
  | 'foundry'
  | 'license'
  | 'tag'
  | 'isVariable'
  | 'activated'
  | 'minStyles';

export type SmartRuleOperator = 'equals' | 'contains' | 'gte';

export interface SmartRule {
  id: string;
  field: SmartRuleField;
  operator: SmartRuleOperator;
  value: string;
}

export interface SmartList {
  id: string;
  name: string;
  matchMode: 'all' | 'any';
  rules: SmartRule[];
}

export interface FilterState {
  search: string;
  classification: FontClassification | 'All';
  format: FontFormat | 'All';
  width: FontWidth | 'All';
  language: string | 'All';
  status: 'All' | 'Activated' | 'Deactivated';
  weightFilter: 'All' | 'Light' | 'Regular' | 'Bold';
  sort: SortOption;
}

export interface OpenTypeState {
  liga: boolean;
  dlig: boolean;
  tnum: boolean;
  onum: boolean;
  smcp: boolean;
  zero: boolean;
}

export interface PreviewSettings {
  text: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textCase: TextCaseMode;
  textAlign: TextAlignMode;
  foregroundColor: string;
  backgroundColor: string;
  openType: OpenTypeState;
}

export interface DuplicateGroup {
  normalizedName: string;
  displayName: string;
  fonts: FontFamily[];
  reason: string;
}
