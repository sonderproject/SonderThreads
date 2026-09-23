export type ClientStatus = "active" | "inactive" | "alumni";

export type Client = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  display_name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  status: ClientStatus | null;
  current_status: string | null;
  next_action: string | null;
  summary: string | null;
  needs_followup: boolean;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

export type Note = {
  id: string;
  user_id: string;
  client_id: string | null;
  content: string;
  category: string | null;
  ai_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type List = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_cohort: boolean;
  created_at: string;
  updated_at: string;
}

export type ListItem = {
  id: string;
  user_id: string;
  list_id: string;
  client_id: string | null;
  label: string;
  checked: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export type Task = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  client_id: string | null;
  list_id: string | null;
  due_at: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientSummaryRecord = {
  id: string;
  user_id: string;
  client_id: string;
  summary: string;
  generated_by: string;
  created_at: string;
}

export type ActivityType =
  | "client_created"
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
  client_id: string | null;
  list_id: string | null;
  task_id: string | null;
  note_id: string | null;
  type: ActivityType;
  description: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string | null; created_at: string };
        Insert: { id: string; email?: string | null; created_at?: string };
        Update: { id?: string; email?: string | null; created_at?: string };
        Relationships: [];
      };
      clients: {
        Row: Client;
        Insert: {
          id?: string;
          user_id: string;
          first_name: string;
          last_name?: string | null;
          display_name: string;
          phone?: string | null;
          email?: string | null;
          birthday?: string | null;
          status?: ClientStatus | null;
          current_status?: string | null;
          next_action?: string | null;
          summary?: string | null;
          needs_followup?: boolean;
          created_at?: string;
          updated_at?: string;
          last_activity_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          first_name?: string;
          last_name?: string | null;
          display_name?: string;
          phone?: string | null;
          email?: string | null;
          birthday?: string | null;
          status?: ClientStatus | null;
          current_status?: string | null;
          next_action?: string | null;
          summary?: string | null;
          needs_followup?: boolean;
          created_at?: string;
          updated_at?: string;
          last_activity_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: Note;
        Insert: {
          id?: string;
          user_id: string;
          client_id?: string | null;
          content: string;
          category?: string | null;
          ai_metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string | null;
          content?: string;
          category?: string | null;
          ai_metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lists: {
        Row: List;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          is_cohort?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          is_cohort?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      list_items: {
        Row: ListItem;
        Insert: {
          id?: string;
          user_id: string;
          list_id: string;
          client_id?: string | null;
          label: string;
          checked?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          list_id?: string;
          client_id?: string | null;
          label?: string;
          checked?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          notes?: string | null;
          client_id?: string | null;
          list_id?: string | null;
          due_at?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          notes?: string | null;
          client_id?: string | null;
          list_id?: string | null;
          due_at?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_summaries: {
        Row: ClientSummaryRecord;
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          summary: string;
          generated_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string;
          summary?: string;
          generated_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      activity: {
        Row: Activity;
        Insert: {
          id?: string;
          user_id: string;
          client_id?: string | null;
          list_id?: string | null;
          task_id?: string | null;
          note_id?: string | null;
          type: ActivityType;
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string | null;
          list_id?: string | null;
          task_id?: string | null;
          note_id?: string | null;
          type?: ActivityType;
          description?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
