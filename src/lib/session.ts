import { SignJWT, jwtVerify } from 'jose';

// Signed HMAC session cookie so AUTH_SECRET itself never leaves the server.

const COOKIE_NAME = 'cc-auth';
const SESSION_DAYS = 30;

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ scope: 'dashboard' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, key());
    return true;
  } catch {
    return false;
  }
}

export { COOKIE_NAME, SESSION_DAYS };
