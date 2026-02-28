import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "タスク管理システム",
  description: "個人用タスク管理・習慣トラッカー",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased text-text-primary bg-base">
        {children}
      </body>
    </html>
  );
}
