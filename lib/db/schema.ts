/**
 * Same DDL as db/schema.sql (kept there too as the human-readable reference
 * and for manual use), duplicated here as a string so the app can apply it
 * itself at runtime — see ensureSchema() in client.ts. A .sql file isn't
 * guaranteed to be included in Vercel's serverless function bundle, so the
 * source of truth the app actually runs lives in code.
 */
export const SCHEMA_SQL = `
create extension if not exists "pgcrypto";

create table if not exists clients (
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

create index if not exists clients_user_id_idx on clients(user_id);
create index if not exists clients_last_activity_idx on clients(user_id, last_activity_at desc);
create index if not exists clients_display_name_idx on clients(user_id, display_name);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  client_id uuid references clients(id) on delete set null,
  content text not null,
  category text,
  ai_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on notes(user_id);
create index if not exists notes_client_id_idx on notes(client_id);
create index if not exists notes_created_at_idx on notes(user_id, created_at desc);

create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null,
  description text,
  is_cohort boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lists_user_id_idx on lists(user_id);
create unique index if not exists lists_user_name_idx on lists(user_id, lower(name));

create table if not exists list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  list_id uuid not null references lists(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  label text not null,
  checked boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists list_items_list_id_idx on list_items(list_id, position);
create index if not exists list_items_client_id_idx on list_items(client_id);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  title text not null,
  notes text,
  client_id uuid references clients(id) on delete set null,
  list_id uuid references lists(id) on delete set null,
  due_at timestamptz,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists tasks_due_at_idx on tasks(user_id, due_at);
create index if not exists tasks_client_id_idx on tasks(client_id);
create index if not exists tasks_completed_idx on tasks(user_id, completed);

create table if not exists client_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  client_id uuid not null references clients(id) on delete cascade,
  summary text not null,
  generated_by text not null default 'fallback',
  created_at timestamptz not null default now()
);

create index if not exists client_summaries_client_id_idx on client_summaries(client_id, created_at desc);

create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  client_id uuid references clients(id) on delete set null,
  list_id uuid references lists(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  note_id uuid references notes(id) on delete set null,
  type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_user_id_idx on activity(user_id, created_at desc);
create index if not exists activity_client_id_idx on activity(client_id, created_at desc);
`;
