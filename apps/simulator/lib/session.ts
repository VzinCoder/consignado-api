/**
 * Sessão do admin: `base64url(payload).base64url(hmac-sha256)`, assinada com SESSION_SECRET.
 * Usa apenas Web Crypto, funcionando tanto no proxy.ts quanto nos route handlers.
 */

export const SESSION_COOKIE = 'zelafin_admin';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MS_PER_SECOND = 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export interface Session {
  username: string;
  expiresAt: Date;
}

export async function createSessionToken(
  username: string,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const exp = Math.floor(now.getTime() / MS_PER_SECOND) + SESSION_TTL_SECONDS;
  const payload = toBase64Url(encoder.encode(JSON.stringify({ sub: username, exp })));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(payload),
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

function parsePayload(bytes: Uint8Array): { sub: string; exp: number } | null {
  try {
    const data: unknown = JSON.parse(decoder.decode(bytes));
    if (
      typeof data === 'object' &&
      data !== null &&
      'sub' in data &&
      'exp' in data &&
      typeof data.sub === 'string' &&
      typeof data.exp === 'number'
    ) {
      return { sub: data.sub, exp: data.exp };
    }
    return null;
  } catch {
    return null;
  }
}

/** Retorna a sessão, ou null quando o token estiver ausente, adulterado ou expirado. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: Date = new Date(),
): Promise<Session | null> {
  if (!token) return null;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return null;

  const signatureBytes = fromBase64Url(signature);
  const payloadBytes = fromBase64Url(payload);
  if (!signatureBytes || !payloadBytes) return null;

  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    signatureBytes,
    encoder.encode(payload),
  );
  if (!valid) return null;

  const data = parsePayload(payloadBytes);
  if (!data || data.exp * MS_PER_SECOND <= now.getTime()) return null;
  return { username: data.sub, expiresAt: new Date(data.exp * MS_PER_SECOND) };
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

/** Comparação em tempo constante (aplicar hash antes garante o mesmo tamanho nos dois lados). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < hashA.length; i += 1) diff |= (hashA[i] ?? 0) ^ (hashB[i] ?? 0);
  return diff === 0;
}
