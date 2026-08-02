"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { AppNav } from "@/components/shell/AppNav";
import { TopBar } from "@/components/shell/TopBar";
import { PageLoader } from "@/components/shell/PageLoader";
import { CommandPalette } from "@/components/search/CommandPalette";
import { QuickCaptureModal } from "@/components/quick-capture/QuickCaptureModal";
import { SetupNotice } from "@/components/supabase/SetupNotice";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAutoIndex } from "@/hooks/useAutoIndex";
import { useAutoAutomation } from "@/hooks/useAutoAutomation";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: workspace, isLoading, isError } = useWorkspace();

  // Keep the embeddings index fresh in the background (silent, non-blocking).
  useAutoIndex(workspace?.id ?? null);
  // Phase 10 — evaluate automation rules + drain the job queue in the background.
  useAutoAutomation(workspace?.id ?? null);

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-base text-foreground">
        <PageLoader label="Loading your workspace…" />
      </div>
    );
  }

  if (isError || !workspace) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-base px-8 text-center text-foreground">
        <div className="rounded-md bg-accent-muted p-3">
          <LogIn className="size-6 text-accent" strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-medium">Sign in required</h3>
        <p className="max-w-sm text-sm text-faint">
          Your workspace hasn&apos;t loaded yet. Sign in to continue.
        </p>
        <Link href="/login" className="text-sm font-medium text-accent hover:text-accent-hover">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-base text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-default bg-surface">
        <div className="flex h-14 shrink-0 items-center border-b border-default px-4">
          <span className="text-sm font-semibold text-foreground">EngineerOS</span>
        </div>
        <AppNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette workspaceId={workspace.id} />
      <QuickCaptureModal workspaceId={workspace.id} />
    </div>
  );
}
