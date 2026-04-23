"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const PROTOCOLS = ["Jupiter", "Kamino", "Orca", "Jito", "PIX"];

const FEATURES = [
  { icon: "⚡", text: "Envie crypto para qualquer @handle" },
  { icon: "🔒", text: "Sem wallet? Sem problema" },
  { icon: "💸", text: "Saque via PIX em segundos" },
  { icon: "🌐", text: "Instagram, X e WhatsApp" },
];

export default function HomePage() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      router.replace("/wallet");
    }
  }, [ready, authenticated, router]);

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#08080E]">
        <div className="w-8 h-8 border-2 border-solana-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-between px-6 pt-16 pb-12 overflow-hidden bg-[#08080E]">
      {/* Ambient orbs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        className="pointer-events-none absolute -top-20 -left-20 w-80 h-80 rounded-full bg-solana-purple/25 blur-[120px]"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.2 }}
        className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-solana-green/15 blur-[140px]"
      />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-glow"
          style={{
            background: "linear-gradient(135deg, #9945FF 0%, #14F195 100%)",
          }}
        >
          <span className="font-display text-5xl font-bold text-black leading-none">
            @
          </span>
        </div>
        <h1 className="font-display text-[48px] leading-none font-bold text-white tracking-tight">
          Paga no @
        </h1>
        <p className="text-white/50 mt-3 text-base">Um @, zero barreiras</p>

        {/* Protocol pills */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } },
          }}
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
        >
          {PROTOCOLS.map((p) => (
            <motion.span
              key={p}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 },
              }}
              className="glass rounded-full px-3 py-1.5 text-white/50 text-xs"
            >
              {p}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>

      {/* Features */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } },
        }}
        className="relative z-10 w-full space-y-3 my-10"
      >
        {FEATURES.map(({ icon, text }) => (
          <motion.div
            key={text}
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0 },
            }}
            className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3"
          >
            <span className="text-xl" aria-hidden>
              {icon}
            </span>
            <span className="text-white/80 text-sm">{text}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
        className="relative z-10 w-full space-y-3"
      >
        <Button
          fullWidth
          size="lg"
          onClick={login}
          className="gradient-btn shadow-glow"
        >
          Entrar com Google / Apple
        </Button>
        <p className="text-center text-white/30 text-xs">
          Powered by Solana · 0.5% fee · Sem custódia
        </p>
      </motion.div>
    </main>
  );
}
