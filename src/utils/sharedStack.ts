export interface SharedFontStackPayload {
  name: string;
  fonts: Array<{ id: string; name: string }>;
}

export function encodeSharedFontStack(payload: SharedFontStackPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSharedFontStack(encoded: string): SharedFontStackPayload | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SharedFontStackPayload>;
    if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.fonts)) return null;
    const fonts = parsed.fonts
      .filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string')
      .slice(0, 100);
    if (fonts.length === 0) return null;
    return { name: parsed.name.slice(0, 80), fonts };
  } catch {
    return null;
  }
}
