# Paga no @ — Visão Geral do Sistema

> Última atualização: 2026-04-23
> Network: **Devnet**
> Stack: Anchor 0.32 · Next.js 14 · Privy · Helius RPC · Cloak (privacidade)

---

## Arquitetura Geral

```
┌────────────────────────────────────────────────────────────┐
│  Usuário (mobile/browser)                                  │
│  Login Google/Apple via Privy → Embedded Wallet (SOL)      │
└────────────────────┬───────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼───────────────────────────────────────┐
│  Next.js 14 App (Railway → Vercel)                         │
│  /app  ─ frontend React + Tailwind                         │
│  /api  ─ route handlers (Node.js edge-compat)              │
│    ├─ /api/send          ← monta tx CreateSolVault         │
│    │    └─ (Cloak: encaminha via relay privado)            │
│    ├─ /api/claim         ← monta tx ClaimSolVault          │
│    ├─ /api/claim-pix     ← monta tx + inicia fluxo PIX     │
│    ├─ /api/vault/[id]    ← lê PaymentVault on-chain        │
│    ├─ /api/prices        ← cotação SOL/BRL (Binance + FX)  │
│    ├─ /api/jupiter       ← proxy Jupiter Quote/Swap API    │
│    └─ /api/webhooks/helius ← recebe eventos on-chain       │
└────────────────────┬───────────────────────────────────────┘
                     │ JSON-RPC / Helius
┌────────────────────▼───────────────────────────────────────┐
│  Solana Devnet — 3 programas Anchor                        │
│                                                            │
│  Registry  AT8S64n...   ← mapeia @handle → carteira       │
│  Vault     EgS854X...   ← escrow SOL/USDC por handle      │
│  FeeCollector CxMBNw... ← recebe 0.5% de cada envio       │
└────────────────────────────────────────────────────────────┘
                     │ (modo privado)
┌────────────────────▼───────────────────────────────────────┐
│  Cloak Relay  api.cloak.ag                                 │
│  Program: zh1eLd6rSphLejbFfJEneUwzHRfMKxgzrgkfwA6qRkW    │
│  UTXO shielded → transação privada, sem link on-chain      │
└────────────────────────────────────────────────────────────┘
```

---

## Programas Solana

### 1. Registry (`AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX`)

Mapeia social handles para carteiras Solana.

**Accounts:**
- `RegistryConfig` — PDA `[b"config"]` — controla o programa (authority, verification_program)
- `HandleRecord` — PDA `[b"handle", platform_byte, sha256(handle)]` — 1 registro por handle+plataforma

**Instruções:**
| Instrução | Quem chama | Função |
|-----------|-----------|--------|
| `initialize_config` | deployer (1x) | Inicia config global |
| `register_handle` | usuário | Registra @handle → wallet |
| `update_wallet` | owner do handle | Atualiza wallet de destino |
| `verify_handle` | authority | Marca handle como verificado |

**Status MVP:** A validação de proof é um stub (`proof_data != empty`). Qualquer dado não-vazio passa. **Ver C-2 no audit.**

---

### 2. Vault (`EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H`)

Escrow de pagamentos — guarda SOL/USDC até o destinatário resgatar.

**Accounts:**
- `VaultConfig` — PDA `[b"vault_config"]` — fee_bps (50 = 0.5%), claim_period (7 dias)
- `SenderNonce` — PDA `[b"nonce", sender]` — conta vaults por remetente
- `PaymentVault` — PDA `[b"vault", sender, nonce_le8]` — 1 por pagamento

**Layout `PaymentVault` (bytes):**
```
[8]  discriminador Anchor
[32] sender
[32] recipient_handle_hash  (SHA-256, sem texto)
[1]  recipient_platform     (0=Instagram, 1=Twitter, 2=WhatsApp)
[8]  amount                 (lamports líquidos, após taxa)
[32] mint                   (So11...112 = SOL nativo)
[1]  status                 (0=pending, 1=claimed, 2=refunded)
[8]  created_at             (unix timestamp)
[8]  expires_at             (created_at + 7 dias)
[9]  claimed_at             (Option<i64>: 1 flag + 8 bytes)
[8]  vault_nonce
[1]  bump
```

**Instruções:**
| Instrução | Quem chama | Função |
|-----------|-----------|--------|
| `initialize_vault_config` | deployer (1x) | Inicia config + define fee_collector |
| `create_sol_vault` | remetente | Cria vault com SOL, desconta 0.5% pro fee_collector |
| `create_spl_vault` | remetente | Igual mas com token SPL (USDC) |
| `claim_sol_vault` | destinatário | Resgata SOL — verifica handle hash + HandleRecord |
| `claim_spl_vault` | destinatário | Resgata SPL token |
| `refund_sol_vault` | remetente | Reembolso após expiração (7 dias) |
| `refund_spl_vault` | remetente | Idem para SPL |

---

### 3. FeeCollector (`CxMBNwbovsvLTe7bSuca8X26WS7PW81VtDu3oLyfSG6s`)

Recebe as taxas de 0.5% de cada vault criado. Só o authority pode sacar.

---

## Frontend (Next.js 14 App Router)

### Páginas

| Rota | Descrição | Status |
|------|-----------|--------|
| `/` | Landing institucional — login Google/Apple via Privy | ✅ funcional |
| `/wallet` | Dashboard — saldo SOL + atalhos | ✅ funcional (atividade mock) |
| `/send` | Fluxo de envio — 5 steps: handle → amount → privacy → confirm → success | ✅ funcional |
| `/claim/[vaultId]` | Resgatar pagamento (crypto ou PIX) | ✅ funcional |
| `/defi` | Estratégias DeFi (UI mockada) | ⚠️ UI apenas, sem integração real |
| `/settings` | Perfil, carteira, logout | ✅ funcional |

### API Routes

