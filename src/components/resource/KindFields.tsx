"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getResourceKindMeta, READING_STATUS_LABELS } from "@/lib/resource-kind";
import type { ResourceKind, ResourceMetadata } from "@/types/database";

export function KindFields({
  kind,
  metadata,
  onChange,
}: {
  kind: ResourceKind;
  metadata: ResourceMetadata;
  onChange: (patch: Partial<ResourceMetadata>) => void;
}) {
  const meta = getResourceKindMeta(kind);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {meta.hasUrl ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-faint">URL</label>
          <Input
            type="url"
            value={metadata.url ?? ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://…"
          />
        </div>
      ) : null}

      {meta.hasLanguage ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-faint">Language</label>
          <Input
            value={metadata.language ?? ""}
            onChange={(e) => onChange({ language: e.target.value })}
            placeholder="TypeScript, SQL, …"
          />
        </div>
      ) : null}

      {meta.hasReadStatus ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-faint">Status</label>
          <Select
            value={metadata.read_status ?? "want"}
            onValueChange={(v) => onChange({ read_status: v as ResourceMetadata["read_status"] })}
          >
            <SelectTrigger className="w-full" aria-label="Reading status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="want">{READING_STATUS_LABELS.want}</SelectItem>
              <SelectItem value="reading">{READING_STATUS_LABELS.reading}</SelectItem>
              <SelectItem value="done">{READING_STATUS_LABELS.done}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {meta.hasMeetingDate ? (
        <div className="space-y-1">
          <label className="text-xs font-medium text-faint">Date</label>
          <Input
            type="date"
            value={metadata.meeting_date ?? ""}
            onChange={(e) => onChange({ meeting_date: e.target.value || null })}
          />
        </div>
      ) : null}

      {meta.hasAttendees ? (
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-faint">Attendees</label>
          <Input
            value={metadata.attendees?.join(", ") ?? ""}
            onChange={(e) =>
              onChange({
                attendees: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
            placeholder="Comma-separated names"
          />
        </div>
      ) : null}
    </div>
  );
}