"use client";

import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, ArrowRight, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { hashHandleHex } from "@/lib/handle";

interface VaultInfo {
  sender: string;
  recipientHandleHash: string;
  recipientPlatform: number;
  amount: number;
  mint: string;
  status: string;
  createdAt: number;
  expiresAt: number;
  vaultId: string;
}

interface PriceInfo {
  sol_usd: number;
  sol_brl: number;
  usdc_brl: number;
}

function useVaultInfo(vaultId: string) {
  return useQuery<VaultInfo>({
    queryKey: ["vault", vaultId],
    queryFn: async () => {
      const res = await fetch(`/api/vault/${vaultId}`);
      if (!res.ok) throw new Error("Vault not found");
      return res.json();
    },
    retry: false,
  });
}

function usePrices() {
  return useQuery<PriceInfo>({
    queryKey: ["prices"],
    queryFn: async () => {
      const res = await fetch("/api/prices");
      if (!res.ok) return { sol_usd: 150, sol_brl: 765, usdc_brl: 5.1 };
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
}

function daysLeft(expiresAt: number): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, Math.floor((expiresAt - now) / 86400));
}

function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4).replace(/\.?0+$/, "");
}

function formatBrl(lamports: number, solBrl: number): string {
  const brl = (lamports / 1e9) * solBrl;
  return brl.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type ClaimStep = "intro" | "choose" | "crypto" | "pix" | "success";

export function ClaimPageClient({ vaultId }: { vaultId: string }) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useSolanaWallets();
  const [step, setStep] = useState<ClaimStep>("intro");
  const [handle, setHandle] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig] = useState("");

  const { data: vault, isLoading, error } = useVaultInfo(vaultId);
  const { data: prices } = usePrices();

  const solBrl = prices?.sol_brl ?? 765;

  const handleHashMatches =
    handle.trim().length > 0 && vault
      ? hashHandleHex(handle) === vault.recipientHandleHash
      : null;

  async function claimCrypto() {
    if (!vault || !handleHashMatches) return;

    if (!authenticated || !wallets[0]) {
      await login();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimant: wallets[0].address,
          vaultId,
          handle,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Claim failed");
      }

      const { transaction } = await res.json();

      const { Transaction } = await import("@solana/web3.js");
      const { connection } = await import("@/lib/solana");
      const tx = Transaction.from(Buffer.from(transaction, "base64"));
      const signedTx = await wallets[0].signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setTxSig(sig);
      setStep("success");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao resgatar");
    } finally {
      setLoading(false);
    }
  }

  async function claimViaPix() {
    if (!vault || !handleHashMatches || !pixKey.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/claim-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultId, handle, pixKey }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "PIX claim failed");
      }

      const data = await res.json();

      if (data.transaction) {
        if (!authenticated || !wallets[0]) {
          await login();
          return;
        }
        const { Transaction } = await import("@solana/web3.js");
        const { connection } = await import("@/lib/solana");
        const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
        const signedTx = await wallets[0].signTransaction(tx);
        const sig = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(sig, "confirmed");
      }

      setStep("success");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao processar PIX");
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-brand-beige flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !vault) {
    return (
      <div className="min-h-dvh bg-brand-beige flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">😕</p>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Pagamento não encontrado
        </h1>
        <p className="text-brand-muted text-sm">
          Este link pode ter expirado ou já ter sido resgatado.
        </p>
      </div>
    );
  }

  if (vault.status !== "pending") {
    return (
      <div className="min-h-dvh bg-brand-beige flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">{vault.status === "claimed" ? "✅" : "❌"}</p>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          {vault.status === "claimed" ? "Já resgatado" : "Pagamento encerrado"}
        </h1>
        <p className="text-brand-muted text-sm">
          {vault.status === "claimed"
            ? "Este pagamento já foi resgatado."
            : "Este pagamento foi reembolsado ao remetente."}
        </p>
      </div>
    );
  }

  const PLATFORM_LABELS = ["Instagram", "X (Twitter)", "WhatsApp"];

  return (
    <main className="min-h-dvh bg-brand-beige flex flex-col px-5 py-12">
      <AnimatePresence mode="wait">
        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <div className="text-6xl">🎁</div>
            <div>
              <h1 className="font-display text-2xl font-bold text-brand-ink mb-1">
                Você recebeu um pagamento!
              </h1>
              <p className="text-brand-muted text-sm">
                via {vault.sender.slice(0, 4)}...{vault.sender.slice(-4)} no{" "}
                {PLATFORM_LABELS[vault.recipientPlatform] ?? "Solana"}
              </p>
            </div>

            <div
              className="w-full rounded-3xl p-6 flex flex-col items-center gap-1 border"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,107,43,0.08) 0%, rgba(153,69,255,0.08) 100%)",
                borderColor: "rgba(255,107,43,0.25)",
              }}
            >
              <p className="font-display text-5xl font-bold text-brand-ink">
                R$ {formatBrl(vault.amount, solBrl)}
              </p>
              <p className="text-brand-muted text-sm">
                {formatSol(vault.amount)} SOL
              </p>
            </div>

            <div className="flex items-center gap-2 text-brand-muted text-sm">
              <Clock className="w-4 h-4" />
              <span>
                {daysLeft(vault.expiresAt) > 0
                  ? `${daysLeft(vault.expiresAt)} dias para resgatar`
                  : "Expira hoje!"}
              </span>
            </div>

            <Button fullWidth size="lg" onClick={() => setStep("choose")}>
              Resgatar agora
              <ArrowRight className="w-4 h-4" />
            </Button>

            <p className="text-brand-muted/50 text-xs">
              Powered by Solana · Sem necessidade de wallet
            </p>
          </motion.div>
        )}

        {step === "choose" && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-4"
          >
            <div className="text-center mb-4">
              <h2 className="font-display text-xl font-bold text-brand-ink mb-1">
                Como você quer receber?
              </h2>
              <p className="text-brand-muted text-sm">
                R$ {formatBrl(vault.amount, solBrl)} · {formatSol(vault.amount)}{" "}
                SOL
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep("crypto")}
              className="w-full bg-white border border-brand-border rounded-3xl p-5 text-left hover:border-brand-purple/40 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-purple/10 flex items-center justify-center text-2xl">
                  🔐
                </div>
                <div>
                  <p className="text-brand-ink font-semibold">
                    Carteira Crypto
                  </p>
                  <p className="text-brand-muted text-sm">
                    SOL direto na sua wallet · Login com Google
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-brand-muted ml-auto" />
              </div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep("pix")}
              className="w-full bg-white border border-brand-border rounded-3xl p-5 text-left hover:border-brand-orange/40 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-2xl">
                  🏦
                </div>
                <div>
                  <p className="text-brand-ink font-semibold">PIX</p>
                  <p className="text-brand-muted text-sm">
                    Receba em reais · Direto na sua conta
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-brand-muted ml-auto" />
              </div>
            </motion.button>

            <p className="text-center text-brand-muted/60 text-xs mt-2">
              Swap automático via Jupiter · ~30 segundos
            </p>
          </motion.div>
        )}

        {step === "crypto" && (
          <motion.div
            key="crypto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="text-center">
              <div className="text-5xl mb-3">🔐</div>
              <h2 className="font-display text-2xl font-bold text-brand-ink mb-2">
                Confirme seu @handle
              </h2>
              <p className="text-brand-muted text-sm">
                Informe o mesmo handle para o qual este pagamento foi enviado.
              </p>
            </div>

            <div className="w-full">
              <label className="text-brand-muted text-sm mb-2 block">
                Seu @handle ({PLATFORM_LABELS[vault.recipientPlatform]})
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@seu_usuario"
                className="w-full bg-white border border-brand-border rounded-2xl px-4 py-3.5 text-brand-ink placeholder:text-brand-muted/50 text-sm outline-none focus:border-brand-purple/60 transition-colors"
              />
              {handle.trim().length > 0 && handleHashMatches === false && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Handle não corresponde a este pagamento
                </p>
              )}
              {handleHashMatches === true && (
                <p className="text-emerald-500 text-xs mt-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Handle confirmado!
                </p>
              )}
            </div>

            <div className="w-full bg-white border border-brand-border rounded-2xl p-4 space-y-2">
              <Row
                label="Você recebe"
                value={`${formatSol(vault.amount)} SOL`}
              />
              <Row
                label="≈ em reais"
                value={`R$ ${formatBrl(vault.amount, solBrl)}`}
              />
              <Row label="Rede" value="Solana" />
              <Row label="Tempo estimado" value="~5 segundos" />
            </div>

            <Button
              fullWidth
              size="lg"
              loading={loading}
              disabled={!handleHashMatches}
              onClick={claimCrypto}
            >
              {authenticated ? "Resgatar SOL" : "Entrar e resgatar"}
            </Button>

            <button
              onClick={() => setStep("choose")}
              className="text-brand-muted text-sm"
            >
              ← Voltar
            </button>
          </motion.div>
        )}

        {step === "pix" && (
          <motion.div
            key="pix"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-6"
          >
            <div className="text-center">
              <div className="text-5xl mb-3">🏦</div>
              <h2 className="font-display text-2xl font-bold text-brand-ink mb-1">
                Receber via PIX
              </h2>
              <p className="text-brand-muted text-sm">
                Informe seu @handle e chave PIX para receber R${" "}
                {formatBrl(vault.amount, solBrl)}.
              </p>
            </div>

            <div>
              <label className="text-brand-muted text-sm mb-2 block">
                Seu @handle ({PLATFORM_LABELS[vault.recipientPlatform]})
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@seu_usuario"
                className="w-full bg-white border border-brand-border rounded-2xl px-4 py-3.5 text-brand-ink placeholder:text-brand-muted/50 text-sm outline-none focus:border-brand-orange/60 transition-colors"
              />
              {handle.trim().length > 0 && handleHashMatches === false && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Handle não corresponde a este pagamento
                </p>
              )}
              {handleHashMatches === true && (
                <p className="text-emerald-500 text-xs mt-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Handle confirmado!
                </p>
              )}
            </div>

            <div>
              <label className="text-brand-muted text-sm mb-2 block">
                Chave PIX
              </label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                className="w-full bg-white border border-brand-border rounded-2xl px-4 py-3.5 text-brand-ink placeholder:text-brand-muted/50 text-sm outline-none focus:border-brand-orange/60 transition-colors"
              />
            </div>

            <div className="bg-brand-orange-muted border border-brand-border rounded-2xl p-4">
              <p className="text-brand-ink-soft text-sm">
                🔄 SOL → USDC via Jupiter → BRL via BRLA · Tempo estimado: ~60s
              </p>
            </div>

            <Button
              fullWidth
              size="lg"
              loading={loading}
              disabled={!handleHashMatches || !pixKey.trim()}
              onClick={claimViaPix}
            >
              Receber R$ {formatBrl(vault.amount, solBrl)}
            </Button>

            <button
              onClick={() => setStep("choose")}
              className="text-brand-muted text-sm text-center"
            >
              ← Voltar
            </button>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #FF6B2B 0%, #9945FF 100%)",
                boxShadow: "0 0 40px rgba(255,107,43,0.25)",
              }}
            >
              <CheckCircle className="w-10 h-10 text-white" />
            </motion.div>

            <div>
              <h2 className="font-display text-2xl font-bold text-brand-ink mb-2">
                Resgatado com sucesso!
              </h2>
              <p className="text-brand-muted text-sm">
                {txSig
                  ? `${formatSol(vault.amount)} SOL enviado para sua wallet`
                  : `R$ ${formatBrl(
                      vault.amount,
                      solBrl
                    )} sendo enviado para sua chave PIX`}
              </p>
            </div>

            {txSig && (
              <a
                href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-purple text-sm underline"
              >
                Ver transação no Explorer
              </a>
            )}

            <p className="text-brand-muted/50 text-xs">
              Powered by Solana · Paga no @
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-brand-muted text-sm">{label}</span>
      <span className="text-brand-ink text-sm">{value}</span>
    </div>
  );
}
