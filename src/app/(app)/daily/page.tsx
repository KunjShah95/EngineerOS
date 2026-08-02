import { redirect } from "next/navigation";

export default function DailyIndexPage() {
  redirect(`/daily/${new Date().toISOString().slice(0, 10)}`);
}
