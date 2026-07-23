import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Exposes the running build's id so long-open clients can detect a new deploy
// and reload themselves. BUILD_ID is fixed for the life of a process, so read
// it once and cache it in module scope.
export const dynamic = 'force-dynamic';

let cached: string | null = null;

export async function GET() {
  if (!cached) {
    try {
      cached = (await readFile(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8')).trim();
    } catch {
      cached = 'dev';
    }
  }
  return NextResponse.json(
    { version: cached },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}
