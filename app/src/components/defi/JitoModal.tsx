"use client";

import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  Zap,
  TrendingUp,
  Info,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "stake" | "unstake";

export function JitoModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("stake");
  const [amount, setAmount] = useState("");

  return (
    <BottomSheet open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pt-2">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm"
          style={{ background: "linear-gradient(135deg, #14F195, #00C2FF)" }}
        >
          J
        </div>
        <div>
          <p className="font-display font-bold text-brand-ink text-base leading-tight">
            Jito
          </p>
          <p className="text-xs text-brand-muted">Liquid Staking + MEV</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "APY", value: "7.8%", gold: true },
          { label: "TVL", value: "$2.1B", gold: false },
          { label: "jitoSOL/SOL", value: "1.082", gold: false },
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

      {/* MEV badge */}
      <div className="flex items-center gap-2 p-3 bg-brand-gold-muted rounded-xl border border-brand-gold/20 mb-5">
        <Zap className="w-4 h-4 text-brand-gold shrink-0" />
        <p className="text-[11px] text-brand-ink-soft leading-relaxed">
          Rewards extras de MEV distribuídos automaticamente para holders de
          jitoSOL.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-brand-beige-dark rounded-2xl mb-4">
        {(["stake", "unstake"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setAmount("");
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              tab === t
                ? "bg-white text-brand-purple shadow-sm"
                : "text-brand-muted"
            }`}
          >
            {t === "stake" ? (
              <ArrowDownToLine className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpFromLine className="w-3.5 h-3.5" />
            )}
            {t === "stake" ? "Fazer Stake" : "Desfazer Stake"}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <label className="text-xs font-medium text-brand-muted">
            {tab === "stake" ? "SOL a depositar" : "jitoSOL a resgatar"}
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
            {tab === "stake" ? "SOL" : "jitoSOL"}
          </span>
        </div>
      </div>

      {amount && (
        <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-brand-border mb-4">
          <p className="text-xs text-brand-muted">Você receberá</p>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-brand-gold" />
            <p className="text-sm font-bold text-brand-ink">
              ~
              {(
                parseFloat(amount || "0") * (tab === "stake" ? 0.924 : 1.082)
              ).toFixed(4)}{" "}
              {tab === "stake" ? "jitoSOL" : "SOL"}
            </p>
          </div>
        </div>
      )}

      <button
        className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, #14F195, #00C2FF)",
          color: "#000",
        }}
      >
        {tab === "stake" ? "Stake SOL → jitoSOL" : "Unstake jitoSOL → SOL"}
      </button>
    </BottomSheet>
  );
}
