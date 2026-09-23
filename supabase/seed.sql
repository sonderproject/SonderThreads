-- Optional manual seed script.
--
-- The app already seeds demo data automatically the first time you open it
-- with an empty account (see lib/actions/seed.ts). Use this file only if you
-- want to (re)seed via SQL directly, e.g. against a specific user in the
-- Supabase SQL editor.
--
-- Replace :'user_id' below with a real auth.users.id (Authentication -> Users
-- in the Supabase dashboard), then run this file.

\set user_id 'REPLACE-WITH-A-REAL-AUTH-USER-UUID'

with new_marcus as (
  insert into public.clients (user_id, first_name, last_name, display_name, current_status, next_action)
  values (:'user_id', 'Marcus', 'Johnson', 'Marcus Johnson', 'Starts Amazon Monday', 'Follow up after first week')
  returning id
),
new_james as (
  insert into public.clients (user_id, first_name, last_name, display_name, current_status, next_action)
  values (:'user_id', 'James', 'Smith', 'James Smith', 'Guard card completed', 'Apply for security positions')
  returning id
),
new_wes as (
  insert into public.clients (user_id, first_name, last_name, display_name, current_status, next_action)
  values (:'user_id', 'Wes', 'Carter', 'Wes Carter', 'Interview scheduled', 'Follow up after interview')
  returning id
),
new_list as (
  insert into public.lists (user_id, name, is_cohort)
  values (:'user_id', 'Cohort 7', true)
  returning id
)
insert into public.list_items (user_id, list_id, client_id, label, position)
select :'user_id', new_list.id, c.id, c.label, c.pos
from new_list,
  (
    select id, 'Marcus Johnson' as label, 0 as pos from new_marcus
    union all
    select id, 'James Smith', 1 from new_james
    union all
    select id, 'Wes Carter', 2 from new_wes
  ) as c;

insert into public.notes (user_id, client_id, content, category)
select :'user_id', id, 'Marcus said he starts Amazon Monday.', 'employment'
from public.clients where user_id = :'user_id' and display_name = 'Marcus Johnson';

insert into public.notes (user_id, client_id, content, category)
select :'user_id', id, 'James got his guard card today.', 'certification'
from public.clients where user_id = :'user_id' and display_name = 'James Smith';

insert into public.notes (user_id, client_id, content, category)
select :'user_id', id, 'Wes has an interview scheduled — prepping his resume.', 'employment'
from public.clients where user_id = :'user_id' and display_name = 'Wes Carter';

insert into public.notes (user_id, content)
values (:'user_id', 'Need to ask supervisor about transportation cards.');

insert into public.tasks (user_id, title, client_id, due_at)
select :'user_id', 'Call Marcus about interview', id, now()
from public.clients where user_id = :'user_id' and display_name = 'Marcus Johnson';

insert into public.tasks (user_id, title, client_id, due_at)
select :'user_id', 'Send James onboarding paperwork', id, now()
from public.clients where user_id = :'user_id' and display_name = 'James Smith';

insert into public.tasks (user_id, title, client_id, due_at)
select :'user_id', 'Check Wes certification', id, now()
from public.clients where user_id = :'user_id' and display_name = 'Wes Carter';
