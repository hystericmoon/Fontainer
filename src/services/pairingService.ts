import type { FontClassification, FontFamily } from '../types/font';

export type PairingContextPreset =
  | 'saas-ui'
  | 'editorial'
  | 'branding'
  | 'marketing'
  | 'docs'
  | 'portfolio';

export type SelectedFontRole = 'auto' | 'heading' | 'body' | 'ui';

export type PairingEngineMode = 'local' | 'gemini-byok';

export const USER_GEMINI_KEY_STORAGE = 'fontainer-user-gemini-key';

export function getSavedUserGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (window.localStorage.getItem(USER_GEMINI_KEY_STORAGE) ?? '').trim();
  } catch {
    return '';
  }
}

export function saveUserGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = key.trim();
    if (trimmed) {
      window.localStorage.setItem(USER_GEMINI_KEY_STORAGE, trimmed);
    } else {
      window.localStorage.removeItem(USER_GEMINI_KEY_STORAGE);
    }
  } catch {
    // ignore storage errors
  }
}

export interface FontPairingSuggestion {
  family: string;
  role: string;
  classification: string;
  rationale: string;
  recommendedWeights: string;
  sizeRatio: string;
  harmonyScore: number;
  sampleHeadline: string;
  sampleBody: string;
  inGoogleCatalog: boolean;
}

export interface FontPairingResponse {
  fontName: string;
  context: PairingContextPreset;
  selectedRole: SelectedFontRole;
  engine: PairingEngineMode;
  analysis: {
    personality: string;
    idealRole: string;
    summary: string;
  };
  pairings: FontPairingSuggestion[];
  cached?: boolean;
}

export interface FetchFontPairingsInput {
  font: FontFamily;
  context: PairingContextPreset;
  selectedRole: SelectedFontRole;
  customBrief?: string;
  theme?: string;
  previewText?: string;
  userLibraryFamilies?: string[];
  allFonts?: FontFamily[];
  engine?: PairingEngineMode;
  userApiKey?: string;
  forceRefresh?: boolean;
}

interface CuratedCandidate {
  family: string;
  classification: FontClassification;
  role: string;
  recommendedWeights: string;
  sizeRatio: string;
  rationale: string;
  inGoogleCatalog: boolean;
}

const CONTEXT_SAMPLES: Record<PairingContextPreset, { headline: string; body: string }> = {
  'saas-ui': {
    headline: 'Ship calmer, sharper product interfaces',
    body: 'Balanced proportions and crisp legibility keep dense dashboards effortless to scan at any size.',
  },
  editorial: {
    headline: 'The Quiet Architecture of Modern Type',
    body: 'Generous x-height and clear stroke contrast create an inviting rhythm for long-form stories and essays.',
  },
  branding: {
    headline: 'Distinctive craft built to endure',
    body: 'Pairing expressive display presence with a disciplined neutral body anchors your visual identity.',
  },
  marketing: {
    headline: 'Design systems that scale with your team',
    body: 'High-impact headlines grab attention immediately while clean body copy drives effortless conversion.',
  },
  docs: {
    headline: 'API Reference & Architecture Guide',
    body: 'Clear hierarchy between headings, prose, and technical code blocks keeps documentation scannable.',
  },
  portfolio: {
    headline: 'Selected Works & Visual Direction',
    body: 'Restrained typographic contrast lets photography and case studies breathe without competing for focus.',
  },
};