| Rota | Método | Descrição | Status |
|------|--------|-----------|--------|
| `/api/send` | POST | Monta `CreateSolVault` tx; aceita flag `private` para modo Cloak | ⚠️ flag `private` pendente |
| `/api/claim` | POST | Monta `ClaimSolVault/Spl` tx | ✅ funcional |
| `/api/claim-pix` | POST | Monta claim tx + grava intenção PIX em memória | ⚠️ PIX em memória volátil |
| `/api/vault/[vaultId]` | GET | Deserializa `PaymentVault` on-chain | ✅ funcional |
| `/api/prices` | GET | Cotação SOL/USD/BRL (Binance + exchangerate) | ✅ funcional (fallback estático) |
| `/api/jupiter` | GET/POST | Proxy para Jupiter Quote/Swap API | ✅ funcional |
| `/api/webhooks/helius` | POST | Recebe eventos Anchor, dispara PIX se VaultClaimed | ⚠️ store volátil, OpenPix pendente |

---

## Cloak — Transações Privadas

### O que é

[Cloak](https://docs.cloak.ag) é uma camada de privacidade para Solana baseada em UTXOs shielded. Em vez de a transação aparecer diretamente no Solscan vinculando remetente e destinatário, o Cloak usa um relay intermediário que quebra esse link on-chain.

### Custo Cloak

```
Taxa Cloak = 0.005 SOL (base) + 0.3% do valor bruto
```

Implementado em `app/src/lib/cloak.ts`:

```typescript
export const CLOAK_BASE_FEE_LAMPORTS = 5_000_000n;  // 0.005 SOL

export function calculateCloakFeeLamports(grossLamports: bigint): bigint {
  return CLOAK_BASE_FEE_LAMPORTS + (grossLamports * 3n) / 1000n;
}
```

### Fluxo no Frontend (Implementado)

O `send/page.tsx` agora tem 5 steps:

```
handle → amount → [NOVO] privacy → confirm → success
```

Step 3 (privacy) apresenta duas opções:
- **Público** (sem taxa extra) — transação visível no Solscan
- **Privado via Cloak** — relay shielded, taxa = 0.005 SOL + 0.3%

O confirm mostra a taxa Cloak como linha separada destacada em roxo quando o modo privado está selecionado.

### Integração Backend (PENDENTE)

O `/api/send/route.ts` ainda não processa a flag `private`. O que precisa ser feito:

**1. Aceitar flag no body:**
```typescript
const { sender, platform, handle, amountSol, private: isPrivate } = await req.json();
```

**2. Calcular e retornar Cloak fee:**
```typescript
import { calculateCloakFeeLamports } from "@/lib/cloak";

const grossLamports = BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
const cloakFeeLamports = isPrivate ? calculateCloakFeeLamports(grossLamports) : 0n;

return NextResponse.json({
  transaction,
  vault: vaultAddress,
  cloakFee: cloakFeeLamports.toString(),  // bigint → string para JSON
});
```

**3. Routing Cloak via SDK:**

A chamada real ao Cloak relay requer o SDK oficial. Consultar `docs.cloak.ag/sdk/quickstart` para obter o pacote e token de acesso. O padrão é:

```typescript
import { CloakClient } from "@cloak-labs/sdk";

const cloak = new CloakClient({
  programId: "zh1eLd6rSphLejbFfJEneUwzHRfMKxgzrgkfwA6qRkW",
  relay: "https://api.cloak.ag",
  connection,
});

// Substitui o vault normal por um depósito shielded
const { txHash } = await cloak.transact({
  sender: senderPublicKey,
  recipient: recipientAddress,
  amount: grossLamports,
});
```

**Nota:** O SDK Cloak pode não estar no npm público. Verificar documentação para o registro privado ou endpoint de instalação.

### Variáveis de Ambiente para Cloak

```bash
CLOAK_API_KEY=<obtido no dashboard Cloak>
NEXT_PUBLIC_CLOAK_PROGRAM_ID=zh1eLd6rSphLejbFfJEneUwzHRfMKxgzrgkfwA6qRkW
```

---

## Fluxo Principal: Enviar Pagamento

### Modo Público (padrão)

```
1. Usuário digita @handle + plataforma
2. Usuário digita valor (SOL)
3. Seleciona modo: Público
4. Confirma → POST /api/send {sender, platform, handle, amountSol, private: false}
5. API:
   a. Lê nonce atual do sender na chain
   b. Computa hash SHA-256 do handle
   c. Monta instrução CreateSolVault
   d. Retorna tx serializada (não assinada) + endereço vault
6. Frontend pede assinatura ao Privy embedded wallet
7. Frontend submete tx assinada via RPC
8. Aguarda confirmação
9. Exibe link de claim: {APP_URL}/claim/{vault_address}
```

### Modo Privado (Cloak)

```
1–3. Mesmo que acima, mas seleciona modo: Privado via Cloak
4. Confirma → POST /api/send {sender, platform, handle, amountSol, private: true}
5. API:
   a. Calcula cloakFee = 0.005 SOL + 0.3% de amountSol
   b. Encaminha depósito ao relay Cloak (sdk.transact)
   c. Retorna {cloakTxHash, vault} — sem link Solscan público
6. Frontend assina a transação Cloak via Privy
7. Relay Cloak faz o roteamento shielded on-chain
8. Link de claim gerado normalmente (vault ainda criado no programa)
```

---

## Fluxo Principal: Resgatar (Crypto)

```
1. Destinatário abre link /claim/{vault_address}
2. GET /api/vault/{vault_address} → exibe valor, plataforma, expiração
3. Usuário digita seu @handle
4. Frontend valida SHA-256(handle) == vault.recipientHandleHash (client-side)
5. Usuário confirma → POST /api/claim {claimant, vaultId, handle}
6. API:
   a. Verifica vault status=pending + não expirado
   b. Valida hash do handle novamente (server-side)
   c. Monta ClaimSolVault tx (referencia HandleRecord PDA)
   d. Retorna tx serializada
7. Frontend assina via Privy → submete → confirma
8. SOL cai direto na embedded wallet
```

**Nota**: O programa verifica que `claimer == HandleRecord.destination_wallet`.
O claimant deve ter o handle registrado no Registry com sua carteira Privy como `destination_wallet`.

---

## Fluxo: Resgatar via PIX

```
1. Mesmo início que "Resgatar Crypto" até step 4
2. Usuário digita chave PIX ao invés de confirmar crypto
3. POST /api/claim-pix {vaultId, handle, pixKey, claimant}
4. API:
   a. Valida vault e hash
   b. Grava {pixKey, brlCents} em Map em memória (keyed por vault_nonce)
   c. Retorna tx de claim (igual ao fluxo crypto)
5. Frontend assina e submete tx → SOL vai para carteira Privy
6. Helius webhook detecta VaultClaimed event
7. /api/webhooks/helius despacha PIX via OpenPix API
   (SOL → USDC via Jupiter → BRL via BRLA/OpenPix)
```

**Problemas Conhecidos:**
- `pix-store.ts` usa `Map` em memória — perde dados se o servidor reiniciar
- `OPENPIX_APP_ID` não está configurado → PIX não é despachado
- BRLA → OpenPix: integração descrita mas não implementada no webhook (falta Jupiter swap real)

---

## Banco de Dados e Armazenamento

### Visão Geral por Camada

```
┌─────────────────────────────────────────────────────────────┐
│  Solana On-Chain (fonte de verdade imutável)                │
│  PaymentVault PDAs, HandleRecord PDAs, VaultConfig          │
│  Não requer gerenciamento — é o "banco de dados" do protocolo│
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Redis (Upstash) — dados efêmeros e cache                   │
│  TTL 24h: PIX intent store (vaultNonce → pixKey + brlCents) │
│  TTL 30s: cache de cotação SOL/BRL                          │
│  Sem schema, sem migrations, sem ORM                        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  PostgreSQL (Supabase/Neon) — analytics e histórico         │
│  Necessário a partir do dashboard de métricas               │
│  Tabelas: events, vaults_snapshot, daily_stats              │
│  Populado pelo webhook Helius (on-chain events → rows)      │
└─────────────────────────────────────────────────────────────┘
```

### O que vai onde

| Dado | Onde armazenar | Por quê |
|------|---------------|---------|
| Vault criado / claimed / expirado | On-chain (Solana) | Fonte de verdade imutável |
| Handle → wallet | On-chain (Registry PDA) | Verificável publicamente |
| Intenção PIX (pixKey + valor BRL) | Redis com TTL 24h | Efêmero, não precisa persistir |
| Cotação SOL/BRL | Redis com TTL 30s | Cache para evitar rate limit |
| Sessão de usuário | Privy (gerencia) | Não precisa implementar |
| Métricas históricas (volume, counts) | PostgreSQL | Queries analíticas; on-chain é lento para isso |
| Eventos on-chain parseados | PostgreSQL | Indexar e servir ao dashboard |
| Chaves de API, secrets | Variáveis de ambiente | Nunca em banco de dados |

### Redis (Upstash) — Detalhes

**Uso atual:**
```typescript
// PIX intent store — necessário para correlacionar claim com PIX
pix:{vaultNonce}  →  { pixKey, brlCents, walletAddress }   TTL: 24h

// Price cache — evitar 429 na Binance
price:sol_brl     →  "1234.56"                             TTL: 30s
```

**Setup Upstash (free tier: 10k req/dia):**
```
upstash.com → Create Database → Region: us-east-1
→ REST API → copiar UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
```

**No Vercel:** instalar via Marketplace Integration (injeta as vars automaticamente).
**No Railway:** adicionar via New → Database → Redis (injeta `REDIS_URL`).

### PostgreSQL — Detalhes (para dashboard de métricas)

**Schema mínimo para MVP do dashboard:**

```sql
-- Cada evento on-chain parseado pelo webhook Helius
CREATE TABLE events (
  id            BIGSERIAL PRIMARY KEY,
  event_type    TEXT NOT NULL,           -- 'vault_created' | 'vault_claimed' | 'vault_refunded'
  vault_address TEXT NOT NULL,
  sender        TEXT,
  amount_lamports BIGINT,
  platform      SMALLINT,               -- 0=Instagram 1=Twitter 2=WhatsApp
  is_private    BOOLEAN DEFAULT false,  -- Cloak
  tx_signature  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot diário para gráficos sem re-agregar tudo
CREATE TABLE daily_stats (
  date          DATE PRIMARY KEY,
  vaults_created  INT DEFAULT 0,
  vaults_claimed  INT DEFAULT 0,
  vaults_expired  INT DEFAULT 0,
  volume_lamports BIGINT DEFAULT 0,
  unique_senders  INT DEFAULT 0
);

CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at DESC);
```

**Providers recomendados (free tier):**

| Provider | Free tier | Melhor para |
|----------|-----------|-------------|
| **Supabase** | 500MB, 2 projetos | Auth, realtime, REST auto-gerado |
| **Neon** | 512MB, branching | Serverless-first, Vercel Edge |
| **PlanetScale** | 5GB, 1 DB | MySQL, schema branching |

Recomendação: **Neon** para Vercel (integração nativa, edge-compatible driver `@neondatabase/serverless`).

**Variáveis:**
```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
# Neon/Supabase injetam isso automaticamente via integração Vercel
```

---

## Serviços Necessários

### Mapa de Serviços

```
┌──────────────┬──────────────────────────────┬───────────┬────────────────┐
│ Serviço      │ Função                       │ Free tier │ Env var        │
├──────────────┼──────────────────────────────┼───────────┼────────────────┤
│ Privy        │ Auth social + embedded wallet│ Sim       │ PRIVY_APP_ID   │
│ Helius       │ RPC Solana + webhooks        │ Sim (500k)│ HELIUS_API_KEY │
│ Railway      │ Hosting (ou Vercel)          │ $5/mês    │ —              │
│ Vercel       │ Hosting (ou Railway)         │ Sim       │ —              │
│ Upstash      │ Redis (PIX store, cache)     │ Sim (10k) │ UPSTASH_*      │
│ Neon/Supabase│ PostgreSQL (dashboard/analytics)│ Sim   │ DATABASE_URL   │
│ Cloak        │ Transações privadas          │ Não       │ CLOAK_API_KEY  │
│ OpenPix/Woovi│ Despacho PIX                 │ Não       │ OPENPIX_APP_ID │
│ Jupiter      │ Swap SOL↔USDC                │ Gratuito  │ —              │
│ Binance API  │ Cotação SOL/USD              │ Gratuito  │ —              │
│ ExchangeRate │ Cotação USD/BRL              │ Sim (1500/mês)│ —          │
└──────────────┴──────────────────────────────┴───────────┴────────────────┘
```

### Serviços Obrigatórios para MVP

1. **Privy** — sem ele não há auth nem embedded wallet. Gratuito até 1.000 usuários ativos/mês.
   - Criar app: `dashboard.privy.io`

2. **Helius** — RPC com rate limits muito maiores que o devnet público. Gratuito até 500k req/mês.
   - Criar conta: `dashboard.helius.xyz`
   - Usar o endpoint: `https://devnet.helius-rpc.com/?api-key=<KEY>`

3. **Railway ou Vercel** — hosting do Next.js.
   - Railway: melhor para manter estado entre requests (Redis service integrado, sem cold start)
   - Vercel: melhor integração com Next.js, CDN global, mas serverless (sem estado em memória)

4. **Upstash Redis** — para o PIX store persistir entre deploys/restarts.
   - Criar em: `upstash.com` ou via Vercel Marketplace

### Serviços para o Dashboard de Métricas

5. **Neon ou Supabase** — PostgreSQL para armazenar eventos on-chain e gerar métricas.
   - Neon: `neon.tech` (melhor para Vercel Edge)
   - Supabase: `supabase.com` (tem realtime built-in se quiser live dashboard)

### Serviços Futuros (não bloqueadores do MVP)

6. **OpenPix/Woovi** — despacho PIX. Requer CNPJ e conta verificada.
   - Criar conta: `openpix.com.br`

7. **Cloak** — privacidade nas transações. SDK ainda não público no npm.
   - Contato: `docs.cloak.ag` → obter acesso ao SDK

---

## Integrations

| Serviço | Uso | Config |
|---------|-----|--------|
| **Privy** | Auth social (Google/Apple/Twitter) + embedded wallet Solana | `NEXT_PUBLIC_PRIVY_APP_ID` |
| **Helius RPC** | RPC devnet (rate limits altos) + webhooks de eventos | `NEXT_PUBLIC_RPC_ENDPOINT`, `HELIUS_API_KEY` |
| **Jupiter** | Proxy para quotes e swaps SOL↔USDC (futuro PIX) | sem chave — API pública |
| **Cloak** | Relay shielded para transações privadas | `CLOAK_API_KEY` (obter no dashboard Cloak) |
| **Upstash Redis** | PIX store persistente + cache de preços | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Neon/Supabase** | PostgreSQL para analytics e dashboard de métricas | `DATABASE_URL` |
| **OpenPix/Woovi** | Despachar PIX após claim | `OPENPIX_APP_ID` (pendente) |
| **Binance + ExchangeRate** | Cotação SOL/USD e USD/BRL | sem chave — API pública |

---

## Autenticação Social: Instagram, Twitter/X e WhatsApp

### Twitter/X — Pronto, só ativar

Privy já inclui `"twitter"` no `loginMethods` em `providers.tsx`. Após login, o username fica disponível em:

```ts
const { user } = usePrivy();
const twitterAccount = user?.linkedAccounts.find(a => a.type === "twitter_oauth");
const twitterHandle = twitterAccount?.username; // ex: "lucasalb11"
```

**O que fazer:**

1. No dashboard Privy (`dashboard.privy.io` → seu App → Login Methods) → habilitar **Twitter/X**
2. Criar um Twitter App em `developer.twitter.com` → OAuth 2.0 → callback: `https://auth.privy.io/api/v1/oauth/callback`
3. Colar `Client ID` e `Client Secret` no Privy dashboard
4. No fluxo de claim: **auto-preencher** o campo de handle com `twitterHandle` se a plataforma selecionada for Twitter

**Mudança de código mínima** em `claim/[vaultId]/client.tsx`:

```ts
const { user } = usePrivy();
useEffect(() => {
  if (vault?.recipientPlatform === 1) {
    const twitterHandle = user?.linkedAccounts
      .find(a => a.type === "twitter_oauth")?.username;
    if (twitterHandle) setHandle(twitterHandle);
  }
}, [vault, user]);
```

---

### WhatsApp — Phone number = Handle

```ts
// lib/handle.ts — adicionar:
export function normalizeWhatsApp(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
  // "+55 (11) 99999-9999" → "+5511999999999"
}
```

---

### Instagram — Meta OAuth (rota customizada)

> ⚠️ A Instagram Basic Display API foi descontinuada em dezembro de 2024. Usar a nova API via Meta Login.

**Variáveis de ambiente necessárias:**
```bash
META_APP_ID=<seu app id no developers.facebook.com>
META_APP_SECRET=<secret>
META_REDIRECT_URI=https://{APP_URL}/api/auth/instagram/callback
```

**Arquivos a criar:**
```
app/src/app/api/auth/instagram/
├── route.ts          ← GET /api/auth/instagram — inicia OAuth redirect
└── callback/
    └── route.ts      ← GET /api/auth/instagram/callback — troca code por username
```

---

## O que Está Funcionando e Testado

### ✅ Programas Anchor (testados com `anchor test`)
- **Registry**: initialize_config, register_handle (com proof válida), rejeição de proof vazia, rejeição de plataforma inválida, update_wallet (owner), rejeição de non-owner
- **Vault SOL**: create_sol_vault com fee 0.5%, claim com hash correto, rejeição de vault já claimed, rejeição de hash errado (HandleMismatch), rejeição de refund antes da expiração, rejeição de refund por non-sender
- **Security**: C-1 (open claim) corrigido — HandleRecord PDA + destination_wallet verificados on-chain

### ✅ Frontend
- Landing page institucional (full-width, Framer Motion, glassmorphism)
- Wallet dashboard (saldo via RPC, preço SOL)
- Navegação por abas
- Página de settings (perfil, carteira, logout)
- DeFi page (UI de estratégias — sem integração real)
- Claim page — leitura de vault on-chain, validação de hash client-side
- Send page — fluxo de 5 steps com privacy step (público / Cloak)

### ✅ Build
- `next build` passa sem erros
- `output: 'standalone'` configurado em `next.config.mjs`
- TypeScript sem erros

---

## Próximos Passos para Ir Live

### 🔴 P0 — Bloqueia o fluxo principal (fazer primeiro)

---

#### 1. Inicializar VaultConfig no devnet

O vault program precisa de um `VaultConfig` PDA inicializado antes de qualquer `create_sol_vault`.

**Verificar se já existe:**
```bash
solana account $(node -e "
  const { PublicKey } = require('@solana/web3.js');
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_config')],
    new PublicKey('EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H')
  );
  console.log(pda.toBase58());
") --url devnet
```

Se retornar erro, inicializar:
```bash
cd pay-on-handle
anchor run initialize --provider.cluster devnet
# ou criar script em migrations/initialize.ts
```

O script deve chamar `initialize_vault_config` e `initialize_config` (Registry) com a keypair do deployer (que deve ter SOL devnet suficiente).

---

#### 2. Ativar Twitter OAuth no Privy

Sem isso, usuários não conseguem provar ownership do handle e o fluxo de claim falha.

**Passos:**
1. `developer.twitter.com` → Create App → habilitar OAuth 2.0
2. Redirect URI: `https://auth.privy.io/api/v1/oauth/callback`
3. `dashboard.privy.io` → seu App → Login Methods → habilitar Twitter → colar Client ID + Secret
4. Testar login com Twitter no app local

---

#### 3. Implementar fluxo de registro de handle (onboarding)

Atualmente o claim falha porque o `HandleRecord` PDA do claimant não existe no Registry.

**Criar `POST /api/register-handle`:**
```ts
// app/src/app/api/register-handle/route.ts
// 1. Verificar JWT do usuário via PrivyClient.verifyAuthToken
// 2. Extrair handle verificado de user.linkedAccounts (twitter_oauth ou phone)
// 3. Derivar HandleRecord PDA
// 4. Se não existe: chamar registry.register_handle com RELAYER_KEY como payer
// 5. Retornar HandleRecord address
```

**Chamar automaticamente após login** em `app/src/app/layout.tsx` ou `providers.tsx`:
```ts
const { user, authenticated } = usePrivy();
useEffect(() => {
  if (authenticated && user) {
    fetch('/api/register-handle', { method: 'POST' });
  }
}, [authenticated, user]);
```

**Variáveis necessárias:**
```bash
RELAYER_PRIVATE_KEY=<bs58 keypair que paga as txs de registro>
PRIVY_APP_SECRET=<do dashboard Privy → API Keys>
```

---

#### 4. Completar integração Cloak no backend

O frontend já tem o step de privacy e envia `private: true` na requisição. Falta o `/api/send/route.ts` processar a flag.

**O que fazer:**

a) Instalar o SDK Cloak:
```bash
# Verificar docs.cloak.ag/sdk/quickstart para o pacote exato
# Pode ser npm privado; obter token no dashboard Cloak
npm install @cloak-labs/sdk
# ou
npm install https://registry.cloak.ag/...
```

