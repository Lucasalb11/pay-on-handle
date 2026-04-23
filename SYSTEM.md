# Paga no @ — Visão Geral do Sistema

> Última atualização: 2026-04-23
> Network: **Devnet**
> Stack: Anchor 0.32 · Next.js 14 · Privy · Helius RPC

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
| `/` | Landing — login Google/Apple via Privy | ✅ funcional |
| `/wallet` | Dashboard — saldo SOL + atalhos | ✅ funcional (atividade mock) |
| `/send` | Fluxo envio em 4 steps (handle → amount → confirm → success) | ✅ funcional |
| `/claim/[vaultId]` | Resgatar pagamento (crypto ou PIX) | ✅ funcional |
| `/defi` | Estratégias DeFi (UI mockada) | ⚠️ UI apenas, sem integração real |
| `/settings` | Perfil, carteira, logout | ✅ funcional |

### API Routes

| Rota | Método | Descrição | Status |
|------|--------|-----------|--------|
| `/api/send` | POST | Monta `CreateSolVault` tx para o cliente assinar | ✅ funcional |
| `/api/claim` | POST | Monta `ClaimSolVault/Spl` tx | ✅ funcional |
| `/api/claim-pix` | POST | Monta claim tx + grava intenção PIX em memória | ⚠️ PIX em memória volátil |
| `/api/vault/[vaultId]` | GET | Deserializa `PaymentVault` on-chain | ✅ funcional |
| `/api/prices` | GET | Cotação SOL/USD/BRL (Binance + exchangerate) | ✅ funcional (fallback estático) |
| `/api/jupiter` | GET/POST | Proxy para Jupiter Quote/Swap API | ✅ funcional |
| `/api/webhooks/helius` | POST | Recebe eventos Anchor, dispara PIX se VaultClaimed | ⚠️ store volátil, OpenPix pendente |

---

## Fluxo Principal: Enviar Pagamento

```
1. Usuário digita @handle + plataforma
2. Usuário digita valor (SOL)
3. Confirma → POST /api/send {sender, platform, handle, amountSol}
4. API:
   a. Lê nonce atual do sender na chain
   b. Computa hash SHA-256 do handle
   c. Monta instrução CreateSolVault
   d. Retorna tx serializada (não assinada) + endereço vault
5. Frontend pede assinatura ao Privy embedded wallet
6. Frontend submete tx assinada via RPC
7. Aguarda confirmação
8. Exibe link de claim: {APP_URL}/claim/{vault_address}
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

## Integrations

| Serviço | Uso | Config |
|---------|-----|--------|
| **Privy** | Auth social (Google/Apple/Twitter) + embedded wallet Solana | `NEXT_PUBLIC_PRIVY_APP_ID` |
| **Helius RPC** | RPC devnet (rate limits altos) + webhooks de eventos | `NEXT_PUBLIC_RPC_ENDPOINT`, `HELIUS_API_KEY` |
| **Jupiter** | Proxy para quotes e swaps SOL↔USDC (futuro PIX) | sem chave — API pública |
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
- Landing page (login Privy)
- Wallet dashboard (saldo via RPC, preço SOL)
- Navegação por abas
- Página de settings (perfil, carteira, logout)
- DeFi page (UI de estratégias — sem integração real)
- Claim page — leitura de vault on-chain, validação de hash client-side

### ✅ Build
- `next build` passa sem erros
- `output: 'standalone'` configurado em `next.config.mjs`
- TypeScript sem erros

---

## Próximos Passos Detalhados

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

### 🟡 P1 — Necessário para deploy funcional

---

#### 4. Configurar Helius Webhook

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

#### 5. Migrar pix-store.ts para Redis

`pix-store.ts` usa `Map` em memória — perde tudo ao reiniciar ou em serverless.

**Com Upstash Redis (Vercel) ou Railway Redis:**

```bash
# Instalar
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

#### 6. Buscar histórico real no /wallet

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

#### 7. Fechar vault PDAs após claim/refund (L-2)

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

#### 8. Whitelist de mints em CreateSplVault (M-1)

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

#### 9. Instagram OAuth — Meta Graph API

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

### Passos

**1. Criar projeto no Railway**
```
railway.app → New Project → Deploy from GitHub Repo
```

