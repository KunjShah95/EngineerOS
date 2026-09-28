"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardPaste, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCaptureChat } from "@/hooks/useDecisions";
import { CHAT_MAX_CHARS, CHAT_MIN_CHARS } from "@/lib/decision-context";

const RESULT_MESSAGE: Record<string, string> = {
  saved: "Saved — decision extracted",
  "no-decision": "Saved as a note — no clear decision found in it",
  "no-ai": "Saved as a note — add an AI key in Settings to extract decisions",
  failed: "Saved as a note — decision extraction failed, retry from the note",
};

/**
 * Paste a ChatGPT / Claude / Slack thread and keep the reasoning: the
 * transcript becomes a searchable note, and its decision (if any) a record.
 */
export function CaptureChatDialog({ workspaceId }: { workspaceId: string | null }) {
  const router = useRouter();
  const capture = useCaptureChat(workspaceId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");

  const length = text.trim().length;
  const valid = length >= CHAT_MIN_CHARS && length <= CHAT_MAX_CHARS;

  const submit = () =>
    capture.mutate(
      { text, source },
      {
        onSuccess: ({ noteId, decision }) => {
          toast.success(RESULT_MESSAGE[decision] ?? RESULT_MESSAGE.failed);
          setOpen(false);
          setText("");
          setSource("");
          router.push(`/notes/${noteId}`);
        },
        onError: (err) => toast.error(err.message),
      },
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ClipboardPaste className="size-4" strokeWidth={1.75} />
          Paste a chat
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Capture a conversation</DialogTitle>
          <DialogDescription>
            Paste a ChatGPT, Claude or Slack thread. It&rsquo;s saved as a searchable note, and the decision in it
            becomes a record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="capture-source">Source (optional)</Label>
            <Input
              id="capture-source"
              placeholder="ChatGPT, #backend on Slack…"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capture-text">Conversation</Label>
            <Textarea
              id="capture-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the thread here…"
              className="min-h-64 font-mono text-xs"
              autoFocus
            />
            <p className="text-xs text-faint">
              {length > CHAT_MAX_CHARS
                ? `${length.toLocaleString()} / ${CHAT_MAX_CHARS.toLocaleString()} characters — trim it to the relevant part`
                : `${length.toLocaleString()} characters`}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || capture.isPending}>
            {capture.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
            {capture.isPending ? "Extracting…" : "Save & extract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
