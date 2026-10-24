import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/studio/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexus AI Studio — Multimodal AI Platform",
  description:
    "A full-stack multimodal AI platform: streaming LLM chat, vision analysis, AI image generation, speech-to-text and text-to-speech. Built with Next.js 16, TypeScript, Prisma and the Z-AI SDK.",
  keywords: [
    "AI Platform",
    "Multimodal AI",
    "LLM",
    "Computer Vision",
    "Text to Speech",
    "Speech to Text",
    "Image Generation",
    "Next.js",
    "AI Engineer Portfolio",
  ],
  authors: [{ name: "Nexus AI Studio" }],
  openGraph: {
    title: "Nexus AI Studio",
    description: "Multimodal AI platform — chat, vision, image generation & speech",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafdfb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1310" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