const CURATED_BY_CONTEXT: Record<PairingContextPreset, Record<string, CuratedCandidate[]>> = {
  'saas-ui': {
    heading: [
      { family: 'Plus Jakarta Sans', classification: 'Sans Serif', role: 'Heading', recommendedWeights: '600 SemiBold / 700 Bold', sizeRatio: '1.8x heading ratio', rationale: 'Geometric warmth adds character to product headers without sacrificing UI clarity.', inGoogleCatalog: true },
      { family: 'Satoshi', classification: 'Sans Serif', role: 'Heading', recommendedWeights: '600 Medium / 700 Bold', sizeRatio: '1.85x heading ratio', rationale: 'Modernist neo-grotesque proportions give SaaS headlines unmistakable studio polish.', inGoogleCatalog: false },
      { family: 'Space Grotesk', classification: 'Sans Serif', role: 'Heading', recommendedWeights: '600 SemiBold / 700 Bold', sizeRatio: '1.9x heading ratio', rationale: 'Subtle technical quirks create visual tension against neutral interface copy.', inGoogleCatalog: true },
    ],
    body: [
      { family: 'Inter', classification: 'Sans Serif', role: 'Body', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '15px / 1.55 leading', rationale: 'Tall x-height and open apertures keep UI labels and body copy razor sharp at small sizes.', inGoogleCatalog: true },
      { family: 'DM Sans', classification: 'Sans Serif', role: 'UI & Labels', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '14px / 1.5 leading', rationale: 'Low-contrast geometric strokes maintain clean optical rhythm across forms and navigation.', inGoogleCatalog: true },
      { family: 'General Sans', classification: 'Sans Serif', role: 'Body', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '15px / 1.55 leading', rationale: 'Rationalist clarity pairs smoothly with expressive display or serif headings.', inGoogleCatalog: false },
    ],
    accent: [
      { family: 'JetBrains Mono', classification: 'Monospace', role: 'Code / Mono', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '13px / 1.5 leading', rationale: 'Tabular precision makes metrics, badges, shortcuts, and code snippets immediately scannable.', inGoogleCatalog: true },
      { family: 'IBM Plex Mono', classification: 'Monospace', role: 'Code / Mono', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '13px / 1.5 leading', rationale: 'Engineered rhythm brings editorial authority to technical metadata and labels.', inGoogleCatalog: true },
    ],
  },
  editorial: {
    heading: [
      { family: 'Playfair Display', classification: 'Serif', role: 'Heading', recommendedWeights: '600 SemiBold / 700 Bold', sizeRatio: '2.2x headline scale', rationale: 'High-contrast transitional serifs deliver classic magazine drama above clean body prose.', inGoogleCatalog: true },
      { family: 'Instrument Serif', classification: 'Serif', role: 'Heading', recommendedWeights: '400 Regular / Italic', sizeRatio: '2.4x headline scale', rationale: 'Condensed editorial elegance creates instant contrast with wide sans-serif body text.', inGoogleCatalog: true },
      { family: 'Fraunces', classification: 'Serif', role: 'Heading', recommendedWeights: '600 SemiBold / 700 Bold', sizeRatio: '2.1x headline scale', rationale: 'Soft optical serifs add warmth and unmistakable personality to feature titles.', inGoogleCatalog: true },
    ],
    body: [
      { family: 'Source Serif 4', classification: 'Serif', role: 'Body', recommendedWeights: '400 Regular / 600 SemiBold', sizeRatio: '18px / 1.7 leading', rationale: 'Purpose-built for comfortable long-form reading across screens and print.', inGoogleCatalog: true },
      { family: 'Newsreader', classification: 'Serif', role: 'Body', recommendedWeights: '400 Regular / Italic', sizeRatio: '18px / 1.68 leading', rationale: 'Optical sizing and open counters keep multi-paragraph essays effortless to read.', inGoogleCatalog: true },
      { family: 'Inter', classification: 'Sans Serif', role: 'UI & Captions', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '13px / 1.5 leading', rationale: 'Neutral sans-serif captions and bylines frame expressive serif typography cleanly.', inGoogleCatalog: true },
    ],
    accent: [
      { family: 'IBM Plex Mono', classification: 'Monospace', role: 'Accent', recommendedWeights: '400 Regular', sizeRatio: '12px / 1.4 leading', rationale: 'Adds crisp archival metadata styling for timestamps, categories, and footnotes.', inGoogleCatalog: true },
    ],
  },
  branding: {
    heading: [
      { family: 'Clash Display', classification: 'Display', role: 'Heading', recommendedWeights: '600 SemiBold / 700 Bold', sizeRatio: '2.4x hero scale', rationale: 'Architectural neo-grotesque geometry commands attention in brand hero lockups.', inGoogleCatalog: false },
      { family: 'Syne', classification: 'Display', role: 'Heading', recommendedWeights: '700 Bold / 800 ExtraBold', sizeRatio: '2.3x hero scale', rationale: 'Wide artistic proportions give studio and brand headlines a bold contemporary edge.', inGoogleCatalog: true },
      { family: 'Cabinet Grotesk', classification: 'Display', role: 'Heading', recommendedWeights: '700 Bold / 800 ExtraBold', sizeRatio: '2.2x hero scale', rationale: 'Expressive high-contrast terminals pair effortlessly with calm geometric body copy.', inGoogleCatalog: false },
    ],
    body: [
      { family: 'Satoshi', classification: 'Sans Serif', role: 'Body', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '16px / 1.6 leading', rationale: 'Balanced modernist proportions keep brand messaging crisp without competing with display type.', inGoogleCatalog: false },
      { family: 'Manrope', classification: 'Sans Serif', role: 'Body', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '16px / 1.6 leading', rationale: 'Clean semi-geometric forms bridge bold display headlines and approachable body copy.', inGoogleCatalog: true },
    ],
    accent: [
      { family: 'Instrument Serif', classification: 'Serif', role: 'Accent', recommendedWeights: '400 Italic', sizeRatio: '1.2x italic accent', rationale: 'Italic serif accents inside bold sans headlines add high-craft editorial contrast.', inGoogleCatalog: true },
    ],
  },
  marketing: {
    heading: [
      { family: 'Bricolage Grotesque', classification: 'Display', role: 'Heading', recommendedWeights: '600 SemiBold / 700 Bold', sizeRatio: '2.2x hero scale', rationale: 'Expressive grotesque warmth makes landing-page headlines memorable and human.', inGoogleCatalog: true },
      { family: 'Plus Jakarta Sans', classification: 'Sans Serif', role: 'Heading', recommendedWeights: '700 Bold / 800 ExtraBold', sizeRatio: '2.1x hero scale', rationale: 'Confident geometric rhythm delivers high-conversion clarity above the fold.', inGoogleCatalog: true },
    ],
    body: [
      { family: 'DM Sans', classification: 'Sans Serif', role: 'Body', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '16px / 1.6 leading', rationale: 'Friendly, open letterforms keep value propositions easy to skim.', inGoogleCatalog: true },
      { family: 'Inter', classification: 'Sans Serif', role: 'UI & Labels', recommendedWeights: '500 Medium / 600 SemiBold', sizeRatio: '14px / 1.4 leading', rationale: 'Precision spacing keeps CTAs, pricing tables, and feature grids razor-sharp.', inGoogleCatalog: true },
    ],
    accent: [
      { family: 'Lora', classification: 'Serif', role: 'Accent', recommendedWeights: '500 Italic', sizeRatio: '1.15x quote scale', rationale: 'Brings editorial warmth to customer testimonials and pull quotes.', inGoogleCatalog: true },
    ],
  },
  docs: {
    heading: [
      { family: 'Space Grotesk', classification: 'Sans Serif', role: 'Heading', recommendedWeights: '600 SemiBold / 700 Bold', sizeRatio: '1.75x heading ratio', rationale: 'Crisp technical voice clearly separates documentation sections from prose.', inGoogleCatalog: true },
      { family: 'IBM Plex Sans', classification: 'Sans Serif', role: 'Heading', recommendedWeights: '600 SemiBold / 700 Bold', sizeRatio: '1.7x heading ratio', rationale: 'Engineered clarity aligns naturally with technical diagrams and code samples.', inGoogleCatalog: true },
    ],
    body: [
      { family: 'Inter', classification: 'Sans Serif', role: 'Body', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '15px / 1.65 leading', rationale: 'Unmatched screen readability for long technical guides and references.', inGoogleCatalog: true },
      { family: 'Source Sans 3', classification: 'Sans Serif', role: 'Body', recommendedWeights: '400 Regular / 600 SemiBold', sizeRatio: '16px / 1.65 leading', rationale: 'Humanist legibility reduces eye strain across dense reference pages.', inGoogleCatalog: true },
    ],
    accent: [
      { family: 'JetBrains Mono', classification: 'Monospace', role: 'Code / Mono', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '13.5px / 1.6 leading', rationale: 'Distinct glyph shapes and ligatures make code blocks effortless to read.', inGoogleCatalog: true },
    ],
  },
  portfolio: {
    heading: [
      { family: 'Cormorant Garamond', classification: 'Serif', role: 'Heading', recommendedWeights: '500 Medium / 600 SemiBold', sizeRatio: '2.4x display scale', rationale: 'Delicate high-contrast display serifs elevate photography and design showcases.', inGoogleCatalog: true },
      { family: 'Clash Display', classification: 'Display', role: 'Heading', recommendedWeights: '500 Medium / 600 SemiBold', sizeRatio: '2.2x display scale', rationale: 'Minimalist gallery presence frames visual work with sharp studio confidence.', inGoogleCatalog: false },
    ],
    body: [
      { family: 'Switzer', classification: 'Sans Serif', role: 'Body', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '15px / 1.6 leading', rationale: 'Quiet Swiss neo-grotesque neutrality keeps case-study narratives refined and unobtrusive.', inGoogleCatalog: false },
      { family: 'Work Sans', classification: 'Sans Serif', role: 'Body', recommendedWeights: '400 Regular / 500 Medium', sizeRatio: '15px / 1.6 leading', rationale: 'Balanced proportions keep project captions and bios calm and readable.', inGoogleCatalog: true },
    ],
    accent: [
      { family: 'Space Mono', classification: 'Monospace', role: 'Accent', recommendedWeights: '400 Regular', sizeRatio: '12px / 1.4 leading', rationale: 'Adds crisp index numbering and year metadata to case-study grids.', inGoogleCatalog: true },
    ],
  },
};