**2. Configurar serviço Next.js**
- Root Directory: `pay-on-handle/app`
- Build Command: `npm run build`
- Start Command: `node .next/standalone/server.js`
- Ou usar Dockerfile abaixo

**3. Adicionar serviço Redis**
```
New → Database → Add Redis
```
Railway injeta `REDIS_URL` automaticamente no serviço Next.js.

**4. Criar `app/Dockerfile`** (opcional, mais controle)
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

**5. Variáveis de ambiente** (Railway → Variables tab)
```bash
NEXT_PUBLIC_PRIVY_APP_ID=cmo0pavcd00860cjp0engxymy
NEXT_PUBLIC_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=e657af06-55cf-4b04-bb72-09909232d6c4
NEXT_PUBLIC_VAULT_PROGRAM_ID=EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H
NEXT_PUBLIC_REGISTRY_PROGRAM_ID=AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX
NEXT_PUBLIC_FEE_COLLECTOR_PROGRAM_ID=CxMBNwbovsvLTe7bSuca8X26WS7PW81VtDu3oLyfSG6s
NEXT_PUBLIC_APP_URL=https://pay-on-handle-production-70a5.up.railway.app
RELAYER_PRIVATE_KEY=<bs58 — NÃO commitar>
PRIVY_APP_SECRET=<do dashboard Privy>
HELIUS_API_KEY=e657af06-55cf-4b04-bb72-09909232d6c4
HELIUS_WEBHOOK_SECRET=<gerar no dashboard Helius>
OPENPIX_APP_ID=<Woovi — pendente>
# REDIS_URL é injetado automaticamente pelo Railway Redis
```

**6. Domínio customizado** (opcional)
- Railway → Settings → Domains → Add Custom Domain
- Atualizar `NEXT_PUBLIC_APP_URL` e `META_REDIRECT_URI`

---

## Deploy: Vercel

### Pré-requisitos
- `output: 'standalone'` já está configurado ✅
- Repositório no GitHub

### Passos

**1. Importar projeto**
```
vercel.com/new → Import Git Repository
```

**2. Configurar projeto**
- Framework Preset: **Next.js** (auto-detectado)
- Root Directory: `pay-on-handle/app`
- Build Command: `npm run build` (padrão)
- Output Directory: `.next` (padrão)

**3. Adicionar integrações (Vercel Dashboard → Integrations)**
- **Upstash Redis** — para pix-store persistente
  - Vercel Marketplace → Upstash → Connect → cria banco e injeta env vars automaticamente:
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
| `OPENPIX_APP_ID` | Secret | `<Woovi — pendente>` |

**5. Deploy**
```bash
# Via CLI
npm i -g vercel
cd pay-on-handle/app
vercel --prod

# Ou push para o branch main — Vercel auto-deploya
```

**6. Atualizar Helius webhook URL** após deploy:
```
Dashboard Helius → seu webhook → URL: https://pay-on-handle.vercel.app/api/webhooks/helius
```

**Limitação importante:** Vercel serverless functions têm cold starts e são stateless. O `pix-store.ts` com `Map` em memória **não funciona** — a integração Upstash Redis (passo 3) é obrigatória antes de ativar o fluxo PIX.

---

## Checklist de Deploy (ordem de execução)

```
[ ] 1. anchor build && anchor test (programas passando)
[ ] 2. Verificar/inicializar VaultConfig no devnet (script migrate)
[ ] 3. npm run build no /app (zero erros TypeScript)
[ ] 4. Configurar variáveis de ambiente no Railway ou Vercel
[ ] 5. Ativar Twitter OAuth no dashboard Privy
[ ] 6. Criar RELAYER_PRIVATE_KEY (solana-keygen new) e fazer airdrop devnet
[ ] 7. Deploy Railway ou Vercel
[ ] 8. Atualizar NEXT_PUBLIC_APP_URL para o domínio final
[ ] 9. Criar Helius webhook apontando para o domínio final
[ ] 10. Adicionar HELIUS_WEBHOOK_SECRET ao env do deploy
[ ] 11. (Opcional) Adicionar Upstash Redis para PIX store
[ ] 12. Testar fluxo completo: send → claim → claim link acessível externamente
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
