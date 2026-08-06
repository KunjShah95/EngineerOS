-- Subtasks stored as JSONB on tasks (no separate table needed for simple checklists)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks jsonb NOT NULL DEFAULT '[]';

-- Habits tracker
CREATE TABLE IF NOT EXISTS habits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  color        text,
  frequency    text NOT NULL DEFAULT 'daily', -- 'daily' | 'weekly'
  target_days  int[] DEFAULT NULL,            -- null = every day; [0..6] for weekly (0=Sun)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE TABLE IF NOT EXISTS habit_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id   uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       date NOT NULL,
  completed  boolean NOT NULL DEFAULT true,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, date)
);

-- Goals / OKRs
CREATE TABLE IF NOT EXISTS goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES projects(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  target_value numeric,
  current_value numeric NOT NULL DEFAULT 0,
  unit         text,
  due_date     date,
  status       text NOT NULL DEFAULT 'active', -- 'active' | 'achieved' | 'abandoned'
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

-- RLS
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY habits_owner ON habits
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));

CREATE POLICY habit_entries_owner ON habit_entries
  USING (habit_id IN (SELECT id FROM habits WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
  )));

CREATE POLICY goals_owner ON goals
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS habit_entries_habit_date ON habit_entries(habit_id, date DESC);
CREATE INDEX IF NOT EXISTS habits_workspace ON habits(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS goals_workspace ON goals(workspace_id) WHERE deleted_at IS NULL;
