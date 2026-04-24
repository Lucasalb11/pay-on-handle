import { NextRequest, NextResponse } from "next/server";

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_DEVNET = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// GET /api/jupiter?inputMint=...&outputMint=...&amount=...&slippageBps=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inputMint = searchParams.get("inputMint") ?? SOL_MINT;
  const outputMint = searchParams.get("outputMint") ?? USDC_DEVNET;
  const amount = searchParams.get("amount");
  const slippageBps = searchParams.get("slippageBps") ?? "50";

  if (!amount || isNaN(Number(amount))) {
    return NextResponse.json(
      { error: "amount required (in lamports/raw units)" },
      { status: 400 }
    );
  }

  const url = new URL(JUPITER_QUOTE_API);
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", amount);
  url.searchParams.set("slippageBps", slippageBps);
  url.searchParams.set("onlyDirectRoutes", "false");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 10 },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Jupiter API unreachable", details: e?.message },
      { status: 503 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Jupiter quote failed", details: await res.text() },
      { status: res.status }
    );
  }

  const quote = await res.json();
  return NextResponse.json(quote);
}

// POST /api/jupiter — build swap transaction
// Body: { quoteResponse, userPublicKey, wrapUnwrapSOL? }
export async function POST(req: NextRequest) {
  let body: {
    quoteResponse: unknown;
    userPublicKey: string;
    wrapUnwrapSOL?: boolean;
    dynamicComputeUnitLimit?: boolean;
    prioritizationFeeLamports?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { quoteResponse, userPublicKey, wrapUnwrapSOL = true } = body;

  if (!quoteResponse || !userPublicKey) {
    return NextResponse.json(
      { error: "quoteResponse and userPublicKey required" },
      { status: 400 }
    );
  }

  const swapRes = await fetch(JUPITER_SWAP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapUnwrapSOL,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  if (!swapRes.ok) {
    return NextResponse.json(
      { error: "Jupiter swap tx failed", details: await swapRes.text() },
      { status: swapRes.status }
    );
  }

  const { swapTransaction } = await swapRes.json();
  return NextResponse.json({ swapTransaction });
}
