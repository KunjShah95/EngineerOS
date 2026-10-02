import { createClient } from "@/lib/supabase/client";
import { format, addDays, subDays } from "date-fns";

/** Stable name so we can detect / remove sample data without a schema change. */
export const SAMPLE_PROJECT_NAME = "Sample: EngineerOS tour";

export async function hasSampleData(workspaceId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", SAMPLE_PROJECT_NAME)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Seeds a realistic mini workspace for demos: 1 project, 3 notes with
 * wikilinks, 4 tasks, 1 multi-day event, and today's journal entry.
 * Idempotent — no-ops if the sample project already exists. A failed
 * seed rolls itself back so a half-demo never marks the workspace seeded.
 */
export async function seedSampleWorkspace(workspaceId: string): Promise<void> {
  if (await hasSampleData(workspaceId)) return;

  try {
    await seedSampleRows(workspaceId);
  } catch (err) {
    await clearSampleWorkspace(workspaceId).catch(() => {
      // Best-effort rollback; the next seed attempt retries from scratch.
    });
    throw err;
  }
}

async function seedSampleRows(workspaceId: string): Promise<void> {
  const supabase = createClient();
  const today = new Date();
  const todayISO = format(today, "yyyy-MM-dd");
  const yesterdayISO = format(subDays(today, 1), "yyyy-MM-dd");
  const tomorrowISO = format(addDays(today, 1), "yyyy-MM-dd");
  const inThreeISO = format(addDays(today, 3), "yyyy-MM-dd");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      name: SAMPLE_PROJECT_NAME,
      description:
        "Demo data so Home, Calendar, Graph and Ask AI have something real to show. Soft-delete this project to clear the sample.",
      color: "#4f46e5",
      status: "active",
    })
    .select()
    .single();
  if (projectError) throw projectError;
  const projectId = project.id as string;

  const notes = [
    {
      title: "Welcome to EngineerOS",
      body_markdown: `# Welcome

This is sample data so demos aren't a wall of zeroes.

- Capture with **Quick Capture**
- Find anything with search
- Link notes with \`[[wikilinks]]\` — try [[Auth decision]] and [[Sprint checklist]]

Press \`/\` in any note for slash commands like /task, /code, /quote, /table.
`,
    },
    {
      title: "Auth decision",
      body_markdown: `# Auth decision

We chose session cookies over raw JWTs in the browser.

Related: [[Welcome to EngineerOS]] · [[Sprint checklist]]

## Why
- Simpler CSRF story with same-site cookies
- Refresh stays on the server
`,
    },
    {
      title: "Sprint checklist",
      body_markdown: `# Sprint checklist

- [ ] Ship onboarding empty states
- [ ] Calendar +N more opens day view
- [x] Seed sample workspace for demos

See also [[Auth decision]].
`,
    },
  ];

  const { data: insertedNotes, error: notesError } = await supabase
    .from("notes")
    .insert(
      notes.map((n) => ({
        workspace_id: workspaceId,
        project_id: projectId,
        title: n.title,
        body_markdown: n.body_markdown,
        pinned: n.title === "Welcome to EngineerOS",
      }))
    )
    .select("id, title");
  if (notesError) throw notesError;

  const tasks = [
    {
      title: "Review sample note links",
      status: "todo" as const,
      priority: "high" as const,
      due_date: todayISO,
      position: 0,
    },
    {
      title: "Try Ask AI on the sample notes",
      status: "in_progress" as const,
      priority: "medium" as const,
      due_date: todayISO,
      position: 1,
    },
    {
      title: "Overdue: tidy inbox captures",
      status: "todo" as const,
      priority: "urgent" as const,
      due_date: yesterdayISO,
      position: 2,
    },
    {
      title: "Plan next week's focus",
      status: "backlog" as const,
      priority: "low" as const,
      due_date: tomorrowISO,
      position: 3,
    },
  ];

  const { error: tasksError } = await supabase.from("tasks").insert(
    tasks.map((t) => ({
      workspace_id: workspaceId,
      project_id: projectId,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      position: t.position,
    }))
  );
  if (tasksError) throw tasksError;

  const eventStart = new Date(`${todayISO}T09:00:00`);
  const eventEnd = new Date(`${inThreeISO}T17:00:00`);
  const { error: eventError } = await supabase.from("events").insert({
    workspace_id: workspaceId,
    title: "EngineerOS demo week",
    description: "Sample multi-day event so Calendar isn't empty.",
    color: "blue",
    all_day: true,
    starts_at: eventStart.toISOString(),
    ends_at: eventEnd.toISOString(),
  });
  if (eventError) throw eventError;

  // Daily note — update if exists, else insert
  const { data: existingDaily } = await supabase
    .from("daily_notes")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("date", todayISO)
    .maybeSingle();

  const dailyPatch = {
    morning_goals: "- Explore the sample project\n- Open Calendar and Graph",
    journal: "Loaded sample data so the first ten minutes feel obvious.",
    wins: "- Workspace has connected notes and dated tasks",
  };

  if (existingDaily) {
    await supabase.from("daily_notes").update(dailyPatch).eq("id", existingDaily.id);
  } else {
    await supabase.from("daily_notes").insert({
      workspace_id: workspaceId,
      date: todayISO,
      ...dailyPatch,
    });
  }

  // Best-effort explicit link rows (note_links uses note_id/linked_note_id —
  // wikilinks in the markdown resolve at read time regardless).
  const inserted = (insertedNotes ?? []) as { id: string; title: string }[];
  const byTitle = new Map(inserted.map((n) => [n.title, n.id]));
  const welcomeId = byTitle.get("Welcome to EngineerOS");
  const authId = byTitle.get("Auth decision");
  const sprintId = byTitle.get("Sprint checklist");
  if (welcomeId && authId && sprintId) {
    try {
      await supabase.from("note_links").upsert(
        [
          { note_id: welcomeId, linked_note_id: authId },
          { note_id: welcomeId, linked_note_id: sprintId },
          { note_id: authId, linked_note_id: welcomeId },
          { note_id: authId, linked_note_id: sprintId },
          { note_id: sprintId, linked_note_id: authId },
        ],
        { onConflict: "note_id,linked_note_id", ignoreDuplicates: true }
      );
    } catch {
      // Best-effort: wikilinks in the note bodies still drive the graph.
    }
  }
}

