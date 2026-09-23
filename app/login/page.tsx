import { LoginForm } from "@/components/auth/LoginForm";

// Never prerender this at build time: it renders a Supabase browser client,
// which needs NEXT_PUBLIC_SUPABASE_URL/ANON_KEY available at request time.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
