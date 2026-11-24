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

-- Smart forms (Nov 2026): shareable forms (public link + QR code) and the submissions
-- they collect. An organization shares its forms (Admins and Managers build them); a solo
-- account has its own. Submissions hold client answers: never public, never in URLs,
-- analytics or logs. Staff review each one (or intake creates the profile when there's
-- no possible duplicate); nothing ever overwrites an existing profile.
create table if not exists forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text check (length(description) <= 1000),
  code text not null unique check (length(code) between 8 and 40),
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'archived')),
  fields jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  template text check (length(template) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  deleted_at timestamptz
);
create index if not exists forms_scope_idx on forms (org_id, user_id, updated_at desc) where deleted_at is null;
create index if not exists forms_user_id_idx on forms (user_id);
alter table forms enable row level security;

create table if not exists form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  -- The form's fields when this was sent, so later edits never change what a submission meant.
  fields jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'needs_review', 'approved', 'processed', 'rejected')),
  person_id uuid references people(id) on delete set null,
  duplicate_ids uuid[] not null default '{}',
  assigned_to uuid references users(id) on delete set null,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  ip_hash text,
  seconds_to_complete int,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists form_submissions_form_idx on form_submissions (form_id, created_at desc) where deleted_at is null;
create index if not exists form_submissions_scope_idx on form_submissions (org_id, user_id, created_at desc) where deleted_at is null;
create index if not exists form_submissions_ip_idx on form_submissions (ip_hash, created_at desc);
create index if not exists form_submissions_user_id_idx on form_submissions (user_id);
create index if not exists form_submissions_person_idx on form_submissions (person_id) where person_id is not null;
create index if not exists form_submissions_assigned_idx on form_submissions (assigned_to) where assigned_to is not null;
alter table form_submissions enable row level security;
-- Form views (counts only, no answers or visitor details) for the completion rate.
create table if not exists form_views (
  form_id uuid not null references forms(id) on delete cascade,
  day date not null default current_date,
  views int not null default 0,
  primary key (form_id, day)
);
alter table form_views enable row level security;
drop trigger if exists form_submissions_audit on form_submissions;
create trigger form_submissions_audit after insert or update or delete on form_submissions for each row execute function audit_client_change();

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'forms' and policyname = 'owner') then
    create policy "owner" on forms for all to authenticated
      using (org_id is null and user_id = (select auth.uid())) with check (org_id is null and user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'forms' and policyname = 'org read') then
    create policy "org read" on forms for select to authenticated using (app_private.app_org_viewer(org_id));
  end if;
  -- Submissions: no "org read" for every member. The app shows them to Admins, Managers
  -- and the member they're assigned to; through Supabase's API only the owner sees them.
  if not exists (select 1 from pg_policies where tablename = 'form_submissions' and policyname = 'owner') then
    create policy "owner" on form_submissions for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;

-- Automations (Nov 2026): When → If → Then rules, no AI (lib/workflows-shared.ts,
-- lib/workflows-run.ts). An organization shares its automations (Admins and Managers
-- build them); a solo account has its own. Actions stay inside the app: tasks, in-app
-- alerts, notes, lists, fields, assignment. Nothing is sent outside, nothing is deleted.
create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  enabled boolean not null default false,
  trigger jsonb not null,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  template text check (length(template) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Rules only act on events after this moment (set each time it's turned on).
  enabled_at timestamptz,
  deleted_at timestamptz
);
create index if not exists workflows_scope_idx on workflows (org_id, user_id) where deleted_at is null;
create index if not exists workflows_trigger_idx on workflows ((trigger->>'type')) where enabled and deleted_at is null;
create index if not exists workflows_user_id_idx on workflows (user_id);
alter table workflows enable row level security;

-- One row per run (the run log). ref makes each run happen once: "e:<event id>" for an
-- event, "<person id>:<date>" for a time trigger. detail never holds client data.
create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  ref text not null,
  status text not null check (status in ('done', 'skipped', 'failed', 'capped')),
  detail text check (length(detail) <= 500),
  actions int not null default 0,
  created_at timestamptz not null default now(),
  unique (workflow_id, ref)
);
create index if not exists workflow_runs_wf_idx on workflow_runs (workflow_id, created_at desc);
create index if not exists workflow_runs_scope_idx on workflow_runs (org_id, user_id, created_at desc);
create index if not exists workflow_runs_person_idx on workflow_runs (person_id) where person_id is not null;
create index if not exists workflow_runs_user_id_idx on workflow_runs (user_id);
alter table workflow_runs enable row level security;

