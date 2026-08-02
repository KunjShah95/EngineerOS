import { Loader2 } from "lucide-react";

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-48 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <Loader2 className="size-5 animate-spin text-secondary" strokeWidth={1.75} />
      <p className="text-sm text-faint">{label}</p>
    </div>
  );
}
