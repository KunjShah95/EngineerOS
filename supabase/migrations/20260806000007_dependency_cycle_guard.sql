-- Sprint 3 follow-up — hard dependency-cycle guard.
--
-- The UI checks for cycles before inserting, but this trigger guarantees the
-- invariant at the database level: no insert may create a path from
-- depends_on_task_id back to task_id (which would close a loop together with
-- the new edge).

create or replace function public.guard_task_dependency_cycle()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    -- `union` (not `union all`) deduplicates across recursive iterations, so
    -- the traversal terminates even if pre-existing data already contains a
    -- cycle — `union all` would otherwise lap the cycle forever.
    with recursive reach(nxt) as (
      select d.depends_on_task_id
      from public.task_dependencies d
      where d.task_id = new.depends_on_task_id
      union
      select d2.depends_on_task_id
      from public.task_dependencies d2
      join reach r on d2.task_id = r.nxt
    )
    select 1 from reach where nxt = new.task_id
  ) then
    raise exception 'cannot add task dependency: would create a cycle';
  end if;
  return new;
end;
$$;

create trigger task_dependencies_cycle_guard
  before insert on public.task_dependencies
  for each row execute procedure public.guard_task_dependency_cycle();
-- Sprint 3 follow-up — hard dependency-cycle guard.
--
-- The UI checks for cycles before inserting, but this trigger guarantees the
-- invariant at the database level: no insert may create a path from
-- depends_on_task_id back to task_id (which would close a loop together with
-- the new edge).

create or replace function public.guard_task_dependency_cycle()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    -- `union` (not `union all`) deduplicates across recursive iterations, so
    -- the traversal terminates even if pre-existing data already contains a
    -- cycle — `union all` would otherwise lap the cycle forever.
    with recursive reach(nxt) as (
      select d.depends_on_task_id
      from public.task_dependencies d
      where d.task_id = new.depends_on_task_id
      union
      select d2.depends_on_task_id
      from public.task_dependencies d2
      join reach r on d2.task_id = r.nxt
    )
    select 1 from reach where nxt = new.task_id
  ) then
    raise exception 'cannot add task dependency: would create a cycle';
  end if;
  return new;
end;
$$;

create trigger task_dependencies_cycle_guard
  before insert on public.task_dependencies
  for each row execute procedure public.guard_task_dependency_cycle();