/**
 * Soft-deletes the sample project and everything stamped with its project_id,
 * plus the sample calendar event (matched by title).
 */
export async function clearSampleWorkspace(workspaceId: string): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", SAMPLE_PROJECT_NAME)
    .is("deleted_at", null)
    .maybeSingle();

  if (project) {
    await supabase
      .from("notes")
      .update({ deleted_at: now })
      .eq("project_id", project.id)
      .is("deleted_at", null);
    await supabase
      .from("tasks")
      .update({ deleted_at: now })
      .eq("project_id", project.id)
      .is("deleted_at", null);
    await supabase.from("projects").update({ deleted_at: now }).eq("id", project.id);
  }

  await supabase
    .from("events")
    .update({ deleted_at: now })
    .eq("workspace_id", workspaceId)
    .eq("title", "EngineerOS demo week")
    .is("deleted_at", null);

  // Reset today's daily note only if it still holds the seeded sample strings,
  // so clearing returns to the real empty state without clobbering user edits.
  const { data: daily } = await supabase
    .from("daily_notes")
    .select("id, morning_goals, journal, wins")
    .eq("workspace_id", workspaceId)
    .eq("date", format(new Date(), "yyyy-MM-dd"))
    .maybeSingle();
  if (daily) {
    const isSample = (v: string | null) =>
      v === "- Explore the sample project\n- Open Calendar and Graph" ||
      v === "Loaded sample data so the first ten minutes feel obvious." ||
      v === "- Workspace has connected notes and dated tasks";
    if (
      isSample(daily.morning_goals) &&
      isSample(daily.journal) &&
      isSample(daily.wins) &&
      daily.morning_goals !== null
    ) {
      await supabase
        .from("daily_notes")
        .update({ morning_goals: null, journal: null, wins: null })
        .eq("id", daily.id);
    }
  }
}