function describeLocalFont(font: FontFamily): { personality: string; idealRole: string; summary: string } {
  const cls = font.classification;
  if (cls === 'Display' || cls === 'Script' || cls === 'Handwritten') {
    return {
      personality: `Expressive ${cls.toLowerCase()} voice`,
      idealRole: 'Heading',
      summary: `${font.name} brings strong visual character best anchored at display sizes alongside a calm, readable partner.`,
    };
  }
  if (cls === 'Serif' || cls === 'Slab Serif') {
    return {
      personality: `Editorial ${cls.toLowerCase()} authority`,
      idealRole: font.styles.length >= 4 ? 'Heading / Body' : 'Heading',
      summary: `${font.name} delivers refined contrast and literary warmth that pairs naturally with clean geometric sans-serifs.`,
    };
  }
  if (cls === 'Monospace') {
    return {
      personality: 'Technical monospace precision',
      idealRole: 'Accent',
      summary: `${font.name} excels in code blocks, tabular data, and labels when contrasted with a clean sans or serif primary face.`,
    };
  }
  return {
    personality: font.isVariable ? 'Versatile variable sans' : 'Modern neo-grotesque clarity',
    idealRole: font.styles.length >= 6 ? 'Body / UI' : 'UI',
    summary: `${font.name} offers clean structural legibility that pairs effortlessly with contrasting display serifs or technical monospace.`,
  };
}

