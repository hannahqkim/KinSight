import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

// Inter Tight only, per docs/design/README.md. Black 900 carries the verdicts.
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "KinSight",
  description: "Real-time fraud detection for independent older adults.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${interTight.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
