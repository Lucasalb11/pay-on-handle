export interface PixIntent {
  pixKey: string;
  brlCents: number;
  lamports: number;
  createdAt: number;
}

// Keyed by vault_nonce (u64 as decimal string) — matches VaultClaimed event vault_id.
const store = new Map<string, PixIntent>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (claim window)

export function setPixIntent(vaultNonce: string, intent: PixIntent): void {
  store.set(vaultNonce, intent);
}

export function getPixIntent(vaultNonce: string): PixIntent | undefined {
  const intent = store.get(vaultNonce);
  if (!intent) return undefined;
  if (Date.now() - intent.createdAt > TTL_MS) {
    store.delete(vaultNonce);
    return undefined;
  }
  return intent;
}

export function deletePixIntent(vaultNonce: string): void {
  store.delete(vaultNonce);
}
