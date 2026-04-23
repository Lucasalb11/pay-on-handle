"use client";

import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  ChevronRight,
  Info,
  ArrowLeft,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Market {
  symbol: string;
  asset: string;
  supplyApy: string;
  borrowApy: string;
  totalSupply: string;
  totalBorrow: string;
  utilization: string;
  color: string;
}

const MARKETS: Market[] = [
  {
    symbol: "SOL",
    asset: "Solana",
    supplyApy: "5.2%",
    borrowApy: "8.4%",
    totalSupply: "$420M",
    totalBorrow: "$180M",
    utilization: "42%",
    color: "#9945FF",
  },
  {
    symbol: "USDC",
    asset: "USD Coin",
    supplyApy: "6.8%",
    borrowApy: "9.2%",
    totalSupply: "$380M",
    totalBorrow: "$210M",
    utilization: "55%",
    color: "#2775CA",
  },
  {
    symbol: "USDT",
    asset: "Tether",
    supplyApy: "5.9%",
    borrowApy: "8.7%",
    totalSupply: "$190M",
    totalBorrow: "$95M",
    utilization: "50%",
    color: "#26A17B",
  },
  {
    symbol: "jitoSOL",
    asset: "Jito SOL",
    supplyApy: "3.1%",
    borrowApy: "6.5%",
    totalSupply: "$150M",
    totalBorrow: "$45M",
    utilization: "30%",
    color: "#F4C009",
  },
  {
    symbol: "mSOL",
    asset: "Marinade SOL",
    supplyApy: "4.4%",
    borrowApy: "7.1%",
    totalSupply: "$120M",
    totalBorrow: "$52M",
    utilization: "43%",
    color: "#FF6B2B",
  },
];

type Tab = "supply" | "borrow";

export function KaminoModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("supply");
  const [market, setMarket] = useState<Market | null>(null);
  const [amount, setAmount] = useState("");

  const handleBack = () => {
    if (market) {
      setMarket(null);
      setAmount("");
    } else onClose();
  };

  return (
    <BottomSheet open={open} onClose={handleBack}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pt-2">
        {market && (
          <button
            onClick={() => {
              setMarket(null);
              setAmount("");
            }}
            className="p-2 rounded-xl bg-brand-purple-muted"
          >
            <ArrowLeft className="w-4 h-4 text-brand-purple" />
          </button>
        )}
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm"
          style={{ background: "linear-gradient(135deg, #9945FF, #C084FC)" }}
        >
          K
        </div>
        <div>
          <p className="font-display font-bold text-brand-ink text-base leading-tight">
            Kamino Finance
          </p>
          <p className="text-xs text-brand-muted">
            {market
              ? tab === "supply"
                ? `Depositar ${market.symbol}`
                : `Emprestar ${market.symbol}`
              : "Lending & Borrowing"}
          </p>
        </div>
      </div>

      {!market ? (
        <div>
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-brand-beige-dark rounded-2xl mb-4">
            {(["supply", "borrow"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  tab === t
                    ? "bg-white text-brand-purple shadow-sm"
                    : "text-brand-muted"
                }`}
              >
                {t === "supply" ? (
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                ) : (
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                )}
                {t === "supply" ? "Depositar" : "Emprestar"}
              </button>
            ))}
          </div>

          {/* Info */}
          <div className="flex items-start gap-2.5 p-3 bg-brand-purple-muted rounded-xl mb-4 border border-brand-border">
            <Info className="w-4 h-4 text-brand-purple shrink-0 mt-0.5" />
            <p className="text-[11px] text-brand-ink-soft leading-relaxed">
              {tab === "supply"
                ? "Deposite seus ativos e ganhe rendimento automático. Resgate a qualquer momento."
                : "Use seus depósitos como colateral. Atenção ao fator de saúde da posição."}
            </p>
          </div>

          {/* Market list */}
          <div className="space-y-2">
            {MARKETS.map((m) => (
              <button
                key={m.symbol}
                onClick={() => setMarket(m)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-brand-border hover:border-brand-purple/30 transition-all group"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: m.color }}
                >
                  {m.symbol.slice(0, 2)}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-brand-ink">
                    {m.asset}
                  </p>
                  <p className="text-[11px] text-brand-muted">{m.symbol}</p>
                </div>
                <div className="text-right mr-1">
                  <div className="flex items-center gap-1 justify-end">
                    <TrendingUp className="w-3 h-3 text-brand-gold" />
                    <span className="text-sm font-bold text-brand-ink">
                      {tab === "supply" ? m.supplyApy : m.borrowApy}
                    </span>
                  </div>
                  <p className="text-[10px] text-brand-muted">
                    {tab === "supply" ? m.totalSupply : m.totalBorrow}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-brand-muted group-hover:text-brand-purple transition-colors" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              {
                label: "APY",
                value: tab === "supply" ? market.supplyApy : market.borrowApy,
                gold: true,
              },
              { label: "Utilização", value: market.utilization, gold: false },
              {
                label: tab === "supply" ? "Fornecido" : "Emprestado",
                value:
                  tab === "supply" ? market.totalSupply : market.totalBorrow,
                gold: false,
              },
            ].map(({ label, value, gold }) => (
              <div
                key={label}
                className="p-3 bg-white rounded-2xl border border-brand-border text-center"
              >
                <p className="text-[10px] text-brand-muted mb-1">{label}</p>
                <p
                  className={`text-sm font-bold ${
                    gold ? "text-brand-gold" : "text-brand-ink"
                  }`}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Amount input */}
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <label className="text-xs font-medium text-brand-muted">
                Quantidade
              </label>
              <button className="text-xs text-brand-purple font-semibold">
                Máximo
              </button>
            </div>
            <div className="flex items-center bg-white rounded-2xl border border-brand-border overflow-hidden focus-within:border-brand-purple/50 transition-colors">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent px-4 py-3.5 text-sm text-brand-ink placeholder:text-brand-muted/60 focus:outline-none"
              />
              <span className="px-4 text-sm font-bold text-brand-ink-soft">
                {market.symbol}
              </span>
            </div>
          </div>

          {/* CTA */}
          <button
            className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #9945FF, #C084FC)" }}
          >
            {tab === "supply" ? "Depositar" : "Emprestar"} {market.symbol}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
