"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const privyConfig = {
  loginMethods: ["google", "apple", "twitter", "email", "sms"] as (
    | "google"
    | "apple"
    | "twitter"
    | "email"
    | "sms"
  )[],
  appearance: {
    theme: "dark" as const,
    accentColor: "#9945FF" as `#${string}`,
    logo: "/logo.png",
    showWalletLoginFirst: false,
  },
  embeddedWallets: {
    createOnLogin: "users-without-wallets" as const,
    requireUserPasswordOnCreate: false,
    noPromptOnSignature: false,
  },
  defaultChain: {
    id: 101,
    name: "Solana",
    network: "mainnet-beta",
    nativeCurrency: { name: "SOL", symbol: "SOL", decimals: 9 },
    rpcUrls: {
      default: {
        http: [
          process.env.NEXT_PUBLIC_RPC_ENDPOINT ??
            "https://api.devnet.solana.com",
        ],
      },
      public: {
        http: [
          process.env.NEXT_PUBLIC_RPC_ENDPOINT ??
            "https://api.devnet.solana.com",
        ],
      },
    },
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
