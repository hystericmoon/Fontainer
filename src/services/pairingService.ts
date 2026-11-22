import type { FontFamily } from '../types/font';
import { resolveApiUrl } from '../utils/apiUrl';

export type PairingContextPreset =
  | 'saas-ui'
  | 'editorial'
  | 'branding'
  | 'marketing'
  | 'docs'
  | 'portfolio';

export type SelectedFontRole = 'auto' | 'heading' | 'body' | 'ui';

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
  forceRefresh?: boolean;
}

export async function fetchFontPairings(
  input: FetchFontPairingsInput,
  signal?: AbortSignal,
): Promise<FontPairingResponse> {
  const weights = Array.from(new Set(input.font.styles.map((s) => s.weight)))
    .sort((a, b) => a - b)
    .slice(0, 10);

  const localController = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    localController.abort();
  }, 26_000);

  const onParentAbort = () => localController.abort();
  if (signal) {
    if (signal.aborted) {
      window.clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', onParentAbort, { once: true });
  }

  let resp: Response;
  try {
    resp = await fetch(resolveApiUrl('/api/font-pairings'), {
      method: 'POST',
      signal: localController.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        font: {
          name: input.font.name,
          classification: input.font.classification,
          foundry: input.font.foundry,
          width: input.font.width,
          isVariable: input.font.isVariable,
          stylesCount: input.font.styles.length,
          weights,
          tags: input.font.tags.slice(0, 8),
        },
        context: input.context,
        selectedRole: input.selectedRole,
        customBrief: input.customBrief?.trim().slice(0, 160) || '',
        theme: input.theme || 'light',
        previewText: input.previewText?.trim().slice(0, 120) || '',
        userLibraryFamilies: (input.userLibraryFamilies ?? []).slice(0, 40),
        forceRefresh: Boolean(input.forceRefresh),
      }),
    });
  } catch (err) {
    if (timedOut) {
      throw new Error('Font pairing analysis timed out. Please try again.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onParentAbort);
  }

  const data = (await resp.json().catch(() => ({}))) as Partial<FontPairingResponse> & {
    error?: string;
  };

  if (!resp.ok) {
    throw new Error(data.error || `Pairing request failed (HTTP ${resp.status})`);
  }

  if (!data.analysis || !Array.isArray(data.pairings)) {
    throw new Error('Unexpected response format from font pairing service.');
  }

  return data as FontPairingResponse;
}
