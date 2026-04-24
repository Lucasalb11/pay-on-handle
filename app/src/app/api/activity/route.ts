import { NextRequest, NextResponse } from "next/server";

const VAULT_PROGRAM_ID = "EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H";
const LAMPORTS_PER_SOL = 1_000_000_000;

interface HeliusTx {
  signature: string;
  timestamp: number;
  type: string;
  description: string;
  feePayer: string;
  accountData: {
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: unknown[];
  }[];
  instructions: {
    programId: string;
    accounts: string[];
    data: string;
    innerInstructions?: unknown[];
  }[];
  nativeTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
  tokenTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }[];
}

export interface ActivityItem {
  signature: string;
  timestamp: number;
  type: "sent" | "received" | "refunded";
  amountSol: number;
  amountUsdc?: number;
}

function classifyTx(tx: HeliusTx, wallet: string): ActivityItem | null {
  const isVaultTx =
    tx.instructions?.some((ix) => ix.programId === VAULT_PROGRAM_ID) ||
    tx.instructions?.some((ix) =>
      ix.innerInstructions?.some(
        (inner: unknown) =>
          (inner as { programId?: string }).programId === VAULT_PROGRAM_ID
      )
    );

  if (!isVaultTx) return null;

  const walletData = tx.accountData?.find((a) => a.account === wallet);
  const balanceChange = walletData?.nativeBalanceChange ?? 0;

  // Determine direction: positive = received funds, negative = sent funds
  const type: "sent" | "received" | "refunded" =
    balanceChange > 0 ? "received" : "sent";

  const amountSol = Math.abs(balanceChange) / LAMPORTS_PER_SOL;
  if (amountSol === 0) return null;

  return {
    signature: tx.signature,
    timestamp: tx.timestamp,
    type,
    amountSol,
  };
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "HELIUS_API_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${apiKey}&limit=20`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`[activity] Helius ${res.status}:`, await res.text());
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 502 }
      );
    }

    const txs: HeliusTx[] = await res.json();
    const items = txs
      .map((tx) => classifyTx(tx, wallet))
      .filter((item): item is ActivityItem => item !== null);

    return NextResponse.json(items);
  } catch (err) {
    console.error("[activity] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
