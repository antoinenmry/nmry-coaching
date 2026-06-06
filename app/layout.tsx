import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "NMRY Coaching",
  description: "Suivi coaching musculation — plan, objectifs, performances",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NMRY Coaching",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* Applique le thème avant hydratation pour éviter le flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('nmry-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}` }} />
        <link rel="apple-touch-icon" href="/logo-light.png" />
      </head>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
