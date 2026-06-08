import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataProvider } from "@/components/DataProvider";
import Header from "@/components/Header";
import BroadcastPopup from "@/components/BroadcastPopup";
import NoCoachGate from "@/components/NoCoachGate";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import BgColorSyncer from "@/components/BgColorSyncer";
import { AUTH_ENABLED } from "@/lib/config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (AUTH_ENABLED) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  }

  return (
    <DataProvider>
      {/* Synchronise la couleur de fond avec le compte connecté (user-specific localStorage) */}
      <BgColorSyncer />
      {/* Enregistre le SW dès l'ouverture de l'app — pas seulement depuis Settings */}
      <ServiceWorkerRegistrar />
      <NoCoachGate>
        <Header />
        <main className="mx-auto max-w-3xl p-4">{children}</main>
        <BroadcastPopup />
      </NoCoachGate>
    </DataProvider>
  );
}
