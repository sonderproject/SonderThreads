/**
 * Same DDL as db/schema.sql (kept there too as the human-readable reference
 * and for manual use), duplicated here as a string so the app can apply it
 * itself at runtime — see ensureSchema() in person.ts. A .sql file isn't
 * guaranteed to be included in Vercel's serverless function bundle, so the
 * source of truth the app actually runs lives in code.
 *
 * Every statement is additive (`if not exists` / `add column if not exists`)
 * so this can run against a database that already has the tables from an
 * earlier version of this file — it's a self-migrating schema, not just an
 * initial-setup script.
 */
export const SCHEMA_SQL = `
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

-- Partial (excludes soft-deleted rows) so a name can be reused after its
-- list is deleted. Dropped and recreated every run rather than
-- "if not exists" since an older, non-partial version of this index may
-- already exist from before soft deletes were added — cheap at this scale.
drop index if exists lists_user_name_idx;
create unique index lists_user_name_idx on lists(user_id, lower(name)) where deleted_at is null;

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

-- Accounts. Before accounts existed every row belonged to one fixed owner id
-- (LEGACY_OWNER_ID in lib/db/constants.ts); the first person to sign up with
-- the old shared APP_PASSWORD is created with that id, so they keep all of
-- that data without any rows being moved.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_email_idx on users(lower(email));

-- id is a SHA-256 of the session token, so a leaked copy of this table
-- can't be used to sign in. The same token works as a cookie (web) or an
-- "Authorization: Bearer" header (future native apps).
create table if not exists sessions (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_user_id_idx on sessions(user_id);

-- Forgot-password links. Like sessions, id is a SHA-256 of the emailed
-- token; a row is deleted as soon as it's used.
create table if not exists password_resets (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists password_resets_user_id_idx on password_resets(user_id);

-- Contact details for notifications. sms_opt_in is the user's explicit
-- consent to texts (carriers require it); a phone number alone isn't consent.
alter table users add column if not exists phone text;
alter table users add column if not exists sms_opt_in boolean not null default false;
-- IANA zone ("America/Chicago") from the browser, so all-day task reminders
-- go out in the morning instead of at midnight.
alter table users add column if not exists timezone text;

-- A task pulled out of a note links back to it. reminded_at marks a due
-- task whose push/text reminder has gone out, so it's sent once.
alter table tasks add column if not exists source_note_id uuid references notes(id) on delete set null;
alter table tasks add column if not exists reminded_at timestamptz;

-- Things that happened in the background and want the user's attention
-- ("Task created from your note"). Due/overdue tasks, birthdays and people
-- needing attention are computed live on the Notifications page instead.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  href text,
  task_id uuid references tasks(id) on delete cascade,
  note_id uuid references notes(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications(user_id, created_at desc);
-- A suggested task's details (title, due_at, person_id, notes), turned into
-- a real task only if the user taps Add.
alter table notifications add column if not exists payload jsonb;

-- Web Push subscriptions, one per browser/device the user turned push on in.
create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);

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

-- A short note on one entry of a list (e.g. "brought ID", "left early").
alter table list_items add column if not exists note text;

-- Supabase Auth: users.id is the Supabase auth user id. mfa_enabled is set
-- by the server when a 2FA factor is verified or removed, and decides whether
-- a session must have passed 2FA (aal2) to see data.
alter table users add column if not exists mfa_enabled boolean not null default false;

-- No silent fallback to the old single owner: an insert that forgets
-- user_id now fails instead of landing in someone else's account.
alter table people alter column user_id drop default;
alter table notes alter column user_id drop default;
alter table lists alter column user_id drop default;
alter table list_items alter column user_id drop default;
alter table tasks alter column user_id drop default;
alter table person_summaries alter column user_id drop default;
alter table activity alter column user_id drop default;

-- Optional 2FA prompt: when the person last tapped "Not now" (or "Set it
-- up"). Null = never asked. The prompt comes back 30 days later while 2FA is off.
alter table users add column if not exists mfa_prompt_dismissed_at timestamptz;

-- First-run welcome checklist on Home: dismissed, and the "on your phone" step (can't be detected).
alter table users add column if not exists welcome_dismissed_at timestamptz;
alter table users add column if not exists welcome_phone_done boolean not null default false;

-- Settings: one row per user, every option a preset (CHECK-constrained so a
-- bad value can't be saved). No row = all defaults. Missing rows are created
-- on first save.
create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  reminder_lead_minutes smallint not null default 10 check (reminder_lead_minutes in (5, 10, 30, 60)),
  daily_summary_enabled boolean not null default false,
  daily_summary_hour smallint not null default 8 check (daily_summary_hour between 0 and 23),
  daily_summary_sent_on date,
  quiet_hours_enabled boolean not null default false,
  quiet_start_hour smallint not null default 21 check (quiet_start_hour between 0 and 23),
  quiet_end_hour smallint not null default 7 check (quiet_end_hour between 0 and 23),
  idle_timeout_minutes smallint not null default 30 check (idle_timeout_minutes in (15, 30, 60)),
  updated_at timestamptz not null default now()
);

-- Auto-lock: 5 minutes to 8 hours, or "stay signed in" (no idle sign-out).
alter table user_settings add column if not exists stay_signed_in boolean not null default false;
alter table user_settings drop constraint if exists user_settings_idle_timeout_minutes_check;
alter table user_settings add constraint user_settings_idle_timeout_minutes_check
  check (idle_timeout_minutes in (5, 15, 30, 60, 120, 240, 480));

-- Front-desk kiosk: the PIN that unlocks it (scrypt hash) and the reason buttons clients see.
alter table user_settings add column if not exists kiosk_pin_hash text;
alter table user_settings add column if not exists kiosk_reasons text[];

-- app_meta is otherwise created after this script runs (lib/db/client.ts);
-- create it here so enabling RLS on it below works on a fresh database.
create table if not exists app_meta (key text primary key, value text not null);

-- ── Organizations (Phase 3; docs/ROADMAP.md) ──────────────────────────────
-- An agency and its staff. Solo accounts have no membership and work exactly
-- as before. One organization per person.
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  plan text not null default 'organization' check (plan in ('organization')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Organization info, edited by admins (Organization page) and shown on the Impact report cover.
alter table organizations add column if not exists phone text check (length(phone) <= 40);
alter table organizations add column if not exists email text check (length(email) <= 254);
alter table organizations add column if not exists website text check (length(website) <= 300);
alter table organizations add column if not exists address text check (length(address) <= 500);
alter table organizations add column if not exists about text check (length(about) <= 1000);

-- Organization logo (admins upload it; PNG or JPEG up to 1 MB, the formats the PDF can embed).
alter table organizations add column if not exists logo bytea check (octet_length(logo) <= 1048576);
alter table organizations add column if not exists logo_type text check (logo_type in ('image/png', 'image/jpeg'));
alter table organizations add column if not exists logo_updated_at timestamptz;

create table if not exists memberships (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('admin', 'supervisor', 'case_manager')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  primary key (org_id, user_id)
);
create unique index if not exists memberships_one_org_idx on memberships(user_id);

-- Invite links. Only a SHA-256 of the token is stored; the invite is for
-- one email address and expires.
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'supervisor', 'case_manager')),
  token_hash text not null unique,
  invited_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references users(id) on delete set null
);
create index if not exists invitations_org_idx on invitations(org_id, created_at desc);

-- Which organization a record belongs to. Null = personal (owner only).
-- A client (people row) gets one when it belongs to an agency; everything
-- attached to that client inherits it automatically (triggers below), so the
-- app can't forget. Records with no client attached stay null: personal.
alter table people add column if not exists org_id uuid references organizations(id) on delete set null;
alter table notes add column if not exists org_id uuid references organizations(id) on delete set null;
alter table tasks add column if not exists org_id uuid references organizations(id) on delete set null;
alter table check_ins add column if not exists org_id uuid references organizations(id) on delete set null;
alter table list_items add column if not exists org_id uuid references organizations(id) on delete set null;
alter table activity add column if not exists org_id uuid references organizations(id) on delete set null;
alter table person_summaries add column if not exists org_id uuid references organizations(id) on delete set null;
create index if not exists people_org_idx on people(org_id) where org_id is not null;
create index if not exists notes_org_idx on notes(org_id) where org_id is not null;
create index if not exists tasks_org_idx on tasks(org_id) where org_id is not null;
create index if not exists check_ins_org_idx on check_ins(org_id) where org_id is not null;

-- "Keep private": a person the owner marked personal never joins the organization.
alter table people add column if not exists personal boolean not null default false;

-- Client list import (Settings → Data): which upload created the row (for undo),
-- and when they actually became a client, so imported clients aren't counted as new.
alter table people add column if not exists import_batch uuid;
alter table people add column if not exists client_since date;
create index if not exists people_import_batch_idx on people(import_batch) where import_batch is not null;

-- A new client created by an active member belongs to their organization (unless kept private).
create or replace function people_set_org() returns trigger language plpgsql set search_path = public as $$
begin
  if new.org_id is null and not coalesce(new.personal, false) then
    select m.org_id into new.org_id from memberships m where m.user_id = new.user_id and m.active;
  end if;
  return new;
end $$;
drop trigger if exists people_set_org on people;
create trigger people_set_org before insert on people for each row execute function people_set_org();

-- Attached records take their client's organization (null for personal ones).
create or replace function inherit_person_org() returns trigger language plpgsql set search_path = public as $$
begin
  new.org_id := (select p.org_id from people p where p.id = new.person_id);
  return new;
end $$;
drop trigger if exists notes_inherit_org on notes;
create trigger notes_inherit_org before insert or update of person_id on notes for each row execute function inherit_person_org();
drop trigger if exists tasks_inherit_org on tasks;
create trigger tasks_inherit_org before insert or update of person_id on tasks for each row execute function inherit_person_org();
drop trigger if exists check_ins_inherit_org on check_ins;
create trigger check_ins_inherit_org before insert or update of person_id on check_ins for each row execute function inherit_person_org();
drop trigger if exists list_items_inherit_org on list_items;
create trigger list_items_inherit_org before insert or update of person_id on list_items for each row execute function inherit_person_org();
drop trigger if exists activity_inherit_org on activity;
create trigger activity_inherit_org before insert or update of person_id on activity for each row execute function inherit_person_org();
drop trigger if exists person_summaries_inherit_org on person_summaries;
create trigger person_summaries_inherit_org before insert or update of person_id on person_summaries for each row execute function inherit_person_org();

-- When a client joins or leaves an organization, everything attached follows.
create or replace function people_cascade_org() returns trigger language plpgsql set search_path = public as $$
begin
  if new.org_id is distinct from old.org_id then
    update notes set org_id = new.org_id where person_id = new.id;
    update tasks set org_id = new.org_id where person_id = new.id;
    update check_ins set org_id = new.org_id where person_id = new.id;
    update list_items set org_id = new.org_id where person_id = new.id;
    update activity set org_id = new.org_id where person_id = new.id;
    update person_summaries set org_id = new.org_id where person_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists people_cascade_org on people;
create trigger people_cascade_org after update of org_id on people for each row execute function people_cascade_org();

-- Supervisor/admin comments on a client (Phase 4). Visible to the client's
-- case manager and the organization's supervisors and admins.
create table if not exists client_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists client_comments_person_idx on client_comments(person_id, created_at desc);

-- Audit log (Phase 4): who created, changed, deleted, reassigned, commented
-- on or viewed an organization's client records. Changes are written by
-- database triggers, so nothing can skip them; views by the app. Only field
-- names are kept, never values, so the log isn't a second copy of client data.
-- No foreign keys: entries outlive deleted people and records.
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  person_id uuid,
  fields text[],
  at timestamptz not null default now()
);
create index if not exists audit_log_org_idx on audit_log(org_id, at desc);
create index if not exists audit_log_person_idx on audit_log(person_id, at desc);

create or replace function audit_client_change() returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  org uuid := coalesce((to_jsonb(new)->>'org_id')::uuid, (to_jsonb(old)->>'org_id')::uuid);
  -- The signed-in user when the change came through asUser()/Supabase's API; otherwise the row's owner
  -- (the app only ever writes a user's own rows).
  actor uuid := coalesce(
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub', '')::uuid,
    (rec->>'author_id')::uuid,
    (rec->>'user_id')::uuid);
  act text;
  changed text[];
begin
  if org is null then return null; end if;  -- personal records are never logged
  if tg_op = 'INSERT' then
    act := 'create';
  elsif tg_op = 'DELETE' then
    act := 'delete';
  else
    select array_agg(k order by k) into changed
      from jsonb_each(to_jsonb(new)) n(k, v)
     where k not in ('updated_at', 'last_activity_at', 'reminded_at', 'search_vector', 'org_id')
       and v is distinct from to_jsonb(old)->k;
    if changed is null then return null; end if;  -- only bookkeeping columns changed
    act := case
      when 'user_id' = any(changed) then 'reassign'
      when 'deleted_at' = any(changed) and (to_jsonb(new)->>'deleted_at') is not null then 'delete'
      when 'deleted_at' = any(changed) then 'restore'
      else 'update' end;
  end if;
  insert into audit_log (org_id, actor_id, action, table_name, record_id, person_id, fields)
  values (org, actor, act, tg_table_name, (rec->>'id')::uuid,
          coalesce((rec->>'person_id')::uuid, case when tg_table_name = 'people' then (rec->>'id')::uuid end),
          changed);
  return null;
end $$;
drop trigger if exists people_audit on people;
create trigger people_audit after insert or update or delete on people for each row execute function audit_client_change();
drop trigger if exists notes_audit on notes;
create trigger notes_audit after insert or update or delete on notes for each row execute function audit_client_change();
drop trigger if exists tasks_audit on tasks;
create trigger tasks_audit after insert or update or delete on tasks for each row execute function audit_client_change();
drop trigger if exists check_ins_audit on check_ins;
create trigger check_ins_audit after insert or update or delete on check_ins for each row execute function audit_client_change();
drop trigger if exists client_comments_audit on client_comments;
create trigger client_comments_audit after insert or delete on client_comments for each row execute function audit_client_change();

-- Row level security on every table, with no policies: Supabase's public
-- API (anon/authenticated roles) gets no rows at all. The app connects
-- directly as the table owner, which bypasses RLS, and scopes every query
-- by requireUserId(). Per-row policies come with the organization layer.
alter table people enable row level security;
alter table notes enable row level security;
alter table lists enable row level security;
alter table list_items enable row level security;
alter table tasks enable row level security;
alter table person_summaries enable row level security;
alter table activity enable row level security;
alter table users enable row level security;
alter table sessions enable row level security;
alter table password_resets enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table check_ins enable row level security;
alter table app_meta enable row level security;
alter table user_settings enable row level security;
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table invitations enable row level security;
alter table client_comments enable row level security;
alter table audit_log enable row level security;

-- user_settings: each person can only ever reach their own row through
-- Supabase's API (the app itself connects as the owner and scopes by
-- requireUserId()).
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'user_settings' and policyname = 'own settings') then
    create policy "own settings" on user_settings for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
exception when undefined_function or invalid_schema_name or undefined_object then
  null; -- plain Postgres without Supabase's auth schema/roles: RLS stays on with no access
end $$;

-- The access-rule helpers live in a schema Supabase's API doesn't expose, so
-- signed-in users can't call them directly; the rules themselves still can.
do $$
begin
  create schema if not exists app_private;
  revoke all on schema app_private from public;
  revoke all on schema app_private from anon;
  grant usage on schema app_private to authenticated;
exception when undefined_object then
  null; -- plain Postgres without Supabase's roles
end $$;

-- ── Access rules (RLS) for organizations ────────────────────────────────────
-- Enforced by the database for every query made as a signed-in user (the
-- "authenticated" role: Supabase's API, and the app's asUser() in
-- lib/db/as-user.ts). The core privacy rule:
--   * Your own records: you, always.
--   * A client's records (org_id set): also every active member of your
--     organization, read-only (shared caseload).
--   * Personal records (org_id null): only you. Never supervisors or admins.
do $$
begin
  create or replace function app_private.app_org_member(o uuid) returns boolean
    language sql stable security definer set search_path = public as
    'select o is not null and exists (select 1 from memberships m
       where m.org_id = o and m.user_id = auth.uid() and m.active)';
  -- Any active member of the organization can read its client records (shared caseload).
  create or replace function app_private.app_org_viewer(o uuid) returns boolean
    language sql stable security definer set search_path = public as
    'select o is not null and exists (select 1 from memberships m
       where m.org_id = o and m.user_id = auth.uid() and m.active)';
  create or replace function app_private.app_org_admin(o uuid) returns boolean
    language sql stable security definer set search_path = public as
    'select o is not null and exists (select 1 from memberships m
       where m.org_id = o and m.user_id = auth.uid() and m.active and m.role = ''admin'')';
  create or replace function app_private.app_shares_org(other uuid) returns boolean
    language sql stable security definer set search_path = public as
    'select exists (select 1 from memberships me join memberships them on them.org_id = me.org_id
       where me.user_id = auth.uid() and me.active and them.user_id = other)';

  -- Client data: owner full access; org admins/supervisors read.
  drop policy if exists "owner" on people;
  create policy "owner" on people for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and (org_id is null or app_private.app_org_member(org_id)));
  drop policy if exists "org read" on people;
  create policy "org read" on people for select to authenticated using (app_private.app_org_viewer(org_id));

  drop policy if exists "owner" on notes;
  create policy "owner" on notes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  drop policy if exists "org read" on notes;
  create policy "org read" on notes for select to authenticated using (app_private.app_org_viewer(org_id));

  drop policy if exists "owner" on tasks;
  create policy "owner" on tasks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  -- Tasks are private to the member who owns them (no organization-wide read).
  drop policy if exists "org read" on tasks;

  drop policy if exists "owner" on check_ins;
  create policy "owner" on check_ins for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  drop policy if exists "org read" on check_ins;
  create policy "org read" on check_ins for select to authenticated using (app_private.app_org_viewer(org_id));

  drop policy if exists "owner" on list_items;
  create policy "owner" on list_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  drop policy if exists "org read" on list_items;
  create policy "org read" on list_items for select to authenticated using (app_private.app_org_viewer(org_id));

  drop policy if exists "owner" on activity;
  create policy "owner" on activity for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  drop policy if exists "org read" on activity;
  create policy "org read" on activity for select to authenticated using (app_private.app_org_viewer(org_id) and type not like 'task%');

  drop policy if exists "owner" on person_summaries;
  create policy "owner" on person_summaries for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  drop policy if exists "org read" on person_summaries;
  create policy "org read" on person_summaries for select to authenticated using (app_private.app_org_viewer(org_id));

  -- Personal-only tables.
  drop policy if exists "owner" on lists;
  create policy "owner" on lists for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  drop policy if exists "owner" on notifications;
  create policy "owner" on notifications for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  drop policy if exists "owner" on push_subscriptions;
  create policy "owner" on push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

  -- People: yourself; colleagues' names/emails within your organization.
  drop policy if exists "self or colleague" on users;
  create policy "self or colleague" on users for select to authenticated using (id = (select auth.uid()) or app_private.app_shares_org(id));
  -- Through the API, colleagues may read only id, name and email (never phone,
  -- 2FA status or legacy password hashes); nobody writes users through it.
  revoke all on table users from anon, authenticated;
  grant select (id, email, name) on table users to authenticated;
  -- No update policy on users: mfa_enabled and the rest are changed only by the server.
  drop policy if exists "self update" on users;

  -- Organizations: members read; admins change.
  drop policy if exists "member read" on organizations;
  create policy "member read" on organizations for select to authenticated using (app_private.app_org_member(id));
  drop policy if exists "admin update" on organizations;
  create policy "admin update" on organizations for update to authenticated using (app_private.app_org_admin(id)) with check (app_private.app_org_admin(id));
  -- Through the API, admins may edit only the organization's profile and logo;
  -- billing, referral settings and everything else change only on the server.
  revoke insert, update, delete on table organizations from authenticated;
  grant update (name, phone, email, website, address, about, logo, logo_type, logo_updated_at, updated_at)
    on table organizations to authenticated;

  drop policy if exists "member read" on memberships;
  create policy "member read" on memberships for select to authenticated using (user_id = (select auth.uid()) or app_private.app_org_member(org_id));
  -- Admins change a member's role or active status. Adding members happens only
  -- on the server (invites, which check seats), so there is no insert rule.
  drop policy if exists "admin write" on memberships;
  drop policy if exists "admin update" on memberships;
  create policy "admin update" on memberships for update to authenticated using (app_private.app_org_admin(org_id)) with check (app_private.app_org_admin(org_id));
  revoke insert, update, delete on table memberships from authenticated;
  grant update (role, active, deactivated_at) on table memberships to authenticated;

  create or replace function app_private.app_owns_person(pid uuid) returns boolean
    language sql stable security definer set search_path = public as
    'select exists (select 1 from people p where p.id = pid and p.user_id = auth.uid())';
  create or replace function app_private.app_person_in_org(pid uuid, o uuid) returns boolean
    language sql stable security definer set search_path = public as
    'select exists (select 1 from people p where p.id = pid and p.org_id = o and p.deleted_at is null)';

  -- Comments: the client's case manager and org viewers read; viewers write as themselves.
  drop policy if exists "read" on client_comments;
  create policy "read" on client_comments for select to authenticated
    using (app_private.app_org_viewer(org_id) or app_private.app_owns_person(person_id));
  drop policy if exists "write" on client_comments;
  create policy "write" on client_comments for insert to authenticated
    with check (author_id = (select auth.uid()) and app_private.app_org_viewer(org_id) and app_private.app_person_in_org(person_id, org_id));
  drop policy if exists "delete own" on client_comments;
  create policy "delete own" on client_comments for delete to authenticated using (author_id = (select auth.uid()));

  -- Audit log: the organization's admins read it; nobody writes through the API.
  drop policy if exists "admin read" on audit_log;
  create policy "admin read" on audit_log for select to authenticated using (app_private.app_org_admin(org_id));

  drop policy if exists "admin" on invitations;
  drop policy if exists "admin read" on invitations;
  drop policy if exists "admin refresh" on invitations;
  drop policy if exists "admin cancel" on invitations;
  create policy "admin read" on invitations for select to authenticated using (app_private.app_org_admin(org_id));
  create policy "admin refresh" on invitations for update to authenticated using (app_private.app_org_admin(org_id)) with check (app_private.app_org_admin(org_id));
  create policy "admin cancel" on invitations for delete to authenticated using (app_private.app_org_admin(org_id));
  revoke insert, update on table invitations from authenticated;
  grant update (token_hash, expires_at) on table invitations to authenticated;
  -- Defense in depth: signed-out visitors get nothing through the API, and
  -- nobody can empty or alter table structure through it.
  revoke all on all tables in schema public from anon;
  revoke truncate, trigger, references on all tables in schema public from authenticated;
  -- The access-rule helpers are only for the rules themselves: not callable by signed-out visitors.
  revoke execute on function app_private.app_org_member(uuid), app_private.app_org_viewer(uuid), app_private.app_org_admin(uuid), app_private.app_shares_org(uuid),
    app_private.app_owns_person(uuid), app_private.app_person_in_org(uuid, uuid) from public, anon;
  grant execute on function app_private.app_org_member(uuid), app_private.app_org_viewer(uuid), app_private.app_org_admin(uuid), app_private.app_shares_org(uuid),
    app_private.app_owns_person(uuid), app_private.app_person_in_org(uuid, uuid) to authenticated;
  revoke execute on function audit_client_change(), people_set_org(), inherit_person_org(), people_cascade_org()
    from public, anon, authenticated;
exception when undefined_function or invalid_schema_name or undefined_object then
  null; -- plain Postgres without Supabase's auth schema/roles: RLS stays on with no access
end $$;

-- Referrals: a public form (one link per organization) other departments use
-- to send clients in. Admins review each one in the Referrals inbox. Every
-- submission is kept as the referral log.
alter table organizations add column if not exists referral_code text unique;
alter table organizations add column if not exists referral_enabled boolean not null default false;
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  first_name text not null check (length(first_name) between 1 and 80),
  last_name text not null check (length(last_name) between 1 and 80),
  phone text check (length(phone) <= 40),
  dob date,
  referrer_name text not null check (length(referrer_name) between 1 and 120),
  referrer_department text not null check (length(referrer_department) between 1 and 120),
  status text not null default 'new' check (status in ('new', 'accepted', 'matched', 'declined')),
  person_id uuid references people(id) on delete set null,
  handled_by uuid references users(id) on delete set null,
  handled_at timestamptz,
  decline_reason text check (length(decline_reason) <= 500),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists referrals_org_idx on referrals(org_id, created_at desc);
create index if not exists referrals_ip_idx on referrals(ip_hash, created_at desc);
-- Referral appointments, services and limits (Organization → Referral settings).
-- Hours are per weekday in the org's zone; limits never block a referral, they
-- only push its appointment to the next opening (lib/referral-slots.ts).
alter table organizations add column if not exists referral_appointments boolean not null default true;
alter table organizations add column if not exists referral_hours jsonb;
alter table organizations add column if not exists referral_slot_minutes int not null default 30 check (referral_slot_minutes between 10 and 240);
alter table organizations add column if not exists referral_timezone text;
alter table organizations add column if not exists referral_services text[] not null default '{}';
alter table organizations add column if not exists referral_max_day int check (referral_max_day > 0);
alter table organizations add column if not exists referral_max_week int check (referral_max_week > 0);
alter table organizations add column if not exists referral_max_month int check (referral_max_month > 0);
alter table referrals add column if not exists appointment_at timestamptz;
alter table referrals add column if not exists waitlisted boolean not null default false;
alter table referrals add column if not exists services text[] not null default '{}';
alter table referrals add column if not exists notes text check (length(notes) <= 2000);
alter table referrals add column if not exists referrer_email text check (length(referrer_email) <= 254);
-- Where referred clients go: set by the organization (Referral settings), shown read-only to partners, kept on each referral.
alter table organizations add column if not exists referral_location text check (length(referral_location) <= 300);
alter table referrals add column if not exists location text check (length(location) <= 300);
-- One client per slot; a declined referral frees its slot.
create unique index if not exists referrals_slot_idx on referrals(org_id, appointment_at)
  where appointment_at is not null and status <> 'declined';
-- The appointment task each admin gets for a booked referral.
alter table tasks add column if not exists referral_id uuid references referrals(id) on delete set null;
create index if not exists tasks_referral_idx on tasks(referral_id) where referral_id is not null;
alter table referrals enable row level security;
do $$
begin
  drop policy if exists "admin" on referrals;
  create policy "admin" on referrals for select to authenticated using (app_private.app_org_admin(org_id));
exception when undefined_function or invalid_schema_name or undefined_object then
  null;
end $$;

-- Billing (Stripe). One row per paying account: an individual (user_id) or an
-- organization (org_id). plan: individual | seat | team | comp (free for life).
-- status mirrors Stripe: trialing | active | past_due | canceled | comp.
-- Only the server reads or writes it (RLS on, no policies).
create table if not exists billing_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  org_id uuid unique references organizations(id) on delete cascade,
  plan text not null default 'individual' check (plan in ('individual', 'seat', 'team', 'comp')),
  status text not null default 'trialing',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  seats int,
  current_period_end timestamptz,
  past_due_since timestamptz,
  updated_at timestamptz not null default now(),
  check ((user_id is null) <> (org_id is null))
);
alter table billing_accounts enable row level security;
-- 'org': seat-based organization plan (lib/pricing.ts); seats = seats bought.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'billing_accounts_plan_check'
                  and pg_get_constraintdef(oid) like '%''org''%') then
    alter table billing_accounts drop constraint if exists billing_accounts_plan_check;
    alter table billing_accounts add constraint billing_accounts_plan_check
      check (plan in ('individual', 'org', 'seat', 'team', 'comp'));
  end if;
end $$;
-- Cancel flow and post-checkout welcome: whether renewal is off, the one-time
-- "stay for $5" offer, and which subscription has already seen the welcome screen.
alter table billing_accounts add column if not exists cancel_at_period_end boolean not null default false;
alter table billing_accounts add column if not exists save_offer_used_at timestamptz;
alter table billing_accounts add column if not exists welcomed_subscription_id text;

-- One free trial per card: Stripe card fingerprints that already started an individual trial.
create table if not exists trial_cards (
  fingerprint text primary key,
  user_id uuid,
  subscription_id text not null,
  created_at timestamptz not null default now()
);
alter table trial_cards enable row level security;

-- Owner command center (/owner): sign-up problems, app errors and billing
-- events, kept here because Vercel's own logs last an hour on Hobby.
-- Server-only (RLS on, no policies).
create table if not exists app_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  email text,
  path text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists app_events_created_idx on app_events (created_at desc);
create index if not exists app_events_kind_idx on app_events (kind, created_at desc);
alter table app_events enable row level security;

-- Calendar sync. Outside calendars (Google, Apple, Outlook, Calendly, Cal.com)
-- each person subscribes to by their private iCal link; events are fetched
-- live and never stored. color is a palette slot (1-4, --cal-ext-N), not a hex.
create table if not exists calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  url text not null check (length(url) between 8 and 2000),
  color smallint not null default 1 check (color between 1 and 4),
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists calendar_feeds_user_idx on calendar_feeds (user_id, created_at);
alter table calendar_feeds enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'calendar_feeds' and policyname = 'owner') then
    create policy "owner" on calendar_feeds for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
exception when undefined_function or invalid_schema_name or undefined_object then
  null;
end $$;

-- The secret in each person's subscribe-from-Google/Apple link (/api/calendar/feed/<token>).
alter table user_settings add column if not exists calendar_feed_token text;
create unique index if not exists user_settings_calendar_feed_token_idx on user_settings (calendar_feed_token);

-- Terms of service / privacy policy agreement (lib/legal.ts LEGAL_VERSION).
-- users/organizations hold the latest version agreed to; legal_acceptances
-- keeps every agreement (who, what, when, from where) as the record.
alter table users add column if not exists terms_version text;
alter table users add column if not exists terms_accepted_at timestamptz;
alter table organizations add column if not exists terms_version text;
alter table organizations add column if not exists terms_accepted_at timestamptz;
alter table organizations add column if not exists terms_accepted_by uuid references users(id) on delete set null;
create table if not exists legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  kind text not null check (kind in ('user', 'organization', 'membership')),
  version text not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists legal_acceptances_user_idx on legal_acceptances (user_id, created_at desc);
alter table legal_acceptances enable row level security;

-- Services: what a business or agency provides (Settings → Services). One list
-- per organization (admins manage it), or per person for solo accounts. Logging
-- a check-in/meeting with a service records what was provided, when and for how
-- much; amount_cents is the price at that moment, so later price changes don't
-- rewrite past revenue. Archived services keep their history.
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  price_cents int check (price_cents >= 0 and price_cents <= 100000000),
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (org_id is not null or user_id is not null)
);
create unique index if not exists services_name_idx on services (coalesce(org_id, user_id), lower(name)) where archived_at is null;
create index if not exists services_scope_idx on services (org_id, user_id, position);
alter table services enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'services' and policyname = 'owner') then
    create policy "owner" on services for all to authenticated
      using (org_id is null and user_id = (select auth.uid())) with check (org_id is null and user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'services' and policyname = 'org read') then
    create policy "org read" on services for select to authenticated using (app_private.app_org_viewer(org_id));
  end if;
exception when undefined_function or invalid_schema_name or undefined_object then
  null;
end $$;
alter table check_ins add column if not exists service_id uuid references services(id) on delete set null;
alter table check_ins add column if not exists amount_cents int check (amount_cents >= 0 and amount_cents <= 100000000);
create index if not exists check_ins_service_idx on check_ins (service_id) where service_id is not null;
-- Checked at commit: deleting an organization removes its services (setting check_ins.service_id to null)
-- while its people's org cascade updates the same check-ins; checking mid-statement fails on that order.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'check_ins_service_id_fkey' and not condeferred) then
    alter table check_ins drop constraint check_ins_service_id_fkey;
    alter table check_ins add constraint check_ins_service_id_fkey foreign key (service_id)
      references services(id) on delete set null deferrable initially deferred;
  end if;
end $$;

-- Whether the person picked their auto sign-out time. Until they do, the
-- default depends on the account: 4 hours for individuals, 30 minutes in an
-- organization (lib/auth.ts defaultIdleMinutes).
alter table user_settings add column if not exists idle_timeout_chosen boolean not null default false;

-- Per-user usage counters for anything that costs money or server time
-- (lib/usage.ts): AI calls, voice transcription, texts, report exports.
-- One row per user, kind and hour. Server-only (RLS on, no policies).
create table if not exists usage_counters (
  user_id uuid not null,
  kind text not null,
  hour timestamptz not null,
  count int not null default 0,
  primary key (user_id, kind, hour)
);
create index if not exists usage_counters_hour_idx on usage_counters (hour);
alter table usage_counters enable row level security;

-- Covering indexes for foreign keys (Supabase performance advisor, Nov 2026).
create index if not exists activity_list_id_idx on activity(list_id);
create index if not exists activity_note_id_idx on activity(note_id);
create index if not exists activity_org_id_idx on activity(org_id);
create index if not exists activity_task_id_idx on activity(task_id);
create index if not exists client_comments_author_id_idx on client_comments(author_id);
create index if not exists client_comments_org_id_idx on client_comments(org_id);
create index if not exists invitations_accepted_by_idx on invitations(accepted_by);
create index if not exists invitations_invited_by_idx on invitations(invited_by);
create index if not exists legal_acceptances_org_id_idx on legal_acceptances(org_id);
create index if not exists list_items_org_id_idx on list_items(org_id);
create index if not exists notifications_note_id_idx on notifications(note_id);
create index if not exists notifications_person_id_idx on notifications(person_id);
create index if not exists notifications_task_id_idx on notifications(task_id);
create index if not exists organizations_created_by_idx on organizations(created_by);
create index if not exists organizations_terms_accepted_by_idx on organizations(terms_accepted_by);
create index if not exists person_summaries_org_id_idx on person_summaries(org_id);
create index if not exists referrals_handled_by_idx on referrals(handled_by);
create index if not exists referrals_person_id_idx on referrals(person_id);
create index if not exists services_user_id_idx on services(user_id);
create index if not exists tasks_list_id_idx on tasks(list_id);
create index if not exists tasks_recurs_from_idx on tasks(recurs_from);
create index if not exists tasks_source_note_id_idx on tasks(source_note_id);
`;
