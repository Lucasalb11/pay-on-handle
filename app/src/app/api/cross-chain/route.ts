import { NextRequest, NextResponse } from "next/server";

/**
 * Cross-chain vault creation via Ika (MPC threshold signing).
 *
 * Stub — Ika mainnet is not yet live (expected Q3 2025). This endpoint
 * accepts a cross-chain send request and returns the expected parameters
 * that will be needed once the Ika SDK is available.
 *
 * Production flow:
 *  1. User initiates send from EVM/BTC/etc chain
 *  2. Ika validators bridge the asset to Solana
 *  3. Once SOL/USDC lands in relayer wallet, /api/send is called to create vault
 *
 * Docs: https://docs.ika.xyz
 */

interface CrossChainRequest {
  sourceChain: string;
  sourceToken: string;
  amount: string;
  recipientHandle: string;
  recipientPlatform: number;
}

const SUPPORTED_CHAINS = [
  "ethereum",
  "polygon",
  "bnb",
  "arbitrum",
  "base",
] as const;

export async function POST(req: NextRequest) {
  let body: CrossChainRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    sourceChain,
    sourceToken,
    amount,
    recipientHandle,
    recipientPlatform,
  } = body;

  if (!sourceChain || !sourceToken || !amount || !recipientHandle) {
    return NextResponse.json(
      { error: "sourceChain, sourceToken, amount, recipientHandle required" },
      { status: 400 }
    );
  }

  if (
    !SUPPORTED_CHAINS.includes(sourceChain as (typeof SUPPORTED_CHAINS)[number])
  ) {
    return NextResponse.json(
      { error: `Unsupported chain. Supported: ${SUPPORTED_CHAINS.join(", ")}` },
      { status: 400 }
    );
  }

  // Stub response: return what the Ika bridge call will look like
  return NextResponse.json({
    status: "stub",
    message: "Ika cross-chain bridge is not yet live. Expected Q3 2025.",
    params: {
      sourceChain,
      sourceToken,
      amount,
      destinationChain: "solana",
      destinationProgram: "EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H",
      recipientHandle,
      recipientPlatform,
    },
    estimatedBridgeTime: "2-5 minutes",
    estimatedFee: "~$0.50",
    docsUrl: "https://docs.ika.xyz",
  });
}

export async function GET() {
  return NextResponse.json({
    supported: SUPPORTED_CHAINS,
    status: "stub",
    message: "Ika cross-chain support pending mainnet launch",
  });
}
