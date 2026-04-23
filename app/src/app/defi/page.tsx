"use client";

import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, TrendingUp, Shield, Zap, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { connection } from "@/lib/solana";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BottomNav } from "@/components/BottomNav";
import { KaminoModal } from "@/components/defi/KaminoModal";
import { OrcaModal } from "@/components/defi/OrcaModal";
import { JitoModal } from "@/components/defi/JitoModal";
import {
  GenericProtocolModal,
  type Protocol,
} from "@/components/defi/GenericProtocolModal";

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

const PROTOCOLS: (Protocol & { category: string })[] = [
  {
    id: "kamino",
    name: "Kamino",
    logo: "K",
    category: "Lending",
    tvl: "$1.8B",
    apy: "5.2%",
    description: "Empréstimos e depósitos em cripto",
    gradient: "linear-gradient(135deg, #9945FF, #C084FC)",
  },
  {
    id: "jito",
    name: "Jito",
    logo: "J",
    category: "Staking",
    tvl: "$2.1B",
    apy: "7.8%",
    description: "Staking líquido de SOL com MEV",
    gradient: "linear-gradient(135deg, #14F195, #00C2FF)",
  },
  {
    id: "drift",
    name: "Drift",
    logo: "D",
    category: "Perps",
    tvl: "$850M",
    description: "Trading de perpétuos descentralizado",
    gradient: "linear-gradient(135deg, #6366F1, #8B5CF6)",
  },
  {
    id: "marginfi",
    name: "MarginFi",
    logo: "M",
    category: "Lending",
    tvl: "$650M",
    apy: "4.9%",
    description: "Protocolo de lending e borrowing",
    gradient: "linear-gradient(135deg, #EC4899, #F43F5E)",
  },
  {
    id: "perena",
    name: "Perena",
    logo: "P",
    category: "Stablecoin",
    tvl: "$120M",
    apy: "8.5%",
    description: "Yield com stablecoins",
    gradient: "linear-gradient(135deg, #F4C009, #FF6B2B)",
  },
  {
    id: "meteora",
    name: "Meteora",
    logo: "Mt",
    category: "LP",
    tvl: "$420M",
    apy: "12.3%",
    description: "Pools de liquidez dinâmicas",
    gradient: "linear-gradient(135deg, #00C2FF, #14F195)",
  },
  {
    id: "raydium",
    name: "Raydium",
    logo: "R",
    category: "DEX",
    tvl: "$950M",
    apy: "9.1%",
    description: "AMM e pools concentradas",
    gradient: "linear-gradient(135deg, #7C3AED, #4F46E5)",
  },
  {
    id: "orca",
    name: "Orca",
    logo: "O",
    category: "DEX",
    tvl: "$380M",
    apy: "11.5%",
    description: "Pools concentradas (CLMM)",
    gradient: "linear-gradient(135deg, #FF6B2B, #F4C009)",
  },
];

const CATEGORIES = [
  "Todos",
  "Lending",
  "Staking",
  "DEX",
  "LP",
  "Perps",
  "Stablecoin",
];

