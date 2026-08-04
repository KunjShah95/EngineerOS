-- EngineerOS — Phase: per-workspace BYOK AI config
-- Stores the workspace's selected AI provider + API key so the choice
-- survives serverless cold starts (Vercel) and is scoped to the owner.

create table public.ai_configs (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  provider text not null default 'openai',
  api_key text not null,
  updated_at timestamptz not null default now()
);

create trigger ai_configs_touch
  before update on public.ai_configs
  for each row execute procedure public.touch_updated_at();

alter table public.ai_configs enable row level security;

create policy "owner can read ai config"
  on public.ai_configs for select
  using (public.is_workspace_member(workspace_id));

create policy "owner can insert ai config"
  on public.ai_configs for insert
  with check (public.is_workspace_member(workspace_id));

create policy "owner can update ai config"
  on public.ai_configs for update
  using (public.is_workspace_member(workspace_id));

create policy "owner can delete ai config"
  on public.ai_configs for delete
  using (public.is_workspace_member(workspace_id));
