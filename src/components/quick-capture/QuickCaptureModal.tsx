"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckSquare, FileText, Inbox, Mic, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateCapture } from "@/hooks/useCaptures";
import { useCreateNote } from "@/hooks/useNotes";
import { useCreateVoiceNote } from "@/hooks/useVoiceNotes";
import { useProjects } from "@/hooks/useProjects";
import { useUiStore } from "@/lib/store/ui";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { cn } from "@/lib/utils";

type Destination = "note" | "task" | "inbox";

const destinations: { value: Destination; label: string; icon: typeof FileText; hint: string }[] = [
  { value: "note", label: "Note", icon: FileText, hint: "Creates a note you can expand later" },
  { value: "task", label: "Task", icon: CheckSquare, hint: "Adds to your task board" },
  { value: "inbox", label: "Inbox", icon: Inbox, hint: "Stays in quick captures, untriaged" },
];

export function QuickCaptureModal({ workspaceId }: { workspaceId: string }) {
  const open = useUiStore((s) => s.quickCaptureOpen);
  const setOpen = useUiStore((s) => s.setQuickCaptureOpen);
  const [text, setText] = useState("");
  const [destination, setDestination] = useState<Destination>("inbox");
  const [projectId, setProjectId] = useState<string>("none");

  const { data: projects } = useProjects(workspaceId);
  const createCapture = useCreateCapture(workspaceId);
  const createNote = useCreateNote(workspaceId);
  const createVoiceNote = useCreateVoiceNote();

  const submit = async () => {
    if (!text.trim()) return;
    await createCapture.mutateAsync({
      raw_text: text,
      triageInto: destination === "inbox" ? undefined : destination,
      project_id: projectId === "none" ? null : projectId,
    });
    toast.success(
      destination === "inbox"
        ? "Captured to inbox"
        : destination === "note"
          ? "Note created"
          : "Task created"
    );
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-4 text-accent" strokeWidth={1.75} />
            Quick Capture
          </DialogTitle>
          <DialogDescription>
            Capture it now, organize it later. Write it down before it&apos;s gone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-base px-3 py-2">
            <Mic className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
            <div className="flex-1">
              <VoiceRecorder
                workspaceId={workspaceId}
                compact
                onSave={async (blob, durationMs) => {
                  const note = await createNote.mutateAsync({
                    title: `Voice note · ${new Date().toLocaleDateString()}`,
                    body_markdown: "",
                    project_id: projectId === "none" ? null : projectId,
                  });
                  await createVoiceNote.mutateAsync({
                    workspaceId,
                    noteId: note.id,
                    audio: blob,
                    durationMs,
                  });
                  toast.success("Voice note captured");
                  setOpen(false);
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-border-subtle" />
            or type
            <span className="h-px flex-1 bg-border-subtle" />
          </div>

          <Textarea
            placeholder="What's on your mind?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            rows={4}
            className="resize-none"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
          />

          <div className="space-y-1.5">
            <Label className="text-xs text-secondary">Save as</Label>
            <div className="grid grid-cols-3 gap-2">
              {destinations.map((d) => {
                const Icon = d.icon;
                const active = destination === d.value;
                return (
                  <motion.button
                    key={d.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setDestination(d.value)}
                    title={d.hint}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border border-default bg-transparent px-2 py-3 text-sm font-medium text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      active && "border-accent/60 bg-accent-muted text-foreground"
                    )}
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                    {d.label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-secondary">Project (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <motion.div className="w-full" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              onClick={submit}
              disabled={!text.trim() || createCapture.isPending}
              className="w-full"
            >
              {createCapture.isPending ? "Saving…" : "Capture"}
              {!createCapture.isPending && <Zap className="size-4 ml-2" strokeWidth={1.75} />}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
