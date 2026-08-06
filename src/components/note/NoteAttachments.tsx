"use client";

import { useRef } from "react";
import {
  ExternalLink,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  useDeleteNoteAttachment,
  useNoteAttachments,
  getAttachmentUrl,
  useUploadNoteAttachment,
} from "@/hooks/useNoteAttachments";
import { formatBytes } from "@/lib/utils";

function fileIcon(name: string, mime: string | null) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const type = mime ?? "";
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) {
    return FileImage;
  }
  if (type.startsWith("text/") || ["md", "txt", "json", "ts", "tsx", "js", "py", "sql", "css", "html"].includes(ext)) {
    return FileCode2;
  }
  if (["pdf", "doc", "docx"].includes(ext)) return FileText;
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) return FileArchive;
  return File;
}

export function NoteAttachments({
  noteId,
  workspaceId,
}: {
  noteId: string;
  workspaceId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: attachments, isLoading } = useNoteAttachments(noteId);
  const upload = useUploadNoteAttachment(noteId, workspaceId);
  const remove = useDeleteNoteAttachment(noteId);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const total = Array.from(files);
    let ok = 0;
    for (const file of total) {
      try {
        await upload.mutateAsync(file);
        ok += 1;
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    if (ok === 0) return;
    toast.success(
      ok === total.length
        ? ok === 1
          ? "File attached"
          : `${ok} files attached`
        : `${ok} of ${total.length} files attached`
    );
  };

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary uppercase tracking-wide">
          <Paperclip className="size-3.5" strokeWidth={1.75} />
          Attachments
          {attachments && attachments.length > 0 ? ` (${attachments.length})` : ""}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
          ) : (
            <Upload className="size-3.5" strokeWidth={1.75} />
          )}
          Attach
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-faint">Loading…</p>
      ) : !attachments || attachments.length === 0 ? (
        <p className="text-xs text-faint">
          Attach PDFs, images, archives — anything relevant to this note.
        </p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((a) => {
            const Icon = fileIcon(a.name, a.mime_type);
            return (
              <li
                key={a.id}
                className="group flex items-center gap-3 rounded-md border border-border-subtle px-3 py-2 text-sm transition-colors hover:bg-surface-hover"
              >
                <Icon className="size-4 shrink-0 text-secondary" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate" title={a.name}>
                  {a.name}
                </span>
                <span className="shrink-0 text-[11px] text-faint">
                  {a.size_bytes != null ? formatBytes(a.size_bytes) : ""}
                </span>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    void getAttachmentUrl(a.storage_path).then((url) => {
                      if (url) window.open(url, "_blank", "noopener");
                      else toast.error("Couldn't open file");
                    });
                  }}
                  aria-label={`Open ${a.name}`}
                  className="shrink-0 rounded p-1 text-faint opacity-0 transition-all hover:bg-surface-hover hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <ExternalLink className="size-3.5" strokeWidth={1.75} />
                </a>
                <button
                  type="button"
                  onClick={() => void remove.mutateAsync({ id: a.id, storagePath: a.storage_path })}
                  aria-label={`Delete ${a.name}`}
                  className="shrink-0 rounded p-1 text-faint opacity-0 transition-all hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
