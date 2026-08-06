"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronDown, Loader2, Mic, MicOff, Volume2, X, XCircle } from "lucide-react";
import { useVoiceAgent, type TtsSelection } from "@/hooks/useVoiceAgent";
import type { OpenAiTtsVoice } from "@/app/api/ai/tts/route";
import { cn } from "@/lib/utils";

const VOICE_OPTIONS: { value: OpenAiTtsVoice; label: string; desc: string }[] = [
  { value: "nova",    label: "Nova",    desc: "Warm · natural female (default)" },
  { value: "alloy",  label: "Alloy",   desc: "Neutral · balanced" },
  { value: "echo",   label: "Echo",    desc: "Clear · male" },
  { value: "onyx",   label: "Onyx",    desc: "Deep · male" },
  { value: "shimmer",label: "Shimmer", desc: "Soft · female" },
  { value: "fable",  label: "Fable",   desc: "Expressive · British" },
];

const STATUS_LABEL: Record<string, string> = {
  idle: "Tap to speak",
  listening: "Listening…",
  processing: "Thinking…",
  speaking: "Speaking…",
};

export function VoiceAgent() {
  const [voice, setVoice] = useState<OpenAiTtsVoice>("nova");
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const tts: TtsSelection = { provider: "openai", voice };
  const { status, lastMessage, error, toggle, cancel } = useVoiceAgent(tts);
  const [open, setOpen] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const rafRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fake waveform amplitude during "listening" (just animates the orb)
  useEffect(() => {
    if (status !== "listening") {
      setAmplitude(0);
      return;
    }
    let t = 0;
    const tick = () => {
      t += 0.08;
      setAmplitude(0.4 + Math.abs(Math.sin(t)) * 0.6);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status]);

  // Keyboard: Space toggles when panel open, Escape cancels
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") {
        cancel();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggle, cancel]);

  const orbScale = status === "listening" ? 1 + amplitude * 0.18 : 1;
  const isActive = status !== "idle";

  return (
    <>
      {/* Floating orb button */}
      <motion.button
        type="button"
        aria-label="Voice agent"
        onClick={() => {
          setOpen(true);
          if (status === "idle") toggle();
        }}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full shadow-2xl transition-colors",
          isActive
            ? "bg-gradient-to-br from-violet-500 to-indigo-600"
            : "bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500"
        )}
        animate={{ scale: orbScale }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Pulse rings when listening */}
        {status === "listening" && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-violet-400/40"
              animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="absolute inset-0 rounded-full bg-indigo-400/25"
              animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
            />
          </>
        )}

        {status === "processing" ? (
          <Loader2 className="size-6 animate-spin text-white" strokeWidth={2} />
        ) : status === "speaking" ? (
          <Volume2 className="size-6 text-white" strokeWidth={2} />
        ) : status === "listening" ? (
          <Mic className="size-6 text-white" strokeWidth={2} />
        ) : (
          <Mic className="size-6 text-white" strokeWidth={1.75} />
        )}
      </motion.button>

      {/* Voice panel overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border border-border-subtle bg-surface/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    status === "listening" && "animate-pulse bg-red-400",
                    status === "processing" && "animate-pulse bg-amber-400",
                    status === "speaking" && "animate-pulse bg-emerald-400",
                    status === "idle" && "bg-faint"
                  )}
                />
                <span className="text-sm font-medium text-foreground">
                  {STATUS_LABEL[status]}
                </span>
              </div>
              <button
                type="button"
                aria-label="Close voice agent"
                onClick={() => {
                  cancel();
                  setOpen(false);
                }}
                className="rounded-md p-1 text-faint hover:bg-surface-hover hover:text-foreground"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Waveform visualization */}
            <div className="flex h-16 items-center justify-center gap-0.5 px-4">
              {Array.from({ length: 32 }).map((_, i) => {
                const bar =
                  status === "listening"
                    ? 0.15 + amplitude * Math.abs(Math.sin(i * 0.6 + Date.now() * 0.001))
                    : status === "speaking"
                    ? 0.2 + 0.4 * Math.abs(Math.sin(i * 0.5))
                    : 0.08;
                return (
                  <motion.span
                    key={i}
                    className="w-1 rounded-full bg-accent"
                    animate={{ scaleY: bar }}
                    transition={{ duration: 0.1 }}
                    style={{ height: 32, transformOrigin: "center" }}
                  />
                );
              })}
            </div>

            {/* Transcript + response + actions */}
            <div className="space-y-2 px-4 pb-4">
              {lastMessage && (
                <>
                  <div className="rounded-lg bg-elevated px-3 py-2">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">You said</p>
                    <p className="text-sm text-secondary">{lastMessage.transcript}</p>
                  </div>
                  <div className="rounded-lg bg-accent/10 px-3 py-2">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent/70">
                      Assistant
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{lastMessage.answer}</p>
                  </div>
                  {lastMessage.actions.length > 0 && (
                    <div className="space-y-1">
                      {lastMessage.actions.map((a, i) => (
                        <div key={i} className={cn("flex items-start gap-2 rounded-md px-2.5 py-1.5 text-xs",
                          a.success ? "bg-emerald-500/10 text-emerald-400" : "bg-danger/10 text-danger")}>
                          {a.success
                            ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                            : <XCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />}
                          <span>{a.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {error && (
                <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
              )}

              {/* Speak / stop button */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={toggle}
                  disabled={status === "processing"}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    status === "listening"
                      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                      : "bg-accent/15 text-accent hover:bg-accent/25"
                  )}
                >
                  {status === "listening" ? (
                    <><MicOff className="size-4" strokeWidth={1.75} />Stop</>
                  ) : (
                    <><Mic className="size-4" strokeWidth={1.75} />{status === "idle" ? "Speak" : "Again"}</>
                  )}
                </button>
              </div>

              {/* Voice picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVoicePicker((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] text-faint hover:bg-surface-hover"
                >
                  <span>Voice: <span className="text-secondary">{VOICE_OPTIONS.find((v) => v.value === voice)?.label}</span></span>
                  <ChevronDown className={cn("size-3.5 transition-transform", showVoicePicker && "rotate-180")} strokeWidth={1.75} />
                </button>
                <AnimatePresence>
                  {showVoicePicker && (
                    <motion.ul
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-xl"
                    >
                      {VOICE_OPTIONS.map((v) => (
                        <li key={v.value}>
                          <button
                            type="button"
                            onClick={() => { setVoice(v.value); setShowVoicePicker(false); }}
                            className={cn(
                              "flex w-full flex-col px-3 py-2 text-left text-xs transition-colors hover:bg-surface-hover",
                              voice === v.value && "bg-accent/10"
                            )}
                          >
                            <span className="font-medium text-foreground">{v.label}</span>
                            <span className="text-faint">{v.desc}</span>
                          </button>
                        </li>
                      ))}
                      <li className="border-t border-border-subtle px-3 py-2">
                        <span className="text-[10px] text-faint">Kokoro (open-source) used when no OpenAI key · browser TTS as final fallback</span>
                      </li>
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

              <p className="text-center text-[11px] text-faint">Space to speak · Esc to close</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
