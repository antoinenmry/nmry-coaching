import type { Metadata, Viewport } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

// Police de l'app, auto-hébergée par next/font au build (aucun appel à Google au runtime,
// pas de saut d'affichage). Exposée en variable CSS, reprise par --font-sans dans globals.css.
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-lato",
});

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
    <html lang="fr" className={lato.variable}>
      <head>
        {/* Applique le thème avant hydratation pour éviter le flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('nmry-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}` }} />
        <link rel="apple-touch-icon" href="/icon-512.png" />
      </head>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
