import type { Metadata } from "next";
import { Noto_Sans_JP, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({ 
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  weight: ["300", "400", "500", "700"]
});

const zenKaku = Zen_Kaku_Gothic_New({ 
  subsets: ["latin"],
  variable: "--font-zen-kaku",
  weight: ["300", "400", "500", "700"]
});

export const metadata: Metadata = {
  title: "画像圧縮・最適化ツール",
  description: "シンプルで使いやすい画像圧縮ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${notoSansJP.variable} ${zenKaku.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
