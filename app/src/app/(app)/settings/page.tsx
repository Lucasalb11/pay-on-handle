"use client";

import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  ExternalLink,
  LogOut,
  ChevronRight,
  Bell,
  Shield,
  Globe,
  Code,
} from "lucide-react";
import { PLATFORMS, type PlatformKey } from "@/lib/constants";
import { BottomNav } from "@/components/BottomNav";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="Copiar"
      className="p-1.5 rounded-lg bg-brand-beige-dark border border-brand-border text-brand-muted hover:text-brand-ink transition-colors"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

type RowProps = {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  badge?: string;
};

function SettingRow({ icon, label, value, onClick, danger, badge }: RowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-brand-beige transition-colors ${
        danger ? "text-red-500" : "text-brand-ink"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`${danger ? "text-red-400" : "text-brand-muted"}`}>
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
        {badge && (
          <span className="text-[10px] bg-brand-purple/15 text-brand-purple px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {value ? (
        <span className="text-brand-muted text-xs font-mono truncate max-w-[140px]">
          {value}
        </span>
      ) : (
        <ChevronRight className="w-4 h-4 text-brand-muted/50" />
      )}
    </button>
  );
}

export default function SettingsPage() {
  const { ready, authenticated, logout, user } = usePrivy();
  const { wallets } = useSolanaWallets();
  const router = useRouter();

  const wallet = wallets[0];
  const address = wallet?.address;

  useEffect(() => {
    if (ready && !authenticated) router.replace("/");
  }, [ready, authenticated, router]);

  const linkedAccounts = user?.linkedAccounts ?? [];
  const email = linkedAccounts.find((a) => a.type === "email")?.address;
  const twitterHandle = linkedAccounts.find(
    (a) => a.type === "twitter_oauth"
  )?.username;
  const googleEmail = linkedAccounts.find(
    (a) => a.type === "google_oauth"
  )?.email;

  const displayName = twitterHandle
    ? `@${twitterHandle}`
    : googleEmail ?? email ?? "Usuário";

  async function handleLogout() {
    await logout();
    router.replace("/");
  }

  return (
    <main className="relative min-h-dvh flex flex-col pb-32 bg-brand-beige overflow-hidden">
      {/* Ambient orb */}
      <div className="pointer-events-none absolute -top-16 right-0 w-72 h-72 bg-brand-purple/8 rounded-full blur-[120px]" />

      {/* Header */}
      <div className="relative z-10 px-5 pt-14 pb-5">
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Configurações
        </h1>
        <p className="text-brand-muted text-sm mt-1">Perfil e preferências</p>
      </div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-5 mb-5 glass-card rounded-3xl p-5 overflow-hidden"
      >
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-brand-orange/10 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0"
            style={{
              background: "linear-gradient(135deg, #FF6B2B 0%, #9945FF 100%)",
            }}
          >
            {displayName[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            <p className="text-brand-ink font-semibold truncate">
              {displayName}
            </p>
            {email && (
              <p className="text-brand-muted text-xs mt-0.5 truncate">
                {email}
              </p>
            )}
          </div>
        </div>

        {/* Linked platforms */}
        <div className="relative">
          <p className="text-brand-muted text-xs mb-2 uppercase tracking-wider">
            Contas vinculadas
          </p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(PLATFORMS) as PlatformKey[]).map((key) => {
              const p = PLATFORMS[key];
              const linked = key === "twitter" && twitterHandle;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                    linked
                      ? "bg-brand-purple-muted text-brand-ink border-brand-border"
                      : "bg-brand-beige-dark text-brand-muted border-brand-border"
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{linked ? `@${twitterHandle}` : p.label}</span>
                  {linked && (
                    <Check className="w-3 h-3 text-emerald-500 ml-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Wallet group */}
      <div className="relative z-10 mx-5 mb-5">
        <p className="text-brand-muted text-xs font-semibold mb-2 px-1 uppercase tracking-wider">
          Carteira
        </p>
        <div className="glass-card rounded-2xl overflow-hidden">
          {address && (
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-brand-border">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-brand-muted shrink-0">
                  <Shield className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-brand-ink text-sm font-medium">
                    Embedded Wallet
                  </p>
                  <p className="text-brand-muted text-xs font-mono mt-0.5 truncate">
                    {address.slice(0, 8)}...{address.slice(-8)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <CopyButton text={address} />
                <a
                  href={`https://solscan.io/account/${address}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ver no Solscan"
                  className="p-1.5 rounded-lg bg-brand-beige-dark border border-brand-border text-brand-muted hover:text-brand-ink transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
          <SettingRow
            icon={<Bell className="w-4 h-4" />}
            label="Notificações de recebimento"
            badge="Em breve"
            onClick={() => {}}
          />
        </div>
      </div>

      {/* App group */}
      <div className="relative z-10 mx-5 mb-5">
        <p className="text-brand-muted text-xs font-semibold mb-2 px-1 uppercase tracking-wider">
          App
        </p>
        <div className="glass-card rounded-2xl overflow-hidden">
          <SettingRow
            icon={<Globe className="w-4 h-4" />}
            label="Idioma"
            value="Português"
            onClick={() => {}}
          />
          <div className="border-t border-brand-border">
            <SettingRow
              icon={<Code className="w-4 h-4" />}
              label="Rede"
              value="Devnet"
              onClick={() => {}}
            />
          </div>
        </div>
      </div>

      {/* Claim link */}
      {address && (
        <div className="relative z-10 mx-5 mb-5">
          <p className="text-brand-muted text-xs font-semibold mb-2 px-1 uppercase tracking-wider">
            Meu link de recebimento
          </p>
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
            <p className="text-brand-ink-soft text-xs font-mono truncate flex-1">
              paganno.at/claim/{address.slice(0, 8)}...
            </p>
            <CopyButton text={`https://paganno.at/claim/wallet/${address}`} />
          </div>
          <p className="text-brand-muted text-xs mt-2 px-1">
            Compartilhe para receber pagamentos sem login
          </p>
        </div>
      )}

      {/* Logout */}
      <div className="relative z-10 mx-5">
        <div className="bg-white border border-red-100 rounded-2xl overflow-hidden">
          <SettingRow
            icon={<LogOut className="w-4 h-4" />}
            label="Sair da conta"
            danger
            onClick={handleLogout}
          />
        </div>
      </div>

      {/* Version */}
      <p className="relative z-10 text-center text-brand-muted/50 text-xs mt-6">
        Paga no @ · v0.1.0 · Devnet
      </p>

      <BottomNav />
    </main>
  );
}
