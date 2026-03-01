import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getMemberConsents } from "@/lib/member-settings";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import DashboardLayoutClient from "./DashboardLayoutClient";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, session] = await Promise.all([params, auth()]);
  const cookieStore = await cookies();

  let memberId: number | null = session?.user?.memberId ?? null;

  if (!memberId) {
    const desktopToken = cookieStore.get("PECAL_ACCESS_TOKEN")?.value;
    if (desktopToken) {
      const payload = await verifyToken(desktopToken);
      if (payload?.type === "access") {
        memberId = payload.memberId;
      }
    }
  }

  if (!memberId) {
    redirect(`/${locale}/login`);
  }

  const consents = await getMemberConsents(memberId);
  if (!consents.privacy_consent) {
    const callback = encodeURIComponent(`/${locale}/dashboard`);
    redirect(`/${locale}/consent?callback=${callback}`);
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