b) Atualizar `/api/send/route.ts` para aceitar e processar `private`:
```typescript
import { calculateCloakFeeLamports, CLOAK_PROGRAM_ID } from "@/lib/cloak";

const { sender, platform, handle, amountSol, private: isPrivate } = await req.json();

const grossLamports = BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
const cloakFeeLamports = isPrivate ? calculateCloakFeeLamports(grossLamports) : 0n;

// ... monta tx normal ...

return NextResponse.json({
  transaction,
  vault: vaultAddress,
  cloakFee: cloakFeeLamports.toString(),
  isPrivate,
});
```

c) Para o relay shielded real, consultar `docs.cloak.ag/sdk/transact`.

---

### 🟡 P1 — Necessário para deploy funcional

---

#### 5. Configurar Helius Webhook

O webhook aciona o fluxo PIX quando um vault é claimed.

**Passos:**
1. `dashboard.helius.xyz` → Webhooks → New Webhook
2. Webhook URL: `https://<seu-dominio>/api/webhooks/helius`
3. Transaction Type: `PROGRAM_INTERACTION`
4. Account Address: `EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H` (Vault program)
5. Copiar o Webhook Secret gerado
6. Adicionar ao `.env.local`:
   ```bash
   HELIUS_WEBHOOK_SECRET=<secret do dashboard>
   ```

