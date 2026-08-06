-- Snippets: reusable code/text fragments
CREATE TABLE IF NOT EXISTS snippets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT 'Untitled snippet',
  body         text NOT NULL DEFAULT '',
  language     text NOT NULL DEFAULT 'plaintext',
  tags         jsonb NOT NULL DEFAULT '[]',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY snippets_owner ON snippets
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS snippets_workspace ON snippets(workspace_id, created_at DESC);

-- Contacts / People
CREATE TABLE IF NOT EXISTS contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name           text NOT NULL DEFAULT 'New Contact',
  email          text,
  role           text,
  company        text,
  notes_markdown text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contacts_owner ON contacts
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS contacts_workspace ON contacts(workspace_id, name ASC);

-- Note version history (append-only snapshots)
CREATE TABLE IF NOT EXISTS note_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id        uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title          text NOT NULL,
  body_markdown  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY note_versions_owner ON note_versions
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
CREATE INDEX IF NOT EXISTS note_versions_note ON note_versions(note_id, created_at DESC);
