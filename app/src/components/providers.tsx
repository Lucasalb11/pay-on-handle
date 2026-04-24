"use client";

import {
  PrivyProvider,
  usePrivy,
  useSolanaWallets,
} from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { connection } from "@/lib/solana";

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

// Auto-registers a Twitter handle on-chain after login.
// Runs once per session — idempotent (server checks if HandleRecord exists).
function AutoRegisterHandle() {
  const { user, getAccessToken } = usePrivy();
  const { wallets, createWallet } = useSolanaWallets();

  // Create embedded Solana wallet if the user authenticated but has none yet.
  // This happens when the Privy dashboard has embedded wallets enabled but
  // createOnLogin didn't fire (race condition or first-time user).
  useEffect(() => {
    if (!user || wallets.length > 0) return;
    createWallet().catch(() => {
      // Non-fatal — wallet may already be creating or dashboard config pending
    });
  }, [user?.id, wallets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const wallet = wallets[0];
    if (!user || !wallet) return;

    const twitter = user.linkedAccounts?.find(
      (a) => a.type === "twitter_oauth"
    ) as { username?: string } | undefined;
    if (!twitter?.username) return;

    const handle = twitter.username;
    const walletAddress = wallet.address;

    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/register-handle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ walletAddress, platform: 1, handle }),
        });

        const data = await res.json();
        if (!res.ok || data.alreadyRegistered) return;

        // Sign and send the registration transaction
        const txBytes = Buffer.from(data.transaction, "base64");
        const { Transaction } = await import("@solana/web3.js");
        const tx = Transaction.from(txBytes);
        await wallet.sendTransaction(tx, connection);
      } catch {
        // Non-fatal — user can still send/receive
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, wallets[0]?.address]);

  return null;
}

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
      <QueryClientProvider client={queryClient}>
        <AutoRegisterHandle />
        {children}
      </QueryClientProvider>
    </PrivyProvider>
  );
}
