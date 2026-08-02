import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/shell/EmptyState";

export default async function DailyNotePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return (
    <EmptyState
      icon={CalendarDays}
      title={`Daily Note — ${date}`}
      description="Morning goals, journal, tasks, learned, wins, problems, and tomorrow sections will render here."
    />
  );
}
