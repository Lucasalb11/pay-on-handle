import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { VAULT_PROGRAM_ID, NATIVE_SOL_MINT, FEE_BPS } from "./constants";
import {
  vaultPda,
  senderNoncePda,
  vaultConfigPda,
  feeCollectorPda,
  handleRecordPda,
  hashHandle,
  calculateFee,
} from "./utils";
import { getSenderNonce } from "./accounts";

// Real Anchor discriminators from IDL — sha256("global:<ix_name>")[0..8]
const DISC = {
  createSolVault: Buffer.from([199, 85, 223, 31, 210, 142, 93, 76]),
  createSplVault: Buffer.from([70, 237, 30, 3, 24, 231, 70, 67]),
  claimSolVault: Buffer.from([121, 14, 252, 87, 97, 18, 163, 34]),
  claimSplVault: Buffer.from([93, 172, 104, 171, 174, 96, 106, 182]),
  refundSolVault: Buffer.from([233, 123, 234, 32, 204, 95, 98, 209]),
  refundSplVault: Buffer.from([8, 216, 237, 81, 157, 247, 72, 248]),
};

export interface CreateVaultParams {
  connection: Connection;
  sender: PublicKey;
  platform: number;
  handle: string;
  amountLamports: bigint;
  mint?: PublicKey;
}

export interface CreateVaultResult {
  transaction: Transaction;
  vault: PublicKey;
  nonce: bigint;
  netAmount: bigint;
  feeAmount: bigint;
}

export async function buildCreateVaultTx(
  params: CreateVaultParams
): Promise<CreateVaultResult> {
  const { connection, sender, platform, handle, amountLamports } = params;
  const mint = params.mint ?? new PublicKey(NATIVE_SOL_MINT);
  const isNative = mint.toBase58() === NATIVE_SOL_MINT;

  const handleHash = hashHandle(handle);
  const nonce = await getSenderNonce(connection, sender);
  const vault = vaultPda(sender, nonce);
  const noncePda = senderNoncePda(sender);
  const vaultConfig = vaultConfigPda();
  const feeCollector = feeCollectorPda();

  const feeAmount = calculateFee(amountLamports, BigInt(FEE_BPS));
  const netAmount = amountLamports - feeAmount;

  // Layout: [8 disc][1 platform][32 handle_hash][8 nonce][8 gross_amount]
  const ixData = Buffer.alloc(57);
  let keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];

  if (isNative) {
    DISC.createSolVault.copy(ixData, 0);
    ixData.writeUInt8(platform, 8);
    Buffer.from(handleHash).copy(ixData, 9);
    ixData.writeBigUInt64LE(nonce, 41);
    ixData.writeBigUInt64LE(amountLamports, 49);

    // CreateSolVault context order: vault, sender_nonce, config, fee_collector, sender, system_program
    keys = [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: noncePda, isSigner: false, isWritable: true },
      { pubkey: vaultConfig, isSigner: false, isWritable: false },
      { pubkey: feeCollector, isSigner: false, isWritable: true },
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  } else {
    DISC.createSplVault.copy(ixData, 0);
    ixData.writeUInt8(platform, 8);
    Buffer.from(handleHash).copy(ixData, 9);
    ixData.writeBigUInt64LE(nonce, 41);
    ixData.writeBigUInt64LE(amountLamports, 49);

    const vaultAta = await getAssociatedTokenAddress(mint, vault, true);
    const senderAta = await getAssociatedTokenAddress(mint, sender);
    const feeCollectorAta = await getAssociatedTokenAddress(mint, feeCollector);

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
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  }

  const instruction = new TransactionInstruction({
    programId: new PublicKey(VAULT_PROGRAM_ID),
    keys,
    data: ixData,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: sender,
    blockhash,
    lastValidBlockHeight,
  });
  transaction.add(instruction);

  return { transaction, vault, nonce, netAmount, feeAmount };
}

export interface ClaimVaultParams {
  connection: Connection;
  claimant: PublicKey;
  vault: PublicKey;
  handle: string;
  platform: number;
  mint: PublicKey;
}

export async function buildClaimVaultTx(
  params: ClaimVaultParams
): Promise<Transaction> {
  const { connection, claimant, vault, handle, platform, mint } = params;

  const handleHash = hashHandle(handle);
  const hrPda = handleRecordPda(platform, handleHash);
  const isNative = mint.toBase58() === NATIVE_SOL_MINT;

  // Layout: [8 disc][32 handle_hash]
  const ixData = Buffer.alloc(40);
  let keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];

  if (isNative) {
    DISC.claimSolVault.copy(ixData, 0);
    Buffer.from(handleHash).copy(ixData, 8);

    // ClaimSolVault context order: vault, handle_record, claimer, system_program
    keys = [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: hrPda, isSigner: false, isWritable: false },
      { pubkey: claimant, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  } else {
    DISC.claimSplVault.copy(ixData, 0);
    Buffer.from(handleHash).copy(ixData, 8);

    const vaultAta = await getAssociatedTokenAddress(mint, vault, true);
    const claimantAta = await getAssociatedTokenAddress(mint, claimant);

    // ClaimSplVault context order: vault, vault_token_account, mint, claimer_token_account,
    //   handle_record, claimer, token_program, associated_token_program, system_program
    keys = [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: claimantAta, isSigner: false, isWritable: true },
      { pubkey: hrPda, isSigner: false, isWritable: false },
      { pubkey: claimant, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  }

  const instruction = new TransactionInstruction({
    programId: new PublicKey(VAULT_PROGRAM_ID),
    keys,
    data: ixData,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: claimant,
    blockhash,
    lastValidBlockHeight,
  });
  transaction.add(instruction);
  return transaction;
}

export interface RefundVaultParams {
  connection: Connection;
  sender: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
}

export async function buildRefundVaultTx(
  params: RefundVaultParams
): Promise<Transaction> {
  const { connection, sender, vault, mint } = params;
  const isNative = mint.toBase58() === NATIVE_SOL_MINT;

  const ixData = Buffer.alloc(8);
  let keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];

  if (isNative) {
    DISC.refundSolVault.copy(ixData, 0);

    // RefundSolVault context order: vault, sender, system_program
    keys = [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  } else {
    DISC.refundSplVault.copy(ixData, 0);

    const vaultAta = await getAssociatedTokenAddress(mint, vault, true);
    const senderAta = await getAssociatedTokenAddress(mint, sender);

    // RefundSplVault context order: vault, vault_token_account, mint, sender_token_account,
    //   sender, token_program, associated_token_program, system_program
    keys = [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: senderAta, isSigner: false, isWritable: true },
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  }

  const instruction = new TransactionInstruction({
    programId: new PublicKey(VAULT_PROGRAM_ID),
    keys,
    data: ixData,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: sender,
    blockhash,
    lastValidBlockHeight,
  });
  transaction.add(instruction);
  return transaction;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}

export function usdcToRaw(usdc: number): bigint {
  return BigInt(Math.round(usdc * 1_000_000));
}
