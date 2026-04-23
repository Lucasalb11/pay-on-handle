import { NextRequest, NextResponse } from "next/server";
import { getPixIntent, deletePixIntent } from "@/lib/pix-store";

// Helius enhanced transaction webhook payload (simplified)
interface HeliusWebhookPayload {
  webhookID: string;
  type: string;
  transactions: HeliusTx[];
}

interface HeliusTx {
  signature: string;
  slot: number;
  timestamp: number;
  type: string;
  source: string;
  feePayer: string;
  accountData: { account: string; nativeBalanceChange: number }[];
  events: {
    compressed?: unknown[];
    nft?: unknown;
    swap?: unknown;
  };
  // Raw transaction logs — used to detect Anchor events
  logs?: string[];
  nativeTransfers?: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
}

// Vault program event discriminators (sha256("event:<EventName>")[0..8])
// These match the #[event] struct names in the vault program
const VAULT_PROGRAM_ID = "EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H";

export interface VaultEvent {
  type: "VaultCreated" | "VaultClaimed" | "VaultRefunded";
  signature: string;
  timestamp: number;
  data: Record<string, unknown>;
}

// In-memory store — replace with Redis/DB in production
const recentEvents: VaultEvent[] = [];
const MAX_EVENTS = 100;

function parseVaultEvents(tx: HeliusTx): VaultEvent[] {
  const events: VaultEvent[] = [];
  if (!tx.logs) return events;

  for (const log of tx.logs) {
    // Anchor logs event data as "Program data: <base64>"
    if (!log.startsWith("Program data: ")) continue;

    try {
      const b64 = log.replace("Program data: ", "");
      const bytes = Buffer.from(b64, "base64");

      // Anchor event discriminator: sha256("event:VaultCreated")[0..8]
      // We match by known discriminators derived from the IDL events
      const discHex = bytes.slice(0, 8).toString("hex");

      if (discHex === getEventDisc("VaultCreated")) {
        events.push({
          type: "VaultCreated",
          signature: tx.signature,
          timestamp: tx.timestamp,
          data: decodeVaultCreated(bytes.slice(8)),
        });
      } else if (discHex === getEventDisc("VaultClaimed")) {
        events.push({
          type: "VaultClaimed",
          signature: tx.signature,
          timestamp: tx.timestamp,
          data: decodeVaultClaimed(bytes.slice(8)),
        });
      } else if (discHex === getEventDisc("VaultRefunded")) {
        events.push({
          type: "VaultRefunded",
          signature: tx.signature,
          timestamp: tx.timestamp,
          data: decodeVaultRefunded(bytes.slice(8)),
        });
      }
    } catch {
      // Skip malformed log entries
    }
  }

  return events;
}

// sha256("event:<Name>")[0..8] — must match Anchor's event discriminators
function getEventDisc(name: string): string {
  const { createHash } = require("crypto");
  const hash = createHash("sha256").update(`event:${name}`).digest();
  return hash.slice(0, 8).toString("hex");
}

function decodeVaultCreated(data: Buffer): Record<string, unknown> {
  // VaultCreated { vault_id: u64, sender: Pubkey, recipient_handle_hash: [u8;32],
  //   recipient_platform: u8, amount: u64, fee: u64, mint: Pubkey,
  //   expires_at: i64, timestamp: i64 }
  try {
    let o = 0;
    const vault_id = data.readBigUInt64LE(o);
    o += 8;
    const sender = Buffer.from(data.slice(o, o + 32)).toString("hex");
    o += 32;
    const recipient_handle_hash = Buffer.from(data.slice(o, o + 32)).toString(
      "hex"
    );
    o += 32;
    const recipient_platform = data[o];
    o += 1;
    const amount = data.readBigUInt64LE(o);
    o += 8;
    const fee = data.readBigUInt64LE(o);
    o += 8;
    const mint = Buffer.from(data.slice(o, o + 32)).toString("hex");
    o += 32;
    const expires_at = data.readBigInt64LE(o);
    o += 8;
    const timestamp = data.readBigInt64LE(o);
    return {
      vault_id: vault_id.toString(),
      sender,
      recipient_handle_hash,
      recipient_platform,
      amount: amount.toString(),
      fee: fee.toString(),
      mint,
      expires_at: expires_at.toString(),
      timestamp: timestamp.toString(),
    };
  } catch {
    return { raw: data.toString("hex") };
  }
}

