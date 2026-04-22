# Pay on @ — Paga no @

> Send SOL and USDC to any Instagram, X (Twitter), or WhatsApp handle. No wallet required to receive.

Built for the **Colosseum Frontier Hackathon** by Superteam Brazil.

---

## Overview

**Pay on @** solves a fundamental UX problem in crypto payments: the recipient needs a wallet address. With Pay on @, the sender only needs the recipient's social media handle — the funds sit in a 7-day escrow vault on Solana until the recipient claims them (with or without a pre-existing wallet), or the sender gets a full refund.

```
Sender                          Protocol                        Recipient (@handle)
  │                               │                                │
  │── send 10 USDC → @alice ──►   │                                │
  │                               │── PaymentVault created         │
  │                               │   (7-day escrow)               │
  │                               │                                │
  │                               │   @alice receives claim link   │
  │                               │◄──────────────────────────────►│
  │                               │                                │
  │                               │◄── claim (verify Twitter auth)─┤
  │                               │                                │
  │                               │── funds released to @alice     │
```

---

## Architecture

### System Overview

```mermaid
graph TB
    subgraph Client ["Client (Next.js 14 PWA)"]
        UI[Mobile UI<br/>React + Tailwind]
        Privy[Privy Embedded Wallets<br/>Social Login]
        RQ[React Query<br/>Cache Layer]
    end

    subgraph API ["API Layer (Next.js Route Handlers)"]
        SendAPI[POST /api/send<br/>Build unsigned TX]
        ClaimAPI[POST /api/claim<br/>Build claim TX]
        VaultAPI[GET /api/vault/:id<br/>Deserialize account]
        PricesAPI[GET /api/prices<br/>Jupiter feed]
    end

    subgraph Chain ["On-Chain Programs (Solana Devnet → Mainnet)"]
        Registry[Registry Program<br/>AT8S64...DZkvX]
        Vault[Vault Program<br/>EgS854...N4H]
        FeeCollector[Fee Collector<br/>CxMBN...SG6s]
    end

    subgraph PDAs ["Program Derived Addresses"]
        HandleRecord["HandleRecord PDA<br/>seeds: handle + platform + hash"]
        PaymentVault["PaymentVault PDA<br/>seeds: vault + sender + nonce"]
        SenderNonce["SenderNonce PDA<br/>seeds: nonce + sender"]
        FeeCollectorPDA["FeeCollector PDA<br/>seeds: fee_collector"]
    end

    UI --> Privy
    UI --> RQ
    RQ --> API
    SendAPI --> Chain
    ClaimAPI --> Chain
    VaultAPI --> Chain
    Chain --> PDAs
    Registry --> HandleRecord
    Vault --> PaymentVault
    Vault --> SenderNonce
    FeeCollector --> FeeCollectorPDA
```

### Send Flow

```mermaid
sequenceDiagram
    actor Sender
    participant App as PWA (Next.js)
    participant API as /api/send
    participant Privy
    participant Vault as Vault Program

    Sender->>App: Enter @handle + amount
    App->>API: POST {sender, platform, handle, amountSol}
    API->>API: Derive PDAs (vault, noncePda, handleRecord)
    API->>API: Build unsigned Transaction
    API-->>App: {transaction: base64, vault: pubkey}
    App->>Privy: signTransaction(tx)
    Privy-->>App: signed tx
    App->>Vault: sendRawTransaction
    Vault->>Vault: create_vault (transfer - 0.5% fee to fee_collector)
    Vault-->>App: signature
    App-->>Sender: Success + shareable claim link
```

### Claim Flow

```mermaid
sequenceDiagram
    actor Recipient
    participant App as Claim Page (public)
    participant Privy
    participant API as /api/claim
    participant Vault as Vault Program

    Recipient->>App: Open claim link /claim/:vaultId
    App->>App: Read vault state on-chain
    Recipient->>Privy: Login with Twitter/Instagram
    App->>API: POST {claimant, vaultId, platform, handle}
    API->>API: Verify vault is pending + not expired
    API->>API: Build claim instruction
    API-->>App: {transaction: base64}
    App->>Privy: signAndSendTransaction(tx)
    Privy-->>Vault: claim_vault
    Vault->>Vault: Verify handle_hash matches
    Vault->>Vault: Transfer lamports to claimant
    Vault-->>App: signature
    App-->>Recipient: Claimed!
```

---

## Programs

### Registry (`AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX`)

Maps social handles to destination wallets. Handles are SHA-256 hashed before storing — no plaintext on-chain.

| Instruction | Description |
|---|---|
| `initialize_config` | One-time setup, sets authority |
| `register_handle` | Register `(platform, handle) → wallet` mapping |
| `update_wallet` | Owner updates their destination wallet |
| `verify_handle` | Authority marks a handle as verified |

**HandleRecord PDA seeds:** `["handle", platform_u8, sha256(normalized_handle)]`

### Vault (`EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H`)

Manages 7-day payment escrows with per-sender nonces.

| Instruction | Description |
|---|---|
| `initialize_config` | Set fee_bps (default 50 = 0.5%), claim_period, authority |
| `create_vault` | Deposit SOL/USDC into escrow; deducts fee to FeeCollector |
| `claim_vault` | Recipient claims by proving handle ownership |
| `refund_vault` | Sender reclaims after expiry |

**PaymentVault PDA seeds:** `["vault", sender_pubkey, nonce_u64_le]`  
**SenderNonce PDA seeds:** `["nonce", sender_pubkey]`

