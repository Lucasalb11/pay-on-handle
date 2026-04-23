import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_ENDPOINT, VAULT_PROGRAM_ID } from "@/lib/constants";

const connection = new Connection(RPC_ENDPOINT, "confirmed");

// sha256("account:PaymentVault")[0..8] from IDL
const VAULT_DISCRIMINATOR = Buffer.from([198, 111, 51, 64, 219, 236, 208, 239]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { vaultId: string } }
) {
  const { vaultId } = params;

  try {
    // Fetch all vault accounts that match our program.
    // For MVP: use the provided vaultId as the PDA address directly.
    const vaultPubkey = new PublicKey(vaultId);
    const info = await connection.getAccountInfo(vaultPubkey);

    if (!info || info.owner.toBase58() !== VAULT_PROGRAM_ID) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    // Deserialize PaymentVault account.
    // Layout (after 8-byte discriminator):
    // sender: Pubkey [32]
    // recipient_handle_hash: [u8; 32] [32]
    // recipient_platform: u8 [1]
    // amount: u64 [8]
    // mint: Pubkey [32]
    // status: enum u8 [1]
    // created_at: i64 [8]
    // expires_at: i64 [8]
    // claimed_at: Option<i64> [1 + 8]
    // vault_nonce: u64 [8]
    // bump: u8 [1]
    const data = info.data;
    let offset = 8; // skip discriminator

    const sender = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    const recipientHandleHash = Buffer.from(
      data.slice(offset, offset + 32)
    ).toString("hex");
    offset += 32;

    const recipientPlatform = data[offset];
    offset += 1;

    const amount = Number(data.readBigUInt64LE(offset));
    offset += 8;

    const mint = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    const statusByte = data[offset];
    offset += 1;
    const STATUS_MAP: Record<number, string> = {
      0: "pending",
      1: "claimed",
      2: "refunded",
      3: "expired",
    };
    const status = STATUS_MAP[statusByte] ?? "unknown";

    const createdAt = Number(data.readBigInt64LE(offset));
    offset += 8;

    const expiresAt = Number(data.readBigInt64LE(offset));
    offset += 8;

    const hasClaim = data[offset];
    offset += 1;
    const claimedAt = hasClaim ? Number(data.readBigInt64LE(offset)) : null;
    offset += 8;

    const vaultNonce = Number(data.readBigUInt64LE(offset));

    return NextResponse.json({
      vaultId,
      sender,
      recipientHandleHash,
      recipientPlatform,
      amount,
      mint,
      status,
      createdAt,
      expiresAt,
      claimedAt,
      vaultNonce,
    });
  } catch (e: any) {
    if (e.message?.includes("Invalid public key")) {
      return NextResponse.json({ error: "Invalid vault ID" }, { status: 400 });
    }
    console.error("vault fetch error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
