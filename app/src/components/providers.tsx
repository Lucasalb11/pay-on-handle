"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

const privyConfig = {
  loginMethods: ["google", "apple", "twitter", "email", "sms", "wallet"] as (
    | "google"
    | "apple"
    | "twitter"
    | "email"
    | "sms"
    | "wallet"
  )[],
  appearance: {
    theme: "dark" as const,
    accentColor: "#9945FF" as `#${string}`,
    logo: "/logo.png",
    showWalletLoginFirst: false,
    walletChainType: "solana-only" as const,
    walletList: ["phantom", "solflare", "detected_solana_wallets"] as (
      | "phantom"
      | "solflare"
      | "detected_solana_wallets"
    )[],
  },
  embeddedWallets: {
    createOnLogin: "users-without-wallets" as const,
    requireUserPasswordOnCreate: false,
    noPromptOnSignature: false,
  },
  externalWallets: {
    solana: { connectors: solanaConnectors },
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 2 },
        },
      })
  );

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "clp..."}
      config={privyConfig}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PrivyProvider>
  );
}
