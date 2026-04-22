import { Connection, PublicKey } from "@solana/web3.js";
import {
  RPC_ENDPOINT,
  VAULT_PROGRAM_ID,
  REGISTRY_PROGRAM_ID,
} from "./constants";

export const connection = new Connection(RPC_ENDPOINT, "confirmed");

export function vaultPda(sender: PublicKey, nonce: bigint): PublicKey {
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64LE(nonce);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), sender.toBuffer(), nonceBytes],
    new PublicKey(VAULT_PROGRAM_ID)
  );
  return pda;
}

export function handleRecordPda(
  platform: number,
  handleHash: Uint8Array
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("handle"), Buffer.from([platform]), Buffer.from(handleHash)],
    new PublicKey(REGISTRY_PROGRAM_ID)
  );
  return pda;
}

export function senderNoncePda(sender: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nonce"), sender.toBuffer()],
    new PublicKey(VAULT_PROGRAM_ID)
  );
  return pda;
}

export function vaultConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_config")],
    new PublicKey(VAULT_PROGRAM_ID)
  );
  return pda;
}

/** Returns the current sender nonce (next vault nonce to use). */
export async function getSenderNonce(sender: PublicKey): Promise<bigint> {
  const noncePda = senderNoncePda(sender);
  const info = await connection.getAccountInfo(noncePda);
  if (!info) return BigInt(0);
  // SenderNonce layout: 8 (discriminator) + 32 (sender) + 8 (nonce) + 1 (bump)
  const nonce = info.data.readBigUInt64LE(40);
  return nonce;
}

export async function getSolPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://price.jup.ag/v6/price?ids=SOL&vsToken=USD"
    );
    const data = await res.json();
    return data?.data?.SOL?.price ?? 150;
  } catch {
    return 150;
  }
}