---

#### 6. Migrar pix-store.ts para Redis

`pix-store.ts` usa `Map` em memória — perde tudo ao reiniciar ou em serverless.

**Com Upstash Redis (Vercel) ou Railway Redis:**

```bash
npm install @upstash/redis
```

```ts
// lib/pix-store.ts — substituir Map por Redis
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const PIX_TTL_SECONDS = 60 * 60 * 24; // 24h

export async function setPixIntent(vaultNonce: string, intent: PixIntent) {
  await redis.set(`pix:${vaultNonce}`, JSON.stringify(intent), { ex: PIX_TTL_SECONDS });
}

export async function getPixIntent(vaultNonce: string): Promise<PixIntent | null> {
  const data = await redis.get<string>(`pix:${vaultNonce}`);
  return data ? JSON.parse(data) : null;
}
```

**Variáveis:**
```bash
# Upstash (Vercel)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# Railway Redis (auto-injetado)
REDIS_URL=redis://...
```

---

#### 7. Dashboard de Métricas do dApp

Um painel `/admin` para acompanhar o uso do protocolo em tempo real.

**Stack recomendada:** Next.js page `/app/(admin)/admin/page.tsx` + PostgreSQL (Neon/Supabase) populado pelo webhook Helius.

##### Passo 1 — Criar banco PostgreSQL

