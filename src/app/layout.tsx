import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "EngineerOS", template: "%s · EngineerOS" },
  description:
    "EngineerOS is an AI-native workspace for notes, tasks, projects, and daily work — capture, find, and organize everything with semantic search, knowledge graphs, and AI-powered citations.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  applicationName: "EngineerOS",
  keywords: [
    "notes",
    "tasks",
    "projects",
    "daily notes",
    "second brain",
    "productivity",
    "AI-native workspace",
    "semantic search",
    "knowledge graph",
    "AI assistant",
    "markdown notes",
    "kanban",
    "automation",
  ],
  openGraph: {
    title: "EngineerOS — AI-native workspace for notes, tasks, and projects",
    description:
      "One connected system for notes, tasks, projects, and daily work. Semantic search, AI assistant with citations, knowledge graph, and automation rules.",
    type: "website",
    siteName: "EngineerOS",
    locale: "en_US",
    images: [
      {
        url: "/icon.svg",
        width: 1200,
        height: 630,
        alt: "EngineerOS — AI-native workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EngineerOS — AI-native workspace for notes, tasks, and projects",
    description:
      "One connected system for notes, tasks, projects, and daily work. Semantic search, AI assistant with citations, knowledge graph, and automation rules.",
    images: ["/icon.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
  },
  other: {
    "ai-seo": "true",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1e" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${jetBrainsMono.variable} ${spaceGrotesk.variable} antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=window.localStorage.getItem('engineeros-theme');if(t==='light'){document.documentElement.dataset.theme='light';document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? (
          <Script
            id="plausible-analytics"
            strategy="afterInteractive"
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        ) : null}
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
