import type { Metadata } from "next";
import "./globals.css";

// No web font: the type is SF Pro, the iPhone system font, per
// docs/design/README.md. It is what the elder already reads every day, and on
// a real iPhone it follows the text size she has set.

export const metadata: Metadata = {
  title: "KinSight",
  description: "Real-time fraud detection for independent older adults.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
