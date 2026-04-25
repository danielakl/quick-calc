import localFont from "next/font/local";
import Script from "next/script";
import type { Metadata } from "next";
import "./globals.css";

const spaceGrotesk = localFont({
  src: "./fonts/SpaceGrotesk-Variable.woff2",
  variable: "--font-sans",
  weight: "300 700",
  style: "normal",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});

const spaceMono = localFont({
  src: "./fonts/SpaceMono-Regular.woff2",
  variable: "--font-mono",
  weight: "400",
  style: "normal",
  display: "swap",
  fallback: ["ui-monospace", "Menlo", "Consolas", "monospace"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Quick Calc",
  description: "A notepad-style calculator for quick math",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable} h-full`}>
      <body className="h-full">
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
