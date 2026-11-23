-- Strynd — Postgres schema (Vercel Postgres / Neon, or any Postgres).
-- This file mirrors lib/db/schema.ts (the copy the app actually runs at startup)
-- and is kept only as a human-readable reference / for manual use — you never
-- need to run it by hand, the app self-provisions its schema on first connection.

create extension if not exists "pgcrypto";

-- One-time rename from the old "clients"/"cohort" model to "people"/"group".
-- Everything is renamed in place (ALTER ... RENAME), never dropped and
-- recreated, so existing rows, ids and foreign keys all carry over. Each step
-- is guarded, so on a fresh database or one already migrated this is a no-op.
do $$
declare
  col record;
begin
  if to_regclass('clients') is not null and to_regclass('people') is null then
    alter table clients rename to people;
  end if;

  if to_regclass('client_summaries') is not null and to_regclass('person_summaries') is null then
    alter table client_summaries rename to person_summaries;
  end if;

  for col in
    select table_name from information_schema.columns
    where table_schema = current_schema()
      and column_name = 'client_id'
      and table_name in ('notes', 'lists', 'list_items', 'tasks', 'person_summaries', 'activity')
  loop
    execute format('alter table %I rename column client_id to person_id', col.table_name);
  end loop;

  if exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'lists' and column_name = 'is_cohort'
  ) then
    alter table lists rename column is_cohort to is_group;
  end if;

  alter index if exists clients_pkey rename to people_pkey;
  alter index if exists client_summaries_pkey rename to person_summaries_pkey;
  alter index if exists clients_user_id_idx rename to people_user_id_idx;
  alter index if exists clients_last_activity_idx rename to people_last_activity_idx;
  alter index if exists clients_display_name_idx rename to people_display_name_idx;
  alter index if exists clients_search_vector_idx rename to people_search_vector_idx;
  alter index if exists notes_client_id_idx rename to notes_person_id_idx;
  alter index if exists list_items_client_id_idx rename to list_items_person_id_idx;
  alter index if exists tasks_client_id_idx rename to tasks_person_id_idx;
  alter index if exists client_summaries_client_id_idx rename to person_summaries_person_id_idx;
  alter index if exists activity_client_id_idx rename to activity_person_id_idx;

  if to_regclass('activity') is not null then
    update activity set type = 'person_created' where type = 'client_created';
  end if;
end $$;


create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  first_name text not null,
  last_name text,
  display_name text not null,
  phone text,
  email text,
  birthday date,
  status text default 'active',
  current_status text,
  next_action text,
  summary text,
  needs_followup boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

alter table people add column if not exists deleted_at timestamptz;

create index if not exists people_user_id_idx on people(user_id);
create index if not exists people_last_activity_idx on people(user_id, last_activity_at desc);
create index if not exists people_display_name_idx on people(user_id, display_name);

alter table people add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(current_status, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(next_action, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'C')
  ) stored;

create index if not exists people_search_vector_idx on people using gin(search_vector);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  person_id uuid references people(id) on delete set null,
  content text not null,
  category text,
  ai_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notes add column if not exists deleted_at timestamptz;
-- Pinned notes stay at the top of the Notes page and a person's notes.
alter table notes add column if not exists pinned_at timestamptz;

create index if not exists notes_user_id_idx on notes(user_id);
create index if not exists notes_person_id_idx on notes(person_id);
create index if not exists notes_created_at_idx on notes(user_id, created_at desc);

alter table notes add column if not exists search_vector tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists notes_search_vector_idx on notes using gin(search_vector);

create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null,
  description text,
  is_group boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table lists add column if not exists deleted_at timestamptz;

create index if not exists lists_user_id_idx on lists(user_id);
create unique index if not exists lists_user_name_idx on lists(user_id, lower(name));

alter table lists add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index if not exists lists_search_vector_idx on lists using gin(search_vector);

create table if not exists list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  list_id uuid not null references lists(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  label text not null,
  checked boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists list_items_list_id_idx on list_items(list_id, position);
create index if not exists list_items_person_id_idx on list_items(person_id);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  title text not null,
  notes text,
  person_id uuid references people(id) on delete set null,
  list_id uuid references lists(id) on delete set null,
  due_at timestamptz,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tasks add column if not exists deleted_at timestamptz;
alter table tasks add column if not exists recurrence text check (recurrence in ('daily', 'weekly', 'monthly'));
alter table tasks add column if not exists recurs_from uuid references tasks(id) on delete set null;

create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists tasks_due_at_idx on tasks(user_id, due_at);
create index if not exists tasks_person_id_idx on tasks(person_id);
create index if not exists tasks_completed_idx on tasks(user_id, completed);

alter table tasks add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'B')
  ) stored;

