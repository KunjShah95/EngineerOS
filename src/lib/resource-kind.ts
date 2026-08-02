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
  code: { kind: "code", label: "Code Snippet", plural: "Code Snippets", icon: Code2, hasUrl: false, hasLanguage: true, hasReadStatus: false, hasMeetingDate: false, hasAttendees: false },
  bookmark: { kind: "bookmark", label: "Bookmark", plural: "Bookmarks", icon: Bookmark, hasUrl: true, hasLanguage: false, hasReadStatus: false, hasMeetingDate: false, hasAttendees: false },
  reading: { kind: "reading", label: "Reading Item", plural: "Reading", icon: BookOpenText, hasUrl: true, hasLanguage: false, hasReadStatus: true, hasMeetingDate: false, hasAttendees: false },
  architecture: { kind: "architecture", label: "Architecture Note", plural: "Architecture", icon: Network, hasUrl: false, hasLanguage: false, hasReadStatus: false, hasMeetingDate: false, hasAttendees: false },
  meeting: { kind: "meeting", label: "Meeting Note", plural: "Meetings", icon: Users, hasUrl: false, hasLanguage: false, hasReadStatus: false, hasMeetingDate: true, hasAttendees: true },
};

export function getResourceKindMeta(kind: ResourceKind): KindMeta {
  return KIND_META[kind];
}

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  want: "Want to Read",
  reading: "Reading",
  done: "Done",
};