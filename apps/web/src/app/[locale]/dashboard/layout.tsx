import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DashboardLayoutClient from "./DashboardLayoutClient";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, session] = await Promise.all([params, auth()]);

  if (!session?.user?.memberId) {
    redirect(`/${locale}/login`);
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
