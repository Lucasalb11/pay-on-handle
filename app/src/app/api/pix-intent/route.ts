import { NextRequest, NextResponse } from "next/server";
import { setPixIntent, PixIntent } from "@/lib/pix-store";

interface PixIntentBody {
  vaultNonce: string;
  pixKey: string;
  brlCents: number;
  lamports: number;
}

export async function POST(req: NextRequest) {
  let body: PixIntentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { vaultNonce, pixKey, brlCents, lamports } = body;

  if (!vaultNonce || !pixKey || !brlCents || !lamports) {
    return NextResponse.json(
      { error: "vaultNonce, pixKey, brlCents, lamports are required" },
      { status: 400 }
    );
  }

  if (typeof brlCents !== "number" || brlCents <= 0) {
    return NextResponse.json(
      { error: "brlCents must be a positive number" },
      { status: 400 }
    );
  }

  const intent: PixIntent = {
    pixKey,
    brlCents,
    lamports,
    createdAt: Date.now(),
  };

  await setPixIntent(vaultNonce, intent);

  return NextResponse.json({ ok: true });
}
