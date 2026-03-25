import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BaseFlow",
  description: "Funky boxy Base multisender",
  other: {
    "base:app:id": "69c3144cf58f3fd1ddcf3f31",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <meta name="base:app_id" content="69c3144cf58f3fd1ddcf3f31" />
      <body>{children}</body>
    </html>
  );
}
