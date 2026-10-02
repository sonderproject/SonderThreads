import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { deleteAccount, logout } from "@/app/login/actions";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;

  return (
    <div className="max-w-md space-y-8">
      <div className="space-y-1">
        <h1 className="font-mono text-lg uppercase tracking-wide text-text">Account</h1>
        <p className="text-sm text-text-muted">{user.email}</p>
      </div>

      <form action={logout}>
        <button
          type="submit"
          className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover"
        >
          Sign out
        </button>
      </form>

      <form action={deleteAccount} className="space-y-2 rounded border border-danger/40 p-4">
        <p className="text-sm font-medium text-danger">Delete account</p>
        <p className="text-xs text-text-muted">
          Permanently deletes your account and everything in it: people, lists, tasks and notes. This
          can&apos;t be undone. Type DELETE to confirm.
        </p>
        {error === "confirm" && <p className="text-xs text-danger">Type DELETE exactly to confirm.</p>}
        <input name="confirm" autoComplete="off" placeholder="DELETE" className="input font-mono" />
        <button
          type="submit"
          className="rounded border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
        >
          Delete my account
        </button>
      </form>
    </div>
  );
}
