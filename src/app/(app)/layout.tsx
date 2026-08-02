import { AppNav } from "@/components/shell/AppNav";
import { TopBar } from "@/components/shell/TopBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
