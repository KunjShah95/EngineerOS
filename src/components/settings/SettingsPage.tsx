"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Brain,
  Building2,
  Link2,
  LogOut,
  Mail,
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
  | "integrations"
  | "appearance"
  | "account";

const SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI Provider", icon: Brain },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "appearance", label: "Appearance", icon: Palette },
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
