import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Syne, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LenisProvider } from "@/components/LenisProvider";

const syne = Syne({ subsets: ["latin"], variable: "--font-syne", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Kuro Agent | WebMCP by Kurogrid",
  description:
    "Kuro Agent shows how customers can book through an assistant using services and availability published on a business website.",
  icons: {
    icon: [
      { url: "/icono-32.png", type: "image/png", sizes: "32x32" },
      { url: "/isotipo.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icono-32.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${syne.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
