import { createHash } from "crypto";

/** Normalize a handle: lowercase, strip leading @, trim whitespace. */
export function normalizeHandle(raw: string): string {
  return raw.toLowerCase().replace(/^@/, "").trim();
}

/** SHA-256 of the normalized handle — matches what the Rust program stores. */
export function hashHandle(raw: string): Uint8Array {
  const normalized = normalizeHandle(raw);
  const hash = createHash("sha256").update(normalized).digest();
  return new Uint8Array(hash);
}

export function hashHandleHex(raw: string): string {
  return Buffer.from(hashHandle(raw)).toString("hex");
}

/** Format a handle for display — always shows leading @. */
export function displayHandle(raw: string): string {
  const normalized = normalizeHandle(raw);
  return `@${normalized}`;
}

export function formatAmount(lamports: number, decimals = 9): string {
  return (lamports / 10 ** decimals).toFixed(4).replace(/\.?0+$/, "");
}

export function lamportsToSol(lamports: number): number {
  return lamports / 1e9;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * 1e9);
}

export function usdcToRaw(usdc: number): number {
  return Math.floor(usdc * 1e6);
}

/** Returns days remaining from expires_at (unix timestamp). */
export function daysRemaining(expiresAt: number): number {
  const now = Math.floor(Date.now() / 1000);
  const diff = expiresAt - now;
  return Math.max(0, Math.floor(diff / 86400));
}
