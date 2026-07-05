import { NextRequest, NextResponse } from 'next/server';
import { deleteTokens } from '../token-store';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(_req: NextRequest) {
  // Redirect to the public base, not req.nextUrl.origin (= https://localhost:3001
  // behind the Cloudflare tunnel, which the browser can't reach).
  const publicBase = (process.env.PUBLIC_BASE_URL || 'https://hartzler.app').replace(/\/$/, '');
  const response = NextResponse.redirect(new URL('/', publicBase));
  deleteTokens(response);
  
  // Also try to clear local file if possible
  try {
    const LOCAL_PATH = path.join(process.cwd(), 'data', 'nest-tokens.json');
    await fs.unlink(LOCAL_PATH);
  } catch (e) {}

  return response;
}
