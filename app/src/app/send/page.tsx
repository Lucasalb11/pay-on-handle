"use client";

import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, CheckCircle } from "lucide-react";
import { PLATFORMS, PlatformKey, FEE_BPS } from "@/lib/constants";
import { hashHandle, displayHandle } from "@/lib/handle";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  connection,
  vaultPda,
  senderNoncePda,
  vaultConfigPda,
  getSenderNonce,
} from "@/lib/solana";
import { toast } from "sonner";

type Step = "handle" | "amount" | "confirm" | "success";

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
  const [vaultId, setVaultId] = useState<bigint>(BigInt(0));

  const wallet = wallets[0];
  const fee = parseFloat(amountSol || "0") * (FEE_BPS / 10000);
  const net = parseFloat(amountSol || "0") - fee;

  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  async function handleSend() {
    if (!wallet || !handle || !amountSol) return;
    setLoading(true);

    try {
      const sender = new PublicKey(wallet.address);
      const handleHash = hashHandle(handle);
      const platformId = PLATFORMS[platform].id;

      // Get current nonce for vault PDA derivation.
      const currentNonce = await getSenderNonce(sender);
      const vaultAddress = vaultPda(sender, currentNonce);
      const configAddress = vaultConfigPda();
      const nonceAddress = senderNoncePda(sender);

      // Get vault config to find fee_collector.
      const configInfo = await connection.getAccountInfo(configAddress);
      if (!configInfo)
        throw new Error("Vault config not found — run initialize first.");

      // fee_collector is stored at offset 8 (discriminator) + 32 (authority) = offset 40
      const feeCollector = new PublicKey(configInfo.data.slice(40, 72));

      // Build create_sol_vault instruction via the program IDL.
      // For MVP we use raw transaction building — SDK will wrap this later.
      const grossLamports = Math.floor(
        parseFloat(amountSol) * LAMPORTS_PER_SOL
      );

      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: sender,
      });

      // Use backend relayer to submit the program instruction (gasless via Octane pattern).
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderAddress: wallet.address,
          recipientHandle: handle,
          recipientPlatform: platformId,
          grossLamports,
          mint: "SOL",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Send failed");
      }

      const { txBase64, vaultId: returnedVaultId } = await res.json();

      // Sign the transaction with Privy embedded wallet.
      const signedTx = await wallet.signTransaction(
        Transaction.from(Buffer.from(txBase64, "base64"))
      );
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setTxSig(sig);
      setVaultId(BigInt(returnedVaultId));
      setStep("success");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col px-5 pt-12 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() =>
            step === "handle" ? router.back() : setStep("handle")
          }
          className="p-2 rounded-xl bg-bg-card border border-bg-border"
        >
          <ArrowLeft className="w-4 h-4 text-white/70" />
        </button>
        <h1 className="font-display text-xl font-bold">Enviar</h1>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Handle input */}
        {step === "handle" && (
          <motion.div
            key="handle"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-6"
          >
            <div>
              <p className="text-white/50 text-sm mb-4">
                Para qual @ você quer enviar?
              </p>

              {/* Platform selector */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(
                  Object.entries(PLATFORMS) as [
                    PlatformKey,
                    (typeof PLATFORMS)[PlatformKey]
                  ][]
                ).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setPlatform(key)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all
                        ${
                          platform === key
                            ? "border-solana-purple bg-solana-purple/10 text-white"
                            : "border-bg-border bg-bg-card text-white/50"
                        }`}
                  >
                    <span className="text-xl">{p.icon}</span>
                    <span className="text-[10px] font-medium">{p.label}</span>
                  </button>
                ))}
              </div>

              {/* Handle input */}
              <div className="flex items-center bg-bg-card border border-bg-border rounded-2xl px-4 py-3.5 gap-2 focus-within:border-solana-purple/60 transition-colors">
                <span className="text-solana-purple font-display text-xl font-bold">
                  @
                </span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                  placeholder="nome_do_usuario"
                  className="flex-1 bg-transparent text-white placeholder:text-white/30 text-base outline-none"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>

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
            <div className="text-center mb-2">
              <p className="text-white/50 text-sm">
                Enviando para{" "}
                <span className="text-solana-purple font-semibold">
                  {displayHandle(handle)}
                </span>{" "}
                no {PLATFORMS[platform].label}
              </p>
            </div>

            {/* Big number input */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={amountSol}
                  onChange={(e) => setAmountSol(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="bg-transparent text-white font-display text-6xl font-bold text-center w-full outline-none placeholder:text-white/20"
                  style={{ maxWidth: "240px" }}
                />
                <span className="text-white/40 font-display text-2xl">SOL</span>
              </div>
              {amountSol && (
                <p className="text-white/40 text-sm">
                  ≈ R$ {(parseFloat(amountSol) * 150 * 5.1).toFixed(2)} BRL
                </p>
              )}
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {["0.1", "0.5", "1", "5"].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmountSol(v)}
                  className="py-2 rounded-xl bg-bg-card border border-bg-border text-white/70 text-sm hover:border-solana-purple/40 transition-all"
                >
                  {v}
                </button>
              ))}
            </div>

            <Button
              fullWidth
              size="lg"
              disabled={!amountSol || parseFloat(amountSol) <= 0}
              onClick={() => setStep("confirm")}
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
            className="flex flex-col gap-6"
          >
            <div className="bg-bg-card border border-bg-border rounded-3xl p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold text-center">
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
                  label="Taxa (0.5%)"
                  value={`${fee.toFixed(5)} SOL`}
                  accent
                />
                <div className="h-px bg-bg-border" />
                <Row
                  label="Destinatário recebe"
                  value={`${net.toFixed(5)} SOL`}
                  bold
                />
                <Row label="Expira em" value="7 dias" />
              </div>
            </div>

            <div className="bg-solana-purple/10 border border-solana-purple/30 rounded-2xl p-4">
              <p className="text-white/70 text-sm">
                💡 Se {displayHandle(handle)} não resgatar em 7 dias, o saldo
                retorna para você automaticamente.
              </p>
            </div>

            <Button fullWidth size="lg" loading={loading} onClick={handleSend}>
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
                Enviado!
              </h2>
              <p className="text-white/50 text-sm">
                {amountSol} SOL enviado para {displayHandle(handle)}
              </p>
            </div>

            <div className="w-full bg-bg-card border border-bg-border rounded-2xl p-4 text-left space-y-2">
              <p className="text-white/40 text-xs">Link de claim</p>
              <p className="text-solana-purple text-sm break-all font-mono">
                {`${
                  process.env.NEXT_PUBLIC_APP_URL ?? ""
                }/claim/${vaultId.toString()}`}
              </p>
            </div>

            <div className="w-full flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  navigator.share?.({
                    title: "Paga no @",
                    text: `Você recebeu ${amountSol} SOL! Clique para resgatar:`,
                    url: `${
                      process.env.NEXT_PUBLIC_APP_URL ?? ""
                    }/claim/${vaultId.toString()}`,
                  });
                }}
              >
                Compartilhar link
              </Button>
              <Button fullWidth onClick={() => router.push("/wallet")}>
                Voltar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
