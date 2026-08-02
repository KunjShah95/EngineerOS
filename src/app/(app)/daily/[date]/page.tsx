import { format, isValid, parseISO } from "date-fns";

import { DailyNotePage } from "@/components/daily/DailyNotePage";
import { EmptyState } from "@/components/shell/EmptyState";
import { CalendarDays } from "lucide-react";

export default async function DailyNoteRoute({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  const parsed = parseISO(date);
  if (!isValid(parsed) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Invalid date"
        description={`“${date}” isn't a valid daily-note date.`}
      />
    );
  }

  return <DailyNotePage key={date} date={format(parsed, "yyyy-MM-dd")} />;
}
