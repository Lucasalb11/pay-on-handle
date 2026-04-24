"use client";

import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Lock,
  CheckCircle2,
  Clock,
  Zap,
  Globe,
  Code2,
  Terminal,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ── Theme ─────────────────────────────────────────────────────────────────────

const D = {
  bg: "#050410",
  surface: "#0C0820",
  surfaceHigh: "#110E26",
  border: "rgba(153,69,255,0.12)",
  borderHover: "rgba(153,69,255,0.4)",
  text: "#EDE8FF",
  muted: "#7B6A9F",
  faint: "#2D2150",
  purple: "#9945FF",
  orange: "#FF6B2B",
  green: "#10B981",
  red: "#F87171",
  gradient: "linear-gradient(135deg, #FF6B2B 0%, #9945FF 100%)",
} as const;

const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: D.surface,
  border: `1px solid ${D.border}`,
  borderRadius: 16,
  ...extra,
});

// ── Utility Components ─────────────────────────────────────────────────────────

function FadeIn({
  children,
  delay = 0,
  className = "",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: D.gradient,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      {children}
    </span>
  );
}

function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        background: copied ? "rgba(16,185,129,0.1)" : "rgba(153,69,255,0.08)",
        border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : D.border}`,
        color: copied ? D.green : D.muted,
        padding: "6px 14px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        transition: "all 0.18s",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true });

  useEffect(() => {
    if (!inView) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inView, target, duration]);

  return { count, ref: containerRef };
}

function StatCard({
  value,
  label,
  prefix = "",
  suffix = "",
}: {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
}) {
  const { count, ref } = useCountUp(value);
  return (
    <div
      ref={ref}
      style={{ ...card(), padding: "28px 24px", textAlign: "center" }}
    >
      <p
        style={{
          fontSize: 36,
          fontWeight: 800,
          fontFamily: "'Space Grotesk', sans-serif",
          background: D.gradient,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1.1,
          marginBottom: 8,
        }}
      >
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </p>
      <p style={{ color: D.muted, fontSize: 13 }}>{label}</p>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{ ...card(), overflow: "hidden", cursor: "pointer" }}
      onClick={() => setOpen(!open)}
    >
      <div
        style={{
          padding: "18px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span style={{ color: D.text, fontSize: 14, fontWeight: 500 }}>
          {q}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={16} color={D.muted} />
        </motion.div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div
              style={{
                padding: "16px 24px 20px",
                color: D.muted,
                fontSize: 13,
                lineHeight: 1.75,
                borderTop: `1px solid ${D.border}`,
              }}
            >
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Live Feed Data ─────────────────────────────────────────────────────────────

const FEED = [
  {
    handle: "@v****k",
    platform: "𝕏",
    amount: "5 SOL",
    action: "vault created",
    badge: "new",
  },
  {
    handle: "@a****e",
    platform: "IG",
    amount: "100 USDC",
    action: "claimed",
    badge: "claimed",
  },
  {
    handle: "@m****s",
    platform: "WA",
    amount: "50 USDC",
    action: "vault created",
    badge: "new",
  },
  {
    handle: "@j****k",
    platform: "𝕏",
    amount: "25 SOL",
    action: "claimed",
    badge: "claimed",
  },
  {
    handle: "@p****o",
    platform: "IG",
    amount: "200 USDC",
    action: "vault created",
    badge: "new",
  },
  {
    handle: "@r****n",
    platform: "𝕏",
    amount: "10 USDC",
    action: "claimed",
    badge: "claimed",
  },
  {
    handle: "@c****a",
    platform: "WA",
    amount: "75 USDC",
    action: "vault created",
    badge: "new",
  },
  {
    handle: "@t****y",
    platform: "𝕏",
    amount: "1 SOL",
    action: "refunded",
    badge: "refunded",
  },
];

// ── Demo Card (Hero Animation) ─────────────────────────────────────────────────

const DEMO_STEPS = [
  { phase: "typing", text: "@satoshi", status: null },
  { phase: "confirm", text: "@satoshi", status: "Vault created on-chain" },
  { phase: "done", text: "@satoshi", status: "✓ Ready to claim" },
];

function DemoCard() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setStep((s) => (s + 1) % DEMO_STEPS.length),
      2600
    );
    return () => clearInterval(t);
  }, []);

  const current = DEMO_STEPS[step];

  return (
    <motion.div
      style={{
        ...card({ borderRadius: 20 }),
        padding: "28px",
        width: "100%",
        maxWidth: 340,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(153,69,255,0.08), transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: D.gradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          @
        </div>
        <span style={{ color: D.text, fontSize: 13, fontWeight: 600 }}>
          Send Payment
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: D.green,
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.25)",
            padding: "2px 8px",
            borderRadius: 20,
          }}
        >
          devnet live
        </span>
      </div>

      {/* Fields */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: D.surfaceHigh,
            border: `1px solid ${D.border}`,
            borderRadius: 10,
            padding: "12px 16px",
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: D.muted,
              marginBottom: 4,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            To
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AnimatePresence mode="wait">
              <motion.span
                key={current.text}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  color: D.text,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "monospace",
                }}
              >
                {current.text}
              </motion.span>
            </AnimatePresence>
            {current.phase === "typing" && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
                style={{ color: D.purple, fontSize: 15 }}
              >
                |
              </motion.span>
            )}
          </div>
          <p style={{ fontSize: 11, color: D.muted, marginTop: 2 }}>
            𝕏 Twitter · verified handle
          </p>
        </div>

        <div
          style={{
            background: D.surfaceHigh,
            border: `1px solid ${D.border}`,
            borderRadius: 10,
            padding: "12px 16px",
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: D.muted,
              marginBottom: 4,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Amount
          </p>
          <p style={{ color: D.text, fontSize: 15, fontWeight: 600 }}>
            100 USDC
          </p>
          <p style={{ fontSize: 11, color: D.muted, marginTop: 2 }}>
            ≈ $100.00 · 0.5% fee
          </p>
        </div>
      </div>

      {/* Status */}
      <AnimatePresence mode="wait">
        {current.status ? (
          <motion.div
            key={current.status}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              background:
                current.phase === "done"
                  ? "rgba(16,185,129,0.08)"
                  : "rgba(153,69,255,0.08)",
              border: `1px solid ${
                current.phase === "done"
                  ? "rgba(16,185,129,0.25)"
                  : "rgba(153,69,255,0.25)"
              }`,
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {current.phase === "done" ? (
              <CheckCircle2 size={14} color={D.green} />
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Clock size={14} color={D.purple} />
              </motion.div>
            )}
            <span
              style={{
                fontSize: 12,
                color: current.phase === "done" ? D.green : D.purple,
                fontWeight: 600,
              }}
            >
              {current.status}
            </span>
          </motion.div>
        ) : (
          <motion.button
            key="send-btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              width: "100%",
              background: D.gradient,
              border: "none",
              borderRadius: 10,
              padding: "12px",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            Send 100 USDC
            <ArrowRight size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Claim link */}
      <AnimatePresence>
        {current.phase === "done" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden", marginTop: 12 }}
          >
            <div
              style={{
                background: D.surfaceHigh,
                border: `1px solid ${D.border}`,
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: D.muted,
                  fontFamily: "monospace",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                payonhandle.com/claim/4aX9…
              </span>
              <Copy size={12} color={D.muted} style={{ flexShrink: 0 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function NavBar({ onLogin }: { onLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: scrolled ? "rgba(5,4,16,0.92)" : "rgba(5,4,16,0.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: scrolled
          ? `1px solid ${D.border}`
          : "1px solid transparent",
        transition: "all 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 32px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: D.gradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 900,
              color: "#fff",
              boxShadow: "0 0 20px rgba(153,69,255,0.35)",
            }}
          >
            @
          </div>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 17,
              color: D.text,
              letterSpacing: "-0.02em",
            }}
          >
            Pay on @
          </span>
        </div>

        {/* Nav links */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
            fontSize: 13,
            color: D.muted,
          }}
          className="hidden md:flex"
        >
          {[
            { label: "How it works", href: "#how-it-works" },
            { label: "Developers", href: "#developers" },
            { label: "Protocol", href: "#protocol" },
            { label: "Security", href: "#security" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{
                color: D.muted,
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = D.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = D.muted)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <a
            href="https://github.com/Lucasalb11/pay-on-handle"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5"
          >
            <button
              style={{
                background: "transparent",
                border: `1px solid ${D.border}`,
                color: D.muted,
                padding: "7px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = D.borderHover;
                e.currentTarget.style.color = D.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = D.border;
                e.currentTarget.style.color = D.muted;
              }}
            >
              GitHub
            </button>
          </a>
          <button
            onClick={onLogin}
            style={{
              background: D.gradient,
              border: "none",
              color: "#fff",
              padding: "8px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 0 24px rgba(153,69,255,0.3)",
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.boxShadow =
                "0 0 32px rgba(153,69,255,0.5)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.boxShadow =
                "0 0 24px rgba(153,69,255,0.3)")
            }
          >
            Launch App
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onLogin }: { onLogin: () => void }) {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "120px 32px 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background orbs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        style={{
          position: "absolute",
          top: "15%",
          left: "10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(153,69,255,0.12), transparent 70%)",
          pointerEvents: "none",
          filter: "blur(40px)",
        }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
        style={{
          position: "absolute",
          bottom: "10%",
          right: "8%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(255,107,43,0.1), transparent 70%)",
          pointerEvents: "none",
          filter: "blur(60px)",
        }}
      />

      {/* Dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(rgba(153,69,255,0.06) 1px, transparent 1px)`,
          backgroundSize: "36px 36px",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: 1120,
          width: "100%",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 64,
          position: "relative",
        }}
      >
        {/* Left: copy */}
        <div>
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              ...card({ borderRadius: 40, padding: "6px 16px" }),
              marginBottom: 32,
            }}
          >
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: D.orange,
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 12, color: D.orange, fontWeight: 600 }}>
              Colosseum Frontier Hackathon · Solana
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(48px, 7vw, 80px)",
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              color: D.text,
              marginBottom: 24,
            }}
          >
            Pay anyone.
            <br />
            Just their <GradientText>@</GradientText>.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            style={{
              color: D.muted,
              fontSize: 18,
              lineHeight: 1.65,
              maxWidth: 520,
              marginBottom: 40,
            }}
          >
            Send SOL or USDC to any{" "}
            <span style={{ color: D.text }}>X/Twitter</span>,{" "}
            <span style={{ color: D.text }}>Instagram</span>, or{" "}
            <span style={{ color: D.text }}>WhatsApp</span> handle. The
            recipient claims with one tap — no wallet required.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 56,
            }}
          >
            <button
              onClick={onLogin}
              style={{
                background: D.gradient,
                border: "none",
                color: "#fff",
                padding: "14px 28px",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 0 40px rgba(153,69,255,0.3)",
                transition: "box-shadow 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow =
                  "0 0 60px rgba(153,69,255,0.5)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow =
                  "0 0 40px rgba(153,69,255,0.3)")
              }
            >
              Start Sending
              <ArrowRight size={15} />
            </button>

            <a
              href="https://github.com/Lucasalb11/pay-on-handle"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button
                style={{
                  background: "transparent",
                  border: `1px solid ${D.border}`,
                  color: D.muted,
                  padding: "14px 28px",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = D.borderHover;
                  e.currentTarget.style.color = D.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = D.border;
                  e.currentTarget.style.color = D.muted;
                }}
              >
                View on GitHub
                <ExternalLink size={13} />
              </button>
            </a>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            style={{ display: "flex", flexWrap: "wrap", gap: 16 }}
          >
            {[
              { value: "0.5%", label: "Protocol fee" },
              { value: "7 days", label: "Claim window" },
              { value: "100%", label: "Non-custodial" },
              { value: "0", label: "Addresses needed" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  ...card({ borderRadius: 12, padding: "12px 20px" }),
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 20,
                    background: D.gradient,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    marginBottom: 2,
                  }}
                >
                  {s.value}
                </p>
                <p style={{ color: D.muted, fontSize: 11, fontWeight: 500 }}>
                  {s.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right: demo card */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{ flexShrink: 0 }}
          className="hidden lg:block"
        >
          <DemoCard />
        </motion.div>
      </div>
    </section>
  );
}