export default function DeFiPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useSolanaWallets();
  const router = useRouter();

  const wallet = wallets[0];
  const { data: solBalance = 0 } = useWalletBalance(wallet?.address);

  const [category, setCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  const filtered = PROTOCOLS.filter((p) => {
    const matchCat = category === "Todos" || p.category === category;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const selectedProtocol = PROTOCOLS.find((p) => p.id === selected) ?? null;

  return (
    <main className="relative min-h-dvh flex flex-col pb-32 bg-brand-beige overflow-x-hidden">
      {/* Decorative blobs */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, #9945FF 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute top-[55%] -left-20 w-56 h-56 rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, #FF6B2B 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="relative z-10 px-5 pt-14 pb-4">
        <p className="text-brand-muted text-xs font-medium">Solana DeFi</p>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Investir
        </h1>
      </div>

      {/* Portfolio card */}
      <div
        className="relative z-10 mx-5 mb-5 rounded-3xl p-5 overflow-hidden border border-brand-border animate-fade-in"
        style={{
          background: "linear-gradient(135deg, #FFFFFF 0%, #F3EEFF 100%)",
          boxShadow: "0 4px 24px rgba(153,69,255,0.08)",
        }}
      >
        <div
          className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, #9945FF 0%, transparent 70%)",
            transform: "translate(30%, -30%)",
          }}
        />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-brand-muted text-xs uppercase tracking-wider mb-1">
              Depositado em DeFi
            </p>
            <p className="font-display text-3xl font-bold text-brand-ink">
              $0.00
            </p>
            <p className="text-brand-muted text-xs mt-0.5">0.000 SOL</p>
          </div>
          <div className="text-right">
            <p className="text-brand-muted text-xs uppercase tracking-wider mb-1">
              Rendimento
            </p>
            <p className="font-semibold text-lg" style={{ color: "#F4C009" }}>
              +$0.00
            </p>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-1.5 bg-brand-purple-muted rounded-full px-3 py-1.5 w-fit border border-brand-border">
          <TrendingUp className="w-3.5 h-3.5 text-brand-purple" />
          <span className="text-xs text-brand-ink-soft font-medium">
            Disponível: {solBalance.toFixed(4)} SOL
          </span>
        </div>
      </div>

      {/* Feature pills */}
      <div className="relative z-10 px-5 mb-5 flex gap-2">
        {[
          { icon: <Shield className="w-3.5 h-3.5" />, label: "Auditado" },
          { icon: <Zap className="w-3.5 h-3.5" />, label: "Automático" },
          {
            icon: <ArrowUpRight className="w-3.5 h-3.5" />,
            label: "Saque livre",
          },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white rounded-full py-2 px-3 border border-brand-border"
          >
            <span className="text-brand-purple">{icon}</span>
            <span className="text-brand-ink-soft text-xs font-medium">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative z-10 px-5 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar protocolo..."
            className="w-full bg-white border border-brand-border rounded-2xl pl-10 pr-4 py-3 text-sm text-brand-ink placeholder:text-brand-muted focus:outline-none focus:border-brand-purple/50 transition-colors"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="relative z-10 flex gap-2 overflow-x-auto pb-2 -mx-0 px-5 scrollbar-hide mb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              category === cat
                ? "bg-brand-purple text-white border-brand-purple shadow-sm"
                : "bg-white text-brand-muted border-brand-border"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Protocol grid */}
      <div className="relative z-10 px-5 mt-3">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((proto) => (
            <button
              key={proto.id}
              onClick={() => setSelected(proto.id)}
              className="text-left p-4 rounded-3xl bg-white border border-brand-border hover:border-brand-purple/30 transition-all active:scale-[0.97] group animate-fade-in"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            >
              {/* Logo */}
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm mb-3"
                style={{ background: proto.gradient }}
              >
                {proto.logo}
              </div>

              <p className="text-sm font-bold text-brand-ink leading-tight">
                {proto.name}
              </p>
              <p className="text-[11px] text-brand-muted mt-0.5 line-clamp-1">
                {proto.description}
              </p>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-brand-border/60">
                <div>
                  <p className="text-[9px] text-brand-muted uppercase tracking-wide">
                    TVL
                  </p>
                  <p className="text-xs font-bold text-brand-ink">
                    {proto.tvl}
                  </p>
                </div>
                {proto.apy && (
                  <div className="flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3 text-brand-gold" />
                    <span className="text-xs font-bold text-brand-gold">
                      {proto.apy}
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-brand-muted text-sm">
              Nenhum protocolo encontrado
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <KaminoModal
        open={selected === "kamino"}
        onClose={() => setSelected(null)}
      />
      <OrcaModal open={selected === "orca"} onClose={() => setSelected(null)} />
      <JitoModal open={selected === "jito"} onClose={() => setSelected(null)} />
      {selectedProtocol &&
        !["kamino", "orca", "jito"].includes(selected ?? "") && (
          <GenericProtocolModal
            open={!!selected}
            onClose={() => setSelected(null)}
            protocol={selectedProtocol}
          />
        )}

      <BottomNav />
    </main>
  );
}
