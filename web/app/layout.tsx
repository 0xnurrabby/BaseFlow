import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "BaseFlow",
  description: "Funky boxy Base multisender",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
