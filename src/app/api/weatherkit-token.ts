import { SignJWT, importPKCS8 } from 'jose';

let cachedToken: { jwt: string; exp: number } | null = null;

export async function getWeatherKitToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 300_000) {
    return cachedToken.jwt;
  }

  const keyId = process.env.WEATHERKIT_KEY_ID;
  const teamId = process.env.WEATHERKIT_TEAM_ID;
  const serviceId = process.env.WEATHERKIT_SERVICE_ID;
  const privateKeyPem = process.env.WEATHERKIT_PRIVATE_KEY;

  if (!keyId || !teamId || !serviceId || !privateKeyPem) {
    throw new Error('WeatherKit env vars not configured');
  }

  const normalizedPem = privateKeyPem.replace(/\\n/g, '\n');
  const privateKey = await importPKCS8(normalizedPem, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const jwt = await new SignJWT({})
    .setProtectedHeader({
      alg: 'ES256',
      kid: keyId,
      id: `${teamId}.${serviceId}`,
    })
    .setIssuer(teamId)
    .setSubject(serviceId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(privateKey);

  cachedToken = { jwt, exp: exp * 1000 };
  return jwt;
}
