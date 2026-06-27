"use client";

interface Props {
  wateringDays: Set<string>;
}

function getLast84Days(): string[] {
  const days: string[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(2026, 5, 27 - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const DAYS_ABBR = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function StreakHeatmap({ wateringDays }: Props) {
  const days = getLast84Days();
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {DAYS_ABBR.map((d) => (
          <div key={d} className="flex-1 text-[9px] text-muted-foreground text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-1">
            {week.map((day) => {
              const active = wateringDays.has(day);
              const isToday = day === "2026-06-27";
              return (
                <div
                  key={day}
                  title={day}
                  className={`aspect-square rounded-sm ${
                    active ? "bg-primary" : "bg-muted"
                  } ${isToday ? "ring-1 ring-primary ring-offset-1" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
