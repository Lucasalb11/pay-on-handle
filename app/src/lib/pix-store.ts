export interface PixIntent {
  pixKey: string;
  brlCents: number;
  lamports: number;
  createdAt: number;
}

// Redis migration: when UPSTASH_REDIS_REST_URL is configured, swap this module
// for an @upstash/redis implementation using SETEX with TTL_SECONDS.
// Install: yarn add @upstash/redis

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (claim window)
const TTL_MS = TTL_SECONDS * 1000;

// Fallback: in-memory Map (lost on restart — replace with Redis for production)
const store = new Map<string, PixIntent>();

export async function setPixIntent(
  vaultNonce: string,
  intent: PixIntent
): Promise<void> {
  store.set(vaultNonce, intent);
}

export async function getPixIntent(
  vaultNonce: string
): Promise<PixIntent | undefined> {
  const intent = store.get(vaultNonce);
  if (!intent) return undefined;
  if (Date.now() - intent.createdAt > TTL_MS) {
    store.delete(vaultNonce);
    return undefined;
  }
  return intent;
}

export async function deletePixIntent(vaultNonce: string): Promise<void> {
  store.delete(vaultNonce);
}