```bash
# Neon (recomendado para Vercel)
# neon.tech → New Project → copiar DATABASE_URL
npm install @neondatabase/serverless

# ou Supabase
# supabase.com → New Project → Settings → Database → Connection string
npm install @supabase/supabase-js
```

Criar as tabelas (rodar via SQL editor do Neon/Supabase):

```sql
CREATE TABLE events (
  id              BIGSERIAL PRIMARY KEY,
  event_type      TEXT NOT NULL,
  vault_address   TEXT NOT NULL,
  sender          TEXT,
  amount_lamports BIGINT,
  platform        SMALLINT,
  is_private      BOOLEAN DEFAULT false,
  tx_signature    TEXT UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_stats (
  date              DATE PRIMARY KEY,
  vaults_created    INT DEFAULT 0,
  vaults_claimed    INT DEFAULT 0,
  vaults_expired    INT DEFAULT 0,
  volume_lamports   BIGINT DEFAULT 0,
  unique_senders    INT DEFAULT 0
);

CREATE INDEX idx_events_type    ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at DESC);
```

##### Passo 2 — Alimentar banco via webhook Helius

Atualizar `/api/webhooks/helius/route.ts` para inserir eventos ao receber callbacks:

```typescript
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Dentro do handler, após identificar o tipo de evento:
await sql`
  INSERT INTO events (event_type, vault_address, sender, amount_lamports, platform, tx_signature)
  VALUES (${eventType}, ${vaultAddress}, ${sender}, ${amountLamports}, ${platform}, ${txSignature})
  ON CONFLICT (tx_signature) DO NOTHING
