import { createHash } from "crypto";
import { PublicKey } from "@solana/web3.js";
import {
  VAULT_PROGRAM_ID,
  REGISTRY_PROGRAM_ID,
  FEE_COLLECTOR_PROGRAM_ID,
} from "./constants";

export function normalizeHandle(raw: string): string {
  return raw.toLowerCase().replace(/^@/, "").trim();
}

export function hashHandle(raw: string): Uint8Array {
  const hash = createHash("sha256").update(normalizeHandle(raw)).digest();
  return new Uint8Array(hash);
}

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

export function feeCollectorPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_collector")],
    new PublicKey(FEE_COLLECTOR_PROGRAM_ID)
  );
  return pda;
}

export function calculateFee(gross: bigint, feeBps: bigint): bigint {
  return (gross * feeBps) / BigInt(10_000);
}
