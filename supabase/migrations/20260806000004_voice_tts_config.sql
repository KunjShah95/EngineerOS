-- EngineerOS — per-workspace BYOK voice TTS config (multi-provider)
-- One row per (workspace_id, provider). is_default marks the active one.
-- provider: 'openai' | 'sarvam' | 'elevenlabs' | 'kokoro'

create table public.voice_tts_configs (
  workspace_id  uuid    not null references public.workspaces (id) on delete cascade,
  provider      text    not null,
  api_key       text,
  speaker       text    not null default 'nova',
  language_code text    not null default 'en-IN',
  is_default    boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, provider)
);

create trigger voice_tts_configs_touch
  before update on public.voice_tts_configs
  for each row execute procedure public.touch_updated_at();

alter table public.voice_tts_configs enable row level security;

create policy "owner can manage voice tts configs"
  on public.voice_tts_configs for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
