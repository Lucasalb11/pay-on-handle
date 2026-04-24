# Pay on @ — Guia de Estado e Roadmap

> Atualizado: 2026-04-23 | Network: Devnet | Stack: Anchor 0.32 · Next.js 14 · Privy

---

## O que é

**Pay on @** é um protocolo de pagamentos Solana que permite enviar SOL/USDC para um @handle social (Instagram, Twitter/X, WhatsApp), sem o destinatário precisar ter carteira cripto. O dinheiro fica guardado num vault on-chain até o destinatário resgatar — seja direto em cripto ou convertido para BRL via PIX.

---

## Estado Atual

### Programas Solana — ✅ Funcionais no Devnet

| Programa | ID | Status |
|----------|----|--------|
| **Registry** | `AT8S64n...ZkvX` | ✅ Deployado e testado |
| **Vault** | `EgS854X...bPk` | ✅ Deployado e testado |
| **FeeCollector** | `CxMBNw...G6s` | ✅ Deployado |

**Registry** — mapeia `@handle + plataforma → carteira Solana`
- `initialize_config` ✅
- `register_handle` ✅ (proof é stub — qualquer byte não-vazio passa)
- `update_wallet` ✅
- `verify_handle` ✅

**Vault** — escrow de pagamentos com expiração de 7 dias
- `initialize_vault_config` ✅
- `create_sol_vault` ✅ (cobra 0.5% de taxa)
- `create_spl_vault` ✅
- `claim_sol_vault` ✅ (verifica HandleRecord PDA + destination_wallet)
- `claim_spl_vault` ✅
- `refund_sol_vault` ✅ (só após expiração, só remetente)
- `refund_spl_vault` ✅

**Testes existentes:** `anchor test` cobre os fluxos SOL (create/claim/refund) e validações de segurança básicas.

---

### Frontend — Next.js 14 App Router

| Página | Status | Observação |
|--------|--------|------------|
| `/` — Landing | ✅ Funcional | Framer Motion, glassmorphism |
| `/wallet` — Dashboard | ✅ Funcional | Histórico é **mock** |
| `/send` — Envio | ✅ Funcional | 5 steps: handle → valor → privacidade → confirmar → sucesso |
| `/claim/[vaultId]` — Resgate | ✅ Funcional | Lê vault on-chain, valida hash client-side |
| `/settings` — Perfil | ✅ Funcional | Logout, exibe carteira |
| `/defi` — DeFi | ⚠️ UI apenas | Sem integração real com Kamino/Orca/Jito |

### API Routes

| Rota | Status | Observação |
|------|--------|------------|
| `POST /api/send` | ⚠️ Parcial | Monta tx SOL vault, mas ignora flag `private: true` |
| `POST /api/claim` | ✅ Funcional | Monta ClaimSolVault tx |
| `POST /api/claim-pix` | ⚠️ Parcial | Grava intenção PIX em **Map em memória** (perde ao reiniciar) |
| `GET /api/vault/[id]` | ✅ Funcional | Deserializa PaymentVault on-chain |
| `GET /api/prices` | ✅ Funcional | SOL/BRL via Binance + ExchangeRate (fallback estático) |
| `GET/POST /api/jupiter` | ✅ Funcional | Proxy para Jupiter Quote/Swap |
| `POST /api/webhooks/helius` | ⚠️ Parcial | Recebe eventos mas PIX não é despachado (OpenPix pendente) |

### SDK TypeScript

- `/sdk/src/` — accounts, constants, instructions, utils — ✅ criado, não publicado

### Infraestrutura

| Serviço | Status |
|---------|--------|
| Privy (auth + embedded wallet) | ✅ Configurado (Google/Apple) |
| Helius RPC | ✅ Configurado |
| Twitter OAuth no Privy | ❌ Não ativado |
| Upstash Redis | ❌ Não configurado |
| PostgreSQL (Neon/Supabase) | ❌ Não configurado |
| OpenPix/Woovi (PIX) | ❌ Não configurado |
| Cloak SDK (privacidade) | ❌ Não integrado |
| Deploy (Railway/Vercel) | ❌ Não feito |

---

## Issues de Segurança Abertas

