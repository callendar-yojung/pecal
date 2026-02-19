import type { ReactNode } from "react";

interface DashboardShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  main: ReactNode;
  side?: ReactNode;
}

export default function DashboardShell({
  title,
  subtitle,
  main,
  side,
}: DashboardShellProps) {
  return (
    <div className="space-y-10">
      <div className="dashboard-hero-card p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className={side ? "grid gap-10 lg:grid-cols-3" : ""}>
        <div className={side ? "lg:col-span-2" : ""}>{main}</div>
        {side ? (
          <div className="h-fit lg:sticky lg:top-10">{side}</div>
        ) : null}
      </div>
    </div>
  );
}
