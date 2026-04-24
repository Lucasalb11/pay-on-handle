"use client";

import { useRouter, usePathname } from "next/navigation";
import { Wallet, Send, TrendingUp, User } from "lucide-react";

type Tab = {
  label: string;
  href: string;
  Icon: typeof Wallet;
};

const TABS: Tab[] = [
  { label: "Carteira", href: "/wallet", Icon: Wallet },
  { label: "Enviar", href: "/send", Icon: Send },
  { label: "DeFi", href: "/defi", Icon: TrendingUp },
  { label: "Perfil", href: "/settings", Icon: User },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto z-40">
      <div className="mx-4 mb-6 glass-nav rounded-2xl px-2 py-2 flex justify-around">
        {TABS.map(({ label, href, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all ${
                active
                  ? "bg-brand-orange/15 text-brand-orange"
                  : "text-brand-muted hover:text-brand-ink-soft"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
