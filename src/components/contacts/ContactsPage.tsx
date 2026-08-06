"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2, Mail, Plus, Trash2, User, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shell/EmptyState";
import { PageHeader } from "@/components/shell/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
} from "@/hooks/useContacts";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useSyncedState } from "@/lib/use-synced-state";
import { cn } from "@/lib/utils";
import type { Contact } from "@/types/database";

export function ContactsPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: contacts, isLoading } = useContacts(workspaceId);
  const createContact = useCreateContact(workspaceId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = (contacts ?? []).find((c) => c.id === selectedId) ?? null;

  const handleNew = async () => {
    const c = await createContact.mutateAsync({});
    setSelectedId(c.id);
    toast.success("Contact created");
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-default">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="text-sm font-semibold">Contacts</span>
          <Button size="icon" variant="ghost" onClick={() => void handleNew()} disabled={createContact.isPending}>
            <Plus className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (contacts ?? []).length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-faint">No contacts yet.</p>
          ) : (
            <div className="space-y-0.5">
              {(contacts ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150",
                    selectedId === c.id
                      ? "bg-accent-muted/60 text-foreground"
                      : "text-secondary hover:bg-surface-hover hover:text-foreground"
                  )}
                >
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-[11px] text-faint">
                    {[c.role, c.company].filter(Boolean).join(" · ") || c.email || "No details"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <ContactDetail
            key={selected.id}
            contact={selected}
            workspaceId={workspaceId}
            onDelete={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={Users}
              title="No contact selected"
              description="Pick one from the sidebar or add a new contact."
              actionLabel="New Contact"
              onAction={() => void handleNew()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ContactDetail({
  contact,
  workspaceId,
  onDelete,
}: {
  contact: Contact;
  workspaceId: string | null;
  onDelete: () => void;
}) {
  const updateContact = useUpdateContact(workspaceId);
  const deleteContact = useDeleteContact(workspaceId);

  const [name, setName] = useSyncedState(contact.name);
  const [email, setEmail] = useSyncedState(contact.email ?? "");
  const [role, setRole] = useSyncedState(contact.role ?? "");
  const [company, setCompany] = useSyncedState(contact.company ?? "");
  const [notes, setNotes] = useSyncedState(contact.notes_markdown);

  const save = useDebouncedCallback((patch: Parameters<typeof updateContact.mutate>[0]["patch"]) => {
    updateContact.mutate({ id: contact.id, patch });
  }, 600);

  const handleDelete = async () => {
    await deleteContact.mutateAsync(contact.id);
    toast.success("Contact deleted");
    onDelete();
  };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <PageHeader icon={User} title="" description="" actions={null} />
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-danger hover:bg-danger/10 hover:text-danger"
          onClick={() => void handleDelete()}
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
          Delete
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-name">Name</Label>
        <Input
          id="contact-name"
          value={name}
          onChange={(e) => { setName(e.target.value); save({ name: e.target.value }); }}
          placeholder="Full name"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">
            <Mail className="inline size-3.5 mr-1" strokeWidth={1.75} />
            Email
          </Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); save({ email: e.target.value || null }); }}
            placeholder="name@company.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-role">Role</Label>
          <Input
            id="contact-role"
            value={role}
            onChange={(e) => { setRole(e.target.value); save({ role: e.target.value || null }); }}
            placeholder="Engineer, Manager…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-company">
          <Building2 className="inline size-3.5 mr-1" strokeWidth={1.75} />
          Company
        </Label>
        <Input
          id="contact-company"
          value={company}
          onChange={(e) => { setCompany(e.target.value); save({ company: e.target.value || null }); }}
          placeholder="Acme Corp"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-notes">Notes (markdown)</Label>
        <Textarea
          id="contact-notes"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); save({ notes_markdown: e.target.value }); }}
          rows={8}
          placeholder="Context, meeting notes, links…"
        />
      </div>
    </div>
  );
}
