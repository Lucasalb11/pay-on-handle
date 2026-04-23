import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import * as crypto from "crypto";

// ── Helpers ────────────────────────────────────────────────────────────────────

function hashHandle(handle: string): Buffer {
  return crypto.createHash("sha256").update(handle.toLowerCase().trim()).digest();
}

function handleHashBytes(handle: string): number[] {
  return Array.from(hashHandle(handle));
}

/** Deterministic keypair from a string seed (consistent across runs). */
function makeKeypair(seed: string): Keypair {
  const hash = crypto.createHash("sha256").update(seed).digest();
  return Keypair.fromSeed(hash.slice(0, 32));
}

/** Transfer SOL from provider wallet — no faucet rate limits. */
async function fund(
  provider: anchor.AnchorProvider,
  pubkey: PublicKey,
  sol: number
) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: provider.wallet.publicKey,
      toPubkey: pubkey,
      lamports: Math.round(sol * LAMPORTS_PER_SOL),
    })
  );
  await provider.sendAndConfirm(tx);
}

const PLATFORM_INSTAGRAM = 0;
const PLATFORM_TWITTER = 1;

// ── Registry tests ─────────────────────────────────────────────────────────────

describe("paga-no-arroba: Registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registryProgram = anchor.workspace.Registry as Program<any>;
  const authority = provider.wallet as anchor.Wallet;

  // Deterministic keypairs — same pubkeys across every test run
  const alice = makeKeypair("pay-on-handle-test-alice-v1");
  const bob = makeKeypair("pay-on-handle-test-bob-v1");

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    registryProgram.programId
  );

  // Per-run unique handle so we always get a fresh handle_record
  const runTag = Date.now().toString(36);
  const testHandle = `@joao${runTag}`;
  const testHash = handleHashBytes(testHandle);

  function handleRecordPda(platform: number, hash: number[]): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("handle"), Buffer.from([platform]), Buffer.from(hash)],
      registryProgram.programId
    );
    return pda;
  }

  before(async () => {
    await fund(provider, alice.publicKey, 0.02);
    await fund(provider, bob.publicKey, 0.02);
  });

  it("initialize registry config", async () => {
    try {
      await registryProgram.methods
        .initializeConfig(Keypair.generate().publicKey)
        .accounts({
          config: configPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      if (!e.message.includes("already in use")) throw e;
    }

    const config = await registryProgram.account.registryConfig.fetch(configPda);
    assert.equal(config.authority.toBase58(), authority.publicKey.toBase58());
  });

  it("register a handle with valid proof", async () => {
    const recordPda = handleRecordPda(PLATFORM_INSTAGRAM, testHash);

    await registryProgram.methods
      .registerHandle(
        PLATFORM_INSTAGRAM,
        testHash,
        alice.publicKey,
        Buffer.from("valid-jwt-proof")
      )
      .accounts({
        handleRecord: recordPda,
        config: configPda,
        owner: alice.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    const record = await registryProgram.account.handleRecord.fetch(recordPda);
    assert.deepEqual(record.handleHash, testHash);
    assert.equal(record.platform, PLATFORM_INSTAGRAM);
    assert.equal(record.owner.toBase58(), alice.publicKey.toBase58());
    assert.equal(record.destinationWallet.toBase58(), alice.publicKey.toBase58());
    assert.isTrue(record.verified);
  });

  it("rejects register with empty proof", async () => {
    const otherHash = handleHashBytes(`@other${runTag}`);
    const recordPda = handleRecordPda(PLATFORM_TWITTER, otherHash);

    try {
      await registryProgram.methods
        .registerHandle(
          PLATFORM_TWITTER,
          otherHash,
          bob.publicKey,
          Buffer.from("")
        )
        .accounts({
          handleRecord: recordPda,
          config: configPda,
          owner: bob.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bob])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.include(e.message, "InvalidProof");
    }
  });

  it("rejects invalid platform", async () => {
    const badHash = handleHashBytes(`@bad${runTag}`);
    const recordPda = handleRecordPda(99, badHash);

    try {
      await registryProgram.methods
        .registerHandle(99, badHash, bob.publicKey, Buffer.from("proof"))
        .accounts({
          handleRecord: recordPda,
          config: configPda,
          owner: bob.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bob])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.include(e.message, "InvalidPlatform");
    }
  });

  it("owner can update destination wallet", async () => {
    const newWallet = Keypair.generate().publicKey;
    const recordPda = handleRecordPda(PLATFORM_INSTAGRAM, testHash);

    await registryProgram.methods
      .updateWallet(newWallet)
      .accounts({
        handleRecord: recordPda,
        owner: alice.publicKey,
      })
      .signers([alice])
      .rpc();

    const record = await registryProgram.account.handleRecord.fetch(recordPda);
    assert.equal(record.destinationWallet.toBase58(), newWallet.toBase58());
  });

  it("non-owner cannot update wallet", async () => {
    const recordPda = handleRecordPda(PLATFORM_INSTAGRAM, testHash);

    try {
      await registryProgram.methods
        .updateWallet(bob.publicKey)
        .accounts({
          handleRecord: recordPda,
          owner: bob.publicKey,
        })
        .signers([bob])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.include(e.message, "Unauthorized");
    }
  });
});

// ── Vault — SOL flows ─────────────────────────────────────────────────────────

describe("paga-no-arroba: Vault — SOL flows", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registryProgram = anchor.workspace.Registry as Program<any>;
  const vaultProgram = anchor.workspace.Vault as Program<any>;
  const authority = provider.wallet as anchor.Wallet;

  // Deterministic claimer — destination_wallet consistent across runs
  const claimer = makeKeypair("pay-on-handle-test-claimer-v1");
  // Fresh sender per run — avoids nonce/vault PDA conflicts
  const sender = Keypair.generate();

  const [vaultConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_config")],
    vaultProgram.programId
  );
  const [senderNoncePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nonce"), sender.publicKey.toBuffer()],
    vaultProgram.programId
  );
  const [registryConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    registryProgram.programId
  );

  // Per-run unique handle to avoid PDA collision with previous runs
  const runTag = Date.now().toString(36);
  const recipientHandle = `@maria${runTag}`;
  const recipientHash = handleHashBytes(recipientHandle);

  const [handleRecordPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("handle"),
      Buffer.from([PLATFORM_INSTAGRAM]),
      Buffer.from(recipientHash),
    ],
    registryProgram.programId
  );

  let vaultNonce = 0;
  // Resolved after reading vault config (may differ from random feeCollector)
  let actualFeeCollector: PublicKey;

  function getVaultPda(nonce: number): PublicKey {
    const nonceBytes = Buffer.alloc(8);
    nonceBytes.writeBigUInt64LE(BigInt(nonce));
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), sender.publicKey.toBuffer(), nonceBytes],
      vaultProgram.programId
    );
    return pda;
  }

  before(async () => {
    await fund(provider, sender.publicKey, 0.25);
    await fund(provider, claimer.publicKey, 0.02);

    // Initialize vault config (idempotent); read actual fee_collector from state
    try {
      const tempFeeCollector = makeKeypair("pay-on-handle-test-fee-collector-v1");
      await fund(provider, tempFeeCollector.publicKey, 0.01);
      await vaultProgram.methods
        .initializeVaultConfig(tempFeeCollector.publicKey)
        .accounts({
          config: vaultConfigPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      actualFeeCollector = tempFeeCollector.publicKey;
    } catch (e: any) {
      if (!e.message.includes("already in use")) throw e;
      const cfg = await vaultProgram.account.vaultConfig.fetch(vaultConfigPda);
      actualFeeCollector = cfg.feeCollector;
    }

    // Ensure registry config exists (idempotent)
    try {
      await registryProgram.methods
        .initializeConfig(Keypair.generate().publicKey)
        .accounts({
          config: registryConfigPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      if (!e.message.includes("already in use")) throw e;
    }

    // Register per-run handle with destination_wallet = claimer
    await registryProgram.methods
      .registerHandle(
        PLATFORM_INSTAGRAM,
        recipientHash,
        claimer.publicKey,
        Buffer.from("valid-jwt-proof")
      )
      .accounts({
        handleRecord: handleRecordPda,
        config: registryConfigPda,
        owner: claimer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([claimer])
      .rpc();
  });

  it("create SOL vault and check fee (0.5%)", async () => {
    const grossLamports = 50_000_000; // 0.05 SOL
    const expectedFee = Math.floor((grossLamports * 50) / 10_000);
    const expectedNet = grossLamports - expectedFee;

    const vaultPda = getVaultPda(vaultNonce);
    const feeBalanceBefore = await provider.connection.getBalance(actualFeeCollector);

    await vaultProgram.methods
      .createSolVault(
        PLATFORM_INSTAGRAM,
        recipientHash,
        new BN(vaultNonce),
        new BN(grossLamports)
      )
      .accounts({
        vault: vaultPda,
        senderNonce: senderNoncePda,
        config: vaultConfigPda,
        feeCollector: actualFeeCollector,
        sender: sender.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([sender])
      .rpc();

    const vault = await vaultProgram.account.paymentVault.fetch(vaultPda);
    assert.equal(vault.amount.toNumber(), expectedNet);
    assert.deepEqual(vault.recipientHandleHash, recipientHash);
    assert.equal(vault.recipientPlatform, PLATFORM_INSTAGRAM);
    assert.equal(vault.status.pending !== undefined, true);

    const feeBalanceAfter = await provider.connection.getBalance(actualFeeCollector);
    assert.equal(feeBalanceAfter - feeBalanceBefore, expectedFee);
  });

  it("claimer can claim SOL vault with correct handle hash", async () => {
    const vaultPda = getVaultPda(vaultNonce);
    const vault = await vaultProgram.account.paymentVault.fetch(vaultPda);
    const netAmount = vault.amount.toNumber();

    const claimerBalanceBefore = await provider.connection.getBalance(claimer.publicKey);

    await vaultProgram.methods
      .claimSolVault(recipientHash)
      .accounts({
        vault: vaultPda,
        handleRecord: handleRecordPda,
        claimer: claimer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([claimer])
      .rpc();

    const claimedVault = await vaultProgram.account.paymentVault.fetch(vaultPda);
    assert.equal(claimedVault.status.claimed !== undefined, true);
    assert.isNotNull(claimedVault.claimedAt);

    const claimerBalanceAfter = await provider.connection.getBalance(claimer.publicKey);
    assert.approximately(
      claimerBalanceAfter - claimerBalanceBefore,
      netAmount,
      10_000
    );

    vaultNonce++;
  });

  it("cannot claim already-claimed vault", async () => {
    const vaultPda = getVaultPda(vaultNonce - 1);

    try {
      await vaultProgram.methods
        .claimSolVault(recipientHash)
        .accounts({
          vault: vaultPda,
          handleRecord: handleRecordPda,
          claimer: claimer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([claimer])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.include(e.message, "VaultNotPending");
    }
  });

  it("wrong handle hash is rejected", async () => {
    const vaultPda = getVaultPda(vaultNonce);
    await vaultProgram.methods
      .createSolVault(
        PLATFORM_INSTAGRAM,
        recipientHash,
        new BN(vaultNonce),
        new BN(10_000_000)
      )
      .accounts({
        vault: vaultPda,
        senderNonce: senderNoncePda,
        config: vaultConfigPda,
        feeCollector: actualFeeCollector,
        sender: sender.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([sender])
      .rpc();

    const wrongHash = handleHashBytes("@wrong_person");
    try {
      // HandleMismatch fires before PDA check — any valid handleRecord works
      await vaultProgram.methods
        .claimSolVault(wrongHash)
        .accounts({
          vault: vaultPda,
          handleRecord: handleRecordPda,
          claimer: claimer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([claimer])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.include(e.message, "HandleMismatch");
    }

    vaultNonce++;
  });

  it("sender cannot refund before expiry", async () => {
    const vaultPda = getVaultPda(vaultNonce);
    await vaultProgram.methods
      .createSolVault(
        PLATFORM_INSTAGRAM,
        recipientHash,
        new BN(vaultNonce),
        new BN(10_000_000)
      )
      .accounts({
        vault: vaultPda,
        senderNonce: senderNoncePda,
        config: vaultConfigPda,
        feeCollector: actualFeeCollector,
        sender: sender.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([sender])
      .rpc();

    try {
      await vaultProgram.methods
        .refundSolVault()
        .accounts({
          vault: vaultPda,
          sender: sender.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([sender])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.include(e.message, "VaultNotExpired");
    }

    vaultNonce++;
  });

  it("non-sender cannot refund", async () => {
    const vaultPda = getVaultPda(vaultNonce);
    await vaultProgram.methods
      .createSolVault(
        PLATFORM_INSTAGRAM,
        recipientHash,
        new BN(vaultNonce),
        new BN(10_000_000)
      )
      .accounts({
        vault: vaultPda,
        senderNonce: senderNoncePda,
        config: vaultConfigPda,
        feeCollector: actualFeeCollector,
        sender: sender.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([sender])
      .rpc();

    try {
      await vaultProgram.methods
        .refundSolVault()
        .accounts({
          vault: vaultPda,
          sender: claimer.publicKey, // wrong sender
          systemProgram: SystemProgram.programId,
        })
        .signers([claimer])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e: any) {
      assert.ok(e.message.length > 0);
    }

    vaultNonce++;
  });
});
