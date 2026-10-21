import type { Metadata, Viewport } from "next";
import { RegistraServiceWorker } from "@/components/pwa";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Gestionale · Colleiano",
  // PWA del gestionale (SPEC 7.3): scope /gestione/, si installa sul telefono.
  manifest: "/gestione/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Colleiano", statusBarStyle: "default" },
  icons: { apple: "/gestione/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#1B3022" };

export default function GestioneLayout({ children }: LayoutProps<"/gestione">) {
  return (
    <AuthProvider>
      <RegistraServiceWorker />
      {children}
    </AuthProvider>
  );
}
