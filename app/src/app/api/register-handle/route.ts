import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { createHash } from "crypto";
import bs58 from "bs58";
import { RPC_ENDPOINT, REGISTRY_PROGRAM_ID } from "@/lib/constants";
import { hashHandle, handleRecordPda } from "@/lib/handle";

const connection = new Connection(RPC_ENDPOINT, "confirmed");

// sha256("global:register_handle")[0..8]
const DISC_REGISTER_HANDLE = createHash("sha256")
  .update("global:register_handle")
  .digest()
  .slice(0, 8);

// sha256("account:RegistryConfig")[0..8] — not needed here but for reference
const REGISTRY_CONFIG_PROGRAM_ID = new PublicKey(REGISTRY_PROGRAM_ID);

function registryConfigPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    REGISTRY_CONFIG_PROGRAM_ID
  )[0];
}

function buildRegisterHandleIx(
  platform: number,
  handleHash: Uint8Array,
  destinationWallet: PublicKey,
  owner: PublicKey,
  proofData: Buffer
): TransactionInstruction {
  const handleRecord = handleRecordPda(platform, handleHash);
  const config = registryConfigPda();

  // Borsh layout:
  //   [8]  discriminator
  //   [1]  platform (u8)
  //   [32] handle_hash ([u8; 32])
  //   [32] destination_wallet (Pubkey)
  //   [4]  proof_data length (u32 LE)
  //   [N]  proof_data bytes
  const dataLen = 8 + 1 + 32 + 32 + 4 + proofData.length;
  const data = Buffer.alloc(dataLen);

  let o = 0;
  Buffer.from(DISC_REGISTER_HANDLE).copy(data, o);
  o += 8;
  data.writeUInt8(platform, o);
  o += 1;
  Buffer.from(handleHash).copy(data, o);
  o += 32;
  destinationWallet.toBuffer().copy(data, o);
  o += 32;
  data.writeUInt32LE(proofData.length, o);
  o += 4;
  proofData.copy(data, o);

  return new TransactionInstruction({
    programId: REGISTRY_CONFIG_PROGRAM_ID,
    keys: [
      { pubkey: handleRecord, isSigner: false, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

interface RegisterBody {
  /** User's Solana wallet (becomes owner + payer) */
  walletAddress: string;
  /** 0=Instagram, 1=Twitter/X, 2=WhatsApp */
  platform: number;
  /** Handle without @ */
  handle: string;
  /** Optional: override destination wallet (default = walletAddress) */
  destinationWallet?: string;
}

export async function POST(req: NextRequest) {
  let body: RegisterBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { walletAddress, platform, handle, destinationWallet } = body;

  if (!walletAddress || platform === undefined || !handle) {
    return NextResponse.json(
      { error: "walletAddress, platform, handle are required" },
      { status: 400 }
    );
  }

  if (platform < 0 || platform > 2) {
    return NextResponse.json(
      { error: "platform must be 0 (Instagram), 1 (Twitter), or 2 (WhatsApp)" },
      { status: 400 }
    );
  }

  let ownerPubkey: PublicKey;
  let destPubkey: PublicKey;
  try {
    ownerPubkey = new PublicKey(walletAddress);
    destPubkey = destinationWallet
      ? new PublicKey(destinationWallet)
      : ownerPubkey;
  } catch {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400 }
    );
  }

  // Verify with Privy server-auth if configured — confirms user owns this wallet.
  // MVP stub: we trust the client asserts handle ownership.
  // Production: replace with PrivyClient.verifyAuthToken() + check linked accounts.
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (appId && appSecret) {
    try {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const { PrivyClient } = await import("@privy-io/server-auth");
        const privy = new PrivyClient(appId, appSecret);
        await privy.verifyAuthToken(token);
      }
    } catch {
      // Privy verification failed — reject in production, warn in dev
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  const handleHash = hashHandle(handle);
  const handleRecord = handleRecordPda(platform, handleHash);

  // Check if already registered (idempotent)
  const existing = await connection.getAccountInfo(handleRecord);
  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyRegistered: true,
      handleRecord: handleRecord.toBase58(),
      handleHash: Buffer.from(handleHash).toString("hex"),
    });
  }

  // Proof: MVP stub — any non-empty bytes satisfy the registry's current validation.
  // TODO: replace with relayer co-signature once C-2 is resolved.
  const proofData = Buffer.from("privy-verified");

  const ix = buildRegisterHandleIx(
    platform,
    handleHash,
    destPubkey,
    ownerPubkey,
    proofData
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: ownerPubkey,
    blockhash,
    lastValidBlockHeight,
  });
  tx.add(ix);

  // If RELAYER_PRIVATE_KEY is set and we want the relayer to co-sign (future use).
  // For now the user's wallet is both payer and signer.
  const relayerKey = process.env.RELAYER_PRIVATE_KEY;
  if (relayerKey) {
    try {
      const relayer = Keypair.fromSecretKey(bs58.decode(relayerKey));
      // Relayer partial sign (not used as payer yet — program requires owner=payer).
      // Kept as placeholder for future gasless flow.
      void relayer;
    } catch {
      // Invalid key — ignore
    }
  }

  const serialized = tx.serialize({ requireAllSignatures: false });

  return NextResponse.json({
    ok: true,
    alreadyRegistered: false,
    transaction: serialized.toString("base64"),
    handleRecord: handleRecord.toBase58(),
    handleHash: Buffer.from(handleHash).toString("hex"),
    platform,
  });
}