-- Things that happened, waiting for the 5-minute job. Written by triggers below, only
-- when an enabled automation in the same account listens for that kind. Server-only.
create table if not exists automation_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('form_submitted', 'person_added', 'person_exited', 'check_in')),
  user_id uuid not null references users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists automation_events_todo_idx on automation_events (created_at) where processed_at is null;
create index if not exists automation_events_user_id_idx on automation_events (user_id);
create index if not exists automation_events_person_idx on automation_events (person_id) where person_id is not null;
alter table automation_events enable row level security;

create or replace function queue_automation_event(k text, u uuid, o uuid, p uuid, r uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from workflows w
              where w.enabled and w.deleted_at is null and w.trigger->>'type' = k
                and ((o is not null and w.org_id = o) or (o is null and w.org_id is null and w.user_id = u))) then
    insert into automation_events (kind, user_id, org_id, person_id, ref_id) values (k, u, o, p, r);
  end if;
end $$;

create or replace function automation_event_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'people' then
    -- Imports, restores (old created_at) and sample data never start automations.
    if not new.is_sample and new.import_batch is null and new.deleted_at is null and new.created_at > now() - interval '1 hour' then
      perform queue_automation_event('person_added', new.user_id, new.org_id, new.id, new.id);
    end if;
  elsif tg_table_name = 'person_exits' then
    perform queue_automation_event('person_exited', new.user_id, new.org_id, new.person_id, new.id);
  elsif tg_table_name = 'check_ins' then
    if new.deleted_at is null and new.checked_in_at > now() - interval '2 days' then
      perform queue_automation_event('check_in', new.user_id, new.org_id, new.person_id, new.id);
    end if;
  elsif tg_table_name = 'form_submissions' then
    perform queue_automation_event('form_submitted', new.user_id, new.org_id, null, new.id);
  end if;
  return null;
end $$;
drop trigger if exists people_automation_event on people;
create trigger people_automation_event after insert on people for each row execute function automation_event_trigger();
drop trigger if exists person_exits_automation_event on person_exits;
create trigger person_exits_automation_event after insert on person_exits for each row execute function automation_event_trigger();
drop trigger if exists check_ins_automation_event on check_ins;
create trigger check_ins_automation_event after insert on check_ins for each row execute function automation_event_trigger();
drop trigger if exists form_submissions_automation_event on form_submissions;
create trigger form_submissions_automation_event after insert on form_submissions for each row execute function automation_event_trigger();

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'workflows' and policyname = 'owner') then
    create policy "owner" on workflows for select to authenticated using (org_id is null and user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'workflows' and policyname = 'org read') then
    create policy "org read" on workflows for select to authenticated using (app_private.app_org_viewer(org_id));
  end if;
  revoke execute on function queue_automation_event(text, uuid, uuid, uuid, uuid), automation_event_trigger() from public, anon, authenticated;
exception when undefined_object or invalid_schema_name or undefined_function then
  null;
end $$;

-- Dashboards and scheduled reports (Nov 2026; lib/dashboard*.ts, lib/reports-run.ts).
-- Each person keeps their own dashboard setup. Schedules email counts only (never names
-- or notes) to the schedule's owner or the organization's Admins and Managers: there is
-- no way to type in an outside address. Server-only tables.
create table if not exists dashboard_layouts (
  user_id uuid primary key references users(id) on delete cascade,
  tiles text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table dashboard_layouts enable row level security;

create table if not exists report_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  frequency text not null check (frequency in ('weekly', 'monthly')),
  weekday int not null default 1 check (weekday between 0 and 6),
  month_day int not null default 1 check (month_day between 1 and 28),
  hour int not null default 8 check (hour between 0 and 23),
  recipients text not null default 'me' check (recipients in ('me', 'managers')),
  attach_pdf boolean not null default false,
  tiles text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists report_schedules_scope_idx on report_schedules (org_id, user_id) where deleted_at is null;
create index if not exists report_schedules_user_id_idx on report_schedules (user_id);
alter table report_schedules enable row level security;

-- One row per period sent (the send log); unique per schedule and period so each report goes out once.
create table if not exists report_deliveries (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references report_schedules(id) on delete cascade,
  period text not null check (length(period) <= 20),
  status text not null check (status in ('sending', 'sent', 'failed', 'skipped')),
  recipients int not null default 0,
  attempts int not null default 0,
  detail text check (length(detail) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, period)
);
create index if not exists report_deliveries_schedule_idx on report_deliveries (schedule_id, created_at desc);
alter table report_deliveries enable row level security;
