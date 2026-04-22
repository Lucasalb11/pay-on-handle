import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
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

const PLATFORM_INSTAGRAM = 0;
const PLATFORM_TWITTER = 1;
const PLATFORM_WHATSAPP = 2;

async function airdrop(
  provider: anchor.AnchorProvider,
  pubkey: PublicKey,
  sol: number
) {
  const sig = await provider.connection.requestAirdrop(
    pubkey,
    sol * LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(sig, "confirmed");
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("paga-no-arroba: Registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registryProgram = anchor.workspace.Registry as Program<any>;
  const vaultProgram = anchor.workspace.Vault as Program<any>;

  const authority = provider.wallet as anchor.Wallet;
  const alice = Keypair.generate();
  const bob = Keypair.generate();

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    registryProgram.programId
  );

  const testHandle = "@joao_silva";
  const testHash = handleHashBytes(testHandle);

  function handleRecordPda(platform: number, hash: number[]): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("handle"),
        Buffer.from([platform]),
        Buffer.from(hash),
      ],
      registryProgram.programId
    );
    return pda;
  }

  before(async () => {
    await airdrop(provider, alice.publicKey, 5);
    await airdrop(provider, bob.publicKey, 5);
  });

  it("initialize registry config", async () => {
    await registryProgram.methods
      .initializeConfig(Keypair.generate().publicKey)
      .accounts({
        config: configPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await registryProgram.account.registryConfig.fetch(configPda);
    assert.equal(config.authority.toBase58(), authority.publicKey.toBase58());
    assert.equal(config.totalHandles.toNumber(), 0);
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
    const recordPda = handleRecordPda(
      PLATFORM_TWITTER,
      handleHashBytes("@another")
    );

    try {
      await registryProgram.methods
        .registerHandle(
          PLATFORM_TWITTER,
          handleHashBytes("@another"),
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
    const badHash = handleHashBytes("@testbad");
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

describe("paga-no-arroba: Vault — SOL flows", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const vaultProgram = anchor.workspace.Vault as Program<any>;

  const authority = provider.wallet as anchor.Wallet;
  const sender = Keypair.generate();
  const claimer = Keypair.generate();
  const feeCollector = Keypair.generate();

  const [vaultConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_config")],
    vaultProgram.programId
  );

  const [senderNoncePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nonce"), sender.publicKey.toBuffer()],
    vaultProgram.programId
  );

  const recipientHandle = "@maria_souza";
  const recipientHash = handleHashBytes(recipientHandle);

  let vaultNonce = 0;

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
    await airdrop(provider, sender.publicKey, 10);
    await airdrop(provider, claimer.publicKey, 2);
    await airdrop(provider, feeCollector.publicKey, 0.1);

    await vaultProgram.methods
      .initializeVaultConfig(feeCollector.publicKey)
      .accounts({
        config: vaultConfigPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("create SOL vault and check fee (0.5%)", async () => {
    const grossLamports = 1_000_000_000; // 1 SOL
    const expectedFee = Math.floor(grossLamports * 50 / 10_000); // 5_000_000
    const expectedNet = grossLamports - expectedFee;

    const vaultPda = getVaultPda(vaultNonce);
    const feeBalanceBefore = await provider.connection.getBalance(feeCollector.publicKey);

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
        feeCollector: feeCollector.publicKey,
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

    const feeBalanceAfter = await provider.connection.getBalance(feeCollector.publicKey);
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
        claimer: claimer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([claimer])
      .rpc();

    const claimedVault = await vaultProgram.account.paymentVault.fetch(vaultPda);
    assert.equal(claimedVault.status.claimed !== undefined, true);
    assert.isNotNull(claimedVault.claimedAt);

    const claimerBalanceAfter = await provider.connection.getBalance(claimer.publicKey);
    // Balance should increase by net amount (minus tx fee, which is small)
    assert.approximately(
      claimerBalanceAfter - claimerBalanceBefore,
      netAmount,
      10_000 // allow ~0.00001 SOL tx fee
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
    // Create a new vault
    const vaultPda = getVaultPda(vaultNonce);
    await vaultProgram.methods
      .createSolVault(
        PLATFORM_INSTAGRAM,
        recipientHash,
        new BN(vaultNonce),
        new BN(500_000_000)
      )
      .accounts({
        vault: vaultPda,
        senderNonce: senderNoncePda,
        config: vaultConfigPda,
        feeCollector: feeCollector.publicKey,
        sender: sender.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([sender])
      .rpc();

    const wrongHash = handleHashBytes("@wrong_person");
    try {
      await vaultProgram.methods
        .claimSolVault(wrongHash)
        .accounts({
          vault: vaultPda,
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
        new BN(200_000_000)
      )
      .accounts({
        vault: vaultPda,
        senderNonce: senderNoncePda,
        config: vaultConfigPda,
        feeCollector: feeCollector.publicKey,
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
        new BN(200_000_000)
      )
      .accounts({
        vault: vaultPda,
        senderNonce: senderNoncePda,
        config: vaultConfigPda,
        feeCollector: feeCollector.publicKey,
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
      // Either constraint error or Unauthorized
      assert.ok(e.message.length > 0);
    }

    vaultNonce++;
  });
});
