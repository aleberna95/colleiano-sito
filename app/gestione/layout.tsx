import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Gestionale · Colleiano",
};

export default function GestioneLayout({ children }: LayoutProps<"/gestione">) {
  return <AuthProvider>{children}</AuthProvider>;
}
