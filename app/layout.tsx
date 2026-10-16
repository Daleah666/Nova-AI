import type { Metadata } from "next";
import { Figtree, Source_Serif_4 } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const ui = Figtree({
  subsets: ["latin"],
  variable: "--font-ui",
});

const display = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Character Companion",
  description:
    "Local Chub-style character library and chat. Adult companions only. Bring your own OpenAI-compatible API key.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${ui.variable} ${display.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
