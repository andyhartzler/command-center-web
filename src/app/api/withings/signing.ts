import crypto from 'crypto';

const WITHINGS_API = 'https://wbsapi.withings.net';

/**
 * Get a nonce from Withings for request signing.
 * POST /v2/signature with action=getnonce
 */
export async function getNonce(clientId: string, clientSecret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Sign the getnonce request itself: hash of "getnonce,CLIENT_ID,TIMESTAMP"
  const signData = `getnonce,${clientId},${timestamp}`;
  const signature = crypto
    .createHmac('sha256', clientSecret)
    .update(signData)
    .digest('hex');

  const body = new URLSearchParams({
    action: 'getnonce',
    client_id: clientId,
    timestamp,
    signature,
  });

  const res = await fetch(`${WITHINGS_API}/v2/signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.status !== 0 || !data.body?.nonce) {
    throw new Error(`Failed to get nonce: ${JSON.stringify(data)}`);
  }

  return data.body.nonce;
}

/**
 * Sign a Withings API request.
 * Concatenates sorted values of action, client_id, nonce (comma-separated),
 * then HMAC-SHA256 with client_secret.
 */
export function signRequest(action: string, clientId: string, nonce: string, clientSecret: string): string {
  const signData = `${action},${clientId},${nonce}`;
  return crypto
    .createHmac('sha256', clientSecret)
    .update(signData)
    .digest('hex');
}
