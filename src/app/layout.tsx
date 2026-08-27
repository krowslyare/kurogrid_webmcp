import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kurogrid WebMCP",
  description:
    "A public-safe demonstration of browser-native, tenant-aware operations with WebMCP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
