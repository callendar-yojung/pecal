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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="dashboard-hero-shell">
        <div className="dashboard-hero-orb dashboard-hero-orb-right" />
        <div className="dashboard-hero-orb dashboard-hero-orb-left" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl drop-shadow-sm">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex -space-x-3 overflow-hidden p-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-xl font-bold text-background shadow-lg ring-4 ring-background">
              P
            </div>
          </div>
        </div>
      </div>

      <div className={side ? "grid gap-8 lg:grid-cols-12" : ""}>
        <div className={side ? "lg:col-span-8 space-y-8" : "space-y-8"}>
          {main}
        </div>
        {side ? (
          <div className="lg:col-span-4 h-fit lg:sticky lg:top-8 space-y-8">
            {side}
          </div>
        ) : null}
      </div>
    </div>
  );
}
