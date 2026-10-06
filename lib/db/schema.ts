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

-- No silent fallback to the old single owner: an insert that forgets
-- user_id now fails instead of landing in someone else's account.
alter table people alter column user_id drop default;
alter table notes alter column user_id drop default;
alter table lists alter column user_id drop default;
alter table list_items alter column user_id drop default;
alter table tasks alter column user_id drop default;
alter table person_summaries alter column user_id drop default;
alter table activity alter column user_id drop default;
`;
