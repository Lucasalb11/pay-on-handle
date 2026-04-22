import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  VAULT_PROGRAM_ID,
  REGISTRY_PROGRAM_ID,
  FEE_COLLECTOR_PROGRAM_ID,
  NATIVE_SOL_MINT,
  FEE_BPS,
} from "./constants";
import {
  vaultPda,
  handleRecordPda,
  senderNoncePda,
  vaultConfigPda,
  feeCollectorPda,
  hashHandle,
  calculateFee,
} from "./utils";
import { getSenderNonce } from "./accounts";

// Anchor discriminators: sha256("global:<instruction_name>")[0..8]
const DISC = {
  createVault: Buffer.from([0x29, 0x0f, 0xa3, 0xe8, 0x7e, 0xb0, 0x2d, 0x2a]),
  claimVault: Buffer.from([0x3d, 0x1e, 0xa6, 0x72, 0x5f, 0x4c, 0x38, 0x01]),
  refundVault: Buffer.from([0x1a, 0x77, 0x2c, 0x4f, 0x9e, 0x3b, 0x15, 0x88]),
  registerHandle: Buffer.from([0x62, 0x3f, 0xd8, 0x1b, 0xae, 0x4c, 0x20, 0x5e]),
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

  const handleHash = hashHandle(handle);
  const nonce = await getSenderNonce(connection, sender);
  const vault = vaultPda(sender, nonce);
  const noncePda = senderNoncePda(sender);
  const vaultConfig = vaultConfigPda();
  const handleRecord = handleRecordPda(platform, handleHash);
  const feeCollector = feeCollectorPda();

  const feeAmount = calculateFee(amountLamports, BigInt(FEE_BPS));
  const netAmount = amountLamports - feeAmount;

  // Layout: [8 disc][1 platform][32 handleHash][8 amount][32 mint][8 nonce]
  const ixData = Buffer.alloc(89);
  DISC.createVault.copy(ixData, 0);
  ixData.writeUInt8(platform, 8);
  Buffer.from(handleHash).copy(ixData, 9);
  ixData.writeBigUInt64LE(amountLamports, 41);
  mint.toBuffer().copy(ixData, 49);
  ixData.writeBigUInt64LE(nonce, 81);

  const keys = [
    { pubkey: sender, isSigner: true, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: noncePda, isSigner: false, isWritable: true },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: handleRecord, isSigner: false, isWritable: false },
    { pubkey: feeCollector, isSigner: false, isWritable: true },
    {
      pubkey: new PublicKey(REGISTRY_PROGRAM_ID),
      isSigner: false,
      isWritable: false,
    },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

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
  platform: number;
  handle: string;
  mint: PublicKey;
}

export async function buildClaimVaultTx(
  params: ClaimVaultParams
): Promise<Transaction> {
  const { connection, claimant, vault, platform, handle, mint } = params;

  const handleHash = hashHandle(handle);
  const isNative = mint.toBase58() === NATIVE_SOL_MINT;

  const ixData = Buffer.alloc(41);
  DISC.claimVault.copy(ixData, 0);
  ixData.writeUInt8(platform, 8);
  Buffer.from(handleHash).copy(ixData, 9);

  let keys;
  if (isNative) {
    keys = [
      { pubkey: claimant, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  } else {
    const claimantAta = await getAssociatedTokenAddress(mint, claimant);
    const vaultAta = await getAssociatedTokenAddress(mint, vault, true);
    keys = [
      { pubkey: claimant, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: claimantAta, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
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
  DISC.refundVault.copy(ixData, 0);

  let keys;
  if (isNative) {
    keys = [
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
  } else {
    const senderAta = await getAssociatedTokenAddress(mint, sender);
    const vaultAta = await getAssociatedTokenAddress(mint, vault, true);
    keys = [
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: senderAta, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
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

/** Helper: convert SOL to lamports safely. */
export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}

/** Helper: convert USDC decimal amount to raw u64. */
export function usdcToRaw(usdc: number): bigint {
  return BigInt(Math.round(usdc * 1_000_000));
}
