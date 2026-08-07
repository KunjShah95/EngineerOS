"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WEEKDAY_OPTIONS, type EventInstance, type RecurrenceFreq } from "@/lib/recurrence";
import { useCreateEvent, useUpdateEvent, useDeleteEvent } from "@/hooks/useEvents";
import { cn } from "@/lib/utils";
import type { CalendarEvent, EventColor } from "@/types/database";

const COLORS: EventColor[] = ["blue", "green", "red", "amber", "purple", "gray"];
type Repeats = "never" | RecurrenceFreq;

const REMINDER_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: "None", minutes: null },
  { label: "10 minutes before", minutes: 10 },
  { label: "30 minutes before", minutes: 30 },
  { label: "1 hour before", minutes: 60 },
  { label: "1 day before", minutes: 1440 },
];

/** ISO timestamptz -> value for <input type="datetime-local"> (local, no zone). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** datetime-local value -> ISO timestamptz. */
function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

/** datetime-local value shifted by `minutes` (local). */
function addMinutesLocal(v: string, minutes: number): string {
  const d = new Date(v);
  d.setMinutes(d.getMinutes() + minutes);
  return toLocalInput(d.toISOString());
}

export function EventEditorModal({
  workspaceId,
  event,
  initialStart,
  initialEnd,
  onClose,
}: {
  workspaceId: string;
  event: (CalendarEvent & Partial<EventInstance>) | null;
  /** datetime-local value ("YYYY-MM-DDTHH:mm") when creating from a grid slot. */
  initialStart?: string | null;
  /** Optional explicit end; defaults to start + 30 minutes. */
  initialEnd?: string | null;
  onClose: () => void;
}) {
  const isEdit = event !== null;
  const createEvent = useCreateEvent(workspaceId);
  const updateEvent = useUpdateEvent(workspaceId);
  const deleteEvent = useDeleteEvent(workspaceId);

  const today = new Date().toISOString().slice(0, 10);
  // Editing an occurrence edits the whole series, so prefill from the series'
  // original start/end (expansion keeps them on instances). For non-recurring
  // events these equal starts_at/ends_at.
  const defaultStart = event
    ? toLocalInput(event.seriesStartsAt ?? event.starts_at)
    : (initialStart ?? `${today}T09:00`);
  const defaultEnd = event
    ? toLocalInput(event.seriesEndsAt ?? event.ends_at)
    : (initialEnd ?? (initialStart ? addMinutesLocal(initialStart, 30) : `${today}T10:00`));

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [color, setColor] = useState<EventColor>(event?.color ?? "blue");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  // Reminder (Phase 4) — minutes before start; enqueued as a job by useEvents.
  const [remindMinutes, setRemindMinutes] = useState<number | null>(event?.remind_minutes ?? null);

  // Recurrence (Phase 3)
  const [repeats, setRepeats] = useState<Repeats>(event?.rrule_freq ?? "never");
  const [intervalN, setIntervalN] = useState(event?.rrule_interval ?? 1);
  const [byday, setByday] = useState<string[]>(event?.rrule_byday ?? []);
  const [until, setUntil] = useState(event?.rrule_until ?? "");

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (repeats === "weekly" && byday.length === 0) {
      toast.error("Pick at least one repeat day");
      return;
    }
    const startsAt = fromLocalInput(start);
    const endsAt = fromLocalInput(end);
    if (new Date(endsAt) < new Date(startsAt)) {
      toast.error("End must be after start");
      return;
    }
    // A reminder before an already-started event can never fire — drop it so
    // the event doesn't read as "has a reminder" that silently never goes off.
    let remind = remindMinutes;
    if (remind && new Date(startsAt).getTime() - remind * 60_000 <= Date.now()) {
      remind = null;
      toast.info("Reminder skipped — the event has already started");
    }
    const payload = {
      title: title.trim(),
      description,
      location: location.trim() || null,
      color,
      all_day: allDay,
      starts_at: startsAt,
      ends_at: endsAt,
      rrule_freq: repeats === "never" ? null : repeats,
      rrule_interval: repeats === "never" ? null : Math.max(1, Math.floor(intervalN) || 1),
      rrule_byday: repeats === "weekly" ? byday : null,
      rrule_until: until || null,
      remind_minutes: remind,
    };
    if (isEdit) {
      updateEvent.mutate(
        { id: event.id, patch: payload },
        {
          onSuccess: () => { toast.success("Event saved"); onClose(); },
          onError: () => { toast.error("Couldn't save the event"); },
        }
      );
    } else {
      createEvent.mutate(payload, {
        onSuccess: () => { toast.success("Event created"); onClose(); },
        onError: () => { toast.error("Couldn't create the event"); },
      });
    }
  };

  const remove = () => {
    if (!event) return;
    deleteEvent.mutate(event.id, {
      onSuccess: () => { toast.success("Event deleted"); onClose(); },
      onError: () => { toast.error("Couldn't delete the event"); },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="event-allday">All day</Label>
            <Switch id="event-allday" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Start</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">End</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Reminder */}
          <div className="space-y-1.5">
            <Label>Reminder</Label>
            <Select
              value={String(remindMinutes ?? 0)}
              onValueChange={(v) => setRemindMinutes(v === "0" ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map((o) => (
                  <SelectItem key={o.minutes ?? 0} value={String(o.minutes ?? 0)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Repeats */}
          <div className="space-y-1.5">
            <Label>Repeats</Label>
            <Select value={repeats} onValueChange={(v) => setRepeats(v as Repeats)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {repeats !== "never" && (
            <>
              <div className="flex items-end gap-2">
                <div className="w-24 space-y-1.5">
                  <Label htmlFor="event-interval">Every</Label>
                  <Input
                    id="event-interval"
                    type="number"
                    min={1}
                    max={99}
                    value={intervalN}
                    onChange={(e) => setIntervalN(Number(e.target.value))}
                  />
                </div>
                <span className="pb-2 text-xs text-faint">
                  {repeats === "weekly" ? "week(s)" : repeats === "monthly" ? "month(s)" : "day(s)"}
                </span>
              </div>

              {repeats === "weekly" && (
                <div className="flex gap-1.5">
                  {WEEKDAY_OPTIONS.map((d) => {
                    const active = byday.includes(d.code);
                    return (
                      <button
                        key={d.code}
                        type="button"
                        onClick={() =>
                          setByday(active ? byday.filter((c) => c !== d.code) : [...byday, d.code])
                        }
                        aria-pressed={active}
                        className={cn(
                          "size-7 rounded-full text-xs font-medium transition-colors",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "bg-surface-hover text-secondary hover:text-foreground"
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="event-until">Ends (optional)</Label>
                <Input
                  id="event-until"
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <Select value={color} onValueChange={(v) => setColor(v as EventColor)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLORS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-desc">Description</Label>
            <Textarea
              id="event-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {isEdit ? (
            <Button variant="ghost" size="sm" onClick={remove} aria-label="Delete event">
              <Trash2 className="size-4" strokeWidth={1.75} />
              Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={submit}>{isEdit ? "Save" : "Create"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