/**
 * 100% Free, Zero-Cost, Instant Local Typographic Pairing Engine.
 * Runs entirely in the browser with zero server API calls or quota usage.
 */
export function generateLocalFontPairings(input: FetchFontPairingsInput): FontPairingResponse {
  const { font, context, selectedRole } = input;
  const pool = CURATED_BY_CONTEXT[context] ?? CURATED_BY_CONTEXT['saas-ui'];
  const samples = CONTEXT_SAMPLES[context] ?? CONTEXT_SAMPLES['saas-ui'];
  const lowerSelf = font.name.toLowerCase();

  // Pick complementary slots based on the selected font's role or classification
  const isHeadingPrimary =
    selectedRole === 'heading' ||
    (selectedRole === 'auto' &&
      (font.classification === 'Display' ||
        font.classification === 'Serif' ||
        font.classification === 'Script' ||
        font.classification === 'Handwritten'));

  const orderedBuckets = isHeadingPrimary
    ? [pool.body, pool.accent, pool.heading]
    : [pool.heading, pool.accent, pool.body];

  const picked: CuratedCandidate[] = [];
  const seen = new Set<string>([lowerSelf]);

  for (const bucket of orderedBuckets) {
    for (const candidate of bucket) {
      const key = candidate.family.toLowerCase();
      if (seen.has(key)) continue;
      // Avoid pairing two identical classifications for the primary slot when better contrast exists
      if (picked.length === 0 && candidate.classification === font.classification && bucket.length > 1) {
        continue;
      }
      seen.add(key);
      picked.push(candidate);
      break;
    }
  }

  // Fill up to 3 pairings if any bucket was skipped
  for (const bucket of orderedBuckets) {
    for (const candidate of bucket) {
      if (picked.length >= 3) break;
      const key = candidate.family.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(candidate);
    }
  }

  const baseScores = [96, 93, 90];
  const pairings: FontPairingSuggestion[] = picked.slice(0, 3).map((c, idx) => ({
    family: c.family,
    role: c.role,
    classification: c.classification,
    rationale: c.rationale,
    recommendedWeights: c.recommendedWeights,
    sizeRatio: c.sizeRatio,
    harmonyScore: baseScores[idx] ?? 89,
    sampleHeadline: samples.headline,
    sampleBody: samples.body,
    inGoogleCatalog: c.inGoogleCatalog,
  }));

  return {
    fontName: font.name,
    context,
    selectedRole,
    engine: 'local',
    analysis: describeLocalFont(font),
    pairings,
  };
}

