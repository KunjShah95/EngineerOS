import { Settings } from "lucide-react";
import { EmptyState } from "@/components/shell/EmptyState";

export default function SettingsPage() {
  return (
    <EmptyState
      icon={Settings}
      title="Settings"
      description="Profile, workspace name, theme preference, and account controls will live here."
    />
  );
}
