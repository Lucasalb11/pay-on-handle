"use client";

import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface VaultInfo {
  sender: string;
  recipientHandleHash: string;
  amount: number;
  mint: string;
  status: string;
  createdAt: number;
  expiresAt: number;
  vaultId: string;
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

function daysLeft(expiresAt: number): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, Math.floor((expiresAt - now) / 86400));
}

function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4).replace(/\.?0+$/, "");
}

function formatBrl(lamports: number): string {
  const usd = (lamports / 1e9) * 150;
  const brl = usd * 5.1;
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
  const [pixKey, setPixKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig] = useState("");

  const { data: vault, isLoading, error } = useVaultInfo(vaultId);

  async function claimCrypto() {
    if (!wallets[0]) {
      await login();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId,
          claimerAddress: wallets[0].address,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Claim failed");
      }
      const { txBase64 } = await res.json();

      const { Transaction } = await import("@solana/web3.js");
      const { connection } = await import("@/lib/solana");
      const signedTx = await wallets[0].signTransaction(
        Transaction.from(Buffer.from(txBase64, "base64"))
      );
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
    if (!pixKey.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/claim-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultId, pixKey }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "PIX claim failed");
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
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-solana-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !vault) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">😕</p>
        <h1 className="font-display text-2xl font-bold text-white">
          Pagamento não encontrado
        </h1>
        <p className="text-white/50 text-sm">
          Este link pode ter expirado ou já ter sido resgatado.
        </p>
      </div>
    );
  }

  if (vault.status !== "pending") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">{vault.status === "claimed" ? "✅" : "❌"}</p>
        <h1 className="font-display text-2xl font-bold text-white">
          {vault.status === "claimed" ? "Já resgatado" : "Pagamento encerrado"}
        </h1>
        <p className="text-white/50 text-sm">
          {vault.status === "claimed"
            ? "Este pagamento já foi resgatado."
            : "Este pagamento foi reembolsado ao remetente."}
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col px-5 py-12">
      <AnimatePresence mode="wait">
        {/* Intro: show the payment */}
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
              <h1 className="font-display text-2xl font-bold text-white mb-1">
                Você recebeu um pagamento!
              </h1>
              <p className="text-white/50 text-sm">
                de {vault.sender.slice(0, 4)}...{vault.sender.slice(-4)}
              </p>
            </div>

            {/* Amount */}
            <div
              className="w-full rounded-3xl p-6 flex flex-col items-center gap-1"
              style={{
                background:
                  "linear-gradient(135deg, #9945FF22 0%, #14F19522 100%)",
                border: "1px solid #9945FF44",
              }}
            >
              <p className="font-display text-5xl font-bold text-white">
                R$ {formatBrl(vault.amount)}
              </p>
              <p className="text-white/50 text-sm">
                {formatSol(vault.amount)} SOL
              </p>
            </div>

            {/* Expiry */}
            <div className="flex items-center gap-2 text-white/40 text-sm">
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

            <p className="text-white/20 text-xs">
              Powered by Solana · Sem necessidade de wallet
            </p>
          </motion.div>
        )}

        {/* Choose: crypto wallet or PIX */}
        {step === "choose" && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-4"
          >
            <div className="text-center mb-4">
              <h2 className="font-display text-xl font-bold text-white mb-1">
                Como você quer receber?
              </h2>
              <p className="text-white/40 text-sm">
                R$ {formatBrl(vault.amount)} · {formatSol(vault.amount)} SOL
              </p>
            </div>

            {/* Crypto option */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep("crypto")}
              className="w-full bg-bg-card border border-bg-border rounded-3xl p-5 text-left hover:border-solana-purple/50 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-solana-purple/20 flex items-center justify-center text-2xl">
                  🔐
                </div>
                <div>
                  <p className="text-white font-semibold">Carteira Crypto</p>
                  <p className="text-white/40 text-sm">
                    SOL direto na sua wallet · Login com Google
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/30 ml-auto" />
              </div>
            </motion.button>

            {/* PIX option */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep("pix")}
              className="w-full bg-bg-card border border-bg-border rounded-3xl p-5 text-left hover:border-solana-green/50 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-solana-green/10 flex items-center justify-center text-2xl">
                  🏦
                </div>
                <div>
                  <p className="text-white font-semibold">PIX</p>
                  <p className="text-white/40 text-sm">
                    Receba em reais · Direto na sua conta
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/30 ml-auto" />
              </div>
            </motion.button>

            <p className="text-center text-white/20 text-xs mt-2">
              Swap automático via Jupiter · ~30 segundos
            </p>
          </motion.div>
        )}

        {/* Crypto claim */}
        {step === "crypto" && (
          <motion.div
            key="crypto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <div className="text-5xl">🔐</div>
            <div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">
                Criar conta e receber
              </h2>
              <p className="text-white/50 text-sm">
                Entre com Google ou Apple. Sua wallet é criada automaticamente —
                sem seed phrases.
              </p>
            </div>

            <div className="w-full bg-bg-card border border-bg-border rounded-2xl p-4 text-left space-y-2">
              <Row
                label="Você recebe"
                value={`${formatSol(vault.amount)} SOL`}
              />
              <Row label="Rede" value="Solana" />
              <Row label="Tempo estimado" value="~5 segundos" />
            </div>

            <Button fullWidth size="lg" loading={loading} onClick={claimCrypto}>
              {authenticated ? "Resgatar SOL" : "Entrar e resgatar"}
            </Button>
          </motion.div>
        )}

        {/* PIX claim */}
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
              <h2 className="font-display text-2xl font-bold text-white mb-1">
                Receber via PIX
              </h2>
              <p className="text-white/50 text-sm">
                Informe sua chave PIX e receba R$ {formatBrl(vault.amount)}{" "}
                direto na sua conta.
              </p>
            </div>

            <div>
              <label className="text-white/50 text-sm mb-2 block">
                Chave PIX
              </label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                className="w-full bg-bg-card border border-bg-border rounded-2xl px-4 py-3.5 text-white placeholder:text-white/30 text-sm outline-none focus:border-solana-green/60 transition-colors"
              />
            </div>

            <div className="bg-solana-green/10 border border-solana-green/30 rounded-2xl p-4">
              <p className="text-white/70 text-sm">
                🔄 Conversão automática: SOL → USDC via Jupiter → BRL via
                OpenPix
              </p>
            </div>

            <Button
              fullWidth
              size="lg"
              loading={loading}
              disabled={!pixKey.trim()}
              onClick={claimViaPix}
            >
              Receber R$ {formatBrl(vault.amount)}
            </Button>
          </motion.div>
        )}

        {/* Success */}
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
              className="w-20 h-20 rounded-full bg-solana-green/20 flex items-center justify-center"
            >
              <CheckCircle className="w-10 h-10 text-solana-green" />
            </motion.div>

            <div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">
                Resgatado com sucesso!
              </h2>
              <p className="text-white/50 text-sm">
                {txSig
                  ? `${formatSol(vault.amount)} SOL enviado para sua wallet`
                  : `R$ ${formatBrl(
                      vault.amount
                    )} sendo enviado para sua chave PIX`}
              </p>
            </div>

            <p className="text-white/20 text-xs">
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
      <span className="text-white/50 text-sm">{label}</span>
      <span className="text-white text-sm">{value}</span>
    </div>
  );
}
