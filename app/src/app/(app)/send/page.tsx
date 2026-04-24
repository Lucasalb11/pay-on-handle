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
  Share2,
  Globe,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { CloakLogo } from "@/components/icons/CloakLogo";
import { PLATFORMS, PlatformKey, FEE_BPS } from "@/lib/constants";
import { displayHandle } from "@/lib/handle";
import { Transaction } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { toast } from "sonner";
import { cloakFeeBreakdown, performCloakShield } from "@/lib/cloak";

type Step = "handle" | "amount" | "privacy" | "confirm" | "success";
type PrivacyMode = "public" | "private";

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
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("public");
  const [loading, setLoading] = useState(false);
  const [cloakStatus, setCloakStatus] = useState("");
  const [cloakProofPct, setCloakProofPct] = useState(0);
  const [txSig, setTxSig] = useState("");
  const [vaultId, setVaultId] = useState<string>("");

  const wallet = wallets[0];
  const protocolFee = parseFloat(amountSol || "0") * (FEE_BPS / 10000);
  const net = parseFloat(amountSol || "0") - protocolFee;
  const brlValue =
    amountSol && !Number.isNaN(parseFloat(amountSol))
      ? parseFloat(amountSol) * SOL_USD * USD_BRL
      : 0;

  const cloakFees =
    amountSol && parseFloat(amountSol) > 0
      ? cloakFeeBreakdown(parseFloat(amountSol))
      : null;

  const totalFeeSOL =
    protocolFee + (privacyMode === "private" ? cloakFees?.totalFeeSOL ?? 0 : 0);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  async function handleSend() {
    if (!wallet || !handle || !amountSol) return;
    setLoading(true);
    setCloakStatus("");
    setCloakProofPct(0);

    try {
      const platformId = PLATFORMS[platform].id;

      if (privacyMode === "private") {
        const { PublicKey, LAMPORTS_PER_SOL: SOL } = await import(
          "@solana/web3.js"
        );
        const amountLamports = BigInt(Math.round(parseFloat(amountSol) * SOL));

        await performCloakShield({
          connection,
          amountLamports,
          userPublicKey: new PublicKey(wallet.address),
          signTransaction: wallet.signTransaction.bind(wallet) as (
            tx: import("@solana/web3.js").Transaction
          ) => Promise<import("@solana/web3.js").Transaction>,
          signAndSendTransaction: async (tx) => {
            const signed = await wallet.signTransaction(tx);
            return connection.sendRawTransaction(signed.serialize());
          },
          onProgress: setCloakStatus,
          onProofProgress: setCloakProofPct,
        });

        setCloakStatus("Criando cofre de pagamento...");
      }

      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: wallet.address,
          platform: platformId,
          handle,
          amountSol: parseFloat(amountSol),
          private: privacyMode === "private",
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

  function goBack() {
    if (step === "handle") router.back();
    else if (step === "amount") setStep("handle");
    else if (step === "privacy") setStep("amount");
    else if (step === "confirm") setStep("privacy");
  }

  const stepTitles: Record<Step, string> = {
    handle: "Enviar",
    amount: "Valor",
    privacy: "Privacidade",
    confirm: "Confirmar",
    success: "Enviado!",
  };

  const stepOrder = ["handle", "amount", "privacy", "confirm"] as Step[];

  return (
    <main className="relative min-h-dvh flex flex-col px-5 pt-12 pb-10 bg-brand-beige overflow-hidden">
      {/* Ambient orb */}
      <div className="pointer-events-none absolute -top-20 right-0 w-80 h-80 bg-brand-purple/8 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 -left-20 w-60 h-60 bg-brand-orange/8 rounded-full blur-[100px]" />

      {/* Header */}
      {step !== "success" && (
        <div className="relative z-10 flex items-center gap-4 mb-8">
          <button
            onClick={goBack}
            aria-label="Voltar"
            className="p-2.5 rounded-xl glass text-brand-ink-soft"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            {stepTitles[step]}
          </h1>
          {/* Step dots */}
          <div className="ml-auto flex gap-1.5">
            {stepOrder.map((s) => (
              <div
                key={s}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{
                  background:
                    s === step
                      ? "#FF6B2B"
                      : stepOrder.indexOf(s) < stepOrder.indexOf(step)
                      ? "#9945FF"
                      : "rgba(26,16,40,0.12)",
                }}
              />
            ))}
          </div>
        </div>
      )}

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
              <p className="text-brand-muted text-sm">
                Para qual @ você quer enviar?
              </p>

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
                        ? "bg-brand-orange/15 border border-brand-orange/50 text-brand-ink"
                        : "bg-white border border-brand-border text-brand-muted"
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="text-xs font-medium">{p.label}</span>
                  </button>
                ))}
              </div>

              <div className="glass-card rounded-3xl p-8 flex flex-col items-center">
                <span className="text-brand-muted text-xs uppercase tracking-wider mb-3">
                  Digite o @
                </span>
                <div className="flex items-center gap-1 w-full justify-center">
                  <span className="text-brand-orange font-display text-4xl font-bold">
                    @
                  </span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) =>
                      setHandle(e.target.value.replace(/^@/, ""))
                    }
                    placeholder="usuario"
                    className="bg-transparent text-brand-ink text-3xl font-display font-semibold outline-none text-center placeholder:text-brand-muted/40 w-full max-w-[240px]"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                <p className="text-brand-muted text-xs mt-4">
                  no {PLATFORMS[platform].label}
                </p>
              </div>

              <div className="flex-1" />

              <Button
                fullWidth
                size="lg"
                disabled={!handle.trim()}
                onClick={() => setStep("amount")}
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
                <p className="text-brand-muted text-sm">
                  Enviando para{" "}
                  <span className="text-brand-purple font-semibold">
                    {displayHandle(handle)}
                  </span>{" "}
                  no {PLATFORMS[platform].label}
                </p>
              </div>

              <div className="glass-card rounded-3xl p-6 flex flex-col items-center relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-orange/10 rounded-full blur-3xl" />
                <div className="relative flex flex-col items-center">
                  <span className="text-brand-muted text-xs uppercase tracking-wider mb-2">
                    Valor em reais
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-brand-muted font-display text-2xl font-semibold">
                      R$
                    </span>
                    <span className="text-brand-ink font-display text-6xl font-bold leading-none">
                      {brlValue.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2 rounded-full bg-brand-beige border border-brand-border px-4 py-2">
                    <input
                      type="number"
                      value={amountSol}
                      onChange={(e) => setAmountSol(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="bg-transparent text-brand-ink text-sm outline-none w-20 text-right"
                    />
                    <span className="text-brand-muted text-sm font-medium">
                      SOL
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {["0.1", "0.5", "1", "5"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmountSol(v)}
                    className="py-2.5 rounded-xl bg-white border border-brand-border text-brand-ink-soft text-sm font-medium hover:border-brand-orange/40 hover:text-brand-orange transition-all"
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
                onClick={() => setStep("privacy")}
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* Step 3: Privacy */}
          {step === "privacy" && (
            <motion.div
              key="privacy"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-5"
            >
              <p className="text-brand-muted text-sm">
                Como você quer enviar{" "}
                <span className="text-brand-ink font-medium">
                  {amountSol} SOL
                </span>{" "}
                para{" "}
                <span className="text-brand-purple font-semibold">
                  {displayHandle(handle)}
                </span>
                ?
              </p>

              {/* Public option */}
              <button
                onClick={() => setPrivacyMode("public")}
                className={`w-full rounded-2xl p-5 text-left transition-all ${
                  privacyMode === "public"
                    ? "border-2 border-brand-orange/60 bg-brand-orange/5"
                    : "bg-white border border-brand-border"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-beige-dark flex items-center justify-center shrink-0 mt-0.5">
                    <Globe className="w-5 h-5 text-brand-muted" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-brand-ink text-sm">
                        Público
                      </span>
                      <div className="flex items-center gap-1.5">
                        {privacyMode === "public" && (
                          <CheckCircle className="w-4 h-4 text-brand-orange" />
                        )}
                        <span className="text-emerald-500 text-xs font-medium">
                          Sem taxa extra
                        </span>
                      </div>
                    </div>
                    <p className="text-brand-muted text-xs leading-relaxed">
                      Transação visível no Solscan. Seu endereço de carteira
                      aparece como remetente na blockchain.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-brand-muted" />
                      <span className="text-brand-muted text-xs">
                        Visível publicamente
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Private option */}
              <button
                onClick={() => setPrivacyMode("private")}
                className={`w-full rounded-2xl p-5 text-left transition-all ${
                  privacyMode === "private"
                    ? "border-2 border-brand-purple/60 bg-brand-purple/5"
                    : "bg-white border border-brand-border"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background:
                        privacyMode === "private"
                          ? "rgba(153,69,255,0.12)"
                          : "#EDE6DB",
                    }}
                  >
                    <CloakLogo
                      className="w-6 h-6"
                      active={privacyMode === "private"}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-brand-ink text-sm">
                          Privado
                        </span>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1"
                          style={{
                            background: "rgba(153,69,255,0.12)",
                            color: "#9945FF",
                          }}
                        >
                          <CloakLogo className="w-3 h-3" active />
                          Cloak
                        </span>
                      </div>
                      {privacyMode === "private" && (
                        <CheckCircle className="w-4 h-4 text-brand-purple" />
                      )}
                    </div>
                    <p className="text-brand-muted text-xs leading-relaxed">
                      Sua identidade fica oculta na blockchain. A transação é
                      roteada pelo protocolo Cloak de privacidade
                      zero-knowledge.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <EyeOff className="w-3.5 h-3.5 text-brand-purple/60" />
                      <span className="text-brand-purple/70 text-xs">
                        Não rastreável no Solscan
                      </span>
                    </div>

                    {cloakFees && (
                      <div
                        className="mt-3 rounded-xl p-3 space-y-1.5"
                        style={{ background: "rgba(153,69,255,0.06)" }}
                      >
                        <div className="flex justify-between">
                          <span className="text-brand-muted text-[11px]">
                            Taxa base Cloak
                          </span>
                          <span className="text-brand-ink-soft text-[11px]">
                            0.005 SOL
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-brand-muted text-[11px]">
                            Taxa variável (0.3%)
                          </span>
                          <span className="text-brand-ink-soft text-[11px]">
                            {cloakFees.percentFeeSOL.toFixed(5)} SOL
                          </span>
                        </div>
                        <div className="h-px my-1 bg-brand-border" />
                        <div className="flex justify-between">
                          <span className="text-brand-ink-soft text-[11px] font-medium">
                            Total taxa Cloak
                          </span>
                          <span className="text-brand-purple text-[11px] font-semibold">
                            +{cloakFees.totalFeeSOL.toFixed(5)} SOL
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Info note */}
              <div className="bg-brand-purple-muted border border-brand-border rounded-xl p-3.5 flex gap-2.5">
                <Info className="w-4 h-4 text-brand-purple shrink-0 mt-0.5" />
                <p className="text-brand-ink-soft text-xs leading-relaxed">
                  {privacyMode === "private"
                    ? "O Cloak usa zero-knowledge proofs para ocultar o remetente. Powered by cloak.ag."
                    : "A transação pública mostra seu endereço no Solscan, mas o handle do destinatário fica protegido por hash SHA-256."}
                </p>
              </div>

              <div className="flex-1" />

              <Button fullWidth size="lg" onClick={() => setStep("confirm")}>
                Continuar
                <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* Step 4: Confirm */}
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-5"
            >
              <div className="glass-card rounded-3xl p-6 space-y-4">
                <h2 className="font-display text-lg font-semibold text-center text-brand-ink">
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
                    label="Taxa protocolo (0.5%)"
                    value={`${protocolFee.toFixed(5)} SOL`}
                    accent
                  />
                  {privacyMode === "private" && cloakFees && (
                    <Row
                      label="Taxa Cloak (privacidade)"
                      value={`${cloakFees.totalFeeSOL.toFixed(5)} SOL`}
                      accent
                      highlight
                    />
                  )}
                  <div className="h-px bg-brand-border" />
                  <Row
                    label="Destinatário recebe"
                    value={`${net.toFixed(5)} SOL`}
                    bold
                  />
                  <Row label="Expira em" value="7 dias" />
                </div>

                {/* Privacy badge */}
                <div
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl"
                  style={{
                    background:
                      privacyMode === "private"
                        ? "rgba(153,69,255,0.08)"
                        : "rgba(255,107,43,0.06)",
                  }}
                >
                  {privacyMode === "private" ? (
                    <>
                      <CloakLogo className="w-3.5 h-3.5" active />
                      <span
                        className="text-xs font-medium"
                        style={{ color: "#9945FF" }}
                      >
                        Envio privado via Cloak
                      </span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5 text-brand-muted" />
                      <span className="text-xs font-medium text-brand-muted">
                        Envio público · visível no Solscan
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-brand-orange-muted border border-brand-border rounded-2xl p-4">
                <p className="text-brand-ink-soft text-sm">
                  💡 Se {displayHandle(handle)} não resgatar em 7 dias, o saldo
                  retorna para você automaticamente.
                </p>
              </div>

              <div className="flex-1" />

              {loading && privacyMode === "private" && cloakStatus && (
                <div
                  className="rounded-xl p-3.5 space-y-2"
                  style={{ background: "rgba(153,69,255,0.07)" }}
                >
                  <div className="flex items-center gap-2">
                    <CloakLogo className="w-4 h-4 animate-pulse" active />
                    <span className="text-xs text-brand-purple font-medium">
                      {cloakStatus}
                    </span>
                  </div>
                  {cloakProofPct > 0 && cloakProofPct < 100 && (
                    <div className="w-full h-1 rounded-full bg-brand-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${cloakProofPct}%`,
                          background:
                            "linear-gradient(90deg, #FF6B2B 0%, #9945FF 100%)",
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              <Button
                fullWidth
                size="lg"
                loading={loading}
                onClick={handleSend}
              >
                {privacyMode === "private" ? (
                  <span className="flex items-center gap-2">
                    <CloakLogo className="w-4 h-4" active />
                    Envio privado via Cloak
                  </span>
                ) : (
                  "Confirmar e pagar"
                )}
              </Button>
            </motion.div>
          )}

          {/* Step 5: Success */}
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
                className="w-28 h-28 rounded-full flex items-center justify-center"
                style={{
                  background:
                    privacyMode === "private"
                      ? "linear-gradient(135deg, #9945FF 0%, #C084FC 100%)"
                      : "linear-gradient(135deg, #FF6B2B 0%, #9945FF 100%)",
                  boxShadow: "0 0 60px rgba(255,107,43,0.25)",
                }}
              >
                {privacyMode === "private" ? (
                  <CloakLogo className="w-14 h-14" active />
                ) : (
                  <CheckCircle
                    className="w-14 h-14 text-white"
                    strokeWidth={2.5}
                  />
                )}
              </motion.div>

              <div>
                <h2 className="font-display text-3xl font-bold text-brand-ink mb-2">
                  {privacyMode === "private" ? "Enviado privado!" : "Enviado!"}
                </h2>
                <p className="text-brand-muted text-sm">
                  {amountSol} SOL enviado para {displayHandle(handle)}
                </p>
                {privacyMode === "private" && (
                  <div
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                    style={{ background: "rgba(153,69,255,0.1)" }}
                  >
                    <CloakLogo className="w-3.5 h-3.5" active />
                    <span className="text-xs" style={{ color: "#9945FF" }}>
                      Via Cloak · identidade oculta
                    </span>
                  </div>
                )}
              </div>

              <div className="w-full glass-card rounded-2xl p-4 text-left space-y-2">
                <p className="text-brand-muted text-xs uppercase tracking-wider">
                  Link de claim
                </p>
                <p className="text-brand-purple text-sm break-all font-mono">
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
                <Button fullWidth onClick={() => router.push("/wallet")}>
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
  highlight = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-brand-muted text-sm">{label}</span>
      <span
        className={`text-sm ${
          bold
            ? "font-semibold text-brand-ink"
            : highlight
            ? "font-medium"
            : accent
            ? "text-brand-muted"
            : "text-brand-ink"
        }`}
        style={highlight ? { color: "#9945FF" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
