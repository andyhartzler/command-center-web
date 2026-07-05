import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

const COOKIE_NAME = 'withings_tokens';

// Local dev: project data dir. Vercel: /tmp (writable but ephemeral)
const LOCAL_PATH = path.join(process.cwd(), 'data', 'withings-tokens.json');
const VERCEL_PATH = '/tmp/withings-tokens.json';
const IS_VERCEL = !!process.env.VERCEL;

function tokensPath(): string {
  return IS_VERCEL ? VERCEL_PATH : LOCAL_PATH;
}

/**
 * Read tokens from cookie (primary on Vercel) or filesystem fallback.
 */
export function readTokensFromCookie(req: NextRequest): StoredTokens | null {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Set tokens as HTTP-only cookie on a response.
 */
export function setTokensCookie(response: NextResponse, tokens: StoredTokens): void {
  const encoded = Buffer.from(JSON.stringify(tokens)).toString('base64');
  response.cookies.set(COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== '1',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60, // 1 year (refresh token TTL)
  });
}

/**
 * Delete the tokens cookie.
 */
export function deleteTokensCookie(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAME);
}

/**
 * Read tokens. Priority: cookie > filesystem > env var.
 */
export async function readTokens(req?: NextRequest): Promise<StoredTokens | null> {
  // 1. Try cookie first (works across all Vercel instances)
  if (req) {
    const fromCookie = readTokensFromCookie(req);
    if (fromCookie) return fromCookie;
  }

  // 2. Try filesystem (works for local dev, ephemeral on Vercel)
  try {
    const raw = await fs.readFile(tokensPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    // fall through
  }

  // 3. Try WITHINGS_TOKENS env var
  const envTokens = process.env.WITHINGS_TOKENS;
  if (envTokens) {
    try {
      return JSON.parse(envTokens);
    } catch {
      // fall through
    }
  }

  return null;
}

async function saveToFile(tokens: StoredTokens): Promise<void> {
  try {
    const p = tokensPath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(tokens, null, 2));
  } catch {
    // Ignore file write errors (Vercel read-only fs edge cases)
  }
}

/**
 * Save tokens to filesystem and in-process env (best effort).
 * Cookie must be set separately on the response.
 */
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await saveToFile(tokens);
  process.env.WITHINGS_TOKENS = JSON.stringify(tokens);
}
