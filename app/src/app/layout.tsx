import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Pay on @ — Social payments infrastructure for Solana",
  description:
    "Send SOL or USDC to any X, Instagram or WhatsApp handle. No wallet required. Non-custodial 7-day escrow vault. Built on Solana.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pay on @",
  },
  openGraph: {
    title: "Pay on @ — Pay anyone. Just their @.",
    description:
      "Send SOL or USDC to any social handle. Recipient claims with one tap — no wallet required. Built on Solana.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pay on @ — Social payments infrastructure for Solana",
    description: "Send SOL or USDC to any @handle. No wallet address needed.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F7F3ED",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-brand-beige font-sans antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "#FFFFFF",
                border: "1px solid #E8DFF5",
                color: "#1A1028",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
