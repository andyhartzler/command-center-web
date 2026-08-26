import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export interface NestTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const COOKIE_NAME = 'nest_tokens';
const LOCAL_PATH = path.join(process.cwd(), 'data', 'nest-tokens.json');
const VERCEL_PATH = '/tmp/nest-tokens.json';
const IS_VERCEL = !!process.env.VERCEL;

function tokensPath(): string {
  return IS_VERCEL ? VERCEL_PATH : LOCAL_PATH;
}

export function readTokensFromCookie(req: NextRequest): NestTokens | null {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function setTokensCookie(response: NextResponse, tokens: NestTokens): void {
  const encoded = Buffer.from(JSON.stringify(tokens)).toString('base64');
  response.cookies.set(COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== '1',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  });
}

export function deleteTokens(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAME);
}

export async function readTokens(req?: NextRequest): Promise<NestTokens | null> {
  // The server-side file is the SHARED source of truth across every device (the
  // wall, phone, laptop). It must be read first: token refreshes write here, so
  // reading the file keeps all devices in sync. Reading a per-device cookie
  // first (the old behaviour) let a stale cookie shadow the fresh shared token,
  // which is why one device would work while the wall stayed "disconnected".
  try {
    const raw = await fs.readFile(tokensPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    // fall through
  }

  // Fallback for stateless hosts (e.g. Vercel) where the file does not persist.
  if (req) {
    const fromCookie = readTokensFromCookie(req);
    if (fromCookie) return fromCookie;
  }

  const envTokens = process.env.NEST_TOKENS;
  if (envTokens) {
    try {
      return JSON.parse(envTokens);
    } catch {
      // fall through
    }
  }

  return null;
}

async function saveToFile(tokens: NestTokens): Promise<void> {
  try {
    const p = tokensPath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(tokens, null, 2));
  } catch {
    // Ignore file write errors
  }
}

export async function saveTokens(tokens: NestTokens): Promise<void> {
  await saveToFile(tokens);
  process.env.NEST_TOKENS = JSON.stringify(tokens);
}
