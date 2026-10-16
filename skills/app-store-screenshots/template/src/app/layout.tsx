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
    // suppressHydrationWarning: the inline script below sets the landing's
    // dark class before hydration, which intentionally diverges from SSR html.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Shared, light-first workspace appearance. Apply to html before paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=localStorage.getItem('screenova-theme')==='dark';document.documentElement.classList.toggle('screenova-dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
