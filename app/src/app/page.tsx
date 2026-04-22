"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

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
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-solana-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <div className="text-6xl mb-4">🇧🇷</div>
        <h1 className="font-display text-4xl font-bold bg-gradient-solana bg-clip-text text-transparent">
          Paga no @
        </h1>
        <p className="text-white/50 mt-2 text-base">Um @, zero barreiras</p>
      </motion.div>

      {/* Value props */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full space-y-3 mb-12"
      >
        {[
          { icon: "⚡", text: "Envie crypto para qualquer @handle" },
          { icon: "🔒", text: "Sem wallet? Sem problema" },
          { icon: "💸", text: "Saque via PIX em segundos" },
          { icon: "🌐", text: "Instagram, X e WhatsApp" },
        ].map(({ icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-3 bg-bg-card border border-bg-border rounded-2xl px-4 py-3"
          >
            <span className="text-xl">{icon}</span>
            <span className="text-white/80 text-sm">{text}</span>
          </div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="w-full space-y-3"
      >
        <Button fullWidth size="lg" onClick={login}>
          Entrar com Google / Apple
        </Button>
        <p className="text-center text-white/30 text-xs">
          Powered by Solana · 0.5% fee · Sem custódia
        </p>
      </motion.div>
    </main>
  );
}
