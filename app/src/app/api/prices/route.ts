import { NextResponse } from "next/server";

export const revalidate = 60; // cache 60s on edge

export async function GET() {
  try {
    const res = await fetch(
      "https://price.jup.ag/v6/price?ids=SOL,USDC&vsToken=USD",
      { next: { revalidate: 60 } }
    );
    const data = await res.json();

    const solUsd: number = data?.data?.SOL?.price ?? 150;
    const usdBrl = 5.1; // static placeholder; replace with Open Exchange Rates API

    return NextResponse.json({
      sol_usd: solUsd,
      sol_brl: solUsd * usdBrl,
      usdc_usd: 1,
      usdc_brl: usdBrl,
      updated_at: Date.now(),
    });
  } catch {
    return NextResponse.json({
      sol_usd: 150,
      sol_brl: 765,
      usdc_usd: 1,
      usdc_brl: 5.1,
      updated_at: Date.now(),
    });
  }
}
