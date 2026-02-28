"use client";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: string;
}

export default function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
}: StatsCardProps) {
  const changeColors = {
    positive: "text-status-done-foreground bg-status-done",
    negative: "text-destructive bg-destructive/10",
    neutral: "text-muted-foreground bg-muted",
  };

  return (
    <div className="ui-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {change && (
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${changeColors[changeType]}`}
          >
            {change}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
