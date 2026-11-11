import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import AdminNav from "@/components/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — HKN ke-62", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return (
    <div className="min-h-dvh">
      <AdminNav email={user.email!} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