`;

// Atualizar daily_stats
await sql`
  INSERT INTO daily_stats (date, vaults_created, volume_lamports)
  VALUES (CURRENT_DATE, 1, ${amountLamports})
  ON CONFLICT (date) DO UPDATE SET
    vaults_created  = daily_stats.vaults_created + 1,
    volume_lamports = daily_stats.volume_lamports + EXCLUDED.volume_lamports
`;
```

##### Passo 3 — Criar API route de métricas

```typescript
// app/src/app/api/admin/metrics/route.ts
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  const [totals] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'vault_created')  AS total_created,
      COUNT(*) FILTER (WHERE event_type = 'vault_claimed')  AS total_claimed,
      COUNT(*) FILTER (WHERE event_type = 'vault_expired')  AS total_expired,
      COALESCE(SUM(amount_lamports) FILTER (WHERE event_type = 'vault_created'), 0) AS total_volume,
      COUNT(DISTINCT sender) AS unique_senders,
      COUNT(*) FILTER (WHERE is_private = true) AS private_sends
    FROM events
  `;

  const last30days = await sql`
    SELECT date, vaults_created, vaults_claimed, volume_lamports
    FROM daily_stats
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY date ASC
  `;

  const byPlatform = await sql`
    SELECT platform, COUNT(*) AS count
    FROM events
    WHERE event_type = 'vault_created'
    GROUP BY platform
  `;

  return NextResponse.json({ totals, last30days, byPlatform });
}
```

##### Passo 4 — Criar página `/admin`

```typescript
// app/src/app/(admin)/admin/page.tsx
// Proteger com senha simples ou Privy (verificar ADMIN_SECRET no header)
// Exibir:
//   - Cards: Total enviado | Total resgatado | Volume SOL | Senders únicos
//   - Gráfico de linha: volume diário (últimos 30 dias)
//   - Pizza: distribuição por plataforma (Instagram / Twitter / WhatsApp)
//   - Lista: últimos 10 eventos (vault, valor, hora)
//   - Badge: % privado (Cloak) vs público
```

**Bibliotecas para os gráficos:**
```bash
npm install recharts
# ou
npm install @tremor/react   # componentes prontos para dashboards Next.js
```

**Exemplo com Tremor (zero config):**
```typescript
import { Card, Metric, Text, AreaChart, DonutChart } from "@tremor/react";

