export const REGISTRY_PROGRAM_ID =
  "AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX";
export const VAULT_PROGRAM_ID = "EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H";
export const FEE_COLLECTOR_PROGRAM_ID =
  "CxMBNwbovsvLTe7bSuca8X26WS7PW81VtDu3oLyfSG6s";

export const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_DEVNET_MINT = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
export const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const CLAIM_PERIOD_DAYS = 7;
export const FEE_BPS = 50; // 0.5%

export const PLATFORMS = {
  instagram: { id: 0, label: "Instagram", icon: "📸", color: "#E1306C" },
  twitter: { id: 1, label: "X (Twitter)", icon: "𝕏", color: "#1DA1F2" },
  whatsapp: { id: 2, label: "WhatsApp", icon: "💬", color: "#25D366" },
} as const;

export type PlatformKey = keyof typeof PLATFORMS;

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? "https://api.devnet.solana.com";

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://paganno.at";
