import { promises as fs } from 'fs';
import path from 'path';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

// Local dev: project data dir. Vercel: /tmp (writable but ephemeral)
const LOCAL_PATH = path.join(process.cwd(), 'data', 'withings-tokens.json');
const VERCEL_PATH = '/tmp/withings-tokens.json';
const IS_VERCEL = !!process.env.VERCEL;

function tokensPath(): string {
  return IS_VERCEL ? VERCEL_PATH : LOCAL_PATH;
}

/**
 * Read tokens. Priority: in-process env > filesystem > WITHINGS_TOKENS env var.
 */
export async function readTokens(): Promise<StoredTokens | null> {
  // 1. Try filesystem first (fastest, works for both local and Vercel /tmp)
  try {
    const raw = await fs.readFile(tokensPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    // fall through
  }

  // 2. Try WITHINGS_TOKENS env var (persists across Vercel cold starts if set)
  const envTokens = process.env.WITHINGS_TOKENS;
  if (envTokens) {
    try {
      const tokens = JSON.parse(envTokens);
      // Write to filesystem so subsequent reads are fast
      await saveToFile(tokens);
      return tokens;
    } catch {
      // fall through
    }
  }

  return null;
}

async function saveToFile(tokens: StoredTokens): Promise<void> {
  const p = tokensPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(tokens, null, 2));
}

/**
 * Save tokens to filesystem and update in-process env.
 */
export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await saveToFile(tokens);
  // Cache in process env so it survives within the same invocation
  process.env.WITHINGS_TOKENS = JSON.stringify(tokens);
}
