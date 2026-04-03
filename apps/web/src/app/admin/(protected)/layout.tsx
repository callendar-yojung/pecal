import AdminLayoutWrapper from "@/components/admin/AdminLayoutWrapper";
import "../../globals.css";

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
