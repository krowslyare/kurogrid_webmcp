import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Syne, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { LenisProvider } from "@/components/LenisProvider";
import { WebMcpInitializer } from "@/components/WebMcpInitializer";

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof window==='undefined')return;if(document.modelContext)return;class M extends EventTarget{constructor(){super();this._t=new Map();}async registerTool(t,o){if(o&&o.signal&&o.signal.aborted)return;this._t.set(t.name,t);document.dispatchEvent(new CustomEvent('toolchange',{detail:{name:t.name}}));}async unregisterTool(n){this._t.delete(n);document.dispatchEvent(new CustomEvent('toolchange',{detail:{name:n}}));}async getTools(){return Array.from(this._t.values()).map(t=>({name:t.name,title:t.title,description:t.description,inputSchema:t.inputSchema,annotations:t.annotations}));}async executeTool(n,i){const t=this._t.get(n);if(!t)throw new Error('Tool not found: '+n);return t.execute(i);}}const p=new M();try{Object.defineProperty(Document.prototype,'modelContext',{get(){return p;},configurable:true,enumerable:true});}catch(e){}try{Object.defineProperty(document,'modelContext',{get(){return p;},configurable:true,enumerable:true});}catch(e){}try{Object.defineProperty(Navigator.prototype,'modelContext',{get(){return p;},configurable:true,enumerable:true});}catch(e){}try{window.modelContext=p;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <WebMcpInitializer />
        <LenisProvider>{children}</LenisProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