export default async function AdminPage() {
  const { totals, last30days, byPlatform } = await fetch('/api/admin/metrics').then(r => r.json());

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <Text>Vaults Criados</Text>
          <Metric>{totals.total_created}</Metric>
        </Card>
        <Card>
          <Text>Vaults Resgatados</Text>
          <Metric>{totals.total_claimed}</Metric>
        </Card>
        <Card>
          <Text>Volume Total (SOL)</Text>
          <Metric>{(Number(totals.total_volume) / 1e9).toFixed(2)}</Metric>
        </Card>
        <Card>
          <Text>Senders Únicos</Text>
          <Metric>{totals.unique_senders}</Metric>
        </Card>
      </div>

      <Card>
        <Text>Volume Diário — últimos 30 dias</Text>
        <AreaChart
          data={last30days}
          index="date"
          categories={["volume_lamports"]}
          colors={["purple"]}
        />
      </Card>

      <Card>
        <Text>Distribuição por Plataforma</Text>
        <DonutChart
          data={byPlatform}
          category="count"
          index="platform"
        />
      </Card>
    </div>
  );
}
```

**Proteção da rota `/admin`:**
```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const token = req.headers.get("x-admin-token") ?? req.cookies.get("admin_token")?.value;
    if (token !== process.env.ADMIN_SECRET) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
  return NextResponse.next();
}
```

```bash
# Variável de ambiente
ADMIN_SECRET=<string aleatória longa>
```

**Variáveis de ambiente adicionais para o dashboard:**
```bash
DATABASE_URL=postgresql://...   # Neon ou Supabase
ADMIN_SECRET=<token de acesso ao /admin>
```

---

#### 8. Buscar histórico real no /wallet

A tela de wallet mostra dados mock. Substituir por:

```ts
// lib/helius.ts
export async function getWalletHistory(address: string) {
  const res = await fetch(
    `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${process.env.HELIUS_API_KEY}&limit=20`
  );
  return res.json();
}
```

Filtrar por `type: "TRANSFER"` e `source: "SYSTEM_PROGRAM"` para mostrar envios/recebimentos relevantes.

---

### 🟢 P2 — Pós-MVP / Hardening

---

#### 8. Fechar vault PDAs após claim/refund (L-2)

Cada vault aberto custa ~0.002 SOL em rent. Adicionar `close = sender` ao account constraint:

```rust
// programs/vault/src/instructions/claim_sol_vault.rs
#[account(
    mut,
    close = sender,  // ← adicionar isto
    has_one = ...
)]
pub vault: Account<'info, PaymentVault>,
```

---

#### 9. Whitelist de mints em CreateSplVault (M-1)

Atualmente aceita qualquer mint SPL. Adicionar validação:

```rust
// programs/vault/src/instructions/create_spl_vault.rs
const USDC_DEVNET: Pubkey = pubkey!("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
const USDC_MAINNET: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

require!(
    ctx.accounts.mint.key() == USDC_DEVNET || ctx.accounts.mint.key() == USDC_MAINNET,
    VaultError::InvalidMint
);
```

---

#### 10. Instagram OAuth — Meta Graph API

**Configuração:**
1. `developers.facebook.com` → Create App → Consumer
2. Products → Instagram → Instagram Login with Business Login
3. Valid OAuth Redirect URIs: `https://<APP_URL>/api/auth/instagram/callback`
4. Scopes: `instagram_basic`

**Variáveis:**
```bash
META_APP_ID=xxx
META_APP_SECRET=xxx
META_REDIRECT_URI=https://<APP_URL>/api/auth/instagram/callback
```

---

## Deploy: Railway

### Pré-requisitos
- `output: 'standalone'` já está em `next.config.mjs` ✅
- Repositório no GitHub

### Passos Completos

**1. Criar projeto no Railway**
```
railway.app → New Project → Deploy from GitHub Repo
Selecionar o repositório → selecionar branch main
```

**2. Configurar serviço Next.js**
- Root Directory: `pay-on-handle/app`
- Build Command: `npm run build`
- Start Command: `node .next/standalone/server.js`
- Port: `3000`

**3. Adicionar serviço Redis**
```
No projeto Railway → New → Database → Add Redis
```
Railway injeta `REDIS_URL` automaticamente no serviço Next.js.

**4. Criar `app/Dockerfile`** (opcional — mais controle sobre o build)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**5. Variáveis de ambiente** (Railway → seu serviço → Variables tab)

```bash
# Públicas (expostas ao browser)
NEXT_PUBLIC_PRIVY_APP_ID=cmo0pavcd00860cjp0engxymy
NEXT_PUBLIC_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=e657af06-55cf-4b04-bb72-09909232d6c4
NEXT_PUBLIC_VAULT_PROGRAM_ID=EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H
NEXT_PUBLIC_REGISTRY_PROGRAM_ID=AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX
NEXT_PUBLIC_FEE_COLLECTOR_PROGRAM_ID=CxMBNwbovsvLTe7bSuca8X26WS7PW81VtDu3oLyfSG6s
NEXT_PUBLIC_APP_URL=https://pay-on-handle-production-70a5.up.railway.app

# Secretas (nunca expor ao browser)
RELAYER_PRIVATE_KEY=<bs58 — NÃO commitar>
PRIVY_APP_SECRET=<do dashboard Privy → API Keys>
HELIUS_API_KEY=e657af06-55cf-4b04-bb72-09909232d6c4
HELIUS_WEBHOOK_SECRET=<gerar no dashboard Helius>
CLOAK_API_KEY=<dashboard Cloak>
OPENPIX_APP_ID=<Woovi — pendente>
# REDIS_URL é injetado automaticamente pelo Railway Redis
```

**6. Gerar keypair do relayer**
```bash
# Gerar nova keypair (NÃO usar a keypair de deploy dos programas)
solana-keygen new --outfile relayer-keypair.json
solana airdrop 1 $(solana-keygen pubkey relayer-keypair.json) --url devnet

# Exportar em base58 para a variável de ambiente
node -e "
  const fs = require('fs');
  const bs58 = require('bs58');
  const key = JSON.parse(fs.readFileSync('relayer-keypair.json'));
  console.log(bs58.encode(Buffer.from(key)));
"
```

**7. Domínio customizado** (opcional)
```
Railway → Settings → Domains → Add Custom Domain
```
Após configurar domínio, atualizar `NEXT_PUBLIC_APP_URL` e recriar o Helius webhook com a nova URL.

**8. Verificar build no Railway**
```
Railway → seu serviço → Deployments → ver logs do build
Erros comuns: falta de env var, versão do Node incompatível
```

---

## Deploy: Vercel

### Pré-requisitos
- Repositório no GitHub
- Monorepo — configurar Root Directory corretamente

### Passos Completos

**1. Importar projeto**
```
vercel.com/new → Import Git Repository → selecionar o repo
```

**2. Configurar projeto**
- Framework Preset: **Next.js** (auto-detectado)
- Root Directory: `pay-on-handle/app`
- Build Command: `npm run build` (padrão)
- Output Directory: `.next` (padrão)
- Node.js Version: 20.x

**3. Adicionar Upstash Redis (obrigatório para PIX store)**
```
Vercel Dashboard → Integrations → Upstash → Add Integration
```
Isso cria o banco e injeta automaticamente:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**4. Variáveis de ambiente** (Project → Settings → Environment Variables)

| Nome | Tipo | Valor |
|------|------|-------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Public | `cmo0pavcd00860cjp0engxymy` |
| `NEXT_PUBLIC_RPC_ENDPOINT` | Public | `https://devnet.helius-rpc.com/?api-key=...` |
| `NEXT_PUBLIC_VAULT_PROGRAM_ID` | Public | `EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H` |
| `NEXT_PUBLIC_REGISTRY_PROGRAM_ID` | Public | `AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX` |
| `NEXT_PUBLIC_FEE_COLLECTOR_PROGRAM_ID` | Public | `CxMBNwbovsvLTe7bSuca8X26WS7PW81VtDu3oLyfSG6s` |
| `NEXT_PUBLIC_APP_URL` | Public | `https://pay-on-handle.vercel.app` |
| `RELAYER_PRIVATE_KEY` | Secret | `<bs58 keypair>` |
| `PRIVY_APP_SECRET` | Secret | `<do dashboard Privy>` |
| `HELIUS_API_KEY` | Secret | `e657af06-55cf-4b04-bb72-09909232d6c4` |
| `HELIUS_WEBHOOK_SECRET` | Secret | `<gerar no Helius>` |
| `CLOAK_API_KEY` | Secret | `<dashboard Cloak>` |
| `OPENPIX_APP_ID` | Secret | `<Woovi — pendente>` |

**5. Deploy via CLI**
```bash
npm i -g vercel
cd pay-on-handle/app
vercel --prod
```

Ou simplesmente fazer push para `main` — Vercel auto-deploya.

**6. Após o deploy:**
```
1. Copiar a URL final (ex: pay-on-handle.vercel.app)
2. Atualizar NEXT_PUBLIC_APP_URL para essa URL
3. Recriar Helius webhook: Dashboard → Webhooks → URL nova
4. Atualizar META_REDIRECT_URI se Instagram OAuth estiver ativo
```

**Limitação Vercel:** Serverless functions são stateless — o `pix-store.ts` com `Map` em memória **não funciona**. Upstash Redis (passo 3) é obrigatório antes de ativar o fluxo PIX.

---

## Checklist de Deploy — Ordem de Execução

### Infraestrutura e Serviços (fazer antes do deploy)
```
[ ] 1.  Criar conta Helius → obter HELIUS_API_KEY (helius.xyz)
[ ] 2.  Criar conta Privy → obter NEXT_PUBLIC_PRIVY_APP_ID (privy.io)
[ ] 3.  Criar banco Upstash Redis → obter UPSTASH_REDIS_REST_URL + TOKEN (upstash.com)
[ ] 4.  Criar banco Neon ou Supabase PostgreSQL → obter DATABASE_URL
[ ] 5.  Rodar migrations SQL no banco (tabelas events e daily_stats)
[ ] 6.  Gerar RELAYER_PRIVATE_KEY (solana-keygen new) e fazer airdrop devnet
[ ] 7.  Gerar ADMIN_SECRET (string aleatória para proteger /admin)
```

### Programas Solana
```
[ ] 8.  anchor build && anchor test (todos os testes passando)
[ ] 9.  Verificar/inicializar VaultConfig no devnet (anchor run initialize)
```

### Build e Deploy
```
[ ] 10. npm run build em pay-on-handle/app (zero erros TypeScript)
[ ] 11. Configurar todas as variáveis de ambiente no Railway ou Vercel
[ ] 12. Deploy Railway ou Vercel
[ ] 13. Atualizar NEXT_PUBLIC_APP_URL para o domínio final
```

### Configurações pós-deploy
```
[ ] 14. Criar Helius webhook apontando para https://<dominio>/api/webhooks/helius
[ ] 15. Adicionar HELIUS_WEBHOOK_SECRET ao env do deploy
[ ] 16. Ativar Twitter OAuth no dashboard Privy + criar Twitter App
```

### Funcionalidades pendentes (antes de abrir para usuários)
```
[ ] 17. Implementar /api/register-handle (sem isso, claim não funciona)
[ ] 18. Atualizar /api/webhooks/helius para inserir eventos no PostgreSQL
[ ] 19. Criar /api/admin/metrics com queries no PostgreSQL
[ ] 20. Criar página /admin com cards + gráficos (Tremor ou Recharts)
[ ] 21. (Cloak) Obter SDK e CLOAK_API_KEY → atualizar /api/send/route.ts
```

### Validação final
```
[ ] 22. Testar fluxo completo: send → link de claim → claim (devnet)
[ ] 23. Abrir /admin e confirmar que métricas aparecem após o teste
[ ] 24. Testar claim via link externo (não localhost)
```

---

## Bugs Corrigidos

| Bug | Arquivo | Descrição |
|-----|---------|-----------|
| Campo errado na API | `send/page.tsx` | `senderAddress`→`sender`, `recipientHandle`→`handle`, `recipientPlatform`→`platform` |
| Valor em lamports vs SOL | `send/page.tsx` | API esperava SOL (ex: 0.5), front enviava lamports (500000000) |
| Campo resposta errado | `send/page.tsx` | Esperava `txBase64`/`vaultId`, API retorna `transaction`/`vault` |
| vaultId como BigInt | `send/page.tsx` | Vault address é base58 string, não número |
| APP_URL sem protocolo | `.env.local` | Adicionado `https://` |
| HELIUS_API_KEY com URL | `.env.local` | Extraída só a chave `e657af06...` |
| Layout mobile invadindo landing | `app/layout.tsx` | Criado route group `(app)/layout.tsx` — landing é full-width |
