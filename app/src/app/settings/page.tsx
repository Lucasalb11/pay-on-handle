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
import { Button } from "@/components/ui/button";
import { PLATFORMS, type PlatformKey } from "@/lib/constants";

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
      className="p-1.5 rounded-lg bg-bg-card border border-bg-border text-white/50 hover:text-white transition-colors"
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
      className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors
        ${danger ? "text-red-400" : "text-white"}`}
    >
      <div className="flex items-center gap-3">
        <span className={`${danger ? "text-red-400" : "text-white/50"}`}>
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
        <span className="text-white/30 text-xs font-mono truncate max-w-[120px]">
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
    <main className="min-h-dvh flex flex-col pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="font-display text-2xl font-bold text-white">
          Configurações
        </h1>
      </div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-5 mb-6 bg-bg-card border border-bg-border rounded-3xl p-5"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-solana-purple to-solana-green flex items-center justify-center text-2xl font-bold text-black">
            {displayName[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <p className="text-white font-semibold">{displayName}</p>
            {email && <p className="text-white/40 text-xs mt-0.5">{email}</p>}
          </div>
        </div>

        {/* Linked platforms */}
        <div>
          <p className="text-white/30 text-xs mb-2">Contas vinculadas</p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(PLATFORMS) as PlatformKey[]).map((key) => {
              const p = PLATFORMS[key];
              const linked = key === "twitter" && twitterHandle;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                    ${
                      linked
                        ? "bg-white/10 text-white"
                        : "bg-white/5 text-white/30"
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

      {/* Wallet section */}
      <div className="mx-5 mb-4">
        <p className="text-white/30 text-xs font-medium mb-2 px-1">CARTEIRA</p>
        <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
          {address && (
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-bg-border">
              <div className="flex items-center gap-3">
                <span className="text-white/50">
                  <Shield className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-white text-sm font-medium">
                    Embedded Wallet
                  </p>
                  <p className="text-white/30 text-xs font-mono mt-0.5">
                    {address.slice(0, 8)}...{address.slice(-8)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <CopyButton text={address} />
                <a
                  href={`https://solscan.io/account/${address}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-bg-card border border-bg-border text-white/50 hover:text-white transition-colors"
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

      {/* App section */}
      <div className="mx-5 mb-4">
        <p className="text-white/30 text-xs font-medium mb-2 px-1">APP</p>
        <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden">
          <SettingRow
            icon={<Globe className="w-4 h-4" />}
            label="Idioma"
            value="Português"
            onClick={() => {}}
          />
          <div className="border-t border-bg-border">
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
        <div className="mx-5 mb-4">
          <p className="text-white/30 text-xs font-medium mb-2 px-1">
            MEU LINK DE RECEBIMENTO
          </p>
          <div className="bg-bg-card border border-bg-border rounded-2xl p-4 flex items-center justify-between gap-3">
            <p className="text-white/60 text-xs font-mono truncate flex-1">
              paganno.at/claim/{address.slice(0, 8)}...
            </p>
            <CopyButton text={`https://paganno.at/claim/wallet/${address}`} />
          </div>
          <p className="text-white/25 text-xs mt-2 px-1">
            Compartilhe para receber pagamentos sem login
          </p>
        </div>
      )}

      {/* Logout */}
      <div className="mx-5 mt-2">
        <div className="bg-bg-card border border-red-500/20 rounded-2xl overflow-hidden">
          <SettingRow
            icon={<LogOut className="w-4 h-4" />}
            label="Sair da conta"
            danger
            onClick={handleLogout}
          />
        </div>
      </div>

      {/* Version */}
      <p className="text-center text-white/20 text-xs mt-6">
        Paga no @ · v0.1.0 · Devnet
      </p>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto">
        <div className="bg-bg/80 backdrop-blur-xl border-t border-bg-border px-5 py-3 flex justify-around">
          {[
            { label: "Carteira", icon: "💰", href: "/wallet", active: false },
            { label: "Enviar", icon: "📤", href: "/send", active: false },
            { label: "DeFi", icon: "📈", href: "/defi", active: false },
            { label: "Config", icon: "⚙️", href: "/settings", active: true },
          ].map(({ label, icon, href, active }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all
                ${active ? "text-solana-purple" : "text-white/30"}`}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