/**
 * Optional BYOK (Bring Your Own Gemini API Key) call directly from the user's client —
 * uses the user's own free AI Studio key, costing $0 on the Fontainer owner's server.
 */
async function fetchGeminiByokPairings(
  input: FetchFontPairingsInput,
  apiKey: string,
  signal?: AbortSignal,
): Promise<FontPairingResponse> {
  const prompt = [
    `Analyze the typeface "${input.font.name}" (${input.font.classification}) and suggest 3 complementary Google Fonts or Fontshare pairings.`,
    `Context: ${input.context}. Role for "${input.font.name}": ${input.selectedRole}.`,
    input.customBrief ? `Brief: ${input.customBrief.trim().slice(0, 160)}` : '',
    `Never suggest "${input.font.name}" itself. Return ONLY valid JSON with keys "analysis" ({personality, idealRole, summary}) and "pairings" (array of 3 objects with family, role, classification, rationale, recommendedWeights, sizeRatio, harmonyScore, sampleHeadline, sampleBody, inGoogleCatalog).`,
  ]
    .filter(Boolean)
    .join('\n');

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  const json = (await resp.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!resp.ok) {
    throw new Error(json.error?.message || `Gemini API returned HTTP ${resp.status}. Check your API key.`);
  }

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = JSON.parse(rawText.trim()) as Partial<FontPairingResponse>;
  if (!parsed.analysis || !Array.isArray(parsed.pairings) || parsed.pairings.length === 0) {
    throw new Error('Gemini returned an unexpected response format. Try again or switch to Local Engine.');
  }

  return {
    fontName: input.font.name,
    context: input.context,
    selectedRole: input.selectedRole,
    engine: 'gemini-byok',
    analysis: parsed.analysis,
    pairings: parsed.pairings.slice(0, 4).map((p) => ({
      family: String(p.family || 'Inter'),
      role: String(p.role || 'Body'),
      classification: String(p.classification || 'Sans Serif'),
      rationale: String(p.rationale || ''),
      recommendedWeights: String(p.recommendedWeights || '400 Regular'),
      sizeRatio: String(p.sizeRatio || '1.5x scale'),
      harmonyScore: Math.min(99, Math.max(70, Number(p.harmonyScore) || 92)),
      sampleHeadline: String(p.sampleHeadline || CONTEXT_SAMPLES[input.context].headline),
      sampleBody: String(p.sampleBody || CONTEXT_SAMPLES[input.context].body),
      inGoogleCatalog: p.inGoogleCatalog !== false,
    })),
  };
}

export async function fetchFontPairings(
  input: FetchFontPairingsInput,
  signal?: AbortSignal,
): Promise<FontPairingResponse> {
  const mode: PairingEngineMode = input.engine ?? 'local';
  if (mode === 'local') {
    return generateLocalFontPairings(input);
  }
  const key = (input.userApiKey ?? getSavedUserGeminiKey()).trim();
  if (!key) {
    throw new Error(
      'Add your own free Gemini API key (from aistudio.google.com/apikey) to use Gemini AI mode, or switch to Local Engine (Free).',
    );
  }
  return fetchGeminiByokPairings(input, key, signal);
}
