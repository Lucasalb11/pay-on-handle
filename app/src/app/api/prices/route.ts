import { NextResponse } from "next/server";

export const revalidate = 60;

const FALLBACK = { sol_usd: 150, sol_brl: 750, usdc_usd: 1, usdc_brl: 5.0 };

export async function GET() {
  try {
    const [binanceRes, fxRes] = await Promise.allSettled([
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", {
        next: { revalidate: 60 },
      }),
      fetch("https://open.er-api.com/v6/latest/USD", {
        next: { revalidate: 3600 },
      }),
    ]);

    const solUsd =
      binanceRes.status === "fulfilled" && binanceRes.value.ok
        ? parseFloat((await binanceRes.value.json()).price)
        : FALLBACK.sol_usd;

    const usdBrl =
      fxRes.status === "fulfilled" && fxRes.value.ok
        ? ((await fxRes.value.json()) as { rates: { BRL: number } }).rates.BRL
        : FALLBACK.usdc_brl;

    return NextResponse.json({
      sol_usd: solUsd,
      sol_brl: solUsd * usdBrl,
      usdc_usd: 1,
      usdc_brl: usdBrl,
      updated_at: Date.now(),
    });
  } catch {
    return NextResponse.json({
      ...FALLBACK,
      sol_brl: FALLBACK.sol_usd * FALLBACK.usdc_brl,
      updated_at: Date.now(),
    });
  }
}
