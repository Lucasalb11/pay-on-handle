import { Connection, PublicKey } from "@solana/web3.js";
import { VAULT_PROGRAM_ID, REGISTRY_PROGRAM_ID } from "./constants";

export type VaultStatus = "pending" | "claimed" | "refunded" | "expired";

export interface PaymentVault {
  address: string;
  sender: string;
  recipientHandleHash: string;
  recipientPlatform: number;
  amount: bigint;
  mint: string;
  status: VaultStatus;
  createdAt: number;
  expiresAt: number;
  claimedAt: number | null;
  vaultNonce: bigint;
  bump: number;
}

export interface HandleRecord {
  address: string;
  platform: number;
  handleHash: string;
  owner: string;
  destinationWallet: string;
  verified: boolean;
  createdAt: number;
  updatedAt: number;
  bump: number;
}

const STATUS_MAP: Record<number, VaultStatus> = {
  0: "pending",
  1: "claimed",
  2: "refunded",
  3: "expired",
};

export async function fetchVault(
  connection: Connection,
  vaultAddress: PublicKey
): Promise<PaymentVault | null> {
  const info = await connection.getAccountInfo(vaultAddress);
  if (!info || info.owner.toBase58() !== VAULT_PROGRAM_ID) return null;

  const d = info.data;
  let o = 8;

  const sender = new PublicKey(d.slice(o, o + 32)).toBase58();
  o += 32;
  const recipientHandleHash = Buffer.from(d.slice(o, o + 32)).toString("hex");
  o += 32;
  const recipientPlatform = d[o];
  o += 1;
  const amount = d.readBigUInt64LE(o);
  o += 8;
  const mint = new PublicKey(d.slice(o, o + 32)).toBase58();
  o += 32;
  const status = STATUS_MAP[d[o]] ?? "pending";
  o += 1;
  const createdAt = Number(d.readBigInt64LE(o));
  o += 8;
  const expiresAt = Number(d.readBigInt64LE(o));
  o += 8;
  const hasClaimedAt = d[o];
  o += 1;
  const claimedAt = hasClaimedAt ? Number(d.readBigInt64LE(o)) : null;
  o += 8;
  const vaultNonce = d.readBigUInt64LE(o);
  o += 8;
  const bump = d[o];

  return {
    address: vaultAddress.toBase58(),
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
    bump,
  };
}

export async function fetchHandleRecord(
  connection: Connection,
  recordAddress: PublicKey
): Promise<HandleRecord | null> {
  const info = await connection.getAccountInfo(recordAddress);
  if (!info || info.owner.toBase58() !== REGISTRY_PROGRAM_ID) return null;

  const d = info.data;
  let o = 8;

  const platform = d[o];
  o += 1;
  const handleHash = Buffer.from(d.slice(o, o + 32)).toString("hex");
  o += 32;
  const owner = new PublicKey(d.slice(o, o + 32)).toBase58();
  o += 32;
  const destinationWallet = new PublicKey(d.slice(o, o + 32)).toBase58();
  o += 32;
  const verified = d[o] !== 0;
  o += 1;
  const createdAt = Number(d.readBigInt64LE(o));
  o += 8;
  const updatedAt = Number(d.readBigInt64LE(o));
  o += 8;
  const bump = d[o];

  return {
    address: recordAddress.toBase58(),
    platform,
    handleHash,
    owner,
    destinationWallet,
    verified,
    createdAt,
    updatedAt,
    bump,
  };
}

export async function getSenderNonce(
  connection: Connection,
  sender: PublicKey
): Promise<bigint> {
  const [noncePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nonce"), sender.toBuffer()],
    new PublicKey(VAULT_PROGRAM_ID)
  );
  const info = await connection.getAccountInfo(noncePda);
  if (!info) return BigInt(0);
  return info.data.readBigUInt64LE(40);
}
