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
      className="p-1.5 rounded-lg glass text-white/60 hover:text-white transition-colors"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-solana-green" />
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
      className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors ${
        danger ? "text-red-400" : "text-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`${danger ? "text-red-400" : "text-white/60"}`}>
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
        {badge && (
          <span className="text-[10px] bg-solana-purple/20 text-solana-purple px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {value ? (
        <span className="text-white/40 text-xs font-mono truncate max-w-[140px]">
          {value}
        </span>
      ) : (
        <ChevronRight className="w-4 h-4 text-white/20" />
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
    <main className="relative min-h-dvh flex flex-col pb-32 bg-[#08080E] overflow-hidden">
      {/* Ambient orb */}
      <div className="pointer-events-none absolute -top-16 right-0 w-72 h-72 bg-solana-purple/10 rounded-full blur-[120px]" />

      {/* Header */}
      <div className="relative z-10 px-5 pt-14 pb-5">
        <h1 className="font-display text-2xl font-bold text-white">
          Configurações
        </h1>
        <p className="text-white/40 text-sm mt-1">Perfil e preferências</p>
      </div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-5 mb-5 glass-card rounded-3xl p-5 overflow-hidden"
      >
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-solana-purple/15 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-black shrink-0"
            style={{
              padding: "2px",
              background: "linear-gradient(135deg, #9945FF 0%, #14F195 100%)",
            }}
          >
            <div
              className="w-full h-full rounded-[14px] flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #9945FF 0%, #14F195 100%)",
              }}
            >
              {displayName[0]?.toUpperCase() ?? "U"}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{displayName}</p>
            {email && (
              <p className="text-white/40 text-xs mt-0.5 truncate">{email}</p>
            )}
          </div>
        </div>

        {/* Linked platforms */}
        <div className="relative">
          <p className="text-white/30 text-xs mb-2 uppercase tracking-wider">
            Contas vinculadas
          </p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(PLATFORMS) as PlatformKey[]).map((key) => {
              const p = PLATFORMS[key];
              const linked = key === "twitter" && twitterHandle;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                    linked
                      ? "bg-white/10 text-white border border-white/10"
                      : "glass text-white/40"
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{linked ? `@${twitterHandle}` : p.label}</span>
                  {linked && (
                    <Check className="w-3 h-3 text-solana-green ml-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Wallet group */}
      <div className="relative z-10 mx-5 mb-5">
        <p className="text-white/40 text-xs font-semibold mb-2 px-1 uppercase tracking-wider">
          Carteira
        </p>
        <div className="glass-card rounded-2xl overflow-hidden">
          {address && (
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-white/60 shrink-0">
                  <Shield className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium">
                    Embedded Wallet
                  </p>
                  <p className="text-white/40 text-xs font-mono mt-0.5 truncate">
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
                  className="p-1.5 rounded-lg glass text-white/60 hover:text-white transition-colors"
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
        <p className="text-white/40 text-xs font-semibold mb-2 px-1 uppercase tracking-wider">
          App
        </p>
        <div className="glass-card rounded-2xl overflow-hidden">
          <SettingRow
            icon={<Globe className="w-4 h-4" />}
            label="Idioma"
            value="Português"
            onClick={() => {}}
          />
          <div className="border-t border-white/5">
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
          <p className="text-white/40 text-xs font-semibold mb-2 px-1 uppercase tracking-wider">
            Meu link de recebimento
          </p>
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
            <p className="text-white/70 text-xs font-mono truncate flex-1">
              paganno.at/claim/{address.slice(0, 8)}...
            </p>
            <CopyButton text={`https://paganno.at/claim/wallet/${address}`} />
          </div>
          <p className="text-white/30 text-xs mt-2 px-1">
            Compartilhe para receber pagamentos sem login
          </p>
        </div>
      )}

      {/* Logout */}
      <div className="relative z-10 mx-5">
        <div className="glass-card rounded-2xl overflow-hidden border-red-500/20">
          <SettingRow
            icon={<LogOut className="w-4 h-4" />}
            label="Sair da conta"
            danger
            onClick={handleLogout}
          />
        </div>
      </div>

      {/* Version */}
      <p className="relative z-10 text-center text-white/20 text-xs mt-6">
        Paga no @ · v0.1.0 · Devnet
      </p>

      <BottomNav />
    </main>
  );
}
