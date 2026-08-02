import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-4 text-foreground">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-default bg-surface p-6">
        <h1 className="text-lg font-semibold">Create your account</h1>
        <p className="text-sm text-faint">Email + password auth arrives in build step 2 (Supabase).</p>
        <Button className="w-full" disabled>
          Create account
        </Button>
      </div>
    </main>
  );
}
