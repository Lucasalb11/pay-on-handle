import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  RPC_ENDPOINT,
  VAULT_PROGRAM_ID,
  FEE_COLLECTOR_PROGRAM_ID,
  NATIVE_SOL_MINT,
  USDC_DEVNET_MINT,
  FEE_BPS,
} from "@/lib/constants";
import {
  vaultPda,
  senderNoncePda,
  vaultConfigPda,
  getSenderNonce,
} from "@/lib/solana";
import { hashHandle } from "@/lib/handle";

const connection = new Connection(RPC_ENDPOINT, "confirmed");

// Real Anchor discriminators from IDL
const DISC_CREATE_SOL = Buffer.from([199, 85, 223, 31, 210, 142, 93, 76]);
const DISC_CREATE_SPL = Buffer.from([70, 237, 30, 3, 24, 231, 70, 67]);

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

  const isNative = amountSol !== undefined;
  const mint = new PublicKey(isNative ? NATIVE_SOL_MINT : USDC_DEVNET_MINT);
  const grossAmount = isNative
    ? BigInt(Math.round(amountSol! * LAMPORTS_PER_SOL))
    : BigInt(Math.round(amountUsdc! * 1_000_000));

  const feeAmount = (grossAmount * BigInt(FEE_BPS)) / BigInt(10_000);
  const netAmount = grossAmount - feeAmount;

  const handleHash = hashHandle(handle);
  const nonce = await getSenderNonce(senderPubkey);
  const vault = vaultPda(senderPubkey, nonce);
  const noncePda = senderNoncePda(senderPubkey);
  const vaultConfig = vaultConfigPda();
  const feeCollectorPda = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_collector")],
    new PublicKey(FEE_COLLECTOR_PROGRAM_ID)
  )[0];

  // Layout: [8 disc][1 platform][32 handle_hash][8 nonce][8 gross_amount]
  const ixData = Buffer.alloc(57);
  let keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];

  if (isNative) {
    DISC_CREATE_SOL.copy(ixData, 0);
    ixData.writeUInt8(platform, 8);
    Buffer.from(handleHash).copy(ixData, 9);
    ixData.writeBigUInt64LE(nonce, 41);
    ixData.writeBigUInt64LE(grossAmount, 49);

    // CreateSolVault context order: vault, sender_nonce, config, fee_collector, sender, system_program
    keys = [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: noncePda, isSigner: false, isWritable: true },
      { pubkey: vaultConfig, isSigner: false, isWritable: false },
      { pubkey: feeCollectorPda, isSigner: false, isWritable: true },
      { pubkey: senderPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  } else {
    DISC_CREATE_SPL.copy(ixData, 0);
    ixData.writeUInt8(platform, 8);
    Buffer.from(handleHash).copy(ixData, 9);
    ixData.writeBigUInt64LE(nonce, 41);
    ixData.writeBigUInt64LE(grossAmount, 49);

    const vaultAta = await getAssociatedTokenAddress(mint, vault, true);
    const senderAta = await getAssociatedTokenAddress(mint, senderPubkey);
    const feeCollectorAta = await getAssociatedTokenAddress(
      mint,
      feeCollectorPda
    );

    // CreateSplVault context order: vault, vault_token_account, sender_nonce, config,
    //   mint, sender_token_account, fee_collector_token_account, sender,
    //   token_program, associated_token_program, system_program
    keys = [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: noncePda, isSigner: false, isWritable: true },
      { pubkey: vaultConfig, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: senderAta, isSigner: false, isWritable: true },
      { pubkey: feeCollectorAta, isSigner: false, isWritable: true },
      { pubkey: senderPubkey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: senderPubkey,
    blockhash,
    lastValidBlockHeight,
  });
  tx.add(
    new TransactionInstruction({
      programId: new PublicKey(VAULT_PROGRAM_ID),
      keys,
      data: ixData,
    })
  );

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
