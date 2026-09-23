-- Client Command Center - initial schema
-- Tables: profiles, clients, notes, lists, list_items, tasks, client_summaries, activity
-- All user-owned tables carry user_id and are protected by Row Level Security.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (thin mirror of auth.users; supports multi-user later)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- shared updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists clients_last_activity_idx on public.clients(user_id, last_activity_at desc);
create index if not exists clients_display_name_idx on public.clients(user_id, display_name);

alter table public.clients enable row level security;

create policy "clients_all_own" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  content text not null,
  category text,
  ai_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists notes_client_id_idx on public.notes(client_id);
create index if not exists notes_created_at_idx on public.notes(user_id, created_at desc);

alter table public.notes enable row level security;

create policy "notes_all_own" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lists (a "cohort" is simply a list with is_cohort = true)
-- ---------------------------------------------------------------------------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_cohort boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lists_user_id_idx on public.lists(user_id);
create unique index if not exists lists_user_name_idx on public.lists(user_id, lower(name));

alter table public.lists enable row level security;

create policy "lists_all_own" on public.lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger lists_set_updated_at
  before update on public.lists
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- list_items
-- ---------------------------------------------------------------------------
create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  label text not null,
  checked boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists list_items_list_id_idx on public.list_items(list_id, position);
create index if not exists list_items_client_id_idx on public.list_items(client_id);

alter table public.list_items enable row level security;

create policy "list_items_all_own" on public.list_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger list_items_set_updated_at
  before update on public.list_items
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks (reminders are tasks with a due_at)
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  client_id uuid references public.clients(id) on delete set null,
  list_id uuid references public.lists(id) on delete set null,
  due_at timestamptz,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_due_at_idx on public.tasks(user_id, due_at);
create index if not exists tasks_client_id_idx on public.tasks(client_id);
create index if not exists tasks_completed_idx on public.tasks(user_id, completed);

alter table public.tasks enable row level security;

create policy "tasks_all_own" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- client_summaries (history; clients.summary always holds the latest)
-- ---------------------------------------------------------------------------
create table if not exists public.client_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  summary text not null,
  generated_by text not null default 'fallback',
  created_at timestamptz not null default now()
);

create index if not exists client_summaries_client_id_idx on public.client_summaries(client_id, created_at desc);

alter table public.client_summaries enable row level security;

create policy "client_summaries_all_own" on public.client_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- activity (drives client timelines)
-- ---------------------------------------------------------------------------
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  list_id uuid references public.lists(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  note_id uuid references public.notes(id) on delete set null,
  type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_user_id_idx on public.activity(user_id, created_at desc);
create index if not exists activity_client_id_idx on public.activity(client_id, created_at desc);

alter table public.activity enable row level security;

create policy "activity_all_own" on public.activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
