"use client";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface Admin {
  admin_id: number;
  username: string;
  role: string;
}

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
