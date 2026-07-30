import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Support Desk — Customer support for modern teams",
  description:
    "Multi-tenant helpdesk with agent inbox, customer portal, SLA, knowledge base, and analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
