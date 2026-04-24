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
    queryFn: async () => {
      const res = await fetch("/api/prices");
      if (!res.ok) return 150;
      const data = await res.json();
      return (data.sol_usd as number) ?? 150;
    },
    refetchInterval: 60_000,
  });
}

interface ActivityItem {
  signature: string;
  timestamp: number;
  type: "sent" | "received" | "refunded";
  amountSol: number;
}

function useWalletActivity(address: string | undefined) {
  return useQuery<ActivityItem[]>({
    queryKey: ["activity", address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/activity?wallet=${address}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!address,
    refetchInterval: 60_000,
    placeholderData: [],
  });
}

const PROTOCOLS = [
  { name: "Jupiter", icon: "🔄", color: "#9945FF" },
  { name: "Kamino", icon: "🏦", color: "#FF6B2B" },
  { name: "Orca", icon: "🐋", color: "#8B5CF6" },
  { name: "Jito", icon: "⚡", color: "#F59E0B" },
  { name: "PIX", icon: "₽", color: "#14F195" },
];

export default function WalletPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useSolanaWallets();
  const router = useRouter();

  const wallet = wallets[0];
  const address = wallet?.address;
  const walletCreating = authenticated && walletsReady && wallets.length === 0;

  const {
    data: solBalance = 0,
    refetch: refetchBalance,
    isFetching,
  } = useWalletBalance(address);
  const { data: solPrice = 150 } = useSolPrice();
  const { data: activity = [] } = useWalletActivity(address);

  const balanceUsd = solBalance * solPrice;
  const balanceBrl = balanceUsd * 5.1;

  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  const initial = address ? address[0].toUpperCase() : "U";

  return (
    <main className="relative min-h-dvh flex flex-col pb-32 bg-brand-beige overflow-hidden">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute top-0 right-0 w-72 h-72 bg-brand-purple/8 rounded-full blur-[100px]" />
      <div className="pointer-events-none absolute top-[40%] -left-20 w-64 h-64 bg-brand-orange/8 rounded-full blur-[100px]" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-14 pb-5">
        <div>
          <p className="text-brand-muted text-sm">Olá 👋</p>
          <h1 className="font-display text-xl font-bold text-brand-ink">
            Paga no @
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchBalance()}
            aria-label="Atualizar saldo"
            className="p-2 rounded-xl glass text-brand-muted"
          >
            <RefreshCw
              className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => router.push("/settings")}
            aria-label="Abrir perfil"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, #FF6B2B 0%, #9945FF 100%)",
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
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-6 w-24 h-24 bg-brand-orange/10 rounded-full blur-2xl" />

          <p className="relative text-brand-muted text-xs uppercase tracking-wider mb-2">
            Saldo disponível
          </p>
          {walletCreating ? (
            <>
              <p className="relative font-display text-3xl font-bold text-brand-muted leading-none mb-2 animate-pulse">
                Criando carteira…
              </p>
              <p className="relative text-brand-muted text-sm">
                Sua carteira Solana está sendo gerada
              </p>
            </>
          ) : (
            <>
              <p className="relative font-display text-5xl font-bold text-brand-ink leading-none mb-2">
                R${" "}
                {balanceBrl.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="relative text-brand-muted text-sm">
                {solBalance.toFixed(4)} SOL · ${balanceUsd.toFixed(2)} USD
              </p>
            </>
          )}
          <div className="relative mt-5 h-px bg-gradient-to-r from-brand-orange via-brand-purple to-brand-purple-light opacity-60" />
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
                ? "bg-brand-orange/10 border border-brand-orange/30 text-brand-orange"
                : "bg-white border border-brand-border text-brand-ink-soft"
            }`}
          >
            {icon}
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Protocols */}
      <h2 className="relative z-10 px-5 text-brand-muted text-xs font-semibold uppercase tracking-wider mb-3">
        Protocolos
      </h2>
      <div className="relative z-10 flex gap-3 overflow-x-auto px-5 pb-2 mb-5 scrollbar-hide">
        {PROTOCOLS.map((p) => (
          <button
            key={p.name}
            className="bg-white border border-brand-border rounded-2xl p-3 min-w-[80px] flex flex-col items-center gap-1.5 shrink-0"
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
            <p className="text-brand-orange font-semibold text-sm">
              Rendimento DeFi
            </p>
            <p className="text-brand-muted text-xs">Até 12% ao ano</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-brand-orange bg-brand-orange/10 border border-brand-orange/30 px-2 py-1 rounded-full">
              12% APY
            </span>
            <div className="w-9 h-9 rounded-full bg-brand-orange/10 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-brand-orange" />
            </div>
          </div>
        </motion.button>
      </div>

      {/* Activity */}
      <div className="relative z-10 px-5">
        <h2 className="text-brand-muted text-xs font-semibold uppercase tracking-wider mb-3">
          Atividade
        </h2>
        <div className="space-y-2">
          {activity.length === 0 ? (
            <p className="text-brand-muted text-sm text-center py-4">
              Nenhuma transação encontrada
            </p>
          ) : (
            activity.map((tx) => {
              const isSent = tx.type === "sent";
              const date = new Date(tx.timestamp * 1000);
              const now = Date.now();
              const diffMs = now - tx.timestamp * 1000;
              const diffH = Math.floor(diffMs / 3_600_000);
              const timeLabel =
                diffH < 1
                  ? "agora"
                  : diffH < 24
                  ? `há ${diffH}h`
                  : date.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    });

              return (
                <div
                  key={tx.signature}
                  className="flex items-center justify-between bg-white border border-brand-border rounded-2xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${
                        isSent
                          ? "bg-red-50 text-red-400"
                          : "bg-emerald-50 text-emerald-500"
                      }`}
                    >
                      {isSent ? "↑" : "↓"}
                    </div>
                    <div>
                      <p className="text-brand-ink text-sm font-medium">
                        {isSent ? "Enviou" : "Recebeu"}
                      </p>
                      <p className="text-brand-muted text-xs">{timeLabel}</p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      isSent ? "text-red-400" : "text-emerald-500"
                    }`}
                  >
                    {isSent ? "-" : "+"}
                    {tx.amountSol.toFixed(4)} SOL
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
