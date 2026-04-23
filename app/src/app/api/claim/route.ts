import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  RPC_ENDPOINT,
  VAULT_PROGRAM_ID,
  REGISTRY_PROGRAM_ID,
  NATIVE_SOL_MINT,
} from "@/lib/constants";
import { hashHandle, handleRecordPda } from "@/lib/handle";

const connection = new Connection(RPC_ENDPOINT, "confirmed");

// Real Anchor discriminators from IDL
const DISC_CLAIM_SOL = Buffer.from([121, 14, 252, 87, 97, 18, 163, 34]);
const DISC_CLAIM_SPL = Buffer.from([93, 172, 104, 171, 174, 96, 106, 182]);

type ClaimBody = {
  claimant: string;
  vaultId: string;
  handle: string;
};

export async function POST(req: NextRequest) {
  let body: ClaimBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { claimant, vaultId, handle } = body;

  if (!claimant || !vaultId || !handle) {
    return NextResponse.json(
      { error: "Missing required fields: claimant, vaultId, handle" },
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

  const vaultInfo = await connection.getAccountInfo(vaultPubkey);
  if (!vaultInfo || vaultInfo.owner.toBase58() !== VAULT_PROGRAM_ID) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  // PaymentVault layout (after 8-byte disc):
  //   sender[32] handle_hash[32] platform[1] amount[8] mint[32] status[1] created_at[8] expires_at[8] ...
  const data = vaultInfo.data;
  const statusByte = data[8 + 32 + 32 + 1 + 8 + 32]; // offset 113
  if (statusByte !== 0) {
    return NextResponse.json(
      { error: "Vault is not in pending state" },
      { status: 400 }
    );
  }

  const expiresAt = Number(
    data.readBigInt64LE(8 + 32 + 32 + 1 + 8 + 32 + 1 + 8)
  ); // offset 122
  if (Math.floor(Date.now() / 1000) > expiresAt) {
    return NextResponse.json({ error: "Vault has expired" }, { status: 400 });
  }

  // PaymentVault layout: disc[8] sender[32] handle_hash[32] platform[1] amount[8] mint[32]
  const platform = data[8 + 32 + 32]; // offset 72
  const mint = new PublicKey(data.slice(81, 113)); // offset 81..113
  const isNative = mint.toBase58() === NATIVE_SOL_MINT;

  const handleHash = hashHandle(handle);
  const hrPda = handleRecordPda(platform, handleHash);

  // Layout: [8 disc][32 handle_hash]
  const ixData = Buffer.alloc(40);
  let keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];

  if (isNative) {
    DISC_CLAIM_SOL.copy(ixData, 0);
    Buffer.from(handleHash).copy(ixData, 8);

    // ClaimSolVault context order: vault, handle_record, claimer, system_program
    keys = [
      { pubkey: vaultPubkey, isSigner: false, isWritable: true },
      { pubkey: hrPda, isSigner: false, isWritable: false },
      { pubkey: claimantPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  } else {
    DISC_CLAIM_SPL.copy(ixData, 0);
    Buffer.from(handleHash).copy(ixData, 8);

    const vaultAta = await getAssociatedTokenAddress(mint, vaultPubkey, true);
    const claimantAta = await getAssociatedTokenAddress(mint, claimantPubkey);

    // ClaimSplVault context order: vault, vault_token_account, mint, claimer_token_account,
    //   handle_record, claimer, token_program, associated_token_program, system_program
    keys = [
      { pubkey: vaultPubkey, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: claimantAta, isSigner: false, isWritable: true },
      { pubkey: hrPda, isSigner: false, isWritable: false },
      { pubkey: claimantPubkey, isSigner: true, isWritable: true },
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
    feePayer: claimantPubkey,
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
    isNative,
    mint: mint.toBase58(),
  });
}