| ID | Severidade | Descrição | Bloqueador? |
|----|-----------|-----------|-------------|
| C-2 | Crítico | Prova de handle é stub — `proof_data != empty` — qualquer byte passa | Pré-mainnet |
| H-1 | Alto | `fee_collector.withdraw_sol` sem guard de saldo (pode panic em release) | Pré-mainnet |
| M-1 | Médio | `create_spl_vault` aceita qualquer mint SPL (não só USDC) | Pré-mainnet |
| L-2 | Baixo | Vault PDAs não são fechados após claim/refund (rent não devolvido) | Pós-MVP |

> C-1 (open claim — qualquer um podia drenar qualquer vault) foi **corrigido** no audit de 22/04.

---

## O Que Falta Fazer

### 🔴 P0 — Bloqueadores do fluxo principal

#### 1. Inicializar VaultConfig no devnet
Antes de qualquer `create_sol_vault`, o PDA `vault_config` precisa existir na chain.
```bash
cd pay-on-handle
anchor run initialize --provider.cluster devnet
```

#### 2. Ativar Twitter OAuth no Privy
Sem isso, o usuário não consegue provar ownership do @handle e o claim falha.
- Criar Twitter App → OAuth 2.0 → callback: `https://auth.privy.io/api/v1/oauth/callback`
- Habilitar no dashboard Privy → Login Methods → Twitter/X

#### 3. Criar `POST /api/register-handle`
Hoje o claim falha porque o HandleRecord PDA do claimant não existe. É preciso:
1. Verificar JWT Privy (`PrivyClient.verifyAuthToken`)
2. Extrair handle verificado de `user.linkedAccounts`
3. Chamar `registry.register_handle` com `RELAYER_KEY` como payer
4. Chamar automaticamente após login em `providers.tsx`

Variáveis necessárias: `RELAYER_PRIVATE_KEY`, `PRIVY_APP_SECRET`

#### 4. Completar integração Cloak no `/api/send`
O frontend já envia `private: true`. O backend precisa:
- Instalar SDK Cloak (verificar `docs.cloak.ag`)
- Processar a flag e calcular `cloakFee = 0.005 SOL + 0.3%`
- Rotear via relay shielded quando `private: true`

---

### 🟡 P1 — Necessário para deploy funcional

#### 5. Migrar `pix-store.ts` para Redis
`Map` em memória perde tudo ao reiniciar (fatal em Vercel serverless). Usar `@upstash/redis` com TTL de 24h.

#### 6. Configurar Helius Webhook
1. Dashboard Helius → Webhooks → URL: `https://<dominio>/api/webhooks/helius`
2. Tipo: `PROGRAM_INTERACTION` → Address: vault program
3. Adicionar `HELIUS_WEBHOOK_SECRET` ao env

#### 7. Implementar despacho PIX no webhook
O webhook recebe o evento `VaultClaimed` mas não dispara o PIX. Falta:
- Integrar com OpenPix/Woovi API (requer CNPJ verificado)
- Fazer swap SOL → USDC via Jupiter antes de enviar para o provedor PIX

#### 8. Substituir histórico mock no `/wallet`
Usar Helius Enhanced Transactions API:
```
GET https://api.helius.xyz/v0/addresses/{address}/transactions?api-key=...
```

---

### 🟢 P2 — Hardening pré-mainnet

| Item | O que fazer |
|------|------------|
| **Fechar vault PDAs** (L-2) | Adicionar `close = sender` no constraint do claim/refund |
| **Whitelist de mints** (M-1) | Validar `mint == USDC_DEVNET \|\| USDC_MAINNET` em `create_spl_vault` |
| **Fix H-1** | Adicionar guard `lamports - rent_minimum` antes do `withdraw_sol` |
| **Proof real** (C-2) | Substituir stub por co-assinatura do relayer (curto prazo) ou zkProof OAuth JWT (longo prazo) |
| **Instagram OAuth** | Implementar Meta Login flow (`/api/auth/instagram/route.ts`) |
| **Dashboard /admin** | PostgreSQL (Neon) + webhook indexando eventos + página com métricas |
| **WhatsApp** | Normalizar número de telefone como handle (`+5511999999999`) |

---

## Roadmap

