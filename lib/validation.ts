import { z, ZodError, type ZodType } from "zod";

const uuid = z.string().uuid();
const recurrence = z.enum(["daily", "weekly", "monthly"]).nullable().optional();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const createPersonSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  currentStatus: optionalText(500),
  nextAction: optionalText(500),
});

export const updatePersonSchema = z
  .object({
    current_status: optionalText(500),
    next_action: optionalText(500),
    status: z.enum(["active", "inactive", "alumni"]).nullable().optional(),
    phone: optionalText(50),
    email: z.union([z.string().trim().email("Not a valid email"), z.literal("")]).nullable().optional(),
    birthday: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birthday must be a valid date"), z.literal("")])
      .nullable()
      .optional(),
    display_name: z.string().trim().min(1).max(200).optional(),
  })
  .partial();

export const createNoteSchema = z.object({
  content: z.string().trim().min(1, "Note can't be empty").max(5000, "Note is too long"),
  personId: uuid.nullable().optional(),
  category: optionalText(100),
  aiMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required").max(500, "Title is too long"),
  personId: uuid.nullable().optional(),
  listId: uuid.nullable().optional(),
  dueAt: z.string().nullable().optional(),
  notes: optionalText(2000),
  recurrence,
});

export const createListSchema = z.object({
  name: z.string().trim().min(1, "List name is required").max(200, "Name is too long"),
  description: optionalText(1000),
  isGroup: z.boolean().optional(),
});

export const importPeopleSchema = z.object({
  listName: z.string().trim().min(1, "List name is required").max(200, "Name is too long"),
  isGroup: z.boolean(),
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(320).nullable(),
        phone: z.string().trim().max(50).nullable(),
        birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      }),
    )
    .min(1, "No names found in that file")
    .max(2000, "That file has more than 2,000 people — split it up and import in batches"),
});

export const addListItemSchema = z.object({
  listId: uuid,
  label: z.string().trim().min(1, "Item can't be empty").max(500, "Item is too long"),
  personId: uuid.nullable().optional(),
});

export const updateListItemSchema = z.object({
  label: z.string().trim().min(1, "Item can't be empty").max(500, "Item is too long"),
});

export const updateNoteSchema = z.object({
  content: z.string().trim().min(1, "Note can't be empty").max(5000, "Note is too long"),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Task title is required").max(500, "Title is too long"),
    due_at: z.string().nullable().optional(),
    notes: optionalText(2000),
    person_id: uuid.nullable().optional(),
    list_id: uuid.nullable().optional(),
    recurrence,
  })
  .partial();

/**
 * Validates input against a schema, throwing a plain Error with just the
 * first issue's message rather than a raw ZodError — clean enough to show
 * a user directly (e.g. from command.ts's catch block) instead of a wall
 * of validation-library internals.
 */
export function validate<T>(schema: ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(err.issues[0]?.message ?? "Invalid input");
    }
    throw err;
  }
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Runs a server action body and converts a thrown error into a plain result
 * object instead of letting it propagate. Next.js redacts the message of any
 * error that crosses the Server Action RPC boundary in production builds —
 * catching it *inside* the action (here) is the only way a client component
 * ever sees the real validation/error message.
 */
export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
