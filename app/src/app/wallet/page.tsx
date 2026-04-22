"use client";

import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Plus, RefreshCw } from "lucide-react";
import { connection } from "@/lib/solana";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { getSolPrice } from "@/lib/solana";

function useWalletBalance(address: string | undefined) {
  return useQuery({
    queryKey: ["balance", address],
    queryFn: async () => {
      if (!address) return 0;
      const lamports = await connection.getBalance(new PublicKey(address));
      return lamports / LAMPORTS_PER_SOL;
    },
    enabled: !!address,
    refetchInterval: 30_000,
  });
}

function useSolPrice() {
  return useQuery({
    queryKey: ["sol-price"],
    queryFn: getSolPrice,
    refetchInterval: 60_000,
  });
}

export default function WalletPage() {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useSolanaWallets();
  const router = useRouter();

  const wallet = wallets[0];
  const address = wallet?.address;

  const {
    data: solBalance = 0,
    refetch: refetchBalance,
    isFetching,
  } = useWalletBalance(address);
  const { data: solPrice = 150 } = useSolPrice();

  const balanceUsd = solBalance * solPrice;
  const balanceBrl = balanceUsd * 5.1; // approx BRL rate

  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  return (
    <main className="min-h-dvh flex flex-col pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Paga no @
          </h1>
          {address && (
            <p className="text-white/40 text-xs font-mono mt-0.5">
              {address.slice(0, 4)}...{address.slice(-4)}
            </p>
          )}
        </div>
        <button
          onClick={() => refetchBalance()}
          className="p-2 rounded-xl bg-bg-card border border-bg-border"
        >
          <RefreshCw
            className={`w-4 h-4 text-white/50 ${
              isFetching ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-5 rounded-3xl bg-gradient-card border border-bg-border p-6 mb-6"
        style={{
          background: "linear-gradient(135deg, #111118 0%, #1A1A2E 100%)",
        }}
      >
        <p className="text-white/40 text-sm mb-1">Saldo total</p>
        <p className="font-display text-4xl font-bold text-white mb-1">
          R${" "}
          {balanceBrl.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p className="text-white/40 text-sm">
          {solBalance.toFixed(4)} SOL · ${balanceUsd.toFixed(2)} USD
        </p>

        {/* Gradient bar */}
        <div className="mt-4 h-0.5 rounded-full bg-gradient-solana opacity-60" />
      </motion.div>

      {/* Quick actions */}
      <div className="px-5 grid grid-cols-3 gap-3 mb-6">
        {[
          {
            icon: <ArrowUpRight className="w-5 h-5" />,
            label: "Enviar",
            onClick: () => router.push("/send"),
            accent: true,
          },
          {
            icon: <ArrowDownLeft className="w-5 h-5" />,
            label: "Receber",
            onClick: () => {},
            accent: false,
          },
          {
            icon: <Plus className="w-5 h-5" />,
            label: "Depositar",
            onClick: () => {},
            accent: false,
          },
        ].map(({ icon, label, onClick, accent }) => (
          <button
            key={label}
            onClick={onClick}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all
              ${
                accent
                  ? "bg-solana-purple/20 border-solana-purple/40 text-solana-purple"
                  : "bg-bg-card border-bg-border text-white/70"
              }`}
          >
            {icon}
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* DeFi banner */}
      <div className="px-5 mb-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/defi")}
          className="w-full bg-solana-green/10 border border-solana-green/30 rounded-2xl p-4 flex items-center justify-between"
        >
          <div className="text-left">
            <p className="text-solana-green font-semibold text-sm">
              Rendimento DeFi
            </p>
            <p className="text-white/50 text-xs">
              Deposite e ganhe até 12% ao ano
            </p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-solana-green" />
        </motion.button>
      </div>

      {/* Recent transactions — placeholder */}
      <div className="px-5">
        <h2 className="text-white/50 text-sm font-medium mb-3">Histórico</h2>
        <div className="space-y-2">
          {[
            {
              type: "sent",
              handle: "@fernanda_costa",
              amount: "50 USDC",
              time: "há 2h",
            },
            {
              type: "received",
              handle: "@pedro_oliveira",
              amount: "0.5 SOL",
              time: "ontem",
            },
          ].map((tx) => (
            <div
              key={tx.handle}
              className="flex items-center justify-between bg-bg-card border border-bg-border rounded-2xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                    ${
                      tx.type === "sent"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-green-500/10 text-green-400"
                    }`}
                >
                  {tx.type === "sent" ? "↑" : "↓"}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{tx.handle}</p>
                  <p className="text-white/40 text-xs">{tx.time}</p>
                </div>
              </div>
              <p
                className={`text-sm font-semibold ${
                  tx.type === "sent" ? "text-red-400" : "text-solana-green"
                }`}
              >
                {tx.type === "sent" ? "-" : "+"}
                {tx.amount}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto">
        <div className="bg-bg/80 backdrop-blur-xl border-t border-bg-border px-5 py-3 flex justify-around">
          {[
            { label: "Carteira", icon: "💰", href: "/wallet", active: true },
            { label: "Enviar", icon: "📤", href: "/send", active: false },
            { label: "DeFi", icon: "📈", href: "/defi", active: false },
            { label: "Config", icon: "⚙️", href: "/settings", active: false },
          ].map(({ label, icon, href, active }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all
                ${active ? "text-solana-purple" : "text-white/30"}`}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
