import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Paga no @",
  description:
    "Um @, zero barreiras. Envie crypto para qualquer Instagram, X ou WhatsApp.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Paga no @",
  },
  openGraph: {
    title: "Paga no @",
    description:
      "Envie SOL ou USDC para qualquer @handle. Sem wallet necessária.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A0A0F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-bg font-sans antialiased">
        <Providers>
          <div className="app-container">{children}</div>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "#111118",
                border: "1px solid #1E1E2E",
                color: "white",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
