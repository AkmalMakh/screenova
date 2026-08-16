import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "App Store Screenshots",
  description:
    "Describe your app and attach its screenshots — get a designed App Store + Google Play screenshot deck in minutes.",
  openGraph: {
    title: "App Store Screenshots",
    description:
      "Describe your app and attach its screenshots — get a designed App Store + Google Play screenshot deck in minutes.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* System font stack (set on body in globals.css) — SF Pro on Apple devices. */}
      <body>{children}</body>
    </html>
  );
}
