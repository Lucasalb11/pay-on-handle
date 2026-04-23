"use client";

import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle,
  QrCode,
  Share2,
} from "lucide-react";
import { PLATFORMS, PlatformKey, FEE_BPS } from "@/lib/constants";
import { displayHandle } from "@/lib/handle";
import { Transaction } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { toast } from "sonner";

type Step = "handle" | "amount" | "confirm" | "success";

const SOL_USD = 150;
const USD_BRL = 5.1;

export default function SendPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useSolanaWallets();
  const router = useRouter();

  const [step, setStep] = useState<Step>("handle");
  const [platform, setPlatform] = useState<PlatformKey>("instagram");
  const [handle, setHandle] = useState("");
  const [amountSol, setAmountSol] = useState("");
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig] = useState("");
  const [vaultId, setVaultId] = useState<string>("");

  const wallet = wallets[0];
  const fee = parseFloat(amountSol || "0") * (FEE_BPS / 10000);
  const net = parseFloat(amountSol || "0") - fee;
  const brlValue =
    amountSol && !Number.isNaN(parseFloat(amountSol))
      ? parseFloat(amountSol) * SOL_USD * USD_BRL
      : 0;

  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  async function handleSend() {
    if (!wallet || !handle || !amountSol) return;
    setLoading(true);

    try {
      const platformId = PLATFORMS[platform].id;

      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: wallet.address,
          platform: platformId,
          handle,
          amountSol: parseFloat(amountSol),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Send failed");
      }

      const { transaction, vault } = await res.json();

      const signedTx = await wallet.signTransaction(
        Transaction.from(Buffer.from(transaction, "base64"))
      );
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setTxSig(sig);
      setVaultId(vault);
      setStep("success");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh flex flex-col px-5 pt-12 pb-10 bg-[#08080E] overflow-hidden">
      {/* Ambient orb */}
      <div className="pointer-events-none absolute -top-20 right-0 w-80 h-80 bg-solana-purple/12 rounded-full blur-[120px]" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-4 mb-8">
        <button
          onClick={() =>
            step === "handle" ? router.back() : setStep("handle")
          }
          aria-label="Voltar"
          className="p-2.5 rounded-xl glass text-white/80"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-display text-2xl font-bold text-white">Enviar</h1>
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {/* Step 1: Handle */}
          {step === "handle" && (
            <motion.div
              key="handle"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <p className="text-white/50 text-sm">
                Para qual @ você quer enviar?
              </p>

              {/* Platform pills */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                {(
                  Object.entries(PLATFORMS) as [
                    PlatformKey,
                    (typeof PLATFORMS)[PlatformKey]
                  ][]
                ).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setPlatform(key)}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full transition-all ${
                      platform === key
                        ? "bg-solana-purple/20 border border-solana-purple/50 text-white"
                        : "glass text-white/60"
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="text-xs font-medium">{p.label}</span>
                  </button>
                ))}
              </div>

              {/* Handle input */}
              <div className="glass-card rounded-3xl p-8 flex flex-col items-center">
                <span className="text-white/40 text-xs uppercase tracking-wider mb-3">
                  Digite o @
                </span>
                <div className="flex items-center gap-1 w-full justify-center">
                  <span className="text-solana-purple font-display text-4xl font-bold">
                    @
                  </span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) =>
                      setHandle(e.target.value.replace(/^@/, ""))
                    }
                    placeholder="usuario"
                    className="bg-transparent text-white text-3xl font-display font-semibold outline-none text-center placeholder:text-white/20 w-full max-w-[240px]"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                <p className="text-white/40 text-xs mt-4">
                  no {PLATFORMS[platform].label}
                </p>
              </div>

              <div className="flex-1" />

              <Button
                fullWidth
                size="lg"
                disabled={!handle.trim()}
                onClick={() => setStep("amount")}
                className="gradient-btn"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* Step 2: Amount */}
          {step === "amount" && (
            <motion.div
              key="amount"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div className="text-center">
                <p className="text-white/50 text-sm">
                  Enviando para{" "}
                  <span className="text-solana-purple font-semibold">
                    {displayHandle(handle)}
                  </span>{" "}
                  no {PLATFORMS[platform].label}
                </p>
              </div>

              {/* BRL display */}
              <div className="glass-card rounded-3xl p-6 flex flex-col items-center relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-solana-purple/15 rounded-full blur-3xl" />
                <div className="relative flex flex-col items-center">
                  <span className="text-white/40 text-xs uppercase tracking-wider mb-2">
                    Valor em reais
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-white/40 font-display text-2xl font-semibold">
                      R$
                    </span>
                    <span className="text-white font-display text-6xl font-bold leading-none">
                      {brlValue.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {/* SOL input (secondary) */}
                  <div className="mt-4 flex items-center gap-2 rounded-full glass px-4 py-2">
                    <input
                      type="number"
                      value={amountSol}
                      onChange={(e) => setAmountSol(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="bg-transparent text-white text-sm outline-none w-20 text-right"
                    />
                    <span className="text-white/50 text-sm font-medium">
                      SOL
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-2">
                {["0.1", "0.5", "1", "5"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmountSol(v)}
                    className="py-2.5 rounded-xl glass text-white/70 text-sm font-medium hover:text-white transition-all"
                  >
                    {v}
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              <Button
                fullWidth
                size="lg"
                disabled={!amountSol || parseFloat(amountSol) <= 0}
                onClick={() => setStep("confirm")}
                className="gradient-btn"
              >
                Revisar pagamento
              </Button>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-5"
            >
              <div className="glass-card rounded-3xl p-6 space-y-4">
                <h2 className="font-display text-lg font-semibold text-center text-white">
                  Confirmação
                </h2>

                <div className="space-y-3">
                  <Row
                    label="Para"
                    value={`${displayHandle(handle)} no ${
                      PLATFORMS[platform].label
                    }`}
                  />
                  <Row label="Valor" value={`${amountSol} SOL`} />
                  <Row
                    label="Equivalente"
                    value={`R$ ${brlValue.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    accent
                  />
                  <Row
                    label="Taxa (0.5%)"
                    value={`${fee.toFixed(5)} SOL`}
                    accent
                  />
                  <div className="h-px bg-white/10" />
                  <Row
                    label="Destinatário recebe"
                    value={`${net.toFixed(5)} SOL`}
                    bold
                  />
                  <Row label="Expira em" value="7 dias" />
                </div>
              </div>

              <div className="glass rounded-2xl p-4 border-solana-purple/30">
                <p className="text-white/70 text-sm">
                  💡 Se {displayHandle(handle)} não resgatar em 7 dias, o saldo
                  retorna para você automaticamente.
                </p>
              </div>

              <div className="flex-1" />

              <Button
                fullWidth
                size="lg"
                loading={loading}
                onClick={handleSend}
                className="gradient-btn"
              >
                Confirmar e pagar
              </Button>
            </motion.div>
          )}

          {/* Step 4: Success */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-6 text-center mt-6"
            >
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", delay: 0.1, stiffness: 200 }}
                className="w-28 h-28 rounded-full flex items-center justify-center shadow-glow-green"
                style={{
                  background:
                    "linear-gradient(135deg, #14F195 0%, #00C2FF 100%)",
                }}
              >
                <CheckCircle
                  className="w-14 h-14 text-black"
                  strokeWidth={2.5}
                />
              </motion.div>

              <div>
                <h2 className="font-display text-3xl font-bold text-white mb-2">
                  Enviado!
                </h2>
                <p className="text-white/50 text-sm">
                  {amountSol} SOL enviado para {displayHandle(handle)}
                </p>
              </div>

              <div className="w-full glass-card rounded-2xl p-4 text-left space-y-2">
                <p className="text-white/40 text-xs uppercase tracking-wider">
                  Link de claim
                </p>
                <p className="text-solana-purple text-sm break-all font-mono">
                  {`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/claim/${vaultId}`}
                </p>
              </div>

              <div className="w-full flex gap-3 mt-auto">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    navigator.share?.({
                      title: "Paga no @",
                      text: `Você recebeu ${amountSol} SOL! Clique para resgatar:`,
                      url: `${
                        process.env.NEXT_PUBLIC_APP_URL ?? ""
                      }/claim/${vaultId}`,
                    });
                  }}
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar
                </Button>
                <Button
                  fullWidth
                  onClick={() => router.push("/wallet")}
                  className="gradient-btn"
                >
                  Voltar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  accent = false,
  bold = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50 text-sm">{label}</span>
      <span
        className={`text-sm ${
          bold
            ? "font-semibold text-white"
            : accent
            ? "text-white/50"
            : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
