"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Mic, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCreateVoiceNote } from "@/hooks/useVoiceNotes";
import { cn } from "@/lib/utils";

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceRecorder({
  workspaceId,
  noteId = null,
  onSaved,
  onSave,
  compact = false,
}: {
  workspaceId: string;
  noteId?: string | null;
  onSaved?: () => void;
  /** Overrides the default save path (e.g. attach to a freshly created note). */
  onSave?: (blob: Blob, durationMs: number) => Promise<void>;
  compact?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 24 }, () => 0.2));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const createVoiceNote = useCreateVoiceNote();

  const stopStream = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // stopStream is stable; only re-run when the preview URL changes.
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")
        ? "audio/ogg; codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mime });
        setBlob(finalBlob);
        setAudioUrl(URL.createObjectURL(finalBlob));
        setRecording(false);
        stopStream();
      };

      // Live level meter.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = Array.from(data.slice(0, 32)).reduce((a, b) => a + b, 0) / (32 * 255);
        setLevels((prev) => [...prev.slice(1), Math.max(0.08, avg)]);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 100), 100);
    } catch {
      toast.error("Microphone unavailable — check browser permissions");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const cancel = () => {
    setBlob(null);
    setAudioUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setLevels(Array.from({ length: 24 }, () => 0.2));
  };

  const save = async () => {
    if (!blob) return;
    setSaving(true);
    try {
      const durationMs = Math.max(1000, elapsed);
      if (onSave) {
        await onSave(blob, durationMs);
      } else {
        await createVoiceNote.mutateAsync({
          workspaceId,
          noteId,
          audio: blob,
          durationMs,
        });
      }
      toast.success(noteId ? "Voice note attached" : "Voice note saved");
      onSaved?.();
      cancel();
    } catch {
      toast.error("Failed to save voice note");
    } finally {
      setSaving(false);
    }
  };

  if (recording) {
    return (
      <div className={cn("flex items-center gap-3", compact && "w-full")}>
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
        </span>
        <div className="flex h-6 flex-1 items-end gap-0.5">
          {levels.map((l, i) => (
            <span
              key={i}
              className="w-1 shrink-0 rounded-full bg-accent transition-all duration-75"
              style={{ height: `${Math.max(8, l * 100)}%` }}
            />
          ))}
        </div>
        <span className="font-mono text-xs text-secondary tabular-nums">{formatDuration(elapsed)}</span>
        <Button size="sm" onClick={stopRecording} variant="secondary">
          <Square className="size-3.5" strokeWidth={2} />
          Stop
        </Button>
      </div>
    );
  }

  if (blob && audioUrl) {
    return (
      <div className={cn("flex items-center gap-3", compact && "w-full")}>
        <audio controls src={audioUrl} className="h-8 flex-1" />
        <span className="font-mono text-xs text-faint tabular-nums">{formatDuration(elapsed)}</span>
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> : <Check className="size-3.5" strokeWidth={2} />}
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="icon" variant="ghost" onClick={cancel} aria-label="Discard recording">
          <Trash2 className="size-3.5 text-danger" strokeWidth={1.75} />
        </Button>
      </div>
    );
  }

  return (
    <Button variant="secondary" size="sm" onClick={() => void startRecording()}>
      <Mic className="size-3.5" strokeWidth={1.75} />
      Record voice note
    </Button>
  );
}
