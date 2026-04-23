"use client";

import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  TrendingUp,
  ChevronRight,
  Droplets,
  Info,
  ArrowLeft,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Pool {
  id: string;
  tokenA: string;
  tokenB: string;
  fee: string;
  tvl: string;
  volume: string;
  apy: string;
}

const POOLS: Pool[] = [
  {
    id: "1",
    tokenA: "SOL",
    tokenB: "USDC",
    fee: "0.04%",
    tvl: "$85M",
    volume: "$42M",
    apy: "18.5%",
  },
  {
    id: "2",
    tokenA: "SOL",
    tokenB: "USDT",
    fee: "0.04%",
    tvl: "$32M",
    volume: "$18M",
    apy: "14.2%",
  },
  {
    id: "3",
    tokenA: "mSOL",
    tokenB: "SOL",
    fee: "0.01%",
    tvl: "$28M",
    volume: "$8M",
    apy: "8.9%",
  },
  {
    id: "4",
    tokenA: "USDC",
    tokenB: "USDT",
    fee: "0.01%",
    tvl: "$65M",
    volume: "$55M",
    apy: "6.4%",
  },
  {
    id: "5",
    tokenA: "jitoSOL",
    tokenB: "SOL",
    fee: "0.01%",
    tvl: "$22M",
    volume: "$5M",
    apy: "10.7%",
  },
  {
    id: "6",
    tokenA: "BONK",
    tokenB: "SOL",
    fee: "0.3%",
    tvl: "$12M",
    volume: "$28M",
    apy: "42.1%",
  },
];

type Range = "narrow" | "medium" | "wide" | "full";

const RANGES: {
  id: Range;
  label: string;
  desc: string;
  left: string;
  right: string;
}[] = [
  {
    id: "narrow",
    label: "Estreito",
    desc: "±5% do preço",
    left: "35%",
    right: "35%",
  },
  {
    id: "medium",
    label: "Médio",
    desc: "±15% do preço",
    left: "25%",
    right: "25%",
  },
  {
    id: "wide",
    label: "Amplo",
    desc: "±50% do preço",
    left: "10%",
    right: "10%",
  },
  {
    id: "full",
    label: "Full Range",
    desc: "Toda a faixa",
    left: "0%",
    right: "0%",
  },
];

export function OrcaModal({ open, onClose }: Props) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [range, setRange] = useState<Range>("medium");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");

  const handleBack = () => {
    if (pool) {
      setPool(null);
      setAmountA("");
      setAmountB("");
    } else onClose();
  };

  const rangeConfig = RANGES.find((r) => r.id === range)!;

  return (
    <BottomSheet open={open} onClose={handleBack}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pt-2">
        {pool && (
          <button
            onClick={() => {
              setPool(null);
              setAmountA("");
              setAmountB("");
            }}
            className="p-2 rounded-xl bg-brand-orange-muted"
          >
            <ArrowLeft className="w-4 h-4 text-brand-orange" />
          </button>
        )}
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm"
          style={{ background: "linear-gradient(135deg, #FF6B2B, #F4C009)" }}
        >
          O
        </div>
        <div>
          <p className="font-display font-bold text-brand-ink text-base leading-tight">
            {pool ? `${pool.tokenA}/${pool.tokenB}` : "Orca Whirlpools"}
          </p>
          <p className="text-xs text-brand-muted">
            {pool
              ? "Liquidez concentrada (CLMM)"
              : "Pools concentradas na Solana"}
          </p>
        </div>
      </div>

      {!pool ? (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 bg-white rounded-2xl border border-brand-border">
              <p className="text-[10px] text-brand-muted mb-0.5">TVL Total</p>
              <p className="text-sm font-bold text-brand-ink">$244M</p>
            </div>
            <div className="p-3 bg-white rounded-2xl border border-brand-border">
              <p className="text-[10px] text-brand-muted mb-0.5">Volume 24h</p>
              <p className="text-sm font-bold text-brand-ink">$156M</p>
            </div>
          </div>

          <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider mb-3">
            Pools em destaque
          </p>

          <div className="space-y-2">
            {POOLS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPool(p)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-brand-border hover:border-brand-orange/30 transition-all group"
              >
                <div className="flex items-center -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-brand-purple-muted border-2 border-white flex items-center justify-center text-[10px] font-bold text-brand-purple z-10">
                    {p.tokenA.slice(0, 2)}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-brand-gold-muted border-2 border-white flex items-center justify-center text-[10px] font-bold text-brand-ink">
                    {p.tokenB.slice(0, 2)}
                  </div>
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-brand-ink">
                      {p.tokenA}/{p.tokenB}
                    </p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-brand-beige-dark text-brand-muted font-medium">
                      {p.fee}
                    </span>
                  </div>
                  <p className="text-[10px] text-brand-muted mt-0.5">
                    TVL {p.tvl} · Vol {p.volume}
                  </p>
                </div>
                <div className="flex items-center gap-1 mr-1">
                  <TrendingUp className="w-3 h-3 text-brand-gold" />
                  <span className="text-sm font-bold text-brand-ink">
                    {p.apy}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-brand-muted group-hover:text-brand-orange transition-colors" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "APY", value: pool.apy, gold: true },
              { label: "TVL", value: pool.tvl, gold: false },
              { label: "Fee", value: pool.fee, gold: false },
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

          {/* Range selector */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Droplets className="w-3.5 h-3.5 text-brand-orange" />
              <p className="text-xs font-semibold text-brand-ink">
                Faixa de preço
              </p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  className={`py-2.5 rounded-xl text-center transition-all border ${
                    range === r.id
                      ? "bg-brand-orange-muted border-brand-orange/40 text-brand-orange"
                      : "bg-white border-brand-border text-brand-muted"
                  }`}
                >
                  <p className="text-[11px] font-bold">{r.label}</p>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-brand-muted mt-1.5 text-center">
              {rangeConfig.desc}
            </p>
          </div>

          {/* Price range visual */}
          <div className="relative h-10 bg-brand-beige-dark rounded-xl overflow-hidden">
            <div
              className="absolute inset-y-0 bg-brand-orange/15 border-x-2 border-brand-orange/50 transition-all duration-300"
              style={{ left: rangeConfig.left, right: rangeConfig.right }}
            />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-brand-orange" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-brand-orange border-2 border-white" />
          </div>

          {/* Amount inputs */}
          <div className="space-y-3">
            {[
              { token: pool.tokenA, value: amountA, set: setAmountA },
              { token: pool.tokenB, value: amountB, set: setAmountB },
            ].map(({ token, value, set }) => (
              <div key={token}>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-medium text-brand-muted">
                    {token}
                  </label>
                  <button className="text-[11px] text-brand-purple font-semibold">
                    MAX
                  </button>
                </div>
                <div className="flex items-center bg-white rounded-2xl border border-brand-border overflow-hidden focus-within:border-brand-purple/50 transition-colors">
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-transparent px-4 py-3 text-sm text-brand-ink placeholder:text-brand-muted/60 focus:outline-none"
                  />
                  <span className="px-4 text-xs font-bold text-brand-ink-soft">
                    {token}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-brand-gold-muted rounded-xl border border-brand-gold/20">
            <Info className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
            <p className="text-[11px] text-brand-ink-soft leading-relaxed">
              Faixa estreita = maior APY potencial, maior risco de impermanent
              loss.
            </p>
          </div>

          <button
            className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #FF6B2B, #F4C009)" }}
          >
            Adicionar Liquidez
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
