import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const titulo = "Encaixe — Currículo ATS friendly a partir da vaga";
const descricao =
  "Cole a vaga e o seu currículo, veja o match e as palavras-chave que faltam e baixe uma versão ATS friendly em PDF. Sem inventar nada.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000")
  ),
  title: titulo,
  description: descricao,
  openGraph: {
    title: titulo,
    description: descricao,
    locale: "pt_BR",
    type: "website",
    siteName: "Encaixe",
  },
  twitter: {
    card: "summary_large_image",
    title: titulo,
    description: descricao,
  },
};

export const viewport: Viewport = {
  themeColor: "#0F766E",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Pular para o conteúdo
        </a>
        <TooltipProvider>
          <SiteHeader />
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </TooltipProvider>
        <Toaster position="top-center" richColors={false} />
      </body>
    </html>
  );
}
