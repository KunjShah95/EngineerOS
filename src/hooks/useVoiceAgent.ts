"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceAgentStatus = "idle" | "listening" | "processing" | "speaking";

export interface AgentAction {
  tool: string;
  success: boolean;
  summary: string;
}

export interface VoiceAgentMessage {
  transcript: string;
  answer: string;
  actions: AgentAction[];
}

const SILENCE_THRESHOLD = 10; // RMS below this = silence
const SILENCE_DURATION_MS = 1500; // auto-stop after 1.5s silence
const MAX_RECORDING_MS = 30_000;

function rms(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += (data[i] - 128) ** 2;
  return Math.sqrt(sum / data.length);
}

export type TtsSelection =
  | { provider: "openai"; voice: string }
  | { provider: "sarvam"; speaker: string; languageCode: string };

// Try server TTS (Sarvam → OpenAI → Kokoro); fall back to browser SpeechSynthesis.
async function speakText(text: string, tts: TtsSelection, onEnd: () => void): Promise<void> {
  try {
    const body =
      tts.provider === "sarvam"
        ? { text, sarvamSpeaker: tts.speaker, languageCode: tts.languageCode }
        : { text, voice: tts.voice };
    const res = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        onEnd();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        fallbackSpeak(text, onEnd);
      };
      await audio.play();
      return;
    }
  } catch {
    // fall through
  }
  fallbackSpeak(text, onEnd);
}

function fallbackSpeak(text: string, onEnd: () => void) {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.05;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.toLowerCase().includes("natural") ||
        v.name.toLowerCase().includes("neural") ||
        v.name.toLowerCase().includes("premium") ||
        v.name.toLowerCase().includes("google") ||
        v.name.toLowerCase().includes("samantha"))
  );
  if (preferred) utt.voice = preferred;
  utt.onend = onEnd;
  utt.onerror = onEnd;
  window.speechSynthesis.speak(utt);
}

const DEFAULT_TTS: TtsSelection = { provider: "openai", voice: "nova" };

export function useVoiceAgent(tts: TtsSelection = DEFAULT_TTS) {
  const [status, setStatus] = useState<VoiceAgentStatus>("idle");
  const [lastMessage, setLastMessage] = useState<VoiceAgentMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTimers = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    silenceTimerRef.current = null;
    maxTimerRef.current = null;
    rafRef.current = null;
  };

  const teardownRecording = () => {
    stopTimers();
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    analyserRef.current = null;
  };

  const submitAudio = useCallback(
    async (blob: Blob) => {
      setStatus("processing");
      try {
        const fd = new FormData();
        fd.append("audio", blob, "voice.webm");
        const res = await fetch("/api/ai/voice-chat", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`voice-chat ${res.status}`);
        const data = (await res.json()) as {
          transcript?: string;
          answer?: string;
          actions?: AgentAction[];
          error?: string;
        };
        if (data.error || !data.answer) throw new Error(data.error ?? "no answer");

        const msg: VoiceAgentMessage = {
          transcript: data.transcript ?? "",
          answer: data.answer,
          actions: data.actions ?? [],
        };
        setLastMessage(msg);
        setStatus("speaking");

        await speakText(data.answer, tts, () => setStatus("idle"));
      } catch (err) {
        setError((err as Error).message);
        setStatus("idle");
      }
    },
    [tts]
  );

  const stopListening = useCallback(() => {
    stopTimers();
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      teardownRecording();
      setStatus("idle");
      return;
    }
    recorder.onstop = () => {
      teardownRecording();
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];
      if (blob.size > 1000) {
        void submitAudio(blob);
      } else {
        setStatus("idle");
      }
    };
    recorder.stop();
  }, [submitAudio]);

  const startListening = useCallback(async () => {
    if (status !== "idle") return;
    setError(null);
    setStatus("listening");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone permission denied");
      setStatus("idle");
      return;
    }
    streamRef.current = stream;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(200);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    let isSilent = false;

    const poll = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(buf);
      const level = rms(buf);
      if (level < SILENCE_THRESHOLD) {
        if (!isSilent) {
          isSilent = true;
          silenceTimerRef.current = setTimeout(() => stopListening(), SILENCE_DURATION_MS);
        }
      } else {
        if (isSilent) {
          isSilent = false;
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);

    maxTimerRef.current = setTimeout(() => stopListening(), MAX_RECORDING_MS);
  }, [status, stopListening]);

  const cancel = useCallback(() => {
    window.speechSynthesis.cancel();
    stopTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    teardownRecording();
    chunksRef.current = [];
    setStatus("idle");
  }, []);

  const toggle = useCallback(() => {
    if (status === "idle") void startListening();
    else cancel();
  }, [status, startListening, cancel]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, lastMessage, error, toggle, startListening, stopListening, cancel };
}
