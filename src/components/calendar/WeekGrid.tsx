import { DayCell, type DayCellData } from "@/components/calendar/DayCell";

export function WeekGrid({ days }: { days: DayCellData[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7 lg:gap-1.5">
      {days.map((day) => (
        <DayCell key={day.iso} {...day} />
      ))}
    </div>
  );
}