**VaultStatus enum:** `Pending(0)` → `Claimed(1)` or `Refunded(2)` or `Expired(3)`

### Fee Collector (`CxMBNwbovsvLTe7bSuca8X26WS7PW81VtDu3oLyfSG6s`)

Accumulates protocol fees (0.5% of each transfer). Authority can withdraw.

| Instruction | Description |
|---|---|
| `initialize` | Create the treasury PDA |
| `withdraw_sol` | Withdraw accumulated SOL |
| `withdraw_spl` | Withdraw accumulated SPL tokens |

---

## Account Layouts

### PaymentVault (bytes after 8-byte Anchor discriminator)

```
sender:                 Pubkey  [32]
recipient_handle_hash:  [u8;32] [32]
recipient_platform:     u8      [1]
amount:                 u64     [8]
mint:                   Pubkey  [32]
status:                 u8      [1]   (0=Pending, 1=Claimed, 2=Refunded, 3=Expired)
created_at:             i64     [8]
expires_at:             i64     [8]
claimed_at:             Option<i64> [1+8]
vault_nonce:            u64     [8]
bump:                   u8      [1]
```

### HandleRecord (bytes after 8-byte discriminator)

```
platform:           u8      [1]   (0=Instagram, 1=Twitter, 2=WhatsApp)
handle_hash:        [u8;32] [32]
owner:              Pubkey  [32]
destination_wallet: Pubkey  [32]
verified:           bool    [1]
created_at:         i64     [8]
updated_at:         i64     [8]
bump:               u8      [1]
```

---

## Frontend

**Stack:** Next.js 14 App Router · TailwindCSS · Framer Motion · React Query · Privy

**Pages:**
- `/` — Landing/onboarding, social login CTA
- `/wallet` — Dashboard: balance (SOL + USD + BRL), quick actions, history
- `/send` — 4-step send flow: handle → amount → confirm (shows fee) → success
- `/claim/:vaultId` — Public claim page (no auth required to view, auth to claim)
- `/defi` — DeFi yield strategies hub (Kamino, Sanctum, Orca)
- `/settings` — Profile, linked accounts, wallet address, logout

**Auth:** Privy embedded wallets — users sign in with Google/Apple/Twitter/email. A Solana wallet is automatically created if they don't have one.

---

## SDK (`@pay-on-handle/sdk`)

```typescript
import { buildCreateVaultTx, buildClaimVaultTx, fetchVault, hashHandle } from "@pay-on-handle/sdk";
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");

// Build a send transaction
const { transaction, vault, netAmount, feeAmount } = await buildCreateVaultTx({
  connection,
  sender: new PublicKey("..."),
  platform: 1, // Twitter
  handle: "@alice",
  amountLamports: 1_000_000_000n, // 1 SOL
});

// Read vault state
const vaultData = await fetchVault(connection, vault);
console.log(vaultData?.status); // "pending"

// Build a claim transaction
const claimTx = await buildClaimVaultTx({
  connection,
  claimant: new PublicKey("..."),
  vault,
  platform: 1,
  handle: "@alice",
  mint: new PublicKey("So11111111111111111111111111111111111111112"),
});
```

---

## Getting Started

### Prerequisites

- Rust + Solana CLI (`1.18+`)
- Anchor CLI (`0.32.0`)
- Node.js 20+ / Bun
- A funded devnet wallet (`solana airdrop 2`)

### Build Programs

```bash
anchor build
```

### Run Tests

```bash
anchor test
```

### Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

### Run the Frontend

```bash
cd app
cp .env.example .env.local
# Fill in NEXT_PUBLIC_PRIVY_APP_ID and NEXT_PUBLIC_RPC_ENDPOINT
npm install
npm run dev
```

---

## Environment Variables

```bash
# app/.env.local
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: for relayer/gasless claims
RELAYER_PRIVATE_KEY=base58_encoded_key
HELIUS_API_KEY=your_helius_key
OPENPIX_API_KEY=your_openpix_key   # PIX off-ramp
BRLA_API_KEY=your_brla_key         # BRL stablecoin
```

---

## Security Model

| Threat | Mitigation |
|---|---|
| Wrong recipient claims | `claim_vault` verifies SHA-256 of handle matches stored hash |
| Double claim | Status transitions: `Pending → Claimed` (immutable after) |
| Sender griefing | 7-day claim window; refund only after expiry |
| Fee manipulation | Fee bps stored in `VaultConfig` PDA, only authority can update |
| Overflow/underflow | All arithmetic uses `checked_add`, `checked_sub`, `checked_mul` |
| PDA substitution | Seeds include sender pubkey + nonce; canonical bump stored |
| Re-initialization | `init` not `init_if_needed` for VaultConfig and FeeCollector |
| Arbitrary CPI | All CPI targets validated via `Program<'info, T>` constraints |

---

## Roadmap

- [x] On-chain programs (Registry, Vault, FeeCollector)
- [x] Next.js 14 PWA (send, claim, wallet, DeFi, settings)
- [x] TypeScript SDK
- [ ] Devnet deployment + integration tests
- [ ] Jupiter swap (auto-convert SOL→USDC on claim)
- [ ] Kamino yield vault (idle escrow earns yield)
- [ ] PIX off-ramp via OpenPix/BRLA Digital
- [ ] Push notifications via Helius webhooks
- [ ] Ika cross-chain bridgeless deposits
- [ ] Encrypt confidential transfer option

---

## License

MIT — © 2025 Superteam Brazil
