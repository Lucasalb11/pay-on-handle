"use client";

import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, TrendingUp, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { connection } from "@/lib/solana";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

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

const STRATEGIES = [
  {
    name: "SOL Staking",
    protocol: "Sanctum / Jito",
    apy: "7-9%",
    risk: "Baixo",
    riskColor: "text-solana-green",
    description: "Stake SOL em validators via liquid staking tokens",
    icon: "🔒",
    tvl: "$2.4B",
    badge: "Popular",
    badgeColor: "bg-solana-green/20 text-solana-green",
  },
  {
    name: "USDC Lending",
    protocol: "Kamino Finance",
    apy: "8-12%",
    risk: "Médio",
    riskColor: "text-yellow-400",
    description: "Empreste USDC para market makers e traders alavancados",
    icon: "🏦",
    tvl: "$890M",
    badge: "Alto rendimento",
    badgeColor: "bg-yellow-400/20 text-yellow-400",
  },
  {
    name: "SOL/USDC LP",
    protocol: "Orca Whirlpool",
    apy: "15-25%",
    risk: "Alto",
    riskColor: "text-red-400",
    description: "Forneça liquidez concentrada e receba taxas de swap",
    icon: "🌊",
    tvl: "$340M",
    badge: "Maior APY",
    badgeColor: "bg-red-400/20 text-red-400",
  },
];

export default function DeFiPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useSolanaWallets();
  const router = useRouter();

  const wallet = wallets[0];
  const { data: solBalance = 0 } = useWalletBalance(wallet?.address);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  return (
    <main className="min-h-dvh flex flex-col pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="font-display text-2xl font-bold text-white">
          Rendimento DeFi
        </h1>
        <p className="text-white/40 text-sm mt-1">
          Faça seu saldo trabalhar para você
        </p>
      </div>

      {/* Portfolio summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-5 mb-6 rounded-3xl p-5 border border-solana-green/20"
        style={{
          background: "linear-gradient(135deg, #0D1A12 0%, #111820 100%)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/40 text-xs mb-1">Depositado em DeFi</p>
            <p className="font-display text-3xl font-bold text-white">$0.00</p>
            <p className="text-white/30 text-xs mt-0.5">0.000 SOL</p>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs mb-1">Rendimento acumulado</p>
            <p className="text-solana-green font-semibold text-lg">+$0.00</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/40">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Disponível para depositar: {solBalance.toFixed(4)} SOL</span>
        </div>
      </motion.div>

      {/* Features strip */}
      <div className="px-5 mb-6 grid grid-cols-3 gap-3">
        {[
          { icon: <Shield className="w-4 h-4" />, label: "Auditado" },
          { icon: <Zap className="w-4 h-4" />, label: "Automático" },
          { icon: <ArrowUpRight className="w-4 h-4" />, label: "Saque livre" },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 bg-bg-card border border-bg-border rounded-2xl p-3"
          >
            <span className="text-solana-purple">{icon}</span>
            <span className="text-white/60 text-xs">{label}</span>
          </div>
        ))}
      </div>

      {/* Strategy cards */}
      <div className="px-5 space-y-4">
        <h2 className="text-white/50 text-sm font-medium">Estratégias</h2>

        {STRATEGIES.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-bg-card border border-bg-border rounded-3xl p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm">{s.name}</p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.badgeColor}`}
                    >
                      {s.badge}
                    </span>
                  </div>
                  <p className="text-white/40 text-xs">{s.protocol}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-solana-green font-bold text-lg">{s.apy}</p>
                <p className="text-white/30 text-xs">ao ano</p>
              </div>
            </div>

            <p className="text-white/50 text-xs mb-4 leading-relaxed">
              {s.description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-white/40">
                <span>
                  Risco:{" "}
                  <span className={`font-medium ${s.riskColor}`}>{s.risk}</span>
                </span>
                <span>TVL: {s.tvl}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {}}
                className="text-xs h-8"
              >
                Depositar
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Coming soon banner */}
      <div className="mx-5 mt-6 mb-2 rounded-2xl bg-solana-purple/10 border border-solana-purple/20 p-4 text-center">
        <p className="text-solana-purple text-sm font-medium">
          DeFi integrations em breve
        </p>
        <p className="text-white/40 text-xs mt-1">
          Kamino, Orca e Jito em integração
        </p>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto">
        <div className="bg-bg/80 backdrop-blur-xl border-t border-bg-border px-5 py-3 flex justify-around">
          {[
            { label: "Carteira", icon: "💰", href: "/wallet", active: false },
            { label: "Enviar", icon: "📤", href: "/send", active: false },
            { label: "DeFi", icon: "📈", href: "/defi", active: true },
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
