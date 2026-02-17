import { redirect } from "next/navigation";

export default function PlansPage() {
  redirect("/dashboard/settings/billing/plans/personal");
}
