import { createClient } from "@/lib/supabase/server";

export async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      "No Supabase session found. This usually means Anonymous Sign-ins " +
        "aren't enabled yet: Supabase dashboard → Authentication → Providers → " +
        "Anonymous Sign-ins → Enable. Also double-check NEXT_PUBLIC_SUPABASE_URL " +
        "and NEXT_PUBLIC_SUPABASE_ANON_KEY are set correctly.",
    );
  }

  return user.id;
}

export function truncate(text: string, max = 80): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
