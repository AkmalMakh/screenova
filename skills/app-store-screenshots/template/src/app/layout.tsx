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
        {/* Screenova landing typography: Newsreader (serif display),
            Playfair Display (fallback), Plus Jakarta Sans (UI). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Landing defaults to dark. Apply before paint to avoid a light flash;
            only on the landing route so app pages keep their light theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(location.pathname==='/'&&localStorage.getItem('screenova-theme')!=='light'){document.body.classList.add('screenova-dark')}}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
