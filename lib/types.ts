export type PersonStatus = "active" | "inactive" | "alumni";

export type Person = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  display_name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  status: PersonStatus | null;
  current_status: string | null;
  next_action: string | null;
  summary: string | null;
  needs_followup: boolean;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  deleted_at: string | null;
};

export type Note = {
  id: string;
  user_id: string;
  person_id: string | null;
  content: string;
  category: string | null;
  ai_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type List = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_group: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ListItem = {
  id: string;
  user_id: string;
  list_id: string;
  person_id: string | null;
  label: string;
  checked: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type TaskRecurrence = "daily" | "weekly" | "monthly";

export type Task = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  person_id: string | null;
  list_id: string | null;
  due_at: string | null;
  completed: boolean;
  completed_at: string | null;
  recurrence: TaskRecurrence | null;
  /** The recurring task this one was spawned from, if any. */
  recurs_from: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PersonSummaryRecord = {
  id: string;
  user_id: string;
  person_id: string;
  summary: string;
  generated_by: string;
  created_at: string;
};

export type ActivityType =
  | "person_created"
  | "note_added"
  | "added_to_list"
  | "removed_from_list"
  | "task_created"
  | "task_completed"
  | "status_changed"
  | "summary_updated"
  | "list_created";

export type Activity = {
  id: string;
  user_id: string;
  person_id: string | null;
  list_id: string | null;
  task_id: string | null;
  note_id: string | null;
  type: ActivityType;
  description: string;
  created_at: string;
};
