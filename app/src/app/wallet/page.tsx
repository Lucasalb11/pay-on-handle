"use client";

import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Send,
  ArrowDownLeft,
  QrCode,
  TrendingUp,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { connection } from "@/lib/solana";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { getSolPrice } from "@/lib/solana";
import { BottomNav } from "@/components/BottomNav";

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

const PROTOCOLS = [
  { name: "Jupiter", icon: "🔄", color: "#C7F284" },
  { name: "Kamino", icon: "🏦", color: "#00D4FF" },
  { name: "Orca", icon: "🐋", color: "#8B5CF6" },
  { name: "Jito", icon: "⚡", color: "#F59E0B" },
  { name: "PIX", icon: "₽", color: "#14F195" },
];

export default function WalletPage() {
  const { ready, authenticated } = usePrivy();
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

  const initial = address ? address[0].toUpperCase() : "U";

  return (
    <main className="relative min-h-dvh flex flex-col pb-32 bg-[#08080E] overflow-hidden">
      {/* Ambient orb */}
      <div className="pointer-events-none absolute top-0 right-0 w-72 h-72 bg-solana-purple/10 rounded-full blur-[100px]" />
      <div className="pointer-events-none absolute top-[40%] -left-20 w-64 h-64 bg-solana-green/5 rounded-full blur-[100px]" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-14 pb-5">
        <div>
          <p className="text-white/40 text-sm">Olá 👋</p>
          <h1 className="font-display text-xl font-bold text-white">
            Paga no @
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchBalance()}
            aria-label="Atualizar saldo"
            className="p-2 rounded-xl glass text-white/60"
          >
            <RefreshCw
              className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => router.push("/settings")}
            aria-label="Abrir perfil"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-black font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, #9945FF 0%, #14F195 100%)",
            }}
          >
            {initial}
          </button>
        </div>
      </div>

      {/* Balance card */}
      <div className="relative z-10 mx-5 mb-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 relative overflow-hidden"
        >
          {/* Inner orb */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-solana-purple/20 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-6 w-24 h-24 bg-solana-green/10 rounded-full blur-2xl" />

          <p className="relative text-white/50 text-xs uppercase tracking-wider mb-2">
            Saldo disponível
          </p>
          <p className="relative font-display text-5xl font-bold text-white leading-none mb-2">
            R${" "}
            {balanceBrl.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="relative text-white/40 text-sm">
            {solBalance.toFixed(4)} SOL · ${balanceUsd.toFixed(2)} USD
          </p>
          <div className="relative mt-5 h-px bg-gradient-to-r from-solana-purple via-solana-teal to-solana-green opacity-50" />
        </motion.div>
      </div>

      {/* Quick actions */}
      <div className="relative z-10 px-5 grid grid-cols-4 gap-3 mb-6">
        {[
          {
            icon: <Send className="w-5 h-5" />,
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
            icon: <QrCode className="w-5 h-5" />,
            label: "PIX",
            onClick: () => {},
            accent: false,
          },
          {
            icon: <TrendingUp className="w-5 h-5" />,
            label: "DeFi",
            onClick: () => router.push("/defi"),
            accent: false,
          },
        ].map(({ icon, label, onClick, accent }) => (
          <button
            key={label}
            onClick={onClick}
            className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl transition-all ${
              accent
                ? "bg-solana-purple/15 border border-solana-purple/30 text-solana-purple"
                : "glass text-white/70"
            }`}
          >
            {icon}
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Protocols */}
      <h2 className="relative z-10 px-5 text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
        Protocolos
      </h2>
      <div className="relative z-10 flex gap-3 overflow-x-auto px-5 pb-2 mb-5 scrollbar-hide">
        {PROTOCOLS.map((p) => (
          <button
            key={p.name}
            className="glass rounded-2xl p-3 min-w-[80px] flex flex-col items-center gap-1.5 shrink-0"
          >
            <span className="text-xl" aria-hidden>
              {p.icon}
            </span>
            <span
              className="text-[10px] font-medium"
              style={{ color: p.color }}
            >
              {p.name}
            </span>
          </button>
        ))}
      </div>

      {/* DeFi banner */}
      <div className="relative z-10 mx-5 mb-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/defi")}
          className="w-full glass-card rounded-2xl p-4 flex items-center justify-between"
        >
          <div className="text-left">
            <p className="text-solana-green font-semibold text-sm">
              Rendimento DeFi
            </p>
            <p className="text-white/40 text-xs">Até 12% ao ano</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-solana-green bg-solana-green/10 border border-solana-green/30 px-2 py-1 rounded-full">
              12% APY
            </span>
            <div className="w-9 h-9 rounded-full bg-solana-green/15 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-solana-green" />
            </div>
          </div>
        </motion.button>
      </div>

      {/* Activity */}
      <div className="relative z-10 px-5">
        <h2 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
          Atividade
        </h2>
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
              className="flex items-center justify-between glass rounded-2xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${
                    tx.type === "sent"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-solana-green/10 text-solana-green"
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

      <BottomNav />
    </main>
  );
}
