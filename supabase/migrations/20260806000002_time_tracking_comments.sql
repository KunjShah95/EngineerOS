-- Time tracking on tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_spent numeric DEFAULT NULL;

-- Task comments (append-only activity log)
CREATE TABLE IF NOT EXISTS task_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  body         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_comments_owner ON task_comments
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS task_comments_task ON task_comments(task_id, created_at ASC);
