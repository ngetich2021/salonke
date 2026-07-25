type DayCount = { date: string; count: number };

function formatDayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Single-series magnitude-by-day bar list. Values are direct-labeled (not
// color-only), so no legend or tooltip layer is needed for one series.
export function DailyBarChart({ title, data }: { title: string; data: DayCount[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{total} total</span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">No visits recorded yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {data.map(({ date, count }) => (
            <div key={date} className="flex items-center gap-2 text-xs">
              <span className="w-14 shrink-0 text-zinc-500 dark:text-zinc-400">
                {formatDayLabel(date)}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
