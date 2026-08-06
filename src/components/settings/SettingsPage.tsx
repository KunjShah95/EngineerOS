"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Brain,
  Building2,
  Database,
  Download,
  Link2,
  LogOut,
  Mail,
  Mic,
  Moon,
  Palette,
  Settings,
  ShieldAlert,
  Sun,
  Upload,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageLoader } from "@/components/shell/PageLoader";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useThemeStore } from "@/lib/store/theme";
import { createClient } from "@/lib/supabase/client";
import { useSyncedState } from "@/lib/use-synced-state";
import { useQueryClient } from "@tanstack/react-query";
import { GitHubSection } from "@/components/integrations/GitHubSection";
import { useAiConfig } from "@/hooks/useAiConfig";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type SettingsSection =
  | "profile"
  | "workspace"
  | "notifications"
  | "ai"
  | "voice"
  | "integrations"
  | "appearance"
  | "data"
  | "account";

const SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI Provider", icon: Brain },
  { id: "voice", label: "Voice Agent", icon: Mic },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "data", label: "Data", icon: Database },
  { id: "account", label: "Account", icon: ShieldAlert },
];

export function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace();
  const updateProfile = useUpdateProfile();

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const [displayName, setDisplayName] = useSyncedState(profile?.display_name ?? "");
  const [workspaceName, setWorkspaceName] = useSyncedState(workspace?.name ?? "");
  const [notifEmail, setNotifEmail] = useSyncedState(workspace?.email ?? "");
  const [savingName, setSavingName] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiProvider, setAiProvider] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [savingAi, setSavingAi] = useState(false);
  const { data: aiConfigData } = useAiConfig();

  // Voice TTS — multi-provider BYOK
  type VoiceRow = { provider: string; apiKey: string; speaker: string; languageCode: string; isDefault: boolean };
  const [voiceRows, setVoiceRows] = useState<VoiceRow[]>([]);
  const [voiceRowsLoaded, setVoiceRowsLoaded] = useState(false);
  const [savingVoice, setSavingVoice] = useState<string | null>(null);
  const [newVoiceProvider, setNewVoiceProvider] = useState("openai");
  const [newVoiceKey, setNewVoiceKey] = useState("");
  const [newVoiceSpeaker, setNewVoiceSpeaker] = useState("nova");
  const [newVoiceLang, setNewVoiceLang] = useState("en-IN");

  const [prevProvider, setPrevProvider] = useState(aiConfigData?.provider ?? null);
  if (aiConfigData?.provider && aiConfigData.provider !== prevProvider) {
    setPrevProvider(aiConfigData.provider);
    setAiProvider(aiConfigData.provider);
  }

  const saveDisplayName = async () => {
    if (!displayName.trim()) return;
    setSavingName(true);
    try {
      await updateProfile.mutateAsync({ display_name: displayName.trim() });
      toast.success("Display name updated");
    } catch {
      toast.error("Failed to update display name");
    } finally {
      setSavingName(false);
    }
  };

  const saveWorkspaceName = async () => {
    if (!workspace || !workspaceName.trim()) return;
    setSavingName(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("workspaces")
        .update({ name: workspaceName.trim() })
        .eq("id", workspace.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Workspace name updated");
    } catch {
      toast.error("Failed to update workspace name");
    } finally {
      setSavingName(false);
    }
  };

  const saveNotifications = async () => {
    if (!workspace) return;
    setSavingNotif(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("workspaces")
        .update({ email: notifEmail.trim() || null })
        .eq("id", workspace.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Notification email saved");
    } catch {
      toast.error("Failed to save notification email");
    } finally {
      setSavingNotif(false);
    }
  };

  const toggleWeeklyDigest = async (enabled: boolean) => {
    if (!workspace) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("workspaces")
      .update({ weekly_digest: enabled })
      .eq("id", workspace.id);
    if (error) {
      toast.error("Failed to update digest setting");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
    toast.success(enabled ? "Weekly digest enabled" : "Weekly digest disabled");
  };

  const uploadAvatar = async (file: File) => {
    if (!profile) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${profile.id}/avatar.${ext}`;
      const { error: upError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upError) throw upError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile.mutateAsync({ avatar_url: data.publicUrl });
      toast.success("Avatar updated");
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const saveAiProvider = async () => {
    setSavingAi(true);
    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey, baseUrl: aiBaseUrl || undefined }),
      });
      if (!res.ok) throw new Error("Failed to save AI provider");
      setAiApiKey("");
      await queryClient.invalidateQueries({ queryKey: ["ai_config"] });
      toast.success("AI provider saved — your key is stored securely per workspace");
    } catch {
      toast.error("Failed to save AI provider");
    } finally {
      setSavingAi(false);
    }
  };

  // Load voice configs when entering the voice section
  const loadVoiceRows = async () => {
    if (!workspace) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("voice_tts_configs")
      .select("provider, api_key, speaker, language_code, is_default")
      .eq("workspace_id", workspace.id)
      .order("is_default", { ascending: false });
    setVoiceRows(
      (data ?? []).map((r: Record<string, unknown>) => ({
        provider: r.provider as string,
        apiKey: "",
        speaker: (r as Record<string, unknown>).speaker as string ?? "nova",
        languageCode: (r as Record<string, unknown>).language_code as string ?? "en-IN",
        isDefault: (r as Record<string, unknown>).is_default as boolean ?? false,
      }))
    );
    setVoiceRowsLoaded(true);
  };

  const saveVoiceProvider = async () => {
    if (!workspace || !newVoiceKey.trim() || !newVoiceProvider) return;
    setSavingVoice("new");
    try {
      const supabase = createClient();
      await supabase.from("voice_tts_configs").upsert({
        workspace_id: workspace.id,
        provider: newVoiceProvider,
        api_key: newVoiceKey.trim(),
        speaker: newVoiceSpeaker,
        language_code: newVoiceLang,
        is_default: voiceRows.length === 0,
      }, { onConflict: "workspace_id,provider" });
      setNewVoiceKey("");
      await loadVoiceRows();
      toast.success(`${newVoiceProvider} voice provider saved`);
    } catch { toast.error("Failed to save voice provider"); }
    finally { setSavingVoice(null); }
  };

  const setVoiceDefault = async (provider: string) => {
    if (!workspace) return;
    const supabase = createClient();
    await supabase.from("voice_tts_configs").update({ is_default: false }).eq("workspace_id", workspace.id);
    await supabase.from("voice_tts_configs").update({ is_default: true }).eq("workspace_id", workspace.id).eq("provider", provider);
    await loadVoiceRows();
    toast.success(`${provider} set as default voice`);
  };

  const removeVoiceProvider = async (provider: string) => {
    if (!workspace) return;
    const supabase = createClient();
    await supabase.from("voice_tts_configs").delete().eq("workspace_id", workspace.id).eq("provider", provider);
    await loadVoiceRows();
    toast.success(`${provider} removed`);
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    queryClient.clear();
    router.push("/");
    router.refresh();
  };

  const deleteAccount = async () => {
    if (!workspace) return;
    const supabase = createClient();
    await supabase
      .from("workspaces")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", workspace.id);
    await supabase.auth.signOut();
    queryClient.clear();
    toast.success("Workspace flagged for deletion");
    router.push("/");
    router.refresh();
  };

  if (profileLoading || workspaceLoading || !profile || !workspace) {
    return <PageLoader label="Loading settings…" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <PageHeader
        icon={Settings}
        title="Settings"
        description="Manage your profile, workspace, and account."
      />

      <div className="mt-2 flex gap-6">
        {/* Settings sidebar */}
        <aside className="w-44 shrink-0">
          <nav className="sticky top-6 flex flex-col gap-0.5">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    active
                      ? "bg-accent-muted/60 text-foreground"
                      : "text-secondary hover:bg-surface-hover hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors duration-150",
                      active ? "text-accent" : "text-secondary"
                    )}
                    strokeWidth={1.75}
                  />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Section content */}
        <div className="min-w-0 flex-1">
          {/* Profile */}
          {activeSection === "profile" && (
            <section className="rounded-lg border border-default bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold">Profile</h2>

              <div className="mb-5 flex items-center gap-4">
                <Avatar size="lg">
                  {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
                  <AvatarFallback>
                    {(profile.display_name || profile.email || "?")
                      .split(/[\s@]+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase() ?? "")
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label
                    htmlFor="avatar-upload"
                    className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
                  >
                    <Upload className="size-4" strokeWidth={1.75} />
                    {uploading ? "Uploading…" : "Upload avatar"}
                  </Label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadAvatar(file);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-xs text-faint">Stored in your Supabase avatars bucket.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="display-name">Display name</Label>
                <div className="flex gap-2">
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveDisplayName();
                    }}
                  />
                  <Button
                    onClick={() => void saveDisplayName()}
                    disabled={savingName || !displayName.trim()}
                  >
                    {savingName ? "Saving…" : "Save"}
                  </Button>
                </div>
                <p className="text-xs text-faint">{profile.email}</p>
              </div>
            </section>
          )}

          {/* Workspace */}
          {activeSection === "workspace" && (
            <section className="rounded-lg border border-default bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold">Workspace</h2>
              <div className="space-y-1.5">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <div className="flex gap-2">
                  <Input
                    id="workspace-name"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveWorkspaceName();
                    }}
                  />
                  <Button
                    onClick={() => void saveWorkspaceName()}
                    disabled={savingName || !workspaceName.trim()}
                  >
                    {savingName ? "Saving…" : "Save"}
                  </Button>
                </div>
                <p className="text-xs text-faint">One workspace per account in this version.</p>
              </div>
            </section>
          )}

          {/* Notifications */}
          {activeSection === "notifications" && (
            <section className="rounded-lg border border-default bg-surface p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Bell className="size-4 text-accent" strokeWidth={1.75} />
                Notifications
              </h2>
              <div className="space-y-1.5">
                <Label htmlFor="notif-email">Notification email</Label>
                <div className="flex gap-2">
                  <Input
                    id="notif-email"
                    type="email"
                    value={notifEmail}
                    onChange={(e) => setNotifEmail(e.target.value)}
                    placeholder="you@example.com"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveNotifications();
                    }}
                  />
                  <Button onClick={() => void saveNotifications()} disabled={savingNotif}>
                    {savingNotif ? "Saving…" : "Save"}
                  </Button>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-faint">
                  <Mail className="size-3" strokeWidth={1.75} />
                  Task reminders from recurring rules are mirrored here when set.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-4">
                <div>
                  <p className="text-sm font-medium">Weekly digest</p>
                  <p className="text-xs text-faint">A Sunday summary of completed tasks and new notes.</p>
                </div>
                <Switch
                  checked={workspace.weekly_digest}
                  onCheckedChange={(v) => void toggleWeeklyDigest(v)}
                  aria-label="Weekly digest"
                />
              </div>
            </section>
          )}

          {/* AI Provider */}
          {activeSection === "ai" && (
            <section className="rounded-lg border border-default bg-surface p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Brain className="size-4 text-accent" strokeWidth={1.75} />
                AI Provider
              </h2>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-provider">Provider</Label>
                  <select
                    id="ai-provider"
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="w-full rounded-md border border-border-default bg-base px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">Default (OpenAI)</option>
                    {(aiConfigData?.providers ?? []).map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName} {p.configured ? "✓" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {aiProvider && (
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-base-url">Base URL <span className="text-faint font-normal">(optional)</span></Label>
                    <Input
                      id="ai-base-url"
                      type="url"
                      value={aiBaseUrl}
                      onChange={(e) => setAiBaseUrl(e.target.value)}
                      placeholder={
                        {
                          openai: "https://api.openai.com/v1",
                          anthropic: "https://api.anthropic.com/v1",
                          groq: "https://api.groq.com/openai/v1",
                          mistral: "https://api.mistral.ai/v1",
                          huggingface: "https://api-inference.huggingface.co",
                          openrouter: "https://openrouter.ai/api/v1",
                          cohere: "https://api.cohere.com/v1",
                          gemini: "https://generativelanguage.googleapis.com/v1beta",
                          "nvidia-nim": "https://integrate.api.nvidia.com/v1",
                        }[aiProvider] ?? "https://..."
                      }
                    />
                    <p className="text-xs text-faint">Leave blank to use the provider default. Override for self-hosted or proxy endpoints.</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="ai-api-key">API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ai-api-key"
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder="Enter your API key"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveAiProvider();
                      }}
                    />
                    <Button
                      onClick={() => void saveAiProvider()}
                      disabled={savingAi || !aiProvider}
                    >
                      {savingAi ? "Saving…" : "Save"}
                    </Button>
                  </div>
                  <p className="text-xs text-faint">
                    {aiConfigData?.configured
                      ? `Using ${aiConfigData.providerName ?? aiConfigData.provider ?? "AI"} — your key stays in your own workspace.`
                      : "No AI key saved yet. Bring your own key to unlock AI features (works without one too)."}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Voice Agent */}
          {activeSection === "voice" && (
            <section className="rounded-lg border border-default bg-surface p-5 space-y-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Mic className="size-4 text-accent" strokeWidth={1.75} />
                Voice Agent — BYOK TTS
              </h2>
              <p className="text-xs text-faint">Configure one or more voice providers. Switch between them live from the floating mic button. Keys stored securely per workspace.</p>

              {/* Load on first open */}
              {!voiceRowsLoaded && (
                <button type="button" onClick={() => void loadVoiceRows()} className="text-sm text-accent underline">
                  Load configured providers
                </button>
              )}

              {/* Configured provider cards */}
              {voiceRows.length > 0 && (
                <div className="space-y-2">
                  {voiceRows.map((row) => (
                    <div key={row.provider} className="flex items-center justify-between rounded-lg border border-border-subtle bg-elevated px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground capitalize">{row.provider} {row.isDefault && <span className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">default</span>}</p>
                        <p className="text-xs text-faint">Speaker: {row.speaker} · {row.languageCode}</p>
                      </div>
                      <div className="flex gap-2">
                        {!row.isDefault && (
                          <Button variant="ghost" size="sm" onClick={() => void setVoiceDefault(row.provider)}>Set default</Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => void removeVoiceProvider(row.provider)} className="text-danger hover:text-danger">Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add / update provider */}
              <div className="space-y-3 rounded-lg border border-border-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Add / update provider</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="vp-provider">Provider</Label>
                    <select id="vp-provider" value={newVoiceProvider} onChange={(e) => setNewVoiceProvider(e.target.value)}
                      className="w-full rounded-md border border-border-default bg-base px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60">
                      <option value="openai">OpenAI TTS (nova, alloy, echo…)</option>
                      <option value="sarvam">Sarvam AI 🇮🇳 (Hindi/Gujarati/Tamil…)</option>
                      <option value="elevenlabs">ElevenLabs (ultra-realistic)</option>
                      <option value="kokoro">Kokoro via HuggingFace (open-source)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="vp-speaker">
                      {newVoiceProvider === "openai" ? "Voice" : newVoiceProvider === "sarvam" ? "Speaker" : newVoiceProvider === "elevenlabs" ? "Voice ID" : "Model"}
                    </Label>
                    {newVoiceProvider === "openai" ? (
                      <select id="vp-speaker" value={newVoiceSpeaker} onChange={(e) => setNewVoiceSpeaker(e.target.value)}
                        className="w-full rounded-md border border-border-default bg-base px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60">
                        {["nova","alloy","echo","fable","onyx","shimmer"].map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : newVoiceProvider === "sarvam" ? (
                      <select id="vp-speaker" value={newVoiceSpeaker} onChange={(e) => setNewVoiceSpeaker(e.target.value)}
                        className="w-full rounded-md border border-border-default bg-base px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60">
                        {["meera","pavithra","maitreyi","arvind","amol","arjun","siya"].map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (
                      <Input id="vp-speaker" value={newVoiceSpeaker} onChange={(e) => setNewVoiceSpeaker(e.target.value)} placeholder={newVoiceProvider === "elevenlabs" ? "Voice ID or name" : "Kokoro-82M"} />
                    )}
                  </div>
                </div>
                {newVoiceProvider === "sarvam" && (
                  <div className="space-y-1">
                    <Label htmlFor="vp-lang">Language</Label>
                    <select id="vp-lang" value={newVoiceLang} onChange={(e) => setNewVoiceLang(e.target.value)}
                      className="w-full rounded-md border border-border-default bg-base px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60">
                      <option value="en-IN">English (India)</option>
                      <option value="hi-IN">Hindi</option>
                      <option value="gu-IN">Gujarati</option>
                      <option value="ta-IN">Tamil</option>
                      <option value="te-IN">Telugu</option>
                      <option value="mr-IN">Marathi</option>
                      <option value="bn-IN">Bengali</option>
                      <option value="kn-IN">Kannada</option>
                      <option value="ml-IN">Malayalam</option>
                      <option value="pa-IN">Punjabi</option>
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="vp-key">API Key</Label>
                  <div className="flex gap-2">
                    <Input id="vp-key" type="password" value={newVoiceKey} onChange={(e) => setNewVoiceKey(e.target.value)}
                      placeholder={newVoiceProvider === "sarvam" ? "sarvam_..." : newVoiceProvider === "elevenlabs" ? "sk_..." : newVoiceProvider === "kokoro" ? "hf_..." : "sk-..."} />
                    <Button onClick={() => void saveVoiceProvider()} disabled={savingVoice === "new" || !newVoiceKey.trim()}>
                      {savingVoice === "new" ? "Saving…" : "Save"}
                    </Button>
                  </div>
                  <p className="text-xs text-faint">
                    {newVoiceProvider === "sarvam" && "Get key at sarvam.ai — supports 10 Indian languages, very natural voices"}
                    {newVoiceProvider === "openai" && "Uses tts-1 model — 6 voices, fast, high quality"}
                    {newVoiceProvider === "elevenlabs" && "Most realistic voice cloning — get key at elevenlabs.io"}
                    {newVoiceProvider === "kokoro" && "Open-source Kokoro-82M via HuggingFace — get key at huggingface.co"}
                  </p>
                </div>
              </div>

              <p className="text-xs text-faint">Priority order when speaking: your default provider → Sarvam env var → OpenAI env var → Kokoro env var → browser TTS.</p>
            </section>
          )}

          {/* Integrations */}
          {activeSection === "integrations" && (
            <section className="rounded-lg border border-default bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold">Integrations</h2>
              <GitHubSection workspaceId={workspace.id} />
            </section>
          )}

          {/* Appearance */}
          {activeSection === "appearance" && (
            <section className="rounded-lg border border-default bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold">Appearance</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-faint">Dark is default — light is the alternate.</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <>
                      <Moon className="size-4" strokeWidth={1.75} />
                      Dark
                    </>
                  ) : (
                    <>
                      <Sun className="size-4" strokeWidth={1.75} />
                      Light
                    </>
                  )}
                </Button>
              </div>
            </section>
          )}

          {/* Data */}
          {activeSection === "data" && (
            <section className="rounded-lg border border-default bg-surface p-5 space-y-6">
              <h2 className="text-sm font-semibold">Data</h2>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Export</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const supabase = createClient();
                      const { data } = await supabase
                        .from("notes")
                        .select("title, body_markdown")
                        .eq("workspace_id", workspace.id)
                        .is("deleted_at", null);
                      if (!data?.length) { toast.error("No notes to export"); return; }
                      const content = data.map((n: { title: string; body_markdown: string | null }) => `# ${n.title}\n\n${n.body_markdown ?? ""}`).join("\n\n---\n\n");
                      const a = Object.assign(document.createElement("a"), {
                        href: URL.createObjectURL(new Blob([content], { type: "text/markdown" })),
                        download: "notes-export.md",
                      });
                      a.click();
                      toast.success(`Exported ${data.length} notes`);
                    }}
                  >
                    <Download className="size-4" strokeWidth={1.75} />
                    Export notes (.md)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const supabase = createClient();
                      const { data } = await supabase
                        .from("tasks")
                        .select("title, status, priority, due_date, description")
                        .eq("workspace_id", workspace.id)
                        .is("deleted_at", null);
                      if (!data?.length) { toast.error("No tasks to export"); return; }
                      const header = "title,status,priority,due_date,description";
                      const rows = data.map((t: { title: string | null; status: string | null; priority: string | null; due_date: string | null; description: string | null }) =>
                        [t.title, t.status, t.priority, t.due_date ?? "", (t.description ?? "").replace(/"/g, '""')]
                          .map((v) => `"${v}"`).join(",")
                      );
                      const a = Object.assign(document.createElement("a"), {
                        href: URL.createObjectURL(new Blob([[header, ...rows].join("\n")], { type: "text/csv" })),
                        download: "tasks.csv",
                      });
                      a.click();
                      toast.success(`Exported ${data.length} tasks`);
                    }}
                  >
                    <Download className="size-4" strokeWidth={1.75} />
                    Export tasks (.csv)
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Import</p>

                <div className="space-y-1.5">
                  <Label htmlFor="import-tasks">Import tasks from CSV</Label>
                  <p className="text-xs text-faint">Columns: title (required), status, priority, due_date</p>
                  <input
                    id="import-tasks"
                    type="file"
                    accept=".csv"
                    className="block text-sm text-secondary file:mr-3 file:rounded file:border file:border-border-subtle file:bg-surface file:px-2 file:py-1 file:text-xs file:font-medium"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
                      if (lines.length < 2) { toast.error("CSV needs header + at least one row"); return; }
                      const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
                      const ti = headers.indexOf("title");
                      const si = headers.indexOf("status");
                      const pi = headers.indexOf("priority");
                      const di = headers.indexOf("due_date");
                      if (ti === -1) { toast.error("No 'title' column found"); return; }
                      const supabase = createClient();
                      let count = 0;
                      for (const line of lines.slice(1)) {
                        const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
                        const title = cols[ti];
                        if (!title) continue;
                        await supabase.from("tasks").insert({
                          workspace_id: workspace.id,
                          title,
                          status: si >= 0 ? cols[si] || "todo" : "todo",
                          priority: pi >= 0 ? cols[pi] || "none" : "none",
                          due_date: di >= 0 ? cols[di] || null : null,
                          position: count,
                        });
                        count++;
                      }
                      toast.success(`Imported ${count} tasks`);
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="import-note">Import note from markdown (.md)</Label>
                  <input
                    id="import-note"
                    type="file"
                    accept=".md,.txt"
                    className="block text-sm text-secondary file:mr-3 file:rounded file:border file:border-border-subtle file:bg-surface file:px-2 file:py-1 file:text-xs file:font-medium"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      const firstLine = text.split("\n")[0] ?? "";
                      const title = firstLine.startsWith("# ")
                        ? firstLine.slice(2).trim()
                        : file.name.replace(/\.md$/, "").replace(/-/g, " ");
                      const body = firstLine.startsWith("# ")
                        ? text.split("\n").slice(1).join("\n").trim()
                        : text;
                      const supabase = createClient();
                      await supabase.from("notes").insert({ workspace_id: workspace.id, title, body_markdown: body });
                      toast.success("Note imported");
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Account */}
          {activeSection === "account" && (
            <section className="rounded-lg border border-default bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold">Account</h2>
              <div className="space-y-3">
                <Button variant="outline" className="w-full" onClick={() => void logout()}>
                  <LogOut className="size-4" strokeWidth={1.75} />
                  Log out
                </Button>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full text-danger hover:bg-danger/10 hover:text-danger"
                    >
                      <ShieldAlert className="size-4" strokeWidth={1.75} />
                      Delete account
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Delete your account?</DialogTitle>
                      <DialogDescription>
                        Your workspace will be flagged and closed. Your data is preserved but no
                        longer accessible — nothing is hard-deleted in this version.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogTrigger asChild>
                        <Button variant="ghost">Cancel</Button>
                      </DialogTrigger>
                      <Button variant="destructive" onClick={() => void deleteAccount()}>
                        Delete account
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
