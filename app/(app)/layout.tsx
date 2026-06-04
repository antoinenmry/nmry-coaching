import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataProvider } from "@/components/DataProvider";
import Header from "@/components/Header";
import { AUTH_ENABLED } from "@/lib/config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (AUTH_ENABLED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  }

  return (
    <DataProvider>
      <Header />
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </DataProvider>
  );
}
