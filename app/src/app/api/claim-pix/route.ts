import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  RPC_ENDPOINT,
  VAULT_PROGRAM_ID,
  NATIVE_SOL_MINT,
  USDC_DEVNET_MINT,
} from "@/lib/constants";
import { hashHandle, handleRecordPda } from "@/lib/handle";
import { setPixIntent } from "@/lib/pix-store";

const connection = new Connection(RPC_ENDPOINT, "confirmed");

// Real Anchor discriminators from IDL
const DISC_CLAIM_SOL = Buffer.from([121, 14, 252, 87, 97, 18, 163, 34]);

type ClaimPixBody = {
  vaultId: string;
  handle: string;
  pixKey: string;
  claimant?: string;
};

export async function POST(req: NextRequest) {
  let body: ClaimPixBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { vaultId, handle, pixKey, claimant } = body;

  if (!vaultId || !handle || !pixKey) {
    return NextResponse.json(
      { error: "vaultId, handle and pixKey required" },
      { status: 400 }
    );
  }

  let vaultPubkey: PublicKey;
  try {
    vaultPubkey = new PublicKey(vaultId);
  } catch {
    return NextResponse.json({ error: "Invalid vault ID" }, { status: 400 });
  }

  const vaultInfo = await connection.getAccountInfo(vaultPubkey);
  if (!vaultInfo || vaultInfo.owner.toBase58() !== VAULT_PROGRAM_ID) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  const data = vaultInfo.data;

  // Validate vault status (offset 113) and expiry (offset 122)
  if (data[113] !== 0) {
    return NextResponse.json(
      { error: "Vault is not pending" },
      { status: 400 }
    );
  }
  if (Math.floor(Date.now() / 1000) > Number(data.readBigInt64LE(122))) {
    return NextResponse.json({ error: "Vault expired" }, { status: 400 });
  }

  // Validate handle hash matches vault
  const handleHash = hashHandle(handle);
  const vaultHash = Buffer.from(data.slice(40, 72)).toString("hex");
  const claimHash = Buffer.from(handleHash).toString("hex");
  if (vaultHash !== claimHash) {
    return NextResponse.json(
      { error: "Handle does not match this payment" },
      { status: 400 }
    );
  }

  const platform = data[8 + 32 + 32]; // offset 72
  const mint = new PublicKey(data.slice(81, 113));
  const isNative = mint.toBase58() === NATIVE_SOL_MINT;

  // For PIX flow the claimant must be provided (signs on client-side)
  if (!claimant) {
    return NextResponse.json(
      { error: "claimant address required for PIX flow" },
      { status: 400 }
    );
  }

  let claimantPubkey: PublicKey;
  try {
    claimantPubkey = new PublicKey(claimant);
  } catch {
    return NextResponse.json({ error: "Invalid claimant" }, { status: 400 });
  }

  const hrPda = handleRecordPda(platform, handleHash);

  // Build claim transaction (client will sign and broadcast)
  const ixData = Buffer.alloc(40);
  DISC_CLAIM_SOL.copy(ixData, 0);
  Buffer.from(handleHash).copy(ixData, 8);

  // ClaimSolVault context order: vault, handle_record, claimer, system_program
  const keys = [
    { pubkey: vaultPubkey, isSigner: false, isWritable: true },
    { pubkey: hrPda, isSigner: false, isWritable: false },
    { pubkey: claimantPubkey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

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
  const netLamports = Number(data.readBigUInt64LE(73));
  const vaultNonce = data.readBigUInt64LE(139).toString();

  // Fetch SOL/BRL rate to lock the payout amount
  let solBrl = 750; // fallback
  try {
    const [binanceRes, fxRes] = await Promise.allSettled([
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT"),
      fetch("https://open.er-api.com/v6/latest/USD"),
    ]);
    const solUsd =
      binanceRes.status === "fulfilled" && binanceRes.value.ok
        ? parseFloat((await binanceRes.value.json()).price)
        : 150;
    const usdBrl =
      fxRes.status === "fulfilled" && fxRes.value.ok
        ? ((await fxRes.value.json()) as { rates: { BRL: number } }).rates.BRL
        : 5.0;
    solBrl = solUsd * usdBrl;
  } catch {
    // use fallback
  }

  const brlCents = Math.round((netLamports / 1e9) * solBrl * 100);

  // Store PIX intent so the Helius webhook can dispatch after claim confirms
  setPixIntent(vaultNonce, {
    pixKey,
    brlCents,
    lamports: netLamports,
    createdAt: Date.now(),
  });

  // Jupiter quote: SOL → USDC (informational only)
  let jupiterQuote: unknown = null;
  try {
    const jupUrl = new URL(
      `${
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      }/api/jupiter`
    );
    jupUrl.searchParams.set("inputMint", NATIVE_SOL_MINT);
    jupUrl.searchParams.set("outputMint", USDC_DEVNET_MINT);
    jupUrl.searchParams.set("amount", netLamports.toString());
    jupUrl.searchParams.set("slippageBps", "50");
    const jupRes = await fetch(jupUrl.toString());
    if (jupRes.ok) jupiterQuote = await jupRes.json();
  } catch {
    // optional
  }

  return NextResponse.json({
    transaction: serialized.toString("base64"),
    netLamports,
    brlCents,
    jupiterQuote,
    pixKey,
    note: "Sign the claim tx on-chain. PIX will be dispatched automatically once confirmed (~60s).",
    pixStatus: "pending_claim",
  });
}
