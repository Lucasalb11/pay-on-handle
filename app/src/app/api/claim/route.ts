import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  RPC_ENDPOINT,
  VAULT_PROGRAM_ID,
  NATIVE_SOL_MINT,
} from "@/lib/constants";
import { hashHandle } from "@/lib/handle";

const connection = new Connection(RPC_ENDPOINT, "confirmed");

const CLAIM_VAULT_DISCRIMINATOR = Buffer.from([
  0x3d, 0x1e, 0xa6, 0x72, 0x5f, 0x4c, 0x38, 0x01,
]);

type ClaimBody = {
  claimant: string;
  vaultId: string;
  platform: number;
  handle: string;
};

export async function POST(req: NextRequest) {
  let body: ClaimBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { claimant, vaultId, platform, handle } = body;

  if (!claimant || !vaultId || platform === undefined || !handle) {
    return NextResponse.json(
      { error: "Missing required fields: claimant, vaultId, platform, handle" },
      { status: 400 }
    );
  }

  let claimantPubkey: PublicKey;
  let vaultPubkey: PublicKey;
  try {
    claimantPubkey = new PublicKey(claimant);
    vaultPubkey = new PublicKey(vaultId);
  } catch {
    return NextResponse.json({ error: "Invalid public key" }, { status: 400 });
  }

  // Read vault account to validate state
  const vaultInfo = await connection.getAccountInfo(vaultPubkey);
  if (!vaultInfo || vaultInfo.owner.toBase58() !== VAULT_PROGRAM_ID) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  // Parse relevant fields
  const data = vaultInfo.data;
  const statusByte = data[8 + 32 + 32 + 1 + 8 + 32]; // offset to status field
  if (statusByte !== 0) {
    return NextResponse.json(
      { error: "Vault is not in pending state" },
      { status: 400 }
    );
  }

  const expiresAt = Number(
    data.readBigInt64LE(8 + 32 + 32 + 1 + 8 + 32 + 1 + 8)
  );
  const now = Math.floor(Date.now() / 1000);
  if (now > expiresAt) {
    return NextResponse.json({ error: "Vault has expired" }, { status: 400 });
  }

  const mint = new PublicKey(
    data.slice(8 + 32 + 32 + 1 + 8, 8 + 32 + 32 + 1 + 8 + 32)
  );
  const isNative = mint.toBase58() === NATIVE_SOL_MINT;

  const handleHash = hashHandle(handle);

  // Build instruction data: [8 discriminator][1 platform][32 handle_hash]
  const ixData = Buffer.alloc(8 + 1 + 32);
  CLAIM_VAULT_DISCRIMINATOR.copy(ixData, 0);
  ixData.writeUInt8(platform, 8);
  Buffer.from(handleHash).copy(ixData, 9);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: claimantPubkey,
    blockhash,
    lastValidBlockHeight,
  });

  if (isNative) {
    tx.add({
      programId: new PublicKey(VAULT_PROGRAM_ID),
      keys: [
        { pubkey: claimantPubkey, isSigner: true, isWritable: true },
        { pubkey: vaultPubkey, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixData,
    });
  } else {
    // SPL claim requires ATA accounts — derive them
    const { getAssociatedTokenAddress } = await import("@solana/spl-token");
    const claimantAta = await getAssociatedTokenAddress(mint, claimantPubkey);
    const vaultTokenAccount = await getAssociatedTokenAddress(
      mint,
      vaultPubkey,
      true
    );

    tx.add({
      programId: new PublicKey(VAULT_PROGRAM_ID),
      keys: [
        { pubkey: claimantPubkey, isSigner: true, isWritable: true },
        { pubkey: vaultPubkey, isSigner: false, isWritable: true },
        { pubkey: claimantAta, isSigner: false, isWritable: true },
        { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        {
          pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          isSigner: false,
          isWritable: false,
        },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixData,
    });
  }

  const serialized = tx.serialize({ requireAllSignatures: false });

  return NextResponse.json({
    transaction: serialized.toString("base64"),
    isNative,
    mint: mint.toBase58(),
  });
}