function decodeVaultClaimed(data: Buffer): Record<string, unknown> {
  // VaultClaimed { vault_id: u64, claimer: Pubkey, amount: u64, timestamp: i64 }
  try {
    let o = 0;
    const vault_id = data.readBigUInt64LE(o);
    o += 8;
    const claimer = Buffer.from(data.slice(o, o + 32)).toString("hex");
    o += 32;
    const amount = data.readBigUInt64LE(o);
    o += 8;
    const timestamp = data.readBigInt64LE(o);
    return {
      vault_id: vault_id.toString(),
      claimer,
      amount: amount.toString(),
      timestamp: timestamp.toString(),
    };
  } catch {
    return { raw: data.toString("hex") };
  }
}

function decodeVaultRefunded(data: Buffer): Record<string, unknown> {
  // VaultRefunded { vault_id: u64, sender: Pubkey, amount: u64, timestamp: i64 }
  try {
    let o = 0;
    const vault_id = data.readBigUInt64LE(o);
    o += 8;
    const sender = Buffer.from(data.slice(o, o + 32)).toString("hex");
    o += 32;
    const amount = data.readBigUInt64LE(o);
    o += 8;
    const timestamp = data.readBigInt64LE(o);
    return {
      vault_id: vault_id.toString(),
      sender,
      amount: amount.toString(),
      timestamp: timestamp.toString(),
    };
  } catch {
    return { raw: data.toString("hex") };
  }
}

function detectPixKeyType(key: string): string {
  const digits = key.replace(/\D/g, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return "EMAIL";
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
  )
    return "EVP";
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return "PHONE";
}

async function dispatchPix(
  vaultNonce: string,
  pixKey: string,
  brlCents: number
): Promise<void> {
  const appId = process.env.OPENPIX_APP_ID;
  if (!appId) throw new Error("OPENPIX_APP_ID not configured");

  const res = await fetch("https://api.openpix.com.br/api/v1/payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: appId,
    },
    body: JSON.stringify({
      value: brlCents,
      destinationAlias: pixKey,
      destinationAliasType: detectPixKeyType(pixKey),
      correlationID: `vault-${vaultNonce}`,
      comment: "Paga no @ — PIX recebido",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenPix ${res.status}: ${text}`);
  }
}

// POST — Helius calls this when a vault program transaction is confirmed
export async function POST(req: NextRequest) {
  // Validate Helius webhook secret
  const secret = req.headers.get("authorization");
  const expected = process.env.HELIUS_WEBHOOK_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: HeliusWebhookPayload | HeliusTx[];
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Helius sends either an array of transactions or a wrapped payload
  const txs: HeliusTx[] = Array.isArray(payload)
    ? payload
    : payload.transactions ?? [];

  const newEvents: VaultEvent[] = [];
  for (const tx of txs) {
    const events = parseVaultEvents(tx);
    newEvents.push(...events);
  }

  // Store events (trim to MAX_EVENTS)
  recentEvents.push(...newEvents);
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_EVENTS);
  }

  for (const event of newEvents) {
    console.log(
      `[Helius webhook] ${event.type} sig=${event.signature}`,
      event.data
    );

    if (event.type === "VaultClaimed") {
      const vaultNonce = (event.data as { vault_id?: string }).vault_id;
      if (vaultNonce) {
        const intent = getPixIntent(vaultNonce);
        if (intent) {
          dispatchPix(vaultNonce, intent.pixKey, intent.brlCents)
            .then(() => {
              deletePixIntent(vaultNonce);
              console.log(
                `[PIX] Dispatched ${intent.brlCents} centavos → ${intent.pixKey} (vault ${vaultNonce})`
              );
            })
            .catch((err) => {
              console.error(
                `[PIX] Dispatch failed for vault ${vaultNonce}:`,
                err
              );
            });
        }
      }
    }
  }

  return NextResponse.json({ received: txs.length, events: newEvents.length });
}

// GET — poll for recent vault events (for demo/dev without push subscription)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handleHash = searchParams.get("handleHash");
  const since = Number(searchParams.get("since") ?? "0");

  let events = recentEvents.filter((e) => e.timestamp > since);

  if (handleHash) {
    events = events.filter(
      (e) =>
        e.type === "VaultCreated" &&
        (e.data as { recipient_handle_hash?: string }).recipient_handle_hash ===
          handleHash
    );
  }

  return NextResponse.json({ events, count: events.length });
}
