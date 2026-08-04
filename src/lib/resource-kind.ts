import {
  BookOpenText,
  Bookmark,
  Code2,
  Network,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { ResourceKind, ReadingStatus } from "@/types/database";

export type { ResourceKind };

export interface KindMeta {
  kind: ResourceKind;
  /** Route path for this kind (may differ from singular `kind`, e.g. `bookmark` → `/bookmarks`). */
  path: string;
  label: string;
  plural: string;
  icon: LucideIcon;
  hasUrl: boolean;
  hasLanguage: boolean;
  hasReadStatus: boolean;
  hasMeetingDate: boolean;
  hasAttendees: boolean;
}

const KIND_META: Record<ResourceKind, KindMeta> = {
  code: { kind: "code", path: "code", label: "Code Snippet", plural: "Code Snippets", icon: Code2, hasUrl: false, hasLanguage: true, hasReadStatus: false, hasMeetingDate: false, hasAttendees: false },
  bookmark: { kind: "bookmark", path: "bookmarks", label: "Bookmark", plural: "Bookmarks", icon: Bookmark, hasUrl: true, hasLanguage: false, hasReadStatus: false, hasMeetingDate: false, hasAttendees: false },
  reading: { kind: "reading", path: "reading", label: "Reading Item", plural: "Reading", icon: BookOpenText, hasUrl: true, hasLanguage: false, hasReadStatus: true, hasMeetingDate: false, hasAttendees: false },
  architecture: { kind: "architecture", path: "architecture", label: "Architecture Note", plural: "Architecture", icon: Network, hasUrl: false, hasLanguage: false, hasReadStatus: false, hasMeetingDate: false, hasAttendees: false },
  meeting: { kind: "meeting", path: "meetings", label: "Meeting Note", plural: "Meetings", icon: Users, hasUrl: false, hasLanguage: false, hasReadStatus: false, hasMeetingDate: true, hasAttendees: true },
};

export function getResourceKindMeta(kind: ResourceKind): KindMeta {
  return KIND_META[kind];
}

/** Route path for a resource kind (handles plural routes like `/bookmarks`). */
export function resourcePath(kind: ResourceKind): string {
  return KIND_META[kind].path;
}

/** App route to a resource detail page. */
export function resourceHref(kind: ResourceKind, id: string): string {
  return `/${resourcePath(kind)}/${id}`;
}

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  want: "Want to Read",
  reading: "Reading",
  done: "Done",
};