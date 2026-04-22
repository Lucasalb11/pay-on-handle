export const REGISTRY_PROGRAM_ID =
  "AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX";
export const VAULT_PROGRAM_ID = "EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H";
export const FEE_COLLECTOR_PROGRAM_ID =
  "CxMBNwbovsvLTe7bSuca8X26WS7PW81VtDu3oLyfSG6s";

export const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DEVNET_MINT = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

export const CLAIM_PERIOD_SECONDS = 7 * 24 * 60 * 60;
export const FEE_BPS = 50;

export const PLATFORMS = {
  instagram: { id: 0, label: "Instagram" },
  twitter: { id: 1, label: "X (Twitter)" },
  whatsapp: { id: 2, label: "WhatsApp" },
} as const;

export type Platform = keyof typeof PLATFORMS;
export type PlatformId = 0 | 1 | 2;
