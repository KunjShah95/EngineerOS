-- Allow per-workspace custom base URL for self-hosted AI providers (e.g. NVIDIA NIM).
alter table public.ai_configs add column if not exists base_url text;
