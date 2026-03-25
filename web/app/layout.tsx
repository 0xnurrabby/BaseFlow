import "./globals.css";
import type { Metadata } from "next";
import { Metadata } from 'next';

export const metadata: Metadata = {
  other: {
    'base:app_id': '69c3144cf58f3fd1ddcf3f31',
  },
};

export default function Home() {
  return <div>{/* Your page content */}</div>;
}
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
