"use client";

import {
  Bold,
  Braces,
  CheckSquare,
  Code2,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table,
  TerminalSquare,
  Type,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface SlashCommand {
  id: string;
  group: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Markdown to insert at the caret. `caretOffset` is added to the end of the
   *  template to place the caret (negative values put it inside markers). */
  template: string;
  caretOffset?: number;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: "h1", group: "Text", label: "Heading 1", hint: "# ", icon: Heading1, template: "# " },
  { id: "h2", group: "Text", label: "Heading 2", hint: "## ", icon: Heading2, template: "## " },
  { id: "h3", group: "Text", label: "Heading 3", hint: "### ", icon: Heading3, template: "### " },
  { id: "bold", group: "Text", label: "Bold", hint: "**text**", icon: Bold, template: "**bold**", caretOffset: -6 },
  { id: "italic", group: "Text", label: "Italic", hint: "*text*", icon: Italic, template: "*italic*", caretOffset: -6 },
  { id: "code", group: "Text", label: "Inline code", hint: "`code`", icon: Code2, template: "`code`", caretOffset: -4 },
  { id: "link", group: "Text", label: "Link", hint: "[text](url)", icon: Link2, template: "[text](url)", caretOffset: -7 },
  { id: "image", group: "Text", label: "Image", hint: "![alt](url)", icon: Image, template: "![alt](url)", caretOffset: -8 },
  { id: "divider", group: "Text", label: "Divider", hint: "---", icon: Minus, template: "\n---\n" },
  { id: "codeblock", group: "Blocks", label: "Code block", hint: "```", icon: FileCode2, template: "```\n\n```", caretOffset: -3 },
  { id: "snippet", group: "Blocks", label: "Code snippet", hint: "```js", icon: TerminalSquare, template: "```js\n\n```", caretOffset: -3 },
  { id: "task", group: "Blocks", label: "Task list", hint: "- [ ]", icon: CheckSquare, template: "- [ ] " },
  { id: "bullet", group: "Blocks", label: "Bulleted list", hint: "- item", icon: List, template: "- " },
  { id: "numbered", group: "Blocks", label: "Numbered list", hint: "1. item", icon: ListOrdered, template: "1. " },
  { id: "quote", group: "Blocks", label: "Quote", hint: "> ", icon: Quote, template: "> " },
  { id: "table", group: "Blocks", label: "Table", hint: "| a | b |", icon: Table, template: "| Column A | Column B |\n| --- | --- |\n|  |  |" },
  { id: "callout", group: "Blocks", label: "Callout", hint: "> [!NOTE]", icon: Type, template: "> [!NOTE]\n> " },
  { id: "mermaid", group: "Blocks", label: "Mermaid diagram", hint: "```mermaid", icon: Braces, template: "```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```" },
  { id: "wikilink", group: "Blocks", label: "Wikilink", hint: "[[Title]]", icon: Link2, template: "[[Title]]", caretOffset: -6 },
];

export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
  );
}

export type SlashRow = { type: "header"; group: string } | { type: "command"; command: SlashCommand };

/** Flatten filtered commands into render rows with group headers. The parent
 *  uses the same shape so keyboard highlighting stays in sync. */
export function buildSlashRows(commands: SlashCommand[]): SlashRow[] {
  const rows: SlashRow[] = [];
  let lastGroup = "";
  for (const cmd of commands) {
    if (cmd.group !== lastGroup) {
      rows.push({ type: "header", group: cmd.group });
      lastGroup = cmd.group;
    }
    rows.push({ type: "command", command: cmd });
  }
  return rows;
}

export function SlashCommandMenu({
  rows,
  highlightIndex,
  top,
  left,
  onMouseEnter,
  onSelect,
}: {
  rows: SlashRow[];
  highlightIndex: number;
  top: number;
  left: number;
  onMouseEnter: (index: number) => void;
  onSelect: (command: SlashCommand) => void;
}) {
  const commands = rows.filter((r) => r.type === "command");
  if (commands.length === 0) {
    return (
      <div
        className="absolute z-50 w-64 rounded-lg border border-default bg-elevated p-3 shadow-popover"
        style={{ top: top + 8, left: Math.max(0, left - 4) }}
      >
        <p className="text-xs text-faint">No matches</p>
      </div>
    );
  }

  return (
    <div
      className="absolute z-50 max-h-72 w-64 overflow-y-auto rounded-lg border border-default bg-elevated p-1 shadow-popover"
      style={{ top: top + 8, left: Math.max(0, left - 4) }}
      role="listbox"
      aria-label="Insert command"
    >
      {rows.map((row, i) => {
        if (row.type === "header") {
          return (
            <p
              key={`group:${row.group}`}
              className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint"
            >
              {row.group}
            </p>
          );
        }
        const { command: cmd } = row;
        const active = i === highlightIndex;
        const Icon = cmd.icon;
        return (
          <button
            key={cmd.id}
            type="button"
            role="option"
            aria-selected={active}
            // Keep focus in the textarea so onBlur doesn't close the menu
            // before the click registers.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onMouseEnter(i)}
            onClick={() => onSelect(cmd)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              active ? "bg-accent-muted text-foreground" : "text-secondary hover:bg-surface-hover hover:text-foreground"
            )}
          >
            <Icon
              className={cn("size-4 shrink-0", active ? "text-accent" : "text-faint")}
              strokeWidth={1.75}
            />
            <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
            <kbd className="shrink-0 font-mono text-[10px] text-faint">{cmd.hint}</kbd>
          </button>
        );
      })}
    </div>
  );
}
