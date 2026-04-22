import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  RPC_ENDPOINT,
  VAULT_PROGRAM_ID,
  REGISTRY_PROGRAM_ID,
  FEE_COLLECTOR_PROGRAM_ID,
  NATIVE_SOL_MINT,
  FEE_BPS,
} from "@/lib/constants";
import {
  vaultPda,
  handleRecordPda,
  senderNoncePda,
  vaultConfigPda,
  getSenderNonce,
} from "@/lib/solana";
import { hashHandle } from "@/lib/handle";

const connection = new Connection(RPC_ENDPOINT, "confirmed");

// Anchor instruction discriminators (sha256("global:<ix_name>")[0..8])
// These are deterministic — compute once from the IDL.
const CREATE_VAULT_DISCRIMINATOR = Buffer.from([
  0x29, 0x0f, 0xa3, 0xe8, 0x7e, 0xb0, 0x2d, 0x2a,
]);

type SendBody = {
  sender: string;
  platform: number;
  handle: string;
  amountSol?: number;
  amountUsdc?: number;
};

export async function POST(req: NextRequest) {
  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sender, platform, handle, amountSol, amountUsdc } = body;

  if (!sender || platform === undefined || !handle) {
    return NextResponse.json(
      { error: "Missing required fields: sender, platform, handle" },
      { status: 400 }
    );
  }

  if (amountSol === undefined && amountUsdc === undefined) {
    return NextResponse.json(
      { error: "Must provide amountSol or amountUsdc" },
      { status: 400 }
    );
  }

  if (platform < 0 || platform > 2) {
    return NextResponse.json(
      { error: "Invalid platform (0=Instagram, 1=Twitter, 2=WhatsApp)" },
      { status: 400 }
    );
  }

  let senderPubkey: PublicKey;
  try {
    senderPubkey = new PublicKey(sender);
  } catch {
    return NextResponse.json(
      { error: "Invalid sender public key" },
      { status: 400 }
    );
  }

  // Derive PDAs
  const handleHash = hashHandle(handle);
  const nonce = await getSenderNonce(senderPubkey);
  const vault = vaultPda(senderPubkey, nonce);
  const noncePda = senderNoncePda(senderPubkey);
  const vaultConfig = vaultConfigPda();
  const handleRecord = handleRecordPda(platform, handleHash);
  const feeCollectorPda = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_collector")],
    new PublicKey(FEE_COLLECTOR_PROGRAM_ID)
  )[0];

  // Instruction data layout:
  // [8 discriminator][1 platform][32 handle_hash][8 amount][32 mint][8 nonce]
  const isNative = amountSol !== undefined;
  const mint = new PublicKey(NATIVE_SOL_MINT);
  const amountLamports = isNative
    ? BigInt(Math.round(amountSol! * LAMPORTS_PER_SOL))
    : BigInt(Math.round(amountUsdc! * 1_000_000));

  // Calculate fee
  const feeAmount = (amountLamports * BigInt(FEE_BPS)) / BigInt(10_000);
  const netAmount = amountLamports - feeAmount;

  const ixData = Buffer.alloc(8 + 1 + 32 + 8 + 32 + 8);
  CREATE_VAULT_DISCRIMINATOR.copy(ixData, 0);
  ixData.writeUInt8(platform, 8);
  Buffer.from(handleHash).copy(ixData, 9);
  ixData.writeBigUInt64LE(amountLamports, 41);
  mint.toBuffer().copy(ixData, 49);
  ixData.writeBigUInt64LE(nonce, 81);

  // Build unsigned transaction for the client to sign
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: senderPubkey,
    blockhash,
    lastValidBlockHeight,
  });

  // For SOL vault: create_vault instruction
  // Accounts order matches the Anchor context struct
  const keys = [
    { pubkey: senderPubkey, isSigner: true, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: noncePda, isSigner: false, isWritable: true },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: handleRecord, isSigner: false, isWritable: false },
    { pubkey: feeCollectorPda, isSigner: false, isWritable: true },
    {
      pubkey: new PublicKey(REGISTRY_PROGRAM_ID),
      isSigner: false,
      isWritable: false,
    },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  tx.add({
    programId: new PublicKey(VAULT_PROGRAM_ID),
    keys,
    data: ixData,
  });

  const serialized = tx.serialize({ requireAllSignatures: false });

  return NextResponse.json({
    transaction: serialized.toString("base64"),
    vault: vault.toBase58(),
    nonce: nonce.toString(),
    netAmount: netAmount.toString(),
    feeAmount: feeAmount.toString(),
    mint: mint.toBase58(),
    expiresInDays: 7,
  });
}