function LiveTicker() {
  return (
    <div
      style={{
        background: D.surfaceHigh,
        borderTop: `1px solid ${D.border}`,
        borderBottom: `1px solid ${D.border}`,
        padding: "10px 0",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Fade masks */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 80,
          background: `linear-gradient(to right, ${D.surfaceHigh}, transparent)`,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          background: `linear-gradient(to left, ${D.surfaceHigh}, transparent)`,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      <motion.div
        animate={{ x: [0, -1400] }}
        transition={{ repeat: Infinity, duration: 28, ease: "linear" }}
        style={{
          display: "flex",
          gap: 40,
          whiteSpace: "nowrap",
          paddingLeft: 40,
        }}
      >
        {[...FEED, ...FEED].map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color:
                  item.badge === "claimed"
                    ? D.green
                    : item.badge === "refunded"
                    ? D.red
                    : D.purple,
                background:
                  item.badge === "claimed"
                    ? "rgba(16,185,129,0.1)"
                    : item.badge === "refunded"
                    ? "rgba(248,113,113,0.1)"
                    : "rgba(153,69,255,0.1)",
                padding: "2px 8px",
                borderRadius: 20,
                fontWeight: 600,
                border: `1px solid ${
                  item.badge === "claimed"
                    ? "rgba(16,185,129,0.25)"
                    : item.badge === "refunded"
                    ? "rgba(248,113,113,0.25)"
                    : "rgba(153,69,255,0.25)"
                }`,
              }}
            >
              {item.action}
            </span>
            <span
              style={{
                color: D.text,
                fontSize: 12,
                fontFamily: "monospace",
                fontWeight: 600,
              }}
            >
              {item.handle}
            </span>
            <span style={{ color: D.muted, fontSize: 11 }}>
              {item.platform} · {item.amount}
            </span>
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: D.faint,
                display: "inline-block",
              }}
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function EcoBar() {
  const partners = [
    { name: "Solana", role: "Blockchain Layer" },
    { name: "Anchor", role: "On-chain Programs" },
    { name: "Privy", role: "Embedded Wallets" },
    { name: "Jupiter", role: "Swap Routing" },
    { name: "Helius", role: "RPC & Webhooks" },
    { name: "Kamino", role: "Yield (roadmap)" },
    { name: "Cloak", role: "Privacy Layer" },
  ];

  return (
    <div
      style={{
        padding: "48px 32px",
        borderBottom: `1px solid ${D.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
        }}
      >
        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: D.muted,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 28,
          }}
        >
          Powered by
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "12px 40px",
          }}
        >
          {partners.map((p) => (
            <div key={p.name} style={{ textAlign: "center" }}>
              <p
                style={{
                  color: D.text,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                }}
              >
                {p.name}
              </p>
              <p style={{ color: D.muted, fontSize: 10, marginTop: 2 }}>
                {p.role}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Type a @handle",
      desc: "Enter any X/Twitter, Instagram or WhatsApp handle. No wallet address needed — just the social identity.",
      color: D.purple,
    },
    {
      n: "02",
      title: "Vault created on-chain",
      desc: "The Vault Program on Solana creates a PaymentVault PDA with 7-day expiry. The handle is stored as SHA-256 hash — zero personal data on-chain.",
      color: D.orange,
    },
    {
      n: "03",
      title: "Share the claim link",
      desc: "Recipient gets a link — via DM, email, or any channel. They don't need a wallet or even know anything about crypto.",
      color: D.purple,
    },
    {
      n: "04",
      title: "Claim via OAuth",
      desc: "Recipient logs in with their social account. The program verifies the handle hash and releases funds directly to their embedded wallet.",
      color: D.orange,
    },
  ];

  return (
    <section id="how-it-works" style={{ padding: "100px 32px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <FadeIn style={{ textAlign: "center", marginBottom: 64 }}>
          <p
            style={{
              color: D.orange,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 16,
            }}
          >
            How it works
          </p>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              color: D.text,
              letterSpacing: "-0.03em",
              marginBottom: 16,
            }}
          >
            Four steps. Zero addresses.
          </h2>
          <p
            style={{
              color: D.muted,
              fontSize: 16,
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            The sender doesn't need the recipient's wallet. The recipient
            doesn't need a wallet at all.
          </p>
        </FadeIn>

        {/* Flow diagram */}
        <FadeIn delay={0.1} style={{ marginBottom: 48 }}>
          <div
            style={{
              ...card({ borderRadius: 20, padding: "24px 32px" }),
              overflowX: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                minWidth: 560,
              }}
            >
              {[
                { label: "Sender", sub: "Sends 100 USDC → @alice" },
                { label: "Vault Program", sub: "Escrow PDA created" },
                { label: "@alice", sub: "Receives claim link" },
                { label: "OAuth Verify", sub: "Identity confirmed" },
                { label: "Funds Released", sub: "100 USDC → @alice wallet" },
              ].map((node, i) => (
                <div
                  key={node.label}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: i < 3 ? D.purple : D.orange,
                        margin: "0 auto 8px",
                      }}
                    />
                    <p
                      style={{
                        color: D.text,
                        fontSize: 11,
                        fontWeight: 700,
                        maxWidth: 80,
                      }}
                    >
                      {node.label}
                    </p>
                    <p
                      style={{
                        color: D.muted,
                        fontSize: 10,
                        marginTop: 3,
                        maxWidth: 80,
                      }}
                    >
                      {node.sub}
                    </p>
                  </div>
                  {i < 4 && (
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        minWidth: 20,
                        background: `linear-gradient(to right, ${
                          i < 2 ? D.purple : D.orange
                        }, ${i < 2 ? D.orange : D.orange})`,
                        opacity: 0.3,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {steps.map((s, i) => (
            <FadeIn key={s.n} delay={i * 0.08}>
              <div style={{ ...card({ borderRadius: 16, padding: "24px" }) }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    fontFamily: "monospace",
                    color: s.color,
                    background: `${s.color}15`,
                    border: `1px solid ${s.color}30`,
                    padding: "3px 10px",
                    borderRadius: 20,
                    display: "inline-block",
                    marginBottom: 16,
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.n}
                </div>
                <h3
                  style={{
                    color: D.text,
                    fontSize: 15,
                    fontWeight: 700,
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ color: D.muted, fontSize: 13, lineHeight: 1.65 }}>
                  {s.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [
    {
      icon: "👤",
      title: "P2P Payments",
      desc: "Pay friends, split bills, tip creators — just type their @handle. No wallet address, no copy-paste errors.",
      tag: "Consumer",
    },
    {
      icon: "💼",
      title: "Payroll & Teams",
      desc: "Pay contributors by their Twitter or WhatsApp. Automated vaults, weekly or monthly cadence.",
      tag: "Business",
    },
    {
      icon: "🌍",
      title: "Cross-border",
      desc: "Send to anyone in the world. Off-ramp to local currency via PIX (Brazil), M-Pesa, and more on the roadmap.",
      tag: "Global",
    },
    {
      icon: "🤖",
      title: "AI Agents",
      desc: "One SDK function call. Let AI agents send payments without managing wallet addresses or complex signing flows.",
      tag: "Developers",
    },
    {
      icon: "📈",
      title: "Yield on Escrow",
      desc: "Funds in pending vaults earn yield via Kamino Finance. Value accrues to the recipient while they sleep.",
      tag: "DeFi",
    },
    {
      icon: "🔒",
      title: "Private Transfers",
      desc: "Optional Cloak relay mode shields the sender-recipient link on-chain. No trace on explorer.",
      tag: "Privacy",
    },
  ];

  return (
    <section
      style={{
        padding: "100px 32px",
        background: "rgba(12,8,32,0.5)",
        borderTop: `1px solid ${D.border}`,
        borderBottom: `1px solid ${D.border}`,
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <FadeIn style={{ textAlign: "center", marginBottom: 64 }}>
          <p
            style={{
              color: D.purple,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 16,
            }}
          >
            Use cases
          </p>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              color: D.text,
              letterSpacing: "-0.03em",
              marginBottom: 16,
            }}
          >
            Everything in a @
          </h2>
          <p
            style={{
              color: D.muted,
              fontSize: 16,
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            From P2P to enterprise payroll. From AI agents to global
            remittances.
          </p>
        </FadeIn>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {cases.map((c, i) => (
            <FadeIn key={c.title} delay={i * 0.07}>
              <div
                style={{
                  ...card({ borderRadius: 16, padding: "28px" }),
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = D.borderHover)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = D.border)
                }
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 24,
                      lineHeight: 1,
                      padding: "10px",
                      background: "rgba(153,69,255,0.08)",
                      border: `1px solid ${D.border}`,
                      borderRadius: 12,
                    }}
                  >
                    {c.icon}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: D.orange,
                      background: "rgba(255,107,43,0.1)",
                      border: "1px solid rgba(255,107,43,0.25)",
                      padding: "3px 10px",
                      borderRadius: 20,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {c.tag}
                  </span>
                </div>
                <h3
                  style={{
                    color: D.text,
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {c.title}
                </h3>
                <p style={{ color: D.muted, fontSize: 13, lineHeight: 1.7 }}>
                  {c.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

const SDK_CODE = {
  quickstart: `import { PayOnHandle } from "@pay-on-handle/sdk";

// Initialize with your Solana connection
const protocol = new PayOnHandle(connection);

// Send to any social handle — 3 lines
const { claimUrl } = await protocol.send(
  "@alice",       // any X, Instagram or WhatsApp
  100,            // amount
  "USDC"          // SOL or USDC
);

// Share the link — recipient claims with their login
console.log(claimUrl);
// → "https://payonhandle.com/claim/4aXb9..."`,

  agent: `import { sendToHandle } from "@pay-on-handle/sdk";

// Register as an AI tool (Claude, GPT, any agent)
const tools = {
  send_payment: {
    description: "Send crypto to a social handle",
    parameters: { handle: "string", amount: "number" },
    execute: ({ handle, amount }) =>
      sendToHandle(handle, amount, connection),
  },
};

// Your agent can now transfer value to any @handle
// No wallet management. No address lookup.`,

  advanced: `const { vaultId, claimUrl, expiresAt } = await protocol.send(
  "@satoshi",
  100,
  "USDC",
  {
    platform: "instagram",   // twitter | instagram | whatsapp
    private: true,           // routed via Cloak relay
  }
);

// Poll vault status
const vault = await protocol.getVault(vaultId);
// vault.status → "pending" | "claimed" | "refunded"
// vault.expiresAt → Date

// Refund if unclaimed after 7 days
if (vault.status === "pending" && vault.expiresAt < new Date()) {
  await protocol.refund(vaultId);
}`,
};

const AI_CONTEXT = `# Pay on @ — SDK Integration Context

## What is Pay on @?
A Solana protocol for sending SOL or USDC to any social media handle (X/Twitter, Instagram, WhatsApp). The recipient doesn't need a wallet — funds are held in a non-custodial 7-day escrow vault and claimed via OAuth login.

## Installation
npm install @pay-on-handle/sdk

## Quick Start
import { PayOnHandle } from "@pay-on-handle/sdk";
const protocol = new PayOnHandle(connection);
const { claimUrl } = await protocol.send("@alice", 100, "USDC");

## One-liner for AI agents
import { sendToHandle } from "@pay-on-handle/sdk";
await sendToHandle("@alice", 100, connection);

## API Reference

### new PayOnHandle(connection, options?)
- connection: Solana Connection object
- options.appUrl?: string — override protocol base URL

### protocol.send(handle, amount, token, options?) → SendResult
- handle: "@alice" or "alice"
- amount: number (USDC amount, or SOL lamports if token = "SOL")
- token: "USDC" | "SOL"
- options.platform: "twitter" | "instagram" | "whatsapp" (default: "twitter")
- options.private: boolean — route via Cloak relay for privacy
- Returns: { vaultId, claimUrl, expiresAt, txSignature }

### protocol.getVault(vaultId) → VaultData | null
- Returns vault status, amount, expiry, recipient handle hash

### sendToHandle(handle, amount, connection, options?) → SendResult
- One-function API for simple integrations and AI tool-calling

## Types
type Platform = "twitter" | "instagram" | "whatsapp"
type Token = "SOL" | "USDC"
type VaultStatus = "pending" | "claimed" | "refunded"

## Protocol
- Vault Program: EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H (Devnet)
- Registry Program: AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX
- Fee: 0.5% on vault creation
- Escrow window: 7 days (configurable on mainnet)
- Handle stored as SHA-256 hash — no PII on-chain
`;

function SDKSection() {
  const [tab, setTab] = useState<"quickstart" | "agent" | "advanced">(
    "quickstart"
  );

  return (
    <section id="developers" style={{ padding: "100px 32px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "start",
          }}
        >
          {/* Left: copy */}
          <FadeIn>
            <p
              style={{
                color: D.orange,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 16,
              }}
            >
              Developers
            </p>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "clamp(28px, 3.5vw, 40px)",
                fontWeight: 800,
                color: D.text,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: 20,
              }}
            >
              One integration.
              <br />
              Every dApp.
            </h2>
            <p
              style={{
                color: D.muted,
                fontSize: 15,
                lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              The Pay on @ SDK is the simplest way to add handle-based payments
              to any Solana app. Three lines to send, one line for AI agents.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                marginBottom: 40,
              }}
            >
              {[
                {
                  icon: <Terminal size={16} />,
                  title: "npm install @pay-on-handle/sdk",
                  sub: "Zero peer dependencies. Works with any Solana stack.",
                },
                {
                  icon: <Code2 size={16} />,
                  title: "Full TypeScript support",
                  sub: "Typed API, Anchor IDL types, and React hooks included.",
                },
                {
                  icon: <Zap size={16} />,
                  title: "AI-native design",
                  sub: "One-function API for tool-calling agents. Claude, GPT-4, Gemini ready.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "rgba(153,69,255,0.1)",
                      border: `1px solid ${D.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: D.purple,
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <p
                      style={{
                        color: D.text,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        marginBottom: 4,
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      style={{ color: D.muted, fontSize: 12, lineHeight: 1.6 }}
                    >
                      {item.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href="https://github.com/Lucasalb11/pay-on-handle"
                target="_blank"
                rel="noopener noreferrer"
              >
                <button
                  style={{
                    background: D.gradient,
                    border: "none",
                    color: "#fff",
                    padding: "10px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  View SDK on GitHub
                  <ExternalLink size={12} />
                </button>
              </a>
              <CopyButton text={AI_CONTEXT} label="Copy AI Context" />
            </div>
          </FadeIn>

          {/* Right: code block */}
          <FadeIn delay={0.15}>
            <div
              style={{
                background: "#080618",
                border: `1px solid rgba(153,69,255,0.2)`,
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {/* Tab bar */}
              <div
                style={{
                  display: "flex",
                  borderBottom: `1px solid rgba(153,69,255,0.15)`,
                  padding: "0 16px",
                }}
              >
                {(["quickstart", "agent", "advanced"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      background: "none",
                      border: "none",
                      borderBottom: `2px solid ${
                        tab === t ? D.purple : "transparent"
                      }`,
                      color: tab === t ? D.text : D.muted,
                      padding: "12px 16px",
                      fontSize: 12,
                      fontWeight: tab === t ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      textTransform: "capitalize",
                    }}
                  >
                    {t === "quickstart"
                      ? "Quickstart"
                      : t === "agent"
                      ? "AI Agent"
                      : "Advanced"}
                  </button>
                ))}
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 4px",
                  }}
                >
                  <CopyButton text={SDK_CODE[tab]} />
                </div>
              </div>

              {/* Code */}
              <AnimatePresence mode="wait">
                <motion.pre
                  key={tab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    padding: "24px",
                    fontSize: 13,
                    lineHeight: 1.7,
                    fontFamily:
                      "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
                    color: "#A9B8C3",
                    overflowX: "auto",
                    margin: 0,
                    whiteSpace: "pre",
                  }}
                >
                  {SDK_CODE[tab]}
                </motion.pre>
              </AnimatePresence>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const threats = [
    {
      threat: "Wrong recipient claim",
      mitigation: "SHA-256 hash verified on-chain",
    },
    {
      threat: "Double claim",
      mitigation: "State: Pending → Claimed (immutable)",
    },
    { threat: "Sender griefing", mitigation: "Refund only after expiry" },
    {
      threat: "Fee manipulation",
      mitigation: "fee_bps in PDA, authority only",
    },
    {
      threat: "Arithmetic overflow",
      mitigation: "checked_add / checked_sub / checked_mul",
    },
    {
      threat: "Re-initialization",
      mitigation: "init constraint, never init_if_needed",
    },
    { threat: "Arbitrary CPI", mitigation: "Program<'info, T> validated" },
    { threat: "PDA substitution", mitigation: "Seeds: sender + nonce" },
  ];

  return (
    <section
      id="security"
      style={{
        padding: "100px 32px",
        background: "rgba(12,8,32,0.5)",
        borderTop: `1px solid ${D.border}`,
        borderBottom: `1px solid ${D.border}`,
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          <FadeIn>
            <p
              style={{
                color: D.purple,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 16,
              }}
            >
              Security model
            </p>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "clamp(28px, 3.5vw, 40px)",
                fontWeight: 800,
                color: D.text,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: 20,
              }}
            >
              Non-custodial.
              <br />
              Zero compromise.
            </h2>
            <p
              style={{
                color: D.muted,
                fontSize: 15,
                lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              The protocol never holds your funds. Everything is managed by
              auditable smart contracts on Solana — the code is the law, not the
              company.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
                marginBottom: 36,
              }}
            >
              {[
                {
                  step: "01",
                  title: "Handles stored as hashes",
                  desc: "The recipient's @handle is SHA-256 hashed before going on-chain. Zero identity data exposed on the blockchain.",
                },
                {
                  step: "02",
                  title: "Unique state transitions",
                  desc: "A vault goes Pending → Claimed OR Refunded. Once claimed, it's immutable. Double-claim is protocol-level impossible.",
                },
                {
                  step: "03",
                  title: "Verified arithmetic",
                  desc: "Every calculation uses checked_add, checked_sub, checked_mul. Zero overflow/underflow risk in the Solana programs.",
                },
              ].map((item) => (
                <div key={item.step} style={{ display: "flex", gap: 16 }}>
                  <div
                    style={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: `1px solid rgba(153,69,255,0.3)`,
                      background: "rgba(153,69,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 800,
                      color: D.purple,
                      fontFamily: "monospace",
                    }}
                  >
                    {item.step}
                  </div>
                  <div>
                    <p
                      style={{
                        color: D.text,
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      style={{ color: D.muted, fontSize: 12, lineHeight: 1.65 }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="https://github.com/Lucasalb11/pay-on-handle"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: D.purple,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              View source on GitHub
              <ExternalLink size={12} />
            </a>
          </FadeIn>

          {/* Threat model table */}
          <FadeIn delay={0.15}>
            <div style={{ ...card({ borderRadius: 20, padding: "28px" }) }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "rgba(153,69,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Shield size={16} color={D.purple} />
                  </div>
                  <div>
                    <p style={{ color: D.text, fontSize: 13, fontWeight: 700 }}>
                      Threat Model
                    </p>
                    <p style={{ color: D.muted, fontSize: 11 }}>
                      Vault Program · Anchor 0.32
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <motion.span
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: D.green,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ color: D.green, fontSize: 11 }}>Audited</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {threats.map((row, i) => (
                  <div
                    key={row.threat}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      padding: "11px 0",
                      borderBottom:
                        i < threats.length - 1
                          ? `1px solid ${D.border}`
                          : "none",
                    }}
                  >
                    <span style={{ color: D.muted, fontSize: 12 }}>
                      {row.threat}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: D.green,
                        fontFamily: "monospace",
                        flexShrink: 0,
                        textAlign: "right",
                      }}
                    >
                      {row.mitigation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Security pillars */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 56,
          }}
        >
          {[
            {
              icon: <Shield size={18} />,
              title: "Non-custodial",
              desc: "Funds live in a PDA controlled by the program — never in a company account.",
            },
            {
              icon: <Clock size={18} />,
              title: "Auto-refund",
              desc: "After 7 days with no claim, anyone can trigger the refund. Sender recovers everything.",
            },
            {
              icon: <Lock size={18} />,
              title: "On-chain privacy",
              desc: "Handles are SHA-256 hashed. No username or personal data stored on Solana.",
            },
            {
              icon: <CheckCircle2 size={18} />,
              title: "Open source",
              desc: "Programs, SDK, and frontend are public and auditable. Zero proprietary hidden code.",
            },
          ].map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.07}>
              <div
                style={{
                  ...card({ borderRadius: 16, padding: "24px" }),
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    color: D.purple,
                    background: "rgba(153,69,255,0.08)",
                    border: `1px solid ${D.border}`,
                    padding: 10,
                    borderRadius: 10,
                  }}
                >
                  {item.icon}
                </div>
                <p style={{ color: D.text, fontSize: 13, fontWeight: 700 }}>
                  {item.title}
                </p>
                <p style={{ color: D.muted, fontSize: 12, lineHeight: 1.65 }}>
                  {item.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProtocolSection() {
  return (
    <section id="protocol" style={{ padding: "100px 32px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <FadeIn style={{ textAlign: "center", marginBottom: 64 }}>
          <p
            style={{
              color: D.orange,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 16,
            }}
          >
            Protocol
          </p>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              color: D.text,
              letterSpacing: "-0.03em",
              marginBottom: 16,
            }}
          >
            Three programs. One protocol.
          </h2>
          <p
            style={{
              color: D.muted,
              fontSize: 16,
              maxWidth: 520,
              margin: "0 auto",
            }}
          >
            Pay on @ is built on three independent Anchor programs with
            well-defined responsibilities. Each can be audited and upgraded
            independently.
          </p>
        </FadeIn>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
            marginBottom: 64,
          }}
        >
          {[
            {
              name: "Registry",
              address: "AT8S64n…DZkvX",
              desc: "Maps (platform, hash(handle)) → wallet. Verified handles are registered here after OAuth proof.",
              color: D.purple,
              explorer:
                "https://explorer.solana.com/address/AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX?cluster=devnet",
            },
            {
              name: "Vault",
              address: "EgS854X…N4H",
              desc: "Manages escrow PaymentVaults with create, claim, and refund instructions. Fee collected at creation.",
              color: D.orange,
              explorer:
                "https://explorer.solana.com/address/EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H?cluster=devnet",
            },
            {
              name: "Fee Collector",
              address: "CxMBNw…SG6s",
              desc: "Accumulates 0.5% from each transfer. Authority can withdraw SOL and SPL tokens.",
              color: "#C084FC",
              explorer:
                "https://explorer.solana.com/address/CxMBNwbovsvLTe7bSuca8X26WS7PW81VtDu3oLyfSG6s?cluster=devnet",
            },
          ].map((program, i) => (
            <FadeIn key={program.name} delay={i * 0.1}>
              <div
                style={{
                  ...card({ borderRadius: 16, padding: "24px" }),
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = D.borderHover)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = D.border)
                }
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: program.color,
                      boxShadow: `0 0 10px ${program.color}60`,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{ color: D.text, fontSize: 16, fontWeight: 700 }}
                  >
                    {program.name}
                  </span>
                  <a
                    href={program.explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      marginLeft: "auto",
                      color: D.muted,
                      fontFamily: "monospace",
                      fontSize: 11,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = D.text)}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = D.muted)
                    }
                  >
                    {program.address}
                    <ExternalLink size={10} />
                  </a>
                </div>
                <p style={{ color: D.muted, fontSize: 13, lineHeight: 1.65 }}>
                  {program.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          <StatCard value={2341} label="Vaults created" />
          <StatCard value={847} label="SOL in escrow" suffix=" SOL" />
          <StatCard value={73} label="Claim rate" suffix="%" />
          <StatCard value={3} label="Social platforms" />
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const items = [
    {
      q: "Who holds the funds during escrow?",
      a: "No one. Funds are held by a PaymentVault PDA (Program Derived Address) controlled entirely by the Vault smart contract. Neither Pay on @ nor any third party can access the funds — only the verified recipient or the original sender (after expiry) can.",
    },
    {
      q: "What if the recipient never claims?",
      a: "After 7 days, anyone can call the refund instruction and the full amount (minus the 0.5% fee already paid) returns to the sender's wallet. This is enforced at the program level — no manual intervention needed.",
    },
    {
      q: "Which social platforms are supported?",
      a: "X/Twitter, Instagram, and WhatsApp are supported. Twitter OAuth is fully live. Instagram and WhatsApp verification are in active development. More platforms (YouTube, TikTok, Discord) are on the roadmap.",
    },
    {
      q: "Does the recipient need a crypto wallet?",
      a: "No. When the recipient opens the claim link and logs in with their social account, Privy automatically creates an embedded Solana wallet for them. The claim process takes about 30 seconds and requires no prior crypto knowledge.",
    },
    {
      q: "Is the handle visible on-chain?",
      a: "No. The recipient's handle is SHA-256 hashed before being stored on the blockchain. The hash is used to verify the recipient's identity at claim time without exposing any personal data publicly.",
    },
    {
      q: "Can I use my own Solana wallet?",
      a: "Yes. The protocol is wallet-agnostic. Users with existing wallets (Phantom, Backpack, Solflare) can connect them directly. Privy embedded wallets are offered for users without one.",
    },
  ];

  return (
    <section
      style={{
        padding: "100px 32px",
        background: "rgba(12,8,32,0.5)",
        borderTop: `1px solid ${D.border}`,
        borderBottom: `1px solid ${D.border}`,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <FadeIn style={{ textAlign: "center", marginBottom: 56 }}>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 800,
              color: D.text,
              letterSpacing: "-0.03em",
              marginBottom: 12,
            }}
          >
            Frequently asked
          </h2>
          <p style={{ color: D.muted, fontSize: 15 }}>
            Everything you need to know about the protocol.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function CTASection({ onLogin }: { onLogin: () => void }) {
  return (
    <section
      style={{
        padding: "120px 32px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(255,107,43,0.08), transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(153,69,255,0.08), transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <FadeIn style={{ position: "relative", maxWidth: 600, margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "clamp(36px, 5vw, 60px)",
            fontWeight: 800,
            color: D.text,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            marginBottom: 20,
          }}
        >
          Ready to pay with
          <br />
          just a <GradientText>@</GradientText>?
        </h2>
        <p
          style={{
            color: D.muted,
            fontSize: 17,
            lineHeight: 1.65,
            marginBottom: 40,
          }}
        >
          No wallet addresses. No KYC. No friction. Just a handle and a value.
        </p>
        <button
          onClick={onLogin}
          style={{
            background: D.gradient,
            border: "none",
            color: "#fff",
            padding: "16px 36px",
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 0 60px rgba(153,69,255,0.35)",
            transition: "box-shadow 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.boxShadow = "0 0 80px rgba(153,69,255,0.55)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.boxShadow = "0 0 60px rgba(153,69,255,0.35)")
          }
        >
          Start Sending — free
          <ArrowRight size={16} />
        </button>
        <p
          style={{
            color: `${D.muted}80`,
            fontSize: 12,
            marginTop: 20,
          }}
        >
          Powered by Solana · 0.5% fee · Non-custodial · Open source
        </p>
      </FadeIn>
    </section>
  );
}

function Footer() {
  type FooterLink = { label: string; href: string; external: boolean };
  const cols: { title: string; links: FooterLink[] }[] = [
    {
      title: "Product",
      links: [
        { label: "Send", href: "/send", external: false },
        { label: "Wallet", href: "/wallet", external: false },
        { label: "DeFi", href: "/defi", external: false },
        { label: "Settings", href: "/settings", external: false },
      ],
    },
    {
      title: "Protocol",
      links: [
        {
          label: "Registry Program",
          href: "https://explorer.solana.com/address/AT8S64nJohSwwAv4BxfvAxwaWaVnfFvfsVXVjA8DZkvX?cluster=devnet",
          external: true,
        },
        {
          label: "Vault Program",
          href: "https://explorer.solana.com/address/EgS854XfeyTkuTKpYzDD3h5kiKMt4h3J37hGaBfuDN4H?cluster=devnet",
          external: true,
        },
        {
          label: "SDK (@pay-on-handle/sdk)",
          href: "https://github.com/Lucasalb11/pay-on-handle",
          external: true,
        },
        {
          label: "ROADMAP.md",
          href: "https://github.com/Lucasalb11/pay-on-handle",
          external: true,
        },
      ],
    },
    {
      title: "Developers",
      links: [
        {
          label: "GitHub",
          href: "https://github.com/Lucasalb11/pay-on-handle",
          external: true,
        },
        {
          label: "Anchor Docs",
          href: "https://www.anchor-lang.com",
          external: true,
        },
        {
          label: "Solana Docs",
          href: "https://docs.solana.com",
          external: true,
        },
        {
          label: "Helius",
          href: "https://helius.dev",
          external: true,
        },
      ],
    },
    {
      title: "Community",
      links: [
        {
          label: "Superteam Brazil",
          href: "https://superteam.fun/brazil",
          external: true,
        },
        {
          label: "Colosseum",
          href: "https://colosseum.org",
          external: true,
        },
        {
          label: "X/Twitter",
          href: "https://x.com",
          external: true,
        },
        {
          label: "Discord",
          href: "#",
          external: false,
        },
      ],
    },
  ];

  return (
    <footer
      style={{
        borderTop: `1px solid ${D.border}`,
        padding: "60px 32px 40px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto repeat(4, 1fr)",
            gap: 40,
            marginBottom: 48,
          }}
        >
          {/* Brand */}
          <div style={{ maxWidth: 220 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: D.gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#fff",
                }}
              >
                @
              </div>
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: D.text,
                }}
              >
                Pay on @
              </span>
            </div>
            <p style={{ color: D.muted, fontSize: 13, lineHeight: 1.65 }}>
              Social payments infrastructure for Solana. Send crypto to any
              handle — no wallet required.
            </p>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
              <p
                style={{
                  color: D.muted,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 20,
                }}
              >
                {col.title}
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: D.muted,
                          fontSize: 13,
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = D.text)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = D.muted)
                        }
                      >
                        {link.label}
                        <ExternalLink size={10} style={{ opacity: 0.4 }} />
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        style={{
                          color: D.muted,
                          fontSize: 13,
                          textDecoration: "none",
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = D.text)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = D.muted)
                        }
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: `1px solid ${D.border}`,
            paddingTop: 28,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <p style={{ color: `${D.muted}80`, fontSize: 12 }}>
            © 2025 Pay on @. Built for Colosseum Frontier Hackathon · Superteam
            Brazil
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: D.green,
              }}
            >
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: D.green,
                  display: "inline-block",
                }}
              />
              Devnet live
            </span>
            <a
              href="https://github.com/Lucasalb11/pay-on-handle"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: `${D.muted}80`,
                fontSize: 12,
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = D.text)}
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = `${D.muted}80`)
              }
            >
              Open Source · MIT
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      router.replace("/wallet");
    }
  }, [ready, authenticated, router]);

  return (
    <div
      style={{
        background: D.bg,
        color: D.text,
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .hidden.md\\:flex { display: none !important; }
          .hidden.lg\\:block { display: none !important; }
        }
        @media (min-width: 768px) {
          .hidden.md\\:flex { display: flex !important; }
        }
        @media (min-width: 1024px) {
          .hidden.lg\\:block { display: block !important; }
        }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
      `}</style>

      <NavBar onLogin={login} />
      <Hero onLogin={login} />
      <LiveTicker />
      <EcoBar />
      <HowItWorks />
      <UseCases />
      <SDKSection />
      <SecuritySection />
      <ProtocolSection />
      <FAQSection />
      <CTASection onLogin={login} />
      <Footer />
    </div>
  );
}
