import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/supabase/auth";
import { loadAiConfig, loadVoiceTtsConfig, loadVoiceTtsConfigs } from "@/lib/ai/db-config";
import { runWithAiConfig, getAiApiKey, getAiBaseUrl, getAiProviderName } from "@/lib/ai/server-config";

// OpenAI voices — nova is the warmest/most natural
export const OPENAI_TTS_VOICES = ["nova", "alloy", "echo", "fable", "onyx", "shimmer"] as const;
export type OpenAiTtsVoice = (typeof OPENAI_TTS_VOICES)[number];
const DEFAULT_VOICE: OpenAiTtsVoice = "nova";

type TtsResult = { buf: ArrayBuffer; mime: string } | null;

// OpenAI TTS — tts-1, mp3. Voices: nova alloy echo fable onyx shimmer.
async function openaiTtsWithKey(text: string, voice: OpenAiTtsVoice, key: string): Promise<TtsResult> {
  const base = getAiBaseUrl() ?? "https://api.openai.com/v1";
  const res = await fetch(`${base}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "tts-1", input: text.slice(0, 4096), voice, response_format: "mp3" }),
  });
  if (!res.ok) return null;
  return { buf: await res.arrayBuffer(), mime: "audio/mpeg" };
}

// Sarvam AI — Indian provider, 10 languages incl. Gujarati/Hindi/Tamil/Telugu + Indian English.
// Speakers (en-IN): meera, pavithra, maitreyi, arvind, amol, arjun, siya
// Get key: https://sarvam.ai
async function sarvamTtsWithKey(text: string, speaker: string, languageCode: string, key: string): Promise<TtsResult> {
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-subscription-key": key },
    body: JSON.stringify({
      inputs: [text.slice(0, 500)],
      target_language_code: languageCode,
      speaker,
      model: "bulbul:v1",
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { audios?: string[] };
  const b64 = json.audios?.[0];
  if (!b64) return null;
  return { buf: Buffer.from(b64, "base64").buffer as ArrayBuffer, mime: "audio/wav" };
}

// ElevenLabs — highest realism, voice cloning. Get key: https://elevenlabs.io
// Default voice IDs: Rachel=21m00Tcm4TlvDq8ikWAM, Domi=AZnzlk1XvdvUeBnXmlld
const ELEVENLABS_DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
async function elevenLabsTts(text: string, voiceIdOrName: string, key: string): Promise<TtsResult> {
  const voiceId = voiceIdOrName.length > 20 ? voiceIdOrName : ELEVENLABS_DEFAULT_VOICE_ID;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": key },
    body: JSON.stringify({ text: text.slice(0, 5000), model_id: "eleven_turbo_v2_5" }),
  });
  if (!res.ok) return null;
  return { buf: await res.arrayBuffer(), mime: "audio/mpeg" };
}

// Kokoro-82M via HuggingFace — open source, Apache 2.0, very natural quality
async function kokoroTtsWithKey(text: string, key: string): Promise<TtsResult> {
  const res = await fetch("https://api-inference.huggingface.co/models/hexgrad/Kokoro-82M", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ inputs: text.slice(0, 512) }),
  });
  if (!res.ok) return null;
  const mime = res.headers.get("content-type") ?? "audio/flac";
  return { buf: await res.arrayBuffer(), mime };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    text?: string;
    provider?: string;       // explicitly select a configured provider
    voice?: OpenAiTtsVoice;  // override OpenAI voice
    sarvamSpeaker?: string;  // override Sarvam speaker
    languageCode?: string;   // override language
  } | null;

  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ error: "missing text" }, { status: 400 });

  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  // Request-body overrides (session picker) fall through to DB config → env vars.
  const reqVoice = OPENAI_TTS_VOICES.includes(body?.voice as OpenAiTtsVoice)
    ? (body!.voice as OpenAiTtsVoice)
    : null;
  const reqSarvamSpeaker = body?.sarvamSpeaker ?? null;
  const reqLanguageCode = body?.languageCode ?? null;

  try {
    const [aiConfig, voiceConfig] = await Promise.all([
      loadAiConfig(supabase, workspace.id),
      loadVoiceTtsConfig(supabase, workspace.id, body?.provider),
    ]);

    return await runWithAiConfig(aiConfig, async () => {
      // Helper to synthesize via whichever key is available for a given provider.
      const byokKey = (provider: string) =>
        voiceConfig?.provider === provider ? (voiceConfig.apiKey ?? undefined) : undefined;

      // 1. BYOK Sarvam AI (user-configured in Settings > Voice Agent)
      if (voiceConfig?.provider === "sarvam") {
        const speaker = reqSarvamSpeaker ?? voiceConfig.speaker ?? "meera";
        const lang = reqLanguageCode ?? voiceConfig.languageCode ?? "en-IN";
        const key = voiceConfig.apiKey ?? process.env.SARVAM_API_KEY;
        if (key) {
          const r = await sarvamTtsWithKey(text, speaker, lang, key);
          if (r) return ttsResponse(r, "sarvam");
        }
      }

      // 2. BYOK ElevenLabs
      if (voiceConfig?.provider === "elevenlabs" && voiceConfig.apiKey) {
        const r = await elevenLabsTts(text, voiceConfig.speaker ?? "Rachel", voiceConfig.apiKey);
        if (r) return ttsResponse(r, "elevenlabs");
      }

      // 3. BYOK OpenAI TTS / env OpenAI
      if (!voiceConfig || voiceConfig.provider === "openai") {
        const voice = reqVoice ?? (voiceConfig?.speaker as OpenAiTtsVoice | undefined) ?? DEFAULT_VOICE;
        const key = byokKey("openai") ?? getAiApiKey() ?? process.env.OPENAI_API_KEY;
        if (key) {
          const r = await openaiTtsWithKey(text, voice, key);
          if (r) return ttsResponse(r, "openai");
        }
      }

      // 4. BYOK / env Sarvam fallback (env var path when provider not explicitly sarvam)
      {
        const key = process.env.SARVAM_API_KEY;
        const speaker = reqSarvamSpeaker ?? "meera";
        const lang = reqLanguageCode ?? "en-IN";
        if (key) {
          const r = await sarvamTtsWithKey(text, speaker, lang, key);
          if (r) return ttsResponse(r, "sarvam");
        }
      }

      // 5. Kokoro open-source via HuggingFace
      if (!voiceConfig || voiceConfig.provider === "kokoro") {
        const key =
          byokKey("kokoro") ??
          (getAiProviderName() === "huggingface" ? getAiApiKey() : undefined) ??
          process.env.HUGGINGFACE_API_KEY;
        if (key) {
          const r = await kokoroTtsWithKey(text, key);
          if (r) return ttsResponse(r, "kokoro");
        }
      }

      // 6. No server TTS — client falls back to Web Speech API
      return NextResponse.json({ error: "tts-unavailable" }, { status: 503 });
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

function ttsResponse(r: { buf: ArrayBuffer; mime: string }, provider: string) {
  return new NextResponse(r.buf, {
    headers: { "Content-Type": r.mime, "Cache-Control": "no-store", "X-Tts-Provider": provider },
  });
}
