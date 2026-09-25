"use server";

import { query } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import type { Task } from "@/lib/types";

export type CalendarBirthday = { personId: string; displayName: string; day: number };

/** Everything to render a single month of the calendar: tasks due that month, plus recurring person birthdays that fall in it. */
export async function getCalendarMonth(
  year: number,
  month: number,
): Promise<{ tasks: Task[]; birthdays: CalendarBirthday[] }> {
  const tasks = await query<Task>(
    `select * from tasks
     where user_id = $1
       and deleted_at is null
       and due_at is not null
       and extract(year from due_at) = $2
       and extract(month from due_at) = $3
     order by due_at asc`,
    [OWNER_ID, year, month],
  );

  const birthdayRows = await query<{ id: string; display_name: string; day: number }>(
    `select id, display_name, extract(day from birthday)::int as day
     from people
     where user_id = $1
       and deleted_at is null
       and birthday is not null
       and extract(month from birthday) = $2
     order by day asc`,
    [OWNER_ID, month],
  );

  return {
    tasks,
    birthdays: birthdayRows.map((r) => ({ personId: r.id, displayName: r.display_name, day: r.day })),
  };
}
