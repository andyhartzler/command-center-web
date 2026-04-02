import { NextRequest, NextResponse } from 'next/server';
import { deleteTokens } from '../token-store';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/', req.nextUrl.origin));
  deleteTokens(response);
  
  // Also try to clear local file if possible
  try {
    const LOCAL_PATH = path.join(process.cwd(), 'data', 'nest-tokens.json');
    await fs.unlink(LOCAL_PATH);
  } catch (e) {}

  return response;
}