```
AGORA                CURTO PRAZO             MÉDIO PRAZO           MAINNET
  │                      │                       │                    │
  ▼                      ▼                       ▼                    ▼
[P0] Unlock          [P1] Deploy             [P2] Hardening      [Launch]
fluxo completo       funcional               + features
  │                      │                       │
  ├─ VaultConfig          ├─ Redis (pix-store)    ├─ Proof real (C-2)
  ├─ Twitter OAuth        ├─ Helius webhook       ├─ Close vault PDAs
  ├─ register-handle      ├─ PIX dispatch         ├─ Mint whitelist
  └─ Cloak backend        ├─ Wallet history real  ├─ Instagram OAuth
                          └─ Deploy Railway/Vercel └─ Dashboard /admin
```

### Fase 1 — Fluxo Principal Funcionando (P0)

**Meta**: conseguir fazer end-to-end no devnet: enviar para @handle → link de claim → resgatar.

1. `anchor run initialize --provider.cluster devnet` — inicializa VaultConfig e RegistryConfig
2. Ativar Twitter OAuth no dashboard Privy
3. Criar `POST /api/register-handle` com assinatura Privy
4. Chamar auto-registro em `providers.tsx` após login
5. Testar: login → send para @handle → abrir link → claim

Estimativa: **1–2 dias**

---

### Fase 2 — Deploy Funcional (P1)

**Meta**: app rodando em produção (Railway ou Vercel), fluxo completo acessível externamente.

1. Criar conta Upstash → migrar `pix-store.ts` para Redis
2. Configurar Helius webhook
3. Deploy Railway ou Vercel com todas as variáveis de ambiente
4. Substituir histórico mock pelo Helius Enhanced Transactions
5. (Opcional) Integrar OpenPix para despacho PIX real

Estimativa: **2–3 dias**

---

### Fase 3 — Hardening pré-mainnet (P2)

**Meta**: fechar issues de segurança e adicionar features que aumentam a utilidade.

1. Fix H-1 no fee-collector
2. Fechar vault PDAs após claim/refund (L-2)
3. Whitelist de mints USDC (M-1)
4. Prova de handle real: relayer co-assinatura via OAuth verificado
5. Instagram OAuth (Meta Login)
6. Dashboard `/admin` com métricas on-chain (PostgreSQL + Tremor)
7. WhatsApp via número de telefone normalizado

Estimativa: **1 semana**

---

### Fase 4 — Mainnet

**Pré-requisitos obrigatórios antes de qualquer mainnet deploy:**

- [ ] C-2 resolvido (proof de handle real, não stub)
- [ ] Audit externo dos programas
- [ ] `anchor build --verifiable` para verificação on-chain
- [ ] PIX funcional em produção (OpenPix/Woovi com CNPJ)
- [ ] Todos os testes passando (unit + integration + fuzz)
- [ ] Rate limits e quotas de serviços revistos para volume real

---

## Variáveis de Ambiente Necessárias

```bash
# Já configuradas
NEXT_PUBLIC_PRIVY_APP_ID=cmo0pavcd...
NEXT_PUBLIC_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=...
NEXT_PUBLIC_VAULT_PROGRAM_ID=EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H
NEXT_PUBLIC_REGISTRY_PROGRAM_ID=AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX
NEXT_PUBLIC_FEE_COLLECTOR_PROGRAM_ID=CxMBNwbovsvLTe7bSuca8X26WS7PW81VtDu3oLyfSG6s
HELIUS_API_KEY=e657af06...

# Faltam
RELAYER_PRIVATE_KEY=<bs58 keypair — paga txs de registro>
PRIVY_APP_SECRET=<dashboard Privy → API Keys>
HELIUS_WEBHOOK_SECRET=<gerar no dashboard Helius>
UPSTASH_REDIS_REST_URL=<upstash.com>
UPSTASH_REDIS_REST_TOKEN=<upstash.com>
CLOAK_API_KEY=<docs.cloak.ag>
OPENPIX_APP_ID=<openpix.com.br — requer CNPJ>
DATABASE_URL=<neon.tech ou supabase.com>
ADMIN_SECRET=<string aleatória para proteger /admin>
META_APP_ID=<developers.facebook.com — para Instagram>
META_APP_SECRET=<idem>
```

---

## Dependências entre Tarefas

```
Twitter OAuth
     │
     └──→ register-handle API ──→ Claim funciona ──→ PIX dispatch
                                        │
                                  VaultConfig init
                                  (necessário para send)

Redis migration ──→ Deploy funcional
       │
Helius webhook ──┘
```

O único **caminho crítico** para o fluxo completo funcionar localmente:

```
VaultConfig init → Twitter OAuth → register-handle → end-to-end test
```
