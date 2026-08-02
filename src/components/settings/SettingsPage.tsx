"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, LogOut, Mail, Moon, ShieldAlert, Sun, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
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

export function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

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
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-sm text-secondary">Manage your profile, workspace, and account.</p>
      </div>

      {/* Profile */}
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
            <Button onClick={() => void saveDisplayName()} disabled={savingName || !displayName.trim()}>
              {savingName ? "Saving…" : "Save"}
            </Button>
          </div>
          <p className="text-xs text-faint">{profile.email}</p>
        </div>
      </section>

      {/* Workspace */}
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
            <Button onClick={() => void saveWorkspaceName()} disabled={savingName || !workspaceName.trim()}>
              {savingName ? "Saving…" : "Save"}
            </Button>
          </div>
          <p className="text-xs text-faint">One workspace per account in this version.</p>
        </div>
      </section>

      {/* Notifications */}
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

      {/* Integrations */}
      <section className="rounded-lg border border-default bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Integrations</h2>
        <GitHubSection workspaceId={workspace.id} />
      </section>

      {/* Appearance */}
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

      {/* Account */}
      <section className="rounded-lg border border-default bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Account</h2>
        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => void logout()}>
            <LogOut className="size-4" strokeWidth={1.75} />
            Log out
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="w-full text-danger hover:bg-danger/10 hover:text-danger">
                <ShieldAlert className="size-4" strokeWidth={1.75} />
                Delete account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  Your workspace will be flagged and closed. Your data is preserved but no longer
                  accessible — nothing is hard-deleted in this version.
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
    </div>
  );
}
