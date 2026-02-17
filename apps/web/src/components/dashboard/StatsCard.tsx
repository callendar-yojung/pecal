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
    positive: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950",
    negative: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
    neutral: "text-zinc-600 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-900",
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
        <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}