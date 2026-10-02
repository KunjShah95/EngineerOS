// Version backfill — seed note_versions for notes that predate versioning.
//
// Time-travel answers are only as good as the history they can reconstruct, and
// `note_versions` only started filling when note editing began writing
// snapshots. A workspace that has been running for months has notes whose past
// bodies were never recorded, so a question about those dates correctly answers
// "no snapshot" — technically honest, practically useless.
//
// The temptation is to insert the current body dated at the note's created_at
// and get instant retroactive history. That is a lie with a timestamp on it: a
// note created in January and rewritten in June did not contain its June text
// in January. So backdating is allowed only when the body provably hasn't
// changed since creation, and everything else gets a snapshot dated *now* —
// which is true (this is the body as of today) and still useful, because it
// becomes the reconstruction point for the next edit.

type Supabase = NonNullable<Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>>;

export interface BackfillCandidate {
  id: string;
  title: string;
  body_markdown: string;
  created_at: string;
  updated_at: string;
}

export interface BackfillRow {
  note_id: string;
  workspace_id: string;
  title: string;
  body_markdown: string;
  created_at: string;
}

export interface BackfillPlan {
  rows: BackfillRow[];
  /** Notes backdated to created_at because they were never edited. */
  backdated: number;
  /** Notes snapshotted as-of-now because their earlier text is gone. */
  fromNow: number;
  /** Notes skipped: already has history, or an empty body worth recording. */
  skipped: number;
}

/**
 * A note edited within this window of creation is treated as never edited, so
 * its current body is the body it was born with and can be dated honestly.
 * Wide enough to absorb sub-second trigger/clock jitter between the INSERT and
 * the first UPDATE, tight enough that a real rewrite is never backdated.
 */
const UNEDITED_TOLERANCE_MS = 5_000;

/**
 * Decide what history to seed. Pure — the DB calls live in backfillVersions.
 */
export function planBackfill(
  notes: BackfillCandidate[],
  workspaceId: string,
  versionedNoteIds: Set<string>,
  now = new Date()
): BackfillPlan {
  const rows: BackfillRow[] = [];
  let backdated = 0;
  let fromNow = 0;
  let skipped = 0;

  for (const note of notes) {
    if (versionedNoteIds.has(note.id) || note.body_markdown.trim() === "") {
      skipped += 1;
      continue;
    }

    const createdMs = new Date(note.created_at).getTime();
    const updatedMs = new Date(note.updated_at).getTime();
    const neverEdited = Math.abs(updatedMs - createdMs) <= UNEDITED_TOLERANCE_MS;

    rows.push({
      note_id: note.id,
      workspace_id: workspaceId,
      title: note.title,
      body_markdown: note.body_markdown,
      created_at: neverEdited ? note.created_at : now.toISOString(),
    });
    if (neverEdited) backdated += 1;
    else fromNow += 1;
  }

  return { rows, backdated, fromNow, skipped };
}

export interface BackfillResult extends BackfillPlan {
  /** Rows actually written (a failed batch is counted here, not planned). */
  inserted: number;
  error: string | null;
}

const BATCH = 200;

/**
 * Seed one snapshot per un-versioned note. Idempotent: notes that already have
 * any version row are skipped, so re-running never duplicates history.
 */
export async function backfillVersions(
  supabase: Supabase,
  workspaceId: string
): Promise<BackfillResult> {
  const [notesRes, versionsRes] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, body_markdown, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
    supabase.from("note_versions").select("note_id").eq("workspace_id", workspaceId),
  ]);

  const notes = (notesRes.data ?? []) as BackfillCandidate[];
  const versioned = new Set(
    ((versionsRes.data ?? []) as { note_id: string }[]).map((v) => v.note_id)
  );

  const plan = planBackfill(notes, workspaceId, versioned);
  let inserted = 0;
  let firstError: string | null = null;

  for (let i = 0; i < plan.rows.length; i += BATCH) {
    const batch = plan.rows.slice(i, i + BATCH);
    const { error } = await supabase.from("note_versions").insert(batch);
    if (error) {
      // Record the failure but keep going: one bad batch shouldn't abandon the
      // rest, and a re-run picks up whatever didn't land (already-versioned
      // notes are skipped).
      firstError ??= error.message;
      continue;
    }
    inserted += batch.length;
  }

  return { ...plan, inserted, error: firstError };
}
