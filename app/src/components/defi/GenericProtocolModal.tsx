"use client";

import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  TrendingUp,
  Info,
  Wallet,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

export interface Protocol {
  id: string;
  name: string;
  logo: string;
  category: string;
  tvl: string;
  apy?: string;
  description: string;
  gradient: string;
}

interface Action {
  id: string;
  label: string;
  description: string;
  apy?: string;
  risk: "low" | "medium" | "high";
}

const PROTOCOL_ACTIONS: Record<string, Action[]> = {
  drift: [
    {
      id: "perp-long",
      label: "Long Perpétuo",
      description: "Posição comprada com alavancagem",
      risk: "high",
    },
    {
      id: "perp-short",
      label: "Short Perpétuo",
      description: "Posição vendida com alavancagem",
      risk: "high",
    },
    {
      id: "earn",
      label: "Vault de Rendimento",
      description: "Deposite e ganhe passivamente",
      apy: "12.3%",
      risk: "medium",
    },
  ],
  marginfi: [
    {
      id: "lend",
      label: "Depositar",
      description: "Deposite ativos e ganhe juros",
      apy: "4.9%",
      risk: "low",
    },
    {
      id: "borrow",
      label: "Emprestar",
      description: "Empreste usando colateral",
      risk: "medium",
    },
    {
      id: "points",
      label: "Farm de Pontos",
      description: "Acumule pontos para airdrop",
      risk: "low",
    },
  ],
  perena: [
    {
      id: "usdc",
      label: "Depositar USDC",
      description: "Yield com stablecoins via Perena",
      apy: "8.5%",
      risk: "low",
    },
    {
      id: "usdt",
      label: "Depositar USDT",
      description: "Rendimento estável com USDT",
      apy: "7.2%",
      risk: "low",
    },
  ],
  meteora: [
    {
      id: "dlmm",
      label: "DLMM Pool",
      description: "Pools dinâmicas com concentração auto",
      apy: "12.3%",
      risk: "medium",
    },
    {
      id: "stable",
      label: "Stable Pool",
      description: "Stablecoins com baixo IL",
      apy: "5.8%",
      risk: "low",
    },
    {
      id: "vault",
      label: "Vault Dinâmico",
      description: "Auto-compound de rendimentos",
      apy: "9.4%",
      risk: "medium",
    },
  ],
  raydium: [
    {
      id: "clmm",
      label: "CLMM Pool",
      description: "Liquidez concentrada, melhor capital efficiency",
      apy: "15.2%",
      risk: "medium",
    },
    {
      id: "standard",
      label: "Pool Padrão",
      description: "AMM clássico, simples e confiável",
      apy: "9.1%",
      risk: "low",
    },
    {
      id: "farm",
      label: "Farm RAY",
      description: "Stake LP tokens para ganhar RAY",
      apy: "22.5%",
      risk: "medium",
    },
  ],
};

const RISK_CONFIG = {
  low: {
    label: "Baixo risco",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-100",
  },
  medium: {
    label: "Médio risco",
    bg: "bg-brand-gold-muted",
    text: "text-amber-600",
    border: "border-brand-gold/20",
  },
  high: {
    label: "Alto risco",
    bg: "bg-red-50",
    text: "text-red-500",
    border: "border-red-100",
  },
};

interface Props {
  open: boolean;
  onClose: () => void;
  protocol: Protocol;
}

export function GenericProtocolModal({ open, onClose, protocol }: Props) {
  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState("");
  const actions = PROTOCOL_ACTIONS[protocol.id] ?? [];

  const handleBack = () => {
    if (action) {
      setAction(null);
      setAmount("");
    } else onClose();
  };

  return (
    <BottomSheet open={open} onClose={handleBack}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pt-2">
        {action && (
          <button
            onClick={() => {
              setAction(null);
              setAmount("");
            }}
            className="p-2 rounded-xl bg-brand-purple-muted"
          >
            <ArrowLeft className="w-4 h-4 text-brand-purple" />
          </button>
        )}
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm"
          style={{ background: protocol.gradient }}
        >
          {protocol.logo}
        </div>
        <div>
          <p className="font-display font-bold text-brand-ink text-base leading-tight">
            {protocol.name}
          </p>
          <p className="text-xs text-brand-muted">
            {action ? action.label : protocol.description}
          </p>
        </div>
      </div>

      {!action ? (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 bg-white rounded-2xl border border-brand-border">
              <p className="text-[10px] text-brand-muted mb-0.5">TVL</p>
              <p className="text-sm font-bold text-brand-ink">{protocol.tvl}</p>
            </div>
            {protocol.apy && (
              <div className="p-3 bg-white rounded-2xl border border-brand-border">
                <p className="text-[10px] text-brand-muted mb-0.5">APY Médio</p>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-brand-gold" />
                  <p className="text-sm font-bold text-brand-gold">
                    {protocol.apy}
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider mb-3">
            Opções disponíveis
          </p>

          <div className="space-y-2">
            {actions.map((a) => {
              const risk = RISK_CONFIG[a.risk];
              return (
                <button
                  key={a.id}
                  onClick={() => setAction(a)}
                  className="w-full text-left p-4 rounded-2xl bg-white border border-brand-border hover:border-brand-purple/30 transition-all group"
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-semibold text-brand-ink">
                      {a.label}
                    </p>
                    <div className="flex items-center gap-2">
                      {a.apy && (
                        <span className="flex items-center gap-0.5 text-xs font-bold text-brand-gold">
                          <TrendingUp className="w-3 h-3" />
                          {a.apy}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-brand-muted group-hover:text-brand-purple transition-colors" />
                    </div>
                  </div>
                  <p className="text-[11px] text-brand-muted mb-2">
                    {a.description}
                  </p>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${risk.bg} ${risk.text} border ${risk.border}`}
                  >
                    {risk.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selected action card */}
          <div className="p-4 bg-white rounded-2xl border border-brand-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-brand-ink">
                {action.label}
              </p>
              {action.apy && (
                <span className="flex items-center gap-0.5 text-sm font-bold text-brand-gold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {action.apy} APY
                </span>
              )}
            </div>
            <p className="text-xs text-brand-muted mb-2">
              {action.description}
            </p>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${
                RISK_CONFIG[action.risk].bg
              } ${RISK_CONFIG[action.risk].text} border ${
                RISK_CONFIG[action.risk].border
              }`}
            >
              {RISK_CONFIG[action.risk].label}
            </span>
          </div>

          {/* Amount input */}
          <div>
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
              <span className="px-4 text-xs font-bold text-brand-ink-soft">
                SOL
              </span>
            </div>
          </div>

          {/* Balance */}
          <div className="flex items-center gap-2 px-1">
            <Wallet className="w-3.5 h-3.5 text-brand-muted" />
            <p className="text-xs text-brand-muted">
              Saldo disponível:{" "}
              <span className="text-brand-ink font-semibold">—</span>
            </p>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-brand-purple-muted rounded-xl border border-brand-border">
            <Info className="w-4 h-4 text-brand-purple shrink-0 mt-0.5" />
            <p className="text-[11px] text-brand-ink-soft leading-relaxed">
              A transação é enviada diretamente ao protocolo {protocol.name} via
              Paga no @. Você mantém custódia total.
            </p>
          </div>

          <button
            className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.98]"
            style={{ background: protocol.gradient }}
          >
            {action.label}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
