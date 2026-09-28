-- EngineerOS — remember webhooks EngineerOS registered on linked repos.
--
-- Linking a repo now creates its GitHub webhook automatically (when the
-- user is a repo admin). The id is stored only for hooks we created, so
-- unlinking removes ours and never a hook someone added by hand.

alter table public.github_repo_links
  add column if not exists webhook_id bigint;

comment on column public.github_repo_links.webhook_id is
  'GitHub hook id EngineerOS created for this repo; null when the hook already existed, '
  'was added manually, or could not be created (no admin rights / local deployment).';
