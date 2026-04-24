/**
 * @pay-on-handle/sdk
 *
 * Send SOL or USDC to any social handle on Solana.
 * The recipient claims with one tap — no wallet required.
 *
 * @example
 * import { PayOnHandle } from "@pay-on-handle/sdk";
 * const protocol = new PayOnHandle(connection);
 * const { claimUrl } = await protocol.send("@alice", 100, "USDC");
 */

import type { Connection } from "@solana/web3.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Platform = "twitter" | "instagram" | "whatsapp";
export type Token = "SOL" | "USDC";
export type VaultStatus = "pending" | "claimed" | "refunded";

export interface SendOptions {
  /** Social platform for the recipient handle. Default: "twitter" */
  platform?: Platform;
  /** Route through Cloak relay for private transfer. Default: false */
  private?: boolean;
}

export interface SendResult {
  /** On-chain vault address (base58) */
  vaultId: string;
  /** URL to share with the recipient */
  claimUrl: string;
  /** When the vault expires and the sender can refund */
  expiresAt: Date;
  /** Solana transaction signature */
  txSignature: string;
}

export interface VaultData {
  id: string;
  sender: string;
  /** SHA-256 hash of the recipient handle (no PII on-chain) */
  recipientHandleHash: string;
  platform: Platform;
  amount: bigint;
  token: Token;
  status: VaultStatus;
  createdAt: Date;
  expiresAt: Date;
  claimedAt: Date | null;
}

export interface PayOnHandleOptions {
  /** Override the protocol base URL. Defaults to https://payonhandle.com */
  appUrl?: string;
  network?: "devnet" | "mainnet-beta";
}

// ── Client ────────────────────────────────────────────────────────────────────

export class PayOnHandle {
  private readonly baseUrl: string;

  constructor(
    private readonly connection: Connection,
    options: PayOnHandleOptions = {}
  ) {
    this.baseUrl =
      options.appUrl ??
      (typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? "https://payonhandle.com");
  }

  /**
   * Send SOL or USDC to any social handle.
   *
   * @param handle  - "@alice" or "alice" (@ prefix optional)
   * @param amount  - Amount in USDC units (e.g. 100 = $100) or SOL (e.g. 0.5)
   * @param token   - "USDC" or "SOL". Default: "USDC"
   * @param options - Platform, privacy mode
   */
  async send(
    handle: string,
    amount: number,
    token: Token = "USDC",
    options: SendOptions = {}
  ): Promise<SendResult> {
    const normalized = handle.startsWith("@") ? handle.slice(1) : handle;
    const platform = options.platform ?? "twitter";

    const res = await fetch(`${this.baseUrl}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: normalized,
        platform,
        amountSol: token === "SOL" ? amount : undefined,
        amountUsdc: token === "USDC" ? amount : undefined,
        private: options.private ?? false,
      }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "Unknown error");
      throw new Error(`PayOnHandle.send failed (${res.status}): ${msg}`);
    }

    const data = (await res.json()) as {
      vault: string;
      signature?: string;
      transaction?: string;
    };

    return {
      vaultId: data.vault,
      claimUrl: `${this.baseUrl}/claim/${data.vault}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      txSignature: data.signature ?? "",
    };
  }

  /**
   * Fetch vault state by ID.
   * Returns null if the vault does not exist.
   */
  async getVault(vaultId: string): Promise<VaultData | null> {
    const res = await fetch(`${this.baseUrl}/api/vault/${vaultId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch vault ${vaultId}`);
    return res.json() as Promise<VaultData>;
  }
}

// ── One-liner API (for AI agents & simple integrations) ───────────────────────

/**
 * Send crypto to a social handle in one function call.
 * Ideal for AI tool-calling and minimal integrations.
 *
 * @example
 * // Register as a Claude/GPT tool
 * const tools = {
 *   send_payment: {
 *     execute: ({ handle, amount }) => sendToHandle(handle, amount, connection),
 *   },
 * };
 */
export async function sendToHandle(
  handle: string,
  amount: number,
  connection: Connection,
  options?: SendOptions & { token?: Token; appUrl?: string }
): Promise<SendResult> {
  const sdk = new PayOnHandle(connection, { appUrl: options?.appUrl });
  return sdk.send(handle, amount, options?.token ?? "USDC", options);
}
