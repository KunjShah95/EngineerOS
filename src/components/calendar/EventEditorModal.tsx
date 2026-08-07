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
import { useCreateEvent, useUpdateEvent, useDeleteEvent } from "@/hooks/useEvents";
import type { CalendarEvent, EventColor } from "@/types/database";

const COLORS: EventColor[] = ["blue", "green", "red", "amber", "purple", "gray"];

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
  event: CalendarEvent | null;
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
  const defaultStart = event ? toLocalInput(event.starts_at) : (initialStart ?? `${today}T09:00`);
  const defaultEnd = event
    ? toLocalInput(event.ends_at)
    : (initialEnd ?? (initialStart ? addMinutesLocal(initialStart, 30) : `${today}T10:00`));

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [color, setColor] = useState<EventColor>(event?.color ?? "blue");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const startsAt = fromLocalInput(start);
    const endsAt = fromLocalInput(end);
    if (new Date(endsAt) < new Date(startsAt)) {
      toast.error("End must be after start");
      return;
    }
    const payload = {
      title: title.trim(),
      description,
      location: location.trim() || null,
      color,
      all_day: allDay,
      starts_at: startsAt,
      ends_at: endsAt,
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
