import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { Connection, PublicKey, Transaction } from "@solana/web3.js";

export const CLOAK_BASE_FEE_LAMPORTS = 5_000_000n;
export const CLOAK_PROGRAM_ID = "zh1eLd6rSphLejbFfJEneUwzHRfMKxgzrgkfwA6qRkW";
export const CLOAK_MIN_DEPOSIT_LAMPORTS = 10_000_000n;

export function calculateCloakFeeLamports(grossLamports: bigint): bigint {
  return CLOAK_BASE_FEE_LAMPORTS + (grossLamports * 3n) / 1000n;
}

export function cloakFeeSOL(amountSol: number): number {
  const gross = BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
  const fee = calculateCloakFeeLamports(gross);
  return Number(fee) / LAMPORTS_PER_SOL;
}

export function cloakFeeBreakdown(amountSol: number): {
  baseFeeSOL: number;
  percentFeeSOL: number;
  totalFeeSOL: number;
  totalFeeLamports: bigint;
} {
  const gross = BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
  const baseFee = CLOAK_BASE_FEE_LAMPORTS;
  const percentFee = (gross * 3n) / 1000n;
  const total = baseFee + percentFee;

  return {
    baseFeeSOL: Number(baseFee) / LAMPORTS_PER_SOL,
    percentFeeSOL: Number(percentFee) / LAMPORTS_PER_SOL,
    totalFeeSOL: Number(total) / LAMPORTS_PER_SOL,
    totalFeeLamports: total,
  };
}

const CLOAK_STATUS_MAP: Record<string, string> = {
  generating_note: "Gerando nota ZK...",
  awaiting_note_acknowledgment: "Aguardando confirmação da nota...",
  note_saved: "Nota salva com segurança...",
  creating_transaction: "Criando transação Cloak...",
  simulating: "Simulando transação...",
  sending: "Enviando depósito Cloak...",
  confirming: "Aguardando confirmação on-chain...",
  submitting_to_indexer: "Registrando no indexador...",
  fetching_proof: "Gerando prova zero-knowledge...",
  complete: "Protocolo Cloak concluído ✓",
  generating_proof: "Gerando prova ZK...",
  submitting: "Enviando via relay anônimo...",
};

function translateCloakStatus(status: string): string {
  return CLOAK_STATUS_MAP[status] ?? status;
}

export async function performCloakShield({
  connection,
  amountLamports,
  userPublicKey,
  signTransaction,
  signAndSendTransaction,
  onProgress,
  onProofProgress,
}: {
  connection: Connection;
  amountLamports: bigint;
  userPublicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAndSendTransaction?: (tx: Transaction) => Promise<string>;
  onProgress?: (status: string) => void;
  onProofProgress?: (pct: number) => void;
}): Promise<void> {
  const { CloakSDK } = await import("@cloak.dev/sdk");

  const walletAdapter = {
    publicKey: userPublicKey,
    signTransaction: signTransaction as <T extends Transaction>(
      tx: T
    ) => Promise<T>,
    ...(signAndSendTransaction
      ? {
          sendTransaction: async (tx: Transaction) =>
            signAndSendTransaction(tx),
        }
      : {}),
  };

  const sdk = new CloakSDK({
    wallet: walletAdapter,
    network: "devnet",
  });

  onProgress?.("Gerando nota ZK...");
  const note = await sdk.generateNote(Number(amountLamports));

  onProgress?.("Aguardando assinatura do depósito...");

  await sdk.withdraw(connection, note, userPublicKey, {
    withdrawAll: true,
    onProgress: (status: string) => onProgress?.(translateCloakStatus(status)),
    onProofProgress,
  });
}
