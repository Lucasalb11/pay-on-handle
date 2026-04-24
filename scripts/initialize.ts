/**
 * Idempotent initialization of all protocol PDAs on devnet.
 * Run via: anchor run initialize --provider.cluster devnet
 *
 * Order:
 *   1. fee_collector PDA  (fee-collector program)
 *   2. vault_config PDA   (vault program)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

describe("initialize protocol PDAs", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const authority = provider.wallet as anchor.Wallet;
  const feeCollectorProgram = (anchor.workspace as any)
    .FeeCollector as Program<any>;
  const vaultProgram = (anchor.workspace as any).Vault as Program<any>;

  const [feeCollectorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_collector")],
    feeCollectorProgram.programId
  );
  const [vaultConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_config")],
    vaultProgram.programId
  );

  it("1. initialize fee_collector", async () => {
    console.log("  Authority:        ", authority.publicKey.toBase58());
    console.log("  fee_collector PDA:", feeCollectorPda.toBase58());

    try {
      const tx = await feeCollectorProgram.methods
        .initialize(authority.publicKey)
        .accounts({
          feeCollector: feeCollectorPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("  ✓ initialized. tx:", tx);
    } catch (e: any) {
      if (e.message?.includes("already in use")) {
        const state =
          await feeCollectorProgram.account.feeCollectorAccount.fetch(
            feeCollectorPda
          );
        console.log(
          "  ✓ already exists. authority:",
          state.authority.toBase58()
        );
      } else {
        throw e;
      }
    }
  });

  it("2. initialize vault_config", async () => {
    console.log("  vault_config PDA:", vaultConfigPda.toBase58());
    console.log("  fee_collector:   ", feeCollectorPda.toBase58());

    try {
      const tx = await vaultProgram.methods
        .initializeVaultConfig(feeCollectorPda)
        .accounts({
          config: vaultConfigPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("  ✓ initialized. tx:", tx);
    } catch (e: any) {
      if (e.message?.includes("already in use")) {
        const cfg = await vaultProgram.account.vaultConfig.fetch(vaultConfigPda);
        console.log(
          "  ✓ already exists.",
          `fee_bps=${cfg.feeBps}`,
          `claim_period=${cfg.claimPeriod.toNumber()}s`,
          `fee_collector=${cfg.feeCollector.toBase58()}`
        );
      } else {
        throw e;
      }
    }
  });
});
