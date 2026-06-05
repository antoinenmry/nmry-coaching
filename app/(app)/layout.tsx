import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DataProvider } from "@/components/DataProvider";
import Header from "@/components/Header";
import { AUTH_ENABLED } from "@/lib/config";
import { GUEST_COOKIE } from "@/lib/guest";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (AUTH_ENABLED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const guest = (await cookies()).get(GUEST_COOKIE)?.value === "1";
    if (!user && !guest) redirect("/login");
  }

  return (
    <DataProvider>
      <Header />
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </DataProvider>
  );
}