create index if not exists tasks_search_vector_idx on tasks using gin(search_vector);

create table if not exists person_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  person_id uuid not null references people(id) on delete cascade,
  summary text not null,
  generated_by text not null default 'fallback',
  created_at timestamptz not null default now()
);

create index if not exists person_summaries_person_id_idx on person_summaries(person_id, created_at desc);

create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  person_id uuid references people(id) on delete set null,
  list_id uuid references lists(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  note_id uuid references notes(id) on delete set null,
  type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_user_id_idx on activity(user_id, created_at desc);
create index if not exists activity_person_id_idx on activity(person_id, created_at desc);

-- Check-ins: a person showing up (or being seen) at a date/time, with a reason.
create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  person_id uuid not null references people(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists check_ins_user_id_idx on check_ins(user_id, checked_in_at desc);
create index if not exists check_ins_person_id_idx on check_ins(person_id, checked_in_at desc);

-- Demographics for funder reporting (labels from lib/demographics.ts; null = not recorded).
alter table people add column if not exists ethnicity text;
alter table people add column if not exists income_level text;
alter table people add column if not exists gender text;

-- A short note on one entry of a list.
alter table list_items add column if not exists note text;

-- Supabase Auth: whether a session must pass 2FA, set server-side.
alter table users add column if not exists mfa_enabled boolean not null default false;

-- Exits (Nov 2026): a client or customer leaves a program or stops being a customer.
-- Each organization (or solo account) keeps its own list of exit reasons, each in one of
-- three groups: positive, neutral or unplanned. Exiting keeps the person and all their
-- history; people.exited_on marks the current exit (null = active). Every exit is kept in
-- person_exits (someone can leave, come back and leave again). Each exit stores the
-- reason's group at the time, so re-grouping a reason later doesn't rewrite past reports.
create table if not exists exit_reasons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  kind text not null default 'neutral' check (kind in ('positive', 'neutral', 'unplanned')),
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (org_id is not null or user_id is not null)
);
create unique index if not exists exit_reasons_name_idx on exit_reasons (coalesce(org_id, user_id), lower(name)) where archived_at is null;
create index if not exists exit_reasons_scope_idx on exit_reasons (org_id, user_id, position);
create index if not exists exit_reasons_user_id_idx on exit_reasons (user_id);
alter table exit_reasons enable row level security;

create table if not exists person_exits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  reason_id uuid not null references exit_reasons(id) on delete cascade,
  kind text not null check (kind in ('positive', 'neutral', 'unplanned')),
  exited_on date not null,
  note text check (length(note) <= 500),
  org_id uuid references organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  reopened_at timestamptz,
  deleted_at timestamptz
);
create index if not exists person_exits_person_idx on person_exits (person_id, exited_on desc);
create index if not exists person_exits_org_idx on person_exits (org_id, exited_on) where org_id is not null;
create index if not exists person_exits_user_idx on person_exits (user_id, exited_on);
create index if not exists person_exits_reason_idx on person_exits (reason_id);
alter table person_exits enable row level security;
drop trigger if exists person_exits_inherit_org on person_exits;
create trigger person_exits_inherit_org before insert or update of person_id on person_exits for each row execute function inherit_person_org();
drop trigger if exists person_exits_audit on person_exits;
create trigger person_exits_audit after insert or update or delete on person_exits for each row execute function audit_client_change();

alter table people add column if not exists exited_on date;
create index if not exists people_exited_idx on people (exited_on) where exited_on is not null;

-- Exits follow a client who joins or leaves an organization, like everything else attached.
create or replace function people_cascade_org_exits() returns trigger language plpgsql set search_path = public as $$
begin
  if new.org_id is distinct from old.org_id then
    update person_exits set org_id = new.org_id where person_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists people_cascade_org_exits on people;
create trigger people_cascade_org_exits after update of org_id on people for each row execute function people_cascade_org_exits();

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'exit_reasons' and policyname = 'owner') then
    create policy "owner" on exit_reasons for all to authenticated
      using (org_id is null and user_id = (select auth.uid())) with check (org_id is null and user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'exit_reasons' and policyname = 'org read') then
    create policy "org read" on exit_reasons for select to authenticated using (app_private.app_org_viewer(org_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'person_exits' and policyname = 'owner') then
    create policy "owner" on person_exits for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'person_exits' and policyname = 'org read') then
    create policy "org read" on person_exits for select to authenticated using (app_private.app_org_viewer(org_id));
  end if;
end $$;
